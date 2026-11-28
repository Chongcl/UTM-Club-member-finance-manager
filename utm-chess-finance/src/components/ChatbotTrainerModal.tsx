'use client';

import React, { useEffect, useRef, useState } from 'react';
import ModalShell from './ui/ModalShell';
import {
  LifeBuoy,
  X,
  Plus,
  HelpCircle,
  CheckCircle2,
  Trash2,
  Edit3,
  Power,
  Send,
  Inbox,
  BookOpen,
  Copy,
  Check,
  Database,
  Lock,
  Loader2,
} from 'lucide-react';
import { supabase, UserProfile, logActivity } from '@/lib/supabase';
import type { PublicFaqItem } from '@/lib/publicLanding';
import {
  ADMIN_TEMPLATE_VARS,
  ChatbotActionTab,
  ChatbotMatchResult,
  ChatbotPermissions,
  ChatbotRule,
  ChatbotSnapshot,
  PUBLIC_TEMPLATE_VARS,
  STARTER_KNOWLEDGE_PACK,
  UnansweredQueryItem,
  loadLocalChatbotRules,
  loadLocalUnanswered,
  matchChatbotQuery,
  resolveTemplateVariables,
  saveLocalChatbotRules,
  saveLocalUnanswered,
} from '@/lib/chatbotEngine';

export interface ChatbotTrainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rules: ChatbotRule[];
  onRulesChanged: (nextRules: ChatbotRule[]) => void;
  snapshot: ChatbotSnapshot;
  permissions: ChatbotPermissions;
  faqItems?: PublicFaqItem[];
  profile: UserProfile;
}

const ACTION_TAB_OPTIONS: { value: ChatbotActionTab; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'new_claim', label: 'New Claim' },
  { value: 'activities', label: 'Activities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'ledger', label: 'Ledger' },
  { value: 'claims', label: 'Claims' },
  { value: 'profile', label: 'My Profile' },
  { value: 'qr_scanner', label: 'Scan QR' },
  { value: 'members', label: 'Members' },
  { value: 'logs', label: 'Activity Logs' },
  { value: 'theme_studio', label: 'Theme Studio' },
  { value: 'public_page_editor', label: 'Public Page Editor' },
];

