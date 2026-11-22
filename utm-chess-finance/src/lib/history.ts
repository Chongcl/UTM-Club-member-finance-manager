import {
  supabase,
  ActivityLogEntry,
  ActivityLogCategory,
  logActivity,
} from '@/lib/supabase';

export type TrackedTable =
  | 'budgets'
  | 'claims'
  | 'pre_claims'
  | 'public_guest_registrations'
  | 'activity_fee_payments'
  | 'equipment_items'
  | 'equipment_loans'
  | 'ledger_entries'
  | 'announcements'
  | 'polls'
  | 'event_rsvps';

export interface FieldChange {
  field: string;
  before: string;
  after: string;
}

export interface RecordHistoryEvent {
  id: string;
  table: TrackedTable;
  recordId: string;
  recordTitle: string;
  category: ActivityLogCategory | string;
  action: 'edited' | 'deleted' | 'restored';
  actorName: string;
  actorMatric: string;
  actorRole: string;
  timestamp: string;
  summary: string;
  changes: FieldChange[];
}

export interface HistoryActor {
  id: string;
  full_name: string;
  matric_no?: string;
  role?: string;
}

interface StoredMetaPayload {
  t: TrackedTable;
  id: string;
  title: string;
  cat: string;
  act: 'edited' | 'deleted' | 'restored';
  changes?: FieldChange[];
}

export interface SoftDeletedItem {
  table: TrackedTable;
  recordId: string;
  title: string;
  deletedAt: string;
  deletedBy: string;
  category: ActivityLogCategory;
}

const HISTORY_STORAGE_KEY = 'clubsync_record_history_v1';
const META_MARKER = '[HIST_META:';

function formatFieldVal(v: unknown): string {
  if (v === null || v === undefined) return '(empty)';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v).trim();
  return s === '' ? '(empty)' : s;
}

export function computeFieldChanges(
  pairs: { field: string; before: unknown; after: unknown }[]
): FieldChange[] {
  const out: FieldChange[] = [];
  for (const p of pairs) {
    const b = formatFieldVal(p.before);
    const a = formatFieldVal(p.after);
    if (b !== a) {
      out.push({ field: p.field, before: b, after: a });
    }
  }
  return out;
}

export function stripHistoryTag(text: string): string {
  const idx = text.indexOf(META_MARKER);
  if (idx === -1) return text;
  return text.slice(0, idx).trim();
}

function readLocalHistory(): RecordHistoryEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RecordHistoryEvent[]) : [];
  } catch {
    return [];
  }
}

