export interface MemberLookupHint {
  userId?: string | null;
  matricNo?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface LookupableMember {
  id: string;
  full_name?: string | null;
  matric_no?: string | null;
  email?: string | null;
}

function normalizeName(value?: string | null): string {
  if (!value) return '';
  return value
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[•|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function findMemberRecord<T extends LookupableMember>(
  members: T[],
  hint: MemberLookupHint | null | undefined,
): T | null {
  if (!hint || !Array.isArray(members) || members.length === 0) return null;

  const targetId = hint.userId?.trim();
  if (targetId) {
    const byId = members.find((m) => m.id === targetId);
    if (byId) return byId;
  }

  const targetMatric = hint.matricNo?.trim().toUpperCase();
  if (targetMatric) {
    const byMatric = members.find(
      (m) => (m.matric_no || '').trim().toUpperCase() === targetMatric,
    );
    if (byMatric) return byMatric;
  }

  const targetEmail = hint.email?.trim().toLowerCase();
  if (targetEmail) {
    const byEmail = members.find(
      (m) => (m.email || '').trim().toLowerCase() === targetEmail,
    );
    if (byEmail) return byEmail;
  }

  const targetName = normalizeName(hint.name);
  if (!targetName || targetName === '—' || targetName === '-') return null;

  const exactMatch = members.find(
    (m) => normalizeName(m.full_name) === targetName,
  );
  if (exactMatch) return exactMatch;

  if (targetName.length >= 4) {
    const prefixMatches = members.filter((m) => {
      const candidate = normalizeName(m.full_name);
      return (
        candidate.startsWith(`${targetName} `) ||
        targetName.startsWith(`${candidate} `)
      );
    });
    if (prefixMatches.length === 1) return prefixMatches[0];
  }

  return null;
}
