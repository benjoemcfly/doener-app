'use client';

import React, { useState } from 'react';
import type { MenuItem } from '@/app/types/orders';
import { formatPrice } from './helpers';

type MenuViewProps = {
  categories: readonly string[];
  menuByCategory: Record<string, MenuItem[]>;
  onQuickAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;

  // Neu: optional kontrollierte Kategorie von außen
  activeCategory?: string;
  onChangeCategory?: (category: string) => void;
};

export function MenuView({
  categories,
  menuByCategory,
  onQuickAdd,
  onCustomize,
  activeCategory,
  onChangeCategory,
}: MenuViewProps) {
  // interner Fallback-State, falls keine Kategorie von außen gesteuert wird
  const [internalCategory, setInternalCategory] = useState<string>(
    categories[0] ?? ''
  );

  const currentCategory = activeCategory ?? internalCategory;
  const setCategory = onChangeCategory ?? setInternalCategory;

  const items = menuByCategory[currentCategory] ?? [];

  return (
    <section className="pb-28">
      {/* Kategorien-Navigation */}
      <nav className="mb-3 mt-1 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`snap-start rounded-full px-3.5 py-1.5 text-[13px] shadow-sm ring-1 ${
              currentCategory === c
                ? 'bg-neutral-900 text-white ring-neutral-900/10'
                : 'bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {c}
          </button>
        ))}
      </nav>

      {/* Karten der aktiven Kategorie */}
      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((m) => (
          <article
            key={m.id}
            className="group rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
          >
            <div className="grid grid-cols-[1fr_140px] items-center gap-4 p-4">
              {/* Textspalte */}
              <div>
                <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">
                  {m.name}
                </h3>
                <div className="mt-1 text-[13px] text-neutral-500">
                  {formatPrice(m.price_cents)}
                </div>
                {m.options && m.options.length > 0 && (
                  <div className="mt-2 text-[12px] text-emerald-700">
                    Tippe um zu konfigurieren
                  </div>
                )}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    className="rounded-full bg-black px-3 py-2 text-[13px] font-medium text-white shadow-sm"
                    onClick={() => onQuickAdd(m)}
                  >
                    Schnell hinzufügen
                  </button>
                  {m.options && m.options.length > 0 && (
                    <button
                      className="rounded-full bg-white px-3 py-2 text-[13px] font-medium text-emerald-700 ring-1 ring-emerald-600/30 hover:bg-emerald-50"
                      onClick={() => onCustomize(m)}
                    >
                      Anpassen
                    </button>
                  )}
                </div>
              </div>

              {/* Emoji + +-Button */}
              <div className="relative h-28 w-full select-none">
                <div className="absolute inset-0 rounded-2xl bg-neutral-100/80 ring-1 ring-inset ring-neutral-200/80" />
                <div className="absolute inset-0 grid place-items-center text-5xl">
                  {m.emoji ?? '🥙'}
                </div>
                <button
                  className="absolute bottom-2 right-2 grid h-9 w-9 place-items-center rounded-full bg-neutral-900 text-white shadow-sm"
                  aria-label="Hinzufügen"
                  onClick={() => onQuickAdd(m)}
                >
                  +
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
