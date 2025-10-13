'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';
export type MenuItem = { id: string; name: string; price_cents: number };
export type OrderLine = { id: string; item?: MenuItem | null; qty: number; specs?: Record<string, string[]>; note?: string };
export type Order = { id: string; lines: OrderLine[]; total_cents: number; status: OrderStatus; created_at?: string; updated_at?: string };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export default function KitchenArchivePage() {
  const [orders, setOrders] = useState<Order[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/orders?archived=1', { cache: 'no-store' });
      if (!r.ok) return;
      const list = (await r.json()) as Order[];
      setOrders(list);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-white text-gray-800">
      <div className="mx-auto max-w-3xl p-4">
        <header className="flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">📦</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Archiv</h1>
              <p className="text-xs text-gray-500">Abgearbeitete Bestellungen (älter als 3 Minuten)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/kitchen" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Dashboard</Link>
            <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Kunden</Link>
          </div>
        </header>

        <main className="mt-6">
          <div className="grid grid-cols-1 gap-3">
            {orders.length === 0 && (
              <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Noch keine Einträge im Archiv.</div>
            )}

            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">ID: <span className="font-mono">{o.id}</span></div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{o.status}</span>
                </div>
                <div className="mt-2 divide-y text-sm">
                  {o.lines.map((l, i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="flex items-start justify-between py-2">
                      <div>
                        {l.qty}× {l.item?.name || 'Position'}
                      </div>
                      <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-xs text-gray-500">
                  aktualisiert: {new Date(o.updated_at || o.created_at || '').toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
