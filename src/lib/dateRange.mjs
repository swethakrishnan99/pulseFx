export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === value ? date : null;
}
export function addDateDays(value, days) {
  const date = parseDateKey(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}
export function presetDateRange(preset, today = new Date()) {
  const to = localDateKey(today);
  if (preset === "today") return { from: to, to };
  if (preset === "week") return { from: addDateDays(to, -6), to };
  if (preset === "month30") return { from: addDateDays(to, -29), to };
  if (preset === "month") return { from: `${to.slice(0, 8)}01`, to };
  if (preset === "lastMonth") return {
    from: localDateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1, 12)),
    to: localDateKey(new Date(today.getFullYear(), today.getMonth(), 0, 12)),
  };
  if (preset === "year") return { from: `${today.getFullYear()}-01-01`, to };
  if (preset === "lastYear") return { from: `${today.getFullYear() - 1}-01-01`, to: `${today.getFullYear() - 1}-12-31` };
  return { from: "", to: "" };
}
export function selectRangeDate(range, value) {
  if (!parseDateKey(value)) return range;
  if (!range.from || range.to) return { from: value, to: "" };
  return value < range.from ? { from: value, to: range.from } : { from: range.from, to: value };
}
export function calendarDateKeys(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  first.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(first); date.setDate(date.getDate() + index);
    return localDateKey(date);
  });
}
export function formatDateRange(from, to) {
  const start = parseDateKey(from), end = parseDateKey(to);
  if (!start && !end) return "Any date";
  const format = date => date.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  if (!start) return `Until ${format(end)}`;
  if (!end) return `From ${format(start)}`;
  if (from === to) return format(start);
  const first = start.toLocaleDateString("en-CA", { month: "short", day: "numeric", ...(start.getFullYear() !== end.getFullYear() ? { year: "numeric" } : {}) });
  return `${first} – ${format(end)}`;
}
