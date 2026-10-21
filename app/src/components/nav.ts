import {
  Banknote, CarFront, ClipboardCheck, LayoutDashboard, MessagesSquare, Package, Tag, Truck, UserRound, Users, Warehouse, type LucideIcon,
} from "lucide-react";

// Same sections and order as the Retool sidebar.
export const NAV: { section: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
  { section: "Dashboard", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { section: "Order Management", items: [
    { to: "/enquiries", label: "Enquiries", icon: MessagesSquare },
    { to: "/orders", label: "Orders", icon: ClipboardCheck },
  ] },
  { section: "Accounting", items: [{ to: "/cash-bills", label: "Cash Bills", icon: Banknote }] },
  { section: "Logistics", items: [
    { to: "/warehouses", label: "Warehouses", icon: Warehouse },
    { to: "/transporters", label: "Transporters", icon: Truck },
    { to: "/warehouse-keepers", label: "Warehouse Keepers", icon: UserRound },
    { to: "/transporter-vehicles", label: "Transporter Vehicle Details", icon: CarFront },
  ] },
  { section: "Products", items: [{ to: "/products", label: "Products", icon: Tag }] },
  { section: "Customers", items: [
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/loading-slips", label: "Loading Slips", icon: Package },
  ] },
];
