export type OrderStatus = 'in_queue' | 'preparing' | 'ready' | 'picked_up';


export type OptionGroup = {
id: string;
label: string;
type: 'single' | 'multi';
required?: boolean;
choices: { id: string; label: string }[];
};


export type MenuItem = {
id: string;
name: string;
price_cents: number;
emoji?: string;
options?: OptionGroup[];
};


export type OrderLine = {
id: string;
item?: MenuItem | null;
qty: number;
specs?: Record<string, string[]>; // groupId -> choiceIds
note?: string;
};


export type Order = {
id: string;
lines: OrderLine[];
total_cents: number;
status: OrderStatus;
created_at?: string;
updated_at?: string;
};