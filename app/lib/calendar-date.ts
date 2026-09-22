const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const EXPLICIT_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/i;

export type CalendarDateNormalizer = (value: unknown) => string | null;

export function isCalendarDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = CALENDAR_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9999) return false;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function calendarDateKeyToDate(value: string): Date | null {
  if (!isCalendarDateKey(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date;
}

export function parseExplicitTimestamp(value: unknown): Date | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    return year >= 1 && year <= 9999 ? value : null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    return year >= 1 && year <= 9999 ? date : null;
  }

  if (typeof value !== "string") return null;
  const input = value.trim();
  const match = EXPLICIT_TIMESTAMP_PATTERN.exec(input);
  if (!match) return null;

  const dateKey = match[1];
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4]);
  if (!isCalendarDateKey(dateKey)) return null;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const offsetHours = match[6];
  const offsetMinutes = match[7];
  if (offsetHours !== undefined && (Number(offsetHours) > 23 || Number(offsetMinutes) > 59)) {
    return null;
  }

  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  return year >= 1 && year <= 9999 ? date : null;
}

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw new RangeError(`Invalid IANA time zone: ${timeZone}`);
  }
}

export function createCalendarDateNormalizer(timeZone = "UTC"): CalendarDateNormalizer {
  assertTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    era: "short",
  });

  return (value) => {
    if (isCalendarDateKey(value)) return value;
    const date = parseExplicitTimestamp(value);
    if (!date) return null;

    const parts = formatter.formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    const era = parts.find((part) => part.type === "era")?.value;
    if (!year || !month || !day || era !== "AD") return null;
    const key = `${year.padStart(4, "0")}-${month}-${day}`;
    return isCalendarDateKey(key) ? key : null;
  };
}

export function compareCalendarDateKeys(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}
