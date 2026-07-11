import { describe, it, expect } from "vitest";
import {
  isValidEmail,
  isValidPhone,
  isValidDate,
  hasValidContact,
  validateImportedRecord,
} from "./validation";
import { CrmRecord } from "./schema";

function makeRecord(overrides: Partial<CrmRecord> = {}): CrmRecord {
  return {
    created_at: "",
    name: "",
    email: "",
    country_code: "",
    mobile_without_country_code: "",
    company: "",
    city: "",
    state: "",
    country: "",
    lead_owner: "",
    crm_status: "",
    crm_note: "",
    data_source: "",
    possession_time: "",
    description: "",
    ...overrides,
  };
}

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("jane@example.com")).toBe(true);
  });

  it("accepts an email with surrounding whitespace", () => {
    expect(isValidEmail("  jane@example.com  ")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects a string with no @", () => {
    expect(isValidEmail("jane.example.com")).toBe(false);
  });

  it("rejects a string with no domain suffix", () => {
    expect(isValidEmail("jane@example")).toBe(false);
  });

  it("rejects a string with spaces inside it", () => {
    expect(isValidEmail("jane doe@example.com")).toBe(false);
  });
});

describe("isValidPhone", () => {
  it("accepts a 10-digit number", () => {
    expect(isValidPhone("9876543210")).toBe(true);
  });

  it("accepts a number formatted with dashes/spaces/parens", () => {
    expect(isValidPhone("(987) 654-3210")).toBe(true);
  });

  it("rejects a number that is too short (< 7 digits)", () => {
    expect(isValidPhone("12345")).toBe(false);
  });

  it("rejects a number that is too long (> 15 digits)", () => {
    expect(isValidPhone("1234567890123456")).toBe(false);
  });

  it("accepts the lower boundary of 7 digits", () => {
    expect(isValidPhone("1234567")).toBe(true);
  });

  it("accepts the upper boundary of 15 digits", () => {
    expect(isValidPhone("123456789012345")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidPhone("")).toBe(false);
  });
});

describe("isValidDate", () => {
  it("allows an empty string (created_at may be blank)", () => {
    expect(isValidDate("")).toBe(true);
  });

  it("accepts a valid ISO date", () => {
    expect(isValidDate("2024-05-01")).toBe(true);
  });

  it("accepts a valid human-readable date", () => {
    expect(isValidDate("May 1, 2024")).toBe(true);
  });

  it("rejects an unparseable date string", () => {
    expect(isValidDate("not-a-date")).toBe(false);
  });
});

describe("hasValidContact", () => {
  it("returns true when email is valid, even with no phone", () => {
    const record = makeRecord({ email: "jane@example.com" });
    expect(hasValidContact(record)).toBe(true);
  });

  it("returns true when phone is valid, even with no email", () => {
    const record = makeRecord({ mobile_without_country_code: "9876543210" });
    expect(hasValidContact(record)).toBe(true);
  });

  it("returns false when neither email nor phone is valid", () => {
    const record = makeRecord({ email: "bad-email", mobile_without_country_code: "123" });
    expect(hasValidContact(record)).toBe(false);
  });

  it("returns false when both are empty", () => {
    const record = makeRecord();
    expect(hasValidContact(record)).toBe(false);
  });
});

describe("validateImportedRecord", () => {
  it("returns null (accepted) for a record with a valid email", () => {
    const record = makeRecord({ email: "jane@example.com" });
    expect(validateImportedRecord(record)).toBeNull();
  });

  it("returns a rejection reason when there is no usable contact info", () => {
    const record = makeRecord();
    const reason = validateImportedRecord(record);
    expect(reason).not.toBeNull();
    expect(reason).toMatch(/email or phone/i);
  });

  it("clears an invalid created_at date rather than rejecting the record", () => {
    const record = makeRecord({
      email: "jane@example.com",
      created_at: "not-a-date",
    });
    const reason = validateImportedRecord(record);
    expect(reason).toBeNull();
    expect(record.created_at).toBe("");
  });

  it("keeps a valid created_at date untouched", () => {
    const record = makeRecord({
      email: "jane@example.com",
      created_at: "2024-05-01",
    });
    validateImportedRecord(record);
    expect(record.created_at).toBe("2024-05-01");
  });
});
