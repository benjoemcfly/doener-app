'use client';
import React from 'react';
import type { Category } from '@/app/page';
import type { MenuItem } from '@/app/types/order';


export function MenuCatalog({ categories, menuByCategory, sectionRefs, onQuickAdd, onCustomize }: {
categories: readonly Category[];
menuByCategory: Record<Category, MenuItem[]>;
sectionRefs: React.MutableRefObject<Record<Category, HTMLDivElement | null>>;
onQuickAdd: (m: MenuItem) => void;
onCustomize: (m: MenuItem) => void;
}) {
return (
<>
{categories.map((cat) => (
<div key={cat} ref={(el) => { sectionRefs.current[cat] = el; }} data-cat={cat} className="scroll-mt-28">
<h2 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-neutral-900">{cat}</h2>
<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
{menuByCategory[cat].map((m) => (
<article key={m.id} className="group rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md">
<div className="grid grid-cols-[1fr_140px] items-center gap-4 p-4">
<div>
<h3 className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">{m.name}</h3>
<div className="mt-1 text-[13px] text-neutral-500">{formatPrice(m.price_cents)}</div>
<div className="mt-2 text-[12px] text-emerald-700">Tippe um zu konfigurieren</div>
<div className="mt-3 flex items-center gap-2">
<button className="rounded-full bg-black px-3 py-2 text-[13px] font-medium text-white shadow-sm" onClick={() => onQuickAdd(m)}>Schnell hinzufügen</button>
<button className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-600/30 hover:bg-emerald-50" onClick={() => onCustomize(m)}>Anpassen</button>
</div>
</div>
<div className="relative h-28 w-full select-none">
<div className="absolute inset-0 rounded-2xl bg-neutral-100/80 ring-1 ring-inset ring-neutral-200/80" />
<div className="absolute inset-0 grid place-items-center text-5xl">{m.emoji ?? '🥙'}</div>
<button className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-neutral-900 text-white shadow-sm" aria-label="Hinzufügen" onClick={() => onQuickAdd(m)}>+</button>
</div>
</div>
</article>
))}
</div>
</div>
))}
</>
);
}