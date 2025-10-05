// src/app/api/orders/[id]/route.ts
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

    const rows = (await sql`
      UPDATE public.orders
      SET status = ${next}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, lines, total_cents, status, created_at, updated_at
    `) as DbOrderRow[];

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // Server-Wahrheit zurückgeben (Client nutzt genau diese Felder)
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
