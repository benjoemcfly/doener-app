'use client';
import React from 'react';
import type { OrderStatus } from '@/types/order';


export function StatusBadge({ s }: { s: OrderStatus }) {
const map: Record<OrderStatus, { text: string; cls: string }> = {
in_queue: { text: 'In Queue', cls: 'bg-gray-100 text-gray-700' },
preparing: { text: 'Preparing', cls: 'bg-amber-100 text-amber-800' },
ready: { text: 'Ready', cls: 'bg-emerald-600 text-white' },
picked_up: { text: 'Picked up', cls: 'bg-sky-100 text-sky-800' },
};
const it = map[s];
return <span className={`rounded-full px-2.5 py-1 text-xs ${it.cls}`}>{it.text}</span>;
}