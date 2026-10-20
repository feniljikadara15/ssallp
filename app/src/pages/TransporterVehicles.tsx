import { useState } from "react";
import { useStore } from "../data/store";
import { Card, DataTable, PageHeader, SearchInput } from "../components/ui";

export default function TransporterVehicles() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const rows = db.vehicles
    .map((v) => {
      const t = db.transporters.find((x) => x.transporter_id === v.transporter_id);
      return { ...v, transporter_name: t?.name ?? "", transporter_phone: t?.phone_number ?? "" };
    })
    .filter((r) => !q || `${r.vehicle_number} ${r.transporter_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Transporter Vehicle Details" />
      <Card>
        <div className="border-b p-3"><div className="w-80"><SearchInput value={q} onChange={setQ} placeholder="Search with transporter or vehicle number" /></div></div>
        <DataTable rows={rows} rowKey={(r) => r.vehicle_id} pageSize={20} columns={[
          { key: "sno", label: "S.NO", render: (_, i) => i + 1 },
          { key: "transporter_id", label: "Transporter ID" },
          { key: "vehicle_number", label: "Vehicle number", render: (r) => <b>{r.vehicle_number}</b> },
          { key: "transporter_name", label: "Transporter name" },
          { key: "transporter_phone", label: "Transporter phone" },
        ]} />
      </Card>
    </div>
  );
}
