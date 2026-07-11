"use client";

import { X } from "lucide-react";
import { CrmRecord } from "@/lib/schema";
import StatusBadge from "./StatusBadge";

const FIELD_LABELS: [keyof CrmRecord, string][] = [
  ["name", "Name"],
  ["email", "Email"],
  ["country_code", "Country Code"],
  ["mobile_without_country_code", "Mobile"],
  ["company", "Company"],
  ["city", "City"],
  ["state", "State"],
  ["country", "Country"],
  ["lead_owner", "Lead Owner"],
  ["crm_note", "CRM Note"],
  ["data_source", "Data Source"],
  ["possession_time", "Possession Time"],
  ["description", "Description"],
  ["created_at", "Created At"],
];

export default function LeadDetailModal({
  lead,
  onClose,
}: {
  lead: CrmRecord;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Lead Details</h2>
            <div className="mt-1.5">
              <StatusBadge status={lead.crm_status} />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close lead details"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-6 py-5 sm:grid-cols-2">
          {FIELD_LABELS.map(([key, label]) => (
            <div key={key}>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {label}
              </dt>
              <dd className="mt-0.5 break-words text-sm text-slate-800">
                {lead[key] || <span className="text-slate-300">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
