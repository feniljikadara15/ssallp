// Customers, products, warehouses, transporters and warehouse keepers.
import { isDemo, zohoConfigured } from "../config.js";
import { insertRow, one, q, updateRow } from "../db.js";
import { HttpError, num, optNum, str } from "../http.js";
import { zoho } from "../integrations.js";
import { route } from "../router.js";
import { importZohoCustomer, syncZohoProducts, zohoTaxId } from "../workflows.js";

const ok = (message: string, extra: object = {}) => ({ message, ...extra });
const stateCode = async (state: string | null) =>
  state ? (await one("SELECT code FROM state_codes WHERE LOWER(state_name) = LOWER($1)", [state]))?.code ?? null : null;

// ------------------------------------------------------------ reference data

route("GET", "/api/state-codes", async () => q("SELECT * FROM state_codes WHERE is_active = TRUE ORDER BY state_name"));

// getAllCustomers (the page lists inactive customers too) with billing address
route("GET", "/api/customers", async () =>
  q(`SELECT c.*, b.address_id AS billing_address_id, b.line1 AS billing_line1, b.line2 AS billing_line2, b.city AS billing_city,
            b.state AS billing_state, b.pincode AS billing_pincode,
            (SELECT COUNT(*)::int FROM sites s WHERE s.customer_id = c.customer_id AND s.is_active = TRUE) AS site_count,
            (SELECT COUNT(*)::int FROM orders o WHERE o.customer_id = c.customer_id AND o.is_active = TRUE AND o.order_status <> '5') AS order_count,
            (SELECT COALESCE(SUM(o.total_amount), 0)::float FROM orders o WHERE o.customer_id = c.customer_id AND o.is_active = TRUE AND o.order_status IN ('2', '3')) AS billed_value,
            (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.customer_id AND o.is_active = TRUE AND o.order_status <> '5') AS last_order
       FROM customers c
       LEFT JOIN LATERAL (SELECT * FROM addresses a WHERE a.customer_id = c.customer_id AND a.type = 'billing' AND a.is_active = TRUE ORDER BY a.address_id LIMIT 1) b ON TRUE
      ORDER BY c.name`));

// updateCustomer + updateAddressBilling
route("PATCH", "/api/customers/:id", async ({ params, body }) => {
  const id = num(params.id);
  await updateRow("customers", "customer_id", id, {
    name: str(body.name), email: str(body.email), phone: str(body.phone), additional_phone_1: str(body.additional_phone_1), additional_phone_2: str(body.additional_phone_2),
    gstin: str(body.gstin), pan: str(body.pan), customer_type: str(body.customer_type), remarks: str(body.remarks), tcs_status: !!body.tcs_status, is_active: !!body.is_active, updated_at: new Date(),
  });
  if (body.billing) {
    const b = body.billing;
    const fields = { line1: str(b.line1), line2: str(b.line2), city: str(b.city), state: str(b.state), pincode: str(b.pincode), state_code: await stateCode(str(b.state)), updated_at: new Date() };
    const existing = await one("SELECT address_id FROM addresses WHERE customer_id = $1 AND type = 'billing' ORDER BY address_id LIMIT 1", [id]);
    if (existing) await updateRow("addresses", "address_id", existing.address_id, fields);
    else await insertRow("addresses", { customer_id: id, type: "billing", country: "India", ...fields, created_at: new Date(), is_active: true });
  }
  return ok("Customer updated");
});

// importSingleZBCustomer
route("POST", "/api/customers/import", async ({ body }) => {
  const zbId = str(body.zb_customer_id);
  if (!zbId) throw new HttpError(400, "Enter a Zoho Books customer ID");
  if (!zohoConfigured()) throw new HttpError(503, isDemo() ? "Demo mode: importing needs Zoho Books" : "Zoho Books is not configured");
  const res = await importZohoCustomer(zbId);
  return ok(`Customer ${res.name} imported`, res);
});

// getCustomersSItes
route("GET", "/api/customers/:id/sites", async ({ params }) =>
  q(`SELECT s.site_id, s.address_id, s.is_active, s.site_name, s.site_person_contact, s.site_person_name, a.city, a.maps_link, a.state, a.pincode, a.line1, a.line2
       FROM sites s LEFT JOIN addresses a ON s.address_id = a.address_id
      WHERE s.customer_id = $1 AND s.is_active = TRUE ORDER BY s.site_id`, [num(params.id)]));

