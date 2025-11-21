// src/lib/payments.ts
import { sql } from '@/lib/db';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed';

export interface OrderPaymentRow {
  id: string | number;
  total_cents: number | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_ref: string | null;
  currency: string | null;
}

export interface Order {
  id: string;
  total_cents: number;
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  currency: string | null;
}

/**
 * Holt eine Order aus der DB.
 * TODO: Falls deine Tabelle nicht "orders" heißt, hier den Namen anpassen.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const rows = await sql<OrderPaymentRow>`
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

  if (rows.length === 0) return null;

  const row = rows[0];

  return {
    id: String(row.id),
    total_cents: Number(row.total_cents ?? 0),
    payment_status: (row.payment_status ?? 'unpaid') as PaymentStatus,
    payment_provider: row.payment_provider,
    payment_ref: row.payment_ref,
    currency: row.currency ?? 'CHF',
  };
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
