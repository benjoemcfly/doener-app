'use client';
import React from 'react';
import type { OrderLine } from '@/app/types/orders';
import { formatPrice, labelForChoice, labelForGroup } from './helpers';

export function CheckoutView({
  lines,
  totalCents,
  customerEmail,
  onChangeEmail,
  onAdjustQty,
  onRemoveLine,
  onSubmit,
}: {
  lines: OrderLine[];
  totalCents: number;
  customerEmail: string;
  onChangeEmail: (v: string) => void;
  onAdjustQty: (id: string, delta: number) => void;
  onRemoveLine: (id: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Warenkorb</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Dein Warenkorb ist leer.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="rounded-2xl border bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{l.item?.name}</div>
                  {l.specs && Object.keys(l.specs).length > 0 && (
                    <ul className="mt-1 text-xs text-gray-600">
                      {Object.entries(l.specs).map(([gid, arr]) => (
                        <li key={gid}>
                          <span className="font-medium">{labelForGroup(gid, l.item)}:</span>{' '}
                          {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-sm text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => onAdjustQty(l.id, -1)}>
                    -
                  </button>
                  <span className="min-w-6 text-center">{l.qty}</span>
                  <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => onAdjustQty(l.id, +1)}>
                    +
                  </button>
                </div>
                <button className="text-sm text-red-600" onClick={() => onRemoveLine(l.id)}>
                  Entfernen
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-2xl border bg-white p-3">
            <div className="text-sm">Zwischensumme</div>
            <div className="text-base font-semibold">{formatPrice(totalCents)}</div>
          </div>

          <div className="rounded-2xl border bg-white p-3">
            <label className="block text-sm">
              E-Mail (optional)
              <input
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="kunde@example.com"
                value={customerEmail}
                onChange={(e) => onChangeEmail(e.target.value)}
                inputMode="email"
              />
            </label>
            <button
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              onClick={onSubmit}
              disabled={lines.length === 0}
            >
              Bestellung abschicken
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
