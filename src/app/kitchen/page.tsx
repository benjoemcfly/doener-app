'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

// ==========================
// Typen (minimal erweitert)
// ==========================
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

// Neu für Specs-Labels
type Choice = { id: string; label: string };
type OptionGroup = { id: string; label: string; type: 'single' | 'multi'; choices: Choice[] };

// Bestehendes MenuItem um options? ergänzt (rückwärtskompatibel)
export type MenuItem = { id: string; name: string; price_cents: number; options?: OptionGroup[] };

export type OrderLine = { id: string; item?: MenuItem | null; qty: number; specs?: Record<string, string[]>; note?: string };
export type Order = { id: string; lines: OrderLine[]; total_cents: number; status: OrderStatus; created_at?: string; updated_at?: string };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}
function getCookie(name: string) {
  try { return document.cookie.split('; ').find((x) => x.startsWith(name + '='))?.split('=')[1]; } catch { return undefined; }
}

// =====================================
// NEU: Mini-Komponente für Spezifikationen
// =====================================
function LineSpecs({ line }: { line: OrderLine }) {
  const item = line.item ?? undefined;
  const specs = line.specs ?? {};

  // Label-Lookups aus item.options; Fallbacks auf IDs
  const groupById = new Map<string, OptionGroup>();
  const choiceById = new Map<string, Choice>();
  (item?.options ?? []).forEach((g) => {
    groupById.set(g.id, g);
    g.choices.forEach((c) => choiceById.set(c.id, c));
  });

  const entries = Object.entries(specs).filter(([, ids]) => Array.isArray(ids) && ids.length > 0);
  if (entries.length === 0 && !line.note) return null;

  return (
    <div className="mt-1 space-y-1 text-[13px] leading-5">
      {entries.map(([groupId, ids]) => {
        const groupLabel = groupById.get(groupId)?.label ?? groupId;
        return (
          <div key={groupId} className="flex flex-wrap gap-1">
            <span className="font-medium text-gray-700 mr-1">{groupLabel}:</span>
            {ids.map((cid) => (
              <span key={cid} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
                {choiceById.get(cid)?.label ?? cid}
              </span>
            ))}
          </div>
        );
      })}

      {line.note ? (
        <div className="flex flex-wrap gap-1">
          <span className="font-medium text-amber-700">Notiz:</span>
          <span className="text-amber-700">{line.note}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [mutating, setMutating] = useState(false);
  const [pinError, setPinError] = useState(false);

  const pin = useMemo(() => decodeURIComponent(getCookie('kpin') || ''), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/orders', { cache: 'no-store', headers: { 'x-kitchen-pin': pin } });
      if (r.status === 403) { setPinError(true); setOrders([]); return; }
      setPinError(false);
      if (!r.ok) return;
      const list = (await r.json()) as Order[];
      setOrders(list);
    } catch {}
  }, [pin]);

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  const setOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    setPendingIds((p) => ({ ...p, [id]: true }));
    setMutating(true);
    try {
      const r = await fetch(`/api/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-kitchen-pin': pin }, body: JSON.stringify({ status }), cache: 'no-store' });
      if (!r.ok) throw new Error('patch failed');
      await load();
    } catch {}
    setPendingIds((p) => ({ ...p, [id]: false }));
    setMutating(false);
  }, [pin, load]);

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
          <div className="flex gap-2">
            <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Kunden-Ansicht</Link>
            <Link href="/kitchen/archive" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">Archiv</Link>
          </div>
        </header>

        {pinError && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            PIN ungültig oder geändert. <Link className="underline" href="/kitchen/login">Neu einloggen</Link>.
          </div>
        )}

        <main className="mt-6">
          <div className="grid grid-cols-1 gap-3">
            {orders.length === 0 && !pinError && (<div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Keine Bestellungen.</div>)}
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">ID: <span className="font-mono">{o.id}</span></div>
                  <StatusBadge s={o.status} />
                </div>
                <div className="mt-2 divide-y text-sm">
                  {o.lines.map((l, i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="py-2">
                      <div className="flex items-start justify-between">
                        <div className="font-medium">{l.qty}× {l.item?.name || 'Position'}</div>
                        <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                      </div>
                      {/* Spezifikationen + Notiz */}
                      <LineSpecs line={l} />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="rounded-full bg-gray-100 px-3 py-1.5 text-sm" disabled={pendingIds[o.id] || mutating} onClick={() => setOrderStatus(o.id, 'in_queue')}>In Queue</button>
                  <button className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-800" disabled={pendingIds[o.id] || mutating} onClick={() => setOrderStatus(o.id, 'preparing')}>Preparing</button>
                  <button className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white" disabled={pendingIds[o.id] || mutating} onClick={() => setOrderStatus(o.id, 'ready')}>Ready</button>
                  <button className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800" disabled={pendingIds[o.id] || mutating} onClick={() => setOrderStatus(o.id, 'picked_up')}>Picked up</button>
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
