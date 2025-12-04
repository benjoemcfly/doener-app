// src/app/components/helpers.ts

import type { OrderLine } from '@/types/order';

/**
 * Preise formatiert in CHF (wie in der UI).
 */
export function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });
}

/**
 * Gesamtsumme aus Warenkorbzeilen berechnen.
 */
export function sumCart(lines: OrderLine[]) {
  return lines.reduce(
    (acc, l) => acc + (l.item?.price_cents ?? 0) * l.qty,
    0,
  );
}

/**
 * Local-Storage Keys & Helpers, zentral an einer Stelle.
 */
export const LS_KEY = 'order_ids_v1';
export const ARCHIVE_LS_KEY = 'order_archive_v1';
export const PENDING_CART_KEY = 'twint_pending_cart_v1';

export const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * Shape vom gesicherten Warenkorb für TWINT-Rückkehr.
 */
export type PendingCartBackup = {
  lines: OrderLine[];
  customerEmail?: string;
  customerPhone?: string;
};
