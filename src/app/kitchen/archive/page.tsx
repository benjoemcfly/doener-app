'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

// ⬇️ Neu: Option-Typen für Label-Rendering
type Choice = { id: string; label: string };
type OptionGroup = { id: string; label: string; type: 'single' | 'multi'; choices: Choice[] };

// ⬇️ MenuItem minimal erweitert (options? bleibt rückwärtskompatibel)
export type MenuItem = { id: string; name: string; price_cents: number; options?: OptionGroup[] };

export type OrderLine = { id: string; item?: MenuItem | null; qty: number; specs?: Record<string, string[]>; note?: string };
export type Order = { id: string; lines: OrderLine[]; total_cents: number; status: OrderStatus; created_at?: string; updated_at?: string };

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function getCookie(name: string) {
  try {
    return document.cookie.split('; ').find((x) => x.startsWith(name + '='))?.split('=')[1];
  } catch {
    return undefined;
  }
}

// ⬇️ Neu: Spezifikations-/Notiz-Renderer (identischer Stil wie im Dashboard)
function LineSpecs({ line }: { line: OrderLine }) {
  const item = line.item ?? undefined;
  const specs = line.specs ?? {};

  // Lookups aus item.options; fallen auf IDs zurück, wenn Labels fehlen
  const groupById = new Map<string, OptionGroup>();
  const choiceById = new Map<string, Choice>();
  (item?.options ?? []).forEach((g) => {
    groupById.set(g.id, g);
    g.choices.forEach((c) => choiceById.set(c.id, c));
  });

  const entries = Object.entries(specs).filter(([, ids]) => Array.isArray(ids) && ids.length > 0);
  if (entries.length === 0 && !line.note) return null;

  return (
    <div className="mt-1 space-y-1 text-[13px] leading-5">
      {entries.map(([groupId, ids]) => (
        <div key={groupId} className="flex flex-wrap gap-1">
          <span className="font-medium text-gray-700 mr-1">{groupById.get(groupId)?.label ?? groupId}:</span>
          {ids.map((cid) => (
            <span key={cid} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">
              {choiceById.get(cid)?.label ?? cid}
            </span>
          ))}
        </div>
      ))}

      {line.note ? (
        <div className="flex flex-wrap gap-1">
          <span className="font-medium text-amber-700">Notiz:</span>
          <span className="text-amber-700">{line.note}</span>
        </div>
      ) : null}
    </div>
  );
}

export default function KitchenArchivePage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const pin = useMemo(() => decodeURIComponent(getCookie('kpin') || ''), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/orders?archived=1', {
        cache: 'no-store',
        headers: { 'x-kitchen-pin': pin },
      });
      if (!r.ok) return;
      const list = (await r.json()) as Order[];
      setOrders(list);
    } catch {}
  }, [pin]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-white text-gray-800">
      <div className="mx-auto max-w-3xl p-4">
        <header className="flex items-center justify-between rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">📦</div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Archiv</h1>
              <p className="text-xs text-gray-500">Abgearbeitete Bestellungen (älter als 3 Minuten)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/kitchen" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
              Dashboard
            </Link>
            <Link href="/" className="rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50">
              Kunden
            </Link>
          </div>
        </header>

        <main className="mt-6">
          <div className="grid grid-cols-1 gap-3">
            {orders.length === 0 && (
              <div className="rounded-2xl border bg-white p-4 text-sm text-gray-500">Noch keine Einträge im Archiv.</div>
            )}

            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">ID: <span className="font-mono">{o.id}</span></div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">{o.status}</span>
                </div>
                <div className="mt-2 divide-y text-sm">
                  {o.lines.map((l, i) => (
                    <div key={l.id ?? `${l.item?.id ?? 'item'}-${i}`} className="py-2">
                      <div className="flex items-start justify-between">
                        <div className="font-medium">{l.qty}× {l.item?.name || 'Position'}</div>
                        <div className="text-gray-500">{formatPrice((l.item?.price_cents ?? 0) * l.qty)}</div>
                      </div>
                      {/* ⬇️ NEU: Spezifikationen + Notiz */}
                      <LineSpecs line={l} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-right text-xs text-gray-500">
                  aktualisiert: {(() => {
                    const d = o.updated_at || o.created_at || '';
                    try { return new Date(d).toLocaleString(); } catch { return d || '–'; }
                  })()}
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
