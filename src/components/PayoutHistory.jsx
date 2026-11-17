import { DEMO_PAYOUTS } from "../lib/partnerDemo";
import PortalDialog from "./PortalDialog";
import { dialogSecondary } from "../lib/dialogStyles";
import { formatAirtableDateTime } from "../lib/airtableDates.mjs";
import DateRangeFilter from "./DateRangeFilter";
import SearchFilter from "./SearchFilter";
import ActionButton from "./ActionButton";
import SortableHeader from "./SortableHeader";
import TablePager from "./TablePager";
import { usePagination } from "../lib/usePagination";
import useTableSort from "../lib/useTableSort";
import { useEffect, useState } from "react";
import { CalendarDays, Clock3, DollarSign, Download, Eye } from "lucide-react";
import ClearFiltersButton from "./ClearFiltersButton";
import { loadPayouts } from "../lib/payouts";
import { filterPayoutHistory, payoutHistoryCsv, payoutHistoryTotals } from "../lib/payoutHistory.mjs";

const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const exportButton = "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const date = formatAirtableDateTime;
const money = (amount, currency = "CAD") => Number.isFinite(amount) ? amount.toLocaleString("en-CA", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "CAD" }) : "—";
const styles = { Paid: "bg-success-100 text-success", Pending: "bg-warning-100 text-amber-800", Failed: "bg-danger-100 text-danger", Cancelled: "bg-danger-100 text-danger" };
const emptyFilters = () => ({ query: "", status: "All statuses", createdFrom: "", createdTo: "", paidFrom: "", paidTo: "" });

