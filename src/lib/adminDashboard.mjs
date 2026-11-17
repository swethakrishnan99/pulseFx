import { airtableDay, inAirtableDateRange } from "./airtableDates.mjs";
export function initialDashboardFilters() {
  const today = airtableDay(new Date());
  return {
    from: `${today.slice(0, 7)}-01`,
    to: today,
    joinedFrom: "",
    joinedTo: "",
    search: "",
    partner: "",
    access: "",
    banking: "",
    brand: "",
    engagement: "",
    minReferrals: "",
    maxReferrals: "",
    referralStatus: "",
    country: "",
    referralCurrency: "",
    volume: "",
    payoutStatus: "",
    currency: "CAD",
    payoutDate: "createdAt"
  };
}
export function previousPeriod(from, to) {
  if (!from || !to) return null;
  const start = Date.parse(`${from}T12:00:00Z`),
    end = Date.parse(`${to}T12:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  const day = 86400000;
  return {
    from: new Date(start - (end - start + day)).toISOString().slice(0, 10),
    to: new Date(start - day).toISOString().slice(0, 10)
  };
}
export function dashboardMetrics(data, filters) {
  const f = filters;
  const range = value => inAirtableDateRange(value, f.from, f.to);
  const referralMatches = row => (!f.referralStatus || row.status === f.referralStatus) && (!f.country || row.country === f.country) && (!f.referralCurrency || row.currencies.includes(f.referralCurrency)) && (!f.volume || row.volume === f.volume);
  const validReferrals = data.referrals.filter(row => row.validOwnership && referralMatches(row));
  const periodReferrals = validReferrals.filter(row => range(row.createdAt));
  const counts = new Map();
  for (const row of periodReferrals) counts.set(row.partnerId, (counts.get(row.partnerId) || 0) + 1);
  const search = f.search.trim().toLowerCase();
  const partners = data.partners.filter(row => (!f.partner || row.id === f.partner) && (!search || `${row.name} ${row.email} ${row.company}`.toLowerCase().includes(search)) && (!f.access || row.status === f.access) && (!f.banking || row.banking === f.banking) && (!f.brand || row.brand === f.brand) && inAirtableDateRange(row.createdAt, f.joinedFrom, f.joinedTo) && (!f.engagement || (f.engagement === "with" ? counts.has(row.id) : !counts.has(row.id))) && (!f.minReferrals || (counts.get(row.id) || 0) >= Number(f.minReferrals)) && (!f.maxReferrals || (counts.get(row.id) || 0) <= Number(f.maxReferrals)));
  const ids = new Set(partners.map(row => row.id));
  const referrals = periodReferrals.filter(row => ids.has(row.partnerId));
  const payouts = data.payouts.filter(row => row.validOwnership && ids.has(row.partnerId) && range(row[f.payoutDate]) && row.currency === f.currency && (!f.payoutStatus || row.status === f.payoutStatus));
  const totalFor = status => payouts.filter(row => row.status === status && Number.isFinite(row.amount)).reduce((sum, row) => sum + row.amount, 0);
  const active = partners.filter(row => counts.has(row.id)).length;
  const onboarded = referrals.filter(row => row.status === "Onboarded").length;
  const ranking = partners.map(row => ({
    ...row,
    referrals: counts.get(row.id) || 0,
    paid: payouts.filter(payout => payout.partnerId === row.id && payout.status === "Paid" && Number.isFinite(payout.amount)).reduce((sum, payout) => sum + payout.amount, 0),
    lastReferral: validReferrals.filter(referral => referral.partnerId === row.id).map(referral => referral.createdAt).sort().at(-1) || ""
  }));
  return {
    partners,
    referrals,
    payouts,
    ranking,
    active,
    onboarded,
    paid: totalFor("Paid"),
    pending: totalFor("Pending"),
    failed: totalFor("Failed"),
    cancelled: totalFor("Cancelled")
  };
}
export function distribution(rows, field) {
  const counts = new Map();
  for (const row of rows) counts.set(row[field] || "Unknown", (counts.get(row[field] || "Unknown") || 0) + 1);
  return [...counts].map(([label, count]) => ({
    label,
    count
  })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
export function paretoRows(ranking, field) {
  const sorted = ranking.filter(row => row[field] > 0).sort((a, b) => b[field] - a[field] || (a.name || "").localeCompare(b.name || ""));
  const total = sorted.reduce((sum, row) => sum + row[field], 0);
  let cumulative = 0;
  return sorted.map(row => {
    cumulative += row[field];
    return {
      ...row,
      share: row[field] / total * 100,
      cumulative: cumulative / total * 100
    };
  });
}
