import { airtableDay, inAirtableDateRange } from "./airtableDates.mjs";

export const payoutDay = airtableDay;
export function filterPayoutHistory(rows, { query = "", status = "All statuses", createdFrom = "", createdTo = "", paidFrom = "", paidTo = "" } = {}) {
  if ((createdFrom && createdTo && createdFrom > createdTo) || (paidFrom && paidTo && paidFrom > paidTo)) return [];
  const search = query.trim().toLowerCase();
  return rows.filter((row) => [row.ref, row.client].some((value) => String(value || "").toLowerCase().includes(search))
    && (status === "All statuses" || row.status === status)
    && inAirtableDateRange(row.createdAt, createdFrom, createdTo) && inAirtableDateRange(row.date, paidFrom, paidTo));
}
export function payoutHistoryTotals(rows, now = new Date()) {
  const sum = (items) => items.reduce((total, row) => total + (row.currency === "CAD" && Number.isFinite(row.amount) ? Math.round(row.amount * 100) : 0), 0) / 100;
  const paid = rows.filter((row) => row.status === "Paid");
  const month = payoutDay(now.toISOString()).slice(0, 7);
  return { paid: sum(paid), pending: sum(rows.filter((row) => row.status === "Pending")),
    paidThisMonth: sum(paid.filter((row) => payoutDay(row.date).startsWith(month))) };
}
export function payoutHistoryCsv(rows) {
  const cell = (value) => {
    let text = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const values = [["Reference", "Created at", "Paid at", "Client", "Amount", "Currency", "Status"],
    ...rows.map((row) => [row.ref, row.createdAt, row.date, row.client, row.amount, row.currency, row.status])];
  return "\uFEFF" + values.map((row) => row.map(cell).join(",")).join("\r\n");
}
