'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  TrendingUp,
  FileText,
  WifiOff,
  RotateCcw,
} from 'lucide-react';

export interface AiBudgetCopilotProps {
  role: 'member' | 'treasurer' | 'owner';
  financeContext: Record<string, unknown>;
}

export default function AiBudgetCopilot({ role, financeContext }: AiBudgetCopilotProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [replySource, setReplySource] = useState<'gemini' | 'local' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runPrompt = async (promptText: string, actionLabel: string) => {
    const clean = promptText.trim();
    if (!clean || loading) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setExpanded(true);
      setErrorMsg('You are offline. Reconnect to run live AI checks.');
      return;
    }

    setExpanded(true);
    setErrorMsg(null);
    setActiveAction(actionLabel);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: [],
          mode: 'budget',
          role,
          context: financeContext,
        }),
      });
      if (!res.ok) {
        throw new Error('Could not reach Finance Copilot.');
      }
      const data = (await res.json()) as {
        reply?: string;
        source?: 'gemini' | 'local';
      };
      setReply(data.reply || 'No response returned.');
      setReplySource(data.source === 'gemini' ? 'gemini' : 'local');
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to analyze budget right now.');
    } finally {
      setLoading(false);
      setActiveAction(null);
    }
  };

  const handleCopy = async () => {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore clipboard error */
    }
  };

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50/70 via-white to-teal-50/60 px-4 sm:px-5 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-2 text-left cursor-pointer group"
        >
          <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>AI Finance &amp; Budget Copilot</span>
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                Treasurer Tool
              </span>
            </div>
            <div className="text-[11px] text-slate-500 hidden sm:block">
              One-click cashflow audit, overspend alerts, and committee summary drafts
            </div>
          </div>
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runPrompt(
                'Audit club budget health: summarize net savings, cashflow, burn rate, and pending claims.',
                'health'
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 font-bold text-[11px] cursor-pointer disabled:opacity-60"
          >
            {loading && activeAction === 'health' ? (
              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
            ) : (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            )}
            <span>Audit Budget Health</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runPrompt(
                'Spot overspend risks across active activities, pending claims, and pre-claims.',
                'risk'
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-slate-800 font-bold text-[11px] cursor-pointer disabled:opacity-60"
          >
            {loading && activeAction === 'risk' ? (
              <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
            ) : (
              <ShieldAlert className="w-3 h-3 text-amber-600" />
            )}
            <span>Spot Overspend Risks</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              void runPrompt(
                'Draft a concise monthly finance summary ready to copy for our club committee meeting.',
                'summary'
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer disabled:opacity-60"
          >
            {loading && activeAction === 'summary' ? (
              <Loader2 className="w-3 h-3 animate-spin text-emerald-300" />
            ) : (
              <FileText className="w-3 h-3 text-emerald-300" />
            )}
            <span>Draft Monthly Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 cursor-pointer"
            aria-label={expanded ? 'Collapse Copilot' : 'Expand Copilot'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5">
          {errorMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
              <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading && (
            <div className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center gap-2 text-emerald-800 font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
              <span>Analyzing club cashflow &amp; event budgets...</span>
            </div>
          )}

          {!loading && reply && (
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  <Sparkles className="w-3 h-3" />
                  <span>{replySource === 'gemini' ? 'Gemini AI Analysis' : 'Finance Summary'}</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleCopy()}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReply(null)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-slate-700 text-[10px] font-bold cursor-pointer"
                    title="Clear result"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                {reply}
              </div>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runPrompt(question, 'custom');
              setQuestion('');
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask anything about club finances (e.g., How much cash vs bank do we have?)..."
              className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
