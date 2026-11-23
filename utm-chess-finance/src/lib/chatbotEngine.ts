import type {
  ActivityFeePayment,
  Announcement,
  Budget,
  Claim,
  EquipmentItem,
  EquipmentLoan,
  EventRsvp,
  PreClaim,
  PublicGuestRegistration,
  UserProfile,
} from './supabase';
import type { PublicFaqItem } from './publicLanding';

export interface LedgerSnapshotRow {
  entry_type: 'IN' | 'OUT';
  amount: number;
  account_type?: 'Bank' | 'Cash' | string | null;
  deleted_at?: string | null;
}

export type ChatbotActionTab =
  | 'none'
  | 'new_claim'
  | 'activities'
  | 'equipment'
  | 'ledger'
  | 'profile'
  | 'claims';

export interface ChatbotRule {
  id: string;
  question: string;
  keywords: string[];
  answer: string;
  audience: 'all' | 'admin';
  action_tab: ChatbotActionTab;
  is_quick_chip: boolean;
  is_active: boolean;
  created_by?: string | null;
  updated_at?: string;
  created_at?: string;
}

export interface UnansweredQueryItem {
  id: string;
  query_text: string;
  user_role: string;
  hit_count: number;
  resolved: boolean;
  last_asked_at: string;
  created_at?: string;
}

export interface ChatbotPermissions {
  isAdmin: boolean;
  isOwner: boolean;
  canViewFinance: boolean;
}

export interface ChatbotEventBudgetSummary {
  id: string;
  event_name: string;
  status: 'Active' | 'Closed';
  event_date: string;
  event_time: string;
  location: string;
  registration_fee: number;
  allocated: number;
  spent: number;
  pending: number;
  remaining: number;
  pctUsed: number;
}

export interface ChatbotSnapshot {
  clubName: string;
  currentBatch: string;
  userId: string;
  userName: string;
  userRoleLabel: string;
  contactEmail: string;
  approvalThreshold: number;
  publicVars: Record<string, string>;
  adminVars: Record<string, string>;
  events: ChatbotEventBudgetSummary[];
  announcements: { title: string; message: string; is_pinned?: boolean; created_at: string }[];
  availableEquipment: { item_name: string; available_quantity: number; total_quantity: number; location: string }[];
  myPendingClaims: Claim[];
  myAllClaims: Claim[];
  myPreClaims: PreClaim[];
  myUpcomingRsvps: { event_name: string; event_date: string; location: string; qr_checked_in: boolean; pass_approved: boolean }[];
  myActiveLoans: EquipmentLoan[];
  financeSummary: {
    clubBalance: number;
    bankBalance: number;
    cashBalance: number;
    totalIncome: number;
    totalExpense: number;
    pendingClaimsCount: number;
    pendingClaimsTotal: number;
    pendingClaims: { title: string; claimant_name: string; amount: number; event_name: string; expense_date: string }[];
    overspentEvents: ChatbotEventBudgetSummary[];
    highBurnEvents: ChatbotEventBudgetSummary[];
  };
}

export interface ChatbotMatchResult {
  matched: boolean;
  reply: string;
  source: 'custom' | 'faq' | 'builtin' | 'restricted' | 'fallback';
  matchedLabel?: string;
  actionTab?: ChatbotActionTab;
  copyable?: boolean;
  followUpChips: string[];
}

export interface TemplateVarMeta {
  token: string;
  label: string;
  description: string;
  adminOnly: boolean;
}

export const PUBLIC_TEMPLATE_VARS: TemplateVarMeta[] = [
  { token: '{{club_name}}', label: 'Club Name', description: 'Active club name', adminOnly: false },
  { token: '{{current_batch}}', label: 'Batch Year', description: 'Current academic batch', adminOnly: false },
  { token: '{{user_name}}', label: 'User Name', description: 'Signed-in user full name', adminOnly: false },
  { token: '{{user_role}}', label: 'User Role', description: 'Member / Treasurer / Owner', adminOnly: false },
  { token: '{{active_events_count}}', label: 'Active Events #', description: 'Number of active activities', adminOnly: false },
  { token: '{{upcoming_events_list}}', label: 'Upcoming Events', description: 'Bulleted active events list', adminOnly: false },
  { token: '{{next_event}}', label: 'Next Event', description: 'Soonest active event summary', adminOnly: false },
  { token: '{{available_equipment_list}}', label: 'Equipment Stock', description: 'Equipment currently in stock', adminOnly: false },
  { token: '{{latest_announcement}}', label: 'Announcement', description: 'Latest or pinned club notice', adminOnly: false },
  { token: '{{my_pending_claims}}', label: 'My Pending Claims', description: 'User pending claims count & total', adminOnly: false },
  { token: '{{my_total_claimed}}', label: 'My Total Claimed', description: 'User total submitted claims RM', adminOnly: false },
  { token: '{{my_upcoming_rsvps}}', label: 'My RSVPs', description: 'User attending events list', adminOnly: false },
  { token: '{{my_active_loans}}', label: 'My Loans', description: 'User unreturned equipment loans', adminOnly: false },
];

export const ADMIN_TEMPLATE_VARS: TemplateVarMeta[] = [
  { token: '{{club_balance}}', label: 'Club Balance', description: 'Live net Bank + Cash savings', adminOnly: true },
  { token: '{{bank_balance}}', label: 'Bank Balance', description: 'Current Bank account balance', adminOnly: true },
  { token: '{{cash_balance}}', label: 'Cash Balance', description: 'Current Cash on hand balance', adminOnly: true },
  { token: '{{total_income}}', label: 'Total Income', description: 'Total verified IN + ledger IN', adminOnly: true },
  { token: '{{total_expense}}', label: 'Total Expense', description: 'Total approved claims + ledger OUT', adminOnly: true },
  { token: '{{pending_claims_count}}', label: 'Pending Claims #', description: 'Number of unreviewed claims', adminOnly: true },
  { token: '{{pending_claims_total}}', label: 'Pending Claims RM', description: 'RM value awaiting review', adminOnly: true },
  { token: '{{overspent_events}}', label: 'Overspent Events', description: 'Events >= 80% / >= 100% budget', adminOnly: true },
  { token: '{{event_budgets_summary}}', label: 'Event Budgets', description: 'Budget usage per event', adminOnly: true },
  { token: '{{approval_threshold}}', label: 'Approval Threshold', description: '2-stage claim approval threshold RM', adminOnly: true },
];

