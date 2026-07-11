import { CrmRecord } from "./schema";

export function isValidEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidDate(date: string): boolean {
  if (!date) return true; // created_at is allowed to be blank per the spec
  return !Number.isNaN(new Date(date).getTime());
}

export function hasValidContact(record: CrmRecord): boolean {
  return (
    isValidEmail(record.email) || isValidPhone(record.mobile_without_country_code)
  );
}

/**
 * Re-validates a record the AI marked as "imported" against the actual assignment
 * rule (must have a usable email or phone). Returns a reason string if the record
 * should be moved to skipped, or null if it's fine to keep.
 */
export function validateImportedRecord(record: CrmRecord): string | null {
  if (!hasValidContact(record)) {
    return "No valid email or phone number (AI marked as imported, but failed backend validation).";
  }
  if (!isValidDate(record.created_at)) {
    // Not fatal — clear the bad date rather than dropping a real lead over it.
    record.created_at = "";
  }
  return null;
}
