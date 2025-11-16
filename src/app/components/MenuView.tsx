'use client';
import React from 'react';
import type { MenuItem } from '@/types/orders';
import { formatPrice, initDefaultSpecs } from './helpers';


export function MenuView({
items,
onQuickAdd,
onCustomize,
}: {
items: MenuItem[];
onQuickAdd: (item: MenuItem) => void;
onCustomize: (item: MenuItem, initialSpecs: Record<string, string[]>) => void;
}) {
return (
<section>
<h2 className="text-lg font-semibold">Wähle dein Gericht</h2>
<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
{items.map((m) => (
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
onClick={() => onQuickAdd(m)}
>
Schnell hinzufügen
</button>
<button
className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/30 hover:bg-emerald-50"
onClick={() => onCustomize(m, initDefaultSpecs(m))}
>
Anpassen & hinzufügen
</button>
</div>
</article>
))}
</div>
</section>
);
}