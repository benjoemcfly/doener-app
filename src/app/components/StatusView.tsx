'use client';

import React from 'react';
import type { Order } from '@/app/types/orders';
import { StatusBadge } from './StatusBadge';
import { formatPrice, labelForGroup, labelForChoice } from './helpers';

type StatusViewProps = {
  orderIds: string[];
  ordersById: Record<string, Order | null>;
  archiveIds: string[];
  archiveById: Record<string, Order>;
  showArchive: boolean;
  onToggleArchive: () => void;
};

export function StatusView({
  orderIds,
  ordersById,
  archiveIds,
  archiveById,
  showArchive,
  onToggleArchive,
}: StatusViewProps) {
  return (
    <section className="pb-28">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Bestellstatus</h2>

      {orderIds.length === 0 ? (
        <p className="mt-3 text-[13px] text-neutral-500">
          Keine aktiven Bestellungen.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {orderIds.map((id) => {
            const o = ordersById[id];
            return (
              <div
                key={id}
                className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[12px] text-neutral-600">
                    ID: <span className="font-mono">{id}</span>
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
                                        labelForChoice(gid, cid, l.item)
                                      )
                                      .join(', ')}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-neutral-500">
                            {formatPrice(
                              (l.item?.price_cents ?? 0) * l.qty
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-2 text-right text-[11px] text-neutral-500">
                      aktualisiert:{' '}
                      {new Date(
                        o.updated_at || o.created_at || ''
                      ).toLocaleString()}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Archiv-Link */}
      <div className="mt-3 text-center text-[12px] text-neutral-500">
        <button
          className="rounded-full px-3 py-1 underline-offset-2 hover:underline"
          onClick={onToggleArchive}
        >
          {showArchive
            ? 'Archiv ausblenden'
            : `Vergangene Bestellungen ansehen (${archiveIds.length})`}
        </button>
      </div>

      {showArchive && (
        <div className="mt-4 space-y-3">
          <h3 className="text-[13px] font-medium text-neutral-600">
            Archiv (heute)
          </h3>

          {archiveIds.length === 0 ? (
            <p className="text-[13px] text-neutral-400">
              Noch keine archivierten Bestellungen.
            </p>
          ) : (
            archiveIds.map((id) => {
              const o = archiveById[id];
              if (!o) return null;

              return (
                <div
                  key={id}
                  className="rounded-3xl bg-white p-4 opacity-90 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-[12px] text-neutral-600">
                      ID: <span className="font-mono">{id}</span>
                    </div>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-700 ring-1 ring-inset ring-neutral-200">
                      Archiv
                    </span>
                  </div>

                  <ul className="mt-3 divide-y text-[13px]">
                    {o.lines.map((l) => (
                      <li
                        key={l.id}
                        className="flex items-start justify-between py-2"
                      >
                        <div>
                          {l.qty}× {l.item?.name}
                        </div>
                        <div className="text-neutral-500">
                          {formatPrice(
                            (l.item?.price_cents ?? 0) * l.qty
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 text-right text-[11px] text-neutral-400">
                    abgeschlossen:{' '}
                    {new Date(
                      o.updated_at || o.created_at || ''
                    ).toLocaleString()}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
