'use client';
import React from 'react';
import type { Order } from '@/types/order';
import { formatPrice, labelForChoice, labelForGroup } from './helpers';
import { StatusBadge } from './StatusBadge';


export function StatusView({ activeOrderId, activeOrder }: { activeOrderId: string | null; activeOrder: Order | null }) {
return (
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
);
}