export const ALL_TEMPLATE_VARS: TemplateVarMeta[] = [...PUBLIC_TEMPLATE_VARS, ...ADMIN_TEMPLATE_VARS];

const ADMIN_VAR_KEYS = new Set(
  ADMIN_TEMPLATE_VARS.map((v) => v.token.replace(/\{\{|\}\}/g, '').trim())
);

export const STARTER_KNOWLEDGE_PACK: Omit<ChatbotRule, 'id'>[] = [
  {
    question: 'Club Balance Summary',
    keywords: ['balance summary', 'treasury snapshot', 'club savings summary'],
    answer:
      '**{{club_name}} Live Treasury Snapshot ({{current_batch}}):**\n• **Current Club Balance:** {{club_balance}}\n• **Bank Account:** {{bank_balance}}\n• **Cash on Hand:** {{cash_balance}}\n• **Total Income:** {{total_income}} | **Total Expense:** {{total_expense}}\n• **Pending Claims:** {{pending_claims_count}} ({{pending_claims_total}})',
    audience: 'admin',
    action_tab: 'ledger',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Claim Submission Deadline',
    keywords: ['deadline', 'claim deadline', 'late claim', 'tarikh tutup', 'last day claim'],
    answer:
      '**Claim Submission Policy ({{club_name}}):**\n• Submit receipt claims within **7 days** after your purchase or event end date.\n• Upload a clear photo or PDF receipt in **Submit Claim** and make sure your DuitNow/Bank details are saved.\n• You currently have **{{my_pending_claims}}** awaiting review.',
    audience: 'all',
    action_tab: 'new_claim',
    is_quick_chip: true,
    is_active: true,
  },
  {
    question: 'Approval Threshold Policy',
    keywords: ['threshold', '2 stage', 'two stage', 'approval policy', 'owner approval'],
    answer:
      '**Claim Approval Workflow ({{club_name}}):**\n• Standard claims are verified and approved by the Treasurer.\n• High-value claims exceeding **{{approval_threshold}}** follow **2-Stage Approval** (1. Treasurer verification → 2. President/Advisor sign-off).',
    audience: 'admin',
    action_tab: 'claims',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Equipment Return Rule',
    keywords: ['return rule', 'borrow rule', 'equipment policy', 'overdue', 'pulang'],
    answer:
      '**Equipment Borrowing & Return Policy:**\n• Return all borrowed club equipment cleanly on or before the stated due date.\n• **Your Current Loans:** {{my_active_loans}}\n• **Available Stock:**\n{{available_equipment_list}}',
    audience: 'all',
    action_tab: 'equipment',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Committee Contact Info',
    keywords: ['contact', 'committee', 'ajk', 'helpdesk', 'whatsapp committee', 'hubungi'],
    answer:
      '**Need Committee Help ({{club_name}} • {{current_batch}})?**\n• Use the **Public** lounge or **People** tab right here in Club Chat to message an Exco/Treasurer directly.\n• You can also check the latest club notice: {{latest_announcement}}',
    audience: 'all',
    action_tab: 'profile',
    is_quick_chip: false,
    is_active: true,
  },
];

const LOCAL_RULES_KEY = 'clubsync_chatbot_rules_v1';
const LOCAL_UNANSWERED_KEY = 'clubsync_chatbot_unanswered_v1';

export function loadLocalChatbotRules(): ChatbotRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_RULES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ChatbotRule[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalChatbotRules(rules: ChatbotRule[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_RULES_KEY, JSON.stringify(rules));
  } catch {
    /* ignore storage quota error */
  }
}

export function loadLocalUnanswered(): UnansweredQueryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_UNANSWERED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as UnansweredQueryItem[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalUnanswered(items: UnansweredQueryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_UNANSWERED_KEY, JSON.stringify(items));
  } catch {
    /* ignore storage quota error */
  }
}

