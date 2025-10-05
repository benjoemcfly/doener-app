// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('limit');
    const parsed = raw ? parseInt(raw, 10) : 50;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50;

    const rows = (await sql`
      SELECT id, lines, total_cents, status, created_at, updated_at
      FROM public.orders
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as DbOrderRow[];

    // WICHTIG: keine Umbenennungen – UI erwartet diese Feldnamen!
    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lines: CartLine[]; total_cents: number; customer_email?: string };
    const id = crypto.randomUUID();
    const status: OrderStatus = 'in_queue';

    await sql`
      INSERT INTO public.orders (id, lines, total_cents, status)
      VALUES (${id}, ${sql.json(body.lines)}, ${body.total_cents}, ${status})
    `;

    if (body.customer_email) {
      try {
        await sql`UPDATE public.orders SET customer_email = ${body.customer_email} WHERE id = ${id}`;
      } catch {}
    }

    return NextResponse.json(
      { id, status },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
