// Airtable timestamps stay untouched. Use PulseFX's Toronto calendar for every
// date filter and display, regardless of the viewer's browser timezone.
export const AIRTABLE_TIME_ZONE = "America/Toronto";
const calendar = new Intl.DateTimeFormat("en-CA", { timeZone: AIRTABLE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
function calendarDay(date) {
  if (!Number.isFinite(date.getTime())) return "";
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function airtableDay(value) {
  if (value instanceof Date) return calendarDay(value);
  if (typeof value !== "string" || !value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
  }
  if (!/T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return "";
  const date = new Date(value);
  return calendarDay(date);
}
export function inAirtableDateRange(value, from = "", to = "") {
  if (!from && !to) return true;
  const day = airtableDay(value);
  return !!day && (!from || day >= from) && (!to || day <= to);
}
export function airtableFieldValue(record, timestampKey, dateKey) {
  // An explicitly missing timestamp is unknown; do not substitute another event's date.
  return Object.hasOwn(record, timestampKey) ? record[timestampKey] : record[dateKey];
}
export function formatAirtableDateTime(value, fallback = "") {
  const source = value || fallback;
  const day = airtableDay(source);
  if (!day) return "—";
  const timestamp = typeof source === "string" && source.includes("T");
  return new Intl.DateTimeFormat("en-CA", { timeZone: AIRTABLE_TIME_ZONE, year: "numeric", month: "short", day: "numeric",
    ...(timestamp ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}) }).format(new Date(timestamp ? source : `${day}T12:00:00Z`));
}
