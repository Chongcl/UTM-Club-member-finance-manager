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
  event_name?: string;
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

export interface ChatbotLeadershipEntry {
  name: string;
  department: string;
  batch: string;
}

export interface ChatbotLeadershipSummary {
  presidents: ChatbotLeadershipEntry[];
  admins: ChatbotLeadershipEntry[];
  highCommittee: ChatbotLeadershipEntry[];
  totalMembers: number;
  departmentCounts: { name: string; count: number }[];
}

export interface ChatbotSnapshot {
  clubName: string;
  currentBatch: string;
  userId: string;
  userName: string;
  userRoleLabel: string;
  contactEmail: string;
  clubTagline: string;
  clubAbout: string;
  instagramUrl: string;
  departments: string[];
  leadership: ChatbotLeadershipSummary;
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
  { token: '{{club_president}}', label: 'Club President', description: 'Active Owner / President contact name', adminOnly: false },
  { token: '{{high_committee_list}}', label: 'High Committee', description: 'High Committee / EXCO members list', adminOnly: false },
  { token: '{{club_admins_list}}', label: 'Admins & Treasurers', description: 'Authorized Treasurers & Admins list', adminOnly: false },
  { token: '{{club_departments}}', label: 'Departments & Units', description: 'Club departments with member counts', adminOnly: false },
  { token: '{{total_members_count}}', label: 'Total Members #', description: 'Active members in current directory', adminOnly: false },
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
  {
    question: 'Guest Registration Policy',
    keywords: ['guest registration', 'non member join', 'public event guest', 'tetamu'],
    answer:
      '**Guest & Non-Member Event Registration ({{club_name}}):**\n• External visitors and non-members can register from the public landing page or shareable `/e/<event-slug>` link without a member login.\n• For paid events, guests upload their DuitNow/bank transfer proof on the registration form and receive a digital **Entry Pass QR** upon submission.',
    audience: 'all',
    action_tab: 'activities',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Event Fee Verification Guide',
    keywords: ['fee verification', 'verify fee', 'payment receipt status', 'semak yuran'],
    answer:
      '**Activity & Registration Fee Verification ({{club_name}}):**\n• After transferring via DuitNow QR or bank transfer and uploading your payment slip on the activity card, your fee stays **Pending** until verified by the Treasurer.\n• Verified member fees and verified guest fees are posted automatically into the Finance Ledger.',
    audience: 'all',
    action_tab: 'activities',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Excel Export & Audit Trail',
    keywords: ['excel report', 'csv import', 'audit trail', 'activity logs', 'export ledger'],
    answer:
      '**Finance Export & Audit Trail ({{club_name}}):**\n• In **Finance Ledger**, Treasurers and Owners can export financial summaries/records to Excel/CSV or import bulk entries.\n• Every approval, edit, role update, and soft-delete is recorded in **Activity Logs** inside the top-left Hamburger Drawer.',
    audience: 'admin',
    action_tab: 'ledger',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Theme & Public Page Studio',
    keywords: ['theme studio', 'public page studio', 'public landing editor', 'customize background'],
    answer:
      '**Studio Customization Tools ({{club_name}}):**\n• Click the top-right **Palette** icon (**Theme Studio**) to switch Light/Dark presets, layer Colorful Mesh + Animated Effects, and tune Liquid Glass intensity.\n• Open the top-left **Hamburger Menu → Public Page Editor** to edit public sections, Open Public Events, Highlights, FAQs, and public page theming with Undo/Redo.',
    audience: 'admin',
    action_tab: 'profile',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'Club Leadership & Committee',
    keywords: ['who is president', 'high committee', 'club leaders', 'committee list', 'exco'],
    answer:
      '**{{club_name}} Leadership ({{current_batch}}):**\n• **President / Club Owner:** {{club_president}}\n• **High Committee / EXCO:**\n{{high_committee_list}}\n• **Admins & Treasurers:**\n{{club_admins_list}}',
    audience: 'all',
    action_tab: 'profile',
    is_quick_chip: false,
    is_active: true,
  },
  {
    question: 'What Is This Web Portal For',
    keywords: ['what is this web', 'about clubsync', 'portal purpose', 'features overview'],
    answer:
      '**Welcome to {{club_name}} ({{current_batch}}):**\n• **Portal Purpose:** Official all-in-one club operations hub for **Activities & Entry QR Passes**, **Carpool**, **Equipment Loans**, **Receipt Claims & Pre-Claims (OCR)**, **Finance Ledger**, and **Club Chat**.\n• **Active Departments ({{total_members_count}} members):**\n{{club_departments}}',
    audience: 'all',
    action_tab: 'activities',
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
  members?: UserProfile[];
  ownerUserId?: string | null;
  departments?: string[];
  clubTagline?: string;
  clubAbout?: string;
  instagramUrl?: string;
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
    const claimsOutOnEv = activeClaims
      .filter((c) => c.status === 'Approved' && c.budget_id === b.id)
      .reduce((s, c) => {
        const linkedPc =
          (c.pre_claim_id ? activePreClaims.find((pc) => pc.id === c.pre_claim_id) : undefined) ||
          activePreClaims.find((pc) => pc.linked_claim_id === c.id);
        const advGiven = linkedPc ? Number(linkedPc.advance_disbursed_amount || 0) : 0;
        const rawAmt = Number(c.amount) || 0;
        const netAmt = advGiven > 0 ? Math.max(0, rawAmt - advGiven) : rawAmt;
        return s + netAmt;
      }, 0);
    const evNameLower = (b.event_name || '').trim().toLowerCase();
    const manualOutOnEv = evNameLower
      ? activeLedger
          .filter(
            (e) =>
              e.entry_type === 'OUT' &&
              (e.event_name || '').trim().toLowerCase() === evNameLower
          )
          .reduce((s, e) => s + (Number(e.amount) || 0), 0)
      : 0;
    const spent = Math.max(Number(b.spent_amount || 0), claimsOutOnEv + manualOutOnEv);
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

  const roster = input.members || [];
  const toLeadershipEntry = (m: UserProfile): ChatbotLeadershipEntry => ({
    name: m.full_name || 'Member',
    department: m.member_type || 'Member',
    batch: m.batch_year || input.currentBatch || '2026/2027',
  });

  const presidents = roster
    .filter((m) => m.role === 'owner' || (Boolean(input.ownerUserId) && m.id === input.ownerUserId))
    .map(toLeadershipEntry);
  const presidentNames = new Set(presidents.map((p) => p.name.toLowerCase()));
  const admins = roster
    .filter(
      (m) =>
        m.role === 'treasurer' &&
        !presidentNames.has((m.full_name || '').toLowerCase()) &&
        m.id !== input.ownerUserId
    )
    .map(toLeadershipEntry);
  const highCommittee = roster
    .filter((m) => /\b(high committee|exco|executive committee)\b/i.test(m.member_type || ''))
    .map(toLeadershipEntry);

  const deptCountMap = new Map<string, number>();
  for (const d of input.departments || []) {
    const clean = d.trim();
    if (clean) deptCountMap.set(clean, 0);
  }
  for (const m of roster) {
    const dept = (m.member_type || 'Member').trim() || 'Member';
    deptCountMap.set(dept, (deptCountMap.get(dept) || 0) + 1);
  }
  const departmentCounts = Array.from(deptCountMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  const clubPresidentText =
    presidents.length > 0
      ? presidents.map((p) => `**${p.name}** (${p.department} • Batch ${p.batch})`).join(', ')
      : 'Check the People tab in Club Chat or Members roster';
  const highCommitteeText =
    highCommittee.length > 0
      ? highCommittee
          .slice(0, 12)
          .map((hc) => `• **${hc.name}** (${hc.department} • Batch ${hc.batch})`)
          .join('\n')
      : 'No members currently tagged under High Committee / EXCO.';
  const clubAdminsText =
    admins.length > 0
      ? admins
          .slice(0, 12)
          .map((a) => `• **${a.name}** (${a.department} • Batch ${a.batch})`)
          .join('\n')
      : 'No separate Treasurer/Admin accounts assigned yet.';
  const clubDepartmentsText =
    departmentCounts.length > 0
      ? departmentCounts.map((d) => `• **${d.name}:** ${d.count} member(s)`).join('\n')
      : 'No departments configured yet.';

  return {
    clubName: input.clubName || 'ClubSync',
    currentBatch: input.currentBatch || '2026/2027',
    userId: uid,
    userName: input.profile?.full_name || 'Member',
    userRoleLabel: roleLabel,
    contactEmail: input.contactEmail || '',
    clubTagline: input.clubTagline || '',
    clubAbout: input.clubAbout || '',
    instagramUrl: input.instagramUrl || '',
    departments: departmentCounts.map((d) => d.name),
    leadership: {
      presidents,
      admins,
      highCommittee,
      totalMembers: roster.length,
      departmentCounts,
    },
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
      club_president: clubPresidentText,
      high_committee_list: highCommitteeText,
      club_admins_list: clubAdminsText,
      club_departments: clubDepartmentsText,
      total_members_count: String(roster.length),
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
  // Greetings & Help
  hi: 'greeting',
  hello: 'greeting',
  hey: 'greeting',
  salam: 'greeting',
  selamat: 'greeting',
  help: 'help',
  bantuan: 'help',
  // QR & Attendance
  qr: 'qr',
  scan: 'qr',
  imbas: 'qr',
  checkin: 'qr',
  attendance: 'qr',
  scanner: 'qr',
  // Profile, Bank & Security
  profile: 'profile',
  profil: 'profile',
  bank: 'bank',
  duitnow: 'bank',
  maybank: 'bank',
  cimb: 'bank',
  password: 'password',
  pwd: 'password',
  email: 'profile',
  ic: 'profile',
  matric: 'profile',
  matrik: 'profile',
  dorm: 'profile',
  college: 'profile',
  kolej: 'profile',
  security: 'password',
  // Guest & Public Landing
  guest: 'guest',
  tetamu: 'guest',
  nonmember: 'guest',
  outsider: 'guest',
  landing: 'landing',
  website: 'landing',
  poster: 'landing',
  highlight: 'landing',
  highlights: 'landing',
  faq: 'landing',
  slug: 'landing',
  publish: 'landing',
  editor: 'landing',
  // Theme & Appearance
  theme: 'theme',
  tema: 'theme',
  dark: 'theme',
  light: 'theme',
  gelap: 'theme',
  cerah: 'theme',
  background: 'theme',
  wallpaper: 'theme',
  mesh: 'theme',
  glass: 'theme',
  studio: 'theme',
  // Admin / Owner Ops & Logs
  admin: 'role',
  owner: 'role',
  treasurer: 'role',
  bendahari: 'role',
  pin: 'role',
  unlock: 'role',
  role: 'role',
  permission: 'role',
  permissions: 'role',
  // Leadership & Committee
  presiden: 'leadership',
  president: 'leadership',
  pengerusi: 'leadership',
  highcommittee: 'leadership',
  exco: 'leadership',
  leader: 'leadership',
  leaders: 'leadership',
  leadership: 'leadership',
  vice: 'leadership',
  secretary: 'leadership',
  setiausaha: 'leadership',
  // About & Portal Purpose
  aboutportal: 'about',
  clubsync: 'about',
  purpose: 'about',
  kegunaan: 'about',
  fungsi: 'about',
  feature: 'about',
  features: 'about',
  about: 'about',
  // Departments & Units
  department: 'department',
  departments: 'department',
  unit: 'department',
  units: 'department',
  biro: 'department',
  division: 'department',
  // Privacy & Data Safety
  privacy: 'privacy',
  safe: 'privacy',
  secure: 'privacy',
  confidential: 'privacy',
  privasi: 'privacy',
  // Troubleshooting
  troubleshoot: 'troubleshoot',
  bug: 'troubleshoot',
  error: 'troubleshoot',
  glitch: 'troubleshoot',
  lag: 'troubleshoot',
  slow: 'troubleshoot',
  stuck: 'troubleshoot',
  broken: 'troubleshoot',
  masalah: 'troubleshoot',
  // Membership Onboarding
  join: 'join',
  signup: 'join',
  register: 'join',
  daftar: 'join',
  membership: 'join',
  // Claim Status / Payout / Rejection
  rejected: 'claimstatus',
  payout: 'claimstatus',
  paid: 'claimstatus',
  reimbursed: 'claimstatus',
  timeline: 'claimstatus',
  whoami: 'whoami',
  member: 'members',
  members: 'members',
  ahli: 'members',
  roster: 'members',
  promote: 'members',
  log: 'logs',
  logs: 'logs',
  audit: 'logs',
  history: 'logs',
  restore: 'logs',
  deleted: 'logs',
  threshold: 'threshold',
  stage: 'threshold',
  twostage: 'threshold',
  // Excel, OCR & Duplicates
  excel: 'excel',
  xlsx: 'excel',
  csv: 'excel',
  export: 'excel',
  import: 'excel',
  spreadsheet: 'excel',
  ocr: 'ocr',
  duplicate: 'ocr',
  pendua: 'ocr',
  // App Install, Notifications, Chat, Batch & Navigation
  install: 'pwa',
  pwa: 'pwa',
  app: 'pwa',
  homescreen: 'pwa',
  notification: 'notification',
  notifications: 'notification',
  notifikasi: 'notification',
  bell: 'notification',
  reminder: 'notification',
  reminders: 'notification',
  dm: 'chat',
  chat: 'chat',
  lounge: 'chat',
  message: 'chat',
  messages: 'chat',
  batch: 'batch',
  session: 'batch',
  semester: 'batch',
  hamburger: 'navigation',
  drawer: 'navigation',
  sidebar: 'navigation',
  navigate: 'navigation',
  menu: 'navigation',
  menus: 'navigation',
};

function normalizeRawText(text: string): string {
  return text
    .toLowerCase()
    .replace(/pre[-\s]?claim/g, 'preclaim')
    .replace(/\bnon[-\s]?member\b/g, 'nonmember')
    .replace(/\b(?:2|two)[-\s]?stage\b/g, 'twostage')
    .replace(/\bcheck[-\s]?in\b/g, 'checkin')
    .replace(/\bhigh\s+committee\b/g, 'highcommittee')
    .replace(/\bexecutive\s+committee\b/g, 'highcommittee')
    .replace(/\bwho\s+am\s+i\b/g, 'whoami')
    .replace(/\bwhat\s+is\s+this\b/g, 'aboutportal')
    .replace(/\bweb(?:site)?\s+for\b/g, 'aboutportal')
    .replace(/\bportal\s+for\b/g, 'aboutportal')
    .replace(/\bforgot\s+password\b/g, 'troubleshoot')
    .replace(/\b(?:can'?t|cannot)\s+log\s*in\b/g, 'troubleshoot')
    .replace(/\bnot\s+working\b/g, 'troubleshoot')
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

function findMatchingEvent(
  events: ChatbotEventBudgetSummary[],
  rawNorm: string
): ChatbotEventBudgetSummary | undefined {
  return events.find((ev) => {
    const evNorm = normalizeRawText(ev.event_name);
    if (!evNorm) return false;
    if (rawNorm.includes(evNorm)) return true;
    const evWords = evNorm.split(' ').filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
    return evWords.length > 0 && evWords.filter((w) => rawNorm.includes(w)).length >= Math.min(2, evWords.length);
  });
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
    const matchedEv = findMatchingEvent(snapshot.events, rawNorm);
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

  // 2C. Personal Status & Identity Intents (All Users)
  if (has('whoami')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'My Account & Club Overview',
      actionTab: 'profile',
      reply: [
        `**Your Account Summary (${snapshot.clubName}):**`,
        `• **Name:** ${snapshot.userName}`,
        `• **Access Role:** ${snapshot.userRoleLabel}`,
        `• **Active Batch:** ${snapshot.currentBatch}`,
        `• **Claims:** ${snapshot.publicVars.my_pending_claims} (Total submitted: ${snapshot.publicVars.my_total_claimed})`,
        `• **Equipment Loans:**\n${snapshot.publicVars.my_active_loans}`,
        `• **Attending RSVPs:**\n${snapshot.publicVars.my_upcoming_rsvps}`,
      ].join('\n'),
      followUpChips: ['My claims & loans', 'Update bank & profile', 'Upcoming events'],
    };
  }

  if (
    !has('claimstatus') &&
    ((has('my') && (has('claim') || has('preclaim') || has('loan') || has('rsvp') || has('status'))) ||
      rawNorm.includes('my claims & loans'))
  ) {
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

  // 2D. Portal How-To Guides (All Users & Admin/Owner Operations)
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
      followUpChips: ['How to submit a claim', 'How to request a pre-claim', 'Receipt OCR & duplicates'],
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

  if (has('threshold')) {
    const canSeeExactThreshold = permissions.canViewFinance || permissions.isAdmin;
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: '2-Stage Claim Approval Threshold',
      actionTab: 'claims',
      reply: [
        `**Claim Approval & 2-Stage Threshold (${snapshot.clubName}):**`,
        `• Standard claims are verified and approved directly by an authorized Treasurer/Admin in **Claims**.`,
        canSeeExactThreshold
          ? `• High-value claims above **${formatRM(snapshot.approvalThreshold)}** require **2-Stage Approval** (1. Treasurer verification → 2. President/Owner sign-off).`
          : `• High-value claims exceeding the club's configured **2-Stage Approval Threshold** require both Treasurer verification and President/Owner sign-off.`,
        canSeeExactThreshold
          ? `• Admins and Owners can adjust this RM threshold directly at the top of the **Claims** workspace.`
          : `• Check your claim progress anytime under **Claims** or by asking **"My claims & loans"**.`,
      ].join('\n'),
      followUpChips: permissions.canViewFinance
        ? ['Pending claims to review', 'How to submit a claim', 'Monthly finance summary']
        : ['My claims & loans', 'How to submit a claim', 'Receipt OCR & duplicates'],
    };
  }

  if (has('ocr')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Receipt OCR & Duplicate Detection',
      actionTab: 'new_claim',
      reply: [
        `**Smart Receipt OCR, Stitching & Duplicate Check:**`,
        `1. Upload or snap 1 or multiple receipt photos in **Submit Claim** — **ReceiptDropzone** automatically stitches multi-photo receipts into a single clear JPG.`,
        `2. Local OCR scans the receipt right on your device to pre-fill merchant/title, expense date, and total RM amount (double-check numbers before submitting!).`,
        `3. ClubSync checks for matching amounts, dates, or file hashes to flag potential **duplicate receipts** before payout.`,
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
      followUpChips: ['How to request a pre-claim', 'How to split costs', '2-Stage approval threshold'],
    };
  }

  if (has('guest')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Guest & Non-Member Event Registration',
      actionTab: 'activities',
      reply: [
        `**How Guests & Non-Members Register (${snapshot.clubName}):**`,
        `1. External participants can register on the public landing page (**Open Public Events**) or via an event's direct \`/e/<event-slug>\` share link — no member account needed.`,
        `2. They fill in name, contact details, and upload their DuitNow/bank transfer proof if the event charges a registration fee.`,
        `3. Upon submission, guests receive a digital **Entry Pass QR** that Admins scan at the venue check-in.`,
      ].join('\n'),
      followUpChips: ['QR pass & attendance', 'How to pay event fees', 'Public Page Editor'],
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

  if (has('qr')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'QR Pass & Attendance Check-In',
      actionTab: 'activities',
      reply: [
        `**Event Entry QR Pass & Attendance Scanning:**`,
        `• **Members:** RSVP **Attending** on an event in **Home & Activities** and open its **QR Pass** tab to show your personal check-in QR at the venue.`,
        `• **Admins & Exco:** Open **Scan QR** from the top-left **Hamburger Drawer** (or tap the center **QR button** on the Mobile bottom bar) to check in members and registered guests in real time.`,
      ].join('\n'),
      followUpChips: ['My RSVPs', 'Upcoming events', 'Guest registration guide'],
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

  if (has('profile') || has('bank') || has('password')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Profile, Bank QR & Account Security',
      actionTab: 'profile',
      reply: [
        `**Managing Your Profile, Payout Bank & Security:**`,
        `• **Personal & Academic:** Update your Full Name, Matric No, Phone/WhatsApp, Department, and Residential College (auto-fills event carpool pickup!). IC/Passport stays masked by default for privacy.`,
        `• **Payout & Bank QR:** Save your Bank Name, Account Number, and upload your **DuitNow QR** so claim reimbursements auto-fill cleanly.`,
        `• **Account & Security:** Use **Change Email** or **Reset Password** right under the Security tab in **Profile**.`,
      ].join('\n'),
      followUpChips: ['How to submit a claim', 'My claims & loans', 'Theme & Dark Mode'],
    };
  }

  if (has('landing')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Public Landing Page Studio',
      actionTab: 'activities',
      reply: [
        `**Public Landing Page Studio (${snapshot.clubName}):**`,
        permissions.isAdmin || permissions.isOwner
          ? `• Open the top-left **Hamburger Drawer → Public Page Editor** to customize the public website.`
          : `• **Owners & authorized Admins** can edit the public landing page from **Hamburger Drawer → Public Page Editor**.`,
        `• Configure Hero & Navbar, Announcement Bar, Impact Metrics, Pillars, **Open Public Events** (\`/e/<slug>\`), **Club Highlights** posters, FAQs, Footer socials, and **Design & Theme**.`,
        `• Includes **Undo/Redo**, **Templates**, and live Desktop / Tablet / Mobile preview before hitting **Save & Publish**.`,
      ].join('\n'),
      followUpChips: ['Theme & Dark Mode', 'Guest registration guide', 'Admin role & PIN unlock'],
    };
  }

  if (has('theme')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Theme Studio, Dark Mode & Liquid Glass',
      actionTab: 'profile',
      reply: [
        `**Theme Studio & Appearance (${snapshot.clubName}):**`,
        `• **Light / Dark Mode:** Any signed-in user can toggle Light or Dark mode anytime using the **Sun / Moon** button at the top right.`,
        permissions.isAdmin || permissions.isOwner
          ? `• **Theme Studio:** Click the top-right **Palette** icon to choose curated Presets, layer **Colorful Mesh** backgrounds with **Animated Effects**, pick accent colors, and tune Liquid Glass intensity.`
          : `• **Theme Studio:** Owners and Admins can customize club-wide animated backgrounds, mesh colors, and glass styling via the top-right **Palette** button.`,
      ].join('\n'),
      followUpChips: ['Public Page Editor', 'Navigation guide', 'How to install app'],
    };
  }

  if (has('excel')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Excel / CSV Import & Export',
      actionTab: permissions.canViewFinance || permissions.isAdmin ? 'ledger' : 'claims',
      reply:
        permissions.canViewFinance || permissions.isAdmin
          ? [
              `**Finance Ledger Excel & CSV Tools (${snapshot.clubName}):**`,
              `• Open **Finance Ledger** from the top-left **Hamburger Drawer**.`,
              `• Use **Export Excel / CSV** to download clean financial records for university audit or committee handovers.`,
              `• Use **Import Excel / CSV** to bring in historical transactions or batch bank entries cleanly.`,
            ].join('\n')
          : [
              `**Finance Ledger Import & Export:**`,
              `• Excel/CSV ledger import and full financial report export inside **Finance Ledger** are restricted to Treasurers and Club Owners.`,
              `• Need an official statement or claim record? Message a Treasurer via the **Public** or **People** tab in Club Chat.`,
            ].join('\n'),
      followUpChips: permissions.canViewFinance
        ? ['Monthly finance summary', 'Activity & audit logs', 'Pending claims to review']
        : ['My claims & loans', 'Committee contact', 'How to submit a claim'],
    };
  }

  if (
    has('leadership') ||
    (/\b(who|siapa)\b/i.test(rawNorm) && (has('role') || has('contact') || has('members')))
  ) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Club Leadership & High Committee',
      actionTab: 'profile',
      reply: [
        `**${snapshot.clubName} Leadership & Committee (Batch ${snapshot.currentBatch}):**`,
        `• **President / Club Owner:** ${snapshot.publicVars.club_president}`,
        ``,
        `**High Committee / EXCO:**`,
        snapshot.publicVars.high_committee_list,
        ``,
        `**Treasurers & Admins:**`,
        snapshot.publicVars.club_admins_list,
        ``,
        `Switch to the **People** tab right here in Club Chat to send a direct message to any leader!`,
      ].join('\n'),
      followUpChips: ['Club departments & members', 'What is this web for?', 'Club Chat & DMs'],
    };
  }

  if (has('about')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: `About ${snapshot.clubName} & ClubSync`,
      actionTab: 'activities',
      reply: [
        `**About ${snapshot.clubName} (${snapshot.currentBatch}):**`,
        snapshot.clubTagline ? `• _"${snapshot.clubTagline}"_` : null,
        snapshot.clubAbout ? `• ${snapshot.clubAbout}` : null,
        ``,
        `**What This Web Portal Is For (ClubSync):**`,
        `• **Activities & Attendance:** Browse events, RSVP, join carpools, pay fees, and check in with your digital **Entry QR Pass**.`,
        `• **Equipment Borrowing:** Check real-time club gear stock and borrow or return items cleanly.`,
        `• **Claims & Finance:** Submit receipt claims & cash-advance pre-claims with local OCR, while Treasurers/Owners manage budgets, approvals, and auditable Excel ledgers.`,
        `• **Public Pages & Chat:** Share public \`/e/<slug>\` guest event links, customize themes, and ask **Help Desk**, **Public Lounge**, or **People DMs**.`,
      ]
        .filter((line) => line !== null)
        .join('\n'),
      followUpChips: ['Who is President & High Committee?', 'Club departments & members', 'Upcoming events'],
    };
  }

