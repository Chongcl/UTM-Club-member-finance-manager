import {
  supabase,
  UserProfile,
  Budget,
  EventRsvp,
  ActivityFeePayment,
  Claim,
  EquipmentLoan,
  AdminPermissions,
  ClubNotificationType,
} from '@/lib/supabase';
import { approvalOf, addDaysStr, localDateStr } from '@/lib/equipment';
import { formatPickupTime } from '@/lib/whatsapp';

export interface EmitNotificationParams {
  targetUserId?: string | null;
  type: ClubNotificationType;
  title: string;
  body?: string;
  targetTab?: 'activities' | 'equipment' | 'claims' | 'ledger';
  targetId?: string;
  actorName?: string;
}

/** Fire-and-forget notification insert; never blocks or throws to the caller UI. */
export async function emitClubNotification(params: EmitNotificationParams): Promise<void> {
  try {
    await supabase.from('club_notifications').insert({
      target_user_id: params.targetUserId ?? null,
      type: params.type,
      title: params.title.slice(0, 160),
      body: (params.body || '').slice(0, 300),
      target_tab: params.targetTab || 'activities',
      target_id: params.targetId || '',
      actor_name: params.actorName || '',
    });
  } catch {
    /* never block UI */
  }
}

export interface LiveReminderItem {
  id: string;
  urgency: 'urgent' | 'warning' | 'info';
  title: string;
  subtitle: string;
  targetAction:
    | { kind: 'tab'; tab: 'activities' | 'equipment' | 'claims' | 'ledger' }
    | { kind: 'event'; budget: Budget; eventTab: 'pass' | 'transport' | 'fee' }
    | { kind: 'chat' };
}

