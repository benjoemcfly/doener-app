// src/app/menuData.ts

import type { Category, MenuItem, OptionGroup } from '@/types/order';

export function baseOptionGroups(opts?: {
  includeBread?: boolean;
  limitedSalad?: boolean;
}): OptionGroup[] {
  const includeBread = opts?.includeBread ?? true;
  const limitedSalad = opts?.limitedSalad ?? false;
  const groups: OptionGroup[] = [
    includeBread
      ? {
          id: 'bread',
          label: 'Brot',
          type: 'single',
          required: true,
          choices: [
            { id: 'fladenbrot', label: 'Fladenbrot' },
            { id: 'yufka', label: 'Yufka' },
          ],
        }
      : ({
          id: 'base',
          label: 'Basis',
          type: 'single',
          required: true,
          choices: [{ id: 'box', label: 'Box' }],
        } as OptionGroup),
    {
      id: 'sauce',
      label: 'Soßen',
      type: 'multi',
      choices: [
        { id: 'knoblauch', label: 'Knoblauch' },
        { id: 'scharf', label: 'Scharf' },
        { id: 'cocktail', label: 'Cocktail' },
        { id: 'joghurt', label: 'Joghurt' },
      ],
    },
    {
      id: 'salad',
      label: 'Salat',
      type: 'multi',
      choices: limitedSalad
        ? [
            { id: 'salatmix', label: 'Salatmix' },
            { id: 'zwiebeln', label: 'Zwiebeln' },
          ]
        : [
            { id: 'salatmix', label: 'Salatmix' },
            { id: 'tomaten', label: 'Tomaten' },
            { id: 'zwiebeln', label: 'Zwiebeln' },
            { id: 'gurken', label: 'Gurken' },
            { id: 'kraut', label: 'Kraut' },
          ],
    },
    {
      id: 'spice',
      label: 'Schärfe',
      type: 'single',
      choices: [
        { id: 'mild', label: 'Mild' },
        { id: 'mittel', label: 'Mittel' },
        { id: 'scharf', label: 'Scharf' },
      ],
    },
  ];
  return groups;
}

// Menü-Einträge pro Kategorie (Preise in CHF -> *100)
export const MENU_BY_CATEGORY: Record<Category, MenuItem[]> = {
  Döner: [
    {
      id: 'doener_kebab',
      name: 'Döner Kebab',
      price_cents: 1900,
      emoji: '🥙',
      options: baseOptionGroups(),
    },
    {
      id: 'durum_kebab',
      name: 'Dürüm Kebab',
      price_cents: 2000,
      emoji: '🌯',
      options: baseOptionGroups(),
    },
    {
      id: 'doener_box',
      name: 'Döner Box',
      price_cents: 2100,
      emoji: '🍱',
      options: baseOptionGroups({ includeBread: false }),
    },
    {
      id: 'doener_teller',
      name: 'Döner Teller',
      price_cents: 2400,
      emoji: '🍽️',
      options: baseOptionGroups({ includeBread: false }),
    },
  ],
  Folded: [
    {
      id: 'folded_istanbul',
      name: 'Istanbul Folded',
      price_cents: 2300,
      emoji: '🫓',
    },
    {
      id: 'folded_guadalajara',
      name: 'Guadalajara Folded',
      price_cents: 2300,
      emoji: '🫓',
    },
  ],
  Pide: [
    {
      id: 'pide_doener',
      name: 'Pide Döner & Mozzarella',
      price_cents: 2400,
      emoji: '🫓',
    },
    {
      id: 'pide_spinat_feta',
      name: 'Pide Spinat & Feta',
      price_cents: 2200,
      emoji: '🧀',
    },
    {
      id: 'pide_champignons',
      name: 'Pide Champignons & Frischkäse',
      price_cents: 2300,
      emoji: '🍄',
    },
    {
      id: 'pide_feige_ricotta_burrata_honig',
      name: 'Pide Feige, Ricotta, Burrata & Honig',
      price_cents: 2500,
      emoji: '🍯',
    },
    {
      id: 'pide_sucuk_cheddar',
      name: 'Pide Sucuk & Cheddar',
      price_cents: 2400,
      emoji: '🧀',
    },
    {
      id: 'pide_guacamole_rucola_feta',
      name: 'Pide Guacamole, Rucola & Feta',
      price_cents: 2400,
      emoji: '🥑',
    },
  ],
  Bowls: [
    {
      id: 'bowl_beirut',
      name: 'Beirut Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
    {
      id: 'bowl_istanbul',
      name: 'Istanbul Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
    {
      id: 'bowl_guadalajara',
      name: 'Guadalajara Bowl',
      price_cents: 2000,
      emoji: '🥗',
    },
  ],
  Vegan: [
    { id: 'falafel', name: 'Falafel', price_cents: 1500, emoji: '🧆' },
    {
      id: 'karotte_baellchen',
      name: 'Karottenbällchen',
      price_cents: 1500,
      emoji: '🥕',
    },
    {
      id: 'zucchini_baellchen',
      name: 'Zucchinibällchen',
      price_cents: 1500,
      emoji: '🥒',
    },
  ],
  Fingerfood: [
    {
      id: 'chicken_nuggets',
      name: 'Chicken Nuggets',
      price_cents: 1500,
      emoji: '🍗',
    },
    { id: 'pommes', name: 'Pommes', price_cents: 800, emoji: '🍟' },
  ],
  Getränke: [
    { id: 'ayran', name: 'Ayran', price_cents: 500, emoji: '🥤' },
    { id: 'bier', name: 'Bier', price_cents: 600, emoji: '🍺' },
    {
      id: 'dose_033',
      name: 'Softdrink Dose 0.33L',
      price_cents: 400,
      emoji: '🥤',
    },
    {
      id: 'flasche_033',
      name: 'Softdrink Flasche 0.33L',
      price_cents: 600,
      emoji: '🧃',
    },
  ],
};
