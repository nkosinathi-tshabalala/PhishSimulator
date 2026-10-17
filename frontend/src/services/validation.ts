// Form checks shown before anything is sent. They mirror backend/app/schemas/auth_schema.py, which is
// where the rules are enforced: anyone can send requests without this page, so these checks only help
// the user. SQL injection is stopped on the server (every query uses bound parameters), not here.

export const LIMITS = {
  email: 254,
  name: 100,
  passwordMin: 8,
  passwordMax: 64,
  ageMin: 16,
  ageMax: 120,
  text: 500,
};

const EMAIL = /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/u;
// Letters (any language) and digits, joined by single spaces, apostrophes, hyphens or full stops:
// "Lee-Ann Davids", "O'Neil", "John Smith 3rd". No markup or code characters (< > ; ( ) = ").
const NAME = /^[\p{L}\p{N}]+(?:(?:\. |[ '.-])[\p{L}\p{N}]+)*\.?$/u;
// Control characters never belong in a form field (they are how some injection payloads hide)
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

/** Collapse runs of spaces and trim, as the server stores it. */
export function tidy(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function emailProblem(value: string) {
  const email = value.trim().toLowerCase();
  if (!email) return "Email is required.";
  if (email.length > LIMITS.email || !EMAIL.test(email)) return "Enter a valid email address.";
  return "";
}

export function nameProblem(value: string) {
  const name = tidy(value);
  if (!name) return "Full name is required.";
  if (name.length > LIMITS.name) return `Full name must be at most ${LIMITS.name} characters.`;
  if (!NAME.test(name)) return "Full name may only contain letters, numbers, spaces, apostrophes, hyphens and full stops.";
  return "";
}

export function passwordProblem(value: string) {
  if (value.length < LIMITS.passwordMin) return `Password must be at least ${LIMITS.passwordMin} characters.`;
  if (value.length > LIMITS.passwordMax || new TextEncoder().encode(value).length > 72) {
    return `Password must be at most ${LIMITS.passwordMax} characters.`;
  }
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return "Password must contain at least one letter and one number.";
  return "";
}

export function ageProblem(value: string | number) {
  const text = String(value).trim();
  const age = Number(text);
  if (!/^\d+$/.test(text) || age < LIMITS.ageMin || age > LIMITS.ageMax) {
    return `Age must be a whole number from ${LIMITS.ageMin} to ${LIMITS.ageMax}.`;
  }
  return "";
}

/** Free text such as a reason or a title: within a length and without control characters. */
export function textProblem(value: string, label: string, max = LIMITS.text) {
  if (value.length > max) return `${label} must be at most ${max} characters.`;
  if (CONTROL.test(value)) return `${label} contains characters that are not allowed.`;
  return "";
}

/** The first problem found, or "". */
export function firstProblem(...problems: string[]) {
  return problems.find(Boolean) ?? "";
}
