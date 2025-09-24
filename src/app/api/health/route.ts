import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rows = await sql<{ now: string }[]>`select now() as now`;
    return NextResponse.json({ ok: true, dbTime: rows[0]?.now ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
