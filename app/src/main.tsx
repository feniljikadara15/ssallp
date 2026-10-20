import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { queryClient, useGet, type Session } from "./api";
import Layout from "./components/Layout";
import { Loading } from "./components/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Enquiries from "./pages/Enquiries";
import Orders from "./pages/Orders";
import CashBills from "./pages/CashBills";
import Warehouses from "./pages/Warehouses";
import Transporters from "./pages/Transporters";
import WarehouseKeepers from "./pages/WarehouseKeepers";
import TransporterVehicles from "./pages/TransporterVehicles";
import Products from "./pages/Products";
import Customers from "./pages/Customers";
import LoadingSlips from "./pages/LoadingSlips";

function App() {
  const session = useGet<Session>("session");
  if (session.isLoading) return <Loading text="Starting…" />;
  if (session.error) return <div className="p-8 text-sm text-red-700">Can't reach the server: {(session.error as Error).message}</div>;
  if (session.data?.authRequired && !session.data.user) return <Login />;
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout session={session.data!} />}>
          <Route index element={<Dashboard />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="orders" element={<Orders />} />
          <Route path="cash-bills" element={<CashBills />} />
          <Route path="warehouses" element={<Warehouses />} />
          <Route path="transporters" element={<Transporters />} />
          <Route path="warehouse-keepers" element={<WarehouseKeepers />} />
          <Route path="transporter-vehicles" element={<TransporterVehicles />} />
          <Route path="products" element={<Products />} />
          <Route path="customers" element={<Customers />} />
          <Route path="loading-slips" element={<LoadingSlips />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
