import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import {
  CrmRecord,
  ImportResponse,
  CRM_STATUS_VALUES,
  DATA_SOURCE_VALUES,
} from "@/lib/schema";
import { validateImportedRecord } from "@/lib/validation";

export const runtime = "nodejs";

const BATCH_SIZE = 25;
const MAX_RETRIES = 2;
const CONCURRENCY_LIMIT = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB, matches the frontend limit
const MAX_ROWS = 5000;
const MAX_COLUMNS = 100;

function getModel() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
  return genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0,
    },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Runs async tasks with a concurrency cap instead of firing all at once. */
async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runner() {
    while (next < items.length) {
      const current = next++;
      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runner));
  return results;
}

function sanitizeRecord(raw: Record<string, unknown>): CrmRecord {
  const str = (v: unknown): string => {
    if (v == null) return "";
    return String(v).trim().replace(/\r?\n/g, "\\n");
  };
  const status = str(raw.crm_status).toUpperCase();
  const source = str(raw.data_source).toLowerCase();
  return {
    created_at: str(raw.created_at),
    name: str(raw.name),
    email: str(raw.email).toLowerCase(),
    country_code: str(raw.country_code),
    mobile_without_country_code: str(raw.mobile_without_country_code).replace(/\D/g, ""),
    company: str(raw.company),
    city: str(raw.city),
    state: str(raw.state),
    country: str(raw.country),
    lead_owner: str(raw.lead_owner),
    crm_status: (CRM_STATUS_VALUES as readonly string[]).includes(status)
      ? (status as CrmRecord["crm_status"])
      : "",
    crm_note: str(raw.crm_note),
    data_source: (DATA_SOURCE_VALUES as readonly string[]).includes(source)
      ? (source as CrmRecord["data_source"])
      : "",
    possession_time: str(raw.possession_time),
    description: str(raw.description),
  };
}

async function extractBatch(
  rows: Record<string, unknown>[],
  attempt = 0
): Promise<{ records: CrmRecord[]; skipped: { row: Record<string, unknown>; reason: string }[] }> {
  try {
    const model = getModel();
    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: buildUserPrompt(rows) },
    ]);

    const content = result.response.text() || "{}";
    const parsed = JSON.parse(content) as {
      records?: Record<string, unknown>[];
      skipped?: { row: Record<string, unknown>; reason: string }[];
    };

    const records: CrmRecord[] = [];
    const skipped: { row: Record<string, unknown>; reason: string }[] = [
      ...(parsed.skipped ?? []),
    ];

    for (const raw of parsed.records ?? []) {
      const sanitized = sanitizeRecord(raw);
      const rejectionReason = validateImportedRecord(sanitized);
      if (rejectionReason) {
        skipped.push({ row: raw, reason: rejectionReason });
      } else {
        records.push(sanitized);
      }
    }

    return { records, skipped };
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      await delay(1000 * 2 ** attempt);
      return extractBatch(rows, attempt + 1);
    }
    // If a batch fails entirely after retries, mark every row in it as skipped
    // rather than failing the whole import.
    return {
      records: [],
      skipped: rows.map((row) => ({
        row,
        reason: `AI extraction failed after ${MAX_RETRIES + 1} attempts: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      })),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No CSV file found in request. Expected multipart field 'file'." },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Only CSV files are supported." },
        { status: 415 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The uploaded CSV file is empty." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_FILE_BYTES / (1024 * 1024)}MB limit.` },
        { status: 413 }
      );
    }

    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
    });

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { error: "Failed to parse CSV.", details: parsed.errors.slice(0, 5) },
        { status: 400 }
      );
    }

    if (!parsed.meta.fields || parsed.meta.fields.length === 0) {
      return NextResponse.json(
        { error: "The CSV does not contain a valid header row." },
        { status: 400 }
      );
    }

    if (parsed.meta.fields.length > MAX_COLUMNS) {
      return NextResponse.json(
        { error: `The CSV exceeds the maximum limit of ${MAX_COLUMNS} columns.` },
        { status: 413 }
      );
    }

    const rows = parsed.data.filter((r) => Object.keys(r).length > 0);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "CSV contained no data rows." },
        { status: 400 }
      );
    }

    if (rows.length > MAX_ROWS) {
      return NextResponse.json(
        { error: `The CSV exceeds the maximum limit of ${MAX_ROWS} rows.` },
        { status: 413 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server is missing GEMINI_API_KEY. Set it in your environment." },
        { status: 500 }
      );
    }

    const batches = chunk(rows, BATCH_SIZE);
    const results = await runWithConcurrency(batches, CONCURRENCY_LIMIT, extractBatch);

    const imported: CrmRecord[] = [];
    const skipped: { row: Record<string, unknown>; reason: string }[] = [];
    for (const r of results) {
      imported.push(...r.records);
      skipped.push(...r.skipped);
    }

    const response: ImportResponse = {
      imported,
      skipped,
      total_imported: imported.length,
      total_skipped: skipped.length,
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
