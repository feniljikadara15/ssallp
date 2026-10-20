export type PaymentType = "cash" | "credit";
export type EnquiryStatus = "ongoing" | "converted" | "closed";
export type OrderStatus = "ongoing" | "in_transit" | "delivered";

export interface Customer {
  customer_id: number;
  name: string;
  email: string;
  phone: string;
  additional_phone_1: string;
  additional_phone_2: string;
  gstin: string;
  pan: string;
  tcs_status: boolean;
  customer_type: "Business" | "Individual";
  zb_customer_id: string;
  remarks: string;
  is_active: boolean;
  created_at: string;
}

export interface Address {
  address_id: number;
  customer_id: number;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Site {
  site_id: number;
  customer_id: number;
  site_name: string;
  site_person_name: string;
  site_person_contact: string;
  maps_link: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Product {
  product_id: number;
  product_name: string;
  category: string;
  brand: string;
  grade: string;
  unit: string;
  sku: string;
  hsn: string;
  gst_rate: number;
  mrp: number;
  zb_item_id: string;
  is_active: boolean;
}

export interface LineItem {
  item_id: number;
  product_id: number;
  category: string;
  brand: string;
  grade: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

export interface Enquiry {
  enquiry_id: number;
  customer_id: number;
  enquiry_date: string;
  enquiry_status: EnquiryStatus;
  type: PaymentType;
  billing_address_id: number;
  site_id: number;
  remarks: string;
  warehouse_id: number | null;
  transporter_id: number | null;
  delivery_date: string;
  is_active: boolean;
  items: LineItem[];
}

export interface Order {
  order_id: number;
  order_number: string;
  enquiry_id: number;
  order_date: string;
  payment_type: PaymentType;
  order_status: OrderStatus;
  total_amount: number;
  billing_address_id: number;
  site_id: number;
  otp: string;
  invoice_id: string | null;
  transporter_id: number | null;
  vehicle_id: number | null;
  customer_id: number;
  warehouse_id: number | null;
  po_number: string;
  sub_dealer: string;
  delivery_terms: string;
  is_active: boolean;
  items: LineItem[];
}

export interface LoadingSlipItem {
  loading_slip_item_id: number;
  loading_slip_id: number;
  order_id: number;
  loading_slip_number: string;
  loading_slip_file_name: string;
  brand: string;
  warehouse_id: number;
  transporter_id: number | null;
  status: "Sent" | "Cancelled";
  is_active: boolean;
}

export interface CashCollected {
  cash_collected_id: number;
  order_id: number;
  collection_date: string;
  receipt_number: string;
  amount: number;
  is_active: boolean;
}

export interface Warehouse {
  warehouse_id: number;
  name: string;
  address: string;
  city: string;
  is_active: boolean;
}

export interface WarehouseBrand {
  warehouse_brands_id: number;
  warehouse_id: number;
  brand: string;
  warehouse_keeper_id: number | null;
}

export interface WarehouseKeeper {
  warehouse_keeper_id: number;
  name: string;
  phone: string;
  warehouse_id: number;
  is_active: boolean;
}

export interface Transporter {
  transporter_id: number;
  name: string;
  phone_number: string;
  additional_mobile_number: string;
  is_active: boolean;
}

export interface Vehicle {
  vehicle_id: number;
  transporter_id: number;
  vehicle_number: string;
}

export interface TransporterWarehouse {
  transporter_warehouse_id: number;
  transporter_id: number;
  warehouse_id: number;
}

export interface DB {
  customers: Customer[];
  addresses: Address[];
  sites: Site[];
  products: Product[];
  enquiries: Enquiry[];
  orders: Order[];
  loadingSlipItems: LoadingSlipItem[];
  cashCollected: CashCollected[];
  warehouses: Warehouse[];
  warehouseBrands: WarehouseBrand[];
  warehouseKeepers: WarehouseKeeper[];
  transporters: Transporter[];
  vehicles: Vehicle[];
  transporterWarehouses: TransporterWarehouse[];
}
