'use client';

import React from 'react';
import type { Category, MenuItem, OrderLine } from '@/types/order';
import { MiniCart } from '@/app/components/MiniCart';

// Eigene formatPrice-Hilfe (wie in page.tsx)
function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });
}

export type MenuViewProps = {
  categories: readonly Category[];
  menuByCategory: Record<Category, MenuItem[]>;
  lines: OrderLine[];
  totalCents: number;
  sectionRefs: React.MutableRefObject<
    Record<Category, HTMLDivElement | null>
  >;
  onQuickAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
  onAdjustQty: (id: string, delta: number) => void;
  onRemoveLine: (id: string) => void;
  onGoCheckout: () => void;
};

export function MenuView({
  categories,
  menuByCategory,
  lines,
  totalCents,
  sectionRefs,
  onQuickAdd, // bleibt für Kompatibilität, wird hier aber nicht genutzt
  onCustomize,
  onAdjustQty,
  onRemoveLine,
  onGoCheckout,
}: MenuViewProps) {
  return (
    <section className="pb-28">
      {categories.map((cat) => (
        <div
          key={cat}
          ref={(el) => {
            sectionRefs.current[cat] = el;
          }}
          data-cat={cat}
          className="scroll-mt-[150px]"
        >
          <h2 className="mt-6 mb-3 px-2 text-xl font-semibold text-neutral-900">
            {cat}
          </h2>

          <div className="grid grid-cols-1 gap-4 px-2 md:grid-cols-2">
            {(menuByCategory[cat] ?? []).map((m) => (
              <article
                key={m.id}
                className="group cursor-pointer rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
                onClick={() => onCustomize(m)}
              >
                <div className="grid grid-cols-[1fr_140px] items-center gap-4 p-4">
                  <div>
                    <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">
                      {m.name}
                    </h3>

                    <div className="mt-1 text-[13px] text-neutral-500">
                      {formatPrice(m.price_cents)}
                    </div>
                  </div>

                  {/* Emoji-Bereich */}
                  <div className="relative h-28 w-full select-none">
                    <div className="absolute inset-0 rounded-2xl bg-neutral-100/80 ring-1 ring-inset ring-neutral-200/80" />
                    <div className="absolute inset-0 grid place-items-center text-5xl">
                      {m.emoji ?? '🥙'}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ))}

      {/* Mini-Warenkorb am Ende der Menü-Seite */}
      <div className="mt-6">
        <MiniCart
          lines={lines}
          totalCents={totalCents}
          onAdjustQty={onAdjustQty}
          onRemoveLine={onRemoveLine}
          onGoCheckout={onGoCheckout}
        />
      </div>
    </section>
  );
}

export default MenuView;
