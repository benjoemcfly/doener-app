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

  // Customize-Modal
  const [customizing, setCustomizing] = useState<{ item: MenuItem; specs: Record<string, string[]> } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');

  // 🔁 Mehrere Bestellungen: IDs & Map mit Daten
  const [orderIds, setOrderIds] = useState<string[]>([]); // neueste zuerst
  const [ordersById, setOrdersById] = useState<Record<string, Order | null>>({});

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
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids) && ids.length) {
        setOrderIds(ids);
      }
    } catch {}
  }, []);

  // Helper: Order-IDs in localStorage speichern
  const persistIds = useCallback((ids: string[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(ids)); } catch {}
  }, []);

  // Polling aller bekannten Orders (alle 5s)
  useEffect(() => {
    if (orderIds.length === 0) return;

    let stopped = false;
    const fetchAll = async () => {
      for (const id of orderIds) {
        try {
          const r = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
          if (!r.ok) continue;
          const o = (await r.json()) as Order;
          if (stopped) return;
          setOrdersById((prev) => ({ ...prev, [id]: o }));

          if (o.status === 'ready' && !notifiedRef.current[id]) {
            notifiedRef.current[id] = true;
            trigger();
            try { navigator.serviceWorker?.controller?.postMessage({ type: 'VIBRATE', body: 'Deine Bestellung ist ready!' }); } catch {}
          }
        } catch {}
      }
    };

    // sofort initial
    fetchAll();
    const t = setInterval(fetchAll, 5000);
    return () => { stopped = true; clearInterval(t); };
  }, [orderIds, trigger]);

  // Cart helpers
  const addToCart = useCallback((mi: MenuItem, specs?: Record<string, string[]>) => {
    setCart((prev) => {
      const next = [...prev, { id: crypto.randomUUID(), item: mi, qty: 1, specs: specs ?? {}, note: '' }];
      // Nach dem Hinzufügen zum Mini-Warenkorb scrollen
      queueMicrotask(() => miniCartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      return next;
    });
  }, []);
  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) => prev.map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l)).filter((l) => l.qty > 0));
  }, []);
  const removeLine = useCallback((id: string) => setCart((prev) => prev.filter((l) => l.id !== id)), []);
  const totalCents = useMemo(() => sumCart(lines), [lines]);

  // Bestellung erstellen → neue ID **vorne** einfügen, IDs persistieren, Status-Tab zeigen
  const createOrder = useCallback(async () => {
    if (!cart.length) return;
    const payload = { lines: cart, total_cents: totalCents, customer_email: customerEmail || undefined };
    const r = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), cache: 'no-store' });
    if (r.ok) {
      const { id } = (await r.json()) as { id: string };
      setCart([]);
      setTab('status');
      // vorne einfügen (neueste oben)
      setOrderIds((prev) => {
        const next = [id, ...prev.filter((x) => x !== id)];
        persistIds(next);
        return next;
      });
      // optional Platzhalter, bis Poll kommt
      setOrdersById((prev) => ({ ...prev, [id]: null }));
      // Benachrichtigungs-Flag zurücksetzen
      notifiedRef.current[id] = false;
    } else {
      alert('Fehler beim Absenden');
    }
  }, [cart, totalCents, customerEmail, persistIds]);

  // Beim Klick auf ein Gericht: direkt Konfigurator öffnen (Buttons entfernt)
  const openCustomize = useCallback((m: MenuItem) => {
    const initialSpecs = (m.options || []).reduce<Record<string, string[]>>((acc, g) => {
      acc[g.id] = g.type === 'single' && g.required && g.choices.length > 0 ? [g.choices[0].id] : [];
      return acc;
    }, {});
    setCustomizing({ item: m, specs: initialSpecs });
  }, []);

  // ==========================
  // UI
  // ==========================
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
          <button onClick={enableSound} className={`rounded-full px-3 py-1.5 text-sm shadow ${soundEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white'}`}>
            {soundEnabled ? '🔔 Ton aktiv' : '🔔 Ton aktivieren'}
          </button>
        </header>

        {/* Tabs */}
        <nav className="mt-4 flex gap-2">
          {tabs.map((key) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-full px-4 py-2 text-sm shadow transition ${tab === key ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              {key === 'menu' && 'Menü'}
              {key === 'checkout' && 'Kasse'}
              {key === 'status' && 'Status'}
            </button>
          ))}
        </nav>

        {/* Inhalte */}
        <main className="mt-6">
          {tab === 'menu' && (
            <section>
              <h2 className="text-lg font-semibold">Wähle dein Gericht</h2>

              {/* Kategorie-Reiter */}
              <div className="mt-3 flex flex-wrap gap-2">
                {CATEGORY_TABS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setActiveCategory(c)}
                    className={`rounded-full px-3 py-1.5 text-sm shadow ${activeCategory === c ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Karten der aktiven Kategorie – Karte öffnet direkt Konfigurator */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {MENU_BY_CATEGORY[activeCategory].map((m) => (
                  <article
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openCustomize(m)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openCustomize(m)}
                    className="group cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-2xl">{m.emoji ?? '🥙'}</div>
                        <h3 className="mt-1 text-base font-semibold">{m.name}</h3>
                        <div className="text-sm text-gray-500">{formatPrice(m.price_cents)}</div>
                        <div className="mt-2 text-xs text-emerald-700">Tippe um zu konfigurieren</div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              {/* Mini-Warenkorb direkt unterhalb */}
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

          {tab === 'checkout' && (
            <section>
              <h2 className="text-lg font-semibold">Warenkorb</h2>
              {lines.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Dein Warenkorb ist leer.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {lines.map((l) => (
                    <div key={l.id} className="rounded-2xl border bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{l.item?.name}</div>
                          {l.specs && Object.keys(l.specs).length > 0 && (
                            <ul className="mt-1 text-xs text-gray-600">
                              {Object.entries(l.specs).map(([gid, arr]) => (
                                <li key={gid}><span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => adjustQty(l.id, -1)}>-</button>
                          <span className="min-w-6 text-center">{l.qty}</span>
                          <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => adjustQty(l.id, +1)}>+</button>
                        </div>
                        <button className="text-sm text-red-600" onClick={() => removeLine(l.id)}>Entfernen</button>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center justify-between rounded-2xl border bg-white p-3">
                    <div className="text-sm">Zwischensumme</div>
                    <div className="text-base font-semibold">{formatPrice(totalCents)}</div>
                  </div>

                  <div className="rounded-2xl border bg-white p-3">
                    <label className="block text-sm">E-Mail (optional)
                      <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" placeholder="kunde@example.com" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} inputMode="email" />
                    </label>
                    <button className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700" onClick={createOrder} disabled={lines.length === 0}>Bestellung abschicken</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'status' && (
            <section>
              <h2 className="text-lg font-semibold">Bestellstatus</h2>
              {orderIds.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Noch keine Bestellung gesendet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {orderIds.map((id) => {
                    const o = ordersById[id];
                    return (
                      <div key={id} className="rounded-2xl border bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">ID: <span className="font-mono">{id}</span></div>
                          <StatusBadge s={o?.status ?? 'in_queue'} />
                        </div>
                        {!o ? (
                          <p className="mt-2 text-sm text-gray-500">Lade Status…</p>
                        ) : (
                          <>
                            <ul className="mt-3 divide-y text-sm">
                              {o.lines.map((l) => (
                                <li key={l.id} className="flex items-start justify-between py-2">
                                  <div>
                                    {l.qty}× {l.item?.name}
                                    {l.specs && Object.keys(l.specs).length > 0 && (
                                      <div className="text-xs text-gray-600">
                                        {Object.entries(l.specs).map(([gid, arr]) => (
                                          <span key={gid} className="mr-2"><span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-2 text-right text-xs text-gray-500">
                              aktualisiert: {new Date(o.updated_at || o.created_at || '').toLocaleString()}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Modal: Customize */}
      {customizing && (
        <Dialog onClose={() => setCustomizing(null)}>
          <CustomizeCard
            item={customizing.item}
            initialSpecs={customizing.specs}
            onCancel={() => setCustomizing(null)}
            onConfirm={(specs) => { addToCart(customizing.item, specs); setCustomizing(null); /* Mini-Cart zeigt Button zur Kasse */ }}
          />
        </Dialog>
      )}
    </div>
  );
}

// ==========================
// Hilfs-Komponenten & Funktionen
// ==========================
function StatusBadge({ s }: { s: OrderStatus }) {
  const map: Record<OrderStatus, { text: string; cls: string }> = {
    in_queue: { text: 'In Queue', cls: 'bg-gray-100 text-gray-700' },
    preparing: { text: 'Preparing', cls: 'bg-amber-100 text-amber-800' },
    ready: { text: 'Ready', cls: 'bg-emerald-600 text-white' },
    picked_up: { text: 'Picked up', cls: 'bg-sky-100 text-sky-800' },
  };
  const it = map[s] ?? map.in_queue;
  return <span className={`rounded-full px-2.5 py-1 text-xs ${it.cls}`}>{it.text}</span>;
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
      <div className="relative z-10 w-full max-w-md rounded-2xl border bg-white p-4 shadow-lg">{children}</div>
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
          <div className="text-lg font-semibold">{item.name}</div>
          <div className="text-sm text-gray-500">{formatPrice(item.price_cents)}</div>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {(item.options || []).map((g) => (
          <div key={g.id}>
            <div className="text-sm font-medium">{g.label}{g.required ? ' *' : ''}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const selected = (specs[g.id] ?? []).includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggle(g, c.id)} className={`rounded-full px-3 py-1.5 text-sm shadow ${selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>{c.label}</button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-gray-200" onClick={onCancel}>Abbrechen</button>
        <button className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50" onClick={() => onConfirm(specs)} disabled={!canConfirm}>Hinzufügen</button>
      </div>
    </div>
  );
}

// Mini-Warenkorb-Komponente (unter Menü sichtbar)
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
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Dein Warenkorb</h3>
        <div className="text-sm text-gray-500">{lines.length} Artikel</div>
      </div>

      {lines.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Noch leer – wähle ein Gericht aus.</p>
      ) : (
        <>
          <ul className="mt-3 divide-y text-sm">
            {lines.map((l) => (
              <li key={l.id} className="flex items-start justify-between py-2">
                <div>
                  <div className="font-medium">{l.item?.name}</div>
                  {l.specs && Object.keys(l.specs).length > 0 && (
                    <div className="text-xs text-gray-600">
                      {Object.entries(l.specs).map(([gid, arr]) => (
                        <span key={gid} className="mr-2">{arr.join(', ')}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => onAdjustQty(l.id, -1)}>-</button>
                    <span className="min-w-6 text-center">{l.qty}</span>
                    <button className="rounded-full bg-gray-100 px-2 py-1" onClick={() => onAdjustQty(l.id, +1)}>+</button>
                    <button className="text-xs text-red-600" onClick={() => onRemoveLine(l.id)}>Entfernen</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-sm">Zwischensumme</div>
            <div className="text-base font-semibold">{formatPrice(totalCents)}</div>
          </div>

          <button
            className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700"
            onClick={onGoCheckout}
          >
            Zur Kasse
          </button>
        </>
      )}
    </div>
  );
}
