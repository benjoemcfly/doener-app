'use client';

import React from 'react';
import type { OrderLine } from '@/app/types/orders';
import { formatPrice, labelForChoice, labelForGroup } from './helpers';

type Props = {
  lines: OrderLine[];
  totalCents: number;
  customerEmail: string;
  customerPhone: string;
  onChangeEmail: (v: string) => void;
  onChangePhone: (v: string) => void;
  onAdjustQty: (id: string, delta: number) => void;
  onRemoveLine: (id: string) => void;
  onSubmit: () => void;
};

export function CheckoutView({
  lines,
  totalCents,
  customerEmail,
  customerPhone,
  onChangeEmail,
  onChangePhone,
  onAdjustQty,
  onRemoveLine,
  onSubmit,
}: Props) {
  return (
    <section className="pb-28">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Warenkorb</h2>
      {lines.length === 0 ? (
        <p className="mt-3 text-[13px] text-neutral-500">Dein Warenkorb ist leer.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {lines.map((l) => (
            <div key={l.id} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{l.item?.name}</div>
                  {l.specs && Object.keys(l.specs).length > 0 && (
                    <ul className="mt-1 text-[12px] text-neutral-600">
                      {Object.entries(l.specs).map(([gid, arr]) => (
                        <li key={gid}>
                          <span className="font-medium">
                            {labelForGroup(gid, l.item)}:
                          </span>{' '}
                          {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="text-[13px] text-neutral-500">
                  {formatPrice((l.item?.price_cents ?? 0) * l.qty)}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full bg-neutral-100 px-2 py-1"
                    onClick={() => onAdjustQty(l.id, -1)}
                  >
                    -
                  </button>
                  <span className="min-w-6 text-center">{l.qty}</span>
                  <button
                    className="rounded-full bg-neutral-100 px-2 py-1"
                    onClick={() => onAdjustQty(l.id, +1)}
                  >
                    +
                  </button>
                </div>
                <button
                  className="text-[13px] text-red-600"
                  onClick={() => onRemoveLine(l.id)}
                >
                  Entfernen
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <div className="text-[13px]">Zwischensumme</div>
            <div className="text-[15px] font-semibold">{formatPrice(totalCents)}</div>
          </div>

          <div className="space-y-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
            <label className="block text-[13px]">
              E-Mail (optional)
              <input
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px]"
                placeholder="kunde@example.com"
                value={customerEmail}
                onChange={(e) => onChangeEmail(e.target.value)}
                inputMode="email"
              />
            </label>

            <label className="block text-[13px]">
              Telefon (für SMS – optional)
              <input
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px]"
                placeholder="+41 79 123 45 67"
                value={customerPhone}
                onChange={(e) => onChangePhone(e.target.value)}
                inputMode="tel"
              />
            </label>

            <button
              className="w-full rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm"
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
