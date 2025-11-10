'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReadyFeedback } from '@/hooks/useReadyFeedback';

// ==========================
// Typen (konsistent halten)
// ==========================
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

export type MenuItem = {
  id: string;
  name: string;
  price_cents: number; // Preise in Rappen/"cents"
  emoji?: string;
  options?: OptionGroup[];
};

export type OptionGroup = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  required?: boolean;
  choices: { id: string; label: string }[];
};

export type OrderLine = {
  id: string;
  item?: MenuItem | null;
  qty: number;
  specs?: Record<string, string[]>; // groupId -> choiceIds
  note?: string;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  total_cents: number;
  status: OrderStatus;
  created_at?: string;
  updated_at?: string;
};

// ==========================
// Kategorien & Menüdaten (aus Website abgeleitet)
// ==========================
const CATEGORY_TABS = ['Döner', 'Folded', 'Pide', 'Bowls', 'Vegan', 'Fingerfood', 'Getränke'] as const;
export type Category = (typeof CATEGORY_TABS)[number];

function baseOptionGroups(opts?: { includeBread?: boolean; limitedSalad?: boolean }): OptionGroup[] {
  const includeBread = opts?.includeBread ?? true;
  const limitedSalad = opts?.limitedSalad ?? false;
  const groups: OptionGroup[] = [
    includeBread
      ? { id: 'bread', label: 'Brot', type: 'single', required: true, choices: [ { id: 'fladenbrot', label: 'Fladenbrot' }, { id: 'yufka', label: 'Yufka' } ] }
      : ({ id: 'base', label: 'Basis', type: 'single', required: true, choices: [{ id: 'box', label: 'Box' }] } as OptionGroup),
    { id: 'sauce', label: 'Soßen', type: 'multi', choices: [ { id: 'knoblauch', label: 'Knoblauch' }, { id: 'scharf', label: 'Scharf' }, { id: 'cocktail', label: 'Cocktail' }, { id: 'joghurt', label: 'Joghurt' } ] },
    { id: 'salad', label: 'Salat', type: 'multi', choices: limitedSalad ? [ { id: 'salatmix', label: 'Salatmix' }, { id: 'zwiebeln', label: 'Zwiebeln' } ] : [ { id: 'salatmix', label: 'Salatmix' }, { id: 'tomaten', label: 'Tomaten' }, { id: 'zwiebeln', label: 'Zwiebeln' }, { id: 'gurken', label: 'Gurken' }, { id: 'kraut', label: 'Kraut' } ] },
    { id: 'spice', label: 'Schärfe', type: 'single', choices: [ { id: 'mild', label: 'Mild' }, { id: 'mittel', label: 'Mittel' }, { id: 'scharf', label: 'Scharf' } ] },
  ];
  return groups;
}

