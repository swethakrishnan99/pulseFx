import test from "node:test";
import assert from "node:assert/strict";
import { dashboardMetrics, initialDashboardFilters, paretoRows, previousPeriod } from "./adminDashboard.mjs";

const partners = [
  { id: "a", name: "Ana", email: "ana@example.test", company: "A", status: "Active", banking: "Missing", brand: "Partial", createdAt: "2026-11-01T16:00:00Z" },
  { id: "b", name: "Bob", email: "bob@example.test", company: "B", status: "Deactivated", banking: "Verified", brand: "Complete", createdAt: "2026-10-01T16:00:00Z" },
];
const referral = (id, partnerId, createdAt, values = {}) => ({ id, partnerId, createdAt, validOwnership: true, country: "Canada", status: "Onboarded", currencies: ["CAD"], volume: "Low", ...values });
const payout = (id, partnerId, amount, currency, status, values = {}) => ({ id, partnerId, amount, currency, status, validOwnership: true, createdAt: "2026-11-05T16:00:00Z", date: "", ...values });
const data = { partners, referrals: [
  referral("1", "a", "2026-11-02T16:00:00Z"), referral("2", "a", "2026-11-01T02:00:00Z"),
  referral("3", "b", "2026-11-03T16:00:00Z", { country: "Brazil" }), referral("4", "a", "2026-11-03T16:00:00Z", { validOwnership: false }),
], payouts: [payout("1", "a", 100, "CAD", "Paid", { date: "2026-11-07T16:00:00Z" }), payout("2", "a", 200, "USD", "Paid"), payout("3", "a", 50, "CAD", "Pending"), payout("4", "b", 20, "CAD", "Failed"), payout("5", "b", 999, "CAD", "Paid", { validOwnership: false }), payout("6", "a", null, "CAD", "Paid")] };
const filters = () => ({ ...initialDashboardFilters(), from: "2026-11-01", to: "2026-11-30" });

test("dashboard filters preserve Toronto dates, currency separation and valid ownership", () => {
  const result = dashboardMetrics(data, filters());
  assert.equal(result.partners.length, 2);
  assert.equal(result.referrals.length, 2);
  assert.equal(result.paid, 100);
  assert.equal(result.pending, 50);
  assert.equal(result.failed, 20);
  assert.equal(result.active, 2);
  assert.equal(dashboardMetrics(data, { ...filters(), minReferrals: "2" }).partners.length, 0);
  assert.equal(dashboardMetrics(data, { ...filters(), maxReferrals: "0" }).partners.length, 0);
  assert.equal(result.onboarded, 2);
});
test("partner, setup, activity, country and registration filters can be combined", () => {
  const result = dashboardMetrics(data, { ...filters(), banking: "Missing", brand: "Partial", country: "Canada", engagement: "with", search: "ana@", joinedFrom: "2026-11-01" });
  assert.deepEqual(result.partners.map(row => row.id), ["a"]);
  assert.equal(result.referrals.length, 1);
  assert.equal(result.paid, 100);
  assert.equal(dashboardMetrics(data, { ...filters(), country: "Brazil", engagement: "without" }).partners[0].id, "a");
  assert.equal(dashboardMetrics(data, { ...filters(), partner: "b" }).referrals.length, 1);
});
test("payment status and date basis apply consistently and unknown dates require cleared filters", () => {
  const result = dashboardMetrics(data, { ...filters(), payoutDate: "date" });
  assert.equal(result.payouts.length, 1);
  assert.equal(result.pending, 0);
  assert.equal(dashboardMetrics(data, { ...filters(), payoutStatus: "Pending" }).paid, 0);
  assert.equal(dashboardMetrics(data, { ...filters(), from: "", to: "", payoutDate: "date" }).pending, 50);
  assert.equal(dashboardMetrics(data, { ...filters(), currency: "USD" }).paid, 200);
});
test("previous periods have inclusive equal lengths and Pareto includes the full contribution base", () => {
  assert.deepEqual(previousPeriod("2026-11-01", "2026-11-16"), { from: "2026-10-16", to: "2026-10-31" });
  assert.equal(previousPeriod("", "2026-11-16"), null);
  const rows = paretoRows([{ id: "a", name: "A", referrals: 8 }, { id: "b", name: "B", referrals: 2 }, { id: "c", referrals: 0 }], "referrals");
  assert.deepEqual(rows.map(row => [row.id, row.share, row.cumulative]), [["a", 80, 80], ["b", 20, 100]]);
  assert.deepEqual(paretoRows([], "paid"), []);
});
