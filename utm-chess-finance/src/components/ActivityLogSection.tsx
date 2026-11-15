'use client';

import React, { useState } from 'react';
import { ActivityLogEntry, ActivityLogCategory } from '@/lib/supabase';
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
} from 'lucide-react';

interface ActivityLogSectionProps {
  logs: ActivityLogEntry[];
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

export default function ActivityLogSection({ logs, onRefresh }: ActivityLogSectionProps) {
  const [catFilter, setCatFilter] = useState<'ALL' | ActivityLogCategory>('ALL');
  const [search, setSearch] = useState('');

  const filtered = logs.filter((l) => {
    if (catFilter !== 'ALL' && l.category !== catFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.actor_name?.toLowerCase().includes(q) ||
        l.actor_matric?.toLowerCase().includes(q) ||
        l.action?.toLowerCase().includes(q) ||
        l.details?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q)
      );
    }
    return true;
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
      l.details,
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
            <h2 className="text-base font-extrabold text-slate-900">Security &amp; Activity Audit Log</h2>
            <p className="text-xs text-slate-500">
              Tamper-evident trail of who did what and when across finance, claims, fees, equipment, carpool and settings.
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
              return (
                <div key={entry.id} className="p-4 hover:bg-slate-50/80 flex flex-wrap items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${pill}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase border ${pill}`}>
                          {entry.category}
                        </span>
                        <span className="font-extrabold text-slate-900">{entry.action}</span>
                        <span className="text-[11px] text-slate-400">•</span>
                        <span className="font-bold text-emerald-800">
                          {entry.actor_role ? `${entry.actor_role} ` : ''}
                          {entry.actor_name}
                          {entry.actor_matric ? ` (${entry.actor_matric})` : ''}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed break-words">{entry.details}</p>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 shrink-0">{formatLogTime(entry.created_at)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