// AddCustomerAdress + AddCustomerSiteDetails
route("POST", "/api/customers/:id/sites", async ({ params, body }) => {
  const id = num(params.id);
  if (!str(body.site_name)) throw new HttpError(400, "Site name is required");
  const addr = await insertRow("addresses", {
    state: str(body.state), city: str(body.city), pincode: str(body.pincode), line1: str(body.line1), line2: str(body.line2), maps_link: str(body.maps_link),
    state_code: await stateCode(str(body.state)), country: "India", type: "shipping", customer_id: id, created_at: new Date(), updated_at: new Date(), is_active: true,
  });
  await insertRow("sites", { site_name: str(body.site_name), site_person_name: str(body.site_person_name), site_person_contact: str(body.site_person_contact), customer_id: id, address_id: addr.address_id, created_at: new Date(), updated_at: new Date(), is_active: true });
  return ok("Site added");
});

// updateSite + siteUpdateAddress
route("PATCH", "/api/sites/:id", async ({ params, body }) => {
  const id = num(params.id);
  await updateRow("sites", "site_id", id, { site_name: str(body.site_name), site_person_contact: str(body.site_person_contact), site_person_name: str(body.site_person_name), updated_at: new Date() });
  const site = await one("SELECT address_id FROM sites WHERE site_id = $1", [id]);
  if (site?.address_id)
    await updateRow("addresses", "address_id", site.address_id, { state: str(body.state), pincode: str(body.pincode), city: str(body.city), line1: str(body.line1), line2: str(body.line2), maps_link: str(body.maps_link), state_code: await stateCode(str(body.state)), updated_at: new Date() });
  return ok("Site updated");
});

// deleteSiteAddress
route("DELETE", "/api/sites/:id", async ({ params }) => {
  await q("UPDATE sites SET is_active = FALSE WHERE site_id = $1", [num(params.id)]);
  return ok("Site deleted");
});

// ------------------------------------------------------------ products

route("GET", "/api/products", async ({ query }) =>
  q(`SELECT * FROM products ${query.get("all") ? "" : "WHERE is_active = TRUE"} ORDER BY product_id ASC`));

async function zohoItemBody(b: any) {
  const taxes = await Promise.all((["inter", "intra"] as const).map(async (t) => ({ tax_specification: t, tax_id: await zohoTaxId(b.gst_rate, t) })));
  return {
    name: str(b.product_name), sku: str(b.sku) ?? undefined, brand: str(b.brand) ?? undefined, description: str(b.description) ?? undefined,
    rate: Number(b.mrp) || 0, hsn_or_sac: str(b.hsn) ?? undefined, unit: str(b.unit) ?? undefined, status: b.is_active === false ? "inactive" : "active",
    item_tax_preferences: taxes.filter((t) => t.tax_id),
  };
}

const productFields = (b: any) => ({
  product_name: str(b.product_name), category: str(b.category), description: str(b.description), brand: str(b.brand), grade: str(b.grade), unit: str(b.unit),
  sku: str(b.sku), hsn: str(b.hsn), gst_rate: optNum(b.gst_rate), mrp: optNum(b.mrp),
});

// addProductZB + addProduct
route("POST", "/api/products", async ({ body }) => {
  if (!str(body.product_name)) throw new HttpError(400, "Product name is required");
  let zbItemId: string | null = null;
  if (zohoConfigured()) zbItemId = (await zoho("POST", "items", await zohoItemBody(body))).item.item_id;
  else if (!isDemo()) throw new HttpError(503, "Zoho Books is not configured, so the product can't be created there");
  const row = await insertRow("products", { ...productFields(body), zb_item_id: zbItemId, is_active: true, created_at: new Date(), updated_at: new Date() });
  return ok(zbItemId ? "Product added in Zoho Books" : "Product added", { product_id: row.product_id });
});

