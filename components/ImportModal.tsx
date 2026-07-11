"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Papa from "papaparse";
import { X, UploadCloud, FileText, Download, Loader2 } from "lucide-react";
import DataTable from "./DataTable";
import { ImportResponse } from "@/lib/schema";

const REQUIRED_HEADERS = [
  "created_at",
  "name",
  "email",
  "country_code",
  "mobile_without_country_code",
  "company",
  "city",
  "state",
  "country",
  "lead_owner",
  "crm_status",
  "crm_note",
];

const MAX_FILE_MB = 5;
const MAX_ROWS = 5000;
const PREVIEW_ROW_LIMIT = 100;

interface ImportModalProps {
  onClose: () => void;
  onImported: (result: ImportResponse) => void;
}

type Step = "select" | "preview" | "processing";

export default function ImportModal({ onClose, onImported }: ImportModalProps) {
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus management: remember the trigger, focus the dialog on open,
  // trap Tab within it, close on Escape, and restore focus on unmount.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement;
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  function loadFile(f: File) {
    setError(null);
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setError("Only .csv files are supported.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File exceeds the ${MAX_FILE_MB}MB limit.`);
      return;
    }
    setFile(f);
    Papa.parse<Record<string, unknown>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (res.errors.length > 0) {
          setError(`Unable to parse CSV: ${res.errors[0].message}`);
          setFile(null);
          return;
        }
        if (!res.meta.fields || res.meta.fields.length === 0) {
          setError("The CSV does not contain a valid header row.");
          setFile(null);
          return;
        }
        const dataRows = res.data.filter((r) => Object.keys(r).length > 0);
        if (dataRows.length === 0) {
          setError("The CSV contains no data rows.");
          setFile(null);
          return;
        }
        if (dataRows.length > MAX_ROWS) {
          setError(`This file has ${dataRows.length} rows — the limit is ${MAX_ROWS}.`);
          setFile(null);
          return;
        }
        setColumns(res.meta.fields);
        setRows(dataRows);
        setStep("preview");
      },
      error: (err) => setError(err.message),
    });
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
  }, []);

  function downloadTemplate() {
    const header = REQUIRED_HEADERS.join(",");
    const sample =
      "2026-05-13 14:20:48,John Doe,john.doe@example.com,+91,9876543210,GrowEasy,Mumbai,Maharashtra,India,test@gmail.com,GOOD_LEAD_FOLLOW_UP,Client asked to reschedule demo";
    const csv = `${header}\n${sample}\n`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "groweasy_sample_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload() {
    if (!file) return;
    setStep("processing");
    setError(null);
    setProgress(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import", { method: "POST", body: formData });

      // Pre-processing validation errors (bad file, missing API key, etc.)
      // are still returned as a plain JSON error, not a stream.
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("ndjson")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Import failed.");
      }

      if (!res.body) throw new Error("No response body received from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalResult: ImportResponse | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last entry may be an incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "progress"; completed: number; total: number }
            | { type: "done"; result: ImportResponse }
            | { type: "error"; message: string };

          if (event.type === "progress") {
            setProgress({ completed: event.completed, total: event.total });
          } else if (event.type === "done") {
            finalResult = event.result;
          } else if (event.type === "error") {
            throw new Error(event.message || "Import failed.");
          }
        }
      }

      if (!finalResult) throw new Error("Import ended without a result. Please try again.");
      onImported(finalResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStep("preview");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Import Leads via CSV
            </h2>
            <p id={descId} className="mt-0.5 text-sm text-slate-500">
              Upload a CSV file to bulk import leads into your system.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close import dialog"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {step === "select" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
              aria-describedby="csv-dropzone-help"
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                dragActive ? "border-emerald-500 bg-emerald-50/60" : "border-slate-300"
              }`}
            >
              <label htmlFor="csv-file-input" className="sr-only">
                CSV file upload
              </label>
              <input
                ref={inputRef}
                id="csv-file-input"
                type="file"
                accept=".csv"
                className="hidden"
                aria-describedby="csv-dropzone-help"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) loadFile(f);
                }}
              />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <UploadCloud className="h-5 w-5 text-emerald-600" strokeWidth={1.75} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-800">
                Drag &amp; drop your CSV file here, or click to browse
              </p>
              <p id="csv-dropzone-help" className="mt-3 text-xs leading-relaxed text-slate-500">
                Only .csv files, up to {MAX_FILE_MB}MB and {MAX_ROWS.toLocaleString()} rows.
                Required headers: {REQUIRED_HEADERS.join(", ")} — any column names are
                accepted, the AI maps them to these fields automatically.
              </p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  downloadTemplate();
                }}
                className="mt-4 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" /> Download CSV Template
              </button>
            </div>
          )}

          {step === "preview" && file && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024).toFixed(2)} KB · {rows.length} rows · AI processing: not started
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setFile(null);
                    setRows([]);
                    setColumns([]);
                    setStep("select");
                  }}
                  aria-label="Remove selected file"
                  className="rounded-md p-1 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <DataTable columns={columns} rows={rows.slice(0, PREVIEW_ROW_LIMIT)} maxHeight="40vh" />
              <p className="text-xs text-slate-500">
                {rows.length > PREVIEW_ROW_LIMIT
                  ? `Showing the first ${PREVIEW_ROW_LIMIT} of ${rows.length} rows. `
                  : ""}
                No AI processing has happened yet — this is a raw preview of your file.
              </p>
            </div>
          )}

          {step === "processing" && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center justify-center gap-3 py-16"
            >
              <Loader2 className="h-7 w-7 animate-spin text-emerald-600" aria-hidden="true" />
              <p className="text-sm text-slate-600">
                Mapping {rows.length} rows into GrowEasy CRM fields…
              </p>
              {progress && (
                <div className="w-full max-w-xs">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {progress.completed} of {progress.total} batches processed
                    </span>
                    <span>
                      {Math.round((progress.completed / progress.total) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
                      style={{
                        width: `${Math.round(
                          (progress.completed / progress.total) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={step === "processing"}
            className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={step !== "preview"}
            title={step === "select" ? "Select a file first" : undefined}
            className="flex items-center gap-2 rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === "processing" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Upload File
          </button>
        </div>
      </div>
    </div>
  );
}
