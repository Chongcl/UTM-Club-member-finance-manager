'use client';

import React from 'react';
import { ActivityLogEntry } from '@/lib/supabase';
import {
  TrackedTable,
  getRecordHistory,
  tableDisplayLabel,
} from '@/lib/history';
import { X, History, ArrowRight, Trash2, RotateCcw, Edit3, Clock } from 'lucide-react';

export interface HistoryModalTarget {
  table: TrackedTable;
  recordId: string;
  title: string;
}

interface RecordHistoryModalProps {
  target: HistoryModalTarget | null;
  logs: ActivityLogEntry[];
  onClose: () => void;
}

export default function RecordHistoryModal({
  target,
  logs,
  onClose,
}: RecordHistoryModalProps) {
  if (!target) return null;

  const events = getRecordHistory(target.table, target.recordId, logs);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-emerald-200 max-w-xl w-full overflow-hidden my-8"
      >
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <History className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold truncate">
                Edit &amp; Audit History — {target.title}
              </h3>
              <p className="text-[11px] text-slate-300">
                {tableDisplayLabel(target.table)} • Record ID:{' '}
                <span className="font-mono">{target.recordId.slice(0, 8)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white cursor-pointer"
            aria-label="Close history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[72vh] overflow-y-auto space-y-3 text-xs">
          {events.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-400">
              <Clock className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-bold text-slate-600">No edit history recorded yet.</p>
              <p>
                Whenever this record is edited or removed from the web view, every Before → After change is tracked here.
              </p>
            </div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        ev.action === 'deleted'
                          ? 'bg-rose-100 text-rose-700'
                          : ev.action === 'restored'
                          ? 'bg-sky-100 text-sky-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {ev.action === 'deleted' ? (
                        <Trash2 className="w-3 h-3" />
                      ) : ev.action === 'restored' ? (
                        <RotateCcw className="w-3 h-3" />
                      ) : (
                        <Edit3 className="w-3 h-3" />
                      )}
                      {ev.action}
                    </span>
                    <span className="font-extrabold text-slate-900">{ev.actorName}</span>
                    {ev.actorMatric && (
                      <span className="font-mono text-[11px] text-slate-500">
                        ({ev.actorMatric})
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {new Date(ev.timestamp).toLocaleString()}
                  </span>
                </div>

                {ev.changes.length > 0 ? (
                  <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                    {ev.changes.map((chg, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="font-bold text-slate-700">{chg.field}</span>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 line-through">
                            {chg.before}
                          </span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold">
                            {chg.after}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-600">{ev.summary}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
