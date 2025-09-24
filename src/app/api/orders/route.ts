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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('limit');
    const parsed = raw ? parseInt(raw, 10) : 50;
    const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : 50;

    // ❌ KEIN sql<DbOrderRow[]> …  ✅ Ergebnis casten
    const rows = (await sql`
      SELECT id, lines, total_cents, status, created_at
      FROM public.orders
      ORDER BY created_at DESC
      LIMIT ${limit}
    `) as DbOrderRow[];

    const out = rows.map(r => ({
      orderId: r.id,
      lines: r.lines,
      total: r.total_cents / 100,
      status: r.status,
      createdAt: r.created_at,
    }));

    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lines: CartLine[]; total_cents: number };
    const id = crypto.randomUUID();
    const status: OrderStatus = 'in_queue';

    await sql`
      INSERT INTO public.orders (id, lines, total_cents, status)
      VALUES (${id}, ${JSON.stringify(body.lines)}::jsonb, ${body.total_cents}, ${status})
    `;

    return NextResponse.json({ id, status }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
