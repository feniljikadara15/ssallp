-- Schema of the Retool DB used by the Order Management System, reconstructed
-- from the columns the Retool queries read and write. Production keeps using
-- the existing Retool DB; this file creates the same shape for local
-- development and the demo database.

CREATE TABLE IF NOT EXISTS state_codes (
  state_code_id SERIAL PRIMARY KEY,
  state_name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS zoho_taxes (
  zoho_tax_id SERIAL PRIMARY KEY,
  zb_tax_id TEXT,
  tax_name TEXT,
  tax_rate TEXT,
  tax_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  additional_phone_1 TEXT,
  additional_phone_2 TEXT,
  gstin TEXT,
  pan TEXT,
  tcs_status BOOLEAN DEFAULT FALSE,
  customer_type TEXT,
  zb_customer_id TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS addresses (
  address_id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(customer_id),
  type TEXT,
  line1 TEXT,
  line2 TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  pincode TEXT,
  maps_link TEXT,
  zb_address_id TEXT,
  state_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS sites (
  site_id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(customer_id),
  address_id INTEGER REFERENCES addresses(address_id),
  site_name TEXT,
  site_person_name TEXT,
  site_person_contact TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  product_name TEXT,
  category TEXT,
  description TEXT,
  brand TEXT,
  grade TEXT,
  unit TEXT,
  sku TEXT,
  hsn TEXT,
  gst_rate NUMERIC,
  mrp NUMERIC,
  zb_item_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS warehouses (
  warehouse_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS warehouse_keepers (
  warehouse_keeper_id SERIAL PRIMARY KEY,
  warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS warehouse_brands (
  warehouse_brands_id SERIAL PRIMARY KEY,
  warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  warehouse_keeper_id INTEGER REFERENCES warehouse_keepers(warehouse_keeper_id),
  brand TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS warehouse_companies (
  warehouse_company_id SERIAL PRIMARY KEY,
  warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS transporters (
  transporter_id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT,
  additional_mobile_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id SERIAL PRIMARY KEY,
  transporter_id INTEGER REFERENCES transporters(transporter_id),
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT,
  capacity TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS transporter_warehouses (
  transporter_warehouse_id SERIAL PRIMARY KEY,
  transporter_id INTEGER REFERENCES transporters(transporter_id),
  warehouse_id INTEGER REFERENCES warehouses(warehouse_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- enquiry_status: '0' ongoing, '1' converted to order (past), '5' deleted
CREATE TABLE IF NOT EXISTS enquiries (
  enquiry_id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(customer_id),
  enquiry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enquiry_status TEXT NOT NULL DEFAULT '0',
  type TEXT,
  billing_address_id INTEGER,
  delivery_address_id INTEGER,
  site_id INTEGER,
  transporter_id INTEGER,
  warehouse_id INTEGER,
  remarks TEXT,
  delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS enquiry_items (
  enquiry_item_id SERIAL PRIMARY KEY,
  enquiry_id INTEGER REFERENCES enquiries(enquiry_id),
  product_id INTEGER REFERENCES products(product_id),
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id SERIAL PRIMARY KEY,
  order_id INTEGER,
  zb_invoice_id TEXT,
  zb_invoice_number TEXT,
  zb_invoice_url TEXT,
  pdf_invoice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- order_status: '1' ongoing, '2' in transit (invoiced / cash bill), '3' delivered, '5' deleted
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1001;
CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  order_number TEXT DEFAULT ('SO-' || LPAD(nextval('order_number_seq')::text, 5, '0')),
  enquiry_id INTEGER REFERENCES enquiries(enquiry_id),
  customer_id INTEGER REFERENCES customers(customer_id),
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  order_status TEXT NOT NULL DEFAULT '1',
  payment_type TEXT,
  total_amount NUMERIC,
  billing_address_id INTEGER,
  shipping_address_id INTEGER,
  site_id INTEGER,
  otp TEXT,
  invoice_id INTEGER,
  transporter_id INTEGER,
  warehouse_id INTEGER,
  po_number TEXT,
  vehicle_id INTEGER,
  sub_dealer TEXT,
  loading_slip_id INTEGER,
  delivery_terms TEXT,
  delivery_charges NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(order_id),
  product_id INTEGER REFERENCES products(product_id),
  quantity NUMERIC,
  unit_price NUMERIC,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS loading_slips (
  loading_slip_id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(order_id),
  warehouse_id INTEGER,
  transporter_id INTEGER,
  loading_slip_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE SEQUENCE IF NOT EXISTS loading_slip_number_seq START 3001;
CREATE TABLE IF NOT EXISTS loading_slip_items (
  loading_slip_item_id SERIAL PRIMARY KEY,
  loading_slip_id INTEGER REFERENCES loading_slips(loading_slip_id),
  loading_slip_number INTEGER DEFAULT nextval('loading_slip_number_seq'),
  loading_slip_file_name TEXT,
  brand TEXT,
  url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS cash_collected (
  cash_collected_id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(order_id),
  collection_date DATE,
  amount NUMERIC,
  payment_mode TEXT,
  receipt_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