export default function ChatbotTrainerModal({
  isOpen,
  onClose,
  rules,
  onRulesChanged,
  snapshot,
  permissions,
  faqItems = [],
  profile,
}: ChatbotTrainerModalProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'inbox'>('rules');
  const [usingLocalRulesFallback, setUsingLocalRulesFallback] = useState(false);
  const [usingLocalInboxFallback, setUsingLocalInboxFallback] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Add / Edit Rule Form State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [trainingInboxId, setTrainingInboxId] = useState<string | null>(null);
  const [formQuestion, setFormQuestion] = useState('');
  const [formKeywords, setFormKeywords] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formAudience, setFormAudience] = useState<'all' | 'admin'>('all');
  const [formActionTab, setFormActionTab] = useState<ChatbotActionTab>('none');
  const [formQuickChip, setFormQuickChip] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [seedingPack, setSeedingPack] = useState(false);
  const answerRef = useRef<HTMLTextAreaElement | null>(null);

  // Live Test Chatbot Bar
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState<ChatbotMatchResult | null>(null);
  const [copiedTest, setCopiedTest] = useState(false);

  // Inbox State
  const [inboxItems, setInboxItems] = useState<UnansweredQueryItem[]>([]);
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<'open' | 'resolved' | 'all'>('open');

  const notifyBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner((prev) => (prev === msg ? null : prev)), 4000);
  };

  const fetchInbox = async () => {
    setLoadingInbox(true);
    try {
      const { data, error } = await supabase
        .from('chatbot_unanswered_queries')
        .select('*')
        .order('hit_count', { ascending: false })
        .order('last_asked_at', { ascending: false })
        .limit(100);
      if (error) {
        setUsingLocalInboxFallback(true);
        setInboxItems(loadLocalUnanswered());
      } else {
        setUsingLocalInboxFallback(false);
        setInboxItems((data || []) as UnansweredQueryItem[]);
      }
    } catch {
      setUsingLocalInboxFallback(true);
      setInboxItems(loadLocalUnanswered());
    } finally {
      setLoadingInbox(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setTestResult(null);
    void fetchInbox();
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const resetForm = () => {
    setEditingRuleId(null);
    setTrainingInboxId(null);
    setFormQuestion('');
    setFormKeywords('');
    setFormAnswer('');
    setFormAudience('all');
    setFormActionTab('none');
    setFormQuickChip(false);
    setEditorOpen(false);
  };

  const openNewForm = () => {
    setEditingRuleId(null);
    setTrainingInboxId(null);
    setFormQuestion('');
    setFormKeywords('');
    setFormAnswer('');
    setFormAudience('all');
    setFormActionTab('none');
    setFormQuickChip(false);
    setEditorOpen(true);
  };

  const openEditForm = (rule: ChatbotRule) => {
    setEditingRuleId(rule.id);
    setTrainingInboxId(null);
    setFormQuestion(rule.question);
    setFormKeywords((rule.keywords || []).join(', '));
    setFormAnswer(rule.answer);
    setFormAudience(rule.audience === 'admin' ? 'admin' : 'all');
    setFormActionTab(rule.action_tab || 'none');
    setFormQuickChip(Boolean(rule.is_quick_chip));
    setEditorOpen(true);
  };

  const handleInsertVariable = (token: string) => {
    const el = answerRef.current;
    if (!el) {
      setFormAnswer((prev) => (prev ? `${prev} ${token}` : token));
      return;
    }
    const start = el.selectionStart ?? formAnswer.length;
    const end = el.selectionEnd ?? formAnswer.length;
    const next = formAnswer.slice(0, start) + token + formAnswer.slice(end);
    setFormAnswer(next);
    setTimeout(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleRunTest = (e: React.FormEvent) => {
    e.preventDefault();
    const q = testQuery.trim();
    if (!q) return;
    const result = matchChatbotQuery(q, {
      customRules: rules,
      faqItems,
      snapshot,
      permissions,
    });
    setTestResult(result);
  };

  const markInboxResolved = async (id: string, resolved: boolean) => {
    if (!usingLocalInboxFallback) {
      const { error } = await supabase
        .from('chatbot_unanswered_queries')
        .update({ resolved })
        .eq('id', id);
      if (!error) {
        setInboxItems((prev) => prev.map((it) => (it.id === id ? { ...it, resolved } : it)));
        return;
      }
    }
    const nextLocal = inboxItems.map((it) => (it.id === id ? { ...it, resolved } : it));
    setInboxItems(nextLocal);
    saveLocalUnanswered(nextLocal);
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const qTrim = formQuestion.trim();
    const aTrim = formAnswer.trim();
    if (!qTrim || !aTrim) return;

    const kwList = formKeywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    setSavingRule(true);
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        question: qTrim,
        keywords: kwList,
        answer: aTrim,
        audience: formAudience,
        action_tab: formActionTab,
        is_quick_chip: formQuickChip,
        is_active: true,
        updated_at: nowIso,
      };

      let savedToSupabase = false;
      if (editingRuleId) {
        if (!editingRuleId.startsWith('local-')) {
          const { data, error } = await supabase
            .from('chatbot_knowledge')
            .update(payload)
            .eq('id', editingRuleId)
            .select()
            .maybeSingle();
          if (!error && data) {
            savedToSupabase = true;
            setUsingLocalRulesFallback(false);
            const updated = rules.map((r) => (r.id === editingRuleId ? (data as ChatbotRule) : r));
            onRulesChanged(updated);
            saveLocalChatbotRules(updated);
          }
        }
      } else {
        const { data, error } = await supabase
          .from('chatbot_knowledge')
          .insert({
            ...payload,
            created_by: `${profile.full_name} (${profile.matric_no})`,
          })
          .select()
          .maybeSingle();
        if (!error && data) {
          savedToSupabase = true;
          setUsingLocalRulesFallback(false);
          const nextList = [data as ChatbotRule, ...rules];
          onRulesChanged(nextList);
          saveLocalChatbotRules(nextList);
        }
      }

      if (!savedToSupabase) {
        setUsingLocalRulesFallback(true);
        const existingLocal = rules.length > 0 ? rules : loadLocalChatbotRules();
        let nextList: ChatbotRule[];
        if (editingRuleId) {
          nextList = existingLocal.map((r) =>
            r.id === editingRuleId ? { ...r, ...payload } : r
          );
        } else {
          const newLocal: ChatbotRule = {
            id: `local-${Date.now()}`,
            ...payload,
            created_by: `${profile.full_name} (${profile.matric_no})`,
            created_at: nowIso,
          };
          nextList = [newLocal, ...existingLocal];
        }
        onRulesChanged(nextList);
        saveLocalChatbotRules(nextList);
      }

      if (trainingInboxId) {
        await markInboxResolved(trainingInboxId, true);
      }

      void logActivity(
        profile,
        'Settings',
        editingRuleId ? 'Updated chatbot rule' : 'Added chatbot rule',
        `${profile.full_name} (${profile.matric_no}) saved rule "${qTrim}"`
      );
      resetForm();
      notifyBanner(
        savedToSupabase
          ? `Saved rule "${qTrim}" to Supabase.`
          : `Saved rule "${qTrim}" locally (run SQL migration to sync with all users).`
      );
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggleRuleActive = async (rule: ChatbotRule) => {
    const nextActive = !rule.is_active;
    const optimistic = rules.map((r) =>
      r.id === rule.id ? { ...r, is_active: nextActive } : r
    );
    onRulesChanged(optimistic);
    saveLocalChatbotRules(optimistic);

    if (!rule.id.startsWith('local-')) {
      const { error } = await supabase
        .from('chatbot_knowledge')
        .update({ is_active: nextActive, updated_at: new Date().toISOString() })
        .eq('id', rule.id);
      if (error) {
        setUsingLocalRulesFallback(true);
      }
    }
  };

  const handleDeleteRule = async (rule: ChatbotRule) => {
    const next = rules.filter((r) => r.id !== rule.id);
    onRulesChanged(next);
    saveLocalChatbotRules(next);
    if (!rule.id.startsWith('local-')) {
      await supabase.from('chatbot_knowledge').delete().eq('id', rule.id);
    }
    notifyBanner(`Deleted rule "${rule.question}".`);
  };

  const handleSeedStarterPack = async () => {
    setSeedingPack(true);
    try {
      const existingLower = new Set(rules.map((r) => r.question.trim().toLowerCase()));
      const missing = STARTER_KNOWLEDGE_PACK.filter(
        (item) => !existingLower.has(item.question.trim().toLowerCase())
      );
      if (missing.length === 0) {
        notifyBanner('All 5 Starter Pack rules already exist.');
        return;
      }

      const nowIso = new Date().toISOString();
      const rowsToInsert = missing.map((item) => ({
        ...item,
        created_by: `${profile.full_name} (${profile.matric_no})`,
        updated_at: nowIso,
      }));

      const { data, error } = await supabase
        .from('chatbot_knowledge')
        .insert(rowsToInsert)
        .select();

      if (!error && Array.isArray(data)) {
        setUsingLocalRulesFallback(false);
        const merged = [...(data as ChatbotRule[]), ...rules];
        onRulesChanged(merged);
        saveLocalChatbotRules(merged);
        notifyBanner(`Added ${data.length} Starter Pack rule(s) to Supabase!`);
      } else {
        setUsingLocalRulesFallback(true);
        const localNew: ChatbotRule[] = rowsToInsert.map((item, idx) => ({
          ...item,
          id: `local-seed-${Date.now()}-${idx}`,
          created_at: nowIso,
        }));
        const merged = [...localNew, ...rules];
        onRulesChanged(merged);
        saveLocalChatbotRules(merged);
        notifyBanner(`Added ${localNew.length} Starter Pack rule(s) locally.`);
      }
    } finally {
      setSeedingPack(false);
    }
  };

  const handleTrainFromInbox = (item: UnansweredQueryItem) => {
    const suggestedKeywords = item.query_text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .slice(0, 5)
      .join(', ');
    setEditingRuleId(null);
    setTrainingInboxId(item.id);
    setFormQuestion(item.query_text);
    setFormKeywords(suggestedKeywords);
    setFormAnswer('');
    setFormAudience('all');
    setFormActionTab('none');
    setFormQuickChip(false);
    setActiveTab('rules');
    setEditorOpen(true);
  };

  const filteredInbox = inboxItems.filter((item) => {
    if (inboxFilter === 'open') return !item.resolved;
    if (inboxFilter === 'resolved') return item.resolved;
    return true;
  });

  const openInboxCount = inboxItems.filter((i) => !i.resolved).length;

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      zIndexClass="z-[70]"
      maxWidthClass="max-w-4xl"
      ariaLabel="Help Desk & FAQ Manager"
    >
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <LifeBuoy className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold truncate">
                Help Desk &amp; FAQ Manager
              </h2>
              <p className="text-[11px] text-emerald-200 truncate">
                Zero external APIs • Dynamic live Supabase placeholders ({`{{...}}`})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 cursor-pointer"
            aria-label="Close Help Desk Manager"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-Tabs */}
        <div className="px-5 pt-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 cursor-pointer transition ${
                activeTab === 'rules'
                  ? 'border-emerald-600 text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="tabular-nums">Knowledge &amp; Rules ({rules.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('inbox');
                void fetchInbox();
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-xl border-b-2 cursor-pointer transition ${
                activeTab === 'inbox'
                  ? 'border-emerald-600 text-emerald-900 dark:text-emerald-300 bg-white dark:bg-slate-900'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>Unanswered Inbox</span>
              {openInboxCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold tabular-nums">
                  {openInboxCount}
                </span>
              )}
            </button>
          </div>

          <div className="pb-2 flex items-center gap-1.5 text-[11px]">
            {(usingLocalRulesFallback || usingLocalInboxFallback) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold">
                <Database className="w-3 h-3" />
                <span>Local Backup (Run SQL migration to sync)</span>
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {statusBanner && (
            <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusBanner}</span>
            </div>
          )}

          {activeTab === 'rules' ? (
            <>
              {/* Live Test Preview Bar */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/60 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <HelpCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Live Answer Preview</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Testing with live Supabase state ({snapshot.clubName})
                  </span>
                </div>
                <form onSubmit={handleRunTest} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={testQuery}
                    onChange={(e) => setTestQuery(e.target.value)}
                    placeholder="Type a sample question (e.g. What is our current club balance? or Budget for chess tournament)"
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Test</span>
                  </button>
                </form>

                {testResult && (
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[10px]">
                      <span className="font-extrabold uppercase tracking-wider text-emerald-700">
                        Matched: {testResult.matchedLabel || testResult.source}
                      </span>
                      <div className="flex items-center gap-2">
                        {testResult.actionTab && testResult.actionTab !== 'none' && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                            Action Button: {testResult.actionTab}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            await navigator.clipboard.writeText(testResult.reply);
                            setCopiedTest(true);
                            setTimeout(() => setCopiedTest(false), 1800);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                        >
                          {copiedTest ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedTest ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="whitespace-pre-line text-xs text-slate-800 leading-relaxed">
                      {testResult.reply}
                    </div>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-600">
                  Custom rules override or extend built-in portal guides and can include live variables.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={seedingPack}
                    onClick={() => void handleSeedStarterPack()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-500/25 text-indigo-900 dark:text-indigo-200 font-bold cursor-pointer disabled:opacity-60"
                  >
                    {seedingPack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                    <span>Load Starter FAQ Pack</span>
                  </button>
                  <button
                    type="button"
                    onClick={openNewForm}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Rule</span>
                  </button>
                </div>
              </div>

              {/* Add / Edit Rule Form */}
              {editorOpen && (
                <form
                  onSubmit={handleSaveRule}
                  className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/40 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-emerald-950">
                      {editingRuleId
                        ? 'Edit Custom Q&A Rule'
                        : trainingInboxId
                        ? 'Train Answer from Unanswered Query'
                        : 'New Custom Q&A Rule'}
                    </h3>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Question / Rule Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={formQuestion}
                        onChange={(e) => setFormQuestion(e.target.value)}
                        placeholder="e.g. What is our current club balance?"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Trigger Keywords (comma-separated)
                      </label>
                      <input
                        type="text"
                        value={formKeywords}
                        onChange={(e) => setFormKeywords(e.target.value)}
                        placeholder="e.g. balance summary, baki, tabung, cashflow"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Audience</label>
                      <select
                        value={formAudience}
                        onChange={(e) => setFormAudience(e.target.value as 'all' | 'admin')}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                      >
                        <option value="all">All Signed-In Users</option>
                        <option value="admin">Treasurers &amp; Admins Only</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        One-Click Action Button
                      </label>
                      <select
                        value={formActionTab}
                        onChange={(e) => setFormActionTab(e.target.value as ChatbotActionTab)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                      >
                        {ACTION_TAB_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formQuickChip}
                        onChange={(e) => setFormQuickChip(e.target.checked)}
                        className="rounded text-emerald-600"
                      />
                      <span className="font-bold text-slate-800">Pin as Quick Starter Chip</span>
                    </label>
                  </div>

                  {/* Clickable Dynamic Variable Picker */}
                  <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-extrabold text-slate-800">
                        Insert Live Dynamic Placeholder (auto-updates from Supabase):
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {PUBLIC_TEMPLATE_VARS.map((v) => (
                          <button
                            key={v.token}
                            type="button"
                            onClick={() => handleInsertVariable(v.token)}
                            title={v.description}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-mono text-[10px] font-bold cursor-pointer"
                          >
                            + {v.token}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                        {ADMIN_TEMPLATE_VARS.map((v) => (
                          <button
                            key={v.token}
                            type="button"
                            onClick={() => handleInsertVariable(v.token)}
                            title={`Admin Finance Variable: ${v.description}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-mono text-[10px] font-bold cursor-pointer"
                          >
                            <Lock className="w-2.5 h-2.5" />
                            <span>+ {v.token}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Answer Template *
                    </label>
                    <textarea
                      ref={answerRef}
                      required
                      rows={5}
                      value={formAnswer}
                      onChange={(e) => setFormAnswer(e.target.value)}
                      placeholder="Write your reply... Click any {{...}} chip above to insert live balances, events, or user claims."
                      className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs leading-relaxed"
                    />
                  </div>

                  {formAnswer.trim() && (
                    <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                        Live Resolved Preview
                      </div>
                      <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                        {resolveTemplateVariables(formAnswer, snapshot, permissions)}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingRule}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      {savingRule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>{editingRuleId ? 'Save Changes' : 'Save Rule'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Rules List */}
              {rules.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 space-y-2">
                  <p className="font-bold text-slate-700">No custom Q&amp;A rules yet.</p>
                  <p className="text-[11px]">
                    Built-in live portal intents already work automatically! Click{' '}
                    <strong>Seed Club Starter Pack</strong> or <strong>Add Custom Rule</strong> to customize replies.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`rounded-2xl border p-3.5 space-y-2 transition ${
                        rule.is_active
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-50 border-slate-200 opacity-70'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {rule.question}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                rule.audience === 'admin'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {rule.audience === 'admin' ? 'Admin Only' : 'All Users'}
                            </span>
                            {rule.is_quick_chip && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold">
                                Quick Chip
                              </span>
                            )}
                            {rule.action_tab && rule.action_tab !== 'none' && (
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                                → {rule.action_tab}
                              </span>
                            )}
                          </div>
                          {rule.keywords && rule.keywords.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {rule.keywords.map((kw, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold"
                                >
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void handleToggleRuleActive(rule)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer border ${
                              rule.is_active
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                            title={rule.is_active ? 'Disable rule' : 'Enable rule'}
                          >
                            <Power className="w-3 h-3" />
                            <span>{rule.is_active ? 'Active' : 'Paused'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditForm(rule)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="Edit rule"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRule(rule)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-2.5 whitespace-pre-line">
                        {resolveTemplateVariables(rule.answer, snapshot, permissions)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Tab 2: Unanswered Questions Inbox */
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
                  {(['open', 'resolved', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setInboxFilter(f)}
                      className={`px-3 py-1 rounded-lg font-bold capitalize cursor-pointer ${
                        inboxFilter === f ? 'bg-slate-900 text-white' : 'text-slate-600'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void fetchInbox()}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-700 cursor-pointer"
                >
                  Refresh Inbox
                </button>
              </div>

              {loadingInbox ? (
                <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Loading unanswered questions...</span>
                </div>
              ) : filteredInbox.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500">
                  No {inboxFilter === 'open' ? 'open ' : ''}unanswered questions logged yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredInbox.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="font-extrabold text-slate-900 text-sm break-words">
                          &ldquo;{item.query_text}&rdquo;
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                            Asked {item.hit_count}×
                          </span>
                          <span>Role: {item.user_role}</span>
                          <span>·</span>
                          <span>
                            Last asked:{' '}
                            {item.last_asked_at
                              ? new Date(item.last_asked_at).toLocaleString()
                              : '-'}
                          </span>
                          {item.resolved && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                              Resolved
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleTrainFromInbox(item)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Train Answer</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void markInboxResolved(item.id, !item.resolved)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold cursor-pointer"
                        >
                          {item.resolved ? 'Reopen' : 'Dismiss'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
