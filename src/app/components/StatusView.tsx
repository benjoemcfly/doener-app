'use client';

import React from 'react';
import type { Order } from '@/app/types/orders';
import { StatusBadge } from './StatusBadge';
import { formatPrice, labelForGroup, labelForChoice } from './helpers';

type StatusViewProps = {
  activeOrderId: string | null;
  activeOrder: Order | null;
};

export function StatusView({ activeOrderId, activeOrder }: StatusViewProps) {
  // Falls noch keine Bestellung aufgegeben wurde
  if (!activeOrderId) {
    return (
      <section className="pb-28">
        <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
          Bestellstatus
        </h2>
        <p className="mt-3 text-[13px] text-neutral-500">
          Noch keine aktive Bestellung.
        </p>
      </section>
    );
  }

  const o = activeOrder;

  return (
    <section className="pb-28">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
        Bestellstatus
      </h2>

      <div className="mt-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center justify-between">
          <div className="text-[12px] text-neutral-600">
            ID: <span className="font-mono">{activeOrderId}</span>
          </div>
          <StatusBadge s={o?.status ?? 'in_queue'} />
        </div>

        {!o ? (
          <p className="mt-2 text-[13px] text-neutral-500">Lade Status…</p>
        ) : (
          <>
            <ul className="mt-3 divide-y text-[13px]">
              {o.lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-start justify-between py-2"
                >
                  <div>
                    {l.qty}× {l.item?.name}
                    {l.specs && Object.keys(l.specs).length > 0 && (
                      <div className="text-[12px] text-neutral-600">
                        {Object.entries(l.specs).map(([gid, arr]) => (
                          <span key={gid} className="mr-2">
                            <span className="font-medium">
                              {labelForGroup(gid, l.item)}:
                            </span>{' '}
                            {arr
                              .map((cid) =>
                                labelForChoice(gid, cid, l.item),
                              )
                              .join(', ')}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-neutral-500">
                    {formatPrice((l.item?.price_cents ?? 0) * l.qty)}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2 text-right text-[11px] text-neutral-500">
              aktualisiert:{' '}
              {new Date(o.updated_at || o.created_at || '').toLocaleString()}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
