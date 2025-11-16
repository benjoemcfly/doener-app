'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MenuView,
  CheckoutView,
  StatusView,
  Dialog,
  CustomizeCard,
  sumCart,
} from '@/app/components';
import type { MenuItem, Order, OrderLine, OptionGroup } from '@/app/types/orders';
import { useReadyFeedback } from '@/hooks/useReadyFeedback';

// ==========================
// Tabs & Kategorien-Typ
// ==========================
const tabs = ['menu', 'checkout', 'status'] as const;
export type Tab = (typeof tabs)[number];

// Kategorien (nur als Typ-Export für andere Module wie CategoryNav/MenuView)
export const CATEGORY_TABS = [
  'Döner',
  'Folded',
  'Pide',
  'Bowls',
  'Vegan',
  'Fingerfood',
  'Getränke',
] as const;
export type Category = (typeof CATEGORY_TABS)[number];

// ==========================
// Menü-Konfiguration (Basis-Optionen)
// ==========================
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
      : {
          id: 'base',
          label: 'Basis',
          type: 'single',
          required: true,
          choices: [{ id: 'box', label: 'Box' }],
        },
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
      id: 'salat',
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

// Beispiel-Menü – aktuell ohne Kategorien, die Kategorie-Info kommt in MenuView/MenuCatalog
const MENU: MenuItem[] = [
  {
    id: 'doener_kebab',
    name: 'Döner Kebab',
    price_cents: 1900,
    emoji: '🥙',
    options: baseOptionGroups(),
  },
  {
    id: 'durum_kebab',
    name: 'Dürüm Kebab',
    price_cents: 2000,
    emoji: '🌯',
    options: baseOptionGroups(),
  },
  {
    id: 'doener_box',
    name: 'Döner Box',
    price_cents: 2100,
    emoji: '🍱',
    options: baseOptionGroups({ includeBread: false }),
  },
  {
    id: 'doener_teller',
    name: 'Döner Teller',
    price_cents: 2400,
    emoji: '🍽️',
    options: baseOptionGroups({ includeBread: false, limitedSalad: true }),
  },
];

