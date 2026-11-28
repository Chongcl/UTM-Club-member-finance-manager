import { NextRequest, NextResponse } from 'next/server';
import type { ChatbotActionTab, ChatbotPermissions, HelpdeskRoleMode } from '@/lib/chatbotEngine';

const DEFAULT_MODEL_CHAIN = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

const BASE_ALLOWED_ACTIONS: ChatbotActionTab[] = [
  'none',
  'new_claim',
  'activities',
  'equipment',
  'claims',
  'profile',
  'qr_scanner',
];

const PII_KEYS = new Set([
  'ic_no',
  'ic',
  'passport',
  'bank_account_no',
  'bank_account_holder',
  'bank_qr_url',
  'phone_number',
  'phone',
  'password',
  'admin_pin',
  'owner_pin',
]);

interface HelpdeskTurn {
  role: 'user' | 'bot';
  content: string;
}

interface HelpdeskRequestBody {
  message?: string;
  history?: HelpdeskTurn[];
  roleMode?: string;
  permissions?: Partial<ChatbotPermissions>;
  sanitizedContext?: Record<string, unknown>;
  allowedActions?: string[];
}

function normalizeRoleMode(rawRole: unknown): HelpdeskRoleMode {
  if (rawRole === 'owner' || rawRole === 'admin' || rawRole === 'member') {
    return rawRole;
  }
  return 'member';
}

function computeServerAllowedActions(
  role: HelpdeskRoleMode,
  perms: Partial<ChatbotPermissions> | undefined
): Set<ChatbotActionTab> {
  const allowed = new Set<ChatbotActionTab>(BASE_ALLOWED_ACTIONS);

  if (role === 'owner' || (role === 'admin' && Boolean(perms?.can_manage_finance))) {
    allowed.add('ledger');
  }
  if (role === 'owner' || (role === 'admin' && Boolean(perms?.can_manage_members))) {
    allowed.add('members');
  }
  if (role === 'owner' || role === 'admin') {
    allowed.add('logs');
  }
  if (role === 'owner' || (role === 'admin' && Boolean(perms?.can_manage_public_page))) {
    allowed.add('public_page_editor');
  }
  if (role === 'owner' || (role === 'admin' && Boolean(perms?.canCustomizeTheme))) {
    allowed.add('theme_studio');
  }

  return allowed;
}

function stripPiiDeep(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((item) => stripPiiDeep(item, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (PII_KEYS.has(k.toLowerCase())) continue;
      out[k] = stripPiiDeep(v, depth + 1);
    }
    return out;
  }
  return value;
}

function resanitizeContext(
  rawContext: unknown,
  role: HelpdeskRoleMode,
  perms: Partial<ChatbotPermissions> | undefined
): Record<string, unknown> {
  const cloned =
    rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)
      ? (stripPiiDeep(rawContext) as Record<string, unknown>)
      : {};

  const allowFinance = role === 'owner' || (role === 'admin' && Boolean(perms?.can_manage_finance));
  const allowClaimsQueue = role === 'owner' || (role === 'admin' && Boolean(perms?.can_manage_claims_fees));

  if (!allowFinance) {
    delete cloned.financeSummary;
    delete cloned.adminVars;
    if (Array.isArray(cloned.events)) {
      cloned.events = cloned.events.map((ev) => {
        if (!ev || typeof ev !== 'object') return ev;
        const copy = { ...(ev as Record<string, unknown>) };
        delete copy.allocated;
        delete copy.spent;
        delete copy.pending;
        delete copy.remaining;
        delete copy.pctUsed;
        return copy;
      });
    }
  }

  if (!allowClaimsQueue) {
    delete cloned.pendingClaimsQueue;
    if (cloned.financeSummary && typeof cloned.financeSummary === 'object') {
      const finCopy = { ...(cloned.financeSummary as Record<string, unknown>) };
      delete finCopy.pendingClaims;
      cloned.financeSummary = finCopy;
    }
  }

  if (role === 'member' && Array.isArray(cloned.rules)) {
    cloned.rules = cloned.rules.filter(
      (r) => r && typeof r === 'object' && (r as Record<string, unknown>).audience !== 'admin'
    );
  }

  return cloned;
}

