import { NextRequest, NextResponse } from 'next/server';

type AssistantMode = 'portal' | 'budget' | 'audit';
type UserRole = 'member' | 'treasurer' | 'owner';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantRequest {
  message?: string;
  history?: ChatTurn[];
  mode?: AssistantMode;
  role?: UserRole;
  context?: Record<string, unknown>;
}

const PII_KEY_PATTERN =
  /ic_no|bank_account|bank_qr|phone_number|whatsapp|password|pin|receipt_url|payout_proof|claimant_qr/i;

function sanitizeContextValue(val: unknown, depth = 0): unknown {
  if (depth > 5 || val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val.slice(0, 40).map((item) => sanitizeContextValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (PII_KEY_PATTERN.test(k)) continue;
      out[k] = sanitizeContextValue(v, depth + 1);
    }
    return out;
  }
  if (typeof val === 'string' && val.length > 2000) {
    return `${val.slice(0, 2000)}...`;
  }
  return val;
}

function buildRoleSafeContext(
  raw: Record<string, unknown> | undefined,
  role: UserRole,
  mode: AssistantMode
): Record<string, unknown> {
  const clean = (sanitizeContextValue(raw || {}) as Record<string, unknown>) || {};
  const isPrivileged = role === 'treasurer' || role === 'owner';
  if (!isPrivileged) {
    delete clean.finance;
    delete clean.pending_claims;
    delete clean.events_budget;
    delete clean.category_breakdown;
    delete clean.claim_audit;
  } else if (mode === 'portal') {
    // Keep aggregate finance & pending claims summary intact when privileged
  }
  return clean;
}

