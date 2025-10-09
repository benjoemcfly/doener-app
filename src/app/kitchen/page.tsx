'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';
export type MenuItem = { id: string; name: string; price_cents: number };
export type OrderLine = { id: string; item?: MenuItem | null; qty: number; specs?: Record<string, string[]>; note?: string };
export type Order = { id: string; lines: OrderLine[]; total_cents: number; status: OrderStatus; created_at?: string; updated_at?: string };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function getCookie(name: string) {
  try {
    return document.cookie
      .split('; ')
      .find((x) => x.startsWith(name + '='))
      ?.split('=')[1];
  } catch {
    return undefined;
  }
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [mutating, setMutating] = useState(false);

  const pin = useMemo(() => decodeURIComponent(getCookie('kpin') || ''), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/orders', { cache: 'no-store', headers: { 'x-kitchen-pin': pin } });
      if (!r.ok) return;
      const list = (await r.json()) as Order[];
      setOrders(list);
    } catch {}
  }, [pin]);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const setOrderStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      setPendingIds((p) => ({ ...p, [id]: true }));
      setMutating(true);
      try {
        const r = await fetch(`/api/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-kitchen-pin': pin },
          body: JSON.stringify({ status }),
          cache: 'no-store',
        });
        if (!r.ok) throw new Error('patch failed');
        await load();
      } catch {}
      setPendingIds((p) => ({ ...p, [id]: false }));
      setMutating(false);
    },
    [pin, load],
  );

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-white text-gray-800">
      <div className="mx-auto max-w-3xl p-4">
        <header className="flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">👩‍🍳</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Kitchen-Dashboard</h1>
              <p className="text-xs text-gray-500">Bestellungen verwalten</p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50"
          >
            Zur Kunden-Ansicht
          </Link>
        </header>

        <main className="mt-6">
          <div className="grid grid-cols-1 gap-3">
            {orders.length === 0 && (
              <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Keine Bestellungen.</div>
            )}

            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    ID: <span className="font-mono">{o.id}</span>
                  </div>
                  <StatusBadge s={o.status} />
                </div>

                <div className="mt-2 divide-y text-sm">
                  {o.lines.map((l, i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="flex items-start justify-between py-2">
                      <div>
                        {l.qty}× {l.item?.name || 'Position'}
                        {l.specs && Object.keys(l.specs).length > 0 && (
                          <div className="text-xs text-gray-600">
                            {Object.entries(l.specs).map(([gid, arr]) => (
                              <span key={gid} className="mr-2">
                                <span className="font-medium">{gid}:</span> {arr.join(', ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-gray-100 px-3 py-1.5 text-sm"
                    disabled={pendingIds[o.id] || mutating}
                    onClick={() => setOrderStatus(o.id, 'in_queue')}
                  >
                    In Queue
                  </button>
                  <button
                    className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-800"
                    disabled={pendingIds[o.id] || mutating}
                    onClick={() => setOrderStatus(o.id, 'preparing')}
                  >
                    Preparing
                  </button>
                  <button
                    className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white"
                    disabled={pendingIds[o.id] || mutating}
                    onClick={() => setOrderStatus(o.id, 'ready')}
                  >
                    Ready
                  </button>
                  <button
                    className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800"
                    disabled={pendingIds[o.id] || mutating}
                    onClick={() => setOrderStatus(o.id, 'picked_up')}
                  >
                    Picked up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: OrderStatus }) {
  const map: Record<OrderStatus, { text: string; cls: string }> = {
    in_queue: { text: 'In Queue', cls: 'bg-gray-100 text-gray-700' },
    preparing: { text: 'Preparing', cls: 'bg-amber-100 text-amber-800' },
    ready: { text: 'Ready', cls: 'bg-emerald-600 text-white' },
    picked_up: { text: 'Picked up', cls: 'bg-sky-100 text-sky-800' },
  };
  const it = map[s];
  return <span className={`rounded-full px-2.5 py-1 text-xs ${it.cls}`}>{it.text}</span>;
}
