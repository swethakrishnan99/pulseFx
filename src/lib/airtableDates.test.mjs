import test from "node:test";
import assert from "node:assert/strict";
import { airtableDay, airtableFieldValue, formatAirtableDateTime, inAirtableDateRange } from "./airtableDates.mjs";
import { filterPayoutHistory, payoutHistoryTotals } from "./payoutHistory.mjs";

test("Airtable instants use Toronto days in winter and summer, independent of the browser", () => {
  assert.equal(airtableDay("2026-11-15T04:59:59.999Z"), "2026-11-14");
  assert.equal(airtableDay("2026-11-15T05:00:00Z"), "2026-11-15");
  assert.equal(airtableDay("2026-07-15T03:59:59Z"), "2026-07-14");
  assert.equal(airtableDay("2026-07-15T04:00:00Z"), "2026-07-15");
  assert.equal(airtableDay("2026-11-14T23:30:00-05:00"), "2026-11-14");
  assert.equal(airtableDay(new Date("2026-11-15T05:00:00Z")), "2026-11-15");
});
test("inclusive Toronto periods include the whole final day and exclude the next instant", () => {
  assert.equal(inAirtableDateRange("2026-11-15T05:00:00Z", "2026-11-15", "2026-11-15"), true);
  assert.equal(inAirtableDateRange("2026-11-16T04:59:59.999Z", "2026-11-15", "2026-11-15"), true);
  assert.equal(inAirtableDateRange("2026-11-16T05:00:00Z", "2026-11-15", "2026-11-15"), false);
});
test("daylight saving transitions include 23-hour and 25-hour Toronto days correctly", () => {
  assert.equal(inAirtableDateRange("2026-03-08T05:00:00Z", "2026-03-08", "2026-03-08"), true);
  assert.equal(inAirtableDateRange("2026-03-09T03:59:59Z", "2026-03-08", "2026-03-08"), true);
  assert.equal(inAirtableDateRange("2026-03-09T04:00:00Z", "2026-03-08", "2026-03-08"), false);
  for (const stamp of ["2026-11-01T04:00:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2026-11-02T04:59:59Z"]) assert.equal(inAirtableDateRange(stamp, "2026-11-01", "2026-11-01"), true);
  assert.equal(inAirtableDateRange("2026-11-02T05:00:00Z", "2026-11-01", "2026-11-01"), false);
});
test("missing and timezone-less timestamps stay unknown; date-only values keep their date", () => {
  for (const value of ["", null, "invalid", "2026-02-30", "2026-11-15T20:00:00"]) {
    assert.equal(airtableDay(value), "");
    assert.equal(inAirtableDateRange(value, "2026-11-01", "2026-11-30"), false);
    assert.equal(inAirtableDateRange(value), true);
  }
  assert.equal(airtableDay("2024-02-29"), "2024-02-29");
});
test("original timestamps take priority; a missing modified event does not reuse creation dates", () => {
  const row = { createdAt: "2026-11-15T05:00:00Z", created: "2026-11-14", modifiedAt: "", modified: "2026-11-15" };
  assert.equal(airtableFieldValue(row, "createdAt", "created"), row.createdAt);
  assert.equal(airtableFieldValue(row, "modifiedAt", "modified"), "");
  assert.equal(airtableFieldValue({ created: "2026-11-15" }, "createdAt", "created"), "2026-11-15");
});
test("timestamp displays identify EST/EDT and do not invent hours for date-only fields", () => {
  assert.match(formatAirtableDateTime("2026-11-15T05:00:00Z"), /Nov.*15.*2026.*12:00.*EST/);
  assert.match(formatAirtableDateTime("2026-07-15T04:00:00Z"), /Jul.*15.*2026.*12:00.*EDT/);
  assert.doesNotMatch(formatAirtableDateTime("2026-11-15"), /:/);
  assert.equal(formatAirtableDateTime(""), "—");
});
test("payout filtering and monthly indicators use Toronto month boundaries", () => {
  const rows = [
    { ref: "NOV", amount: 100, currency: "CAD", status: "Paid", createdAt: "2026-11-15T04:59:59Z", date: "2026-12-01T04:59:59Z" },
    { ref: "DEC", amount: 25, currency: "CAD", status: "Paid", createdAt: "2026-11-15T05:00:00Z", date: "2026-12-01T05:00:00Z" },
  ];
  assert.deepEqual(filterPayoutHistory(rows, { createdFrom: "2026-11-15", createdTo: "2026-11-15" }), [rows[1]]);
  assert.deepEqual(payoutHistoryTotals(rows, new Date("2026-12-01T04:59:59Z")), { paid: 125, pending: 0, paidThisMonth: 100 });
  assert.deepEqual(payoutHistoryTotals(rows, new Date("2026-12-01T05:00:00Z")), { paid: 125, pending: 0, paidThisMonth: 25 });
});
