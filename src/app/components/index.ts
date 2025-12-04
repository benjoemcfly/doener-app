// src/app/components/index.tsx

// Zentrale Re-Exports der UI-Helfer & Komponenten

export {
  formatPrice,
  sumCart,
  LS_KEY,
  ARCHIVE_LS_KEY,
  PENDING_CART_KEY,
  todayStr,
} from './helpers';
export type { PendingCartBackup } from './helpers';

export { StatusBadge } from './StatusBadge';
export { Dialog, CustomizeCard } from './CustomizeDialog';
export { GreenFlash } from './GreenFlash';
export { MenuView } from './MenuView';
export { CheckoutView } from './CheckoutView';
export { StatusView } from './StatusView';
export { MiniCart } from './MiniCart'; // falls du eine MiniCart.tsx-Komponente hast
