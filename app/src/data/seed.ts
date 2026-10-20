import type { DB, LineItem, Order, Enquiry, Product, OrderStatus } from "./types";

// Deterministic PRNG so the sample data is stable between reloads.
let s = 42;
const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const STATES = ["Gujarat", "Maharashtra", "Rajasthan", "Madhya Pradesh"];
const CITIES: Record<string, string[]> = {
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Gandhinagar"],
  Maharashtra: ["Mumbai", "Pune", "Nashik"],
  Rajasthan: ["Udaipur", "Jaipur"],
  "Madhya Pradesh": ["Indore", "Bhopal"],
};
const FIRST = ["Shree", "Patel", "Om", "Jay", "Siddhi", "Krishna", "Mahavir", "Ambica", "Navkar", "Shiv", "Ganesh", "Umiya", "Parshwa", "Vardhman", "Balaji"];
const LAST = ["Infra", "Builders", "Constructions", "Developers", "Enterprise", "Traders", "Projects", "Buildcon", "Realty", "Associates"];
const PEOPLE = ["Ramesh Patel", "Suresh Shah", "Mahesh Desai", "Nilesh Mehta", "Jignesh Joshi", "Hitesh Parmar", "Ketan Solanki", "Bhavesh Rana", "Dinesh Chauhan", "Alpesh Thakkar"];

const phone = () => `9${int(100000000, 999999999)}`;
const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();

const PRODUCT_DEFS: [string, string, string[], string, number, string, number][] = [
  // category, brand, grades, unit, gst, hsn, base price
  ["Steel", "Tata Tiscon", ["Fe 500D 8mm", "Fe 500D 10mm", "Fe 500D 12mm", "Fe 550D 16mm"], "MT", 18, "7214", 68000],
  ["Steel", "JSW Neosteel", ["Fe 500D 8mm", "Fe 500D 12mm", "Fe 550D 20mm"], "MT", 18, "7214", 64500],
  ["Steel", "Kamdhenu", ["Fe 500 10mm", "Fe 500 12mm"], "MT", 18, "7214", 59000],
  ["Cement", "UltraTech", ["OPC 53", "PPC"], "Bag", 28, "2523", 395],
  ["Cement", "Ambuja", ["PPC", "Plus Roof Special"], "Bag", 28, "2523", 405],
  ["Cement", "ACC", ["Gold", "Suraksha PPC"], "Bag", 28, "2523", 390],
  ["Binding Wire", "Tata Wiron", ["18 Gauge", "20 Gauge"], "Kg", 18, "7217", 82],
];

