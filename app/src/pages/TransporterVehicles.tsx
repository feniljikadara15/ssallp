import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CarFront } from "lucide-react";
import { useGet } from "../api";
import { Card, DataTable, ErrorBox, Loading, PageHeader, SearchInput } from "../components/ui";

// query12: every vehicle with its transporter, searchable by either.
export default function TransporterVehicles() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data, error, isLoading } = useGet<any[]>(`vehicle-details?search=${encodeURIComponent(search)}`);

  return (
    <div>
      <PageHeader title="Transporter Vehicle Details" description="Every transporter vehicle. Add or remove them on the Transporters page." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.05] p-3">
          <div className="w-full sm:w-80"><SearchInput value={q} onChange={setQ} placeholder="Search vehicle number or transporter" /></div>
          {data && <span className="ml-auto text-2xs text-gray-500">{data.length} vehicle{data.length === 1 ? "" : "s"}</span>}
        </div>
        {error && <div className="p-3"><ErrorBox error={error} /></div>}
        {isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <DataTable rows={data ?? []} rowKey={(r: any) => r.vehicle_id} pageSize={20} empty="No vehicles match" columns={[
            { key: "vehicle_number", label: "Vehicle", render: (r: any) => <span className="inline-flex items-center gap-2 font-medium"><CarFront className="h-3.5 w-3.5 text-gray-400" />{r.vehicle_number}</span> },
            { key: "transporter_name", label: "Transporter", render: (r: any) => <Link to="/transporters" className="hover:text-primary">{r.transporter_name}</Link> },
            { key: "transporter_phone", label: "Phone", className: "tabular" },
          ]} />
        )}
      </Card>
    </div>
  );
}
