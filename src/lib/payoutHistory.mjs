export function payoutDay(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function filterPayoutHistory(rows, { query = "", status = "All statuses", createdFrom = "", createdTo = "", paidFrom = "", paidTo = "" } = {}) {
  if ((createdFrom && createdTo && createdFrom > createdTo) || (paidFrom && paidTo && paidFrom > paidTo)) return [];
  const search = query.trim().toLowerCase();
  function inRange(value, from, to) {
    if (!from && !to) return true;
    const day = payoutDay(value);
    return !!day && (!from || day >= from) && (!to || day <= to);
  }
  return rows.filter((row) => [row.ref, row.client].some((value) => String(value || "").toLowerCase().includes(search))
    && (status === "All statuses" || row.status === status)
    && inRange(row.createdAt, createdFrom, createdTo) && inRange(row.date, paidFrom, paidTo));
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
