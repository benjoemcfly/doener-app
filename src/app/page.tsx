'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReadyFeedback } from '@/src/hooks/useReadyFeedback';

// ==========================
// Typen
// ==========================
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

export type MenuItem = {
  id: string;
  name: string;
  price_cents: number;
};

export type OrderLine = {
  id: string; // clientseitig generiert
  item?: MenuItem | null;
  qty: number;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  total_cents: number;
  status: OrderStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

// ==========================
// Hilfsfunktionen
// ==========================
const formatPrice = (cents: number) =>
  new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);

const nextStatus = (s: OrderStatus): OrderStatus =>
  s === 'in_queue' ? 'preparing' : s === 'preparing' ? 'ready' : s === 'ready' ? 'picked_up' : 'picked_up';

// stabile ID
const nid = () => Math.random().toString(36).slice(2, 10);

// ==========================
// Demo-Menü (Client-seitig)
// ==========================
const MENU: MenuItem[] = [
  { id: 'doener', name: 'Döner Kebab', price_cents: 850 },
  { id: 'durum', name: 'Dürüm', price_cents: 900 },
  { id: 'box', name: 'Döner Box', price_cents: 800 },
  { id: 'lama', name: 'Lahmacun', price_cents: 700 },
];

// ==========================
// Hauptkomponente
// ==========================
const tabs = ['menu', 'checkout', 'status', 'kitchen'] as const;
type Tab = typeof tabs[number];

