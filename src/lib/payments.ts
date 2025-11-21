// src/lib/payments.ts
import { sql } from '@/lib/db';

/**
 * Payment-Status wie im Markt üblich
 * - unpaid: Bestellung angelegt, aber noch nicht bezahlt
 * - paid: Zahlung eingegangen (Webhook)
 * - failed: Zahlung fehlgeschlagen
 */
export type PaymentStatus = 'unpaid' | 'paid' | 'failed';

export interface Order {
  id: string;
  total_cents: number;           // Gesamtbetrag in Rappen/Cent
  payment_status: PaymentStatus;
  payment_provider: string | null;
  payment_ref: string | null;    // z.B. Payrexx-Gateway-ID
  currency: string | null;
}

/**
 * TODO: Passe Tabellennamen/Spalten an dein tatsächliches Schema an.
 * Hier gehe ich von einer Tabelle "orders" aus.
 */
export async function getOrderById(orderId: string): Promise<Order | null> {
  const rows = (await sql`
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
  `) as any[];

  if (!rows.length) return null;

  const row = rows[0];
  return {
    id: String(row.id),
    total_cents: Number(row.total_cents),
    payment_status: (row.payment_status || 'unpaid') as PaymentStatus,
    payment_provider: row.payment_provider ?? null,
    payment_ref: row.payment_ref ?? null,
    currency: row.currency ?? 'CHF',
  };
}

export async function setOrderPaymentRef(orderId: string, ref: string) {
  await sql`
    UPDATE orders
    SET payment_provider = 'payrexx', payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}

export async function markOrderPaid(orderId: string, ref: string) {
  await sql`
    UPDATE orders
    SET payment_status = 'paid', payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}

export async function markOrderFailed(orderId: string, ref: string | null) {
  await sql`
    UPDATE orders
    SET payment_status = 'failed', payment_ref = ${ref}
    WHERE id = ${orderId}
  `;
}
