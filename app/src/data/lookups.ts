import type { DB, LineItem } from "./types";

export const customerName = (db: DB, id: number) => db.customers.find((c) => c.customer_id === id)?.name ?? `#${id}`;
export const warehouseName = (db: DB, id: number | null) => db.warehouses.find((w) => w.warehouse_id === id)?.name ?? "—";
export const transporterName = (db: DB, id: number | null) => db.transporters.find((t) => t.transporter_id === id)?.name ?? "—";
export const vehicleNumber = (db: DB, id: number | null) => db.vehicles.find((v) => v.vehicle_id === id)?.vehicle_number ?? "—";
export const keeperName = (db: DB, id: number | null) => db.warehouseKeepers.find((k) => k.warehouse_keeper_id === id)?.name ?? "—";
export const siteOf = (db: DB, id: number) => db.sites.find((s) => s.site_id === id);
export const addressOf = (db: DB, id: number) => db.addresses.find((a) => a.address_id === id);
export const lineTotal = (items: LineItem[]) => items.reduce((a, x) => a + x.quantity * x.unit_price, 0);
export const collectedFor = (db: DB, orderId: number) =>
  db.cashCollected.filter((c) => c.order_id === orderId && c.is_active).reduce((a, c) => a + c.amount, 0);
export const slipsFor = (db: DB, orderId: number) => db.loadingSlipItems.filter((l) => l.order_id === orderId && l.is_active);
