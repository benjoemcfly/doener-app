// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// ==== Typen ====
type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

interface MenuItem { id: string; name: string; basePrice: number; description?: string }
interface Customization { sauce: string; salad: string; extras: string[] }
interface CartLine { id: string; item: MenuItem; qty: number; custom: Customization }

interface DbOrderRow {
  id: string;
  lines: CartLine[];
  total_cents: number;
  status: OrderStatus;
  created_at: string;
  updated_at?: string;
  customer_phone?: string | null;        // ← NEU
  sms_notified?: boolean | null;         // ← NEU
}

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// ==== Helper: Telefonnummer leicht nach E.164 normalisieren (CH‑Default) ====
function normalizeE164(input?: unknown, defaultCountry = '+41'): string | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;
  s = s.replace(/[\s()\-\.]/g, '');
  if (!s.startsWith('+')) {
    // einfache CH‑Heuristik: 079… → +4179…
    if (/^0\d{8,}$/.test(s)) s = defaultCountry + s.replace(/^0+/, '');
  }
  const digits = s.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (!s.startsWith('+')) return null;
  return s;
}

// ==== Helper: BulkGate Simple Transactional API ====
const BULKGATE_API_URL = 'https://portal.bulkgate.com/api/1.0/simple/transactional';
async function sendReadySms(rawTo: string, text = 'Deine Bestellung ist bereit zur Abholung. Guten Appetit! 🥙') {
  const application_id = process.env.BULKGATE_APP_ID;
  const application_token = process.env.BULKGATE_APP_TOKEN;
  if (!application_id || !application_token) throw new Error('Missing BULKGATE_APP_ID or BULKGATE_APP_TOKEN');

  const sender_id = process.env.BULKGATE_SENDER_ID || 'gText';
  const sender_id_value = process.env.BULKGATE_SENDER_VALUE || 'DonerShop'; // max ~11 ASCII für gText

  const number = normalizeE164(rawTo);
  if (!number) throw new Error('Invalid destination number');

  const payload = { application_id, application_token, number, text, sender_id, sender_id_value } as const;
  const r = await fetch(BULKGATE_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const raw = await r.text();
  if (!r.ok) throw new Error(`BulkGate HTTP ${r.status}: ${raw}`);
  return raw;
}

// ==== GET: öffentlich (Kunden‑Polling) ====
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const rows = (await sql`
      SELECT id, lines, total_cents, status, created_at, updated_at
      FROM public.orders
      WHERE id = ${id}
      LIMIT 1
    `) as DbOrderRow[];

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(rows[0], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

// ==== PATCH: Status ändern; bei ready → SMS (idempotent via sms_notified) ====
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await req.json().catch(() => ({} as { status?: OrderStatus }));
    const next = body?.status as OrderStatus | undefined;

    const allowed: ReadonlyArray<OrderStatus> = ['in_queue', 'preparing', 'ready', 'picked_up'];
    if (!next || !allowed.includes(next)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // 1) Status setzen
    await sql`
      UPDATE public.orders
      SET status = ${next}, updated_at = now()
      WHERE id = ${id}
    `;

    // 2) Wenn ready → SMS einmalig senden
    if (next === 'ready') {
      const rows = (await sql`
        SELECT id, customer_phone, COALESCE(sms_notified, false) AS sms_notified
        FROM public.orders
        WHERE id = ${id}
        LIMIT 1
      `) as unknown as { id: string; customer_phone: string | null; sms_notified: boolean }[];

      const row = rows[0];
      if (row && row.customer_phone && !row.sms_notified) {
        try {
          await sendReadySms(row.customer_phone);
          await sql`UPDATE public.orders SET sms_notified = true WHERE id = ${id}`;
        } catch (e) {
          console.error('BulkGate SMS failed', e);
          // Fehler blockiert Status‑Update nicht
        }
      }
    }

    // 3) Server‑Wahrheit zurückgeben (nur Felder, die der Client nutzt)
    const current = (await sql`
      SELECT id, lines, total_cents, status, created_at, updated_at
      FROM public.orders
      WHERE id = ${id}
      LIMIT 1
    `) as DbOrderRow[];

    if (!current.length) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(current[0], {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