export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');
  const [cart, setCart] = useState<OrderLine[]>([]);
  const [customerEmail, setCustomerEmail] = useState('');

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);

  const alreadyNotifiedRef = useRef(false);
  const { soundEnabled, enableSound, trigger } = useReadyFeedback();

  // Lokal gespeicherte Order-ID wiederherstellen
  useEffect(() => {
    try {
      const saved = localStorage.getItem('activeOrderId');
      if (saved) setActiveOrderId(saved);
    } catch {}
  }, []);

  // Total berechnen
  const totalCents = useMemo(
    () => cart.reduce((sum, l) => sum + (l.item?.price_cents || 0) * (l.qty || 0), 0),
    [cart],
  );

  // ==========================
  // Warenkorb-Aktionen
  // ==========================
  const addToCart = useCallback((m: MenuItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.item?.id === m.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      return [...prev, { id: nid(), item: m, qty: 1 }];
    });
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => (l.id ?? `${l.item?.id ?? 'item'}-x`) !== id));
  }, []);

  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  // ==========================
  // Order erstellen
  // ==========================
  const createOrder = useCallback(async () => {
    if (!cart.length) return;
    const payload = {
      lines: cart,
      total_cents: totalCents,
      customer_email: customerEmail.trim() || undefined,
    };
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      alert('Bestellung fehlgeschlagen');
      return;
    }
    const data = (await res.json()) as { id: string };
    setActiveOrderId(data.id);
    try {
      localStorage.setItem('activeOrderId', data.id);
    } catch {}
    setCart([]);
    setTab('status');
  }, [cart, totalCents, customerEmail]);

  // ==========================
  // Status-Polling (alle 4s)
  // ==========================
  useEffect(() => {
    if (!activeOrderId) return;

    const tick = async () => {
      try {
        const r = await fetch(`/api/orders/${activeOrderId}`, { cache: 'no-store' });
        if (!r.ok) return;
        const o = (await r.json()) as Order;
        setActiveOrder((prev) => {
          const prevStatus = prev?.status;
          if (prevStatus !== 'ready' && o.status === 'ready' && !alreadyNotifiedRef.current) {
            alreadyNotifiedRef.current = true;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              try {
                new Notification('Abholbereit!', { body: `Bestellung #${o.id} ist bereit.` });
              } catch {}
            }
            trigger();
          }
          return o;
        });
      } catch {}
    };

    tick();
    const id = setInterval(tick, 4000);
    return () => { clearInterval(id); };
  }, [activeOrderId, trigger]);

  // ==========================
  // Kitchen-Polling (alle 4s)
  // ==========================
  useEffect(() => {
    if (tab !== 'kitchen') return;

    const load = async () => {
      try {
        const r = await fetch('/api/orders', { cache: 'no-store' });
        if (!r.ok) return;
        const list = (await r.json()) as Order[];
        setKitchenOrders(list);
      } catch {}
    };

    load();
    const id = setInterval(load, 4000);
    return () => { clearInterval(id); };
  }, [tab]);

  // ==========================
  // Kitchen: Status wechseln (optimistisches Update)
  // ==========================
  const bumpStatus = useCallback(async (o: Order) => {
    const ns = nextStatus(o.status);

    // 1) Optimistisch sofort anzeigen
    setKitchenOrders((prev) => prev.map((k) => (k.id === o.id ? { ...k, status: ns } : k)));

    try {
      const r = await fetch(`/api/orders/${o.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: ns }),
        cache: 'no-store',
      });

      if (!r.ok) {
        // Rollback
        setKitchenOrders((prev) => prev.map((k) => (k.id === o.id ? { ...k, status: o.status } : k)));
        const msg = await r.text().catch(() => '');
        alert(`Statuswechsel fehlgeschlagen: ${msg || r.status}`);
        return;
      }

      // Mit Server-Wahrheit abgleichen
      const updated = (await r.json()) as Order;
      setKitchenOrders((prev) => prev.map((k) => (k.id === o.id ? { ...k, status: updated.status } : k)));
    } catch {
      // Rollback bei Netzwerkfehler
      setKitchenOrders((prev) => prev.map((k) => (k.id === o.id ? { ...k, status: o.status } : k)));
      alert('Statuswechsel fehlgeschlagen (Netzwerkfehler).');
    }
  }, []);

  // ==========================
  // Notifications-Erlaubnis (Button)
  // ==========================
  const [notifGranted, setNotifGranted] = useState(
    typeof Notification !== 'undefined' ? Notification.permission === 'granted' : false,
  );

  const askNotif = useCallback(async () => {
    try {
      if (typeof Notification === 'undefined') return;
      const p = await Notification.requestPermission();
      setNotifGranted(p === 'granted');
    } catch {}
  }, []);

  // ==========================
  // UI
  // ==========================
  return (
    <div className="mx-auto max-w-3xl p-4">
      <h1 className="text-2xl font-semibold">Döner Self-Ordering</h1>

      {/* Tabs */}
      <div className="mt-4 flex gap-2">
        {tabs.map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm shadow ${tab === key ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
          >
            {key === 'menu' && 'Menü'}
            {key === 'checkout' && 'Kasse'}
            {key === 'status' && 'Status'}
            {key === 'kitchen' && 'Kitchen'}
          </button>
        ))}
      </div>

      {/* Menü */}
      {tab === 'menu' && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {MENU.map((m) => (
            <div key={m.id} className="rounded-2xl border p-4 shadow-sm">
              <div className="font-medium">{m.name}</div>
              <div className="text-sm text-gray-600">{formatPrice(m.price_cents)}</div>
              <button onClick={() => addToCart(m)} className="mt-3 rounded-lg bg-emerald-600 px-3 py-1.5 text-white">In den Warenkorb</button>
            </div>
          ))}

          {/* Warenkorb */}
          <div className="col-span-1 sm:col-span-2">
            <h2 className="mt-6 text-lg font-semibold">Warenkorb</h2>
            <div className="mt-2 divide-y rounded-2xl border bg-white">
              {cart.length === 0 && <div className="p-4 text-sm text-gray-500">Noch leer.</div>}
              {cart.map((l, _i) => (
                <div key={l.id ?? `${l.item?.id ?? 'item'}-${_i}`} className="flex items-center justify-between gap-2 p-3">
                  <div className="truncate">
                    <div className="font-medium">{l.item?.name ?? 'Position'}</div>
                    <div className="text-sm text-gray-500">{formatPrice(l.item?.price_cents || 0)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => adjustQty(l.id, -1)} className="rounded-full border px-2 py-1" aria-label="Menge verringern">−</button>
                    <div className="w-6 text-center tabular-nums">{l.qty}</div>
                    <button onClick={() => adjustQty(l.id, +1)} className="rounded-full border px-2 py-1" aria-label="Menge erhöhen">+</button>
                    <button onClick={() => removeLine(l.id)} className="rounded-md border px-2 py-1 text-sm">Entfernen</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="text-base font-medium">Summe</div>
              <div className="text-base font-semibold">{formatPrice(totalCents)}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="E-Mail (optional, für Ready-Mail)" className="w-full rounded-lg border px-3 py-2" />
              <button onClick={() => setTab('checkout')} className="rounded-lg bg-sky-600 px-4 py-2 text-white">Zur Kasse</button>
            </div>
          </div>
        </div>
      )}

      {/* Kasse */}
      {tab === 'checkout' && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Kasse</h2>
          <div className="mt-2 rounded-2xl border bg-white p-4">
            <div className="text-sm text-gray-700">Bitte überprüfe deine Bestellung. Du kannst optional eine E-Mail angeben, um beim Status <span className="rounded bg-gray-100 px-1 py-0.5">ready</span> zusätzlich eine Mail zu erhalten.</div>
            <div className="mt-3 divide-y">
              {cart.map((l, _i) => (
                <div key={l.id ?? `${l.item?.id ?? 'item'}-${_i}`} className="flex justify-between py-2 text-sm">
                  <div>{l.qty}× {l.item?.name}</div>
                  <div>{formatPrice((l.item?.price_cents || 0) * l.qty)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between border-t pt-3">
              <div className="text-base font-medium">Summe</div>
              <div className="text-base font-semibold">{formatPrice(totalCents)}</div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="E-Mail (optional)" className="w-full rounded-lg border px-3 py-2" />
              <button onClick={createOrder} disabled={cart.length === 0} className="rounded-lg bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50">Bestellung abschicken</button>
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      {tab === 'status' && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Bestell-Status</h2>
          {!activeOrderId && (
            <div className="mt-2 rounded-2xl border bg-white p-4">
              <div className="text-sm text-gray-600">Noch keine aktive Bestellung gefunden. Du kannst eine Order-ID eingeben, um den Status zu verfolgen.</div>
              <ManualOrderId onPick={(id) => { setActiveOrderId(id); try { localStorage.setItem('activeOrderId', id); } catch {} }} />
            </div>
          )}
          {activeOrderId && (
            <div className="mt-3 rounded-2xl border bg-white p-4">
              <div className="text-sm text-gray-600">Order-ID: <span className="font-mono">{activeOrderId}</span></div>
              <div className="mt-2 text-base">Status: <StatusBadge s={activeOrder?.status} /></div>
              {activeOrder?.status === 'ready' && (
                <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-emerald-800">Abholbereit! Bitte zur Theke kommen und die Bestellnummer nennen.</div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!notifGranted && (
                  <button onClick={askNotif} className="rounded-lg border px-3 py-1.5 text-sm">Push-Popup erlauben</button>
                )}
                {!soundEnabled && (
                  <button onClick={enableSound} className="rounded-lg border px-3 py-1.5 text-sm">🔔 Ton aktivieren</button>
                )}
                <button onClick={() => { setActiveOrderId(null); try { localStorage.removeItem('activeOrderId'); } catch {} setActiveOrder(null); }} className="rounded-lg border px-3 py-1.5 text-sm">Andere Bestellung verfolgen</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kitchen */}
      {tab === 'kitchen' && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Kitchen-Dashboard</h2>
          <div className="mt-3 grid grid-cols-1 gap-3">
            {kitchenOrders.length === 0 && <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Keine Bestellungen.</div>}
            {kitchenOrders.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">ID: <span className="font-mono">{o.id}</span></div>
                  <StatusBadge s={o.status} />
                </div>
                <div className="mt-2 divide-y">
                  {o.lines.map((l, _i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${_i}`} className="flex items-center justify-between py-2 text-sm">
                      <div>{l.qty}× {l.item?.name || 'Position'}</div>
                      <div className="text-gray-500">{formatPrice((l.item?.price_cents || 0) * l.qty)}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <div className="text-sm font-medium">Summe</div>
                  <div className="text-sm font-semibold">{formatPrice(o.total_cents)}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  {o.status !== 'picked_up' && (
                    <button onClick={() => bumpStatus(o)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-white">Nächster Status → {nextStatus(o.status)}</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!soundEnabled && (
        <button onClick={enableSound} className="fixed bottom-4 right-4 hidden rounded-full bg-emerald-600 px-4 py-2 text-white shadow-lg sm:block" aria-label="Benachrichtigungs-Ton aktivieren">🔔 Ton aktivieren</button>
      )}
    </div>
  );
}

// ==========================
// Kleinere UI-Bausteine
// ==========================
function StatusBadge({ s }: { s?: OrderStatus | null }) {
  const cls = s === 'ready' ? 'bg-emerald-100 text-emerald-700' : s === 'preparing' ? 'bg-amber-100 text-amber-700' : s === 'picked_up' ? 'bg-gray-100 text-gray-700' : 'bg-sky-100 text-sky-700';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{s ?? '—'}</span>;
}

function ManualOrderId({ onPick }: { onPick: (id: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Order-ID eingeben" className="flex-1 rounded-lg border px-3 py-2" />
      <button onClick={() => v && onPick(v.trim())} className="rounded-lg bg-sky-600 px-3 py-2 text-white">Laden</button>
    </div>
  );
}