// updateProduct + updateProductZB
route("PATCH", "/api/products/:id", async ({ params, body }) => {
  const id = num(params.id);
  await updateRow("products", "product_id", id, { ...productFields(body), is_active: body.is_active !== false, updated_at: new Date() });
  const p = await one("SELECT zb_item_id FROM products WHERE product_id = $1", [id]);
  if (p?.zb_item_id && zohoConfigured()) await zoho("PUT", `items/${p.zb_item_id}`, await zohoItemBody(body));
  return ok(p?.zb_item_id && zohoConfigured() ? "Product updated in Zoho Books" : "Product updated");
});

// deleteProductZB + deleteProduct
route("DELETE", "/api/products/:id", async ({ params }) => {
  const id = num(params.id);
  const p = await one("SELECT zb_item_id FROM products WHERE product_id = $1", [id]);
  if (p?.zb_item_id && zohoConfigured()) await zoho("DELETE", `items/${p.zb_item_id}`);
  const used = await one("SELECT 1 FROM order_items WHERE product_id = $1 UNION SELECT 1 FROM enquiry_items WHERE product_id = $1 LIMIT 1", [id]);
  // Products on past orders are kept (inactive) so those orders still show them.
  if (used) await q("UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE product_id = $1", [id]);
  else await q("DELETE FROM products WHERE product_id = $1", [id]);
  return ok("Product deleted");
});

// upsertProductsZB
route("POST", "/api/products/sync-zoho", async () => {
  if (!zohoConfigured()) throw new HttpError(503, isDemo() ? "Demo mode: syncing needs Zoho Books" : "Zoho Books is not configured");
  return syncZohoProducts();
});

// ------------------------------------------------------------ warehouses

route("GET", "/api/warehouses", async () => q(`SELECT w.*,
    (SELECT COUNT(*)::int FROM warehouse_brands wb WHERE wb.warehouse_id = w.warehouse_id AND wb.is_active IS NOT FALSE) AS brand_count,
    (SELECT COUNT(*)::int FROM warehouse_brands wb WHERE wb.warehouse_id = w.warehouse_id AND wb.is_active IS NOT FALSE AND wb.warehouse_keeper_id IS NULL) AS brands_without_keeper,
    (SELECT COUNT(*)::int FROM warehouse_keepers wk WHERE wk.warehouse_id = w.warehouse_id AND wk.is_active = TRUE) AS keeper_count,
    (SELECT COUNT(*)::int FROM transporter_warehouses tw JOIN transporters t ON t.transporter_id = tw.transporter_id AND t.is_active = TRUE WHERE tw.warehouse_id = w.warehouse_id) AS transporter_count,
    (SELECT COUNT(*)::int FROM orders o WHERE o.warehouse_id = w.warehouse_id AND o.is_active = TRUE AND o.order_status = '1') AS open_orders
  FROM warehouses w WHERE w.is_active = TRUE ORDER BY w.warehouse_id ASC`));

route("POST", "/api/warehouses", async ({ body }) => {
  if (!str(body.name)) throw new HttpError(400, "Warehouse name is required");
  const row = await one("INSERT INTO warehouses (name, location, created_at, updated_at, is_active) VALUES ($1, $2, NOW(), NOW(), TRUE) RETURNING warehouse_id", [str(body.name), str(body.location)]);
  return ok("Warehouse added", row!);
});

// updateWarehouseName
route("PATCH", "/api/warehouses/:id", async ({ params, body }) => {
  await q("UPDATE warehouses SET name = $1, location = $2, updated_at = NOW() WHERE warehouse_id = $3", [str(body.name), str(body.location), num(params.id)]);
  return ok("Warehouse updated");
});

// deleteAllBrandsWarehouse + deleteAllWarehouseKeepers + deleteWarehouse
route("DELETE", "/api/warehouses/:id", async ({ params }) => {
  const id = num(params.id);
  await q("DELETE FROM warehouse_brands WHERE warehouse_id = $1", [id]);
  await q("UPDATE warehouse_keepers SET is_active = FALSE WHERE warehouse_id = $1", [id]);
  await q("UPDATE warehouses SET is_active = FALSE WHERE warehouse_id = $1", [id]);
  return ok("Warehouse deleted");
});

