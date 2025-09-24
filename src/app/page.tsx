'use client';

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- Types ---
type Sauce = "Knoblauch" | "Scharf" | "Yoghurt" | "Ohne";
type Salad = "Alles" | "Ohne Zwiebeln" | "Ohne Tomaten" | "Ohne Salat";

type ItemId = "doener" | "dueruem" | "pide" | "lahmacun";

interface MenuItem {
  id: ItemId;
  name: string;
  basePrice: number;
  description: string;
}

interface Customization {
  sauce: Sauce;
  salad: Salad;
  extras: string[]; // e.g., "Extra Käse"
}

interface CartLine {
  id: string; // unique line id
  item: MenuItem;
  qty: number;
  custom: Customization;
}

type OrderStatus = "in_queue" | "preparing" | "ready" | "picked_up";

interface Order {
  orderId: string;
  lines: CartLine[];
  total: number;
  status: OrderStatus;
  createdAt: string;
}

// --- Mock Data (wie zuvor) ---
const MENU: MenuItem[] = [
  {
    id: "doener",
    name: "Döner",
    basePrice: 9.5,
    description: "Klassischer Döner mit Kalbfleisch oder Hähnchen, frisch vom Spieß.",
  },
  {
    id: "dueruem",
    name: "Dürüm",
    basePrice: 10.5,
    description: "Gerolltes Fladenbrot, perfekt zum Mitnehmen.",
  },
  { id: "pide", name: "Pide", basePrice: 12, description: "Ofenfrische Pide mit Käse oder Hackfleisch." },
  { id: "lahmacun", name: "Lahmacun", basePrice: 8.5, description: "Dünner Fladen mit würzigem Belag." },
];

const EXTRAS = [
  { name: "Extra Käse", price: 1.5 },
  { name: "Extra Fleisch", price: 3 },
  { name: "Pommes im Döner", price: 1 },
  { name: "Jalapeños", price: 0.5 },
] as const;

// --- Utility ---
const money = (n: number) => n.toFixed(2) + " CHF";
const uuid = () => Math.random().toString(36).slice(2, 9);

function saveLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

// --- Notification helpers (in-tab) ---
function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

async function ensureNotifyPermission(): Promise<boolean> {
  if (!canNotify()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const res = await Notification.requestPermission();
  return res === 'granted';
}

function notifyReady(orderId: string) {
  if (!canNotify()) return;
  try {
    new Notification('Deine Bestellung ist abholbereit', {
      body: `Bestellnummer ${orderId}`,
      icon: '/favicon.ico',
      tag: `ready-${orderId}`,
    });
    // ← NEU: Typsicher ohne "any"
    const nav = navigator as Navigator & { vibrate?: (pattern: VibratePattern) => boolean };
    nav.vibrate?.([120, 70, 120]);
  } catch {}
}


// ---- Server API helpers (Orders) ----
async function apiCreateOrderFromCart(cart: CartLine[]): Promise<{ id: string; status: string }> {
  const total_cents = cart.reduce((sum, l) => {
    const extrasPrice = l.custom.extras.reduce(
      (s, name) => s + (EXTRAS.find(e => e.name === name)?.price || 0),
      0
    );
    const unit_cents = Math.round((l.item.basePrice + extrasPrice) * 100);
    return sum + unit_cents * l.qty;
  }, 0);

  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ lines: cart, total_cents })
  });
  if (!res.ok) throw new Error('Bestellung fehlgeschlagen');
  return res.json();
}

async function apiFetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders', { cache: 'no-store' });
  if (!res.ok) throw new Error('Orders laden fehlgeschlagen');
  return res.json();
}