// ==========================
// Hauptkomponente
// ==========================
export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart;

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{
    item: MenuItem;
    specs: Record<string, string[]>;
  } | null>(null);

  // Kontaktfeld (E-Mail)
  const [customerEmail, setCustomerEmail] = useState('');

  // Aktive Bestellung für Status-Tab
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  // Ready-UI
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [bannerText, setBannerText] = useState('');
  const [flashOn, setFlashOn] = useState(false);
  const [flashMs, setFlashMs] = useState(1500);

  const { soundEnabled, enableSound, trigger } = useReadyFeedback();

  // Service Worker für Vibration registrieren (best effort)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Polling für aktive Bestellung
  useEffect(() => {
    if (!activeOrderId) return;

    let stopped = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/orders/${activeOrderId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Order;
        if (stopped) return;

        setActiveOrder((prev) => {
          const wasReady = prev?.status === 'ready';
          const isReady = data.status === 'ready';

          if (!wasReady && isReady) {
            trigger();
            try {
              navigator.serviceWorker?.controller?.postMessage({
                type: 'VIBRATE',
                body: 'Deine Bestellung ist abholbereit!',
              });
            } catch {}

            setBannerText('Deine Bestellung ist abholbereit');
            setShowReadyBanner(true);
            setFlashMs(1500);
            setFlashOn(true);
            setTimeout(() => setFlashOn(false), 1500);
          }

          return data;
        });
      } catch {
        // Ignorieren – nächster Poll versucht es erneut
      }
    };

    fetchStatus();
    const t = setInterval(fetchStatus, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [activeOrderId, trigger]);

  // Cart-Helper
  const addToCart = useCallback((mi: MenuItem, specs?: Record<string, string[]>) => {
    setCart((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        item: mi,
        qty: 1,
        specs: specs ?? {},
      },
    ]);
  }, []);

  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) =>
          line.id === id
            ? {
                ...line,
                qty: Math.max(0, line.qty + delta),
              }
            : line,
        )
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const totalCents = useMemo(() => sumCart(lines), [lines]);

  const createOrder = useCallback(async () => {
    if (lines.length === 0) return;

    const payload: {
      lines: OrderLine[];
      total_cents: number;
      customer_email?: string;
    } = {
      lines,
      total_cents: totalCents,
    };

    if (customerEmail) payload.customer_email = customerEmail;

    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!res.ok) {
      alert('Fehler beim Absenden der Bestellung');
      return;
    }

    const data = (await res.json()) as { id: string } | { id: string; order: Order };
    const id = 'order' in data ? data.order.id : data.id;

    setActiveOrderId(id);
    setActiveOrder(null);
    setCart([]);
    setTab('status');
    setShowReadyBanner(false);
    setFlashOn(false);
  }, [customerEmail, lines, totalCents]);

  // Customize öffnen
  const openCustomize = useCallback((item: MenuItem) => {
    const initialSpecs = (item.options || []).reduce<Record<string, string[]>>((acc, g) => {
      acc[g.id] = g.type === 'single' && g.required && g.choices.length > 0 ? [g.choices[0].id] : [];
      return acc;
    }, {});

    setCustomizing({ item, specs: initialSpecs });
  }, []);

  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines]);

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased [font-feature-settings:'ss01'_'cv03']">
      {/* Flash-Overlay */}
      {flashOn && <GreenFlash durationMs={flashMs} />}

      {/* Top-Bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/20">🥙</div>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-[-0.015em]">Döner Self‑Ordering</div>
                <div className="text-[11px] text-neutral-500">Jetzt • 10–20 Min</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={enableSound}
                className={`rounded-full px-3 py-2 text-xs shadow-sm ring-1 ${
                  soundEnabled
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
                    : 'bg-black text-white ring-black/10'
                }`}
              >
                {soundEnabled ? '🔔 Ton aktiv' : '🔔 Ton aktivieren'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Inhalt */}
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-4">
        {tab === 'menu' && (
          <MenuView
            items={MENU}
            onQuickAdd={(mi) => addToCart(mi)}
            onCustomize={(mi) => openCustomize(mi)}
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

        {tab === 'status' && (
          <StatusView activeOrderId={activeOrderId} activeOrder={activeOrder} />
        )}
      </main>

      {/* Sticky Bottom Cart-Bar (nur im Menü) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 mx-auto max-w-5xl px-4 sm:bottom-20">
        {itemCount > 0 && tab === 'menu' && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full bg-neutral-900 px-4 py-3 text-white shadow-lg ring-1 ring-black/10">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm">{itemCount}</span>
              <span className="text-[13px]">Warenkorb</span>
            </div>
            <button
              className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900"
              onClick={() => setTab('checkout')}
            >
              Zur Kasse
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-3">
          {([
            { key: 'menu', label: 'Menü', icon: '🍴' },
            { key: 'checkout', label: 'Kasse', icon: '🧾' },
            { key: 'status', label: 'Status', icon: '⏱️' },
          ] as const).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex h-14 flex-col items-center justify-center text-[11px] ${
                tab === t.key ? 'font-semibold text-neutral-900' : 'text-neutral-600'
              }`}
            >
              <span className="text-lg">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Ready-Banner */}
      {showReadyBanner && (
        <div className="fixed left-1/2 top-3 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-full bg-emerald-600 px-4 py-2 text-white shadow-lg ring-1 ring-emerald-700/40">
            <span>🥙 {bannerText || 'Deine Bestellung ist abholbereit'}</span>
            <button
              onClick={() => setShowReadyBanner(false)}
              className="rounded-full bg-white/20 px-2 py-1 text-[12px] transition hover:bg-white/30"
            >
              Schließen
            </button>
          </div>
        </div>
      )}

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
            }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ========= Zusatz-Komponente: sanftes grünes Aufleuchten =========
function GreenFlash({ durationMs }: { durationMs: number }) {
  const [off, setOff] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOff(true), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-40 bg-emerald-200/60 transition-opacity ${
        off ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ transitionDuration: `${durationMs}ms` }}
    />
  );
}
