import { supabase, EquipmentItem, EquipmentLoan, UserProfile, logActivity } from '@/lib/supabase';

/** Local (not UTC) YYYY-MM-DD, so Malaysia time doesn't roll back a day before 8 AM. */
export function localDateStr(input: Date | string = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

export function enumerateDays(start: string, end: string, maxDays = 400): string[] {
  const out: string[] = [];
  if (!start || !end || end < start) return out;
  let cur = start;
  while (cur <= end && out.length < maxDays) {
    out.push(cur);
    cur = addDaysStr(cur, 1);
  }
  return out;
}

export type LoanApproval = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

/** Old rows (before the approval feature) have no approval_status → treat as Approved. */
export function approvalOf(loan: EquipmentLoan): LoanApproval {
  return (loan.approval_status as LoanApproval) || 'Approved';
}

/** Does this loan block stock on the given calendar day? */
export function loanOccupiesDay(loan: EquipmentLoan, day: string, today: string): boolean {
  const a = approvalOf(loan);
  if (a === 'Rejected' || a === 'Cancelled') return false;
  if (!loan.borrow_date || loan.borrow_date > day) return false;
  if (loan.status === 'Returned') {
    const end = loan.returned_at ? localDateStr(loan.returned_at) : loan.return_date;
    return day <= (end || loan.return_date);
  }
  // Not returned yet: occupies until due date; if overdue, the unit is still physically out.
  return day <= loan.return_date || loan.return_date < today;
}

export function unitsInUseOnDay(loans: EquipmentLoan[], itemId: string, day: string, today: string): number {
  return loans
    .filter((l) => l.item_id === itemId && loanOccupiesDay(l, day, today))
    .reduce((s, l) => s + Number(l.quantity || 0), 0);
}

export function maxUnitsInUseInRange(
  loans: EquipmentLoan[],
  itemId: string,
  start: string,
  end: string,
  today: string
): number {
  let max = 0;
  for (const day of enumerateDays(start, end)) {
    max = Math.max(max, unitsInUseOnDay(loans, itemId, day, today));
  }
  return max;
}

export function availableForRange(
  item: EquipmentItem,
  loans: EquipmentLoan[],
  start: string,
  end: string,
  today: string
): number {
  return Math.max(0, Number(item.total_quantity) - maxUnitsInUseInRange(loans, item.id, start, end, today));
}

/** Equipment QR payload printed on stickers. */
export function equipmentQrPayload(itemId: string, unitNo?: number): string {
  return `CLUBSYNC_EQ::v1::${itemId}${unitNo ? `::${unitNo}` : ''}`;
}

export function qrImageUrl(data: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=8&data=${encodeURIComponent(data)}`;
}

export const MIGRATION_HINT =
  'The database needs the latest update first. Ask the owner to run the new SQL migration in Supabase.';

interface SubmitLoanArgs {
  item: EquipmentItem;
  loans: EquipmentLoan[];
  profile: UserProfile;
  quantity: number;
  startDate: string;
  endDate: string;
  purpose: string;
}

export interface SubmitLoanResult {
  ok: boolean;
  error?: string;
  quantity: number;
  approval: 'Pending' | 'Approved';
  isFuture: boolean;
}

/** Shared by the Equipment page and the on-the-spot QR scanner. */
export async function submitLoanRequest({
  item,
  loans,
  profile,
  quantity,
  startDate,
  endDate,
  purpose,
}: SubmitLoanArgs): Promise<SubmitLoanResult> {
  const today = localDateStr();
  const approval: 'Pending' | 'Approved' = item.requires_approval ? 'Pending' : 'Approved';
  const isFuture = startDate > today;
  const base: SubmitLoanResult = { ok: false, quantity, approval, isFuture };

  if (!startDate || !endDate || endDate < startDate) {
    return { ...base, error: 'Return date must be on or after the start date.' };
  }
  const avail = availableForRange(item, loans, startDate, endDate, today);
  if (avail <= 0) {
    return { ...base, error: 'No stock is free for those dates. Try different dates.' };
  }
  if (quantity > avail) {
    return { ...base, error: `Only ${avail} unit(s) are free for the whole period ${startDate} → ${endDate}.` };
  }

  const core = {
    item_id: item.id,
    item_name: item.item_name,
    user_id: profile.id,
    borrower_name: profile.full_name,
    matric_no: profile.matric_no,
    phone_number: profile.phone_number,
    quantity,
    purpose: purpose.trim() || 'Club Activity',
    borrow_date: startDate,
    return_date: endDate,
    status: 'Borrowed',
  };

  const { error } = await supabase.from('equipment_loans').insert({ ...core, approval_status: approval });
  if (error) {
    // Column missing → only safe to fall back for a plain, instant, same-day borrow.
    if (item.requires_approval || isFuture) {
      return { ...base, error: MIGRATION_HINT };
    }
    const { error: fb } = await supabase.from('equipment_loans').insert(core);
    if (fb) return { ...base, error: fb.message };
  }

  if (!isFuture && approval === 'Approved') {
    const inUse = unitsInUseOnDay(loans, item.id, today, today) + quantity;
    await supabase
      .from('equipment_items')
      .update({ available_quantity: Math.max(0, item.total_quantity - inUse) })
      .eq('id', item.id);
  }

  void logActivity(
    profile,
    'Equipment',
    approval === 'Pending' ? 'Equipment request' : isFuture ? 'Equipment reserved' : 'Equipment borrowed',
    `${profile.full_name} (${profile.matric_no}) ${
      approval === 'Pending' ? 'requested' : isFuture ? 'reserved' : 'borrowed'
    } ${quantity}x ${item.item_name} for ${startDate} → ${endDate}` +
      (purpose.trim() ? ` — ${purpose.trim()}` : '')
  );

  return { ok: true, quantity, approval, isFuture };
}

/** Re-sync equipment_items.available_quantity with "units free today". */
export async function syncAvailabilityToday(item: EquipmentItem, loansAfter: EquipmentLoan[]) {
  const today = localDateStr();
  const inUse = unitsInUseOnDay(loansAfter, item.id, today, today);
  await supabase
    .from('equipment_items')
    .update({ available_quantity: Math.max(0, item.total_quantity - inUse) })
    .eq('id', item.id);
}