function ClientCell({ value }) {
  if (!value) return "—";
  const [name, ...rest] = String(value).split(" | ");
  return <>{name}{rest.length > 0 && <span className="block text-xs text-gray-400">{rest.join(" | ")}</span>}</>;
}
function Status({ status }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${styles[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
function PayoutDetails({ payout, onClose }) {
  const bank = payout.bank;
  const details = [["Reference", payout.ref], ["Client", payout.client], ["Amount", `${money(payout.amount, payout.currency)} ${payout.currency}`], ["Status", payout.status], ["Created at", date(payout.createdAt)], ["Paid at", date(payout.date)], ...(payout.lastEditedAt ? [["Last updated at", date(payout.lastEditedAt)]] : []), ...(payout.status === "Cancelled" || payout.cancelledAt ? [["Cancelled at", date(payout.cancelledAt)]] : []), ...(payout.notes ? [["Notes", payout.notes]] : []), ...(payout.cancellationReason && (payout.status === "Cancelled" || payout.cancelledAt) ? [["Cancellation reason", payout.cancellationReason]] : [])];
  return <PortalDialog title="Payout details" subtitle={payout.ref} icon={<DollarSign className="h-5 w-5" />} maxWidth="max-w-xl" onClose={onClose}>
    <div className="p-6">

    <dl className="mt-4 divide-y divide-gray-100">{details.map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "—"}</dd></div>)}</dl>
    <section aria-label="Payout account" className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="text-sm font-medium">{payout.status === "Paid" ? "Paid to account" : "Payout account"}</h3>{bank ? <dl className="mt-2 divide-y divide-gray-200/70">{[["Account holder", bank.holder], ["Institution name", bank.name], ["Institution code", bank.institutionCode], ["Transit number", bank.transitNumber], ["Account number", bank.account], ["Currency", bank.currency]].map(([label, value]) => <div key={label} className="py-2"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-all text-sm">{value || "—"}</dd></div>)}</dl> : <p className="mt-2 text-sm text-gray-500">{payout.submissionId ? "The recorded payout account is unavailable." : payout.status === "Paid" ? "The account used for this payment was not recorded." : "No payment account has been recorded for this payout."}</p>}</section>
    <div className="mt-4 flex justify-end"><button type="button" className={dialogSecondary} onClick={onClose}>Close</button></div>
    </div>
  </PortalDialog>;
}
export default function PayoutHistory({ authenticated = false, showDescription = true }) {
  const { sort, toggleSort, sortRows } = useTableSort({ key: "createdAt", dir: "desc" });
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState(authenticated ? [] : DEMO_PAYOUTS);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [filterReset, setFilterReset] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const controller = new AbortController();
    loadPayouts(controller.signal).then((payouts) => { if (active) { setRows(payouts); setLoading(false); setError(""); } })
      .catch((failure) => { if (active) { setError(failure.message); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [authenticated, attempt]);
  const filtered = sortRows(filterPayoutHistory(rows, filters), { amount: { type: "number" }, createdAt: { type: "date" }, date: { type: "date" } });
  const pager = usePagination(filtered, [JSON.stringify(filters), sort?.key, sort?.dir].join("|"));
  const totals = payoutHistoryTotals(rows);
  const stats = [["Total paid (CAD)", totals.paid, DollarSign, "bg-success-100 text-success"], ["Pending (CAD)", totals.pending, Clock3, "bg-warning-100 text-warning"], ["Paid this month (CAD)", totals.paidThisMonth, CalendarDays, "bg-accent-100 text-accent"]];
  const invalidPeriod = (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo)
    || (filters.paidFrom && filters.paidTo && filters.paidFrom > filters.paidTo);
  const setFilter = (key) => (event) => {
    const value = event.target.value;
    setFilters((previous) => ({ ...previous, [key]: value }));
  };
  function clearFilters() {
    setFilters(emptyFilters());
    // Discard any unconfirmed calendar selections as well.
    setFilterReset((value) => value + 1);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([payoutHistoryCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "payout-history.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <div className="max-w-6xl space-y-5">
    {showDescription && <div><p className="text-sm text-gray-500">Track your payouts and review payment details.</p></div>}
    <div role="group" aria-label="Payout summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">{stats.map(([label, value, Icon, tone]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white p-5"><div><p className="text-xs font-medium text-accent">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{loading || error ? "—" : money(value)}</p></div><span aria-hidden="true" className={`shrink-0 rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div>)}</div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-100 p-3 text-sm text-danger"><p>{error}</p><button type="button" className={secondary} disabled={loading} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Try again</button></div>}
    <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white" aria-label="Payout history records">
      <fieldset key={filterReset} className="flex flex-wrap items-end gap-3 p-4">
        <SearchFilter id="history-search" value={filters.query} onChange={setFilter("query")} placeholder="Reference or client" />
        <div className="filter-field"><label htmlFor="history-status" className="mb-1.5 block text-xs text-gray-500">Status</label><select id="history-status" value={filters.status} onChange={setFilter("status")} className={`${input} filter-control`}><option>All statuses</option>{Object.keys(styles).sort().map((value) => <option key={value}>{value}</option>)}</select></div>
        <DateRangeFilter id="history-created-period" label="Created at" from={filters.createdFrom} to={filters.createdTo} onChange={range => setFilters(previous => ({ ...previous, createdFrom: range.from, createdTo: range.to }))} />
        <DateRangeFilter id="history-paid-period" label="Paid at" from={filters.paidFrom} to={filters.paidTo} onChange={range => setFilters(previous => ({ ...previous, paidFrom: range.from, paidTo: range.to }))} />
      </fieldset>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 pb-4"><ClearFiltersButton onClick={clearFilters} /><button type="button" className={exportButton} disabled={loading || !!error || !filtered.length} onClick={download}><Download className="h-3.5 w-3.5" />Download</button></div>
      {invalidPeriod && <p role="alert" className="px-4 pt-3 text-sm text-danger">The end date must be on or after the start date.</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-xs text-gray-400 border-b border-gray-100"><tr>{[["ref", "Reference"], ["client", "Client"], ["createdAt", "Created at"], ["date", "Paid at"], ["amount", "Amount"], ["status", "Status"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-4 py-3 font-medium" />)}<th scope="col" className="px-4 py-3 font-medium">Actions</th></tr></thead><tbody className="divide-y divide-gray-100 text-gray-700">
        {!loading && !error && pager.rows.map((row) => <tr key={row.id}><td className="max-w-48 break-words px-4 py-3 font-mono text-xs text-accent">{row.ref}</td><td className="max-w-56 break-words px-4 py-3"><ClientCell value={row.client} /></td><td className="whitespace-nowrap px-4 py-3">{date(row.createdAt)}</td><td className="whitespace-nowrap px-4 py-3">{date(row.date)}</td><td className="whitespace-nowrap px-4 py-3">{money(row.amount, row.currency)} <span className="text-xs text-gray-500">{row.currency}</span></td><td className="px-4 py-3"><Status status={row.status} /></td><td className="px-4 py-3"><ActionButton label={`View payout ${row.ref}`} tooltip="View payout details" onClick={() => setSelected(row)} className="inline-flex rounded-md p-1.5 text-gray-500 hover:text-accent hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Eye className="h-4 w-4" /></ActionButton></td></tr>)}
        {(loading || error || !filtered.length) && <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-500"><DollarSign className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p role={loading ? "status" : undefined}>{loading ? "Loading payouts…" : error ? "Payout history unavailable" : rows.length ? "No matching payouts" : authenticated ? "No payouts yet." : "No payouts in this preview."}</p>{!loading && !error && !!rows.length && <p className="mt-1 text-xs">Try another search or change the filters.</p>}</td></tr>}
      </tbody></table></div>
      <TablePager pager={pager} noun="payouts" overall={rows.length} />
    </section>
    {selected && <PayoutDetails payout={selected} onClose={() => setSelected(null)} />}
  </div>;
}