function saveLocalHistoryEvent(ev: RecordHistoryEvent) {
  if (typeof window === 'undefined') return;
  try {
    const existing = readLocalHistory();
    const next = [ev, ...existing.filter((x) => x.id !== ev.id)].slice(0, 600);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function parseHistoryMetaFromLog(log: ActivityLogEntry): RecordHistoryEvent | null {
  const details = log.details || '';
  const start = details.indexOf(META_MARKER);
  if (start === -1) return null;
  const end = details.lastIndexOf(']');
  if (end <= start + META_MARKER.length) return null;
  const jsonStr = details.slice(start + META_MARKER.length, end);
  try {
    const meta = JSON.parse(jsonStr) as StoredMetaPayload;
    if (!meta || !meta.t || !meta.id) return null;
    return {
      id: `log-${log.id}`,
      table: meta.t,
      recordId: meta.id,
      recordTitle: meta.title || 'Record',
      category: meta.cat || log.category,
      action: meta.act || 'edited',
      actorName: log.actor_name || 'Member',
      actorMatric: log.actor_matric || '',
      actorRole: log.actor_role || 'Member',
      timestamp: log.created_at,
      summary: stripHistoryTag(details),
      changes: Array.isArray(meta.changes) ? meta.changes : [],
    };
  } catch {
    return null;
  }
}

export function tableDisplayLabel(table: TrackedTable): string {
  const labels: Record<TrackedTable, string> = {
    budgets: 'Activity / Event',
    claims: 'Claim / Reimbursement',
    pre_claims: 'Pre-Claim / Cash Advance',
    public_guest_registrations: 'Guest Registration',
    activity_fee_payments: 'Fee Payment',
    equipment_items: 'Equipment Item',
    equipment_loans: 'Equipment Borrowing',
    ledger_entries: 'Finance Ledger',
    announcements: 'Announcement / Poster',
    polls: 'Club Poll',
    event_rsvps: 'Carpool / RSVP',
  };
  return labels[table] || table;
}

export async function recordEditHistory(params: {
  actor: HistoryActor | null | undefined;
  category: ActivityLogCategory;
  table: TrackedTable;
  recordId: string;
  recordTitle: string;
  changes: FieldChange[];
}): Promise<void> {
  const { actor, category, table, recordId, recordTitle, changes } = params;
  if (!actor || !recordId || changes.length === 0) return;

  const actorLabel = `${actor.full_name}${actor.matric_no ? ` (${actor.matric_no})` : ''}`;
  const diffText = changes.map((c) => `${c.field}: ${c.before} -> ${c.after}`).join(' | ');
  const summary = `${actorLabel} edited ${tableDisplayLabel(table)} "${recordTitle}": ${diffText}`;
  const roleLabel = actor.role === 'owner' ? 'Owner' : actor.role === 'treasurer' ? 'Admin' : 'Member';
  const nowIso = new Date().toISOString();

  const meta: StoredMetaPayload = {
    t: table,
    id: recordId,
    title: recordTitle,
    cat: category,
    act: 'edited',
    changes,
  };

  saveLocalHistoryEvent({
    id: `local-${table}-${recordId}-${Date.now()}`,
    table,
    recordId,
    recordTitle,
    category,
    action: 'edited',
    actorName: actor.full_name,
    actorMatric: actor.matric_no || '',
    actorRole: roleLabel,
    timestamp: nowIso,
    summary,
    changes,
  });

  await logActivity(
    actor,
    category,
    `${tableDisplayLabel(table)} edited`,
    `${summary} ${META_MARKER}${JSON.stringify(meta)}]`
  );
}

/**
 * Hides a record from the web UI via `deleted_at` while keeping its row in Supabase unless manually deleted in Supabase.
 */
export async function softDeleteRecord(params: {
  actor: HistoryActor | null | undefined;
  category: ActivityLogCategory;
  table: TrackedTable;
  recordId: string;
  recordTitle: string;
  extraSummary?: string;
}): Promise<void> {
  const { actor, category, table, recordId, recordTitle, extraSummary } = params;
  if (!recordId) return;

  const actorLabel = actor ? `${actor.full_name}${actor.matric_no ? ` (${actor.matric_no})` : ''}` : 'System';
  const nowIso = new Date().toISOString();

  await supabase
    .from(table)
    .update({ deleted_at: nowIso, deleted_by: actorLabel })
    .eq('id', recordId);

  if (actor) {
    const roleLabel = actor.role === 'owner' ? 'Owner' : actor.role === 'treasurer' ? 'Admin' : 'Member';
    const summary = `${actorLabel} removed ${tableDisplayLabel(table)} "${recordTitle}" from web view (record preserved in Supabase)${
      extraSummary ? ` — ${extraSummary}` : ''
    }`;
    const meta: StoredMetaPayload = {
      t: table,
      id: recordId,
      title: recordTitle,
      cat: category,
      act: 'deleted',
      changes: [],
    };

    saveLocalHistoryEvent({
      id: `local-del-${table}-${recordId}-${Date.now()}`,
      table,
      recordId,
      recordTitle,
      category,
      action: 'deleted',
      actorName: actor.full_name,
      actorMatric: actor.matric_no || '',
      actorRole: roleLabel,
      timestamp: nowIso,
      summary,
      changes: [],
    });

    await logActivity(
      actor,
      category,
      `${tableDisplayLabel(table)} hidden (Web Delete)`,
      `${summary} ${META_MARKER}${JSON.stringify(meta)}]`
    );
  }
}

export async function restoreSoftDeletedRecord(params: {
  actor: HistoryActor | null | undefined;
  category: ActivityLogCategory;
  table: TrackedTable;
  recordId: string;
  recordTitle: string;
}): Promise<void> {
  const { actor, category, table, recordId, recordTitle } = params;
  if (!recordId) return;

  await supabase
    .from(table)
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', recordId);

  if (actor) {
    const actorLabel = `${actor.full_name}${actor.matric_no ? ` (${actor.matric_no})` : ''}`;
    const roleLabel = actor.role === 'owner' ? 'Owner' : actor.role === 'treasurer' ? 'Admin' : 'Member';
    const summary = `${actorLabel} restored ${tableDisplayLabel(table)} "${recordTitle}" back to web view`;
    const meta: StoredMetaPayload = {
      t: table,
      id: recordId,
      title: recordTitle,
      cat: category,
      act: 'restored',
      changes: [],
    };

    saveLocalHistoryEvent({
      id: `local-res-${table}-${recordId}-${Date.now()}`,
      table,
      recordId,
      recordTitle,
      category,
      action: 'restored',
      actorName: actor.full_name,
      actorMatric: actor.matric_no || '',
      actorRole: roleLabel,
      timestamp: new Date().toISOString(),
      summary,
      changes: [],
    });

    await logActivity(
      actor,
      category,
      `${tableDisplayLabel(table)} restored`,
      `${summary} ${META_MARKER}${JSON.stringify(meta)}]`
    );
  }
}

export function filterActiveRecords<T extends { id: string }>(
  _table: TrackedTable,
  rows: T[],
  _logs?: ActivityLogEntry[]
): T[] {
  return rows.filter((row) => {
    const r = row as unknown as { deleted_at?: string | null; is_deleted?: boolean };
    return !r.deleted_at && r.is_deleted !== true;
  });
}

export function getRecordHistory(
  table: TrackedTable,
  recordId: string,
  logs: ActivityLogEntry[]
): RecordHistoryEvent[] {
  const events: RecordHistoryEvent[] = [];
  const seenSig = new Set<string>();

  const addUnique = (ev: RecordHistoryEvent) => {
    // Deduplicate identical log + localStorage copy created within 5 seconds
    const tsBucket = Math.floor((new Date(ev.timestamp).getTime() || 0) / 5000);
    const sig = `${ev.table}|${ev.recordId}|${ev.action}|${ev.actorName}|${tsBucket}|${JSON.stringify(ev.changes)}`;
    if (seenSig.has(sig)) return;
    seenSig.add(sig);
    events.push(ev);
  };

  for (const log of logs) {
    const parsed = parseHistoryMetaFromLog(log);
    if (parsed && parsed.table === table && parsed.recordId === recordId) {
      addUnique(parsed);
    }
  }

  for (const ev of readLocalHistory()) {
    if (ev.table === table && ev.recordId === recordId) {
      addUnique(ev);
    }
  }

  return events.sort(
    (a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
  );
}

export function getAllHistoryEvents(logs: ActivityLogEntry[]): RecordHistoryEvent[] {
  const events: RecordHistoryEvent[] = [];
  const seenSig = new Set<string>();

  const addUnique = (ev: RecordHistoryEvent) => {
    const tsBucket = Math.floor((new Date(ev.timestamp).getTime() || 0) / 5000);
    const sig = `${ev.table}|${ev.recordId}|${ev.action}|${ev.actorName}|${tsBucket}|${JSON.stringify(ev.changes)}`;
    if (seenSig.has(sig)) return;
    seenSig.add(sig);
    events.push(ev);
  };

  for (const log of logs) {
    const parsed = parseHistoryMetaFromLog(log);
    if (parsed) addUnique(parsed);
  }
  for (const ev of readLocalHistory()) {
    addUnique(ev);
  }

  return events.sort(
    (a, b) => (new Date(b.timestamp).getTime() || 0) - (new Date(a.timestamp).getTime() || 0)
  );
}

export function getCurrentlyDeletedEvents(logs: ActivityLogEntry[]): RecordHistoryEvent[] {
  const all = getAllHistoryEvents(logs);
  const seenKey = new Set<string>();
  const out: RecordHistoryEvent[] = [];
  for (const ev of all) {
    const key = `${ev.table}:${ev.recordId}`;
    if (seenKey.has(key)) continue;
    if (ev.action === 'deleted' || ev.action === 'restored') {
      seenKey.add(key);
      if (ev.action === 'deleted') out.push(ev);
    }
  }
  return out;
}
