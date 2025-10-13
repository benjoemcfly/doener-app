"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
// NOTE: entfernt: import clsx from "clsx"; (verursachte Module-not-found)
// NOTE: entfernt: import useReadyFeedback from "@/useReadyFeedback"; (optional nicht vorhanden)

// --- kleiner Helper, um classNames ohne Abhängigkeit zu kombinieren ---
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// --- lokaler Fallback-Hook für Ready-Feedback (Sound + Vibration) ---
// Wenn du später die Projekt-Variante nutzen willst, kannst du die lokale
// Implementierung ignorieren und wieder `@/useReadyFeedback` importieren.
function useReadyFeedbackLocal() {
  const playedRef = useRef(false);
  return () => {
    // WebAudio Beep (kurz)
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880; // A5
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      o.start();
      o.stop(ctx.currentTime + 0.15);
      o.onended = () => ctx.close();
    } catch {}

    // SW/Tab-Vibration (falls erlaubt)
    try {
      if (navigator?.vibrate) navigator.vibrate([180]);
    } catch {}
  };
}

// =========================
// Types (mirror API payloads)
// =========================
export type OrderStatus = "in_queue" | "preparing" | "ready" | "picked_up";

export type OrderLine = {
  name: string;
  qty: number;
  price_cents: number;
};

export type Order = {
  id: string;
  lines: OrderLine[];
  total_cents: number;
  status: OrderStatus;
  created_at?: string;
  updated_at?: string;
};

// =========================
// Local storage helpers (Session-Persistenz der Order-IDs)
// =========================
const LS_KEY = "sessionOrderIds"; // nur IDs, neueste zuerst

function readStoredIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as string[]) : [];
  } catch {
    return [];
  }
}

function writeStoredIds(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function addStoredId(id: string) {
  const ids = readStoredIds();
  if (!ids.includes(id)) {
    ids.unshift(id); // neueste oben
    writeStoredIds(ids);
  }
}

function removeStoredId(id: string) {
  const ids = readStoredIds();
  const next = ids.filter((x) => x !== id);
  writeStoredIds(next);
}

// =========================
// Fetch helpers
// =========================
async function fetchOrder(id: string): Promise<Order | null> {
  try {
    const res = await fetch(`/api/orders/${id}`, {
      method: "GET",
      headers: { "Cache-Control": "no-store" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { order: Order } | Order;
    const order = (data as any).order ?? data;
    return order as Order;
  } catch {
    return null;
  }
}

async function createOrder(payload: { lines: OrderLine[]; total_cents: number }) {
  const res = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    cache: "no-store",
    body: JSON.stringify({
      lines: payload.lines,
      total_cents: payload.total_cents,
    }),
  });
  if (!res.ok) throw new Error(`Order create failed (${res.status})`);
  const data = (await res.json()) as { id?: string; order?: Order } | Order;
  const id = (data as any).id ?? (data as any).order?.id;
  if (!id || typeof id !== "string") throw new Error("No order id returned");
  return id as string;
}

// =========================
// UI atoms
// =========================
const badgeColors: Record<OrderStatus, string> = {
  in_queue: "bg-slate-100 text-slate-700",
  preparing: "bg-amber-100 text-amber-700",
  ready: "bg-emerald-100 text-emerald-700",
  picked_up: "bg-gray-200 text-gray-600",
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const label =
    status === "in_queue"
      ? "In Warteschlange"
      : status === "preparing"
      ? "In Zubereitung"
      : status === "ready"
      ? "Abholbereit"
      : "Abgeholt";
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeColors[status])}>
      {label}
    </span>
  );
}

function Money({ cents }: { cents: number }) {
  return <span>{(cents / 100).toFixed(2)} CHF</span>;
}

