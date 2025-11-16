'use client';
import React from 'react';
import type { OrderLine } from '@/app/types/order';
import { formatPrice } from '@/app/components';


export function MiniCart({
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