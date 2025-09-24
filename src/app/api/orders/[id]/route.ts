import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

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
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    // ❌ KEIN sql<DbOrderRow[]>
    // ✅ Ergebnis *casten*
    const rows = (await sql`
      SELECT id, lines, total_cents, status, created_at
      FROM public.orders
      WHERE id = ${id}
      LIMIT 1
    `) as DbOrderRow[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const row = rows[0];
    return NextResponse.json({
      orderId: row.id,
      lines: row.lines,
      total: row.total_cents / 100,
      status: row.status,
      createdAt: row.created_at,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await req.json()) as { status: OrderStatus };
    const allowed: ReadonlyArray<OrderStatus> = ['in_queue', 'preparing', 'ready', 'picked_up'];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    await sql`
      UPDATE public.orders
      SET status = ${body.status}, updated_at = now()
      WHERE id = ${id}
    `;

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