function buildSystemInstruction(
  role: HelpdeskRoleMode,
  allowedActions: ChatbotActionTab[],
  safeContext: Record<string, unknown>
): string {
  return [
    'You are the ClubSync AI Helpdesk Guide—friendly, accurate, and concise.',
    'Reply naturally in the user’s language (English, Bahasa Melayu, or Manglish).',
    'STRICT GROUNDING RULE:',
    '- Answer ONLY using facts present in the VERIFIED_PORTAL_CONTEXT JSON below. NEVER invent RM amounts, dates, member names, rules, or policies.',
    '- If asked about data not present in VERIFIED_PORTAL_CONTEXT (such as club bank/cash balances, event budgets, or other members’ claims/private details), politely explain that they do not have permission to view that restricted information in their current role.',
    'READ-ONLY GUIDE & SAFE NAVIGATION:',
    '- You are strictly a read-only guide. You CANNOT edit settings, approve claims, delete rows, or change database records.',
    '- When guiding the user to perform a task or inspect a page, give crisp numbered steps and attach a relevant actionTab ONLY from ALLOWED_ACTIONS.',
    `- Current effective roleMode: "${role}".`,
    `- ALLOWED_ACTIONS: ${JSON.stringify(allowedActions)}`,
    'RESPONSE FORMAT (STRICT JSON ONLY):',
    '{"reply":"string","actionTab":"one of ALLOWED_ACTIONS or none","actionLabel":"optional short button text e.g. Open New Claim","followUpChips":["2-3 short relevant follow-up questions"]}',
    '',
    `VERIFIED_PORTAL_CONTEXT=${JSON.stringify(safeContext)}`,
  ].join('\n');
}

function parseGeminiJsonPayload(rawText: string): {
  reply?: string;
  actionTab?: string;
  actionLabel?: string;
  followUpChips?: unknown;
} | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  const tryParse = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) return direct;

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    const fenced = tryParse(fenceMatch[1].trim());
    if (fenced) return fenced;
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ fallback: true }, { status: 200 });
  }

  let body: HelpdeskRequestBody;
  try {
    body = (await req.json()) as HelpdeskRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return NextResponse.json({ ok: false, error: 'empty_message' }, { status: 400 });
  }

  const role = normalizeRoleMode(body.roleMode);
  const serverAllowedSet = computeServerAllowedActions(role, body.permissions);

  const clientAllowed = Array.isArray(body.allowedActions)
    ? body.allowedActions.filter((a): a is ChatbotActionTab =>
        typeof a === 'string' && serverAllowedSet.has(a as ChatbotActionTab)
      )
    : Array.from(serverAllowedSet);

  const effectiveAllowedSet = new Set<ChatbotActionTab>(clientAllowed);
  effectiveAllowedSet.add('none');
  const finalAllowedActions = Array.from(effectiveAllowedSet);

  const safeContext = resanitizeContext(body.sanitizedContext, role, body.permissions);

  const rawHistory = Array.isArray(body.history) ? body.history.slice(-8) : [];
  const contents = rawHistory
    .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim().length > 0)
    .map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.content.trim().slice(0, 1500) }],
    }));
  contents.push({
    role: 'user',
    parts: [{ text: message.slice(0, 1500) }],
  });

  const envModel = process.env.GEMINI_MODEL?.trim();
  const modelChain = Array.from(
    new Set([envModel, ...DEFAULT_MODEL_CHAIN].filter((m): m is string => Boolean(m)))
  );

  const systemInstructionText = buildSystemInstruction(role, finalAllowedActions, safeContext);

  for (const model of modelChain) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstructionText }],
            },
            contents,
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.3,
            },
          }),
        }
      );

      if (response.status === 404 || response.status === 429) {
        continue;
      }
      if (!response.ok) {
        continue;
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }>;
      };

      const candidateText =
        payload?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('')
          .trim() || '';

      const parsed = parseGeminiJsonPayload(candidateText);
      const reply = typeof parsed?.reply === 'string' ? parsed.reply.trim() : '';
      if (!reply) {
        continue;
      }

      const requestedAction = parsed?.actionTab as ChatbotActionTab | undefined;
      const actionTab: ChatbotActionTab =
        requestedAction && effectiveAllowedSet.has(requestedAction) ? requestedAction : 'none';

      const actionLabel =
        actionTab !== 'none' && typeof parsed?.actionLabel === 'string' && parsed.actionLabel.trim()
          ? parsed.actionLabel.trim().slice(0, 48)
          : undefined;

      const followUpChips = Array.isArray(parsed?.followUpChips)
        ? parsed.followUpChips
            .filter((chip): chip is string => typeof chip === 'string' && chip.trim().length > 0)
            .map((chip) => chip.trim().slice(0, 48))
            .slice(0, 3)
        : [];

      return NextResponse.json({
        ok: true,
        reply,
        actionTab,
        actionLabel,
        followUpChips,
        model,
      });
    } catch {
      continue;
    }
  }

  return NextResponse.json({ fallback: true }, { status: 200 });
}
