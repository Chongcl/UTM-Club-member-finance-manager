/** Convert a Malaysian phone number to the international digits WhatsApp expects. */
export function formatWhatsAppPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `60${digits.slice(1)}`;
  if (digits.startsWith('60')) return digits;
  return `60${digits}`;
}

/** wa.me deep link. With no phone it opens WhatsApp's "choose a chat / group" picker. */
export function waLink(phone: string, text?: string): string {
  const p = formatWhatsAppPhone(phone);
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return p ? `https://wa.me/${p}${q}` : `https://wa.me/${q}`;
}

/** "19:30" → "7:30 PM". Leaves free-text values untouched. */
export function formatPickupTime(raw?: string | null): string {
  if (!raw) return '';
  const m = /^(\d{1,2}):(\d{2})/.exec(raw.trim());
  if (!m) return raw;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const suffix = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${suffix}`;
}
