# GrowEasy AI Lead Importer

An AI-powered CSV importer that maps arbitrary lead-export CSVs (Facebook, Google Ads,
spreadsheets, other CRMs) into GrowEasy's fixed CRM schema — built for the GrowEasy
Software Developer assignment.

## How it works

1. **Upload** — drag & drop or pick a CSV.
2. **Preview** — the file is parsed in the browser (Papaparse) and shown in a scrollable,
   sticky-header table. No AI calls happen yet.
3. **Confirm** — clicking "Upload File" sends the raw file to `POST /api/import`.
4. **Extraction** — the API re-parses the CSV server-side, splits it into batches of 25
   rows, and sends each batch to Groq ("llama-3.3-70b-versatile", JSON response mode) with a
   system prompt that encodes the full GrowEasy CRM schema, the allowed `crm_status` /
   `data_source` enums, the multi-email/phone merge rule, and the skip-if-no-contact rule.
   Batches run with a concurrency cap; a batch that fails twice is marked fully skipped
   instead of failing the whole import.
5. **Results** — imported records and skipped rows (with reasons) are shown in two tables,
   plus totals, with a CSV export of the final CRM records.

## Stack

- Next.js 16 (App Router, TypeScript) — frontend + backend API route in one deployable app
- Tailwind CSS
- Papaparse (CSV parsing, client + server)
- Groq SDK (`groq-sdk`) — swap the model/provider in
  `app/api/import/route.ts` if you'd rather use OpenAI or Claude

## Setup

```bash
npm install
cp .env.example .env.local   # add your GROQ_API_KEY
npm run dev
```

Get a free Groq API key at https://console.groq.com/keys (no billing required).

Open http://localhost:3000. Sample CSVs are included in `samples/` to test end to end,
including messy/edge-case files (multi-contact rows, invalid enum values, broken dates,
no-contact rows that should be skipped).

## Project structure

```
app/
  page.tsx              # "Manage Your Leads" page + import trigger
  api/import/route.ts   # CSV parsing + batched AI extraction endpoint
components/
  ImportModal.tsx        # upload -> preview -> confirm modal flow
  Sidebar.tsx             # GrowEasy-style nav
  StatusBadge.tsx         # colored crm_status pills
  DataTable.tsx           # shared scrollable table w/ sticky header
lib/
  schema.ts              # CRM record type + allowed enum values
  prompt.ts              # system prompt sent to the LLM
  validation.ts           # deterministic email/phone/date/contact checks
samples/
  facebook_lead_export.csv
  facebook_export_100.csv
  google_ads_export_40.csv
  real_estate_crm_80.csv
  messy_manual_25.csv
```

## Reliability & validation

- **Backend never trusts the AI's skip/keep decision alone.** Every record the AI returns
  as "imported" is re-checked in `lib/validation.ts` against the actual rule (must have a
  valid email or valid phone). Anything that fails is moved to `skipped` with a reason,
  regardless of what the AI decided.
- `crm_status` / `data_source` are sanitized against the allowed enum lists (case-normalized
  before comparison) — any out-of-list value from the AI is coerced to `""` rather than
  trusted.
- All AI-returned string fields are trimmed and newline-escaped; email is lowercased;
  `mobile_without_country_code` has all non-digit characters stripped (handles values like
  "98765-43210" or "(987) 654 3210" that a model might return).
- Invalid `created_at` dates are cleared rather than causing a record to be dropped.
- File type (`.csv` extension), non-empty size, 5MB max size, 5,000-row max, and 100-column
  max are all enforced on the backend (not just the frontend).
- CSV parse errors and missing header rows are caught before any AI call is made.
- AI batches run with a concurrency cap (4 at a time) instead of unbounded `Promise.all`,
  and failed batches retry twice with exponential backoff before being marked skipped.
- CSV export includes a UTF-8 BOM so Excel renders non-ASCII names/notes correctly.

## Design notes / assumptions

- The UI intentionally mirrors GrowEasy's own product (sidebar nav, modal-based CSV
  import with a required-headers hint and sample template download, "Manage Your Leads"
  table with status pills) so the import flow feels like a native part of the existing
  app rather than a bolted-on standalone tool.
- The backend re-parses the CSV itself (rather than trusting client-parsed JSON) so the
  API is usable independently of this frontend.

## Accessibility

- The import modal uses `role="dialog"`, `aria-modal`, `aria-labelledby`/`aria-describedby`,
  focus trapping (Tab cycles within it), Escape-to-close, and focus restoration to the
  triggering button on close.
- The drop zone is keyboard-operable (`role="button"`, `tabIndex=0`, Enter/Space activates
  it) with a properly labeled hidden file input, in addition to drag-and-drop — per WCAG
  2.5.7, dragging is never the only way to complete the action.
- Error messages use `role="alert"`; the processing state uses `role="status" aria-live`.
- Hint/caption text was darkened from `slate-400` to `slate-500`/`600` to move contrast
  closer to WCAG AA on a white background.

## Consciously left out (time-boxed for the deadline)

- Zod/structured-schema validation of the raw AI JSON shape (currently the model's native
  JSON mode + manual sanitization — sufficient for correctness, less strict on shape)
- Per-row stable IDs to guarantee every input row is accounted for exactly once
- Real streaming/per-batch progress (currently a single spinner)
- Docker, automated tests, virtualized tables for very large files
- Analytics/telemetry instrumentation, server-side antivirus scanning, CSRF tokens
  (reasonable for a production CRM, out of scope for this assignment's local/demo deploy)
