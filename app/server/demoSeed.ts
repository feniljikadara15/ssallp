// Sample data for demo mode (no DATABASE_URL). Deterministic, so every demo
// instance starts with the same records.

type Rec = Record<string, unknown>;

export const STATES: [string, string][] = [
  ["Andaman and Nicobar Islands", "AN"], ["Andhra Pradesh", "AP"], ["Arunachal Pradesh", "AR"], ["Assam", "AS"], ["Bihar", "BR"],
  ["Chandigarh", "CH"], ["Chhattisgarh", "CG"], ["Dadra and Nagar Haveli and Daman and Diu", "DN"], ["Delhi", "DL"], ["Goa", "GA"],
  ["Gujarat", "GJ"], ["Haryana", "HR"], ["Himachal Pradesh", "HP"], ["Jammu and Kashmir", "JK"], ["Jharkhand", "JH"],
  ["Karnataka", "KA"], ["Kerala", "KL"], ["Ladakh", "LA"], ["Lakshadweep", "LD"], ["Madhya Pradesh", "MP"],
  ["Maharashtra", "MH"], ["Manipur", "MN"], ["Meghalaya", "ML"], ["Mizoram", "MZ"], ["Nagaland", "NL"],
  ["Odisha", "OD"], ["Puducherry", "PY"], ["Punjab", "PB"], ["Rajasthan", "RJ"], ["Sikkim", "SK"],
  ["Tamil Nadu", "TN"], ["Telangana", "TS"], ["Tripura", "TR"], ["Uttar Pradesh", "UP"], ["Uttarakhand", "UK"], ["West Bengal", "WB"],
];

