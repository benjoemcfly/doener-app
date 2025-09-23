export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const res = await sql`SELECT * FROM public.orders WHERE id=${params.id} LIMIT 1`;
  if (res.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r: any = res[0];
  return NextResponse.json({
    orderId: r.id,
    lines: typeof r.lines === 'string' ? JSON.parse(r.lines) : r.lines,
    total: (r.total_cents ?? 0) / 100,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const status = body?.status as 'in_queue' | 'preparing' | 'ready' | 'picked_up' | undefined;
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 });

  const res = await sql`
    UPDATE public.orders
    SET status=${status}, updated_at=now()
    WHERE id=${params.id}
    RETURNING *
  `;
  if (res.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const r: any = res[0];
  return NextResponse.json({
    orderId: r.id,
    lines: typeof r.lines === 'string' ? JSON.parse(r.lines) : r.lines,
    total: (r.total_cents ?? 0) / 100,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString(),
  });
}
