export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { lines, total_cents } = await req.json();
    if (!Array.isArray(lines) || typeof total_cents !== 'number') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await sql`
      INSERT INTO public.orders (id, lines, total_cents, status)
      VALUES (${id}, ${JSON.stringify(lines)}::jsonb, ${total_cents}, 'in_queue')
    `;
    return NextResponse.json({ id, status: 'in_queue' }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const limit = Math.min(Number(searchParams.get('limit') ?? 100), 200);

  const rows = status
    ? await sql`SELECT * FROM public.orders WHERE status=${status} ORDER BY created_at DESC LIMIT ${limit}`
    : await sql`SELECT * FROM public.orders ORDER BY created_at DESC LIMIT ${limit}`;

  return NextResponse.json(
    rows.map((r: any) => ({
      orderId: r.id,
      lines: typeof r.lines === 'string' ? JSON.parse(r.lines) : r.lines,
      total: (r.total_cents ?? 0) / 100,
      status: r.status as 'in_queue' | 'preparing' | 'ready' | 'picked_up',
      createdAt: new Date(r.created_at).toISOString(),
    })),
    { status: 200 }
  );
}
