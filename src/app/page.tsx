"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
// IMPORTANT: project alias @/* → src/*
// Der vorhandene Hook (WebAudio + SW Vibration im aktiven Tab)
import useReadyFeedback from "@/useReadyFeedback";

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
      lines: payload.lines, // Server stringifiziert intern (JSON.stringify(... )::json)
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
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeColors[status])}>
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
  const alertedRef = useRef<Set<string>>(new Set()); // verhindert doppeltes Feedback

  // Sound + Vibration bei Übergang → ready (Hook aus Projekt)
  const anyReadyFeedback: any = useReadyFeedback as any;
  const readyFeedback = anyReadyFeedback?.() ?? (() => {});

  const sortedIds = useMemo(() => {
    const list = [...ids];
    const active = list.filter((id) => orders[id]?.status !== "picked_up");
    const done = list.filter((id) => orders[id]?.status === "picked_up");
    return [...active, ...done]; // picked_up am Ende, aber sichtbar
  }, [ids, orders]);

  const refreshOne = useCallback(async (id: string) => {
    const next = await fetchOrder(id);
    setOrders((cur) => ({ ...cur, [id]: next }));

    if (next && next.status === "ready" && !alertedRef.current.has(id)) {
      try { readyFeedback?.(); } catch {}
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
          <div key={id} className={clsx("rounded-2xl border p-3 sm:p-4 shadow-sm", o?.status === "picked_up" && "opacity-70")}> 
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-mono text-slate-500">#{id}</div>
              {o?.status && <StatusBadge status={o.status} />}
            </div>

            <div className="mt-2 text-sm">
              {o ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-slate-800">
                    {o.lines.map((l, i) => (
                      <span key={i} className="after:content-[',