async function apiFetchOrder(id: string): Promise<Order | null> {
  const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

async function apiUpdateOrderStatus(id: string, status: OrderStatus) {
  const res = await fetch(`/api/orders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ status })
  });
  if (!res.ok) throw new Error('Status-Update fehlgeschlagen');
}

// --- Component ---
export default function SelfOrderingPrototype() {
  const [selected, setSelected] = useState<MenuItem | null>(MENU[0]);
  const [sauce, setSauce] = useState<Sauce>("Knoblauch");
  const [salad, setSalad] = useState<Salad>("Alles");
  const [extras, setExtras] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [cart, setCart] = useState<CartLine[]>(() => readLocal("cart", []));
  const [orders, setOrders] = useState<Order[]>(() => readLocal("orders", []));
  const [view, setView] = useState<"menu" | "cart" | "status" | "kitchen">("menu");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => readLocal("activeOrderId", null));

  const lastNotifiedReadyId = useRef<string | null>(null);

  // Local only: cart + activeOrderId speichern (orders NICHT mehr lokal persistieren)
  useEffect(() => saveLocal("cart", cart), [cart]);
  // useEffect(() => saveLocal("orders", orders), [orders]); // deaktiviert – Orders kommen aus der DB
  useEffect(() => saveLocal("activeOrderId", activeOrderId), [activeOrderId]);

  // Wenn Kunde die Status-Seite öffnet, einmalig um Permission bitten
  useEffect(() => {
    if (view === 'status') { void ensureNotifyPermission(); }
  }, [view]);

  // Kitchen: alle 4s Liste laden
  useEffect(() => {
    if (view !== "kitchen") return;
    let alive = true;
    const load = async () => {
      try {
        const rows = await apiFetchOrders();
        if (alive) setOrders(rows);
      } catch {}
    };
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [view]);

  // Kunden-Status: alle 4s aktive Bestellung nachladen + bei "ready" benachrichtigen
  useEffect(() => {
    if (!activeOrderId || view !== "status") return;
    let alive = true;
    const tick = async () => {
      try {
        const o = await apiFetchOrder(activeOrderId);
        if (o && alive) {
          setOrders(prev => {
            const i = prev.findIndex(x => x.orderId === o.orderId);
            if (i === -1) return [o, ...prev];
            const copy = [...prev]; copy[i] = o; return copy;
          });
          if (o.status === 'ready' && lastNotifiedReadyId.current !== o.orderId) {
            notifyReady(o.orderId);
            lastNotifiedReadyId.current = o.orderId;
          }
        }
      } catch {}
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [activeOrderId, view]);

  const currentTotal = useMemo(() => {
    if (!selected) return 0;
    const extrasPrice = extras.reduce((sum, name) => sum + (EXTRAS.find((e) => e.name === name)?.price || 0), 0);
    return (selected.basePrice + extrasPrice) * qty;
  }, [selected, extras, qty]);



  function addToCart() {
    if (!selected) return;
    const line: CartLine = {
      id: uuid(),
      item: selected,
      qty,
      custom: { sauce, salad, extras: [...extras] },
    };
    setCart((c) => [...c, line]);
    // reset qty and extras but keep selected
    setQty(1);
    setExtras([]);
  }

  // NEU: schreibt in DB, merkt orderId und lädt Liste aus DB
  function placeOrder() {
    if (cart.length === 0) return;
    void ensureNotifyPermission(); // Kunde früh um Erlaubnis bitten
    (async () => {
      try {
        const { id } = await apiCreateOrderFromCart(cart);
        setActiveOrderId(id);
        setCart([]);
        setView("status");
        setOrders(await apiFetchOrders());
      } catch (e) {
        console.error(e);
        alert("Bestellung konnte nicht gespeichert werden.");
      }
    })();
  }

  // NEU: Status via API patchen und Liste neu laden
  function updateOrderStatus(orderId: string, next: OrderStatus) {
    (async () => {
      try {
        await apiUpdateOrderStatus(orderId, next);
        setOrders(await apiFetchOrders());
      } catch (e) {
        console.error(e);
        alert("Status-Update fehlgeschlagen.");
      }
    })();
  }

  const activeOrder = orders.find((o) => o.orderId === activeOrderId) || null;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-bold text-xl">🥙 Efendi Express</div>
          <nav className="flex gap-2">
            <button className={`chip ${view === "menu" ? "chip-active" : ""}`} onClick={() => setView("menu")}>Menü</button>
            <button className={`chip ${view === "cart" ? "chip-active" : ""}`} onClick={() => setView("cart")}>Warenkorb ({cart.length})</button>
            <button className={`chip ${view === "status" ? "chip-active" : ""}`} onClick={() => setView("status")}>Status</button>
            <button className={`chip ${view === "kitchen" ? "chip-active" : ""}`} onClick={() => setView("kitchen")}>Kitchen</button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
        {view === "menu" && (
          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h2 className="text-2xl font-semibold mb-3">Gericht wählen</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {MENU.map((m) => (
                  <button
                    key={m.id}
                    className={`border rounded-2xl p-3 text-left hover:shadow transition ${
                      selected?.id === m.id ? "border-emerald-500 ring-2 ring-emerald-200" : "border-neutral-200"
                    }`}
                    onClick={() => setSelected(m)}
                  >
                    <div className="font-medium">{m.name}</div>
                    <div className="text-sm text-neutral-600">{m.description}</div>
                    <div className="mt-2 font-semibold">{money(m.basePrice)}</div>
                  </button>
                ))}
              </div>

              <h2 className="text-2xl font-semibold mt-8 mb-3">Anpassungen</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-neutral-600 mb-1">Soße</div>
                  <div className="flex flex-wrap gap-2">
                    {(["Knoblauch", "Scharf", "Yoghurt", "Ohne"] as Sauce[]).map((s) => (
                      <Chip key={s} active={sauce === s} onClick={() => setSauce(s)}>{s}</Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-600 mb-1">Salat</div>
                  <div className="flex flex-wrap gap-2">
                    {(["Alles", "Ohne Zwiebeln", "Ohne Tomaten", "Ohne Salat"] as Salad[]).map((s) => (
                      <Chip key={s} active={salad === s} onClick={() => setSalad(s)}>{s}</Chip>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm text-neutral-600 mb-1">Extras</div>
                  <div className="flex flex-wrap gap-2">
                    {EXTRAS.map((e) => (
                      <Chip key={e.name} active={extras.includes(e.name)} onClick={() => setExtras(prev => prev.includes(e.name) ? prev.filter(x => x !== e.name) : [...prev, e.name])}>
                        {e.name} (+{money(e.price)})
                      </Chip>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-neutral-600">Menge</div>
                  <div className="inline-flex items-center border rounded-xl overflow-hidden">
                    <button className="px-3 py-1" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                    <div className="px-4 py-1 font-medium">{qty}</div>
                    <button className="px-3 py-1" onClick={() => setQty((q) => q + 1)}>+</button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white border rounded-2xl p-4">
                  <div>
                    <div className="text-neutral-600 text-sm">Zwischensumme</div>
                    <div className="text-xl font-semibold">{money(currentTotal)}</div>
                  </div>
                  <button className="btn-primary" onClick={addToCart}>Zum Warenkorb hinzufügen</button>
                </div>
              </div>
            </section>

            <aside className="bg-white border rounded-2xl p-4 h-fit sticky top-20">
              <h3 className="text-xl font-semibold mb-3">Warenkorb</h3>
              {cart.length === 0 ? (
                <div className="text-neutral-500">Noch keine Artikel im Warenkorb.</div>
              ) : (
                <div className="space-y-3">
                  {cart.map((l, i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="border rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{l.qty}× {l.item.name}</div>
                          <div className="text-sm text-neutral-600">
                            Soße: {l.custom.sauce} · {l.custom.salad}
                            {l.custom.extras.length > 0 && (<>{" "}· Extras: {l.custom.extras.join(", ")}</>)}
                          </div>
                        </div>
                        <button className="text-red-600 text-sm" onClick={() => removeLine(l.id)}>Entfernen</button>
                      </div>
                    </div>
                  ))}

                  <CartTotals lines={cart} />

                  <button className="btn-primary w-full" onClick={() => setView("cart")}>Zur Kasse</button>
                </div>
              )}
            </aside>
          </div>
        )}

        {view === "cart" && (
          <section className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold mb-4">Kasse</h2>
            {cart.length === 0 ? (
              <div className="text-neutral-600">Dein Warenkorb ist leer.</div>
            ) : (
              <div className="space-y-4">
                {cart.map((l, i) => (
                  <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="border rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{l.qty}× {l.item.name}</div>
                        <div className="text-sm text-neutral-600">
                          Soße: {l.custom.sauce} · {l.custom.salad}
                          {l.custom.extras.length > 0 && (<> · Extras: {l.custom.extras.join(", ")}</>)}
                        </div>
                      </div>
                      <div className="text-sm text-neutral-600">{money(lineTotal(l))}</div>
                    </div>
                  </div>
                ))}

                <CartTotals lines={cart} />

                <div className="bg-white border rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-neutral-600">Bezahlung</div>
                      <div className="font-medium">(Demo) Vor-Ort oder Online</div>
                    </div>
                    <button className="btn-primary" onClick={placeOrder}>Bestellung abschicken</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {view === "status" && (
          <StatusView activeOrder={activeOrder} onBackToMenu={() => setView("menu")} />
        )}

        {view === "kitchen" && (
          <KitchenView
            orders={orders}
            onAdvance={(o) => {
              const next = nextStatus(o.status);
              updateOrderStatus(o.orderId, next);
            }}
          />
        )}
      </main>

      <footer className="py-10 text-center text-sm text-neutral-500">
        Prototyp – keine echte Bezahlung. © {new Date().getFullYear()} Efendi Express
      </footer>

    </div>
  );
}

function lineTotal(l: CartLine) {
  const extrasPrice = l.custom.extras.reduce((s, name) => s + (EXTRAS.find((e) => e.name === name)?.price || 0), 0);
  return (l.item.basePrice + extrasPrice) * l.qty;
}

function CartTotals({ lines }: { lines: CartLine[] }) {
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const service = 0; // could be e.g., 1.0
  const total = subtotal + service;
  return (
    <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
      <div>
        <div className="text-sm text-neutral-600">Zwischensumme</div>
        <div className="font-semibold">{money(subtotal)}</div>
      </div>
      <div>
        <div className="text-sm text-neutral-600">Gesamt</div>
        <div className="text-xl font-semibold">{money(total)}</div>
      </div>
    </div>
  );
}

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button className={`chip ${active ? "chip-active" : "border-neutral-300"}`} onClick={onClick}>
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; cls: string }> = {
    in_queue: { label: "In Warteschlange", cls: "bg-neutral-100 text-neutral-700" },
    preparing: { label: "In Zubereitung", cls: "bg-amber-100 text-amber-800" },
    ready: { label: "Abholbereit", cls: "bg-emerald-100 text-emerald-800" },
    picked_up: { label: "Abgeholt", cls: "bg-blue-100 text-blue-800" },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${cls}`}>{label}</span>;
}

function nextStatus(s: OrderStatus): OrderStatus {
  if (s === "in_queue") return "preparing";
  if (s === "preparing") return "ready";
  if (s === "ready") return "picked_up";
  return "picked_up";
}

function StatusView({ activeOrder, onBackToMenu }: { activeOrder: Order | null; onBackToMenu: () => void }) {
  return (
    <section className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-semibold mb-2">Bestellstatus</h2>
      {!activeOrder ? (
        <div className="text-neutral-600">
          Du hast aktuell keine aktive Bestellung. <button className="text-emerald-700 underline" onClick={onBackToMenu}>Zurück zum Menü</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white border rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-neutral-600">Bestellnummer</div>
              <div className="text-xl font-semibold">{activeOrder.orderId}</div>
            </div>
            <StatusBadge status={activeOrder.status} />
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="text-sm text-neutral-600 mb-2">Zusammenfassung</div>
            <ul className="space-y-2">
              {activeOrder.lines.map((l, i) => (
                <li key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{l.qty}× {l.item.name}</div>
                    <div className="text-sm text-neutral-600">
                      Soße: {l.custom.sauce} · {l.custom.salad}
                      {l.custom.extras.length > 0 && <> · Extras: {l.custom.extras.join(', ')}</>}
                    </div>
                  </div>
                  <div className="text-sm text-neutral-600">{money(lineTotal(l))}</div>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="font-medium">Gesamt</div>
              <div className="text-xl font-semibold">{money(activeOrder.total)}</div>
            </div>
          </div>

          <div className="bg-white border rounded-2xl p-4">
            <div className="text-sm text-neutral-600 mb-2">Hinweis</div>
            <p>
              Du erhältst eine Benachrichtigung, sobald die Bestellung <b>abholbereit</b> ist. In diesem Prototyp kannst du
              das im Menüpunkt <i>Küche (Demo)</i> simulieren.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function KitchenView({ orders, onAdvance }: { orders: Order[]; onAdvance: (o: Order) => void; }) {
  type FilterType = OrderStatus | "all";
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = orders.filter((o) => (filter === "all" ? true : o.status === filter));

  return (
    <section className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-2xl font-semibold">Küchen-Dashboard (Demo)</h2>
        <div className="flex items-center gap-2 text-sm">
          <span>Filter:</span>
          <select className="border rounded-lg px-2 py-1" value={filter} onChange={(e) => setFilter(e.target.value as FilterType)}>
            <option value="all">Alle</option>
            <option value="in_queue">Warteschlange</option>
            <option value="preparing">In Zubereitung</option>
            <option value="ready">Abholbereit</option>
            <option value="picked_up">Abgeholt</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-neutral-600">Keine Bestellungen.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <AnimatePresence>
            {filtered.map((o) => (
              <motion.div
                key={o.orderId}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border rounded-2xl p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-neutral-600">Bestellung</div>
                    <div className="text-xl font-semibold">{o.orderId}</div>
                  </div>
                  <StatusBadge status={o.status} />
                </div>

                <ul className="mt-2 text-sm text-neutral-700 space-y-1">
                  {o.lines.map((l, i) => (
                    <li key={l.id ?? `${l.item?.id ?? 'item'}-${i}`}>
                      {l.qty}× {l.item.name}
                      {l.custom.extras.length > 0 && (
                        <span className="text-neutral-500"> · {l.custom.extras.join(', ')}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-center justify-between">
                  <div className="font-medium">Gesamt: {money(o.total)}</div>
                  <button className="btn-primary" onClick={() => onAdvance(o)}>Nächster Status</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
