import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Kein Generic <> mehr – stattdessen Ergebnis casten
    const rows = (await sql`select now() as now`) as { now: string }[];
    return NextResponse.json({ ok: true, dbTime: rows[0]?.now ?? null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