// getWarehouseBrands
route("GET", "/api/warehouses/:id/brands", async ({ params }) =>
  q(`SELECT wb.*, wk.name AS warehouse_keeper_name, wk.phone AS warehouse_keeper_phone FROM warehouse_brands wb
       LEFT JOIN warehouse_keepers wk ON wk.warehouse_keeper_id = wb.warehouse_keeper_id WHERE wb.warehouse_id = $1 ORDER BY wb.warehouse_brands_id`, [num(params.id)]));

// addWarehouseBrand
route("POST", "/api/warehouses/:id/brands", async ({ params, body }) => {
  if (!str(body.brand)) throw new HttpError(400, "Pick a brand");
  await q("INSERT INTO warehouse_brands (warehouse_id, warehouse_keeper_id, brand, created_at, updated_at, is_active) VALUES ($1, $2, $3, NOW(), NOW(), TRUE)", [num(params.id), optNum(body.warehouse_keeper_id), str(body.brand)]);
  return ok("Brand added");
});

// updateWarehouseBrand
route("PATCH", "/api/warehouse-brands/:id", async ({ params, body }) => {
  await q("UPDATE warehouse_brands SET warehouse_keeper_id = $1, brand = $2, updated_at = NOW() WHERE warehouse_brands_id = $3", [optNum(body.warehouse_keeper_id), str(body.brand), num(params.id)]);
  return ok("Brand updated");
});

// deleteWarehouseBrand
route("DELETE", "/api/warehouse-brands/:id", async ({ params }) => {
  await q("DELETE FROM warehouse_brands WHERE warehouse_brands_id = $1", [num(params.id)]);
  return ok("Brand removed");
});

// getWarehouseTransporters (one row per transporter, vehicles listed together)
route("GET", "/api/warehouses/:id/transporters", async ({ params }) =>
  q(`SELECT tw.transporter_warehouse_id, t.transporter_id, t.name AS transporter_name, t.phone_number, t.additional_mobile_number,
            (SELECT STRING_AGG(v.vehicle_number, ', ') FROM vehicles v WHERE v.transporter_id = t.transporter_id) AS vehicle_number
       FROM transporter_warehouses tw JOIN transporters t ON tw.transporter_id = t.transporter_id
      WHERE tw.warehouse_id = $1 AND t.is_active = TRUE ORDER BY t.name`, [num(params.id)]));

// getTransportersWarehouseEnquiry / getTransportersWarehouseOrder
route("GET", "/api/warehouses/:id/transporter-options", async ({ params }) =>
  q(`SELECT DISTINCT tw.transporter_id, t.name AS transporter_name, t.phone_number AS transporter_phone FROM transporter_warehouses tw
       JOIN transporters t ON tw.transporter_id = t.transporter_id WHERE tw.warehouse_id = $1 AND t.is_active = TRUE ORDER BY tw.transporter_id ASC`, [num(params.id)]));

// getWarehouseCompanies / saveCompany / updateCompanies / deleteCompanies
route("GET", "/api/warehouses/:id/companies", async ({ params }) =>
  q("SELECT * FROM warehouse_companies WHERE warehouse_id = $1 AND is_active = TRUE ORDER BY warehouse_company_id", [num(params.id)]));

const companyFields = (b: any) => ({ company_name: str(b.company_name), address_line1: str(b.address_line1), address_line2: str(b.address_line2), city: str(b.city), state: str(b.state), pincode: str(b.pincode), country: str(b.country) });

route("POST", "/api/warehouses/:id/companies", async ({ params, body }) => {
  if (!str(body.company_name)) throw new HttpError(400, "Company name is required");
  await insertRow("warehouse_companies", { warehouse_id: num(params.id), ...companyFields(body), is_active: true, created_at: new Date() });
  return ok("Company added");
});

route("PATCH", "/api/warehouse-companies/:id", async ({ params, body }) => {
  await updateRow("warehouse_companies", "warehouse_company_id", num(params.id), { ...companyFields(body), updated_at: new Date() });
  return ok("Company updated");
});

route("DELETE", "/api/warehouse-companies/:id", async ({ params }) => {
  await q("UPDATE warehouse_companies SET is_active = FALSE, updated_at = NOW() WHERE warehouse_company_id = $1", [num(params.id)]);
  return ok("Company deleted");
});

// ------------------------------------------------------------ warehouse keepers