export function createSeed(): DB {
  s = 42;
  const products: Product[] = [];
  let pid = 1;
  for (const [category, brand, grades, unit, gst, hsn, base] of PRODUCT_DEFS) {
    for (const grade of grades) {
      products.push({
        product_id: pid,
        product_name: `${brand} ${grade}`,
        category, brand, grade, unit,
        sku: `${brand.slice(0, 3).toUpperCase()}-${String(pid).padStart(3, "0")}`,
        hsn, gst_rate: gst,
        mrp: Math.round(base * (1 + rnd() * 0.08)),
        zb_item_id: `ZBI${1800000 + pid * 37}`,
        is_active: true,
      });
      pid++;
    }
  }

  const customers: DB["customers"] = [];
  const addresses: DB["addresses"] = [];
  const sites: DB["sites"] = [];
  for (let i = 1; i <= 28; i++) {
    const state = pick(STATES);
    const city = pick(CITIES[state]);
    const biz = rnd() > 0.25;
    const name = biz ? `${pick(FIRST)} ${pick(LAST)}` : pick(PEOPLE);
    const pan = `${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}${String.fromCharCode(65 + int(0, 25))}P${String.fromCharCode(65 + int(0, 25))}${int(1000, 9999)}${String.fromCharCode(65 + int(0, 25))}`;
    customers.push({
      customer_id: i,
      name,
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com`,
      phone: phone(),
      additional_phone_1: rnd() > 0.5 ? phone() : "",
      additional_phone_2: "",
      gstin: biz ? `24${pan}1Z${int(1, 9)}` : "",
      pan,
      tcs_status: rnd() > 0.7,
      customer_type: biz ? "Business" : "Individual",
      zb_customer_id: `ZBC${2400000 + i * 113}`,
      remarks: "",
      is_active: rnd() > 0.1,
      created_at: daysAgo(int(5, 360)),
    });
    addresses.push({ address_id: i, customer_id: i, line1: `${int(1, 400)}, ${pick(["Shivam Complex", "Sardar Patel Rd", "GIDC Estate", "Ring Road", "Station Road"])}`, line2: pick(["Near Bus Stand", "Opp. SBI", "", "B/h Market Yard"]), city, state, pincode: `${int(360, 395)}${int(100, 999)}` });
    const nSites = int(1, 3);
    for (let k = 0; k < nSites; k++) {
      sites.push({
        site_id: sites.length + 1,
        customer_id: i,
        site_name: `${pick(["Residency", "Heights", "Arcade", "Bungalows", "Plaza", "Warehouse Shed"])} - ${city}`,
        site_person_name: pick(PEOPLE),
        site_person_contact: phone(),
        maps_link: "https://maps.google.com/?q=" + encodeURIComponent(city),
        line1: `Survey No. ${int(10, 900)}`,
        city, state, pincode: `${int(360, 395)}${int(100, 999)}`,
      });
    }
  }

  const warehouses: DB["warehouses"] = [
    { warehouse_id: 1, name: "Ahmedabad - Changodar", address: "Plot 14, Changodar GIDC", city: "Ahmedabad", is_active: true },
    { warehouse_id: 2, name: "Ahmedabad - Naroda", address: "Shed 7, Naroda GIDC Phase 2", city: "Ahmedabad", is_active: true },
    { warehouse_id: 3, name: "Surat - Sachin", address: "Sachin GIDC Road No. 6", city: "Surat", is_active: true },
    { warehouse_id: 4, name: "Vadodara - Makarpura", address: "Makarpura GIDC", city: "Vadodara", is_active: true },
  ];
  const warehouseKeepers: DB["warehouseKeepers"] = [];
  warehouses.forEach((w) => {
    for (let k = 0; k < 2; k++) warehouseKeepers.push({ warehouse_keeper_id: warehouseKeepers.length + 1, name: pick(PEOPLE), phone: phone(), warehouse_id: w.warehouse_id, is_active: true });
  });
  const brands = [...new Set(products.map((p) => p.brand))];
  const warehouseBrands: DB["warehouseBrands"] = [];
  warehouses.forEach((w) => {
    const keepers = warehouseKeepers.filter((k) => k.warehouse_id === w.warehouse_id);
    brands.filter(() => rnd() > 0.35).forEach((b) => warehouseBrands.push({ warehouse_brands_id: warehouseBrands.length + 1, warehouse_id: w.warehouse_id, brand: b, warehouse_keeper_id: pick(keepers).warehouse_keeper_id }));
  });

  const transporters: DB["transporters"] = ["Shree Ganesh Roadlines", "Patel Transport Co.", "Om Sai Logistics", "Mahadev Carriers", "Jay Ambe Transport", "Rajdhani Freight"].map((name, i) => ({
    transporter_id: i + 1, name, phone_number: phone(), additional_mobile_number: rnd() > 0.5 ? phone() : "", is_active: true,
  }));
  const vehicles: DB["vehicles"] = [];
  const transporterWarehouses: DB["transporterWarehouses"] = [];
  transporters.forEach((t) => {
    for (let k = 0; k < int(1, 4); k++) vehicles.push({ vehicle_id: vehicles.length + 1, transporter_id: t.transporter_id, vehicle_number: `GJ${String(int(1, 27)).padStart(2, "0")}${pick(["AT", "BV", "CX", "AZ", "TT"])}${int(1000, 9999)}` });
    warehouses.filter(() => rnd() > 0.4).forEach((w) => transporterWarehouses.push({ transporter_warehouse_id: transporterWarehouses.length + 1, transporter_id: t.transporter_id, warehouse_id: w.warehouse_id }));
  });

  const mkItems = (startId: number): LineItem[] => {
    const n = int(1, 3);
    const items: LineItem[] = [];
    const cat = pick(["Steel", "Steel", "Cement", "Binding Wire"]);
    const pool = products.filter((p) => p.category === cat);
    for (let k = 0; k < n; k++) {
      const p = pick(pool);
      const qty = p.unit === "MT" ? int(2, 25) : p.unit === "Bag" ? int(50, 600) : int(50, 500);
      items.push({ item_id: startId + k, product_id: p.product_id, category: p.category, brand: p.brand, grade: p.grade, quantity: qty, unit: p.unit, unit_price: Math.round(p.mrp * (0.94 + rnd() * 0.05)) });
    }
    return items;
  };

  const enquiries: Enquiry[] = [];
  const orders: Order[] = [];
  const loadingSlipItems: DB["loadingSlipItems"] = [];
  const cashCollected: DB["cashCollected"] = [];
  let itemId = 1;
  for (let i = 1; i <= 64; i++) {
    const c = pick(customers);
    const cs = sites.filter((x) => x.customer_id === c.customer_id);
    const age = i > 52 ? int(0, 12) : Math.floor(Math.pow(rnd(), 1.8) * 360);
    const items = mkItems(itemId);
    itemId += items.length;
    const converted = (age > 1 || i % 2 === 0) && rnd() > 0.25;
    const deleted = !converted && rnd() > 0.85;
    const type = rnd() > 0.65 ? "cash" : "credit";
    const wh = pick(warehouses).warehouse_id;
    const tr = pick(transporters).transporter_id;
    enquiries.push({
      enquiry_id: 1000 + i,
      customer_id: c.customer_id,
      enquiry_date: daysAgo(age),
      enquiry_status: converted ? "converted" : age > 30 ? "closed" : "ongoing",
      type, billing_address_id: c.customer_id, site_id: pick(cs).site_id,
      remarks: "", warehouse_id: wh, transporter_id: tr,
      delivery_date: daysAgo(age - 2),
      is_active: !deleted,
      items,
    });
    if (converted) {
      const oid = 5000 + orders.length + 1;
      const total = items.reduce((a, x) => a + x.quantity * x.unit_price, 0);
      const status: OrderStatus = age > 25 ? "delivered" : age > 10 ? pick(["in_transit", "delivered"]) : pick(["ongoing", "ongoing", "in_transit"]);
      const fy = new Date(daysAgo(age)).getFullYear() % 100;
      orders.push({
        order_id: oid,
        order_number: `SO/${fy}-${fy + 1}/${String(orders.length + 101).padStart(4, "0")}`,
        enquiry_id: 1000 + i,
        order_date: daysAgo(Math.max(age - 1, 0)),
        payment_type: type,
        order_status: status,
        total_amount: total,
        billing_address_id: c.customer_id,
        site_id: enquiries[enquiries.length - 1].site_id,
        otp: String(int(1000, 9999)),
        invoice_id: status !== "ongoing" ? `INV-${String(orders.length + 2201)}` : null,
        transporter_id: tr,
        vehicle_id: pick(vehicles.filter((v) => v.transporter_id === tr))?.vehicle_id ?? null,
        customer_id: c.customer_id,
        warehouse_id: wh,
        po_number: rnd() > 0.5 ? `PO-${int(100, 999)}` : "",
        sub_dealer: "",
        delivery_terms: pick(["Ex-Warehouse", "Delivered at Site", "Freight Extra"]),
        is_active: rnd() > 0.05,
        items: items.map((x) => ({ ...x })),
      });
      const lsId = loadingSlipItems.length + 1;
      [...new Set(items.map((x) => x.brand))].forEach((brand) => {
        const n = 3000 + loadingSlipItems.length + 1;
        loadingSlipItems.push({ loading_slip_item_id: loadingSlipItems.length + 1, loading_slip_id: lsId, order_id: oid, loading_slip_number: `LS${n}`, loading_slip_file_name: `LS-${n}-${brand.split(" ")[0].toUpperCase()}`, brand, warehouse_id: wh, transporter_id: tr, status: "Sent", is_active: true });
      });
      if (type === "cash" && status === "delivered") {
        const full = rnd() > 0.4;
        const amt = full ? total : Math.round(total * (0.3 + rnd() * 0.4));
        cashCollected.push({ cash_collected_id: cashCollected.length + 1, order_id: oid, collection_date: daysAgo(age - 3), receipt_number: `RC-${int(10000, 99999)}`, amount: amt, is_active: true });
      }
    }
  }

  return { customers, addresses, sites, products, enquiries, orders, loadingSlipItems, cashCollected, warehouses, warehouseBrands, warehouseKeepers, transporters, vehicles, transporterWarehouses };
}
