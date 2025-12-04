'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { MenuItem, OptionGroup } from '@/types/order';

// Eigene formatPrice-Hilfe (identisch zur Logik in page.tsx)
function formatPrice(cents: number) {
  return (cents / 100).toLocaleString('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
  });
}

export function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-3"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">
        {children}
      </div>
    </div>
  );
}

export function CustomizeCard({
  item,
  initialSpecs,
  onCancel,
  onConfirm,
}: {
  item: MenuItem;
  initialSpecs: Record<string, string[]>;
  onCancel: () => void;
  onConfirm: (specs: Record<string, string[]>) => void;
}) {
  const [specs, setSpecs] = useState<Record<string, string[]>>(
    initialSpecs,
  );

  const toggle = useCallback(
    (g: OptionGroup, choiceId: string) => {
      setSpecs((prev) => {
        const current = prev[g.id] ?? [];
        if (g.type === 'single') {
          return { ...prev, [g.id]: [choiceId] };
        }
        return current.includes(choiceId)
          ? {
              ...prev,
              [g.id]: current.filter((x) => x !== choiceId),
            }
          : {
              ...prev,
              [g.id]: [...current, choiceId],
            };
      });
    },
    [],
  );

  const canConfirm = useMemo(
    () =>
      (item.options || []).every(
        (g) =>
          !g.required ||
          (specs[g.id]?.length ?? 0) > 0,
      ),
    [item.options, specs],
  );

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="text-3xl">
          {item.emoji ?? '🥙'}
        </div>
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.015em]">
            {item.name}
          </div>
          <div className="text-[13px] text-neutral-500">
            {formatPrice(item.price_cents)}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {(item.options || []).map((g) => (
          <div key={g.id}>
            <div className="text-[13px] font-medium">
              {g.label}
              {g.required ? ' *' : ''}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const selected = (specs[g.id] ?? []).includes(
                  c.id,
                );
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(g, c.id)}
                    className={`rounded-full px-3 py-1.5 text-[13px] shadow-sm ring-1 ${
                      selected
                        ? 'bg-emerald-600 text-white ring-emerald-600/30'
                        : 'bg-neutral-100 text-neutral-800 ring-neutral-200 hover:bg-neutral-200'
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button
          className="rounded-full bg-white px-4 py-2 text-[13px] ring-1 ring-neutral-200"
          onClick={onCancel}
        >
          Abbrechen
        </button>
        <button
          className="rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          onClick={() => onConfirm(specs)}
          disabled={!canConfirm}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}

export default CustomizeCard;