route("GET", "/api/warehouse-keepers", async () =>
  q(`SELECT wk.*, w.name AS warehouse_name,
            (SELECT STRING_AGG(wb.brand, ', ' ORDER BY wb.brand) FROM warehouse_brands wb WHERE wb.warehouse_keeper_id = wk.warehouse_keeper_id AND wb.is_active IS NOT FALSE) AS brands
       FROM warehouse_keepers wk LEFT JOIN warehouses w ON w.warehouse_id = wk.warehouse_id WHERE wk.is_active = TRUE ORDER BY wk.warehouse_keeper_id`));

route("POST", "/api/warehouse-keepers", async ({ body }) => {
  if (!str(body.name) || !str(body.phone)) throw new HttpError(400, "Name and phone are required");
  await q("INSERT INTO warehouse_keepers (warehouse_id, name, phone, created_at, updated_at, is_active) VALUES ($1, $2, $3, NOW(), NOW(), TRUE)", [optNum(body.warehouse_id), str(body.name), str(body.phone)]);
  return ok("Warehouse keeper added");
});

route("PATCH", "/api/warehouse-keepers/:id", async ({ params, body }) => {
  await q("UPDATE warehouse_keepers SET name = $1, phone = $2, warehouse_id = $3, updated_at = NOW() WHERE warehouse_keeper_id = $4", [str(body.name), str(body.phone), optNum(body.warehouse_id), num(params.id)]);
  return ok("Warehouse keeper updated");
});

route("DELETE", "/api/warehouse-keepers/:id", async ({ params }) => {
  await q("UPDATE warehouse_keepers SET is_active = FALSE WHERE warehouse_keeper_id = $1", [num(params.id)]);
  return ok("Warehouse keeper deleted");
});

// ------------------------------------------------------------ transporters

route("GET", "/api/transporters", async () => q(`SELECT t.*,
    (SELECT COUNT(*)::int FROM vehicles v WHERE v.transporter_id = t.transporter_id AND v.is_active IS NOT FALSE) AS vehicle_count,
    (SELECT STRING_AGG(w.name, ', ' ORDER BY w.name) FROM transporter_warehouses tw JOIN warehouses w ON w.warehouse_id = tw.warehouse_id WHERE tw.transporter_id = t.transporter_id) AS warehouse_names,
    (SELECT ARRAY_AGG(tw.warehouse_id) FROM transporter_warehouses tw WHERE tw.transporter_id = t.transporter_id) AS warehouse_ids,
    (SELECT COUNT(*)::int FROM orders o WHERE o.transporter_id = t.transporter_id AND o.is_active = TRUE AND o.order_status IN ('1', '2')) AS active_orders
  FROM transporters t WHERE t.is_active = TRUE ORDER BY t.transporter_id ASC`));

// addNewTransporter
route("POST", "/api/transporters", async ({ body }) => {
  if (!str(body.name)) throw new HttpError(400, "Transporter name is required");
  const row = await one(
    "INSERT INTO transporters (name, phone_number, additional_mobile_number, created_at, updated_at, is_active) VALUES ($1, $2, $3, NOW(), NOW(), TRUE) RETURNING transporter_id",
    [str(body.name), str(body.phone_number), str(body.additional_mobile_number)],
  );
  return ok("Transporter added", row!);
});

// updateTransporterDetails
route("PATCH", "/api/transporters/:id", async ({ params, body }) => {
  await q("UPDATE transporters SET name = $1, phone_number = $2, additional_mobile_number = $3 WHERE transporter_id = $4", [str(body.name), str(body.phone_number), str(body.additional_mobile_number), num(params.id)]);
  return ok("Transporter updated");
});

// deleteAllVehiclesForTransporter + deleteAllWarehousesTransporter + deleteTransporter
route("DELETE", "/api/transporters/:id", async ({ params }) => {
  const id = num(params.id);
  const used = await one("SELECT 1 FROM orders WHERE vehicle_id IN (SELECT vehicle_id FROM vehicles WHERE transporter_id = $1) LIMIT 1", [id]);
  // Vehicles referenced by orders stay so those orders keep their vehicle number.
  if (used) await q("UPDATE vehicles SET is_active = FALSE WHERE transporter_id = $1", [id]);
  else await q("DELETE FROM vehicles WHERE transporter_id = $1", [id]);
  await q("DELETE FROM transporter_warehouses WHERE transporter_id = $1", [id]);
  await q("UPDATE transporters SET is_active = FALSE WHERE transporter_id = $1", [id]);
  return ok("Transporter deleted");
});

