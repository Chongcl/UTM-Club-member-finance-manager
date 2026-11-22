import type { Budget } from './supabase';

export type ActivityFormat =
  | 'physical'
  | 'online'
  | 'self_paced'
  | 'fee_collection';

export type PostPaymentUnlock =
  | 'entry_pass_qr'
  | 'access_link'
  | 'registration_only'
  | 'both_link_and_qr';

export type PaymentUnlockTiming =
  | 'after_verification'
  | 'immediate_on_submit';

export interface FeeTier {
  id: string;
  name: string;
  amount: number;
  description?: string;
}

export interface ActivityConfig {
  format?: ActivityFormat;
  end_date?: string;
  unlock_mode?: PostPaymentUnlock;
  unlock_timing?: PaymentUnlockTiming;
  access_link_url?: string;
  access_link_label?: string;
  access_code?: string;
  access_instructions?: string;
  fee_tiers?: FeeTier[];
  allow_custom_amount?: boolean;
  registration_prompt?: string;
  requires_rsvp?: boolean;
}

export interface ResolvedActivityConfig {
  format: ActivityFormat;
  end_date: string;
  unlock_mode: PostPaymentUnlock;
  unlock_timing: PaymentUnlockTiming;
  access_link_url: string;
  access_link_label: string;
  access_code: string;
  access_instructions: string;
  fee_tiers: FeeTier[];
  allow_custom_amount: boolean;
  registration_prompt: string;
  requires_rsvp: boolean;
}

export function resolveActivityConfig(
  budget?: Partial<Budget> | null
): ResolvedActivityConfig {
  const raw =
    budget?.activity_config && typeof budget.activity_config === 'object'
      ? budget.activity_config
      : {};

  const format: ActivityFormat =
    raw.format === 'online' ||
    raw.format === 'self_paced' ||
    raw.format === 'fee_collection'
      ? raw.format
      : 'physical';

  const hasAccessLink = Boolean(raw.access_link_url && raw.access_link_url.trim());

  let defaultUnlockMode: PostPaymentUnlock = 'registration_only';
  if (format === 'physical') {
    defaultUnlockMode =
      budget?.ticket_qr_mode === 'entry_pass' ||
      budget?.ticket_qr_mode === 'paid_only' ||
      budget?.ticket_qr_mode === 'manual_only' ||
      Number(budget?.registration_fee || 0) > 0
        ? 'entry_pass_qr'
        : 'registration_only';
  } else if (format === 'online') {
    defaultUnlockMode = 'access_link';
  } else if (format === 'self_paced') {
    defaultUnlockMode = hasAccessLink ? 'access_link' : 'registration_only';
  } else {
    defaultUnlockMode = hasAccessLink ? 'access_link' : 'registration_only';
  }

  const unlock_mode: PostPaymentUnlock =
    raw.unlock_mode === 'entry_pass_qr' ||
    raw.unlock_mode === 'access_link' ||
    raw.unlock_mode === 'registration_only' ||
    raw.unlock_mode === 'both_link_and_qr'
      ? raw.unlock_mode
      : defaultUnlockMode;

  const unlock_timing: PaymentUnlockTiming =
    raw.unlock_timing === 'immediate_on_submit'
      ? 'immediate_on_submit'
      : 'after_verification';

  const fee_tiers: FeeTier[] = Array.isArray(raw.fee_tiers)
    ? raw.fee_tiers
        .filter((t) => t && typeof t === 'object' && String(t.name || '').trim())
        .map((t, idx) => ({
          id: String(t.id || `tier-${idx + 1}`),
          name: String(t.name || '').trim(),
          amount: Math.max(0, Number(t.amount || 0)),
          description: t.description ? String(t.description).trim() : undefined,
        }))
    : [];

  return {
    format,
    end_date: String(raw.end_date || budget?.end_date || '').trim(),
    unlock_mode,
    unlock_timing,
    access_link_url: String(raw.access_link_url || '').trim(),
    access_link_label:
      String(raw.access_link_label || '').trim() ||
      (format === 'online'
        ? 'Join Online Session'
        : format === 'self_paced'
        ? 'Open Program Resource'
        : 'Open Access Link'),
    access_code: String(raw.access_code || '').trim(),
    access_instructions: String(raw.access_instructions || '').trim(),
    fee_tiers,
    allow_custom_amount: Boolean(raw.allow_custom_amount),
    registration_prompt: String(raw.registration_prompt || '').trim(),
    requires_rsvp:
      typeof raw.requires_rsvp === 'boolean'
        ? raw.requires_rsvp
        : format !== 'fee_collection',
  };
}

function formatPrettyDate(isoDate?: string | null): string {
  if (!isoDate) return '';
  const dt = new Date(isoDate);
  if (Number.isNaN(dt.getTime())) return isoDate;
  return dt.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatActivitySchedule(
  budget: Partial<Budget>,
  cfg: ResolvedActivityConfig
): string {
  const start = (budget.event_date || '').trim();
  const end = cfg.end_date.trim();

  if (cfg.format === 'fee_collection') {
    if (start) {
      return `Due by ${formatPrettyDate(start)}`;
    }
    return 'Open Ongoing Collection';
  }

  if (cfg.format === 'self_paced') {
    if (start && end && end !== start) {
      return `${formatPrettyDate(start)} → ${formatPrettyDate(end)}`;
    }
    if (start) return `Starts ${formatPrettyDate(start)}`;
    return 'Self-Paced Program';
  }

  if (start && end && end !== start) {
    return `${formatPrettyDate(start)} – ${formatPrettyDate(end)}`;
  }

  return start || 'Date TBA';
}

export function hasFeeRequired(
  budget: Partial<Budget>,
  cfg: ResolvedActivityConfig
): boolean {
  const baseFee = Number(budget.registration_fee || 0);
  if (baseFee > 0) return true;
  if (cfg.allow_custom_amount) return true;
  if (cfg.fee_tiers.some((t) => Number(t.amount || 0) > 0)) return true;
  return false;
}

export function getFeeDisplayLabel(
  budget: Partial<Budget>,
  cfg: ResolvedActivityConfig
): string {
  const baseFee = Number(budget.registration_fee || 0);
  if (cfg.fee_tiers.length > 0) {
    const amounts = cfg.fee_tiers.map((t) => Number(t.amount || 0));
    const min = Math.min(...amounts);
    const max = Math.max(...amounts);
    if (min <= 0 && max <= 0) {
      return cfg.allow_custom_amount ? 'Custom RM' : 'Free';
    }
    if (min === max) return `RM ${min.toFixed(2)}`;
    return `From RM ${min.toFixed(2)}`;
  }
  if (baseFee > 0) return `RM ${baseFee.toFixed(2)}`;
  if (cfg.allow_custom_amount) return 'Custom RM';
  return 'Free';
}

export function getFormatBadgeMeta(format: ActivityFormat): {
  label: string;
  badgeClass: string;
} {
  switch (format) {
    case 'online':
      return {
        label: 'Online Event',
        badgeClass: 'bg-sky-100 text-sky-800 border-sky-200',
      };
    case 'self_paced':
      return {
        label: 'Self-Paced Program',
        badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
      };
    case 'fee_collection':
      return {
        label: 'Fee Collection',
        badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
      };
    default:
      return {
        label: 'In-Person Event',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
  }
}