export function formatRM(value: number): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'RM 0.00';
  const sign = num < 0 ? '-' : '';
  return `${sign}RM ${Math.abs(num).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface BuildChatbotSnapshotInput {
  clubName: string;
  currentBatch: string;
  profile: UserProfile | null;
  budgets: Budget[];
  claims: Claim[];
  preClaims: PreClaim[];
  rsvps: EventRsvp[];
  feePayments: ActivityFeePayment[];
  guestRegistrations: PublicGuestRegistration[];
  ledgerEntries: LedgerSnapshotRow[];
  equipmentItems: EquipmentItem[];
  equipmentLoans: EquipmentLoan[];
  announcements: Announcement[];
  openingBankBalance: number;
  openingCashBalance: number;
  claimThreshold: number;
  contactEmail?: string;
}

export function buildChatbotSnapshot(input: BuildChatbotSnapshotInput): ChatbotSnapshot {
  const activeBudgets = input.budgets.filter((b) => !b.deleted_at);
  const activeClaims = input.claims.filter((c) => !c.deleted_at);
  const activePreClaims = input.preClaims.filter((p) => !p.deleted_at);
  const activeRsvps = input.rsvps.filter((r) => !r.deleted_at);
  const activeFees = input.feePayments.filter((f) => !f.deleted_at);
  const activeGuests = input.guestRegistrations.filter((g) => !g.deleted_at);
  const activeLedger = input.ledgerEntries.filter((e) => !e.deleted_at);
  const activeEquipment = input.equipmentItems.filter((eq) => !eq.deleted_at);
  const activeLoans = input.equipmentLoans.filter((l) => !l.deleted_at);
  const activeAnnouncements = input.announcements.filter((a) => !a.deleted_at);

  // Exact same financial math as LedgerSection.tsx
  let bankIn = 0;
  let bankOut = 0;
  let cashIn = 0;
  let cashOut = 0;
  let totalIncome = 0;
  let totalExpense = 0;

  for (const e of activeLedger) {
    const amt = Number(e.amount) || 0;
    const isCash = e.account_type === 'Cash';
    if (e.entry_type === 'IN') {
      totalIncome += amt;
      if (isCash) cashIn += amt;
      else bankIn += amt;
    } else {
      totalExpense += amt;
      if (isCash) cashOut += amt;
      else bankOut += amt;
    }
  }

  for (const f of activeFees) {
    if (f.status !== 'Verified') continue;
    const amt = Number(f.amount_paid) || 0;
    totalIncome += amt;
    if (f.account_type === 'Cash') cashIn += amt;
    else bankIn += amt;
  }

  for (const g of activeGuests) {
    if (g.payment_status !== 'Verified') continue;
    const amt = Number(g.amount_paid) || 0;
    totalIncome += amt;
    if (g.account_type === 'Cash') cashIn += amt;
    else bankIn += amt;
  }

  for (const c of activeClaims) {
    if (c.status !== 'Approved') continue;
    const linkedPc =
      (c.pre_claim_id ? activePreClaims.find((pc) => pc.id === c.pre_claim_id) : undefined) ||
      activePreClaims.find((pc) => pc.linked_claim_id === c.id);
    const advGiven = linkedPc ? Number(linkedPc.advance_disbursed_amount || 0) : 0;
    const rawAmt = Number(c.amount) || 0;
    const netAmt = advGiven > 0 ? Math.max(0, rawAmt - advGiven) : rawAmt;
    if (netAmt <= 0) continue;
    totalExpense += netAmt;
    if (c.account_type === 'Cash') cashOut += netAmt;
    else bankOut += netAmt;
  }

  const bankBalance = Number(input.openingBankBalance || 0) + bankIn - bankOut;
  const cashBalance = Number(input.openingCashBalance || 0) + cashIn - cashOut;
  const clubBalance = bankBalance + cashBalance;

  const pendingClaimsRaw = activeClaims.filter((c) => c.status === 'Pending');
  const pendingClaimsTotal = pendingClaimsRaw.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const eventSummaries: ChatbotEventBudgetSummary[] = activeBudgets.map((b) => {
    const allocated = Number(b.allocated_amount || 0);
    const spent = Number(b.spent_amount || 0);
    const pending = pendingClaimsRaw
      .filter((c) => c.budget_id === b.id)
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    const remaining = allocated - spent;
    const pctUsed = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
    return {
      id: b.id,
      event_name: b.event_name,
      status: b.status,
      event_date: b.event_date || 'TBA',
      event_time: b.event_time || '',
      location: b.location || 'TBA',
      registration_fee: Number(b.registration_fee || 0),
      allocated,
      spent,
      pending,
      remaining,
      pctUsed,
    };
  });

  const activeEvents = eventSummaries.filter((e) => e.status === 'Active');
  const overspentEvents = eventSummaries.filter((e) => e.allocated > 0 && e.spent >= e.allocated);
  const highBurnEvents = eventSummaries.filter(
    (e) => e.allocated > 0 && e.pctUsed >= 80 && e.spent < e.allocated
  );

  const uid = input.profile?.id || '';
  const myAllClaims = activeClaims.filter((c) => c.user_id === uid);
  const myPendingClaims = myAllClaims.filter((c) => c.status === 'Pending');
  const myPreClaims = activePreClaims.filter((p) => p.user_id === uid);
  const myUpcomingRsvps = activeRsvps
    .filter((r) => r.user_id === uid && r.attendance === 'Attending')
    .map((r) => {
      const ev = activeBudgets.find((b) => b.id === r.budget_id);
      return {
        event_name: ev?.event_name || 'Activity',
        event_date: ev?.event_date || 'TBA',
        location: ev?.location || 'TBA',
        qr_checked_in: Boolean(r.qr_checked_in),
        pass_approved: Boolean(r.pass_approved),
      };
    });

  const myActiveLoans = activeLoans.filter((l) => l.user_id === uid && l.status !== 'Returned');

  const availableEquipment = activeEquipment
    .filter((eq) => Number(eq.available_quantity || 0) > 0)
    .map((eq) => ({
      item_name: eq.item_name,
      available_quantity: Number(eq.available_quantity || 0),
      total_quantity: Number(eq.total_quantity || 0),
      location: eq.location || 'Club Store',
    }));

  const sortedAnnouncements = [...activeAnnouncements].sort((a, b) => {
    if (Boolean(a.is_pinned) !== Boolean(b.is_pinned)) return a.is_pinned ? -1 : 1;
    return (b.created_at || '').localeCompare(a.created_at || '');
  });

  const upcomingEventsText =
    activeEvents.length > 0
      ? activeEvents
          .slice(0, 6)
          .map(
            (e) =>
              `• **${e.event_name}** — ${e.event_date}${e.event_time ? ` · ${e.event_time}` : ''} @ ${e.location} (${
                e.registration_fee > 0 ? formatRM(e.registration_fee) : 'Free'
              })`
          )
          .join('\n')
      : 'No active upcoming events listed right now.';

  const nextEv = activeEvents[0];
  const nextEventText = nextEv
    ? `**${nextEv.event_name}** on ${nextEv.event_date}${nextEv.event_time ? ` (${nextEv.event_time})` : ''} @ ${nextEv.location} — ${
        nextEv.registration_fee > 0 ? formatRM(nextEv.registration_fee) : 'Free'
      }`
    : 'No upcoming event scheduled';

  const equipText =
    availableEquipment.length > 0
      ? availableEquipment
          .slice(0, 8)
          .map((eq) => `• **${eq.item_name}**: ${eq.available_quantity}/${eq.total_quantity} available (${eq.location})`)
          .join('\n')
      : 'No equipment currently marked available.';

  const topAnnouncement = sortedAnnouncements[0];
  const topAnnouncementBody = topAnnouncement
    ? topAnnouncement.content || topAnnouncement.subtitle || 'Check Home & Activities for details.'
    : '';
  const latestAnnouncementText = topAnnouncement
    ? `**${topAnnouncement.title}** — ${topAnnouncementBody}`
    : 'No announcements posted yet.';

  const myPendingTotal = myPendingClaims.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const myTotalClaimed = myAllClaims.reduce((s, c) => s + (Number(c.amount) || 0), 0);

  const myRsvpsText =
    myUpcomingRsvps.length > 0
      ? myUpcomingRsvps
          .slice(0, 6)
          .map((r) => `• **${r.event_name}** (${r.event_date}) — ${r.qr_checked_in ? 'Checked In ✓' : 'Attending'}`)
          .join('\n')
      : 'You have not RSVP’d to any events yet.';

  const myLoansText =
    myActiveLoans.length > 0
      ? myActiveLoans
          .slice(0, 6)
          .map((l) => `• **${l.item_name}** ×${l.quantity} (Due: ${l.return_date || 'TBA'} · ${l.status})`)
          .join('\n')
      : '0 active equipment loans.';

  const overspentListText =
    overspentEvents.length > 0 || highBurnEvents.length > 0
      ? [
          ...overspentEvents.map(
            (e) =>
              `• **${e.event_name}** — OVER BUDGET (${e.pctUsed}% used: ${formatRM(e.spent)} / ${formatRM(e.allocated)})`
          ),
          ...highBurnEvents.map(
            (e) =>
              `• **${e.event_name}** — HIGH BURN (${e.pctUsed}% used: ${formatRM(e.spent)} / ${formatRM(e.allocated)})`
          ),
        ].join('\n')
      : 'All budgeted activities are currently healthy (under 80% utilization).';

  const eventBudgetsSummaryText =
    eventSummaries.length > 0
      ? eventSummaries
          .slice(0, 8)
          .map(
            (e) =>
              `• **${e.event_name}**: Allocated ${formatRM(e.allocated)} | Spent ${formatRM(e.spent)} | Remaining ${formatRM(
                e.remaining
              )} (${e.pctUsed}%)`
          )
          .join('\n')
      : 'No activity budgets recorded yet.';

  const roleLabel =
    input.profile?.role === 'owner'
      ? 'Owner / President'
      : input.profile?.role === 'treasurer'
      ? 'Treasurer / Admin'
      : 'Member';

  return {
    clubName: input.clubName || 'ClubSync',
    currentBatch: input.currentBatch || '2026/2027',
    userId: uid,
    userName: input.profile?.full_name || 'Member',
    userRoleLabel: roleLabel,
    contactEmail: input.contactEmail || '',
    approvalThreshold: Number(input.claimThreshold || 200),
    publicVars: {
      club_name: input.clubName || 'ClubSync',
      current_batch: input.currentBatch || '2026/2027',
      user_name: input.profile?.full_name || 'Member',
      user_role: roleLabel,
      active_events_count: String(activeEvents.length),
      upcoming_events_list: upcomingEventsText,
      next_event: nextEventText,
      available_equipment_list: equipText,
      latest_announcement: latestAnnouncementText,
      my_pending_claims: `${myPendingClaims.length} pending (${formatRM(myPendingTotal)})`,
      my_total_claimed: formatRM(myTotalClaimed),
      my_upcoming_rsvps: myRsvpsText,
      my_active_loans: myLoansText,
    },
    adminVars: {
      club_balance: formatRM(clubBalance),
      bank_balance: formatRM(bankBalance),
      cash_balance: formatRM(cashBalance),
      total_income: formatRM(totalIncome),
      total_expense: formatRM(totalExpense),
      pending_claims_count: String(pendingClaimsRaw.length),
      pending_claims_total: formatRM(pendingClaimsTotal),
      overspent_events: overspentListText,
      event_budgets_summary: eventBudgetsSummaryText,
      approval_threshold: formatRM(Number(input.claimThreshold || 200)),
    },
    events: eventSummaries,
    announcements: sortedAnnouncements.slice(0, 6).map((a) => ({
      title: a.title,
      message: a.content || a.subtitle || '',
      is_pinned: a.is_pinned,
      created_at: a.created_at,
    })),
    availableEquipment,
    myPendingClaims,
    myAllClaims,
    myPreClaims,
    myUpcomingRsvps,
    myActiveLoans,
    financeSummary: {
      clubBalance,
      bankBalance,
      cashBalance,
      totalIncome,
      totalExpense,
      pendingClaimsCount: pendingClaimsRaw.length,
      pendingClaimsTotal,
      pendingClaims: pendingClaimsRaw.slice(0, 15).map((c) => ({
        title: c.title,
        claimant_name: c.claimant_name,
        amount: Number(c.amount || 0),
        event_name:
          activeBudgets.find((b) => b.id === c.budget_id)?.event_name ||
          c.custom_event_name ||
          'General Club Fund',
        expense_date: c.expense_date,
      })),
      overspentEvents,
      highBurnEvents,
    },
  };
}

export function resolveTemplateVariables(
  templateText: string,
  snapshot: ChatbotSnapshot,
  permissions: ChatbotPermissions
): string {
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey: string) => {
    const key = rawKey.trim();
    if (ADMIN_VAR_KEYS.has(key)) {
      if (!permissions.canViewFinance) {
        return '[Restricted — Treasurer/Admin access only]';
      }
      return snapshot.adminVars[key] ?? '';
    }
    if (key in snapshot.publicVars) {
      return snapshot.publicVars[key];
    }
    return `{{${key}}}`;
  });
}

// =====================================================================
// Text Normalization, Stop Words, Synonyms & Levenshtein Fuzzy Matching
// =====================================================================

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'am', 'be', 'been',
  'what', 'whats', 'where', 'when', 'who', 'which', 'how', 'can', 'could',
  'do', 'does', 'did', 'to', 'for', 'of', 'on', 'in', 'at', 'by', 'with',
  'our', 'we', 'us', 'please', 'pls', 'tell', 'me', 'show', 'check', 'get',
  'currently', 'now', 'today', 'right', 'any', 'have', 'has', 'need', 'want',
  'apa', 'apakah', 'macam', 'mana', 'berapa', 'tolong', 'tengok', 'cek',
  'kami', 'kita', 'punya', 'untuk', 'yang', 'dan', 'di', 'ke', 'ada', 'boleh',
]);

const SYNONYM_MAP: Record<string, string> = {
  duit: 'balance',
  baki: 'balance',
  wang: 'balance',
  tabung: 'balance',
  dana: 'balance',
  saving: 'balance',
  savings: 'balance',
  balances: 'balance',
  money: 'balance',
  fund: 'balance',
  funds: 'balance',
  treasury: 'balance',
  kewangan: 'balance',
  akaun: 'balance',
  resit: 'receipt',
  receipts: 'receipt',
  tuntutan: 'claim',
  claims: 'claim',
  claimed: 'claim',
  reimburse: 'claim',
  reimbursement: 'claim',
  pra: 'preclaim',
  preclaims: 'preclaim',
  advance: 'preclaim',
  pendahuluan: 'preclaim',
  pinjam: 'equipment',
  pinjaman: 'equipment',
  barang: 'equipment',
  alatan: 'equipment',
  equipments: 'equipment',
  gear: 'equipment',
  stok: 'equipment',
  stock: 'equipment',
  loan: 'loan',
  loans: 'loan',
  borrow: 'equipment',
  aktiviti: 'event',
  activity: 'event',
  activities: 'event',
  program: 'event',
  programs: 'event',
  pertandingan: 'event',
  kejohanan: 'event',
  tournament: 'event',
  events: 'event',
  kereta: 'carpool',
  tumpang: 'carpool',
  pengangkutan: 'carpool',
  transport: 'carpool',
  ride: 'carpool',
  yuran: 'fee',
  bayar: 'fee',
  bayaran: 'fee',
  fees: 'fee',
  payment: 'fee',
  payments: 'fee',
  pay: 'fee',
  bajet: 'budget',
  budgets: 'budget',
  peruntukan: 'budget',
  lebih: 'overspent',
  overspend: 'overspent',
  overspending: 'overspent',
  overbudget: 'overspent',
  exceed: 'overspent',
  exceeded: 'overspent',
  burn: 'overspent',
  risiko: 'overspent',
  bocor: 'overspent',
  pengumuman: 'announcement',
  announcements: 'announcement',
  notis: 'announcement',
  notice: 'announcement',
  hadir: 'rsvp',
  kehadiran: 'rsvp',
  rsvps: 'rsvp',
  tiket: 'rsvp',
  ticket: 'rsvp',
  pass: 'rsvp',
  bulanan: 'monthly',
  laporan: 'summary',
  report: 'summary',
  ringkasan: 'summary',
  pendapatan: 'income',
  inflow: 'income',
  masuk: 'income',
  perbelanjaan: 'expense',
  outflow: 'expense',
  keluar: 'expense',
  expenses: 'expense',
  spend: 'expense',
  spent: 'expense',
  tunggu: 'pending',
  semak: 'pending',
  review: 'pending',
  lulus: 'pending',
  approve: 'pending',
  split: 'split',
  bahagi: 'split',
  itemized: 'split',
  itemize: 'split',
  pecah: 'split',
  hubungi: 'contact',
  ajk: 'contact',
  committee: 'contact',
  saya: 'my',
  aku: 'my',
  mine: 'my',
};

function normalizeRawText(text: string): string {
  return text
    .toLowerCase()
    .replace(/pre[-\s]?claim/g, 'preclaim')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeNormalized(text: string): { rawTokens: string[]; mappedTokens: string[]; canonicalText: string } {
  const clean = normalizeRawText(text);
  const words = clean.split(' ').filter(Boolean);
  const rawTokens = words.filter((w) => !STOP_WORDS.has(w));
  const mappedTokens = rawTokens.map((w) => SYNONYM_MAP[w] || w);
  return {
    rawTokens,
    mappedTokens,
    canonicalText: mappedTokens.join(' '),
  };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j - 1], dp[j]);
      }
      prev = temp;
    }
  }
  return dp[b.length];
}

function tokenFuzzyMatch(token: string, candidate: string): boolean {
  if (token === candidate) return true;
  if (token.length >= 4 && candidate.startsWith(token)) return true;
  if (candidate.length >= 4 && token.startsWith(candidate)) return true;
  if (token.length >= 4 && candidate.length >= 4) {
    const dist = levenshtein(token, candidate);
    const maxDist = Math.max(token.length, candidate.length) >= 7 ? 2 : 1;
    if (dist <= maxDist) return true;
  }
  return false;
}

function scorePhraseMatch(
  queryRaw: string,
  queryMappedTokens: string[],
  phrase: string
): number {
  const cleanPhrase = normalizeRawText(phrase);
  if (!cleanPhrase) return 0;
  if (queryRaw === cleanPhrase) return 100;
  if (cleanPhrase.length >= 4 && queryRaw.includes(cleanPhrase)) return 65;

  const { mappedTokens: phraseTokens } = tokenizeNormalized(phrase);
  if (phraseTokens.length === 0) return 0;

  let matchedCount = 0;
  for (const pt of phraseTokens) {
    const hit = queryMappedTokens.some((qt) => tokenFuzzyMatch(qt, pt));
    if (hit) matchedCount += 1;
  }
  if (matchedCount === 0) return 0;
  const coverage = matchedCount / phraseTokens.length;
  return coverage >= 0.5 ? Math.round(coverage * 50) + matchedCount * 4 : 0;
}

export function getMemberStarterChips(): string[] {
  return [
    'Upcoming events',
    'My claims & loans',
    'How to submit a claim',
    'Available equipment',
  ];
}

export function getAdminStarterChips(): string[] {
  return [
    'Current club balance',
    'Pending claims to review',
    'Check overspent budgets',
    'Monthly finance summary',
  ];
}

function buildFinanceRestrictedResult(snapshot: ChatbotSnapshot): ChatbotMatchResult {
  return {
    matched: true,
    source: 'restricted',
    matchedLabel: 'Role Privacy Guard',
    actionTab: 'claims',
    reply: [
      `🔒 **Restricted Financial Data**`,
      `Club-wide treasury balances, bank/cash totals, budget utilization, and other members' claims are only visible to authorized Treasurers and Club Owners (**${snapshot.clubName}**).`,
      ``,
      `As a Member, I can check your personal claim status, RSVPs, equipment loans, upcoming events, or guide you on how to submit a claim!`,
    ].join('\n'),
    followUpChips: ['My claims & loans', 'How to submit a claim', 'Upcoming events'],
  };
}