// getTransporterVehicles / getVehicleNumber
route("GET", "/api/transporters/:id/vehicles", async ({ params }) =>
  q("SELECT * FROM vehicles WHERE transporter_id = $1 AND is_active IS NOT FALSE ORDER BY vehicle_id", [num(params.id)]));

// addTransporterVehicle / addVehicleNumberToTransporter2 (with checkVNforTransporter)
route("POST", "/api/transporters/:id/vehicles", async ({ params, body }) => {
  const id = num(params.id);
  const number = String(body.vehicle_number ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
  if (!number) throw new HttpError(400, "Enter a vehicle number");
  const dup = await one("SELECT 1 FROM vehicles WHERE transporter_id = $1 AND UPPER(REPLACE(REPLACE(vehicle_number, ' ', ''), '-', '')) = $2 AND is_active IS NOT FALSE", [id, number]);
  if (dup) throw new HttpError(400, `Vehicle ${number} is already added for this transporter`);
  const row = await one("INSERT INTO vehicles (vehicle_number, transporter_id, created_at, updated_at, is_active) VALUES ($1, $2, NOW(), NOW(), TRUE) RETURNING vehicle_id, vehicle_number", [number, id]);
  return ok(`Vehicle ${number} added`, row!);
});

// deleteTransporterVehicle
route("DELETE", "/api/vehicles/:id", async ({ params }) => {
  const id = num(params.id);
  const used = await one("SELECT 1 FROM orders WHERE vehicle_id = $1 LIMIT 1", [id]);
  if (used) await q("UPDATE vehicles SET is_active = FALSE WHERE vehicle_id = $1", [id]);
  else await q("DELETE FROM vehicles WHERE vehicle_id = $1", [id]);
  return ok("Vehicle removed");
});

// getTransporterWarehouses
route("GET", "/api/transporters/:id/warehouses", async ({ params }) =>
  q(`SELECT tw.transporter_warehouse_id, w.warehouse_id, w.name AS warehouse_name, w.location AS warehouse_location FROM transporter_warehouses tw
       JOIN warehouses w ON tw.warehouse_id = w.warehouse_id WHERE tw.transporter_id = $1 ORDER BY w.name`, [num(params.id)]));

// addTransporterWarehouse
route("POST", "/api/transporters/:id/warehouses", async ({ params, body }) => {
  const id = num(params.id), wh = num(body.warehouse_id, "Warehouse");
  if (await one("SELECT 1 FROM transporter_warehouses WHERE transporter_id = $1 AND warehouse_id = $2", [id, wh])) throw new HttpError(400, "Already linked to this warehouse");
  await q("INSERT INTO transporter_warehouses (transporter_id, warehouse_id, created_at, updated_at) VALUES ($1, $2, NOW(), NOW())", [id, wh]);
  return ok("Warehouse linked");
});

// deleteTransporterWarehouse
route("DELETE", "/api/transporter-warehouses/:id", async ({ params }) => {
  await q("DELETE FROM transporter_warehouses WHERE transporter_warehouse_id = $1", [num(params.id)]);
  return ok("Warehouse unlinked");
});

// query12 (Transporter Vehicle Details page)
route("GET", "/api/vehicle-details", async ({ query }) => {
  const s = query.get("search") ?? "";
  return q(
    `SELECT v.vehicle_id, v.vehicle_number, v.vehicle_type, v.capacity, v.is_active AS vehicle_active, t.transporter_id, t.name AS transporter_name,
            t.phone_number AS transporter_phone, t.additional_mobile_number
       FROM vehicles v JOIN transporters t ON v.transporter_id = t.transporter_id
      WHERE $1 = '' OR v.vehicle_number ILIKE '%' || $1 || '%' OR t.name ILIKE '%' || $1 || '%'
      ORDER BY t.name, v.vehicle_number`,
    [s],
  );
});
