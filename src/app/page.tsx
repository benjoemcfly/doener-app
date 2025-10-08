'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReadyFeedback } from '@/hooks/useReadyFeedback';

// ==========================
// Typen (erweitert – keine Umbenennungen, nur optionale Felder)
// ==========================
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

export type MenuItem = {
  id: string;
  name: string;
  price_cents: number;
  emoji?: string;
  options?: OptionGroup[]; // nur UI, wird in lines gespeichert
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
  // neue optionale Felder – rückwärtskompatibel
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
// Demo-Menü mit Options-Gruppen (nur UI)
// ==========================
const MENU: MenuItem[] = [
  {
    id: 'doener',
    name: 'Döner Kebab',
    price_cents: 850,
    emoji: '🥙',
    options: baseOptionGroups(),
  },
  {
    id: 'durum',
    name: 'Dürüm',
    price_cents: 900,
    emoji: '🌯',
    options: baseOptionGroups(),
  },
  {
    id: 'box',
    name: 'Döner Box',
    price_cents: 800,
    emoji: '🍱',
    options: baseOptionGroups({ includeBread: false }),
  },
  {
    id: 'lama',
    name: 'Lahmacun',
    price_cents: 700,
    emoji: '🫓',
    options: baseOptionGroups({ limitedSalad: true }),
  },
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
      : ({ id: 'base', label: 'Basis', type: 'single', required: true, choices: [{ id: 'box', label: 'Box' }] } as OptionGroup),
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

// ==========================
// Utils
// ==========================
function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function sumCart(lines: OrderLine[]) {
  return lines.reduce((acc, l) => acc + (l.item?.price_cents ?? 0) * l.qty, 0);
}

// ==========================
// Tabs
// ==========================
const tabs = ['menu', 'checkout', 'status', 'kitchen'] as const;
export type Tab = (typeof tabs)[number];

export default function Page() {
  const [tab, setTab] = useState<Tab>('menu');

  // Warenkorb
  const [cart, setCart] = useState<OrderLine[]>([]);
  const lines = cart; // alias

  // UI-Dialog zum Anpassen
  const [customizing, setCustomizing] = useState<{ item: MenuItem; specs: Record<string, string[]> } | null>(null);

  const [customerEmail, setCustomerEmail] = useState('');
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [kitchenMutating, setKitchenMutating] = useState(false);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  const alreadyNotifiedRef = useRef(false);
  const { soundEnabled, enableSound, trigger } = useReadyFeedback();

  // ==========================
  // Service Worker Registrierung (einmalig)
  // ==========================
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // ==========================
  // Status-Polling für aktive Order (alle 5s)
  // ==========================
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
            if (navigator.serviceWorker?.controller) {
              navigator.serviceWorker.controller.postMessage({ type: 'VIBRATE', body: 'Deine Bestellung ist ready!' });
            }
          } catch {}
        }
      } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [activeOrderId, trigger]);

  // ==========================
  // Kitchen-Polling (alle 4s)
  // ==========================
  useEffect(() => {
    if (tab !== 'kitchen' || kitchenMutating) return;
    const load = async () => {
      try {
        const r = await fetch('/api/orders', { cache: 'no-store' });
        if (!r.ok) return;
        const list = (await r.json()) as Order[];
        setKitchenOrders(list);
      } catch {}
    };
    load();
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [tab, kitchenMutating]);

  // ==========================
  // Cart helpers
  // ==========================
  const addToCart = useCallback((mi: MenuItem, specs?: Record<string, string[]>) => {
    setCart((prev) => {
      const id = crypto.randomUUID();
      return [...prev, { id, item: mi, qty: 1, specs: specs ?? {}, note: '' }];
    });
  }, []);

  const adjustQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }, []);

  const removeLine = useCallback((id: string) => {
    setCart((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const totalCents = useMemo(() => sumCart(lines), [lines]);

  // ==========================
  // Order erstellen
  // ==========================
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

  // ==========================
  // Kitchen-Actions
  // ==========================
  const setOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    setPendingIds((p) => ({ ...p, [id]: true }));
    setKitchenMutating(true);
    try {
      const r = await fetch(`/api/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
        cache: 'no-store',
      });
      if (!r.ok) throw new Error('patch failed');
      const updated = (await r.json()) as Order;
      setKitchenOrders((list) => list.map((o) => (o.id === id ? updated : o)));
    } catch {}
    setPendingIds((p) => ({ ...p, [id]: false }));
    setKitchenMutating(false);
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
              <p className="text-xs text-gray-500">MVP • Menü → Kasse → Status → Kitchen</p>
            </div>
          </div>
          <button
            onClick={enableSound}
            className={`rounded-full px-3 py-1.5 text-sm shadow ${soundEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 text-white'}`}
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
              {key === 'kitchen' && 'Kitchen'}
            </button>
          ))}
        </nav>

        {/* Inhalte */}
        <main className="mt-6">
          {tab === 'menu' && (
            <section>
              <h2 className="text-lg font-semibold">Wähle dein Gericht</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {MENU.map((m) => (
                  <article key={m.id} className="group rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-2xl">{m.emoji ?? '🥙'}</div>
                        <h3 className="mt-1 text-base font-semibold">{m.name}</h3>
                        <div className="text-sm text-gray-500">{formatPrice(m.price_cents)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700"
                        onClick={() => addToCart(m)}
                      >
                        Schnell hinzufügen
                      </button>
                      <button
                        className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/30 hover:bg-emerald-50"
                        onClick={() =>
                          setCustomizing({
                            item: m,
                            specs: (m.options || []).reduce<Record<string, string[]>>((acc, g) => {
                              acc[g.id] = g.type === 'single' && g.required && g.choices.length > 0 ? [g.choices[0].id] : [];
                              return acc;
                            }, {}),
                          })
                        }
                      >
                        Anpassen & hinzufügen
                      </button>
                    </div>
                  </article>
                ))}
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
                                <li key={gid}>
                                  <span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}
                                </li>
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
                      <input
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        placeholder="kunde@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        inputMode="email"
                      />
                    </label>
                    <button
                      className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-white shadow hover:bg-emerald-700"
                      onClick={createOrder}
                      disabled={lines.length === 0}
                    >
                      Bestellung abschicken
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === 'status' && (
            <section>
              <h2 className="text-lg font-semibold">Bestellstatus</h2>
              {!activeOrderId ? (
                <p className="mt-3 text-sm text-gray-500">Noch keine Bestellung gesendet.</p>
              ) : activeOrder ? (
                <div className="mt-3 rounded-2xl border bg-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      ID: <span className="font-mono">{activeOrder.id}</span>
                    </div>
                    <StatusBadge s={activeOrder.status} />
                  </div>
                  <ul className="mt-3 divide-y text-sm">
                    {activeOrder.lines.map((l) => (
                      <li key={l.id} className="flex items-start justify-between py-2">
                        <div>
                          {l.qty}× {l.item?.name}
                          {l.specs && Object.keys(l.specs).length > 0 && (
                            <div className="text-xs text-gray-600">
                              {Object.entries(l.specs).map(([gid, arr]) => (
                                <span key={gid} className="mr-2">
                                  <span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">Lade Status…</p>
              )}
            </section>
          )}

          {tab === 'kitchen' && (
            <section>
              <h2 className="text-lg font-semibold">Kitchen-Dashboard</h2>
              <div className="mt-3 grid grid-cols-1 gap-3">
                {kitchenOrders.length === 0 && (
                  <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Keine Bestellungen.</div>
                )}
                {kitchenOrders.map((o) => (
                  <div key={o.id} className="rounded-2xl border bg-white p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        ID: <span className="font-mono">{o.id}</span>
                      </div>
                      <StatusBadge s={o.status} />
                    </div>
                    <div className="mt-2 divide-y text-sm">
                      {o.lines.map((l, i) => (
                        <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}` } className="flex items-start justify-between py-2">
                          <div>
                            {l.qty}× {l.item?.name || 'Position'}
                            {l.specs && Object.keys(l.specs).length > 0 && (
                              <div className="text-xs text-gray-600">
                                {Object.entries(l.specs).map(([gid, arr]) => (
                                  <span key={gid} className="mr-2">
                                    <span className="font-medium">{labelForGroup(gid, l.item)}:</span> {arr.map((cid) => labelForChoice(gid, cid, l.item)).join(', ')}
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
                        disabled={pendingIds[o.id]}
                        onClick={() => setOrderStatus(o.id, 'in_queue')}
                      >In Queue</button>
                      <button
                        className="rounded-full bg-amber-100 px-3 py-1.5 text-sm text-amber-800"
                        disabled={pendingIds[o.id]}
                        onClick={() => setOrderStatus(o.id, 'preparing')}
                      >Preparing</button>
                      <button
                        className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm text-white"
                        disabled={pendingIds[o.id]}
                        onClick={() => setOrderStatus(o.id, 'ready')}
                      >Ready</button>
                      <button
                        className="rounded-full bg-sky-100 px-3 py-1.5 text-sm text-sky-800"
                        disabled={pendingIds[o.id]}
                        onClick={() => setOrderStatus(o.id, 'picked_up')}
                      >Picked up</button>
                    </div>
                  </div>
                ))}
              </div>
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

// ==========================
// Hilfs-UI
// ==========================
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

function labelForGroup(groupId: string, item?: MenuItem | null): string {
  const g = item?.options?.find((g) => g.id === groupId);
  return g?.label ?? groupId;
}

function labelForChoice(groupId: string, choiceId: string, item?: MenuItem | null): string {
  const g = item?.options?.find((x) => x.id === groupId);
  const c = g?.choices.find((y) => y.id === choiceId);
  return c?.label ?? choiceId;
}

// ==========================
// Dialog & Customize Card (klein, ohne externe Libs)
// ==========================
function Dialog({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border bg-white p-4 shadow-lg">
        {children}
      </div>
    </div>
  );
}

function CustomizeCard({
  item,
  initialSpecs,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  initialSpecs: Record<string, string[]>;
  onCancel: () => void;
  onConfirm: (specs: Record<string, string[]>) => void;
}) {
  const [specs, setSpecs] = useState<Record<string, string[]>>(initialSpecs);

  const toggle = useCallback((g: OptionGroup, choiceId: string) => {
    setSpecs((prev) => {
      const current = prev[g.id] ?? [];
      if (g.type === 'single') return { ...prev, [g.id]: [choiceId] };
      // multi
      return current.includes(choiceId)
        ? { ...prev, [g.id]: current.filter((x) => x !== choiceId) }
        : { ...prev, [g.id]: [...current, choiceId] };
    });
  }, []);

  const canConfirm = useMemo(() => {
    return (item.options || []).every((g) => !g.required || (specs[g.id]?.length ?? 0) > 0);
  }, [item.options, specs]);

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
                  <button
                    key={c.id}
                    onClick={() => toggle(g, c.id)}
                    className={`rounded-full px-3 py-1.5 text-sm shadow ${
                      selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-gray-200" onClick={onCancel}>Abbrechen</button>
        <button
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => onConfirm(specs)}
          disabled={!canConfirm}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