function isFinanceRestrictedQuery(rawNorm: string, mappedTokens: string[]): boolean {
  const hasMy = mappedTokens.includes('my');
  const asksOtherMember =
    /\b(other member|everyone|all members|all claims|semua claim|siapa claim)\b/i.test(rawNorm);
  if (asksOtherMember) return true;

  const asksClubMoney =
    mappedTokens.includes('balance') ||
    mappedTokens.includes('income') ||
    mappedTokens.includes('expense') ||
    mappedTokens.includes('overspent') ||
    mappedTokens.includes('budget') ||
    /\b(bank balance|cash balance|club balance|club saving|how much money|monthly summary|finance summary|treasury)\b/i.test(
      rawNorm
    );

  // Allow personal status like "my claims" even if user doesn't mention club balance
  if (asksClubMoney && !hasMy) return true;
  if (mappedTokens.includes('pending') && mappedTokens.includes('claim') && !hasMy && !rawNorm.includes('how')) {
    return /\b(to review|awaiting review|which claim|all pending|pending claims to)\b/i.test(rawNorm);
  }
  return false;
}

export interface MatchChatbotOptions {
  customRules: ChatbotRule[];
  faqItems?: PublicFaqItem[];
  snapshot: ChatbotSnapshot;
  permissions: ChatbotPermissions;
}

