'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  supabase,
  UserProfile,
  Budget,
  EventRsvp,
  ActivityFeePayment,
  Claim,
  EquipmentLoan,
  AdminPermissions,
  ClubNotificationItem,
} from '@/lib/supabase';
import { buildLiveReminders, LiveReminderItem } from '@/lib/notifications';
import {
  Bell,
  Calendar,
  Package,
  Receipt,
  CreditCard,
  Megaphone,
  BarChart2,
  Car,
  MessageCircle,
  CheckCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface NotificationBellProps {
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
  notifications: ClubNotificationItem[];
  unreadChatCount: number;
  darkMode?: boolean;
  onNavigateTab: (tab: 'activities' | 'equipment' | 'claims' | 'ledger') => void;
  onOpenEventOps: (budget: Budget, tab: 'pass' | 'transport' | 'fee') => void;
  onOpenChat: () => void;
  onMarkedRead: (newReadIso: string) => void;
}

function relativeTimeLabel(iso: string): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function NotificationTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'activity':
      return <Calendar className="w-3.5 h-3.5 text-emerald-700" />;
    case 'announcement':
      return <Megaphone className="w-3.5 h-3.5 text-indigo-700" />;
    case 'poll':
      return <BarChart2 className="w-3.5 h-3.5 text-sky-700" />;
    case 'equipment':
      return <Package className="w-3.5 h-3.5 text-amber-700" />;
    case 'claim':
      return <Receipt className="w-3.5 h-3.5 text-emerald-700" />;
    case 'fee':
      return <CreditCard className="w-3.5 h-3.5 text-teal-700" />;
    case 'carpool':
      return <Car className="w-3.5 h-3.5 text-sky-700" />;
    default:
      return <Bell className="w-3.5 h-3.5 text-slate-600" />;
  }
}

export default function NotificationBell({
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
  notifications,
  unreadChatCount,
  darkMode = false,
  onNavigateTab,
  onOpenEventOps,
  onOpenChat,
  onMarkedRead,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'reminders' | 'updates'>('all');
  const [markingRead, setMarkingRead] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const reminders = useMemo(
    () =>
      buildLiveReminders({
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
      }),
    [
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
    ]
  );

  const readCutoffMs = profile.notifications_read_at
    ? new Date(profile.notifications_read_at).getTime()
    : 0;

  const unreadUpdatesCount = useMemo(
    () =>
      notifications.filter((n) => {
        const ts = new Date(n.created_at).getTime();
        return !isNaN(ts) && ts > readCutoffMs;
      }).length,
    [notifications, readCutoffMs]
  );

  const urgentReminderCount = reminders.filter((r) => r.urgency !== 'info').length + (unreadChatCount > 0 ? 1 : 0);
  const totalBadgeCount = urgentReminderCount + unreadUpdatesCount;
  const hasUrgent = reminders.some((r) => r.urgency === 'urgent');

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      const nowIso = new Date().toISOString();
      await supabase
        .from('users')
        .update({ notifications_read_at: nowIso })
        .eq('id', profile.id);
      onMarkedRead(nowIso);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleReminderClick = (rem: LiveReminderItem) => {
    setOpen(false);
    if (rem.targetAction.kind === 'chat') {
      onOpenChat();
    } else if (rem.targetAction.kind === 'event') {
      onOpenEventOps(rem.targetAction.budget, rem.targetAction.eventTab);
    } else {
      onNavigateTab(rem.targetAction.tab);
    }
  };

  const handleUpdateClick = (n: ClubNotificationItem) => {
    setOpen(false);
    if (n.target_tab === 'equipment') onNavigateTab('equipment');
    else if (n.target_tab === 'claims') onNavigateTab('claims');
    else if (n.target_tab === 'ledger') onNavigateTab('ledger');
    else onNavigateTab('activities');
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-xl border transition cursor-pointer ${
          darkMode
            ? 'bg-white/10 border-white/15 text-slate-100 hover:bg-white/15'
            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
        }`}
        aria-label="Reminders & Updates"
        title="Reminders & Updates"
      >
        <Bell className="w-4 h-4" />
        {totalBadgeCount > 0 && (
          <span
            className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center shadow ${
              hasUrgent ? 'bg-rose-600' : 'bg-amber-500 text-slate-950'
            }`}
          >
            {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full sm:mt-2 w-96 max-w-[calc(100vw-1.5rem)] max-h-[75vh] overflow-y-auto rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 z-50">
          {/* Header */}
          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-white/10 px-4 py-3 space-y-2.5 z-10">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span className="text-sm font-bold">
                  Reminders &amp; Updates
                </span>
              </div>
              <button
                type="button"
                disabled={markingRead || unreadUpdatesCount === 0}
                onClick={() => void handleMarkAllRead()}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 disabled:opacity-40 cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[11px] font-bold tabular-nums">
              {(
                [
                  { id: 'all', label: `All (${reminders.length + notifications.length})` },
                  { id: 'reminders', label: `Reminders (${reminders.length})` },
                  { id: 'updates', label: `Updates (${notifications.length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setFilterTab(t.id)}
                  className={`flex-1 py-1.5 px-2 rounded-lg cursor-pointer transition ${
                    filterTab === t.id
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {/* Live Smart Reminders */}
            {(filterTab === 'all' || filterTab === 'reminders') && (
              <div className="p-3 space-y-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  Reminders &amp; Upcoming
                </div>
                {reminders.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1 py-2">
                    No urgent reminders or upcoming items right now.
                  </p>
                ) : (
                  reminders.map((rem) => (
                    <button
                      key={rem.id}
                      type="button"
                      onClick={() => handleReminderClick(rem)}
                      className={`w-full text-left p-2.5 rounded-xl border transition flex items-start gap-2.5 cursor-pointer ${
                        rem.urgency === 'urgent'
                          ? 'bg-rose-50/80 border-rose-200 hover:bg-rose-100/70'
                          : rem.urgency === 'warning'
                          ? 'bg-amber-50/80 border-amber-200 hover:bg-amber-100/70'
                          : 'bg-emerald-50/60 border-emerald-200 hover:bg-emerald-100/60'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {rem.id === 'rem-unread-chat' ? (
                          <MessageCircle className="w-4 h-4 text-emerald-700" />
                        ) : rem.urgency === 'urgent' ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-slate-900 leading-snug">
                          {rem.title}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          {rem.subtitle}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Club Notification Feed */}
            {(filterTab === 'all' || filterTab === 'updates') && (
              <div className="p-3 space-y-1.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  Recent Club Updates
                </div>
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 px-1 py-4 text-center">
                    No updates yet.
                  </p>
                ) : (
                  notifications.map((n) => {
                    const isUnread = new Date(n.created_at).getTime() > readCutoffMs;
                    return (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => handleUpdateClick(n)}
                        className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 cursor-pointer ${
                          isUnread ? 'bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                          <NotificationTypeIcon type={n.type} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`text-xs leading-snug ${
                                isUnread ? 'font-extrabold text-slate-900' : 'font-semibold text-slate-800'
                              }`}
                            >
                              {n.title}
                            </span>
                            {isUnread && (
                              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1" />
                            )}
                          </div>
                          {n.body && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-snug">
                              {n.body}
                            </p>
                          )}
                          <div className="text-[10px] text-slate-400 mt-1">
                            {n.actor_name ? `${n.actor_name} · ` : ''}
                            {relativeTimeLabel(n.created_at)}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
