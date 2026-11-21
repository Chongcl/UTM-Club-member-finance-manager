'use client';

import React, { useState } from 'react';
import { ActivityLogEntry, ActivityLogCategory, UserProfile } from '@/lib/supabase';
import {
  stripHistoryTag,
  parseHistoryMetaFromLog,
  getAllHistoryEvents,
  restoreSoftDeletedRecord,
  tableDisplayLabel,
  SoftDeletedItem,
} from '@/lib/history';
import {
  ShieldCheck,
  Search,
  Download,
  RefreshCw,
  Clock,
  Wallet,
  Receipt,
  CreditCard,
  Package,
  Calendar,
  Users,
  Car,
  QrCode,
  Settings,
  History,
  RotateCcw,
  Trash2,
  ArrowRight,
  Loader2,
} from 'lucide-react';

interface ActivityLogSectionProps {
  logs: ActivityLogEntry[];
  deletedRecords?: SoftDeletedItem[];
  profile?: UserProfile;
  onRefresh: (msg: string) => void;
}

const CATEGORIES: ('ALL' | ActivityLogCategory)[] = [
  'ALL',
  'Finance',
  'Claims',
  'Fees',
  'Equipment',
  'Activities',
  'Carpool',
  'Attendance',
  'Members',
  'Settings',
];

function categoryStyle(cat: string) {
  switch (cat) {
    case 'Finance':
      return { pill: 'bg-emerald-100 text-emerald-900 border-emerald-200', Icon: Wallet };
    case 'Claims':
      return { pill: 'bg-indigo-100 text-indigo-900 border-indigo-200', Icon: Receipt };
    case 'Fees':
      return { pill: 'bg-amber-100 text-amber-900 border-amber-200', Icon: CreditCard };
    case 'Equipment':
      return { pill: 'bg-sky-100 text-sky-900 border-sky-200', Icon: Package };
    case 'Activities':
      return { pill: 'bg-teal-100 text-teal-900 border-teal-200', Icon: Calendar };
    case 'Carpool':
      return { pill: 'bg-purple-100 text-purple-900 border-purple-200', Icon: Car };
    case 'Attendance':
      return { pill: 'bg-cyan-100 text-cyan-900 border-cyan-200', Icon: QrCode };
    case 'Members':
      return { pill: 'bg-rose-100 text-rose-900 border-rose-200', Icon: Users };
    default:
      return { pill: 'bg-slate-100 text-slate-800 border-slate-200', Icon: Settings };
  }
}

function formatLogTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ActivityLogSection({ logs, deletedRecords = [], profile, onRefresh }: ActivityLogSectionProps) {
  const [viewMode, setViewMode] = useState<'all' | 'edits' | 'deleted'>('all');
  const [catFilter, setCatFilter] = useState<'ALL' | ActivityLogCategory>('ALL');
  const [search, setSearch] = useState('');
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  const allEditEvents = getAllHistoryEvents(logs).filter((ev) => ev.action === 'edited');
  const currentlyDeleted = deletedRecords;

  const matchesSearch = (parts: (string | undefined | null)[]) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return parts.some((p) => p?.toLowerCase().includes(q));
  };

  const filtered = logs.filter((l) => {
    if (catFilter !== 'ALL' && l.category !== catFilter) return false;
    const cleanDetails = stripHistoryTag(l.details || '');
    return matchesSearch([l.actor_name, l.actor_matric, l.action, cleanDetails, l.category]);
  });

  const filteredEdits = allEditEvents.filter((ev) => {
    if (catFilter !== 'ALL' && ev.category !== catFilter) return false;
    return matchesSearch([
      ev.actorName,
      ev.actorMatric,
      ev.recordTitle,
      tableDisplayLabel(ev.table),
      ev.summary,
      ...ev.changes.flatMap((c) => [c.field, c.before, c.after]),
    ]);
  });

  const filteredDeleted = currentlyDeleted.filter((item) => {
    if (catFilter !== 'ALL' && item.category !== catFilter) return false;
    return matchesSearch([
      item.deletedBy,
      item.title,
      tableDisplayLabel(item.table),
    ]);
  });

  const handleExportCsv = () => {
    const headers = ['Timestamp', 'Actor', 'Matric No', 'Role', 'Category', 'Action', 'Details'];
    const rows = filtered.map((l) => [
      l.created_at,
      l.actor_name,
      l.actor_matric || '-',
      l.actor_role || '-',
      l.category,
      l.action,
      stripHistoryTag(l.details || ''),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `ClubSync_Security_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5 text-slate-900">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-emerald-200/80 p-5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900">Security, Edit History &amp; Audit Log</h2>
            <p className="text-xs text-slate-500">
              Tamper-evident Before → After edit history and web-deleted archive (records stay intact in Supabase).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, matric, action..."
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs w-52"
            />
          </div>
          <button
            type="button"
            onClick={() => onRefresh('Refreshed audit log.')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* View mode switcher */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode('all')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold border cursor-pointer transition ${
            viewMode === 'all'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
              : 'bg-white/90 text-slate-700 border-emerald-200/80 hover:bg-emerald-50'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>All Logs ({logs.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('edits')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold border cursor-pointer transition ${
            viewMode === 'edits'
              ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
              : 'bg-white/90 text-slate-700 border-emerald-200/80 hover:bg-amber-50'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Edit History (Before → After) ({allEditEvents.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('deleted')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-extrabold border cursor-pointer transition ${
            viewMode === 'deleted'
              ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
              : 'bg-white/90 text-slate-700 border-emerald-200/80 hover:bg-rose-50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Deleted Records (Kept in Supabase) ({currentlyDeleted.length})</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 bg-white/85 backdrop-blur-xl p-2 rounded-2xl border border-emerald-200/80 text-xs">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            key={c}
            onClick={() => setCatFilter(c)}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition ${
              catFilter === c ? 'bg-emerald-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {c === 'ALL' ? `All (${logs.length})` : c}
          </button>
        ))}
      </div>

      {viewMode === 'all' && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-emerald-200/80 overflow-hidden shadow-2xs">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-xs text-slate-400">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-600">No audit entries match this filter yet.</p>
              <p>New actions (approving claims, updating savings, paying fees, borrowing equipment, assigning carpool, etc.) will appear here automatically.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((entry) => {
                const { pill, Icon } = categoryStyle(entry.category);
                const meta = parseHistoryMetaFromLog(entry);
                const cleanDetails = stripHistoryTag(entry.details || '');
                return (
                  <div key={entry.id} className="p-4 hover:bg-slate-50/80 flex flex-wrap items-start justify-between gap-3 text-xs">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${pill}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${pill}`}>
                            {entry.category}
                          </span>
                          <span className="font-extrabold text-slate-900">{entry.action}</span>
                          {meta && (
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                                meta.action === 'deleted'
                                  ? 'bg-rose-100 text-rose-800'
                                  : meta.action === 'restored'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {tableDisplayLabel(meta.table)} · {meta.action}
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">•</span>
                          <span className="font-bold text-emerald-800">
                            {entry.actor_role ? `${entry.actor_role} ` : ''}
                            {entry.actor_name}
                            {entry.actor_matric ? ` (${entry.actor_matric})` : ''}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed break-words">{cleanDetails}</p>
                        {meta && meta.changes.length > 0 && (
                          <div className="mt-1.5 grid sm:grid-cols-2 gap-1.5 pt-1">
                            {meta.changes.map((chg, idx) => (
                              <div
                                key={`${entry.id}-chg-${idx}`}
                                className="flex flex-wrap items-center gap-1.5 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2 py-1 text-[11px]"
                              >
                                <span className="font-extrabold text-slate-700">{chg.field}:</span>
                                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 line-through break-all">
                                  {chg.before}
                                </span>
                                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold break-all">
                                  {chg.after}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 shrink-0">{formatLogTime(entry.created_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'edits' && (
        <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-amber-200/80 overflow-hidden shadow-2xs">
          {filteredEdits.length === 0 ? (
            <div className="p-10 text-center space-y-2 text-xs text-slate-400">
              <History className="w-8 h-8 text-amber-300 mx-auto" />
              <p className="font-bold text-slate-600">No tracked edits recorded yet.</p>
              <p>Whenever anyone edits a claim, fee, equipment item/loan, activity, carpool, ledger entry, or announcement, exact Before → After changes appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEdits.map((ev) => {
                const { pill } = categoryStyle(ev.category);
                return (
                  <div key={ev.id} className="p-4 hover:bg-amber-50/30 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${pill}`}>
                          {tableDisplayLabel(ev.table)}
                        </span>
                        <span className="font-extrabold text-slate-900">{ev.recordTitle}</span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="font-bold text-emerald-800">
                          {ev.actorRole ? `${ev.actorRole} ` : ''}
                          {ev.actorName}
                          {ev.actorMatric ? ` (${ev.actorMatric})` : ''}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400">{formatLogTime(ev.timestamp)}</span>
                    </div>
                    <p className="text-slate-600">{ev.summary}</p>
                    {ev.changes.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-1.5 pt-1">
                        {ev.changes.map((chg, idx) => (
                          <div
                            key={`${ev.id}-e-${idx}`}
                            className="flex flex-wrap items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px]"
                          >
                            <span className="font-extrabold text-slate-700">{chg.field}:</span>
                            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 line-through break-all">
                              {chg.before}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold break-all">
                              {chg.after}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {viewMode === 'deleted' && (
        <div className="space-y-3">
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <p>
              <strong>Web-Only Soft Delete Archive:</strong> Records deleted in ClubSync are hidden from dashboard tabs, calculations, and lists while their database rows remain stored safely in Supabase (until you manually delete them in Supabase Table Editor). You can restore any item back to the web anytime.
            </p>
          </div>
          <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-rose-200/80 overflow-hidden shadow-2xs">
            {filteredDeleted.length === 0 ? (
              <div className="p-10 text-center space-y-2 text-xs text-slate-400">
                <Trash2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-600">No soft-deleted records right now.</p>
                <p>Items deleted from any module will show up here for traceability and optional restoration.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredDeleted.map((item) => {
                  const rowKey = `${item.table}:${item.recordId}`;
                  const isRestoring = restoringKey === rowKey;
                  const canRestore = Boolean(
                    profile && (profile.role === 'owner' || profile.role === 'treasurer')
                  );
                  return (
                    <div key={rowKey} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-rose-50/30">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-rose-100 text-rose-900 border border-rose-200">
                            {tableDisplayLabel(item.table)}
                          </span>
                          <span className="font-extrabold text-slate-900">{item.title}</span>
                          <span className="text-[11px] font-mono text-slate-400">ID: {item.recordId.slice(0, 8)}</span>
                        </div>
                        <p className="text-slate-600 break-words">
                          Hidden by{' '}
                          <span className="font-bold text-slate-800">{item.deletedBy || 'Admin'}</span>{' '}
                          at {formatLogTime(item.deletedAt)}
                        </p>
                      </div>
                      {canRestore && (
                        <button
                          type="button"
                          disabled={isRestoring}
                          onClick={async () => {
                            if (!profile) return;
                            setRestoringKey(rowKey);
                            try {
                              await restoreSoftDeletedRecord({
                                actor: profile,
                                category: item.category,
                                table: item.table,
                                recordId: item.recordId,
                                recordTitle: item.title,
                              });
                              onRefresh(`Restored ${tableDisplayLabel(item.table)} "${item.title}" back to web view.`);
                            } finally {
                              setRestoringKey(null);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-60 shrink-0"
                        >
                          {isRestoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          <span>Restore to Web</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
