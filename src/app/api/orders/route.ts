import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Typen konsistent zur Client-App
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';
export type MenuItem = { id: string; name: string; price_cents: number };
export type OrderLine = { id: string; item?: MenuItem | null; qty: number; specs?: Record<string, string[]>; note?: string };
export type Order = { id: string; lines: OrderLine[]; total_cents: number; status: OrderStatus; created_at?: string; updated_at?: string };

function json(data: unknown, status = 200) {
  return new NextResponse(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

// GET: nur für Kitchen – mit PIN-Header
export async function GET(req: NextRequest) {
  const pin = req.headers.get('x-kitchen-pin');
  if (!process.env.KITCHEN_PIN || pin !== process.env.KITCHEN_PIN) {
    return json({ error: 'forbidden' }, 403);
  }

  const archived = req.nextUrl.searchParams.get('archived') === '1';

  // Bedingung: Archiv = picked_up und älter als 3 Minuten
  // Ansonsten: alles außer Archiv-Einträge
  const where = archived
    ? `status = 'picked_up' AND COALESCE(updated_at, created_at) < now() - interval '3 minutes'`
    : `NOT (status = 'picked_up' AND COALESCE(updated_at, created_at) < now() - interval '3 minutes')`;

  const rows = (await sql`
    SELECT id, lines, total_cents, status, created_at, updated_at
    FROM public.orders
    WHERE ${sql.raw(where)}
    ORDER BY created_at DESC
    LIMIT 100
  `) as unknown as Order[];

  return json(rows, 200);
}

// POST: neue Order (öffentlicher Endpunkt)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const lines = (body?.lines ?? []) as OrderLine[];
  const total_cents = Number(body?.total_cents ?? 0) | 0;
  const customer_email: string | undefined = body?.customer_email ? String(body.customer_email) : undefined;

  if (!Array.isArray(lines) || !lines.length) return json({ error: 'lines required' }, 400);
  if (!Number.isFinite(total_cents) || total_cents <= 0) return json({ error: 'invalid total_cents' }, 400);

  const id = crypto.randomUUID();
  const status: OrderStatus = 'in_queue';

  await sql`
    INSERT INTO public.orders (id, lines, total_cents, status)
    VALUES (${id}, ${sql.json(lines)}, ${total_cents}, ${status})
  `;

  return json({ id }, 201);
}