function fmtRm(n: unknown): string {
  const num = Number(n);
  if (!Number.isFinite(num)) return 'RM 0.00';
  return `RM ${num.toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function runLocalFallback(
  message: string,
  mode: AssistantMode,
  role: UserRole,
  context: Record<string, unknown>
): string {
  const q = message.trim().toLowerCase();
  const isPrivileged = role === 'treasurer' || role === 'owner';

  if (mode === 'audit') {
    const audit = (context.claim_audit || {}) as Record<string, unknown>;
    const amt = Number(audit.amount || 0);
    const ocrAmt = audit.ai_extracted_amount !== null && audit.ai_extracted_amount !== undefined
      ? Number(audit.ai_extracted_amount)
      : null;
    const remBudget =
      audit.event_remaining_budget !== null && audit.event_remaining_budget !== undefined
        ? Number(audit.event_remaining_budget)
        : null;
    const dupCount = Number(audit.duplicate_matches_count || 0);
    const threshold = Number(audit.approval_threshold || 200);
    const flags = Array.isArray(audit.anomaly_flags) ? (audit.anomaly_flags as string[]) : [];

    const b1 =
      ocrAmt !== null
        ? Math.abs(ocrAmt - amt) < 0.05
          ? `• **Amount & OCR Match:** Claimed ${fmtRm(amt)} matches scanned receipt amount (${fmtRm(ocrAmt)}).`
          : `• **Amount Variance:** Claimed ${fmtRm(amt)} differs from scanned receipt (${fmtRm(ocrAmt)}) — verify receipt total visually.`
        : `• **Receipt Check:** Claimed ${fmtRm(amt)} (no scanned OCR amount recorded — inspect attached receipt manually).`;

    const b2 =
      remBudget !== null
        ? amt <= remBudget
          ? `• **Budget Impact:** Event has ${fmtRm(remBudget)} remaining after prior expenses, sufficient for this ${fmtRm(amt)} claim.${amt > threshold ? ` Requires 2-stage Owner approval (above ${fmtRm(threshold)}).` : ''}`
          : `• **Budget Alert:** Claim (${fmtRm(amt)}) exceeds remaining event allocation (${fmtRm(remBudget)}) by ${fmtRm(amt - remBudget)}.`
        : `• **Budget Impact:** General Club Expense (${fmtRm(amt)}).${amt > threshold ? ` Above ${fmtRm(threshold)} 2-stage threshold.` : ''}`;

    const redFlags: string[] = [];
    if (dupCount > 0) redFlags.push(`${dupCount} similar/duplicate claim(s) detected`);
    if (flags.length > 0) redFlags.push(`OCR notes: ${flags.join('; ')}`);
    const b3 =
      redFlags.length > 0
        ? `• **Red Flags:** ${redFlags.join(' · ')}. Double-check before approving.`
        : `• **Red Flags:** No duplicate claims or automated OCR anomalies flagged.`;

    return [b1, b2, b3].join('\n');
  }

  if (mode === 'budget' || (isPrivileged && /budget|finance|overspend|summary|saving|burn|categor/i.test(q))) {
    const fin = (context.finance || {}) as Record<string, unknown>;
    const eventsBudget = Array.isArray(context.events_budget)
      ? (context.events_budget as Array<Record<string, unknown>>)
      : [];
    const catBreakdown = Array.isArray(context.category_breakdown)
      ? (context.category_breakdown as Array<Record<string, unknown>>)
      : [];
    const pendingClaims = Array.isArray(context.pending_claims)
      ? (context.pending_claims as Array<Record<string, unknown>>)
      : [];

    if (/overspend|risk|alert|nearing/i.test(q)) {
      const risky = eventsBudget
        .filter((ev) => {
          const alloc = Number(ev.allocated || 0);
          const spent = Number(ev.spent || 0);
          const pending = Number(ev.pending_claims_amount || 0);
          return alloc > 0 && (spent + pending) / alloc >= 0.75;
        })
        .map((ev) => {
          const alloc = Number(ev.allocated || 0);
          const spent = Number(ev.spent || 0);
          const pending = Number(ev.pending_claims_amount || 0);
          const pct = Math.round(((spent + pending) / alloc) * 100);
          return `• **${String(ev.event_name || 'Activity')}**: ${pct}% committed (${fmtRm(spent)} spent + ${fmtRm(pending)} pending vs ${fmtRm(alloc)} allocated)`;
        });
      if (risky.length === 0) {
        return 'No activities are currently above 75% of their allocated budget. Budget utilization looks healthy.';
      }
      return `**Events Nearing or Exceeding Allocation:**\n${risky.join('\n')}`;
    }

    if (/draft|summary|meeting|report/i.test(q)) {
      const topCats = catBreakdown
        .slice(0, 4)
        .map((c) => `${String(c.category)}: ${fmtRm(c.total)}`)
        .join(' | ');
      return [
        `**Club Finance Committee Summary**`,
        `• **Current Club Savings:** ${fmtRm(fin.current_savings)} (Bank: ${fmtRm(fin.bank_balance)} · Cash: ${fmtRm(fin.cash_balance)})`,
        `• **Cashflow:** Total IN ${fmtRm(fin.total_in)} vs Total OUT ${fmtRm(fin.total_out)} (Opening: ${fmtRm(fin.opening_balance)})`,
        `• **Pending Review:** ${pendingClaims.length} claim(s) totaling ${fmtRm(fin.pending_claims_total)} · Reserved Pre-Claims: ${fmtRm(fin.reserved_preclaims)}`,
        topCats ? `• **Top Spend Categories:** ${topCats}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const totalIn = Number(fin.total_in || 0);
    const totalOut = Number(fin.total_out || 0);
    const burnRate = totalIn > 0 ? Math.round((totalOut / totalIn) * 100) : null;
    return [
      `**Club Budget Health Snapshot:**`,
      `• **Net Savings:** ${fmtRm(fin.current_savings)} (${fmtRm(fin.bank_balance)} Bank + ${fmtRm(fin.cash_balance)} Cash)`,
      `• **Cashflow:** +${fmtRm(totalIn)} IN / -${fmtRm(totalOut)} OUT${burnRate !== null ? ` (${burnRate}% outflow-to-inflow ratio)` : ''}`,
      `• **Pending Claims:** ${pendingClaims.length} awaiting review (${fmtRm(fin.pending_claims_total)})`,
      `• **Active Budgeted Events:** ${eventsBudget.length} tracked`,
    ].join('\n');
  }

  // Portal Enquiry Assistant (Member & Admin)
  const financeAsking =
    /club saving|bank balance|cash balance|all claims|treasury|club finance|how much money does the club/i.test(q);
  if (!isPrivileged && financeAsking) {
    return 'Club treasury balances and other members\' claims are restricted to authorized Treasurers and the Club Owner. You can view your own claims under **Claims**, or check your RSVPs and receipts in **My Profile → My Activity**.';
  }

  if (/how.*claim|submit.*claim|reimburs|pre-?claim/i.test(q)) {
    return [
      '**How to Submit a Reimbursement Claim:**',
      '1. Click **Submit Claim** in the top bar (or go to **Claims → Submit Claim**).',
      '2. Upload or snap your receipt photo(s) in **Step 1 (Receipt)** — AI/OCR will auto-fill merchant, amount & date.',
      '3. Confirm the event, title & line items in **Step 2 (Details)** and review your DuitNow/Bank details in **Step 3**.',
      '*Buying before an event?* Switch to **Pre-Claim** at the top of the modal to request pre-approval or a cash advance first.',
    ].join('\n');
  }

  if (/event|upcoming|rsvp|activity|activities|fee|qr|pass/i.test(q)) {
    const events = Array.isArray(context.events)
      ? (context.events as Array<Record<string, unknown>>)
      : [];
    const active = events.filter((e) => e.status === 'Active');
    if (active.length === 0) {
      return 'There are no active upcoming events listed right now. Check the **Home & Activities** tab for pinned announcements or past event recaps.';
    }
    const list = active
      .slice(0, 6)
      .map(
        (e) =>
          `• **${String(e.event_name || 'Event')}** (${String(e.event_date || 'TBA')}${e.event_time ? ` · ${String(e.event_time)}` : ''}) — ${Number(e.registration_fee || 0) > 0 ? fmtRm(e.registration_fee) : 'Free'}${e.location ? ` @ ${String(e.location)}` : ''}`
      )
      .join('\n');
    return `**Active Club Activities:**\n${list}\n\nOpen **Home & Activities** and click an event card to RSVP, pay fees, arrange carpool, or view your QR Entry Pass.`;
  }

  if (isPrivileged && /which claim|need.*review|pending/i.test(q)) {
    const pending = Array.isArray(context.pending_claims)
      ? (context.pending_claims as Array<Record<string, unknown>>)
      : [];
    if (pending.length === 0) {
      return 'There are currently **0 pending receipt claims** waiting for review.';
    }
    const lines = pending
      .slice(0, 6)
      .map(
        (c) =>
          `• **${String(c.title || 'Claim')}** — ${fmtRm(c.amount)} (${String(c.event || 'General')}, ${String(c.date || '-')})`
      )
      .join('\n');
    return `**Claims Pending Review (${pending.length}):**\n${lines}\n\nGo to **Claims → Pending** to inspect receipts and approve or verify.`;
  }

  if (/my claim|my loan|equipment|pending|borrow/i.test(q)) {
    const myClaims = Array.isArray(context.my_claims)
      ? (context.my_claims as Array<Record<string, unknown>>)
      : [];
    const myLoans = Array.isArray(context.my_loans)
      ? (context.my_loans as Array<Record<string, unknown>>)
      : [];
    const pendingMyClaims = myClaims.filter((c) => c.status === 'Pending');
    const activeLoans = myLoans.filter((l) => l.status !== 'Returned');

    return [
      `**Your Portal Status:**`,
      `• **Claims:** ${myClaims.length} total (${pendingMyClaims.length} Pending). Check **Claims** for full details.`,
      `• **Equipment Loans:** ${activeLoans.length} active loan(s). Visit **Equipment** to view return dates.`,
    ].join('\n');
  }

  const clubName = String(context.club_name || 'ClubSync');
  return [
    `Hi! I'm the **${clubName} Portal Assistant**. Here's what I can help you with right now:`,
    '• **Activities & Fees:** Upcoming event dates, venues, RSVP, QR attendance & online access links.',
    '• **Claims & Pre-Claims:** Step-by-step reimbursement instructions and your own claim status.',
    '• **Equipment & Profile:** Equipment borrowing loans, DuitNow QR setup, and account settings.',
    isPrivileged
      ? '• **Treasurer Tools:** Budget health, overspend risks, and pending claim summaries.'
      : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AssistantRequest;
    const message = String(body.message || '').trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const mode: AssistantMode =
      body.mode === 'budget' || body.mode === 'audit' ? body.mode : 'portal';
    const role: UserRole =
      body.role === 'treasurer' || body.role === 'owner' ? body.role : 'member';
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const safeContext = buildRoleSafeContext(body.context, role, mode);

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        {
          reply: runLocalFallback(message, mode, role, safeContext),
          source: 'local',
        },
        { status: 200 }
      );
    }

    const systemInstruction = [
      `You are ClubSync AI, a concise, helpful, role-aware assistant for a Malaysian student club portal. Caller role: ${role}. Current mode: ${mode}.`,
      'Rules:',
      '1. Answer strictly using the provided sanitized CONTEXT JSON and portal rules. NEVER invent numbers, dates, balances, or claims.',
      '2. Format all monetary amounts in Malaysian Ringgit (`RM X.XX`).',
      '3. NEVER output or ask for sensitive PII (IC numbers, bank accounts, QR links, phone numbers, passwords).',
      role === 'member'
        ? '4. Caller is a regular Member: politely refuse if they ask for confidential club savings, bank balances, or other members’ claims/private info.'
        : '4. Caller has Treasurer/Admin/Owner privileges: provide sharp, actionable finance, budget variance, and audit insights from the context.',
      '5. Keep answers structured, concise (bullet points where helpful), and suggest concrete portal navigation paths (e.g., "Go to Claims → Submit Claim").',
      '',
      `SANITIZED CONTEXT:\n${JSON.stringify(safeContext)}`,
    ].join('\n');

    const contents = [
      ...history.map((turn) => ({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(turn.content || '').slice(0, 1500) }],
      })),
      {
        role: 'user',
        parts: [{ text: message.slice(0, 2000) }],
      },
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }],
            },
            contents,
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 700,
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        return NextResponse.json(
          {
            reply: runLocalFallback(message, mode, role, safeContext),
            source: 'local',
          },
          { status: 200 }
        );
      }

      const payload = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        return NextResponse.json(
          {
            reply: runLocalFallback(message, mode, role, safeContext),
            source: 'local',
          },
          { status: 200 }
        );
      }

      return NextResponse.json({ reply: text, source: 'gemini' }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return NextResponse.json(
      {
        reply:
          'Unable to reach the assistant right now. Try again shortly or navigate using the club menu.',
        source: 'local',
      },
      { status: 200 }
    );
  }
}