// Menü-Einträge pro Kategorie (Preise in CHF -> *100)
const MENU_BY_CATEGORY: Record<Category, MenuItem[]> = {
  Döner: [
    { id: 'doener_kebab', name: 'Döner Kebab', price_cents: 1900, emoji: '🥙', options: baseOptionGroups() },
    { id: 'durum_kebab', name: 'Dürüm Kebab', price_cents: 2000, emoji: '🌯', options: baseOptionGroups() },
    { id: 'doener_box', name: 'Döner Box', price_cents: 2100, emoji: '🍱', options: baseOptionGroups({ includeBread: false }) },
    { id: 'doener_teller', name: 'Döner Teller', price_cents: 2400, emoji: '🍽️', options: baseOptionGroups({ includeBread: false }) },
  ],
  Folded: [
    { id: 'folded_istanbul', name: 'Istanbul Folded', price_cents: 2300, emoji: '🫓' },
    { id: 'folded_guadalajara', name: 'Guadalajara Folded', price_cents: 2300, emoji: '🫓' },
  ],
  Pide: [
    { id: 'pide_doener', name: 'Pide Döner & Mozzarella', price_cents: 2400, emoji: '🫓' },
    { id: 'pide_spinat_feta', name: 'Pide Spinat & Feta', price_cents: 2200, emoji: '🧀' },
    { id: 'pide_champignons', name: 'Pide Champignons & Frischkäse', price_cents: 2300, emoji: '🍄' },
    { id: 'pide_feige_ricotta_burrata_honig', name: 'Pide Feige, Ricotta, Burrata & Honig', price_cents: 2500, emoji: '🍯' },
    { id: 'pide_sucuk_cheddar', name: 'Pide Sucuk & Cheddar', price_cents: 2400, emoji: '🧀' },
    { id: 'pide_guacamole_rucola_feta', name: 'Pide Guacamole, Rucola & Feta', price_cents: 2400, emoji: '🥑' },
  ],
  Bowls: [
    { id: 'bowl_beirut', name: 'Beirut Bowl', price_cents: 2000, emoji: '🥗' },
    { id: 'bowl_istanbul', name: 'Istanbul Bowl', price_cents: 2000, emoji: '🥗' },
    { id: 'bowl_guadalajara', name: 'Guadalajara Bowl', price_cents: 2000, emoji: '🥗' },
  ],
  Vegan: [
    { id: 'falafel', name: 'Falafel', price_cents: 1500, emoji: '🧆' },
    { id: 'karotte_baellchen', name: 'Karottenbällchen', price_cents: 1500, emoji: '🥕' },
    { id: 'zucchini_baellchen', name: 'Zucchinibällchen', price_cents: 1500, emoji: '🥒' },
  ],
  Fingerfood: [
    { id: 'chicken_nuggets', name: 'Chicken Nuggets', price_cents: 1500, emoji: '🍗' },
    { id: 'pommes', name: 'Pommes', price_cents: 800, emoji: '🍟' },
  ],
  Getränke: [
    { id: 'ayran', name: 'Ayran', price_cents: 500, emoji: '🥤' },
    { id: 'bier', name: 'Bier', price_cents: 600, emoji: '🍺' },
    { id: 'dose_033', name: 'Softdrink Dose 0.33L', price_cents: 400, emoji: '🥤' },
    { id: 'flasche_033', name: 'Softdrink Flasche 0.33L', price_cents: 600, emoji: '🧃' },
  ],
};

// ==========================
// Utils
// ==========================
function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 2 });
}
function sumCart(lines: OrderLine[]) { return lines.reduce((acc, l) => acc + (l.item?.price_cents ?? 0) * l.qty, 0); }
const LS_KEY = 'order_ids_v1';
const ARCHIVE_LS_KEY = 'order_archive_v1';
const todayStr = () => new Date().toISOString().slice(0, 10);

// ==========================
// Tabs (nur Kunden-Ansicht)
// ==========================
const tabs = ['menu', 'checkout', 'status'] as const;
export type Tab = (typeof tabs)[number];

