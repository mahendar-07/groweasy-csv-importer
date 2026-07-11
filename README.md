# GrowEasy AI Lead Importer

An AI-powered CSV importer that maps arbitrary lead-export CSVs (Facebook, Google Ads,
spreadsheets, other CRMs) into GrowEasy's fixed CRM schema — built for the GrowEasy
Software Developer assignment.

## How it works

1. **Upload** — drag & drop or pick a CSV.
2. **Preview** — the file is parsed in the browser (Papaparse) and shown in a scrollable,
   sticky-header table. No AI calls happen yet.
3. **Confirm** — clicking "Confirm import" sends the raw file to `POST /api/import`.
4. **Extraction** — the API re-parses the CSV server-side, splits it into batches of 25
   rows, and sends each batch to an LLM (OpenAI `gpt-4o-mini` by default, JSON mode) with a
   system prompt that encodes the full GrowEasy CRM schema, the allowed `crm_status` /
   `data_source` enums, the multi-email/phone merge rule, and the skip-if-no-contact rule.
   Batches run in parallel; a batch that fails twice is marked fully skipped instead of
   failing the whole import.
5. **Results** — imported records and skipped rows (with reasons) are shown in two tables,
   plus totals.

## Stack

- Next.js 15 (App Router, TypeScript) — frontend + backend API route in one deployable app
- Tailwind CSS
- Papaparse (CSV parsing, client + server)
- OpenAI SDK (swap the model/provider in `app/api/import/route.ts` if you'd rather use
  Gemini or Claude)

## Setup

```bash
npm install
cp .env.example .env.local   # add your OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000. A sample messy CSV is included at
`samples/facebook_lead_export.csv` to test end to end.

## Project structure

```
app/
  page.tsx              # upload -> preview -> confirm -> results flow
  api/import/route.ts   # CSV parsing + batched AI extraction endpoint
components/
  Dropzone.tsx           # drag & drop / file picker
  DataTable.tsx          # shared scrollable table w/ sticky header
lib/
  schema.ts              # CRM record type + allowed enum values
  prompt.ts               # system prompt sent to the LLM
samples/
  facebook_lead_export.csv
```

## Reliability & validation

- **Backend never trusts the AI's skip/keep decision alone.** Every record the AI returns
  as "imported" is re-checked in `lib/validation.ts` against the actual rule (must have a
  valid email or valid phone). Anything that fails is moved to `skipped` with a reason,
  regardless of what the AI decided.
- `crm_status` / `data_source` are sanitized against the allowed enum lists — any
  out-of-list value from the AI is coerced to `""` rather than trusted.
- Invalid `created_at` dates are cleared rather than causing a record to be dropped.
- File size (5MB) and row count (5,000) are capped on both frontend and backend.
- CSV parse errors and missing header rows are caught before any AI call is made.
- AI batches run with a concurrency cap (4 at a time) instead of unbounded `Promise.all`,
  and failed batches retry twice with exponential backoff before being marked skipped.

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

- Zod/structured-schema validation of the raw AI JSON shape (currently `response_format:
  json_object` + manual sanitization — sufficient for correctness, less strict on shape)
- Per-row stable IDs to guarantee every input row is accounted for exactly once
- Real streaming/per-batch progress (currently a single spinner)
- Docker, automated tests, virtualized tables for very large files
- Analytics/telemetry instrumentation, server-side antivirus scanning, CSRF tokens
  (reasonable for a production CRM, out of scope for this assignment's local/demo deploy)
- `crm_status` and `data_source` are always sanitized server-side against the allowed enum
  list after the LLM responds — if the model returns anything outside the list, it's
  coerced to `""` rather than trusted blindly.
- Batches are processed concurrently (`Promise.all`) for speed on larger files; each batch
  retries up to twice on failure before its rows are marked skipped, so one bad batch never
  fails the entire import.

## Possible next steps (not implemented due to time)

- Streaming progress per batch instead of a single spinner
- Virtualized table rendering for very large CSVs
- Docker setup / automated tests
