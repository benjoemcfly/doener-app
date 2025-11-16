'use client';
import React from 'react';
import type { Category } from '@/app/page';


export function CategoryNav({ tabs, active, onSelect }: { tabs: readonly Category[]; active: Category; onSelect: (c: Category) => void }) {
return (
<nav className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
{tabs.map((c) => (
<button key={c} onClick={() => onSelect(c)} className={`snap-start rounded-full px-3.5 py-1.5 text-[13px] shadow-sm ring-1 ${active === c ? 'bg-neutral-900 text-white ring-neutral-900/10' : 'bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50'}`}>{c}</button>
))}
</nav>
);
}