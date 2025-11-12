import type { MenuItem, OrderLine } from '@/types/order';


export function formatPrice(cents: number, currency: string = 'EUR') {
return (cents / 100).toLocaleString('de-CH', {
style: 'currency',
currency,
minimumFractionDigits: 2,
});
}


export function sumCart(lines: OrderLine[]) {
return lines.reduce((acc, l) => acc + (l.item?.price_cents ?? 0) * l.qty, 0);
}


export function labelForGroup(groupId: string, item?: MenuItem | null) {
const g = item?.options?.find((z) => z.id === groupId);
return g?.label ?? groupId;
}


export function labelForChoice(groupId: string, choiceId: string, item?: MenuItem | null) {
const g = item?.options?.find((x) => x.id === groupId);
const c = g?.choices.find((y) => y.id === choiceId);
return c?.label ?? choiceId;
}


export function initDefaultSpecs(item: MenuItem): Record<string, string[]> {
const res: Record<string, string[]> = {};
(item.options || []).forEach((g) => {
if (g.type === 'single' && g.required && g.choices.length > 0) {
res[g.id] = [g.choices[0].id];
} else {
res[g.id] = [];
}
});
return res;
}