import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { ErrorBox, FilterBar, PageHeader, Select, StatStrip } from "../components/ui";

// Every transporter vehicle in one list. Vehicles are added and removed on
// the transporter's own page.
export default function TransporterVehicles() {
  const { data, error, isLoading } = useGet<any[]>("vehicle-details?search=");
  const [f, set, clear] = useUrlState({ transporter: "" });
  const all = data ?? [];
  const transporters = useMemo(() => [...new Map(all.map((v) => [v.transporter_id, v.transporter_name])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]))), [all]);
  const rows = all.filter((v) => !f.transporter || String(v.transporter_id) === f.transporter);

  return (
    <div className="page">
      <PageHeader title="Transporter vehicles" subtitle="Every vehicle and its transporter. Add or remove vehicles on the transporter's page." />
      <FilterBar active={!!f.transporter} onClear={() => clear(["transporter"])}>
        <Select className="w-full sm:w-60" value={f.transporter} onChange={(e) => set({ transporter: e.target.value })} placeholder="All transporters"
          options={transporters.map(([value, label]) => ({ value: String(value), label }))} />
      </FilterBar>
      {error && <ErrorBox error={error} />}
      <StatStrip items={[
        { label: "Vehicles", value: num(rows.length) },
        { label: "Transporters", value: num(new Set(rows.map((v) => v.transporter_id)).size) },
      ]} />
      <DataTable title="Vehicles" filename={`Transporter vehicles ${stamp()}`} rowKey="vehicle_id" rows={rows} loading={isLoading}
        filtersActive={!!f.transporter} onClearFilters={() => clear(["transporter"])}
        rowLink={(r) => `/transporters/${r.transporter_id}`}
        empty={{ title: "No vehicles yet", hint: "Add them on a transporter's page." }}
        rowActions={(r) => [{ kind: "open", label: `Open ${r.transporter_name}`, icon: <ExternalLink />, href: `/transporters/${r.transporter_id}` }]}
        cols={[
          { key: "vehicle_number", label: "Vehicle number", kind: "mono" },
          { key: "transporter_name", label: "Transporter" },
          { key: "transporter_phone", label: "Phone", kind: "mono", sub: (r) => r.additional_mobile_number },
          { key: "vehicle_type", label: "Type" },
          { key: "capacity", label: "Capacity" },
        ]} />
    </div>
  );
}
