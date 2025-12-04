'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useReadyFeedback } from '@/hooks/useReadyFeedback';

import {
  CATEGORY_TABS,
} from '@/types/order';
import type {
  OrderStatus,
  MenuItem,
  OptionGroup,
  OrderLine,
  Order,
  Category,
} from '@/types/order';

import { GreenFlash } from '@/app/components/GreenFlash';
import { Dialog, CustomizeCard } from '@/app/components/CustomizeDialog';
import { MenuView } from '@/app/components/MenuView';
import { CheckoutView } from '@/app/components/CheckoutView';
import { StatusView } from '@/app/components/StatusView';

// ==========================
// Kategorien & Menüdaten
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

// Menü-Einträge pro Kategorie (Preise in CHF -> *100)
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
    { id: 'falafel', name: 'Falafel', price_cents: 1500, emoji: '🧆' },
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
    { id: 'pommes', name: 'Pommes', price_cents: 800, emoji: '🍟' },
  ],
  Getränke: [
    { id: 'ayran', name: 'Ayran', price_cents: 500, emoji: '🥤' },
    { id: 'bier', name: 'Bier', price_cents: 600, emoji: '🍺' },
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
// Utils
// ==========================

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });
}

function sumCart(lines: OrderLine[]) {
  return lines.reduce(
    (acc, l) => acc + (l.item?.price_cents ?? 0) * l.qty,
    0,
  );
}

const LS_KEY = 'order_ids_v1';
const ARCHIVE_LS_KEY = 'order_archive_v1';
const todayStr = () => new Date().toISOString().slice(0, 10);

// 🔒 Backup-Key für Warenkorb bei TWINT-Zahlungen
const PENDING_CART_KEY = 'twint_pending_cart_v1';

type PendingCartBackup = {
  lines: OrderLine[];
  customerEmail?: string;
  customerPhone?: string;
};

// ==========================
// Tabs (nur Kunden-Ansicht)
// ==========================

const tabs = ['menu', 'checkout', 'status'] as const;
export type Tab = (typeof tabs)[number];

