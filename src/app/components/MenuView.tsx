'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { MenuItem } from '@/app/types/orders';
import { formatPrice } from './helpers';

type MenuViewProps = {
  categories: readonly string[];
  menuByCategory: Record<string, MenuItem[]>;
  onQuickAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;
};

export function MenuView({
  categories,
  menuByCategory,
  onQuickAdd,
  onCustomize,
}: MenuViewProps) {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] ?? '');
  const navRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  const items = menuByCategory[activeCategory] ?? [];

  // Scroll-basierte Kategorie-Erkennung
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    categories.forEach((cat) => {
      const section = document.querySelector<HTMLHeadingElement>(`#cat-${cat}`);
      if (!section) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              setActiveCategory(cat);
            }
          });
        },
        { rootMargin: '-50% 0px -50% 0px', threshold: 0.1 }
      );

      observer.observe(section);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [categories]);

  // Animation für den Balken unter der aktiven Kategorie
  useEffect(() => {
    if (!navRef.current || !indicatorRef.current) return;

    const activeBtn = navRef.current.querySelector<HTMLButtonElement>(
      `button[data-cat="${activeCategory}"]`
    );

    if (activeBtn) {
      const { offsetLeft, offsetWidth } = activeBtn;
      indicatorRef.current.style.transform = `translateX(${offsetLeft}px)`;
      indicatorRef.current.style.width = `${offsetWidth}px`;
    }
  }, [activeCategory]);

  return (
    <section className="pb-28">

      {/* ⭐ Sticky Kategorien-Navigation */}
      <div className="sticky top-[118px] z-30 bg-neutral-50 pb-2">
        <div ref={navRef} className="relative border-b border-neutral-200">

          {/* Running indicator */}
          <div
            ref={indicatorRef}
            className="absolute bottom-0 h-[3px] bg-neutral-900 transition-all duration-300"
          />

          <nav className="flex gap-3 overflow-x-auto px-2 py-3 scrollbar-hide">
            {categories.map((c) => (
              <button
                key={c}
                data-cat={c}
                onClick={() => {
                  const target = document.querySelector(`#cat-${c}`);
                  if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-medium ${
                  activeCategory === c
                    ? 'text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
              >
                {c}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Kategorieabschnitte + Karten */}
      {categories.map((c) => {
        const sectionItems = menuByCategory[c] ?? [];
        return (
          <div key={c} id={`cat-${c}`} className="scroll-mt-[150px]">
            <h2 className="mt-6 mb-3 px-2 text-xl font-semibold text-neutral-900">{c}</h2>

            <div className="grid grid-cols-1 gap-4 px-2 md:grid-cols-2">
              {sectionItems.map((m) => (
                <article
                  key={m.id}
                  className="group rounded-3xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
                >
                  <div className="grid grid-cols-[1fr_140px] items-center gap-4 p-4">
                    <div>
                      <h3 className="text-[15px] font-semibold leading-tight tracking-[-0.015em] text-neutral-900">
                        {m.name}
                      </h3>

                      <div className="mt-1 text-[13px] text-neutral-500">
                        {formatPrice(m.price_cents)}
                      </div>

                      {m.options && m.options.length > 0 && (
                        <div className="mt-2 text-[12px] text-emerald-700">Tippe um zu konfigurieren</div>
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

                    {/* Emoji + Plus */}
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
          </div>
        );
      })}
    </section>
  );
}
