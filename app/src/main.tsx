import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import "./index.css";
import { queryClient, useGet, type Session } from "./api";
import Layout from "./components/Layout";
import { Button, Loading } from "./components/ui";
import Login from "./pages/Login";

// Pages load on first visit, so the first screen doesn't wait for all of them.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Enquiries = lazy(() => import("./pages/Enquiries"));
const Orders = lazy(() => import("./pages/Orders"));
const CashBills = lazy(() => import("./pages/CashBills"));
const Warehouses = lazy(() => import("./pages/Warehouses"));
const Transporters = lazy(() => import("./pages/Transporters"));
const WarehouseKeepers = lazy(() => import("./pages/WarehouseKeepers"));
const TransporterVehicles = lazy(() => import("./pages/TransporterVehicles"));
const Products = lazy(() => import("./pages/Products"));
const Customers = lazy(() => import("./pages/Customers"));
const LoadingSlips = lazy(() => import("./pages/LoadingSlips"));

// Keeps a crash in one page from blanking the whole app.
class PageBoundary extends React.Component<{ children: React.ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-xl2 border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <p className="font-medium">This page hit an error and couldn't be shown.</p>
        <p className="mt-1 text-xs">{this.state.error.message}</p>
        <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>Reload</Button>
      </div>
    );
  }
}

function Page({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return (
    <PageBoundary resetKey={pathname}>
      <Suspense fallback={<Loading />}>{children}</Suspense>
    </PageBoundary>
  );
}

function App() {
  const session = useGet<Session>("session");
  if (session.isLoading) return <Loading text="Starting…" />;
  if (session.error) return <div className="p-8 text-sm text-red-700">Can't reach the server: {(session.error as Error).message}</div>;
  if (session.data?.authRequired && !session.data.user) return <Login />;
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout session={session.data!} />}>
          <Route index element={<Page><Dashboard /></Page>} />
          <Route path="enquiries" element={<Page><Enquiries /></Page>} />
          <Route path="orders" element={<Page><Orders /></Page>} />
          <Route path="cash-bills" element={<Page><CashBills /></Page>} />
          <Route path="warehouses" element={<Page><Warehouses /></Page>} />
          <Route path="transporters" element={<Page><Transporters /></Page>} />
          <Route path="warehouse-keepers" element={<Page><WarehouseKeepers /></Page>} />
          <Route path="transporter-vehicles" element={<Page><TransporterVehicles /></Page>} />
          <Route path="products" element={<Page><Products /></Page>} />
          <Route path="customers" element={<Page><Customers /></Page>} />
          <Route path="loading-slips" element={<Page><LoadingSlips /></Page>} />
          <Route path="*" element={<div className="p-6 text-sm text-gray-500">Page not found.</div>} />
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
