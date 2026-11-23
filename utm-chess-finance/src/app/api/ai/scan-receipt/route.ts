import { NextRequest, NextResponse } from 'next/server';

interface ScanReceiptRequest {
  imageBase64?: string;
  mimeType?: string;
  activeEvents?: string[];
  categories?: string[];
}

interface AiScanPayload {
  merchant: string;
  date: string | null;
  total_amount: number | null;
  tax_amount: number | null;
  line_items: { name: string; amount: number }[];
  suggested_category: string;
  suggested_event: string | null;
  anomaly_flags: string[];
  confidence: number;
}

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

function normalizeDateYmd(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${month}-${day}`;
  }
  return null;
}

function toFiniteAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Number(raw.toFixed(2));
  }
  if (typeof raw === 'string') {
    const n = parseFloat(raw.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(n) && n >= 0) return Number(n.toFixed(2));
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { fallback: true, reason: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 200 }
      );
    }

    const body = (await req.json()) as ScanReceiptRequest;
    const rawB64 = String(body.imageBase64 || '').replace(/^data:[^;]+;base64,/, '').trim();
    if (!rawB64) {
      return NextResponse.json(
        { fallback: true, reason: 'Missing imageBase64 payload.' },
        { status: 200 }
      );
    }
    if (rawB64.length > 14_000_000) {
      return NextResponse.json(
        { fallback: true, reason: 'Receipt image too large for fast AI scan.' },
        { status: 200 }
      );
    }

    const rawMime = String(body.mimeType || 'image/jpeg').toLowerCase().trim();
    const mimeType = ALLOWED_MIME.has(rawMime)
      ? rawMime === 'image/jpg'
        ? 'image/jpeg'
        : rawMime
      : 'image/jpeg';

    const activeEvents = Array.isArray(body.activeEvents)
      ? body.activeEvents.map((e) => String(e).trim()).filter(Boolean).slice(0, 40)
      : [];
    const categories = Array.isArray(body.categories)
      ? body.categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 30)
      : [];

    const todayStr = new Date().toISOString().split('T')[0];

    const prompt = [
      'You are an accurate Malaysian student club expense receipt scanner.',
      `Today is ${todayStr}. Extract structured receipt data as strict JSON matching this exact schema:`,
      '{',
      '  "merchant": string,',
      '  "date": string | null (YYYY-MM-DD format),',
      '  "total_amount": number | null (final RM total paid),',
      '  "tax_amount": number | null,',
      '  "line_items": [{"name": string, "amount": number}],',
      '  "suggested_category": string,',
      '  "suggested_event": string | null,',
      '  "anomaly_flags": string[],',
      '  "confidence": number (0 to 100)',
      '}',
      categories.length > 0
        ? `Pick suggested_category from these club categories/departments (or closest match): ${categories.join(', ')}.`
        : 'Pick a concise club expense category (e.g. Food & Refreshments, Logistics, Equipment, Prizes).',
      activeEvents.length > 0
        ? `If clearly related, pick suggested_event from these active club activities, otherwise null: ${activeEvents.join(', ')}.`
        : 'Set suggested_event to null if unsure.',
      `Flag anomalies in anomaly_flags ONLY when real issues exist: blurry/unreadable total, future date after ${todayStr}, non-club/personal items (e.g. cigarettes/alcohol/personal clothing), or sum of line_items noticeably differs from total_amount.`,
    ].join('\n');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(
          apiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: rawB64,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: 'application/json',
            },
          }),
        }
      );

      if (!geminiRes.ok) {
        return NextResponse.json(
          { fallback: true, reason: `Gemini API returned ${geminiRes.status}` },
          { status: 200 }
        );
      }

      const payload = (await geminiRes.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanedJson = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

      if (!cleanedJson) {
        return NextResponse.json(
          { fallback: true, reason: 'Empty response from Gemini Vision.' },
          { status: 200 }
        );
      }

      const parsed = JSON.parse(cleanedJson) as Record<string, unknown>;
      const rawItems = Array.isArray(parsed.line_items) ? parsed.line_items : [];
      const lineItems = rawItems
        .map((it) => {
          if (!it || typeof it !== 'object') return null;
          const obj = it as Record<string, unknown>;
          const amt = toFiniteAmount(obj.amount);
          const name = String(obj.name || '').trim();
          if (!name || amt === null) return null;
          return { name, amount: amt };
        })
        .filter((it): it is { name: string; amount: number } => Boolean(it))
        .slice(0, 25);

      const anomalyFlags = Array.isArray(parsed.anomaly_flags)
        ? parsed.anomaly_flags.map((f) => String(f).trim()).filter(Boolean).slice(0, 6)
        : [];

      const confNum = Number(parsed.confidence);
      const confidence = Number.isFinite(confNum)
        ? Math.max(0, Math.min(100, Math.round(confNum)))
        : 85;

      const suggestedCatRaw = String(parsed.suggested_category || '').trim();
      const matchedCat =
        categories.find((c) => c.toLowerCase() === suggestedCatRaw.toLowerCase()) ||
        suggestedCatRaw;

      const suggestedEvRaw =
        parsed.suggested_event && typeof parsed.suggested_event === 'string'
          ? parsed.suggested_event.trim()
          : '';
      const matchedEvent =
        activeEvents.find((e) => e.toLowerCase() === suggestedEvRaw.toLowerCase()) ||
        (suggestedEvRaw || null);

      const result: AiScanPayload = {
        merchant: String(parsed.merchant || '').trim(),
        date: normalizeDateYmd(parsed.date),
        total_amount: toFiniteAmount(parsed.total_amount),
        tax_amount: toFiniteAmount(parsed.tax_amount),
        line_items: lineItems,
        suggested_category: matchedCat,
        suggested_event: matchedEvent,
        anomaly_flags: anomalyFlags,
        confidence,
      };

      return NextResponse.json({ fallback: false, data: result }, { status: 200 });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: unknown) {
    return NextResponse.json(
      {
        fallback: true,
        reason: err instanceof Error ? err.message : 'Receipt AI scan failed.',
      },
      { status: 200 }
    );
  }
}
