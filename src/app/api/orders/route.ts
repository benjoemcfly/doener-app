import { NextResponse } from 'next/server';
// NOTE: Adjust this import if your db client lives elsewhere
import { db } from '@/lib/db';

// Helper to validate kitchen PIN from header against env
function assertKitchenPin(req: Request) {
  const want = process.env.KITCHEN_PIN?.trim();
  const have = req.headers.get('x-kitchen-pin')?.trim();
  if (!want || !have || want !== have) {
    return false;
  }
  return true;
}

// GET /api/orders
// Used by Kitchen dashboard and Kitchen archive
export async function GET(req: Request) {
  // Kitchen endpoints require PIN
  if (!assertKitchenPin(req)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const archived = searchParams.get('archived');

  try {
    if (archived === '1') {
      // Archiv: Bestellungen, die bereits abgeholt wurden und seit >= 3 Minuten abgeschlossen sind
      const { rows } = await db.query(
        `SELECT id, lines, total_cents, status, created_at, updated_at
         FROM orders
         WHERE status = 'picked_up' AND updated_at <= NOW() - INTERVAL '3 minutes'
         ORDER BY updated_at DESC`
      );
      return NextResponse.json(rows);
    }

    // Aktive Bestellungen für das Kitchen-Dashboard
    const { rows } = await db.query(
      `SELECT id, lines, total_cents, status, created_at, updated_at
       FROM orders
       WHERE status IN ('in_queue','preparing','ready')
       ORDER BY created_at DESC`
    );
    return NextResponse.json(rows);
  } catch (e) {
    console.error('GET /api/orders failed', e);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// POST /api/orders
// Customer creates a new order
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { lines, total_cents, customer_email, customer_phone } = body as {
      lines: unknown[];
      total_cents: number;
      customer_email?: string;
      customer_phone?: string; // NEW
    };

    if (!Array.isArray(lines) || !Number.isFinite(total_cents)) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    const { rows } = await db.query(
      `INSERT INTO orders (lines, total_cents, status, customer_email, customer_phone)
       VALUES ($1, $2, 'in_queue', $3, $4)
       RETURNING id`,
      [JSON.stringify(lines), total_cents, customer_email ?? null, customer_phone ?? null]
    );

    return NextResponse.json({ id: rows[0].id });
  } catch (e) {
    console.error('POST /api/orders failed', e);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
