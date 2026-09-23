/** Shared phone helpers for clinic forms (aligned with backend CreatePatientIn). */

export const PHONE_COUNTRY_CODES = [
  { code: "+91", label: "IN +91", digits: 10, pattern: /^[6-9]\d{9}$/, placeholder: "9876543210" },
  { code: "+1", label: "US +1", digits: 10, pattern: /^\d{10}$/, placeholder: "2025550123" },
  { code: "+44", label: "UK +44", digits: 10, pattern: /^\d{10}$/, placeholder: "7911123456" },
  { code: "+971", label: "AE +971", digits: 9, pattern: /^[5]\d{8}$/, placeholder: "501234567" },
  { code: "+65", label: "SG +65", digits: 8, pattern: /^[689]\d{7}$/, placeholder: "91234567" },
  { code: "+61", label: "AU +61", digits: 9, pattern: /^[4]\d{8}$/, placeholder: "412345678" },
  { code: "+977", label: "NP +977", digits: 10, pattern: /^[9]\d{9}$/, placeholder: "9841234567" },
  { code: "+94", label: "LK +94", digits: 9, pattern: /^[7]\d{8}$/, placeholder: "712345678" },
] as const;

export type PhoneCountryCode = (typeof PHONE_COUNTRY_CODES)[number]["code"];

export function phoneCountryMeta(code: string) {
  return PHONE_COUNTRY_CODES.find((c) => c.code === code) ?? PHONE_COUNTRY_CODES[0];
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function toE164(countryCode: string, national: string): string {
  const dial = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
  return `${dial}${digitsOnly(national)}`;
}

/** Validate national number for a country; returns error message or null. */
export function validateNationalPhone(countryCode: string, national: string): string | null {
  const trimmed = national.trim();
  if (!trimmed) return "Phone is required";
  if (!/^\d+$/.test(trimmed)) return "Phone must contain digits only";

  const meta = phoneCountryMeta(countryCode);
  if (trimmed.length !== meta.digits) {
    return `Enter a ${meta.digits}-digit number for ${meta.label}`;
  }
  if (!meta.pattern.test(trimmed)) {
    return `Invalid mobile number for ${meta.label}`;
  }
  return null;
}

/**
 * Validate a free-typed phone (calendar / API-style):
 * - 10-digit Indian mobile, or
 * - E.164 with a supported country code
 */
export function validatePhoneInput(value: string): { ok: true; e164: string } | { ok: false; error: string } {
  const raw = value.replace(/[\s\-()]/g, "").trim();
  if (!raw) return { ok: false, error: "Phone is required" };

  if (/^\d{10}$/.test(raw)) {
    const err = validateNationalPhone("+91", raw);
    if (err) return { ok: false, error: err };
    return { ok: true, e164: toE164("+91", raw) };
  }

  if (/^\d+$/.test(raw) && raw.length !== 10) {
    return {
      ok: false,
      error: "Enter a 10-digit Indian mobile, or include country code like +919876543210",
    };
  }

  let e164 = raw.startsWith("+") ? raw : `+${raw}`;
  if (!/^\+[1-9]\d{7,14}$/.test(e164)) {
    return { ok: false, error: "Phone must include country code, e.g. +919876543210" };
  }

  const digits = e164.slice(1);
  const sorted = [...PHONE_COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const c of sorted) {
    const dial = c.code.slice(1);
    if (digits.startsWith(dial)) {
      const national = digits.slice(dial.length);
      const err = validateNationalPhone(c.code, national);
      if (err) return { ok: false, error: err };
      return { ok: true, e164: toE164(c.code, national) };
    }
  }

  return { ok: false, error: "Unsupported country code. Use +91, +1, +44, etc." };
}
