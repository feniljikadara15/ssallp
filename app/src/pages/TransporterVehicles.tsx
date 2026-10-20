import { useEffect, useState } from "react";
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
      <PageHeader title="Transporter Vehicle Details" />
      <Card>
        <div className="border-b p-3"><div className="w-full sm:w-80"><SearchInput value={q} onChange={setQ} placeholder="Search with transporter or vehicle number" /></div></div>
        {error && <div className="p-3"><ErrorBox error={error} /></div>}
        {isLoading ? <Loading /> : (
          <DataTable rows={data ?? []} rowKey={(r: any) => r.vehicle_id} pageSize={20} columns={[
            { key: "sno", label: "S.NO", render: (_: any, i: number) => i + 1 },
            { key: "transporter_id", label: "Transporter ID" },
            { key: "vehicle_number", label: "Vehicle number", render: (r: any) => <b>{r.vehicle_number}</b> },
            { key: "transporter_name", label: "Transporter name" },
            { key: "transporter_phone", label: "Transporter phone" },
          ]} />
        )}
      </Card>
    </div>
  );
}
