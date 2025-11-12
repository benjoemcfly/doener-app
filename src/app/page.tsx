'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MenuView,
  CheckoutView,
  StatusView,
  Dialog,
  CustomizeCard,
  formatPrice,
  sumCart,
} from '@/app/components';
import type { MenuItem, Order, OrderLine, OptionGroup } from '@/app/types/order';
import { useReadyFeedback } from '@/app/hooks/useReadyFeedback';

// Tabs (nur Kunden-Ansicht)
const tabs = ['menu', 'checkout', 'status'] as const;
export type Tab = (typeof tabs)[number];

// Demo-Menü mit Options-Gruppen
const MENU: MenuItem[] = [
  { id: 'doener', name: 'Döner Kebab', price_cents: 850, emoji: '🥙', options: baseOptionGroups() },
  { id: 'durum', name: 'Dürüm', price_cents: 900, emoji: '🌯', options: baseOptionGroups() },
  { id: 'box', name: 'Döner Box', price_cents: 800, emoji: '🍱', options: baseOptionGroups({ includeBread: false }) },
  { id: 'lama', name: 'Lahmacun', price_cents: 700, emoji: '🫓', options: baseOptionGroups({ limitedSalad: true }) },
];

function baseOptionGroups(opts?: { includeBread?: boolean; limitedSalad?: boolean }): OptionGroup[] {
  const includeBread = opts?.includeBread ?? true;
  const limitedSalad = opts?.limitedSalad ?? false;
  const groups: OptionGroup[] = [
    includeBread
      ? {
          id: 'bread',
          label: 'Brot',
          type: 'single',
          required: true,
          choices: [
            { id: 'fladenbrot', label: 'Fladenbrot' },
            { id: 'yufka', label: 'Yufka' },
          ],
        }
      : ({
          id: 'base',
          label: 'Basis',
          type: 'single',
          required: true,
          choices: [{ id: 'box', label: 'Box' }],
        } as OptionGroup),
    {
      id: 'sauce',
      label: 'Soßen',
      type: 'multi',
      choices: [
        { id: 'knoblauch', label: 'Knoblauch' },
        { id: 'scharf', label: 'Scharf' },
        { id: 'cocktail', label: 'Cocktail' },
        { id: 'joghurt', label: 'Joghurt' },
      ],
    },
    {
      id: 'salad',
      label: 'Salat',
      type: 'multi',
      choices: limitedSalad
        ? [
            { id: 'salatmix', label: 'Salatmix' },
            { id: 'zwiebeln', label: 'Zwiebeln' },
          ]
        : [
            { id: 'salatmix', label: 'Salatmix' },
            { id: 'tomaten', label: 'Tomaten' },
            { id: 'zwiebeln', label: 'Zwiebeln' },
            { id: 'gurken', label: 'Gurken' },
            { id: 'kraut', label: 'Kraut' },
          ],
    },
    {
      id: 'spice',
      label: 'Schärfe',
      type: 'single',
      choices: [
        { id: 'mild', label: 'Mild' },
        { id: 'mittel', label: 'Mittel' },
        { id: 'scharf', label: 'Scharf' },
      ],
    },
  ];
  return groups;
}

export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart;

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{ item: MenuItem; specs: Record<string, string[]> } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const alreadyNotifiedRef = useRef(false);
  const { soundEnabled, enableSound, trigger } = useReadyFeedback();

  // Service Worker registrieren (für Vibration)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Status-Polling für aktive Order
  useEffect(() => {
    if (!activeOrderId) return;
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/orders/${activeOrderId}`, { cache: 'no-store' });
        if (!r.ok) return;
        const o = (await r.json()) as Order;
        setActiveOrder(o);
        if (o.status === 'ready' && !alreadyNotifiedRef.current) {
          alreadyNotifiedRef.current = true;
          trigger();
          try {
            navigator.serviceWorker?.controller?.postMessage({
              type: 'VIBRATE',
              body: 'Deine Bestellung ist ready!',
            });
          } catch {}
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [activeOrderId, trigger]);

  // Cart helpers
  const addToCart = useCallback((mi: MenuItem, specs?: Record<string, string[]>) => {
    setCart((prev) => [...prev, { id: crypto.randomUUID(), item: mi, qty: 1, specs: specs ?? {}, note: '' }]);
  }, []);
  const adjustQty = useCallback(
    (id: string, delta: number) => {
      setCart((prev) =>
        prev
          .map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
          .filter((l) => l.qty > 0)
      );
    },
    []
  );
  const removeLine = useCallback((id: string) => setCart((prev) => prev.filter((l) => l.id !== id)), []);
  const totalCents = useMemo(() => sumCart(lines), [lines]);

  // Order erstellen
  const createOrder = useCallback(async () => {
    if (!cart.length) return;
    const payload = { lines: cart, total_cents: totalCents, customer_email: customerEmail || undefined };
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    if (r.ok) {
      const { id } = (await r.json()) as { id: string };
      setActiveOrderId(id);
      setActiveOrder(null);
      setCart([]);
      setTab('status');
      alreadyNotifiedRef.current = false;
    } else {
      alert('Fehler beim Absenden');
    }
  }, [cart, totalCents, customerEmail]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-white text-gray-800">
      <div className="mx-auto max-w-3xl p-4">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow">🥙</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Döner Self-Ordering</h1>
              <p className="text-xs text-gray-500">MVP • Menü → Kasse → Status</p>
            </div>
          </div>
          <button
            onClick={enableSound}
            className={`rounded-full px-3 py-1.5 text-sm shadow ${
              soundEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white'
            }`}
          >
            {soundEnabled ? '🔔 Ton aktiv' : '🔔 Ton aktivieren'}
          </button>
        </header>

        {/* Tabs */}
        <nav className="mt-4 flex gap-2">
          {tabs.map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full px-4 py-2 text-sm shadow transition ${
                tab === key ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {key === 'menu' && 'Menü'}
              {key === 'checkout' && 'Kasse'}
              {key === 'status' && 'Status'}
            </button>
          ))}
        </nav>

        {/* Inhalte */}
        <main className="mt-6">
          {tab === 'menu' && (
            <MenuView
              items={MENU}
              onQuickAdd={(m) => addToCart(m)}
              onCustomize={(m, initialSpecs) => setCustomizing({ item: m, specs: initialSpecs })}
            />
          )}

          {tab === 'checkout' && (
            <CheckoutView
              lines={lines}
              totalCents={totalCents}
              customerEmail={customerEmail}
              onChangeEmail={setCustomerEmail}
              onAdjustQty={adjustQty}
              onRemoveLine={removeLine}
              onSubmit={createOrder}
            />
          )}

          {tab === 'status' && <StatusView activeOrderId={activeOrderId} activeOrder={activeOrder} />}
        </main>
      </div>

      {/* Modal: Customize */}
      {customizing && (
        <Dialog onClose={() => setCustomizing(null)}>
          <CustomizeCard
            item={customizing.item}
            initialSpecs={customizing.specs}
            onCancel={() => setCustomizing(null)}
            onConfirm={(specs) => {
              addToCart(customizing.item, specs);
              setCustomizing(null);
              setTab('checkout');
            }}
          />
        </Dialog>
      )}
    </div>
  );
}
