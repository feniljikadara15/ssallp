import {
  Banknote, CarFront, ClipboardCheck, LayoutDashboard, MessagesSquare, Package, Tag, Truck, UserRound, Users, Warehouse, type LucideIcon,
} from "lucide-react";

export const NAV: { section: string; items: { to: string; label: string; icon: LucideIcon }[] }[] = [
  { section: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { section: "Sales", items: [
    { to: "/enquiries", label: "Enquiries", icon: MessagesSquare },
    { to: "/orders", label: "Orders", icon: ClipboardCheck },
    { to: "/loading-slips", label: "Loading Slips", icon: Package },
    { to: "/cash-bills", label: "Cash Bills", icon: Banknote },
  ] },
  { section: "Master data", items: [
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/products", label: "Products", icon: Tag },
    { to: "/warehouses", label: "Warehouses", icon: Warehouse },
    { to: "/warehouse-keepers", label: "Warehouse Keepers", icon: UserRound },
    { to: "/transporters", label: "Transporters", icon: Truck },
    { to: "/transporter-vehicles", label: "Vehicles", icon: CarFront },
  ] },
];
