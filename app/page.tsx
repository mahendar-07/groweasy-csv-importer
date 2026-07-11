"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Search, RefreshCw, ChevronRight, Download, Menu } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import ImportModal from "@/components/ImportModal";
import StatusBadge from "@/components/StatusBadge";
import LeadDetailModal from "@/components/LeadDetailModal";
import { CRM_FIELDS, CrmRecord, ImportResponse } from "@/lib/schema";

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<CrmRecord | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredLeads = useMemo(() => {
    if (!result) return [];
    const query = search.trim().toLowerCase();
    if (!query) return result.imported;
    return result.imported.filter(
      (lead) =>
        lead.email.toLowerCase().includes(query) ||
        lead.mobile_without_country_code.includes(query) ||
        lead.name.toLowerCase().includes(query)
    );
  }, [result, search]);

  function exportCsv() {
    if (!result) return;
    const csv = Papa.unparse(result.imported, { columns: CRM_FIELDS as string[] });
    // Prepend a UTF-8 BOM so Excel renders non-ASCII names/notes correctly.
    const csvWithBom = "\uFEFF" + csv;
    const blob = new Blob([csvWithBom], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "groweasy_crm_leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex min-h-screen bg-[#F7F8FA]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 px-6 py-6 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Manage Your Leads</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Monitor lead status, assign tasks, and close deals faster.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={exportCsv}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" /> Export CRM CSV
              </button>
            )}
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600"
            >
              Import Leads via CSV
            </button>
          </div>
        </div>

        {result && (
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Rows" value={result.total_imported + result.total_skipped} />
            <StatCard label="Imported" value={result.total_imported} accent="text-emerald-600" />
            <StatCard label="Skipped" value={result.total_skipped} accent="text-red-500" />
            <StatCard
              label="Success Rate"
              value={`${
                result.total_imported + result.total_skipped === 0
                  ? 0
                  : Math.round(
                      (result.total_imported /
                        (result.total_imported + result.total_skipped)) *
                        100
                    )
              }%`}
            />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-800">Your Leads</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, email, or phone..."
                  className="w-48 text-sm text-slate-600 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!result ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <p className="text-sm text-slate-500">No leads yet.</p>
              <p className="text-xs text-slate-400">
                Click &quot;Import Leads via CSV&quot; to bulk-import your first batch.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full min-w-max border-collapse text-left text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    {[
                      "Lead Name",
                      "Email",
                      "Contact",
                      "Date Created",
                      "Company",
                      "Status",
                      "Source",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="whitespace-nowrap border-b border-slate-100 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                        No leads match &quot;{search}&quot;.
                      </td>
                    </tr>
                  )}
                  {filteredLeads.map((lead, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-800">
                        {lead.name || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {lead.email || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {lead.country_code || lead.mobile_without_country_code
                          ? `${lead.country_code} ${lead.mobile_without_country_code}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {lead.created_at || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                        {lead.company || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={lead.crm_status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                        {lead.data_source || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button
                          onClick={() => setSelectedLead(lead)}
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          More <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {result && result.skipped.length > 0 && (
          <div className="mt-6 rounded-xl border border-red-100 bg-red-50/40 p-5">
            <h3 className="mb-2 text-sm font-semibold text-red-700">
              Skipped rows ({result.skipped.length})
            </h3>
            <p className="mb-3 text-xs text-red-500">
              These rows had no usable email or phone number and were not imported.
            </p>
            <div className="max-h-48 overflow-auto rounded-lg bg-white">
              <ul className="divide-y divide-slate-100 text-xs text-slate-600">
                {result.skipped.map((s, i) => (
                  <li key={i} className="px-3 py-2">
                    {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </main>

      {modalOpen && (
        <ImportModal
          onClose={() => setModalOpen(false)}
          onImported={(r) => {
            setResult(r);
            setModalOpen(false);
          }}
        />
      )}

      {selectedLead && (
        <LeadDetailModal lead={selectedLead} onClose={() => setSelectedLead(null)} />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className={`text-xl font-semibold ${accent ?? "text-slate-900"}`}>{value}</p>
      <p className="mt-0.5 text-xs text-slate-400">{label}</p>
    </div>
  );
}