export function matchChatbotQuery(
  rawQuery: string,
  { customRules, faqItems = [], snapshot, permissions }: MatchChatbotOptions
): ChatbotMatchResult {
  const cleanOriginal = rawQuery.trim();
  const rawNorm = normalizeRawText(cleanOriginal);
  const { mappedTokens } = tokenizeNormalized(cleanOriginal);
  const starterFollowUps = permissions.canViewFinance ? getAdminStarterChips() : getMemberStarterChips();

  if (!rawNorm) {
    return {
      matched: false,
      source: 'fallback',
      reply: 'Please type a question or pick one of the quick topic buttons below.',
      followUpChips: starterFollowUps,
    };
  }

  // 0. Strict Role Privacy Guard FIRST
  if (!permissions.canViewFinance && isFinanceRestrictedQuery(rawNorm, mappedTokens)) {
    return buildFinanceRestrictedResult(snapshot);
  }

  // 1a. Check Admin-Trained Knowledge Base Rules
  let bestRule: { rule: ChatbotRule; score: number } | null = null;
  for (const rule of customRules) {
    if (!rule.is_active) continue;
    let maxScore = scorePhraseMatch(rawNorm, mappedTokens, rule.question);
    for (const kw of rule.keywords || []) {
      const s = scorePhraseMatch(rawNorm, mappedTokens, kw);
      if (s > maxScore) maxScore = s;
    }
    if (maxScore >= 36 && (!bestRule || maxScore > bestRule.score)) {
      bestRule = { rule, score: maxScore };
    }
  }

  if (bestRule) {
    if (bestRule.rule.audience === 'admin' && !permissions.canViewFinance && !permissions.isAdmin) {
      return buildFinanceRestrictedResult(snapshot);
    }
    const resolved = resolveTemplateVariables(bestRule.rule.answer, snapshot, permissions);
    const hasRM = /\bRM\s?[\d,]+\.\d{2}/.test(resolved);
    return {
      matched: true,
      source: 'custom',
      matchedLabel: bestRule.rule.question,
      actionTab: bestRule.rule.action_tab || 'none',
      copyable: hasRM,
      reply: resolved,
      followUpChips: permissions.canViewFinance
        ? ['Current club balance', 'Check overspent budgets', 'Upcoming events']
        : ['Upcoming events', 'My claims & loans', 'How to submit a claim'],
    };
  }

  // 1b. Check Public Landing FAQ Items
  let bestFaq: { faq: PublicFaqItem; score: number } | null = null;
  for (const faq of faqItems) {
    const score = scorePhraseMatch(rawNorm, mappedTokens, faq.question);
    if (score >= 40 && (!bestFaq || score > bestFaq.score)) {
      bestFaq = { faq, score };
    }
  }
  if (bestFaq) {
    return {
      matched: true,
      source: 'faq',
      matchedLabel: `FAQ: ${bestFaq.faq.question}`,
      actionTab: 'activities',
      reply: resolveTemplateVariables(bestFaq.faq.answer, snapshot, permissions),
      followUpChips: ['Upcoming events', 'How to submit a claim', 'Available equipment'],
    };
  }

  // ===================================================================
  // 2. Built-in Live Portal Intents
  // ===================================================================
  const has = (token: string) => mappedTokens.some((qt) => tokenFuzzyMatch(qt, token));

  // 2A. Specific Event Budget Detection (Treasurer/Admin only)
  if (
    permissions.canViewFinance &&
    (has('budget') || has('spent') || has('remaining') || has('balance') || has('cost'))
  ) {
    const matchedEv = snapshot.events.find((ev) => {
      const evNorm = normalizeRawText(ev.event_name);
      if (!evNorm) return false;
      if (rawNorm.includes(evNorm)) return true;
      const evWords = evNorm.split(' ').filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
      return evWords.length > 0 && evWords.filter((w) => rawNorm.includes(w)).length >= Math.min(2, evWords.length);
    });
    if (matchedEv) {
      const statusFlag =
        matchedEv.allocated <= 0
          ? 'No allocated cap set'
          : matchedEv.spent >= matchedEv.allocated
          ? '🔴 Over Budget'
          : matchedEv.pctUsed >= 80
          ? '🟡 High Utilization'
          : '🟢 Healthy';
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: `Event Budget: ${matchedEv.event_name}`,
        actionTab: 'ledger',
        copyable: true,
        reply: [
          `**Budget Status — ${matchedEv.event_name}** (${statusFlag})`,
          `• **Allocated:** ${formatRM(matchedEv.allocated)}`,
          `• **Spent:** ${formatRM(matchedEv.spent)} (${matchedEv.pctUsed}% used)`,
          `• **Remaining:** ${formatRM(matchedEv.remaining)}`,
          matchedEv.pending > 0 ? `• **Pending Claims:** ${formatRM(matchedEv.pending)}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        followUpChips: ['Check overspent budgets', 'Current club balance', 'Monthly finance summary'],
      };
    }
  }

  // 2B. Treasurer / Finance-Admin Intents
  if (permissions.canViewFinance) {
    const fin = snapshot.financeSummary;

    if ((has('monthly') || has('summary')) && (has('budget') || has('balance') || has('finance') || has('club') || has('monthly'))) {
      const burnRate = fin.totalIncome > 0 ? Math.round((fin.totalExpense / fin.totalIncome) * 100) : null;
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: 'Monthly Finance Summary',
        actionTab: 'ledger',
        copyable: true,
        reply: [
          `📊 **${snapshot.clubName} Finance Summary (${snapshot.currentBatch})**`,
          `• **Current Club Savings:** ${formatRM(fin.clubBalance)}`,
          `  ↳ Bank: ${formatRM(fin.bankBalance)} | Cash: ${formatRM(fin.cashBalance)}`,
          `• **Total Income:** +${formatRM(fin.totalIncome)}`,
          `• **Total Expense:** -${formatRM(fin.totalExpense)}${burnRate !== null ? ` (${burnRate}% outflow ratio)` : ''}`,
          `• **Pending Claims:** ${fin.pendingClaimsCount} claim(s) totaling ${formatRM(fin.pendingClaimsTotal)}`,
          `• **Budget Alerts:** ${fin.overspentEvents.length} over budget, ${fin.highBurnEvents.length} high-burn (≥80%)`,
        ].join('\n'),
        followUpChips: ['Check overspent budgets', 'Pending claims to review', 'Current club balance'],
      };
    }

    if (has('overspent') || (has('budget') && (has('risk') || has('high') || has('alert') || has('check')))) {
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: 'Overspend & Budget Health',
        actionTab: 'ledger',
        copyable: true,
        reply: `**Event Budget Watch (${snapshot.clubName}):**\n${snapshot.adminVars.overspent_events}\n\n**All Budgeted Activities:**\n${snapshot.adminVars.event_budgets_summary}`,
        followUpChips: ['Monthly finance summary', 'Current club balance', 'Pending claims to review'],
      };
    }

    if (has('pending') && has('claim') && !has('my')) {
      const list =
        fin.pendingClaims.length > 0
          ? fin.pendingClaims
              .slice(0, 8)
              .map((c) => `• **${c.title}** — ${formatRM(c.amount)} by ${c.claimant_name} (${c.event_name}, ${c.expense_date})`)
              .join('\n')
          : 'Great news — **0 claims** are currently pending review!';
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: 'Pending Claims Queue',
        actionTab: 'claims',
        copyable: fin.pendingClaimsCount > 0,
        reply: `**Claims Awaiting Review (${fin.pendingClaimsCount} • ${formatRM(fin.pendingClaimsTotal)}):**\n${list}`,
        followUpChips: ['Current club balance', 'Monthly finance summary', 'Check overspent budgets'],
      };
    }

    if ((has('income') || has('expense')) && !has('my')) {
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: 'Income vs Expense',
        actionTab: 'ledger',
        copyable: true,
        reply: [
          `**${snapshot.clubName} Cashflow Breakdown:**`,
          `• **Total Income (IN):** +${formatRM(fin.totalIncome)}`,
          `• **Total Expense (OUT):** -${formatRM(fin.totalExpense)}`,
          `• **Net Club Balance:** ${formatRM(fin.clubBalance)} (Bank ${formatRM(fin.bankBalance)} + Cash ${formatRM(fin.cashBalance)})`,
        ].join('\n'),
        followUpChips: ['Monthly finance summary', 'Check overspent budgets', 'Pending claims to review'],
      };
    }

    if (has('balance') || (has('budget') && !has('my'))) {
      return {
        matched: true,
        source: 'builtin',
        matchedLabel: 'Live Club Balance',
        actionTab: 'ledger',
        copyable: true,
        reply: [
          `💰 **Current Club Balance (${snapshot.clubName}):**`,
          `• **Total Balance:** ${formatRM(fin.clubBalance)}`,
          `• **Bank Account:** ${formatRM(fin.bankBalance)}`,
          `• **Cash on Hand:** ${formatRM(fin.cashBalance)}`,
          `• **Income vs Expense:** +${formatRM(fin.totalIncome)} IN / -${formatRM(fin.totalExpense)} OUT`,
          `• **Pending Claims:** ${fin.pendingClaimsCount} (${formatRM(fin.pendingClaimsTotal)})`,
        ].join('\n'),
        followUpChips: ['Pending claims to review', 'Check overspent budgets', 'Monthly finance summary'],
      };
    }
  }

  // 2C. Personal Status Intents (All Users)
  if ((has('my') && (has('claim') || has('preclaim') || has('loan') || has('rsvp') || has('status'))) ||
      rawNorm.includes('my claims & loans')) {
    const claimsList =
      snapshot.myAllClaims.length > 0
        ? snapshot.myAllClaims
            .slice(0, 5)
            .map((c) => `• **${c.title}** — ${formatRM(Number(c.amount || 0))} [${c.status}]`)
            .join('\n')
        : 'No claims submitted yet.';
    const preList =
      snapshot.myPreClaims.length > 0
        ? snapshot.myPreClaims
            .slice(0, 4)
            .map((pc) => `• **${pc.title}** — Est. ${formatRM(Number(pc.estimated_amount || 0))} [${pc.status}]`)
            .join('\n')
        : null;
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'My Claims, RSVPs & Loans',
      actionTab: has('loan') || has('equipment') ? 'equipment' : 'claims',
      reply: [
        `**Your Personal Status (${snapshot.userName}):**`,
        `• **Pending Claims:** ${snapshot.publicVars.my_pending_claims} | **Total Claimed:** ${snapshot.publicVars.my_total_claimed}`,
        claimsList,
        preList ? `\n**Your Pre-Claims:**\n${preList}` : null,
        `\n**Active Equipment Loans:**\n${snapshot.publicVars.my_active_loans}`,
        `\n**Your Attending RSVPs:**\n${snapshot.publicVars.my_upcoming_rsvps}`,
      ]
        .filter(Boolean)
        .join('\n'),
      followUpChips: ['How to submit a claim', 'Upcoming events', 'Available equipment'],
    };
  }

  if (has('rsvp')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'My Event RSVPs & QR Pass',
      actionTab: 'activities',
      reply: [
        `**Your Upcoming RSVPs & QR Passes:**`,
        snapshot.publicVars.my_upcoming_rsvps,
        ``,
        `Open any event card in **Home & Activities** → **QR Pass** tab to show your entry QR or scan attendance.`,
      ].join('\n'),
      followUpChips: ['Upcoming events', 'How to join carpool', 'My claims & loans'],
    };
  }

  if (has('loan') && !has('available')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'My Equipment Loans',
      actionTab: 'equipment',
      reply: `**Your Active Equipment Loans:**\n${snapshot.publicVars.my_active_loans}\n\nVisit **Equipment** to view return dates or request another item.`,
      followUpChips: ['Available equipment', 'How to book equipment', 'Upcoming events'],
    };
  }

  // 2D. Portal How-To Guides (All Users)
  if (has('split')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Split Costs / Multi-Receipt Claims',
      actionTab: 'new_claim',
      reply: [
        `**How to Split Itemized Costs or Combine Multiple Receipts:**`,
        `1. Click **Submit Claim** and upload or snap **1 or more receipt photos** (ReceiptDropzone auto-stitches multiple photos into 1 clean JPG!).`,
        `2. In **Step 2 (Details)**, use **+ Add Receipt / Item Line** to itemize each shop or split portion (e.g., Drinks RM 15.00 + Prizes RM 45.00).`,
        `3. ClubSync automatically sums all line items into your total RM claim amount.`,
      ].join('\n'),
      followUpChips: ['How to submit a claim', 'How to request a pre-claim', 'My claims & loans'],
    };
  }

  if (has('preclaim')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Submit a Pre-Claim / Cash Advance',
      actionTab: 'new_claim',
      reply: [
        `**How to Request a Pre-Claim (Before Buying):**`,
        `1. Click **Submit Claim** in the top navigation bar.`,
        `2. Click **"Buying soon? Pre-Claim →"** at the top of the modal.`,
        `3. Enter item details, estimated cost, needed date, and toggle **Cash Advance Needed** if you need funds upfront.`,
        `4. After buying, link the actual receipt directly to your approved Pre-Claim!`,
      ].join('\n'),
      followUpChips: ['How to submit a claim', 'How to split costs', 'My claims & loans'],
    };
  }

  if (has('claim') && (rawNorm.includes('how') || rawNorm.includes('submit') || rawNorm.includes('step') || has('receipt'))) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Submit a Claim',
      actionTab: 'new_claim',
      reply: [
        `**How to Submit a Reimbursement Claim:**`,
        `1. Open **Submit Claim** (or tap **Claims → Submit Claim**).`,
        `2. **Step 1 (Receipt):** Upload or capture your receipt photo(s) — Local OCR auto-fills merchant, date & total amount.`,
        `3. **Step 2 (Details):** Pick the related Event/Activity, confirm title & line items.`,
        `4. **Step 3 (Bank / QR):** Verify your bank account or DuitNow QR so the Treasurer can reimburse you fast.`,
      ].join('\n'),
      followUpChips: ['How to request a pre-claim', 'How to split costs', 'My claims & loans'],
    };
  }

  if (has('fee')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Pay Activity Fees',
      actionTab: 'activities',
      reply: [
        `**How to Pay an Activity or Membership Fee:**`,
        `1. Go to **Home & Activities** and click **Pay Fee / Details** on the activity card.`,
        `2. Scan the Club DuitNow QR / copy the bank account details shown.`,
        `3. Upload your payment receipt / transfer slip and submit — your status will update once verified!`,
      ].join('\n'),
      followUpChips: ['Upcoming events', 'My claims & loans', 'How to join carpool'],
    };
  }

  if (has('carpool')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Join or Offer Carpool',
      actionTab: 'activities',
      reply: [
        `**How to Arrange Transport / Carpool:**`,
        `1. Mark yourself **Attending** on an in-person event in **Home & Activities**.`,
        `2. Use the transport selector on the event card or open **Event Ops → Transport & Carpool** to choose **Need Carpool**, **Own Transport**, or volunteer as a **Driver**.`,
      ].join('\n'),
      followUpChips: ['Upcoming events', 'My claims & loans', 'Available equipment'],
    };
  }

  if (has('equipment') && (rawNorm.includes('how') || rawNorm.includes('book'))) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'How to Borrow Club Equipment',
      actionTab: 'equipment',
      reply: [
        `**How to Borrow Equipment:**`,
        `1. Open the **Equipment** tab from the top or bottom navigation bar.`,
        `2. Pick an item with available stock, click **Borrow**, choose quantity, purpose, and return date.`,
        `3. Return items on time — admins approve items marked *Requires Approval*.`,
      ].join('\n'),
      followUpChips: ['Available equipment', 'My claims & loans', 'Upcoming events'],
    };
  }

  // 2E. Live Portal Info Intents
  if (has('announcement')) {
    const annText =
      snapshot.announcements.length > 0
        ? snapshot.announcements
            .slice(0, 4)
            .map((a) => `• ${a.is_pinned ? '📌 ' : ''}**${a.title}** — ${a.message || 'Check hub for details.'}`)
            .join('\n')
        : 'No announcements posted right now.';
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Latest Announcements',
      actionTab: 'activities',
      reply: `**Latest Club Announcements (${snapshot.clubName}):**\n${annText}`,
      followUpChips: ['Upcoming events', 'Available equipment', 'My claims & loans'],
    };
  }

  if (has('equipment')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Available Equipment Stock',
      actionTab: 'equipment',
      reply: `**Available Equipment Stock (${snapshot.clubName}):**\n${snapshot.publicVars.available_equipment_list}\n\nOpen **Equipment** to borrow any available item.`,
      followUpChips: ['How to book equipment', 'My claims & loans', 'Upcoming events'],
    };
  }

  if (has('event')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Upcoming Club Events',
      actionTab: 'activities',
      reply: `**Active & Upcoming Activities (${snapshot.publicVars.active_events_count}):**\n${snapshot.publicVars.upcoming_events_list}\n\nClick any card in **Home & Activities** to RSVP, pay fees, or view your QR pass.`,
      followUpChips: ['How to pay event fees', 'How to join carpool', 'Latest announcements'],
    };
  }

  if (has('contact')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Committee Contact & Help',
      actionTab: 'profile',
      reply: [
        `**Committee & Portal Support (${snapshot.clubName}):**`,
        snapshot.contactEmail ? `• **Club Email:** ${snapshot.contactEmail}` : null,
        `• **Live Messaging:** Switch to the **Public** or **People** tab in Club Chat to message an Exco or Treasurer directly.`,
        `• **Profile Settings:** Visit **My Profile** to update your DuitNow QR, matric no, or password.`,
      ]
        .filter(Boolean)
        .join('\n'),
      followUpChips: starterFollowUps.slice(0, 3),
    };
  }

  // 3. No Clean Match — Suggest top 3 closest topics and mark unmatched for inbox logging
  const candidateTopics = permissions.canViewFinance
    ? [
        'Current club balance',
        'Pending claims to review',
        'Check overspent budgets',
        'Monthly finance summary',
        'Upcoming events',
        'Available equipment',
        'How to submit a claim',
        'My claims & loans',
      ]
    : [
        'Upcoming events',
        'My claims & loans',
        'How to submit a claim',
        'Available equipment',
        'How to request a pre-claim',
        'How to pay event fees',
        'How to join carpool',
      ];

  const rankedSuggestions = candidateTopics
    .map((label) => ({
      label,
      score: scorePhraseMatch(rawNorm, mappedTokens, label),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.label);

  return {
    matched: false,
    source: 'fallback',
    matchedLabel: 'No Exact Match',
    reply: [
      `I couldn't find an exact answer for **"${cleanOriginal}"**.`,
      ``,
      `Try clicking one of these closest topics, or ask in the **Public** lounge! _(Your question has been logged for club admins so they can train a custom answer.)_`,
    ].join('\n'),
    followUpChips: rankedSuggestions,
  };
}