  if (
    has('department') ||
    (/\b(how many|total|count|berapa|senarai)\b/i.test(rawNorm) && has('members'))
  ) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Departments, Units & Member Count',
      actionTab: 'profile',
      reply: [
        `**${snapshot.clubName} Organization Overview (Batch ${snapshot.currentBatch}):**`,
        `• **Total Directory Members:** ${snapshot.leadership.totalMembers}`,
        ``,
        `**Departments / Units Breakdown:**`,
        snapshot.publicVars.club_departments,
        ``,
        `You can update your own Department or Unit under **Profile → Personal & Academic**.`,
      ].join('\n'),
      followUpChips: ['Who is President & High Committee?', 'How to join as a member', 'Update bank & profile'],
    };
  }

  if (has('claimstatus')) {
    const recentClaimsText =
      snapshot.myAllClaims.length > 0
        ? snapshot.myAllClaims
            .slice(0, 4)
            .map((c) => `• **${c.title}** — ${formatRM(Number(c.amount || 0))} [${c.status}]`)
            .join('\n')
        : null;
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Claim Payout & Rejection Help',
      actionTab: 'claims',
      reply: [
        `**Claim Review, Payout Timeline & Rejection Guide:**`,
        `• **Statuses:** Claims start as **Pending** → verified by Treasurer (and Owner/President if above the 2-stage threshold) → **Approved** or **Rejected**.`,
        `• **If a Claim Was Rejected:** Open **Claims**, inspect the reviewer's reason/history notes, fix any blurry receipt or missing bank details, and submit an updated claim.`,
        `• **Faster Payouts:** Ensure your **DuitNow QR** and bank account number are saved under **Profile → Payout & Bank QR**.`,
        recentClaimsText ? `\n**Your Recent Claims (${snapshot.publicVars.my_pending_claims}):**\n${recentClaimsText}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      followUpChips: ['My claims & loans', 'How to submit a claim', 'Update bank & profile'],
    };
  }

  if (has('privacy')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Data Privacy & Role Security',
      actionTab: 'profile',
      reply: [
        `**Privacy & Security Safeguards in ${snapshot.clubName}:**`,
        `• **Masked Personal IDs:** Your IC/Passport number is masked by default in **Profile** and only revealed when explicitly toggled.`,
        `• **Strict Role Isolation:** Club-wide bank/cash balances, budgets, and sensitive member contacts are blocked for regular members and enforced across both UI and Help Desk.`,
        `• **Audit & Soft-Delete Protection:** Admin actions and deletions go to **Activity Logs** as traceable soft-deletes rather than silent erasure.`,
      ].join('\n'),
      followUpChips: ['Update bank & profile', 'Who is President & High Committee?', 'What is this web for?'],
    };
  }

  if (has('troubleshoot')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Troubleshooting & Support',
      actionTab: 'profile',
      reply: [
        `**Quick Troubleshooting Checklist (${snapshot.clubName}):**`,
        `• **Can't Log In / Forgot Password:** Use the **Forgot Password** link on the sign-in form (or **Profile → Account & Security → Reset Password** once signed in).`,
        `• **Receipt Upload / OCR Issues:** Upload crisp JPG/PNG photos or PDFs in **Submit Claim**; if OCR misreads a blurry total, edit the RM field manually before submitting.`,
        `• **Missing Admin Tabs / Public Editor:** Check your role in **Hamburger Drawer** (unlock Admin PIN if authorized, or ask the Club Owner in **People** DMs).`,
        `• **UI Glitch / Stale Session:** Hard-refresh the browser tab or check **Notification Bell** / sign out and back in.`,
      ].join('\n'),
      followUpChips: ['Committee contact', 'Club Chat & DMs', 'How to navigate portal'],
    };
  }

  if (has('join') && !has('carpool') && !has('guest')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Membership Sign Up & Onboarding',
      actionTab: 'activities',
      reply: [
        `**How Membership & Onboarding Works (${snapshot.clubName}):**`,
        `1. New students sign up via **Member Sign Up** on the public portal landing page with their email, full name, UTM Matric No, and WhatsApp phone.`,
        `2. Once signed in, complete **Profile** (Department/Unit, Residential College/Dorm, and Payout Bank/DuitNow QR) to unlock carpool auto-fill and claims.`,
        `3. Non-member guests don't need membership to attend open events — they can register via **Open Public Events** or \`/e/<slug>\`.`,
      ].join('\n'),
      followUpChips: ['Update bank & profile', 'Guest registration guide', 'Club departments & members'],
    };
  }

  if (has('role')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Role Switcher, Admin PIN & Permissions',
      actionTab: 'profile',
      reply: [
        `**Workspace Roles & Admin PIN Unlock:**`,
        `• **Current View:** You are currently signed in as **${snapshot.userRoleLabel}** (${snapshot.userName}).`,
        `• **Switch Role / PIN Unlock:** Open the top-left **Hamburger Drawer** and check **Workspace & Admin Controls** to switch between **Member**, **Admin**, or **Owner** mode (or enter the Admin PIN when prompted).`,
        `• **Permissions:** **Owners** control full finance, member promotions, Public Page Studio, and Theme Studio; **Treasurers/Admins** verify fees, review claims, and manage events/equipment; **Members** RSVP, borrow gear, and submit claims.`,
      ].join('\n'),
      followUpChips: ['Who is President & High Committee?', 'Members & roster', 'Activity & audit logs'],
    };
  }

  if (has('members')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Member Roster & Directory',
      actionTab: 'profile',
      reply: [
        `**Member Directory & Contacts (${snapshot.clubName} — ${snapshot.leadership.totalMembers} member(s)):**`,
        permissions.isAdmin || permissions.isOwner
          ? `• Open the top-left **Hamburger Drawer → Members** to search members by department, matric no, or batch, update committee roles, and manage access.`
          : `• To find and message fellow members, Exco, or Treasurers directly, switch to the **People** tab right inside this Club Chat window.`,
        `• Your own department, matric number, and dorm pickup info can be updated anytime in **Profile**.`,
      ].join('\n'),
      followUpChips: ['Who is President & High Committee?', 'Club departments & members', 'Club Chat & DMs'],
    };
  }

  if (has('logs')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Activity Logs & Soft-Delete Audit',
      actionTab: permissions.isAdmin || permissions.isOwner ? 'ledger' : 'profile',
      reply: [
        `**Activity Logs & Soft-Delete Audit Trail:**`,
        permissions.isAdmin || permissions.isOwner
          ? `• Open the top-left **Hamburger Drawer → Activity Logs** to inspect an auditable trail of claim approvals, ledger entries, event edits, and soft-deleted records.`
          : `• ClubSync keeps an automatic audit log of financial approvals, ledger updates, and soft-deletes (accessible to Admins and Club Owners).`,
        `• Deleted items use **soft-delete** so club records remain traceable without accidental permanent data loss.`,
      ].join('\n'),
      followUpChips: permissions.canViewFinance
        ? ['Excel import & export', 'Monthly finance summary', 'Role & PIN unlock']
        : ['Data privacy & security', 'My claims & loans', 'How to navigate portal'],
    };
  }

  if (has('chat')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Club Chat, Public Lounge & DMs',
      actionTab: 'activities',
      reply: [
        `**Using Club Chat (${snapshot.clubName}):**`,
        `• **Help Desk (This Tab):** Instant 24/7 answers using live portal data, FAQs, leadership directory, and club policies.`,
        `• **Public Lounge:** Club-wide announcement & discussion room where members and Exco chat together.`,
        `• **People (Direct Messages):** Start a private 1-on-1 DM with any member, Exco, or Treasurer, with live unread badges.`,
      ].join('\n'),
      followUpChips: ['Who is President & High Committee?', 'Committee contact', 'How to navigate portal'],
    };
  }

  if (has('pwa')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Install ClubSync App (PWA)',
      actionTab: 'activities',
      reply: [
        `**Install ${snapshot.clubName} as an App (PWA):**`,
        `1. Open the top-left **Hamburger Drawer** and click **Install App** (shown when your browser supports one-tap install).`,
        `2. On iPhone/Safari, tap **Share → Add to Home Screen**; on Android/Desktop Chrome, click **Install** in the address bar or menu.`,
        `3. Once installed, you get full-screen launch and quick mobile dock navigation.`,
      ].join('\n'),
      followUpChips: ['How to navigate portal', 'Notifications & reminders', 'Theme & Dark Mode'],
    };
  }

  if (has('notification')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Notifications & Reminders Bell',
      actionTab: 'activities',
      reply: [
        `**Notifications & Club Reminders:**`,
        `• Tap the **Bell icon** at the top-right navbar anytime to check alerts for pending claim updates, fee verifications, equipment due dates, and upcoming activities.`,
        `• You can also check **Latest announcements** here in Help Desk or in the **Public** lounge.`,
      ].join('\n'),
      followUpChips: ['Latest announcements', 'My claims & loans', 'Upcoming events'],
    };
  }

  if (has('batch')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Active Academic Batch',
      actionTab: 'activities',
      reply: [
        `**Current Active Session / Batch:**`,
        `• **Club:** ${snapshot.clubName}`,
        `• **Active Batch:** **${snapshot.currentBatch}**`,
        `• **Active Activities:** ${snapshot.publicVars.active_events_count} open/active event(s) in this session.`,
      ].join('\n'),
      followUpChips: ['Upcoming events', 'Who is President & High Committee?', 'Latest announcements'],
    };
  }

  if (has('navigation')) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Portal Navigation Guide',
      actionTab: 'activities',
      reply: [
        `**Where Everything Lives in ${snapshot.clubName}:**`,
        `• **Top-Left Hamburger Drawer (☰):** Activities, Equipment, Claims, Finance Ledger, Members, Activity Logs, Profile, **Scan QR**, **New Claim**, Role Mode Switcher, and **Public Page Editor** (permission-based).`,
        `• **Top-Right Bar:** Quick **Submit Claim**, **Theme Studio** (Palette), **Light/Dark toggle**, **Notification Bell**, and **Account / Sign Out**.`,
        `• **Mobile Bottom Liquid Glass Dock:** Quick jump between **Home**, **Gear**, **Scan QR**, **Claims**, and **Profile**.`,
      ].join('\n'),
      followUpChips: ['What is this web for?', 'Upcoming events', 'Theme & Dark Mode'],
    };
  }

  // 2E. Live Portal Info Intents
  const specificEvent = findMatchingEvent(snapshot.events, rawNorm);
  if (specificEvent) {
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: `Event Details: ${specificEvent.event_name}`,
      actionTab: 'activities',
      reply: [
        `**${specificEvent.event_name}** (${specificEvent.status})`,
        `• **Date:** ${specificEvent.event_date}${specificEvent.event_time ? ` · ${specificEvent.event_time}` : ''}`,
        `• **Location:** ${specificEvent.location}`,
        `• **Registration Fee:** ${specificEvent.registration_fee > 0 ? formatRM(specificEvent.registration_fee) : 'Free'}`,
        ``,
        `Open **Home & Activities** and select **${specificEvent.event_name}** to RSVP, view/pay fees, arrange carpool, or open your Entry QR Pass.`,
      ].join('\n'),
      followUpChips: ['How to pay event fees', 'QR pass & attendance', 'How to join carpool'],
    };
  }

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
      followUpChips: ['How to pay event fees', 'How to join carpool', 'QR pass & attendance'],
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
        `• **President / Club Owner:** ${snapshot.publicVars.club_president}`,
        snapshot.contactEmail ? `• **Club Email:** ${snapshot.contactEmail}` : null,
        snapshot.instagramUrl ? `• **Instagram:** ${snapshot.instagramUrl}` : null,
        `• **Live Messaging:** Switch to the **Public** or **People** tab in Club Chat to message an Exco or Treasurer directly.`,
        `• **Profile Settings:** Visit **My Profile** to update your DuitNow QR, matric no, or password.`,
      ]
        .filter(Boolean)
        .join('\n'),
      followUpChips: ['Who is President & High Committee?', ...starterFollowUps.slice(0, 2)],
    };
  }

  // 2F. Greetings & General Help Guide (Checked after specific intents so "hi, club balance?" still answers balance)
  if (
    has('greeting') ||
    has('help') ||
    rawNorm === 'tolong' ||
    rawNorm === 'tolong saya' ||
    rawNorm === 'what can you do'
  ) {
    const roleTips =
      permissions.canViewFinance || permissions.isAdmin
        ? [
            `• **Treasury & Audit:** Live club balance, bank/cash split, pending claims queue, overspent event budgets, monthly finance summary, 2-stage threshold, Excel import/export, and Activity Logs.`,
            `• **Club Leadership & People:** Who is President/High Committee, departments, member counts, QR attendance scanner, carpool coordination, and equipment stock.`,
            `• **Studios & Controls:** Public Page Editor, Theme Studio (mesh + effects + glass), Light/Dark mode, Admin PIN / Role switcher, and troubleshooting.`,
          ]
        : [
            `• **Club Info & Leadership:** What this web portal is for, President & High Committee directory, departments, announcements, and troubleshooting.`,
            `• **Claims & Money Back:** Submitting claims, OCR receipt stitching, splitting itemized costs, pre-claims, payout/rejection help, and personal claim status.`,
            `• **Events, Gear & Account:** Upcoming activities, Entry QR Pass, paying fees, carpool, guest links, borrowing gear, and updating DuitNow/profile.`,
          ];
    return {
      matched: true,
      source: 'builtin',
      matchedLabel: 'Club Help Desk Guide',
      actionTab: 'none',
      reply: [
        `Hi **${snapshot.userName}**! I'm the **${snapshot.clubName} Help Desk** (${snapshot.userRoleLabel} • Batch ${snapshot.currentBatch}). Ask me anything about:`,
        ...roleTips,
      ].join('\n'),
      followUpChips: permissions.canViewFinance
        ? ['Current club balance', 'Who is President & High Committee?', 'What is this web for?']
        : ['What is this web for?', 'Who is President & High Committee?', 'Upcoming events'],
    };
  }

  // 3. No Clean Match — Suggest top 3 closest topics and mark unmatched for inbox logging
  const candidateTopics = permissions.canViewFinance
    ? [
        'Current club balance',
        'Pending claims to review',
        'Check overspent budgets',
        'Monthly finance summary',
        'Who is the President & High Committee?',
        'What is this web portal for?',
        'Club departments & members',
        'Upcoming events',
        'Available equipment',
        'How to submit a claim',
        'My claims & loans',
        'QR pass & attendance',
        'Update bank & profile',
        'Public Page Editor',
        'Theme & Dark Mode',
        'Troubleshooting help',
      ]
    : [
        'Who is the President & High Committee?',
        'What is this web portal for?',
        'Club departments & members',
        'Upcoming events',
        'My claims & loans',
        'Claim payout & rejection help',
        'How to submit a claim',
        'Available equipment',
        'How to request a pre-claim',
        'How to pay event fees',
        'How to join carpool',
        'QR pass & attendance',
        'Update bank & profile',
        'Theme & Dark Mode',
        'Troubleshooting help',
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
