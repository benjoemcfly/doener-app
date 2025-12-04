'use client';

import React from 'react';
import type { OrderStatus } from '@/types/order';

export function StatusBadge({ s }: { s: OrderStatus }) {
  const map: Record<OrderStatus, { text: string; cls: string }> = {
    in_queue: {
      text: 'In Queue',
      cls: 'bg-neutral-100 text-neutral-700 ring-1 ring-inset ring-neutral-200',
    },
    preparing: {
      text: 'Preparing',
      cls: 'bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-200',
    },
    ready: {
      text: 'Ready',
      cls: 'bg-emerald-600 text-white',
    },
    picked_up: {
      text: 'Picked up',
      cls: 'bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200',
    },
  };

  const it = map[s] ?? map.in_queue;

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] ${it.cls}`}>
      {it.text}
    </span>
  );
}

export default StatusBadge;
