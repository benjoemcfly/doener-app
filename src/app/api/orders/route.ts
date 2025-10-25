import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ==========================
// Typen
// ==========================
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

export type MenuItem = {
  id: string;
  name: string;
  price_cents: number;
};

export type OrderLine = {
  id: string;
  item?: MenuItem | null;
  qty: number;
  specs?: Record<string, string[]>; // groupId -> choiceIds
  note?: string;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  total_cents: number;
  status: OrderStatus;
  created_at?: string;
  updated_at?: string;
};

// ==========================
// Helper: JSON Response
// ==========================
function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// ==========================
// Helper: Telefonnummer normalisieren (Schweiz Default, E.164-ähnlich)
// ==========================
function normalizeE164(
  input?: unknown,
  defaultCountry = '+41'
): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;

  // Sonderzeichen raus
  s = s.replace(/[\s()\-.–]/g, '');

  // Falls kein + am Anfang: "079..." -> "+41 79..."
  if (!s.startsWith('+')) {
    if (/^0\d{8,}$/.test(s)) {
      s = defaultCountry + s.replace(/^0+/, '');
    }
  }

  // Nur Ziffern zählen
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!s.startsWith('+')) return null;

  return s;
}

// ==========================
// GET: Nur für Kitchen – mit PIN-Header
// - /api/orders           => aktive Bestellungen
// - /api/orders?archived=1 => Archiv (picked_up älter als 3 Minuten)
// ==========================
export async function GET(req: NextRequest) {
  const pin = req.headers.get('x-kitchen-pin');

  if (!process.env.KITCHEN_PIN || pin !== process.env.KITCHEN_PIN) {
    return json({ error: 'forbidden' }, 403);
  }

  const archived = req.nextUrl.searchParams.get('archived') === '1';

  let rows: Order[];

  if (archived) {
    // Archiv: Nur Bestellungen, die abgeholt wurden
    // und seit mind. 3 Minuten erledigt sind
    rows = (await sql`
      SELECT id, lines, total_cents, status, created_at, updated_at
      FROM public.orders
      WHERE status = 'picked_up'
        AND COALESCE(updated_at, created_at) < now() - interval '3 minutes'
      ORDER BY created_at DESC
      LIMIT 100
    `) as unknown as Order[];
  } else {
    // Aktiv: Alle, außer die alten 'picked_up'
    rows = (await sql`
      SELECT id, lines, total_cents, status, created_at, updated_at
      FROM public.orders
      WHERE NOT (
        status = 'picked_up'
        AND COALESCE(updated_at, created_at) < now() - interval '3 minutes'
      )
      ORDER BY created_at DESC
      LIMIT 100
    `) as unknown as Order[];
  }

  return json(rows, 200);
}

// ==========================
// POST: neue Order (öffentlicher Endpunkt)
// ==========================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const lines = (body?.lines ?? []) as OrderLine[];
    const total_cents_raw = Number(body?.total_cents ?? 0);
    // Bitwise |0 kann negative Effekte haben auf große Werte → wir bereiten beides getrennt
    const total_cents = Number.isFinite(total_cents_raw)
      ? total_cents_raw
      : 0;

    const customer_email =
      typeof body?.customer_email === 'string' && body.customer_email.trim()
        ? body.customer_email.trim()
        : null;

    const rawPhone =
      typeof body?.customer_phone === 'string' ? body.customer_phone : '';
    const customer_phone = rawPhone ? normalizeE164(rawPhone) : null;

    // Validation
    if (!Array.isArray(lines) || !lines.length) {
      return json({ error: 'lines required' }, 400);
    }
    if (!Number.isFinite(total_cents) || total_cents <= 0) {
      return json({ error: 'invalid total_cents' }, 400);
    }
    if (rawPhone && !customer_phone) {
      return json({ error: 'invalid customer_phone format' }, 400);
    }

    const id = crypto.randomUUID();
    const status: OrderStatus = 'in_queue';

    // Versuch, in DB zu schreiben
    try {
      await sql`
        INSERT INTO public.orders (
          id,
          lines,
          total_cents,
          status,
          customer_email,
          customer_phone
        )
        VALUES (
          ${id},
          ${JSON.stringify(lines)}::json,
          ${total_cents},
          ${status},
          ${customer_email},
          ${customer_phone}
        )
      `;
    } catch (dbErr) {
      console.error('DB INSERT failed:', dbErr);
      return json(
        {
          error: 'db_insert_failed',
          detail: String(dbErr),
        },
        500
      );
    }

    // Erfolgreich
    return json({ id }, 201);
  } catch (err) {
    console.error('POST /api/orders failed:', err);
    return json(
      {
        error: 'unexpected_error',
        detail: String(err),
      },
      500
    );
  }
}
