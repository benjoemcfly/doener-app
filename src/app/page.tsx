'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { MenuView } from '@/app/components/MenuView';
import { MiniCart } from '@/app/components/MiniCart';
import { CheckoutView } from '@/app/components/CheckoutView';
import { StatusView } from '@/app/components/StatusView';
import { Dialog } from '@/app/components/Dialog';
import { CustomizeCard } from '@/app/components/CustomizeCard';
import { formatPrice, sumCart } from '@/app/components/helpers';

import type {
  MenuItem,
  Order,
  OrderLine,
  OptionGroup,
} from '@/types/orders';

import { useReadyFeedback } from '@/hooks/useReadyFeedback';

// ==========================
// Tabs & Kategorien
// ==========================
const TABS = ['menu', 'checkout', 'status'] as const;
export type Tab = (typeof TABS)[number];

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
// Menü-Konfiguration (Optionen & Gerichte)
// ==========================
function baseOptionGroups(opts?: {
  includeBread?: boolean;
  limitedSalad?: boolean;
}): OptionGroup[] {
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

// Komplettes Menü nach Kategorien
const MENU_BY_CATEGORY: Record<Category, MenuItem[]> = {
  Döner: [
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
      options: baseOptionGroups({ includeBread: false }),
    },
  ],
  Folded: [
    {
      id: 'folded_istanbul',
      name: 'Istanbul Folded',
      price_cents: 2300,
      emoji: '🫓',
    },
    {
      id: 'folded_guadalajara',
      name: 'Guadalajara Folded',
      price_cents: 2300,
      emoji: '🫓',
    },
  ],
  Pide: [
    {
      id: 'pide_doener',
      name: 'Pide Döner & Mozzarella',
      price_cents: 2400,
      emoji: '🫓',
    },
    {
      id: 'pide_spinat_feta',
      name: 'Pide Spinat & Feta',
      price_cents: 2200,
      emoji: '🧀',
    },
    {
      id: 'pide_champignons',
      name: 'Pide Champignons & Frischkäse',
      price_cents: 2300,
      emoji: '🍄',
    },
    {
      id: 'pide_feige_ricotta_burrata_honig',
      name: 'Pide Feige, Ricotta, Burrata & Honig',
      price_cents: 2500,
      emoji: '🍯',
    },
    {
      id: 'pide_sucuk_cheddar',
      name: 'Pide Sucuk & Cheddar',
      price_cents: 2400,
      emoji: '🧀',
    },
    {
      id: 'pide_guacamole_rucola_feta',
      name: 'Pide Guacamole, Rucola & Feta',
      price_cents: 2400,
      emoji: '🥑',
    },
  ],
  Bowls: [
    {
      id: 'bowl_beirut',
      name: 'Beirut Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
    {
      id: 'bowl_istanbul',
      name: 'Istanbul Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
    {
      id: 'bowl_guadalajara',
      name: 'Guadalajara Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
  ],
  Vegan: [
    {
      id: 'falafel',
      name: 'Falafel',
      price_cents: 1500,
      emoji: '🧆',
    },
    {
      id: 'karotte_baellchen',
      name: 'Karottenbällchen',
      price_cents: 1500,
      emoji: '🥕',
    },
    {
      id: 'zucchini_baellchen',
      name: 'Zucchinibällchen',
      price_cents: 1500,
      emoji: '🥒',
    },
  ],
  Fingerfood: [
    {
      id: 'chicken_nuggets',
      name: 'Chicken Nuggets',
      price_cents: 1500,
      emoji: '🍗',
    },
    {
      id: 'pommes',
      name: 'Pommes',
      price_cents: 800,
      emoji: '🍟',
    },
  ],
  Getränke: [
    {
      id: 'ayran',
      name: 'Ayran',
      price_cents: 500,
      emoji: '🥤',
    },
    {
      id: 'bier',
      name: 'Bier',
      price_cents: 600,
      emoji: '🍺',
    },
    {
      id: 'dose_033',
      name: 'Softdrink Dose 0.33L',
      price_cents: 400,
      emoji: '🥤',
    },
    {
      id: 'flasche_033',
      name: 'Softdrink Flasche 0.33L',
      price_cents: 600,
      emoji: '🧃',
    },
  ],
};

// ==========================
// LocalStorage & Utils
// ==========================
const LS_KEY = 'order_ids_v1';
const ARCHIVE_LS_KEY = 'order_archive_v1';
const todayStr = () => new Date().toISOString().slice(0, 10);

// ==========================
// Hauptseite
// ==========================
export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart;
  const miniCartRef = useRef<HTMLDivElement | null>(null);

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{
    item: MenuItem;
    specs: Record<string, string[]>;
  } | null>(null);

  // Kontaktfelder
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Mehrere Bestellungen
  const [orderIds, setOrderIds] = useState<string[]>([]); // neueste zuerst
  const [ordersById, setOrdersById] = useState<Record<string, Order | null>>(
    {},
  );

  // Archiv (nur lokal, Tages-Reset)
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [archiveById, setArchiveById] = useState<Record<string, Order>>({});
  const [showArchive, setShowArchive] = useState(false);

  // Ready-UI: Banner + Flash
  const [showReadyBanner, setShowReadyBanner] = useState(false);
  const [bannerText, setBannerText] = useState<string>('');
  const [flashOn, setFlashOn] = useState(false);
  const [flashMs, setFlashMs] = useState<number>(1500);
  const allReadyRef = useRef(false);

  // Benachrichtigung pro Order einmalig
  const notifiedRef = useRef<Record<string, boolean>>({});
  const { soundEnabled, enableSound, trigger } = useReadyFeedback();

  // Service Worker registrieren (Vibration)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Order-IDs aus localStorage laden
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const ids = JSON.parse(raw) as string[];
        if (Array.isArray(ids) && ids.length) setOrderIds(ids);
      }
    } catch {
      // ignore
    }
  }, []);

  // Archiv aus localStorage laden (nur für heute)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_LS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as {
        date: string;
        ids: string[];
        byId: Record<string, Order>;
      };
      if (obj?.date === todayStr()) {
        setArchiveIds(obj.ids || []);
        setArchiveById(obj.byId || {});
      } else {
        localStorage.removeItem(ARCHIVE_LS_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const persistIds = useCallback((ids: string[]) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }, []);

  const persistArchive = useCallback(
    (ids: string[], byId: Record<string, Order>) => {
      try {
        localStorage.setItem(
          ARCHIVE_LS_KEY,
          JSON.stringify({ date: todayStr(), ids, byId }),
        );
      } catch {
        // ignore
      }
    },
    [],
  );

  // Polling aller bekannten Orders (5s)
  useEffect(() => {
    if (orderIds.length === 0) return;

    let stopped = false;

    const fetchAll = async () => {
      const updated: Record<string, Order | null> = {};

      for (const id of orderIds) {
        try {
          const r = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
          if (!r.ok) continue;
          const o = (await r.json()) as Order;
          if (stopped) return;

          updated[id] = o;

          if (o.status === 'ready' && !notifiedRef.current[id]) {
            notifiedRef.current[id] = true;
            trigger();
            try {
              navigator.serviceWorker?.controller?.postMessage({
                type: 'VIBRATE',
                body: 'Eine Bestellung ist abholbereit!',
              });
            } catch {
              // ignore
            }
            setBannerText('Eine Bestellung ist abholbereit');
            setShowReadyBanner(true);
            setFlashMs(1500);
            setFlashOn(true);
            setTimeout(() => setFlashOn(false), 1500);
          }
        } catch {
          // ignore einzelne Order
        }
      }

      setOrdersById((prev) => {
        const merged = { ...prev, ...updated };

        const now = Date.now();
        const toArchive: string[] = [];

        for (const id of orderIds) {
          const o = merged[id];
          if (!o || o.status !== 'picked_up') continue;
          const t = new Date(o.updated_at || o.created_at || '').getTime();
          if (!Number.isFinite(t)) continue;
          if (now - t >= 3 * 60 * 1000) toArchive.push(id);
        }

        if (toArchive.length) {
          setOrderIds((prevIds) => {
            const next = prevIds.filter((id) => !toArchive.includes(id));
            persistIds(next);
            return next;
          });

          setArchiveById((prevArch) => {
            const add: Record<string, Order> = {};
            for (const id of toArchive) add[id] = merged[id]!;
            const nextById = { ...prevArch, ...add };

            setArchiveIds((prevA) => {
              const nextIds = [
                ...toArchive.filter((id) => !prevA.includes(id)),
                ...prevA,
              ];
              persistArchive(nextIds, nextById);
              return nextIds;
            });

            return nextById;
          });
        }

        const allKnown =
          orderIds.length > 0 &&
          orderIds.every((id) => merged[id]?.status === 'ready');

        if (allKnown && !allReadyRef.current) {
          allReadyRef.current = true;
          setBannerText('Alle Bestellungen sind abholbereit');
          setShowReadyBanner(true);
          setFlashMs(3000);
          setFlashOn(true);
          setTimeout(() => setFlashOn(false), 3000);
        }
        if (!allKnown) {
          allReadyRef.current = false;
        }

        return merged;
      });
    };

    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [orderIds, trigger, persistIds, persistArchive]);

  // Cart-Helper
  const addToCart = useCallback(
    (mi: MenuItem, specs?: Record<string, string[]>) => {
      setCart((prev) => {
        const next: OrderLine[] = [
          ...prev,
          {
            id: crypto.randomUUID(),
            item: mi,
            qty: 1,
            specs: specs ?? {},
            note: '',
          },
        ];
        queueMicrotask(() =>
          miniCartRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          }),
        );
        return next;
      });
    },
    [],
  );

  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l,
        )
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const totalCents = useMemo(() => sumCart(lines), [lines]);

  // Bestellung erstellen (inkl. SMS-Feld)
  const createOrder = useCallback(async () => {
    if (!cart.length) return;

    const payload: {
      lines: OrderLine[];
      total_cents: number;
      customer_email?: string;
      customer_phone?: string;
    } = {
      lines: cart,
      total_cents: totalCents,
    };

    if (customerEmail) payload.customer_email = customerEmail;
    if (customerPhone) payload.customer_phone = customerPhone;

    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (r.ok) {
      const { id } = (await r.json()) as { id: string };
      setCart([]);
      setTab('status');
      setShowReadyBanner(false);
      setShowArchive(false);
      allReadyRef.current = false;
      setFlashOn(false);

      setOrderIds((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)];
        persistIds(next);
        return next;
      });

      setOrdersById((prev) => ({ ...prev, [id]: null }));
      notifiedRef.current[id] = false;
      setCustomerPhone('');
    } else {
      alert('Fehler beim Absenden');
    }
  }, [
    cart,
    totalCents,
    customerEmail,
    customerPhone,
    persistIds,
  ]);

  // Beim Klick auf ein Gericht: Konfigurator öffnen
  const openCustomize = useCallback((m: MenuItem) => {
    const initialSpecs = (m.options || []).reduce<Record<string, string[]>>(
      (acc, g) => {
        acc[g.id] =
          g.type === 'single' && g.required && g.choices.length > 0
            ? [g.choices[0].id]
            : [];
        return acc;
      },
      {},
    );
    setCustomizing({ item: m, specs: initialSpecs });
  }, []);

  const itemCount = useMemo(
    () => lines.reduce((a, l) => a + l.qty, 0),
    [lines],
  );

  // ==========================
  // Render
  // ==========================
  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased [font-feature-settings:'ss01'_'cv03']">
      {/* Flash-Overlay */}
      {flashOn && <GreenFlash durationMs={flashMs} />}

      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-700/20">
                🥙
              </div>
              <div className="leading-tight">
                <div className="text-[15px] font-semibold tracking-[-0.015em]">
                  Döner Self-Ordering
                </div>
                <div className="text-[11px] text-neutral-500">
                  Jetzt • 10–20 Min
                </div>
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

          {/* Suchfeld (noch ohne Logik) */}
          <div className="pb-3">
            <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-500 shadow-sm">
              <span>🔎</span>
              <input
                placeholder="Gericht suchen…"
                className="w-full bg-transparent outline-none"
                onChange={() => {}}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* MENÜ */}
        {tab === 'menu' && (
          <>
            <MenuView
              categories={CATEGORY_TABS}
              menuByCategory={MENU_BY_CATEGORY}
              onQuickAdd={addToCart}
              onCustomize={openCustomize}
            />

            {/* Mini-Warenkorb unterhalb des Menüs */}
            <div ref={miniCartRef} className="mt-6 pb-28">
              <MiniCart
                lines={lines}
                totalCents={totalCents}
                onAdjustQty={adjustQty}
                onRemoveLine={removeLine}
                onGoCheckout={() => setTab('checkout')}
              />
            </div>
          </>
        )}

        {/* CHECKOUT */}
        {tab === 'checkout' && (
          <section className="pb-28">
            <CheckoutView
              lines={lines}
              totalCents={totalCents}
              customerEmail={customerEmail}
              customerPhone={customerPhone}
              onChangeEmail={setCustomerEmail}
              onChangePhone={setCustomerPhone}
              onAdjustQty={adjustQty}
              onRemoveLine={removeLine}
              onSubmit={createOrder}
            />
          </section>
        )}

        {/* STATUS */}
        {tab === 'status' && (
          <section className="pb-28">
            <StatusView
              orderIds={orderIds}
              ordersById={ordersById}
              archiveIds={archiveIds}
              archiveById={archiveById}
              showArchive={showArchive}
              onToggleArchive={() => setShowArchive((v) => !v)}
            />
          </section>
        )}
      </main>

      {/* Sticky Bottom Cart-Bar (nur im Menü) */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 mx-auto max-w-5xl px-4 sm:bottom-20">
        {itemCount > 0 && tab === 'menu' && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full bg-neutral-900 px-4 py-3 text-white shadow-lg ring-1 ring-black/10">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm">
                {itemCount}
              </span>
            </div>
            <button
              className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900"
              onClick={() => setTab('checkout')}
            >
              {formatPrice(totalCents)} · Ansehen
            </button>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid max-w-5xl grid-cols-3">
          {(
            [
              { key: 'menu', label: 'Menü', icon: '🍴' },
              { key: 'checkout', label: 'Kasse', icon: '🧾' },
              { key: 'status', label: 'Status', icon: '⏱️' },
            ] as const
          ).map((t) => (
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
    const start = setTimeout(() => setOff(true), 50);
    return () => clearTimeout(start);
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
