export { cn } from "cn";

export function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return "";
}

/** Null, blank text and an empty selection are empty; zero and false are not. */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "string" && value.trim() === "";
}

/** Accept finite numeric values without coercing empty selections to zero. */
export function toFiniteNumber(value: unknown): number | null {
  if (isEmptyValue(value) || (typeof value !== "number" && typeof value !== "string")) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
