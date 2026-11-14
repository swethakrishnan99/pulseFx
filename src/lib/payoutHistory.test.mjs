import test from "node:test";
import assert from "node:assert/strict";
import { filterPayoutHistory, payoutDay, payoutHistoryCsv, payoutHistoryTotals } from "./payoutHistory.mjs";

const local = (month, day, hour = 12) => new Date(2026, month - 1, day, hour).toISOString();
const rows = [
  { ref: "PAY-PAID", client: "Acme | customer@example.test", amount: 100.25, currency: "CAD", status: "Paid", createdAt: local(11, 10), date: local(11, 14), notes: "PRIVATE-NOTE" },
  { ref: "PAY-PENDING", client: "Beta", amount: 25.1, currency: "CAD", status: "Pending", createdAt: local(11, 12), date: "", notes: "PRIVATE-PENDING-NOTE" },
  { ref: "PAY-CANCELLED", client: "Other Client", amount: 50, currency: "CAD", status: "Cancelled", createdAt: local(10, 1), date: "" },
];
test("history filters combine reference/client search and status", () => {
  assert.deepEqual(filterPayoutHistory(rows, { query: " CUSTOMER@EXAMPLE.TEST ", status: "Paid" }), [rows[0]]);
  assert.deepEqual(filterPayoutHistory(rows, { query: "pay-pending", status: "Pending" }), [rows[1]]);
  assert.deepEqual(filterPayoutHistory(rows, { query: "Beta", status: "Paid" }), []);
  assert.deepEqual(filterPayoutHistory(rows), rows);
});
test("created and paid date filters are inclusive and use the same local day as the UI", () => {
  assert.deepEqual(filterPayoutHistory(rows, { createdFrom: "2026-11-10", createdTo: "2026-11-12" }), rows.slice(0, 2));
  assert.deepEqual(filterPayoutHistory(rows, { createdFrom: "2026-11-10", createdTo: "2026-11-10", paidFrom: "2026-11-14", paidTo: "2026-11-14" }), [rows[0]]);
  assert.equal(payoutDay(local(11, 14, 0)), "2026-11-14");
  assert.equal(payoutDay(local(11, 14, 23)), "2026-11-14");
});
test("undated payouts remain visible without a date filter and never match an active paid range", () => {
  assert.deepEqual(filterPayoutHistory(rows, { status: "Pending" }), [rows[1]]);
  assert.deepEqual(filterPayoutHistory(rows, { status: "Pending", paidFrom: "2026-11-01" }), []);
  assert.deepEqual(filterPayoutHistory([{ ...rows[1], createdAt: "" }], { createdTo: "2026-12-31" }), []);
  assert.equal(payoutDay("bad-date"), "");
});
test("invalid date ranges never return misleading history results", () => {
  assert.deepEqual(filterPayoutHistory(rows, { createdFrom: "2026-11-12", createdTo: "2026-11-10" }), []);
  assert.deepEqual(filterPayoutHistory(rows, { paidFrom: "2026-11-15", paidTo: "2026-11-14" }), []);
});
test("indicator totals use CAD cents and paid status while excluding failed/cancelled/other currencies", () => {
  const items = [
    { amount: 0.1, currency: "CAD", status: "Paid", date: local(11, 1) },
    { amount: 0.2, currency: "CAD", status: "Paid", date: local(11, 14) },
    { amount: 5, currency: "CAD", status: "Paid", date: local(10, 1) },
    { amount: 0.6, currency: "CAD", status: "Pending", date: "" },
    { amount: 200, currency: "CAD", status: "Cancelled", date: local(11, 14) },
    { amount: 200, currency: "CAD", status: "Failed", date: local(11, 14) },
    { amount: 100, currency: "USD", status: "Paid", date: local(11, 14) },
    { amount: null, currency: "CAD", status: "Paid", date: "" },
  ];
  assert.deepEqual(payoutHistoryTotals(items, new Date(2026, 10, 14)), { paid: 5.3, pending: 0.6, paidThisMonth: 0.3 });
  assert.deepEqual(payoutHistoryTotals([], new Date(2026, 10, 14)), { paid: 0, pending: 0, paidThisMonth: 0 });
});
test("customer CSV includes creation time but omits Notes and internal audit properties", () => {
  const csv = payoutHistoryCsv([{ ...rows[0], createdByEmail: "PRIVATE-AUTHOR", createdByUserId: "PRIVATE-UUID", cancellationReason: "PRIVATE-REASON" }]);
  assert.equal(csv.split("\r\n")[0], '\uFEFF"Reference","Created at","Paid at","Client","Amount","Currency","Status"');
  for (const secret of ["Notes", "PRIVATE-NOTE", "PRIVATE-AUTHOR", "PRIVATE-UUID", "PRIVATE-REASON"]) assert.equal(csv.includes(secret), false);
  assert.ok(csv.includes(rows[0].createdAt));
});
test("CSV exports only the filtered rows and safely quotes text and spreadsheet formulas", () => {
  const filtered = filterPayoutHistory(rows, { status: "Pending" });
  const csv = payoutHistoryCsv(filtered);
  assert.ok(csv.includes("PAY-PENDING")); assert.equal(csv.includes("PAY-PAID"), false); assert.equal(csv.includes("PAY-CANCELLED"), false);
  const escaped = payoutHistoryCsv([{ ...rows[0], ref: "=1+1", client: 'Café, "Client"' }]);
  assert.ok(escaped.includes(`"'=1+1"`)); assert.ok(escaped.includes('"Café, ""Client"""'));
});
