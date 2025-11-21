// src/lib/payments.ts
import { sql } from '@/lib/db';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed';

export interface Order {
  id: string;
  total_cents: number;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  currency: string | null;
}

/**
 * Struktur der Datenbankzeile (alles erstmal unknown, dann sauber gecastet).
 * Falls deine Tabelle nicht "orders" heißt: unten im SQL anpassen.
 */
type OrderRow = {
  id?: unknown;
  total_cents?: unknown;
  payment_status?: unknown;
  payment_provider?: unknown;
  payment_ref?: unknown;
  currency?: unknown;
};

function asOrder(row: OrderRow): Order {
  const id = row.id != null ? String(row.id) : '';
  const total_cents =
    typeof row.total_cents === 'number'
      ? row.total_cents
      : Number(row.total_cents ?? 0);

  const rawStatus =
    typeof row.payment_status === 'string' ? row.payment_status : 'unpaid';

  const allowed: PaymentStatus[] = ['unpaid', 'paid', 'failed'];
  const payment_status = (allowed.includes(rawStatus as PaymentStatus)
    ? rawStatus
    : 'unpaid') as PaymentStatus;

  const payment_provider =
    typeof row.payment_provider === 'string' ? row.payment_provider : null;

  const payment_ref =
    typeof row.payment_ref === 'string' ? row.payment_ref : null;

  const currency =
    typeof row.currency === 'string' && row.currency.length > 0
      ? row.currency
      : 'CHF';

  return {
    id,
    total_cents,
    payment_status,
    payment_provider,
    payment_ref,
    currency,
  };
}

/**
 * Holt eine Order aus der DB.
 * TODO: Tabellennamen an dein Schema anpassen, falls nötig.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const rowsUnknown = await sql`
    SELECT
      id,
      total_cents,
      payment_status,
      payment_provider,
      payment_ref,
      currency
    FROM orders
    WHERE id = ${orderId}
    LIMIT 1
  `;

  const rows = rowsUnknown as OrderRow[];

  if (!rows.length) return null;

  return asOrder(rows[0]);
}

export async function setOrderPaymentRef(orderId: string, ref: string) {
  await sql`
    UPDATE orders
    SET payment_provider = 'payrexx',
        payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}

export async function markOrderPaid(orderId: string, ref: string) {
  await sql`
    UPDATE orders
    SET payment_status = 'paid',
        payment_provider = 'payrexx',
        payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}

export async function markOrderFailed(orderId: string, ref: string | null) {
  await sql`
    UPDATE orders
    SET payment_status = 'failed',
        payment_provider = 'payrexx',
        payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}