export function demoSeedSql() {
  let s = 42;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const phone = () => `+919${int(100000000, 999999999)}`;
  const daysAgo = (d: number) => new Date(Date.now() - d * 86400000).toISOString();
  const day = (d: number) => daysAgo(d).slice(0, 10);

  const t: Record<string, Rec[]> = {};
  const add = (table: string, row: Rec) => (t[table] ??= []).push(row);

  STATES.forEach(([state_name, code], i) => add("state_codes", { state_code_id: i + 1, state_name, code, is_active: true }));
  [["5", "inter", "IGST5"], ["5", "intra", "GST5"], ["18", "inter", "IGST18"], ["18", "intra", "GST18"], ["28", "inter", "IGST28"], ["28", "intra", "GST28"]].forEach(([rate, type, name], i) =>
    add("zoho_taxes", { zoho_tax_id: i + 1, zb_tax_id: `DEMO-TAX-${i + 1}`, tax_name: name, tax_rate: rate, tax_type: type, is_active: true }));

  const PRODUCTS: [string, string, string[], string, number, string, number][] = [
    ["Cement", "UltraTech", ["OPC 53", "PPC"], "Bags", 28, "2523", 395],
    ["Cement", "Ambuja", ["PPC", "Plus Roof Special"], "Bags", 28, "2523", 405],
    ["Cement", "ACC", ["Gold", "Suraksha PPC"], "Bags", 28, "2523", 390],
    ["White Cement", "Birla White", ["White Cement"], "Bags", 28, "2523", 780],
    ["Steel", "Tata Tiscon", ["Fe 500D 8mm", "Fe 500D 12mm", "Fe 550D 16mm"], "MTS", 18, "7214", 68000],
    ["Steel", "JSW Neosteel", ["Fe 500D 10mm", "Fe 550D 20mm"], "MTS", 18, "7214", 64500],
    ["Binding Wire", "Tata Wiron", ["18 Gauge", "20 Gauge"], "MTS/Kgs", 18, "7217", 82],
    ["Tilefix", "Laticrete", ["Tilefix 20kg"], "Bags", 18, "3214", 560],
  ];
  const products: Rec[] = [];
  for (const [category, brand, grades, unit, gst, hsn, base] of PRODUCTS)
    for (const grade of grades) {
      const id = products.length + 1;
      const p = { product_id: id, product_name: `${brand} ${grade}`, category, description: `${category} - ${brand} ${grade}`, brand, grade, unit, sku: `${brand.slice(0, 3).toUpperCase()}-${String(id).padStart(3, "0")}`, hsn, gst_rate: gst, mrp: Math.round(base * (1 + rnd() * 0.08)), zb_item_id: `DEMO-ITEM-${id}`, is_active: true };
      products.push(p);
      add("products", p);
    }

  const CITIES: [string, string][] = [["Ahmedabad", "Gujarat"], ["Surat", "Gujarat"], ["Vadodara", "Gujarat"], ["Rajkot", "Gujarat"], ["Gandhinagar", "Gujarat"], ["Mumbai", "Maharashtra"], ["Udaipur", "Rajasthan"]];
  const FIRST = ["Shree", "Patel", "Om", "Jay", "Siddhi", "Krishna", "Mahavir", "Ambica", "Navkar", "Shiv", "Umiya", "Parshwa", "Vardhman", "Balaji"];
  const LAST = ["Infra", "Builders", "Constructions", "Developers", "Enterprise", "Traders", "Projects", "Buildcon", "Realty"];
  const PEOPLE = ["Ramesh Patel", "Suresh Shah", "Mahesh Desai", "Nilesh Mehta", "Jignesh Joshi", "Hitesh Parmar", "Ketan Solanki", "Bhavesh Rana", "Dinesh Chauhan", "Alpesh Thakkar"];
  const code = (st: string) => STATES.find(([n]) => n === st)![1];
  const letter = () => String.fromCharCode(65 + int(0, 25));

  const sitesByCustomer = new Map<number, Rec[]>();
  let addressId = 0, siteId = 0;
  for (let i = 1; i <= 28; i++) {
    const [city, state] = pick(CITIES);
    const biz = rnd() > 0.25;
    const name = biz ? `${pick(FIRST)} ${pick(LAST)}` : pick(PEOPLE);
    const pan = `${letter()}${letter()}${letter()}P${letter()}${int(1000, 9999)}${letter()}`;
    add("customers", {
      customer_id: i, name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`, phone: phone(),
      additional_phone_1: rnd() > 0.5 ? phone() : null, additional_phone_2: null, gstin: biz ? `24${pan}1Z${int(1, 9)}` : null, pan,
      tcs_status: rnd() > 0.7, customer_type: biz ? "business" : "individual", zb_customer_id: `DEMO-CUST-${i}`, remarks: null,
      created_at: daysAgo(int(5, 360)), is_active: rnd() > 0.1,
    });
    add("addresses", { address_id: ++addressId, customer_id: i, type: "billing", line1: `${int(1, 400)}, ${pick(["Shivam Complex", "Sardar Patel Rd", "GIDC Estate", "Ring Road"])}`, line2: pick(["Near Bus Stand", "Opp. SBI", "B/h Market Yard"]), city, state, country: "India", pincode: `${int(360, 395)}${int(100, 999)}`, maps_link: null, zb_address_id: `DEMO-ADDR-${addressId}`, state_code: code(state), is_active: true });
    const list: Rec[] = [];
    for (let k = 0; k < int(1, 3); k++) {
      add("addresses", { address_id: ++addressId, customer_id: i, type: "shipping", line1: `Survey No. ${int(10, 900)}`, line2: pick(["Near Ring Road", "Opp. Water Tank", "Main Road"]), city, state, country: "India", pincode: `${int(360, 395)}${int(100, 999)}`, maps_link: `https://maps.google.com/?q=${encodeURIComponent(city)}`, zb_address_id: `DEMO-ADDR-${addressId}`, state_code: code(state), is_active: true });
      const site = { site_id: ++siteId, customer_id: i, address_id: addressId, site_name: `${pick(["Residency", "Heights", "Arcade", "Bungalows", "Plaza"])} - ${city}`, site_person_name: pick(PEOPLE), site_person_contact: phone(), is_active: true };
      add("sites", site);
      list.push(site);
    }
    sitesByCustomer.set(i, list);
  }

  const warehouses = [["Ahmedabad - Changodar", "Changodar GIDC, Ahmedabad"], ["Ahmedabad - Naroda", "Naroda GIDC Phase 2, Ahmedabad"], ["Surat - Sachin", "Sachin GIDC, Surat"], ["Vadodara - Makarpura", "Makarpura GIDC, Vadodara"]];
  warehouses.forEach(([name, location], i) => add("warehouses", { warehouse_id: i + 1, name, location, is_active: true }));
  let keeperId = 0, wbId = 0;
  const brands = [...new Set(products.map((p) => p.brand as string))];
  warehouses.forEach((_, w) => {
    const keepers = [++keeperId, ++keeperId];
    keepers.forEach((id) => add("warehouse_keepers", { warehouse_keeper_id: id, warehouse_id: w + 1, name: pick(PEOPLE), phone: phone(), is_active: true }));
    brands.forEach((brand) => add("warehouse_brands", { warehouse_brands_id: ++wbId, warehouse_id: w + 1, warehouse_keeper_id: pick(keepers), brand, is_active: true }));
    add("warehouse_companies", { warehouse_company_id: w + 1, warehouse_id: w + 1, company_name: "Sambhavnath Agencies LLP", address_line1: warehouses[w][1], address_line2: null, city: warehouses[w][1].split(", ")[1], state: "Gujarat", pincode: "382213", country: "India", is_active: true });
  });

  const transporterNames = ["Shree Ganesh Roadlines", "Patel Transport Co.", "Om Sai Logistics", "Mahadev Carriers", "Jay Ambe Transport", "Rajdhani Freight"];
  let vehicleId = 0, twId = 0;
  const vehiclesOf = new Map<number, number[]>();
  const transportersOf = new Map<number, number[]>();
  transporterNames.forEach((name, i) => {
    const id = i + 1;
    add("transporters", { transporter_id: id, name, phone_number: phone(), additional_mobile_number: rnd() > 0.5 ? phone() : null, is_active: true });
    const vs: number[] = [];
    for (let k = 0; k < int(1, 3); k++) {
      add("vehicles", { vehicle_id: ++vehicleId, transporter_id: id, vehicle_number: `GJ${String(int(1, 27)).padStart(2, "0")}${pick(["AT", "BV", "CX", "AZ", "TT"])}${int(1000, 9999)}`, is_active: true });
      vs.push(vehicleId);
    }
    vehiclesOf.set(id, vs);
    warehouses.forEach((_, w) => {
      if (rnd() > 0.35 || id === w + 1) {
        add("transporter_warehouses", { transporter_warehouse_id: ++twId, transporter_id: id, warehouse_id: w + 1 });
        transportersOf.set(w + 1, [...(transportersOf.get(w + 1) ?? []), id]);
      }
    });
  });

  let eiId = 0, oiId = 0, orderId = 0, invoiceId = 0, lsId = 0, lsiId = 0, lsNumber = 3000, ccId = 0;
  for (let i = 1; i <= 64; i++) {
    const customerId = int(1, 28);
    const site = pick(sitesByCustomer.get(customerId)!);
    const age = i > 52 ? int(0, 12) : Math.floor(Math.pow(rnd(), 1.8) * 360);
    const cat = pick(["Cement", "Cement", "Steel", "Binding Wire", "White Cement"]);
    const pool = products.filter((p) => p.category === cat);
    const items = Array.from({ length: int(1, 3) }, () => {
      const p = pick(pool);
      const qty = p.unit === "MTS" ? int(2, 25) : p.unit === "Bags" ? int(50, 600) : int(50, 500);
      return { product_id: p.product_id as number, brand: p.brand as string, quantity: qty, unit_price: Math.round((p.mrp as number) * (0.94 + rnd() * 0.05)) };
    });
    const warehouseId = int(1, 4);
    const transporterId = pick(transportersOf.get(warehouseId)!);
    const converted = (age > 1 || i % 2 === 0) && rnd() > 0.25;
    const deleted = !converted && rnd() > 0.8;
    add("enquiries", {
      enquiry_id: i, customer_id: customerId, enquiry_date: daysAgo(age), enquiry_status: converted ? "1" : deleted ? "5" : "0", type: rnd() > 0.3 ? "Internal" : "External",
      billing_address_id: (t.addresses.find((a) => a.customer_id === customerId && a.type === "billing")!.address_id), delivery_address_id: site.address_id, site_id: site.site_id,
      transporter_id: rnd() > 0.2 || converted ? transporterId : null, warehouse_id: warehouseId, remarks: null, delivery_date: day(age - 2), created_at: daysAgo(age), is_active: true,
    });
    items.forEach((it) => add("enquiry_items", { enquiry_item_id: ++eiId, enquiry_id: i, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, is_active: true }));
    if (!converted) continue;

    const oid = ++orderId;
    const status = age > 25 ? "3" : age > 10 ? pick(["2", "3"]) : pick(["1", "1", "2"]);
    const cash = rnd() > 0.65;
    const total = items.reduce((a, x) => a + x.quantity * x.unit_price, 0);
    const dispatched = status !== "1";
    const lsHeader = dispatched || rnd() > 0.5 ? ++lsId : null;
    let invId: number | null = null;
    if (dispatched && !cash) {
      invId = ++invoiceId;
      add("invoices", { invoice_id: invId, order_id: oid, zb_invoice_id: `DEMO-INV-${invId}`, zb_invoice_number: `INV-${String(2200 + invId).padStart(6, "0")}`, zb_invoice_url: null, is_active: true });
    }
    add("orders", {
      order_id: oid, order_number: `SO-${String(1000 + oid).padStart(5, "0")}`, enquiry_id: i, customer_id: customerId, order_date: daysAgo(Math.max(age - 1, 0)), order_status: rnd() > 0.95 && status === "1" ? "5" : status,
      payment_type: dispatched ? (cash ? "cash" : "credit") : null, total_amount: dispatched ? total : null, billing_address_id: t.enquiries[i - 1].billing_address_id, shipping_address_id: site.address_id, site_id: site.site_id,
      otp: dispatched ? String(int(100000, 999999)) : null, invoice_id: invId, transporter_id: transporterId, warehouse_id: warehouseId, po_number: rnd() > 0.5 ? `PO-${int(100, 999)}` : null,
      vehicle_id: dispatched || rnd() > 0.5 ? pick(vehiclesOf.get(transporterId)!) : null, sub_dealer: null, loading_slip_id: lsHeader, delivery_terms: dispatched || rnd() > 0.5 ? pick(["Delivery", "Ex warehouse"]) : null,
      created_at: daysAgo(Math.max(age - 1, 0)), is_active: true,
    });
    items.forEach((it) => add("order_items", { order_item_id: ++oiId, order_id: oid, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, remarks: "No remarks", is_active: true }));
    if (lsHeader) {
      add("loading_slips", { loading_slip_id: lsHeader, order_id: oid, warehouse_id: warehouseId, transporter_id: transporterId, loading_slip_date: day(Math.max(age - 1, 0)), is_active: true });
      [...new Set(items.map((x) => x.brand))].forEach((brand) => {
        const n = ++lsNumber;
        add("loading_slip_items", { loading_slip_item_id: ++lsiId, loading_slip_id: lsHeader, loading_slip_number: n, loading_slip_file_name: `LS-${n}`, brand, url: null, status: dispatched ? "Sent" : "Created", is_active: true });
      });
    }
    if (cash && status === "3" && rnd() > 0.3) {
      const full = rnd() > 0.4;
      add("cash_collected", { cash_collected_id: ++ccId, order_id: oid, collection_date: day(Math.max(age - 3, 0)), amount: full ? total : Math.round(total * 0.5), payment_mode: "Cash", receipt_number: `RC-${int(10000, 99999)}`, is_active: true });
    }
  }

  const lit = (v: unknown) => (v === null || v === undefined ? "NULL" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  const order = ["state_codes", "zoho_taxes", "customers", "addresses", "sites", "products", "warehouses", "warehouse_keepers", "warehouse_brands", "warehouse_companies", "transporters", "vehicles", "transporter_warehouses", "enquiries", "enquiry_items", "invoices", "orders", "order_items", "loading_slips", "loading_slip_items", "cash_collected"];
  const pk: Record<string, string> = { state_codes: "state_code_id", zoho_taxes: "zoho_tax_id", customers: "customer_id", addresses: "address_id", sites: "site_id", products: "product_id", warehouses: "warehouse_id", warehouse_keepers: "warehouse_keeper_id", warehouse_brands: "warehouse_brands_id", warehouse_companies: "warehouse_company_id", transporters: "transporter_id", vehicles: "vehicle_id", transporter_warehouses: "transporter_warehouse_id", enquiries: "enquiry_id", enquiry_items: "enquiry_item_id", invoices: "invoice_id", orders: "order_id", order_items: "order_item_id", loading_slips: "loading_slip_id", loading_slip_items: "loading_slip_item_id", cash_collected: "cash_collected_id" };
  const out: string[] = [];
  for (const table of order) {
    const rows = t[table] ?? [];
    if (!rows.length) continue;
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    out.push(`INSERT INTO ${table} (${cols.join(", ")}) VALUES\n${rows.map((r) => `(${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n")};`);
    out.push(`SELECT setval(pg_get_serial_sequence('${table}', '${pk[table]}'), (SELECT MAX(${pk[table]}) FROM ${table}));`);
  }
  out.push(`SELECT setval('order_number_seq', 1000 + (SELECT MAX(order_id) FROM orders));`);
  out.push(`SELECT setval('loading_slip_number_seq', ${lsNumber});`);
  return out.join("\n");
}