// =========================
// Polling-Hook
// =========================
function useInterval(callback: () => void, delayMs: number) {
  const savedCb = useRef(callback);
  useEffect(() => {
    savedCb.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delayMs === null) return;
    const id = setInterval(() => savedCb.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}

// =========================
// Status-Liste: pollt alle Orders der Session bis picked_up
// =========================
function OrderStatusList() {
  const [ids, setIds] = useState<string[]>(() => readStoredIds());
  const [orders, setOrders] = useState<Record<string, Order | null>>({});
  const alertedRef = useRef<Set<string>>(new Set());

  // Sound + Vibration bei Übergang → ready (lokaler Fallback)
  const readyFeedback = useReadyFeedbackLocal();

  const sortedIds = useMemo(() => {
    const list = [...ids];
    const active = list.filter((id) => orders[id]?.status !== "picked_up");
    const done = list.filter((id) => orders[id]?.status === "picked_up");
    return [...active, ...done];
  }, [ids, orders]);

  const refreshOne = useCallback(async (id: string) => {
    const next = await fetchOrder(id);
    setOrders((cur) => ({ ...cur, [id]: next }));

    if (next && next.status === "ready" && !alertedRef.current.has(id)) {
      try { readyFeedback(); } catch {}
      alertedRef.current.add(id);
    }
  }, [readyFeedback]);

  const refreshAll = useCallback(async () => {
    const currentIds = readStoredIds();
    if (currentIds.length !== ids.length || currentIds.some((x, i) => x !== ids[i])) {
      setIds(currentIds);
    }
    await Promise.all(currentIds.map((id) => refreshOne(id)));
  }, [ids, refreshOne]);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useInterval(() => {
    const haveOpen = ids.some((id) => {
      const st = orders[id]?.status;
      return st && st !== "picked_up";
    });
    if (ids.length && haveOpen) refreshAll();
  }, 4000);

  const forgetOne = (id: string) => {
    removeStoredId(id);
    setIds(readStoredIds());
  };

  if (!sortedIds.length) {
    return (
      <div className="text-sm text-slate-500">
        Noch keine Bestellungen in dieser Session. Nach dem Bestellen erscheinen die Aufträge hier.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedIds.map((id) => {
        const o = orders[id];
        return (
          <div key={id} className={cx("rounded-2xl border p-3 sm:p-4 shadow-sm", o?.status === "picked_up" && "opacity-70")}> 
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-mono text-slate-500">#{id}</div>
              {o?.status && <StatusBadge status={o.status} />}
            </div>

            <div className="mt-2 text-sm">
              {o ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-slate-800">
                    {o.lines.map((l, i) => (
                      <span key={i}>
                        {l.qty}× {l.name}
                        {i < o.lines.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                  <div className="font-semibold">
                    Summe: <Money cents={o.total_cents} />
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">Lade Details…</div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                onClick={() => refreshOne(id)}
              >
                Jetzt aktualisieren
              </button>
              <button
                className="text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700"
                onClick={() => forgetOne(id)}
                title="Aus dieser Session-Liste entfernen (kein Einfluss auf Küche/DB)"
              >
                Aus Liste entfernen
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =========================
// Demo-Warenkorb (unverändert kapseln)
// =========================
function DemoMenuAndCart({ onSubmit }: { onSubmit: (payload: { lines: OrderLine[]; total_cents: number }) => Promise<void> }) {
  const [qty, setQty] = useState(1);
  const price = 950; // 9.50 CHF Demo
  const lines = useMemo<OrderLine[]>(() => [{ name: "Döner", qty, price_cents: price }], [qty]);
  const total = useMemo(() => qty * price, [qty]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onSubmit({ lines, total_cents: total });
    } catch (e: any) {
      setErr(e?.message || "Fehler beim Bestellen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border p-4 shadow-sm">
      <div className="text-lg font-semibold">Bestellen</div>
      <div className="flex items-center gap-3">
        <label className="text-sm">Anzahl Döner:</label>
        <input
          type="number"
          min={1}
          className="w-20 rounded-lg border px-2 py-1"
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
        />
        <div className="ml-auto text-sm">Zwischensumme: <Money cents={total} /></div>
      </div>
      {err && <div className="text-sm text-red-600">{err}</div>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {busy ? "Wird gesendet…" : "Jetzt bestellen"}
      </button>
      <p className="text-xs text-slate-500">
        Hinweis: Dies ist ein minimaler Demo-Warenkorb. Falls deine bestehende Seite bereits einen
        umfangreicheren Checkout hat, bleibt dieser unangetastet – wichtig ist nur, dass beim Absenden
        die Order-ID in der Session-Liste landet (siehe Code in onSubmit).
      </p>
    </div>
  );
}

// =========================
// Main Page
// =========================
export default function Page() {
  const [activeTab, setActiveTab] = useState<"order" | "status">("order");

  const handleSubmit = useCallback(async (payload: { lines: OrderLine[]; total_cents: number }) => {
    const id = await createOrder(payload);
    addStoredId(id); // alte Bestellungen bleiben erhalten
    setActiveTab("status");
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Döner – Self Ordering</h1>
        <nav className="flex gap-2">
          <button
            onClick={() => setActiveTab("order")}
            className={cx(
              "rounded-full px-3 py-1 text-sm",
              activeTab === "order" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            )}
          >
            Bestellung
          </button>
          <button
            onClick={() => setActiveTab("status")}
            className={cx(
              "rounded-full px-3 py-1 text-sm",
              activeTab === "status" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
            )}
          >
            Status
          </button>
        </nav>
      </header>

      {activeTab === "order" ? (
        <DemoMenuAndCart onSubmit={handleSubmit} />
      ) : (
        <section className="space-y-4">
          <div className="text-sm text-slate-600">
            Hier erscheinen alle Bestellungen dieser Browsersession (neueste oben). Jede Bestellung wird live aktualisiert, bis sie
            <span className="mx-1 inline-flex"><StatusBadge status="picked_up" /></span> ist. Bei <span className="mx-1 inline-flex"><StatusBadge status="ready" /></span> gibt es Ton + Vibration.
          </div>
          <OrderStatusList />
        </section>
      )}

      <footer className="mt-8 text-xs text-slate-500">
        Küche: <Link href="/kitchen" className="underline underline-offset-2">Zum Dashboard</Link>
      </footer>
    </main>
  );
}