function dayDiff(fromYmd: string, toYmd: string): number {
  const a = new Date(`${fromYmd}T00:00:00`);
  const b = new Date(`${toYmd}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 999;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function buildLiveReminders(input: {
  profile: UserProfile;
  isAdminOrOwner: boolean;
  isOwner: boolean;
  permissions: AdminPermissions;
  claimThreshold: number;
  budgets: Budget[];
  rsvps: EventRsvp[];
  feePayments: ActivityFeePayment[];
  claims: Claim[];
  equipmentLoans: EquipmentLoan[];
  unreadChatCount: number;
}): LiveReminderItem[] {
  const {
    profile,
    isAdminOrOwner,
    isOwner,
    permissions,
    claimThreshold,
    budgets,
    rsvps,
    feePayments,
    claims,
    equipmentLoans,
    unreadChatCount,
  } = input;

  const today = localDateStr();
  const maxUpcomingDate = addDaysStr(today, 3);
  const reminders: LiveReminderItem[] = [];

  // 1. Unread chat messages
  if (unreadChatCount > 0) {
    reminders.push({
      id: 'rem-unread-chat',
      urgency: 'info',
      title: `${unreadChatCount} unread chat message${unreadChatCount === 1 ? '' : 's'}`,
      subtitle: 'Click to open Club Chat',
      targetAction: { kind: 'chat' },
    });
  }

  // 2. Borrowed equipment due / overdue (own active borrowed items)
  const myActiveLoans = equipmentLoans.filter(
    (l) => l.user_id === profile.id && l.status !== 'Returned' && approvalOf(l) === 'Approved'
  );
  for (const loan of myActiveLoans) {
    if (!loan.return_date) continue;
    const diff = dayDiff(today, loan.return_date);
    if (diff < 0) {
      reminders.push({
        id: `rem-eq-over-${loan.id}`,
        urgency: 'urgent',
        title: `Overdue by ${Math.abs(diff)} day${Math.abs(diff) === 1 ? '' : 's'} — Return ${loan.item_name}`,
        subtitle: `Due ${loan.return_date} (${loan.quantity} unit${loan.quantity > 1 ? 's' : ''})`,
        targetAction: { kind: 'tab', tab: 'equipment' },
      });
    } else if (diff === 0) {
      reminders.push({
        id: `rem-eq-today-${loan.id}`,
        urgency: 'warning',
        title: `Due Today — Return ${loan.item_name}`,
        subtitle: `Return by today (${loan.quantity} unit${loan.quantity > 1 ? 's' : ''})`,
        targetAction: { kind: 'tab', tab: 'equipment' },
      });
    } else if (diff <= 2) {
      reminders.push({
        id: `rem-eq-soon-${loan.id}`,
        urgency: 'warning',
        title: `Due in ${diff} day${diff === 1 ? '' : 's'} — ${loan.item_name}`,
        subtitle: `Return date: ${loan.return_date}`,
        targetAction: { kind: 'tab', tab: 'equipment' },
      });
    }
  }

  // 3. Upcoming Activities user is Attending (today .. +3 days)
  const upcomingAttending = budgets
    .filter((b) => b.status === 'Active' && b.event_date >= today && b.event_date <= maxUpcomingDate)
    .sort((a, b) => a.event_date.localeCompare(b.event_date));

  for (const ev of upcomingAttending) {
    const myRsvp = rsvps.find(
      (r) => r.budget_id === ev.id && r.user_id === profile.id && r.attendance === 'Attending'
    );
    if (!myRsvp) continue;

    const assignedDriver = myRsvp.assigned_driver_name
      ? rsvps.find((d) => d.budget_id === ev.id && d.is_driver && d.student_name === myRsvp.assigned_driver_name)
      : undefined;
    const carpoolNote = myRsvp.assigned_driver_name
      ? `Carpool: ${myRsvp.assigned_driver_name} • ${
          formatPickupTime(assignedDriver?.pickup_time) || 'Time TBA'
        } @ ${assignedDriver?.pickup_point || 'Meeting point TBA'}`
      : '';
    const diff = dayDiff(today, ev.event_date);
    const whenText = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : ev.event_date;

    reminders.push({
      id: `rem-ev-${ev.id}`,
      urgency: diff === 0 ? 'warning' : 'info',
      title: `${ev.event_name} (${whenText})`,
      subtitle: carpoolNote || `${ev.event_time || 'TBA'} · ${ev.location}`,
      targetAction: {
        kind: 'event',
        budget: ev,
        eventTab: myRsvp.assigned_driver_name ? 'transport' : 'pass',
      },
    });
  }

  // 4. Admin / Owner Pending Action Alerts
  if (isAdminOrOwner && permissions.can_manage_claims_fees) {
    const stage1Needed = claims.filter(
      (c) => c.status === 'Pending' && !c.treasurer_verified_by
    ).length;
    const stage2Needed = isOwner
      ? claims.filter(
          (c) =>
            c.status === 'Pending' &&
            Boolean(c.treasurer_verified_by) &&
            Number(c.amount) > claimThreshold
        ).length
      : 0;

    if (stage1Needed > 0) {
      reminders.push({
        id: 'rem-admin-claims-s1',
        urgency: 'warning',
        title: `${stage1Needed} claim${stage1Needed === 1 ? '' : 's'} awaiting review`,
        subtitle: 'Open Reimbursement Claims to review receipts',
        targetAction: { kind: 'tab', tab: 'claims' },
      });
    }
    if (stage2Needed > 0) {
      reminders.push({
        id: 'rem-owner-claims-s2',
        urgency: 'warning',
        title: `${stage2Needed} high-value claim${stage2Needed === 1 ? '' : 's'} ready for Owner approval`,
        subtitle: 'Treasurer already verified Stage 1',
        targetAction: { kind: 'tab', tab: 'claims' },
      });
    }

    const pendingFeeRows = feePayments.filter((f) => f.status === 'Pending');
    if (pendingFeeRows.length > 0) {
      const firstBudget = budgets.find((b) => b.id === pendingFeeRows[0].budget_id);
      reminders.push({
        id: 'rem-admin-pending-fees',
        urgency: 'warning',
        title: `${pendingFeeRows.length} fee receipt${pendingFeeRows.length === 1 ? '' : 's'} pending verification`,
        subtitle: firstBudget ? `Latest: ${firstBudget.event_name}` : 'Verify submitted fee slips',
        targetAction: firstBudget
          ? { kind: 'event', budget: firstBudget, eventTab: 'fee' }
          : { kind: 'tab', tab: 'activities' },
      });
    }
  }

  if (isAdminOrOwner && permissions.can_manage_equipment) {
    const pendingEqRequests = equipmentLoans.filter((l) => approvalOf(l) === 'Pending').length;
    const overdueMemberLoans = equipmentLoans.filter(
      (l) => l.status !== 'Returned' && approvalOf(l) === 'Approved' && Boolean(l.return_date) && l.return_date < today
    ).length;

    if (pendingEqRequests > 0) {
      reminders.push({
        id: 'rem-admin-eq-req',
        urgency: 'warning',
        title: `${pendingEqRequests} pending equipment borrow request${pendingEqRequests === 1 ? '' : 's'}`,
        subtitle: 'Approve or reject inside Equipment Borrowing',
        targetAction: { kind: 'tab', tab: 'equipment' },
      });
    }
    if (overdueMemberLoans > 0) {
      reminders.push({
        id: 'rem-admin-eq-over',
        urgency: 'urgent',
        title: `${overdueMemberLoans} overdue member equipment loan${overdueMemberLoans === 1 ? '' : 's'}`,
        subtitle: 'Follow up with borrowers in Equipment',
        targetAction: { kind: 'tab', tab: 'equipment' },
      });
    }
  }

  // 5. Dynamic Event Budget-Limit Reminders (80% near-limit / >=100% over budget)
  if (
    isAdminOrOwner &&
    (permissions.can_manage_finance || permissions.can_manage_claims_fees)
  ) {
    for (const ev of budgets) {
      if (ev.deleted_at || ev.status !== 'Active') continue;
      const alloc = Number(ev.allocated_amount || 0);
      if (alloc <= 0) continue;

      const approvedClaimsSum = claims
        .filter((c) => !c.deleted_at && c.status === 'Approved' && c.budget_id === ev.id)
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const pendingClaimsSum = claims
        .filter((c) => !c.deleted_at && c.status === 'Pending' && c.budget_id === ev.id)
        .reduce((s, c) => s + (Number(c.amount) || 0), 0);
      const approvedSpent = Math.max(Number(ev.spent_amount || 0), approvedClaimsSum);
      const committed = approvedSpent + pendingClaimsSum;
      const pct = Math.round((committed / alloc) * 100);

      if (pct >= 100) {
        reminders.push({
          id: `rem-budget-over-${ev.id}`,
          urgency: 'urgent',
          title: `Over Budget: ${ev.event_name}`,
          subtitle: `${pct}% committed (RM ${committed.toFixed(2)} / RM ${alloc.toFixed(2)}) — open Ledger`,
          targetAction: { kind: 'tab', tab: 'ledger' },
        });
      } else if (pct >= 80) {
        reminders.push({
          id: `rem-budget-near-${ev.id}`,
          urgency: 'warning',
          title: `Near Budget Limit: ${ev.event_name}`,
          subtitle: `${pct}% committed (RM ${committed.toFixed(2)} / RM ${alloc.toFixed(2)}) — review in Ledger`,
          targetAction: { kind: 'tab', tab: 'ledger' },
        });
      }
    }
  }

  return reminders;
}
