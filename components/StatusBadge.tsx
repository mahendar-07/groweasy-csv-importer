import { CrmStatus } from "@/lib/schema";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  SALE_DONE: { label: "Sale Done", className: "bg-blue-100 text-blue-700" },
  GOOD_LEAD_FOLLOW_UP: { label: "Good Lead", className: "bg-emerald-100 text-emerald-700" },
  DID_NOT_CONNECT: { label: "Not Dialed", className: "bg-slate-100 text-slate-600" },
  BAD_LEAD: { label: "Bad Lead", className: "bg-red-100 text-red-700" },
  "": { label: "Unassigned", className: "bg-slate-100 text-slate-500" },
};

export default function StatusBadge({ status }: { status: CrmStatus | "" }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES[""];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.className}`}
    >
      {s.label}
    </span>
  );
}
