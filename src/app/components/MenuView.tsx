'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { MenuItem } from '@/app/types/orders';
import { formatPrice } from './helpers';

type MenuViewProps = {
  categories: readonly string[];
  menuByCategory: Record<string, MenuItem[]>;
  onQuickAdd: (item: MenuItem) => void;
  onCustomize: (item: MenuItem) => void;

  // optional: von außen gesteuerte Kategorie
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
  // interner Fallback-State, falls nichts von außen kommt
  const [internalCategory, setInternalCategory] = useState<string>(
    categories[0] ?? ''
  );

  const currentCategory = activeCategory ?? internalCategory;

  const setCategory = useCallback(
    (cat: string) => {
      if (onChangeCategory) {
        onChangeCategory(cat);
      } else {
        setInternalCategory(cat);
      }
    },
    [onChangeCategory]
  );

  // Refs für Kategorie-Sektionen (für Scroll-Spy & scrollIntoView)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Refs für Tabs (für den animierten Balken)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const navRef = useRef<HTMLDivElement | null>(null);

  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  // Scroll zu Kategorie bei Klick
  const scrollToCategory = useCallback(
    (cat: string) => {
      setCategory(cat);
      const el = sectionRefs.current[cat];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [setCategory]
  );

  // Scroll-Spy: aktive Kategorie anhand der Scrollposition bestimmen
  useEffect(() => {
    const onScroll = () => {
      if (categories.length === 0) return;

      const threshold = 160; // Abstand von oben, ab wann eine Section "aktiv" ist
      let bestCat = categories[0];
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const cat of categories) {
        const el = sectionRefs.current[cat];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - threshold);

        if (rect.top <= threshold && distance < bestDistance) {
          bestDistance = distance;
          bestCat = cat;
        }
      }

      if (bestCat && bestCat !== currentCategory) {
        setCategory(bestCat);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [categories, currentCategory, setCategory]);

  // Balken-Position unter dem aktiven Tab berechnen
  useEffect(() => {
    const updateIndicator = () => {
      const nav = navRef.current;
      const btn = tabRefs.current[currentCategory];
      if (!nav || !btn) return;

      const navRect = nav.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();

      setIndicator({
        left: btnRect.left - navRect.left,
        width: btnRect.width,
      });
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [currentCategory, categories]);

  return (
    <section className="pb-28">
      {/* Sticky Kategorien-Navigation mit animiertem Balken */}
      <div className="sticky top-16 z-30 bg-neutral-50 pb-2">
        <div
          ref={navRef}
          className="relative border-b border-neutral-200"
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => (
              <button
                key={c}
                ref={(el) => {
                  tabRefs.current[c] = el;
                }}
                onClick={() => scrollToCategory(c)}
                className={`relative snap-start px-3.5 py-2 text-[13px] font-medium transition-colors ${
                  currentCategory === c
                    ? 'text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-900'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {indicator && (
            <div
              className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-neutral-900 transition-[transform,width] duration-200 ease-out"
              style={{
                transform: `translateX(${indicator.left}px)`,
                width: indicator.width,
              }}
            />
          )}
        </div>
      </div>

      {/* Alle Kategorien untereinander – alles auf einer Seite */}
      {categories.map((cat) => {
        const items = menuByCategory[cat] ?? [];
        if (!items.length) return null;

        return (
          <div
            key={cat}
            ref={(el) => {
              sectionRefs.current[cat] = el;
            }}
            className="scroll-mt-28"
          >
            {/* Kategorietitel */}
            <h2 className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-neutral-900">
              {cat}
            </h2>

            {/* Karten der jeweiligen Kategorie */}
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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
          </div>
        );
      })}
    </section>
  );
}