export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');
  const [activeCategory, setActiveCategory] =
    useState<Category>('Döner');

  const paymentHandledRef = useRef(false);

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart;

  // Abschnitt-Refs (für Scroll-to)
  const sectionRefs = useRef<Record<Category, HTMLDivElement | null>>(
    {} as Record<Category, HTMLDivElement | null>,
  );

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{
    item: MenuItem;
    specs: Record<string, string[]>;
  } | null>(null);

  // Kontaktfelder
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Mehrere Bestellungen: IDs & Map mit Daten (aktiv)
  const [orderIds, setOrderIds] = useState<string[]>([]); // neueste zuerst
  const [ordersById, setOrdersById] = useState<
    Record<string, Order | null>
  >({});

  // Archiv (nur lokaler Client; Tages-Reset)
  const [archiveIds, setArchiveIds] = useState<string[]>([]);
  const [archiveById, setArchiveById] = useState<
    Record<string, Order>
  >({});
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

  // Online-Payment (TWINT) Loading-State
  const [isTwintPaying, setIsTwintPaying] = useState(false);

  // Service Worker registrieren (für Vibration im aktiven Tab)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {});
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
    } catch {}
  }, []);

  // Archiv aus localStorage laden (aber nur für HEUTE)
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
        localStorage.removeItem(ARCHIVE_LS_KEY); // Tageswechsel -> leeren
      }
    } catch {}
  }, []);

  const persistIds = useCallback((ids: string[]) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(ids));
    } catch {}
  }, []);

  const persistArchive = useCallback(
    (ids: string[], byId: Record<string, Order>) => {
      try {
        localStorage.setItem(
          ARCHIVE_LS_KEY,
          JSON.stringify({ date: todayStr(), ids, byId }),
        );
      } catch {}
    },
    [],
  );

  // Polling aller bekannten Orders (alle 5s)
  useEffect(() => {
    if (orderIds.length === 0) return;

    let stopped = false;
    const fetchAll = async () => {
      const updated: Record<string, Order | null> = {};
      for (const id of orderIds) {
        try {
          const r = await fetch(`/api/orders/${id}`, {
            cache: 'no-store',
          });
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
            } catch {}
            setBannerText('Eine Bestellung ist abholbereit');
            setShowReadyBanner(true);
            setFlashMs(1500);
            setFlashOn(true);
            setTimeout(() => setFlashOn(false), 1500);
          }
        } catch {}
      }

      setOrdersById((prev) => {
        const merged = { ...prev, ...updated };

        const now = Date.now();
        const toArchive: string[] = [];
        for (const id of orderIds) {
          const o = merged[id];
          if (!o || o.status !== 'picked_up') continue;
          const t = new Date(
            o.updated_at || o.created_at || '',
          ).getTime();
          if (!Number.isFinite(t)) continue;
          if (now - t >= 3 * 60 * 1000) toArchive.push(id);
        }

        if (toArchive.length) {
          setOrderIds((prevIds) => {
            const next = prevIds.filter(
              (id) => !toArchive.includes(id),
            );
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
          orderIds.every(
            (id) => merged[id]?.status === 'ready',
          );
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

  // Cart helpers
  const addToCart = useCallback(
    (mi: MenuItem, specs?: Record<string, string[]>) => {
      setCart((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          item: mi,
          qty: 1,
          specs: specs ?? {},
          note: '',
        },
      ]);
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

  const removeLine = useCallback(
    (id: string) =>
      setCart((prev) => prev.filter((l) => l.id !== id)),
    [],
  );

  const totalCents = useMemo(
    () => sumCart(lines),
    [lines],
  );

  // Gemeinsame Folge-Aktionen nach erfolgreichem Order-POST
  const afterOrderCreated = useCallback(
    (id: string) => {
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
    },
    [persistIds],
  );

  // Bestellung erstellen (ohne Online-Zahlung – z.B. Barzahlung vor Ort)
  const createOrder = useCallback(async () => {
    if (!cart.length) return;

    const payload: {
      lines: OrderLine[];
      total_cents: number;
      customer_email?: string;
      customer_phone?: string;
    } = { lines: cart, total_cents: totalCents };
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
      afterOrderCreated(id);
    } else {
      alert('Fehler beim Absenden');
    }
  }, [
    cart,
    totalCents,
    customerEmail,
    customerPhone,
    afterOrderCreated,
  ]);

  // Bestellung erstellen + TWINT-Zahlung über Payrexx starten
  const payWithTwint = useCallback(async () => {
    if (!cart.length) return;

    // 🔒 Warenkorb & Kontaktdaten sichern
    const backup: PendingCartBackup = {
      lines: cart,
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
    };
    try {
      localStorage.setItem(
        PENDING_CART_KEY,
        JSON.stringify(backup),
      );
    } catch {
      // ignore
    }

    const payload: {
      lines: OrderLine[];
      total_cents: number;
      customer_email?: string;
      customer_phone?: string;
    } = { lines: cart, total_cents: totalCents };
    if (customerEmail) payload.customer_email = customerEmail;
    if (customerPhone) payload.customer_phone = customerPhone;

    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    if (!r.ok) {
      alert('Fehler beim Absenden');
      return;
    }

    const { id } = (await r.json()) as { id: string };
    afterOrderCreated(id);

    try {
      setIsTwintPaying(true);
      const pr = await fetch('/api/payments/payrexx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id }),
      });
      const pj = await pr.json();
      if (!pr.ok || !pj?.redirectUrl) {
        console.error('Payrexx error', pj);
        alert(
          'Deine Bestellung wurde erstellt, aber die Online-Zahlung konnte nicht gestartet werden. Bitte bezahle vor Ort.',
        );
        try {
          localStorage.removeItem(PENDING_CART_KEY);
        } catch {}
        return;
      }
      // Redirect zur sicheren Payrexx / TWINT-Seite
      window.location.href = pj.redirectUrl as string;
    } catch (err) {
      console.error(err);
      alert(
        'Deine Bestellung wurde erstellt, aber es gab einen Fehler beim Starten der Online-Zahlung. Bitte bezahle vor Ort.',
      );
      try {
        localStorage.removeItem(PENDING_CART_KEY);
      } catch {}
    } finally {
      setIsTwintPaying(false);
    }
  }, [
    cart,
    totalCents,
    customerEmail,
    customerPhone,
    afterOrderCreated,
  ]);

  // Handling: Rückkehr von der Payrexx/TWINT-Seite
  useEffect(() => {
    // nur einmal pro Mount
    if (paymentHandledRef.current) return;
    paymentHandledRef.current = true;

    if (typeof window === 'undefined') {
      return;
    }

    const search = window.location.search;

    try {
      const params = new URLSearchParams(search);
      const payment = params.get('payment');
      if (!payment) {
        return;
      }

      // URL aufräumen (Query entfernen, damit ein Reload sauber ist)
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState(null, '', cleanUrl);

      if (payment === 'success') {
        setTab('status');
        try {
          localStorage.removeItem(PENDING_CART_KEY);
        } catch {
          // ignore
        }
      } else {
        let restored = false;
        try {
          const raw = localStorage.getItem(PENDING_CART_KEY);
          if (raw) {
            const backup = JSON.parse(raw) as PendingCartBackup;
            setCart(backup.lines || []);
            setCustomerEmail(backup.customerEmail || '');
            setCustomerPhone(backup.customerPhone || '');
            restored = true;
          }
          localStorage.removeItem(PENDING_CART_KEY);
        } catch {
          // ignore
        }

        setTab('checkout');
        if (restored) {
          alert(
            'Die TWINT-Zahlung wurde abgebrochen oder war nicht erfolgreich. Dein Warenkorb wurde wiederhergestellt.',
          );
        } else {
          alert(
            'Die TWINT-Zahlung wurde abgebrochen oder war nicht erfolgreich.',
          );
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Beim Klick auf ein Gericht: direkt Konfigurator öffnen
  const openCustomize = useCallback((m: MenuItem) => {
    const initialSpecs = (m.options || []).reduce<
      Record<string, string[]>
    >((acc, g) => {
      acc[g.id] =
        g.type === 'single' &&
        g.required &&
        g.choices.length > 0
          ? [g.choices[0].id]
          : [];
      return acc;
    }, {});
    setCustomizing({ item: m, specs: initialSpecs });
  }, []);

  // Scroll-Sync für die Kategorien-Leiste (IntersectionObserver)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        let bestCat: Category | null = null;
        let bestOffset = Number.POSITIVE_INFINITY;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const cat = el.dataset.cat as Category | undefined;
          if (!cat) continue;

          const offset = Math.abs(entry.boundingClientRect.top);
          if (offset < bestOffset) {
            bestOffset = offset;
            bestCat = cat;
          }
        }

        if (bestCat) {
          setActiveCategory((prev) =>
            prev === bestCat ? prev : bestCat,
          );
        }
      },
      {
        threshold: 0.4,
        rootMargin: '-140px 0px 0px 0px',
      },
    );

    (CATEGORY_TABS as readonly Category[]).forEach((cat) => {
      const el = sectionRefs.current[cat];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // ==========================
  // UI
  // ==========================

  const itemCount = useMemo(
    () => lines.reduce((a, l) => a + l.qty, 0),
    [lines],
  );

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

          {/* Suchfeld */}
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

        {/* Fixierte Kategorien-Leiste */}
        <div className="border-t border-neutral-100 bg-white/95">
          <nav className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto px-4 pb-1 pt-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {(CATEGORY_TABS as readonly Category[]).map((c) => (
              <button
                key={c}
                onClick={() => {
                  setActiveCategory(c);
                  const el = sectionRefs.current[c];
                  if (el) {
                    el.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }
                }}
                className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition ${
                  activeCategory === c
                    ? 'text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                <span>{c}</span>
                {activeCategory === c && (
                  <span className="absolute inset-x-1 -bottom-1 block h-[3px] rounded-full bg-neutral-900" />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* MENU */}
        {tab === 'menu' && (
          <MenuView
            categories={CATEGORY_TABS}
            menuByCategory={MENU_BY_CATEGORY}
            lines={lines}
            totalCents={totalCents}
            sectionRefs={sectionRefs}
            onQuickAdd={addToCart}
            onCustomize={openCustomize}
            onAdjustQty={adjustQty}
            onRemoveLine={removeLine}
            onGoCheckout={() => setTab('checkout')}
          />
        )}

        {/* CHECKOUT */}
        {tab === 'checkout' && (
          <CheckoutView
            lines={lines}
            totalCents={totalCents}
            customerEmail={customerEmail}
            customerPhone={customerPhone}
            setCustomerEmail={setCustomerEmail}
            setCustomerPhone={setCustomerPhone}
            onAdjustQty={adjustQty}
            onRemoveLine={removeLine}
            onCreateOrder={createOrder}
            onPayWithTwint={payWithTwint}
            isTwintPaying={isTwintPaying}
          />
        )}

        {/* STATUS */}
        {tab === 'status' && (
          <StatusView
            orderIds={orderIds}
            ordersById={ordersById}
            archiveIds={archiveIds}
            archiveById={archiveById}
            showArchive={showArchive}
            onToggleArchive={() => setShowArchive((v) => !v)}
          />
        )}
      </main>

      {/* Sticky Bottom Cart-Bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-16 z-40 mx-auto max-w-5xl px-4 sm:bottom-20">
        {itemCount > 0 && tab === 'menu' && (
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-full bg-neutral-900 px-4 py-3 text-white shadow-lg ring-1 ring-black/10">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-sm">
                {itemCount}
              </span>
              <span className="text-[13px]">Warenkorb</span>
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
                tab === t.key
                  ? 'font-semibold text-neutral-900'
                  : 'text-neutral-600'
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
            <span>
              🥙 {bannerText || 'Deine Bestellung ist abholbereit'}
            </span>
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
