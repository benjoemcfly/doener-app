'use client';
import React, { useCallback, useMemo, useState } from 'react';
import type { MenuItem, OptionGroup } from '@/app/types/order';
import { formatPrice } from './helpers';

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
  const [specs, setSpecs] = useState<Record<string, string[]>>(initialSpecs);

  const toggle = useCallback((g: OptionGroup, choiceId: string) => {
    setSpecs((prev) => {
      const current = prev[g.id] ?? [];
      if (g.type === 'single') return { ...prev, [g.id]: [choiceId] };
      return current.includes(choiceId)
        ? { ...prev, [g.id]: current.filter((x) => x !== choiceId) }
        : { ...prev, [g.id]: [...current, choiceId] };
    });
  }, []);

  const canConfirm = useMemo(
    () => (item.options || []).every((g) => !g.required || (specs[g.id]?.length ?? 0) > 0),
    [item.options, specs]
  );

  return (
    <div>
      <div className="flex items-start gap-3">
        <div className="text-3xl">{item.emoji ?? '🥙'}</div>
        <div>
          <div className="text-lg font-semibold">{item.name}</div>
          <div className="text-sm text-gray-500">{formatPrice(item.price_cents)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {(item.options || []).map((g) => (
          <div key={g.id}>
            <div className="text-sm font-medium">
              {g.label}
              {g.required ? ' *' : ''}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const selected = (specs[g.id] ?? []).includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(g, c.id)}
                    className={`rounded-full px-3 py-1.5 text-sm shadow ${
                      selected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
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
        <button className="rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-gray-200" onClick={onCancel}>
          Abbrechen
        </button>
        <button
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          onClick={() => onConfirm(specs)}
          disabled={!canConfirm}
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
