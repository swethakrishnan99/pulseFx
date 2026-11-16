import test from "node:test";
import assert from "node:assert/strict";
import { addDateDays, calendarDateKeys, formatDateRange, localDateKey, parseDateKey, presetDateRange, selectRangeDate } from "./dateRange.mjs";

test("date keys preserve local calendar days, reject invalid dates and cross leap years", () => {
  assert.equal(parseDateKey("2026-02-30"), null);
  assert.equal(parseDateKey("2026-2-01"), null);
  assert.equal(localDateKey(parseDateKey("2024-02-29")), "2024-02-29");
  assert.equal(addDateDays("2024-03-01", -1), "2024-02-29");
  assert.equal(addDateDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDateDays("2026-11-01", -1), "2026-10-31");
});
test("quick periods are inclusive and cross month and year boundaries", () => {
  const today = parseDateKey("2026-01-03");
  assert.deepEqual(presetDateRange("today", today), { from: "2026-01-03", to: "2026-01-03" });
  assert.deepEqual(presetDateRange("week", today), { from: "2025-12-28", to: "2026-01-03" });
  assert.deepEqual(presetDateRange("month30", today), { from: "2025-12-05", to: "2026-01-03" });
  assert.deepEqual(presetDateRange("month", today), { from: "2026-01-01", to: "2026-01-03" });
});
test("calendar grids start on Sunday, include adjacent dates and preserve day ordering", () => {
  const keys = calendarDateKeys(parseDateKey("2026-11-01"));
  assert.equal(keys.length, 42); assert.equal(keys[0], "2026-11-01"); assert.equal(keys[41], "2026-12-12");
  const february = calendarDateKeys(parseDateKey("2024-02-01"));
  assert.equal(february[0], "2024-01-28"); assert.ok(february.includes("2024-02-29"));
});
test("range selection supports reverse order, single-day periods and starting a new selection", () => {
  const first = selectRangeDate({ from: "", to: "" }, "2026-11-15");
  assert.deepEqual(first, { from: "2026-11-15", to: "" });
  assert.deepEqual(selectRangeDate(first, "2026-11-01"), { from: "2026-11-01", to: "2026-11-15" });
  assert.deepEqual(selectRangeDate(first, "2026-11-15"), { from: "2026-11-15", to: "2026-11-15" });
  assert.deepEqual(selectRangeDate({ from: "2026-11-01", to: "2026-11-15" }, "2026-11-20"), { from: "2026-11-20", to: "" });
});
test("labels handle empty, single-day and cross-year periods", () => {
  assert.equal(formatDateRange("", ""), "Any date");
  assert.match(formatDateRange("2026-11-15", "2026-11-15"), /Nov.*15.*2026/);
  assert.match(formatDateRange("2025-12-31", "2026-01-01"), /2025.*2026/);
});

test("last month and last year cover complete calendar periods across year boundaries", () => {
  assert.deepEqual(presetDateRange("lastMonth", parseDateKey("2026-01-03")), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(presetDateRange("lastMonth", parseDateKey("2024-03-15")), { from: "2024-02-01", to: "2024-02-29" });
  assert.deepEqual(presetDateRange("lastYear", parseDateKey("2026-11-15")), { from: "2025-01-01", to: "2025-12-31" });
  assert.deepEqual(presetDateRange("year", parseDateKey("2026-11-15")), { from: "2026-01-01", to: "2026-11-15" });
});