export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');
  const [activeCategory, setActiveCategory] = useState<Category>('Döner');

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart;
  const miniCartRef = useRef<HTMLDivElement | null>(null);

  // Abschnitt-Refs (für Scroll-to)
  const sectionRefs = useRef<Record<Category, HTMLDivElement | null>>({} as Record<Category, HTMLDivElement | null>);

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{ item: MenuItem; specs: Record<string, string[]> } | null>(null);

  // Kontaktfelder
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  // Mehrere Bestellungen: IDs & Map mit Daten (aktiv)
  const [orderIds, setOrderIds] = useState<string[]>([]); // neueste zuerst
  const [ordersById, setOrdersById] = useState<Record<string, Order | null>>({});

  // Archiv (nur lokaler Client; Tages-Reset)
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

  // Service Worker registrieren (für Vibration im aktiven Tab)
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
    } catch {}
  }, []);

  // Archiv aus localStorage laden (aber nur für HEUTE)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(ARCHIVE_LS_KEY);
      if (!raw) return;
      const obj = JSON.parse(raw) as { date: string; ids: string[]; byId: Record<string, Order> };
      if (obj?.date === todayStr()) {
        setArchiveIds(obj.ids || []);
        setArchiveById(obj.byId || {});
      } else {
        localStorage.removeItem(ARCHIVE_LS_KEY); // Tageswechsel -> leeren
      }
    } catch {}
  }, []);

  const persistIds = useCallback((ids: string[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch {}
  }, []);
  const persistArchive = useCallback((ids: string[], byId: Record<string, Order>) => {
    try { localStorage.setItem(ARCHIVE_LS_KEY, JSON.stringify({ date: todayStr(), ids, byId })); } catch {}
  }, []);

  // Polling aller bekannten Orders (alle 5s)
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
            try { navigator.serviceWorker?.controller?.postMessage({ type: 'VIBRATE', body: 'Eine Bestellung ist abholbereit!' }); } catch {}
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
              const nextIds = [...toArchive.filter((id) => !prevA.includes(id)), ...prevA];
              persistArchive(nextIds, nextById);
              return nextIds;
            });
            return nextById;
          });
        }

        const allKnown = orderIds.length > 0 && orderIds.every((id) => merged[id]?.status === 'ready');
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
    return () => { stopped = true; clearInterval(t); };
  }, [orderIds, trigger, persistIds, persistArchive]);

  // Cart helpers
  const addToCart = useCallback((mi: MenuItem, specs?: Record<string, string[]>) => {
    setCart((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), item: mi, qty: 1, specs: specs ?? {}, note: '' }];
      queueMicrotask(() => miniCartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return next;
    });
  }, []);
  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l)).filter((l) => l.qty > 0));
  }, []);
  const removeLine = useCallback((id: string) => setCart((prev) => prev.filter((l) => l.id !== id)), []);
  const totalCents = useMemo(() => sumCart(lines), [lines]);

  // Bestellung erstellen
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
  }, [cart, totalCents, customerEmail, customerPhone, persistIds]);

  // Beim Klick auf ein Gericht: direkt Konfigurator öffnen
  const openCustomize = useCallback((m: MenuItem) => {
    const initialSpecs = (m.options || []).reduce<Record<string, string[]>>((acc, g) => {
      acc[g.id] = g.type === 'single' && g.required && g.choices.length > 0 ? [g.choices[0].id] : [];
      return acc;
    }, {});
    setCustomizing({ item: m, specs: initialSpecs });
  }, []);

  // Scroll zu Kategorieabschnitt
  const scrollToCategory = useCallback((cat: Category) => {
    setActiveCategory(cat);
    const el = sectionRefs.current[cat];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // ==========================
  // UI (Uber‑ähnlicher Look) – fortlaufende Seite
  // ==========================
  const itemCount = useMemo(() => lines.reduce((a, l) => a + l.qty, 0), [lines]);

  return (
    <div className="min-h-dvh bg-neutral-50 text-neutral-900 antialiased [font-feature-settings:'ss01'_'cv03']">
      {/* Flash-Overlay */}
      {flashOn && <GreenFlash durationMs={flashMs} />}

      {/* Top Bar */}
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
              <button onClick={enableSound} className={`rounded-full px-3 py-2 text-xs shadow-sm ring-1 ${soundEnabled ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-black text-white ring-black/10'}`}>
                {soundEnabled ? '🔔 Ton aktiv' : '🔔 Ton aktivieren'}
              </button>
            </div>
          </div>

          {/* Suchfeld */}
          <div className="pb-3">
            <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-[13px] text-neutral-500 shadow-sm">
              <span>🔎</span>
              <input placeholder="Gericht suchen…" className="w-full bg-transparent outline-none" onChange={() => {}} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* Sekundär-Navigation */}
        <nav className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {(CATEGORY_TABS as readonly Category[]).map((c) => (
            <button
              key={c}
              onClick={() => scrollToCategory(c)}
              className={`snap-start rounded-full px-3.5 py-1.5 text-[13px] shadow-sm ring-1 ${activeCategory === c ? 'bg-neutral-900 text-white ring-neutral-900/10' : 'bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50'}`}
            >
              {c}
            </button>
          ))}
        </nav>

        {/* === MENU: fortlaufend über alle Kategorien === */}
        {tab === 'menu' && (
          <section className="pb-28">
            {(CATEGORY_TABS as readonly Category[]).map((cat) => (
              <div key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} data-cat={cat} className="scroll-mt-28">
                {/* Kategorietitel */}
                <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-neutral-900">{cat}</h2>

                {/* Cards */}
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {MENU_BY_CATEGORY[cat].map((m) => (
                    <article key={m.id} className="group rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
                      <div className="grid grid-cols-[1fr_140px] items-center gap-4 p-4">
                        {/* Textspalte */}
                        <div>
                          <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">{m.name}</h3>
                          <div className="mt-1 text-[13px] text-neutral-500">{formatPrice(m.price_cents)}</div>
                          <div className="mt-2 text-[12px] text-emerald-700">Tippe um zu konfigurieren</div>
                          <div className="mt-3 flex items-center gap-2">
                            <button className="rounded-full bg-black px-3 py-2 text-[13px] font-medium text-white shadow-sm" onClick={() => addToCart(m)}>Schnell hinzufügen</button>
                            <button className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-600/30 hover:bg-emerald-50" onClick={() => openCustomize(m)}>Anpassen</button>
                          </div>
                        </div>
                        {/* Bild/Emoji-Spalte mit + Button */}
                        <div className="relative h-28 w-full select-none">
                          <div className="absolute inset-0 rounded-2xl bg-neutral-100/80 ring-1 ring-inset ring-neutral-200/80" />
                          <div className="absolute inset-0 grid place-items-center text-5xl">{m.emoji ?? '🥙'}</div>
                          <button className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-neutral-900 text-white shadow-sm" aria-label="Hinzufügen" onClick={() => addToCart(m)}>+</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}

            {/* Mini-Warenkorb */}
            <div ref={miniCartRef} className="mt-6">
              <MiniCart
                lines={lines}
                totalCents={totalCents}
                onAdjustQty={adjustQty}
                onRemoveLine={removeLine}
                onGoCheckout={() => setTab('checkout')}
              />
            </div>
          </section>
        )}

        {/* === CHECKOUT === */}
        {tab === 'checkout' && (
          <section className="pb-28">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Warenkorb</h2>
            {lines.length === 0 ? (
              <p className="mt-3 text-[13px] text-neutral-500">Dein Warenkorb ist leer.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {lines.map((l) => (
                  <div key={l.id} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{l.item?.name}</div>
                        {l.specs && Object.keys(l.specs).length > 0 && (
                          <ul className="mt-1 text-[12px] text-neutral-600">
                            {Object.entries(l.specs).map(([gid, arr]) => (
                              <li key={gid}><span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="text-[13px] text-neutral-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button className="rounded-full bg-neutral-100 px-2 py-1" onClick={() => adjustQty(l.id, -1)}>-</button>
                        <span className="min-w-6 text-center">{l.qty}</span>
                        <button className="rounded-full bg-neutral-100 px-2 py-1" onClick={() => adjustQty(l.id, +1)}>+</button>
                      </div>
                      <button className="text-[13px] text-red-600" onClick={() => removeLine(l.id)}>Entfernen</button>
                    </div>
                  </div>
                ))}

                <div className="flex items-center justify-between rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <div className="text-[13px]">Zwischensumme</div>
                  <div className="text-[15px] font-semibold">{formatPrice(totalCents)}</div>
                </div>

                <div className="space-y-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                  <label className="block text-[13px]">E‑Mail (optional)
                    <input className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px]" placeholder="kunde@example.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} inputMode="email" />
                  </label>

                  <label className="block text-[13px]">Telefon (für SMS – optional)
                    <input className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2 text-[13px]" placeholder="+41 79 123 45 67" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} inputMode="tel" />
                  </label>

                  <button className="w-full rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm" onClick={createOrder} disabled={lines.length === 0}>Bestellung abschicken</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* === STATUS === */}
        {tab === 'status' && (
          <section className="pb-28">
            <h2 className="text-[18px] font-semibold tracking-[-0.02em]">Bestellstatus</h2>
            {orderIds.length === 0 ? (
              <p className="mt-3 text-[13px] text-neutral-500">Keine aktiven Bestellungen.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {orderIds.map((id) => {
                  const o = ordersById[id];
                  return (
                    <div key={id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                      <div className="flex items-center justify-between">
                        <div className="text-[12px] text-neutral-600">ID: <span className="font-mono">{id}</span></div>
                        <StatusBadge s={o?.status ?? 'in_queue'} />
                      </div>
                      {!o ? (
                        <p className="mt-2 text-[13px] text-neutral-500">Lade Status…</p>
                      ) : (
                        <>
                          <ul className="mt-3 divide-y text-[13px]">
                            {o.lines.map((l) => (
                              <li key={l.id} className="flex items-start justify-between py-2">
                                <div>
                                  {l.qty}× {l.item?.name}
                                  {l.specs && Object.keys(l.specs).length > 0 && (
                                    <div className="text-[12px] text-neutral-600">
                                      {Object.entries(l.specs).map(([gid, arr]) => (
                                        <span key={gid} className="mr-2"><span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}</span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="text-neutral-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-2 text-right text-[11px] text-neutral-500">
                            aktualisiert: {new Date(o.updated_at || o.created_at || '').toLocaleString()}
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
              <button className="rounded-full px-3 py-1 underline-offset-2 hover:underline" onClick={() => setShowArchive((v) => !v)}>
                {showArchive ? 'Archiv ausblenden' : `Vergangene Bestellungen ansehen (${archiveIds.length})`}
              </button>
            </div>

            {showArchive && (
              <div className="mt-4 space-y-3">
                <h3 className="text-[13px] font-medium text-neutral-600">Archiv (heute)</h3>
                {archiveIds.length === 0 ? (
                  <p className="text-[13px] text-neutral-400">Noch keine archivierten Bestellungen.</p>
                ) : (
                  archiveIds.map((id) => {
                    const o = archiveById[id];
                    if (!o) return null;
                    return (
                      <div key={id} className="rounded-3xl bg-white p-4 opacity-90 shadow-sm ring-1 ring-black/5">
                        <div className="flex items-center justify-between">
                          <div className="text-[12px] text-neutral-600">ID: <span className="font-mono">{id}</span></div>
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-700 ring-1 ring-inset ring-neutral-200">Archiv</span>
                        </div>
                        <ul className="mt-3 divide-y text-[13px]">
                          {o.lines.map((l) => (
                            <li key={l.id} className="flex items-start justify-between py-2">
                              <div>
                                {l.qty}× {l.item?.name}
                              </div>
                              <div className="text-neutral-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 text-right text-[11px] text-neutral-400">abgeschlossen: {new Date(o.updated_at || o.created_at || '').toLocaleString()}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
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
            <button className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-neutral-900" onClick={() => setTab('checkout')}>
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
              className={`flex h-14 flex-col items-center justify-center text-[11px] ${tab === t.key ? 'font-semibold text-neutral-900' : 'text-neutral-600'}`}
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
            <button onClick={() => setShowReadyBanner(false)} className="rounded-full bg-white/20 px-2 py-1 text-[12px] transition hover:bg-white/30">Schließen</button>
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
            onConfirm={(specs) => { addToCart(customizing.item, specs); setCustomizing(null); }}
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
    <div className={`pointer-events-none fixed inset-0 z-40 bg-emerald-200/60 transition-opacity ${off ? 'opacity-0' : 'opacity-100'}`} style={{ transitionDuration: `${durationMs}ms` }} />
  );
}

// ==========================
// Hilfs-Komponenten & Funktionen
// ==========================
function StatusBadge({ s }: { s: OrderStatus }) {
  const map: Record<OrderStatus, { text: string; cls: string }> = {
    in_queue: { text: 'In Queue', cls: 'bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200' },
    preparing: { text: 'Preparing', cls: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200' },
    ready: { text: 'Ready', cls: 'bg-emerald-600 text-white' },
    picked_up: { text: 'Picked up', cls: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200' },
  };
  const it = map[s] ?? map.in_queue;
  return <span className={`rounded-full px-2.5 py-1 text-[11px] ${it.cls}`}>{it.text}</span>;
}
function labelForGroup(groupId: string, item?: MenuItem | null) {
  const g = item?.options?.find((z) => z.id === groupId); return g?.label ?? groupId;
}
function labelForChoice(groupId: string, choiceId: string, item?: MenuItem | null) {
  const g = item?.options?.find((x) => x.id === groupId); const c = g?.choices.find((y) => y.id === choiceId); return c?.label ?? choiceId;
}

function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => { const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">{children}</div>
    </div>
  );
}

function CustomizeCard({ item, initialSpecs, onCancel, onConfirm }: { item: MenuItem; initialSpecs: Record<string, string[]>; onCancel: () => void; onConfirm: (specs: Record<string, string[]>) => void; }) {
  const [specs, setSpecs] = useState<Record<string, string[]>>(initialSpecs);
  const toggle = useCallback((g: OptionGroup, choiceId: string) => {
    setSpecs((prev) => {
      const current = prev[g.id] ?? [];
      if (g.type === 'single') return { ...prev, [g.id]: [choiceId] };
      return current.includes(choiceId) ? { ...prev, [g.id]: current.filter((x) => x !== choiceId) } : { ...prev, [g.id]: [...current, choiceId] };
    });
  }, []);
  const canConfirm = useMemo(() => (item.options || []).every((g) => !g.required || (specs[g.id]?.length ?? 0) > 0), [item.options, specs]);
  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="text-3xl">{item.emoji ?? '🥙'}</div>
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.015em]">{item.name}</div>
          <div className="text-[13px] text-neutral-500">{formatPrice(item.price_cents)}</div>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {(item.options || []).map((g) => (
          <div key={g.id}>
            <div className="text-[13px] font-medium">{g.label}{g.required ? ' *' : ''}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const selected = (specs[g.id] ?? []).includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(g, c.id)} className={`rounded-full px-3 py-1.5 text-[13px] shadow-sm ring-1 ${selected ? 'bg-emerald-600 text-white ring-emerald-600/30' : 'bg-neutral-100 text-neutral-800 ring-neutral-200 hover:bg-neutral-200'}`}>{c.label}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded-full bg-white px-4 py-2 text-[13px] ring-1 ring-neutral-200" onClick={onCancel}>Abbrechen</button>
        <button className="rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50" onClick={() => onConfirm(specs)} disabled={!canConfirm}>Hinzufügen</button>
      </div>
    </div>
  );
}

// Mini-Warenkorb
function MiniCart({
  lines,
  totalCents,
  onAdjustQty,
  onRemoveLine,
  onGoCheckout,
}: {
  lines: OrderLine[];
  totalCents: number;
  onAdjustQty: (id: string, delta: number) => void;
  onRemoveLine: (id: string) => void;
  onGoCheckout: () => void;
}) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold tracking-[-0.015em]">Dein Warenkorb</h3>
        <div className="text-[12px] text-neutral-500">{lines.length} Artikel</div>
      </div>

      {lines.length === 0 ? (
        <p className="mt-2 text-[13px] text-neutral-500">Noch leer – wähle ein Gericht aus.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y text-[13px]">
            {lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between py-2">
                <div>
                  <div className="font-medium">{l.item?.name}</div>
                  {l.specs && Object.keys(l.specs).length > 0 && (
                    <div className="text-[12px] text-neutral-600">
                      {Object.entries(l.specs).map(([gid, arr]) => (
                        <span key={gid} className="mr-2">{arr.join(', ')}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-neutral-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button className="rounded-full bg-neutral-100 px-2 py-1" onClick={() => onAdjustQty(l.id, -1)}>-</button>
                    <span className="min-w-6 text-center">{l.qty}</span>
                    <button className="rounded-full bg-neutral-100 px-2 py-1" onClick={() => onAdjustQty(l.id, +1)}>+</button>
                    <button className="text-[12px] text-red-600" onClick={() => onRemoveLine(l.id)}>Entfernen</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[13px]">Zwischensumme</div>
            <div className="text-[15px] font-semibold">{formatPrice(totalCents)}</div>
          </div>

          <button className="mt-3 w-full rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white shadow-sm" onClick={onGoCheckout}>Zur Kasse</button>
        </>
      )}
    </div>
  );
}
