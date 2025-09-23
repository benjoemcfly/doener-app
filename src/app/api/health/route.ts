export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  try {
    const rows = await sql`select now() as ts`;
    return NextResponse.json({ ok: true, dbTime: rows[0].ts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
