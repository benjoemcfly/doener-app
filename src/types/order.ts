// src/types/order.ts

// Status einer Bestellung
export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';

// Menü-Optionen (z.B. Brot, Soßen, Salat ...)
export type OptionGroup = {
  id: string;
  label: string;
  type: 'single' | 'multi';
  required?: boolean;
  choices: { id: string; label: string }[];
};

// Einzelnes Menü-Item (Gericht, Getränk, etc.)
export type MenuItem = {
  id: string;
  name: string;
  price_cents: number; // Preise in Rappen/"cents"
  emoji?: string;
  options?: OptionGroup[];
};

// Eine Zeile im Warenkorb / in der Bestellung
export type OrderLine = {
  id: string;
  item?: MenuItem | null;
  qty: number;
  specs?: Record<string, string[]>; // groupId -> choiceIds
  note?: string;
};

// Bestellung wie sie vom Backend kommt
export type Order = {
  id: string;
  lines: OrderLine[];
  total_cents: number;
  status: OrderStatus;
  created_at?: string;
  updated_at?: string;
};
