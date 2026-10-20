import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import "./index.css";
import { StoreProvider } from "./data/store";
import Layout from "./components/Layout";
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
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
    </StoreProvider>
  </React.StrictMode>,
);
