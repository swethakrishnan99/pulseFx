import ActionButton from "./ActionButton";
import SortableHeader from "./SortableHeader";
import useTableSort from "../lib/useTableSort";
import { useEffect, useRef, useState } from "react";
import { DollarSign, Download, Eye, Search, X } from "lucide-react";
import ClearFiltersButton from "./ClearFiltersButton";
import { loadPayouts } from "../lib/payouts";
import { filterPayoutHistory, payoutHistoryCsv, payoutHistoryTotals } from "../lib/payoutHistory.mjs";

const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const exportButton = "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
const money = (amount, currency = "CAD") => Number.isFinite(amount) ? amount.toLocaleString("en-CA", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "CAD" }) : "—";
const styles = { Paid: "bg-success-100 text-success", Pending: "bg-warning-100 text-gray-800", Failed: "bg-danger-100 text-danger", Cancelled: "bg-danger-100 text-danger" };
const emptyFilters = () => ({ query: "", status: "All statuses", createdFrom: "", createdTo: "", paidFrom: "", paidTo: "" });

function Status({ status }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${styles[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
function PayoutDetails({ payout, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  const bank = payout.bank;
  const details = [["Reference", payout.ref], ["Client", payout.client], ["Amount", `${money(payout.amount, payout.currency)} ${payout.currency}`], ["Status", payout.status], ["Created at", date(payout.createdAt)], ["Paid at", date(payout.date)], ...(payout.lastEditedAt ? [["Last updated at", date(payout.lastEditedAt)]] : []), ...(payout.status === "Cancelled" || payout.cancelledAt ? [["Cancelled at", date(payout.cancelledAt)]] : []), ...(payout.notes ? [["Notes", payout.notes]] : []), ...(payout.cancellationReason && (payout.status === "Cancelled" || payout.cancelledAt) ? [["Cancellation reason", payout.cancellationReason]] : [])];
  return <dialog ref={dialog} aria-labelledby="history-payout-title" onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-center justify-between gap-3"><h2 id="history-payout-title" className="flex items-center gap-2 text-lg font-semibold"><DollarSign className="h-5 w-5 text-accent" />Payout details</h2><button type="button" aria-label="Close payout" onClick={onClose} className="rounded-md p-1.5 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <dl className="mt-4 divide-y divide-gray-100">{details.map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "—"}</dd></div>)}</dl>
    <section aria-label="Payout account" className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4"><h3 className="text-sm font-medium">{payout.status === "Paid" ? "Paid to account" : "Payout account"}</h3>{bank ? <dl className="mt-2 divide-y divide-gray-200/70">{[["Account holder", bank.holder], ["Institution name", bank.name], ["Institution code", bank.institutionCode], ["Transit number", bank.transitNumber], ["Account number", bank.account], ["Currency", bank.currency]].map(([label, value]) => <div key={label} className="py-2"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 break-all text-sm">{value || "—"}</dd></div>)}</dl> : <p className="mt-2 text-sm text-gray-500">{payout.submissionId ? "The recorded payout account is unavailable." : payout.status === "Paid" ? "The account used for this payment was not recorded." : "No payment account has been recorded for this payout."}</p>}</section>
    <div className="mt-4 flex justify-end"><button type="button" className={secondary} onClick={onClose}>Close</button></div>
  </dialog>;
}
export default function PayoutHistory({ authenticated = false }) {
  const { sort, toggleSort, sortRows } = useTableSort();
  const [selected, setSelected] = useState(null);
  const [rows, setRows] = useState([]);
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
  const totals = payoutHistoryTotals(rows);
  const stats = [["Total paid (CAD)", totals.paid], ["Pending (CAD)", totals.pending], ["Paid this month (CAD)", totals.paidThisMonth]];
  const invalidPeriod = (filters.createdFrom && filters.createdTo && filters.createdFrom > filters.createdTo)
    || (filters.paidFrom && filters.paidTo && filters.paidFrom > filters.paidTo);
  const setFilter = (key) => (event) => {
    const value = event.target.value;
    setFilters((previous) => ({ ...previous, [key]: value }));
  };
  function clearFilters() {
    setFilters(emptyFilters());
    // Reset native controls as well, including partially entered dates.
    setFilterReset((value) => value + 1);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([payoutHistoryCsv(filtered)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "payout-history.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <div className="max-w-6xl space-y-5">
    <div><h2 className="text-lg font-semibold text-gray-900">Payout history</h2><p className="mt-1 text-sm text-gray-500">View your payouts and download the history.</p></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white p-5"><div><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{loading || error ? "—" : money(value)}</p></div><DollarSign className="h-6 w-6 shrink-0 text-accent" /></div>)}</div>
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-100 p-3 text-sm text-danger"><p>{error}</p><button type="button" className={secondary} disabled={loading} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Try again</button></div>}
    <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white" aria-label="Payout history records">
      <fieldset key={filterReset} className="grid grid-cols-1 items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div><label htmlFor="history-search" className="mb-1.5 block text-xs text-gray-500">Search reference or client</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input id="history-search" type="search" value={filters.query} onChange={setFilter("query")} className={`${input} pl-9`} /></div></div>
        <div><label htmlFor="history-status" className="mb-1.5 block text-xs text-gray-500">Status</label><select id="history-status" value={filters.status} onChange={setFilter("status")} className={input}><option>All statuses</option>{Object.keys(styles).map((value) => <option key={value}>{value}</option>)}</select></div>
        {[["createdFrom", "Created from"], ["createdTo", "Created to"], ["paidFrom", "Paid from"], ["paidTo", "Paid to"]].map(([key, label]) => <div key={key}><label htmlFor={`history-${key}`} className="mb-1.5 block text-xs text-gray-500">{label}</label><input id={`history-${key}`} type="date" value={filters[key]} onChange={setFilter(key)} className={input} /></div>)}
      </fieldset>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 pb-4"><ClearFiltersButton onClick={clearFilters} /><button type="button" className={exportButton} disabled={loading || !!error || !filtered.length} onClick={download}><Download className="h-3.5 w-3.5" />Download</button></div>
      {invalidPeriod && <p role="alert" className="px-4 pt-3 text-sm text-danger">The end date must be on or after the start date.</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-gray-50 text-[11px] text-gray-500"><tr>{[["ref", "Reference"], ["createdAt", "Created at"], ["date", "Paid at"], ["client", "Client"], ["amount", "Amount"], ["status", "Status"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-4 py-3 font-medium" />)}<th scope="col" className="px-4 py-3 font-medium">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">
        {!loading && !error && filtered.map((row) => <tr key={row.id} className="hover:bg-gray-50/50"><td className="max-w-48 break-words px-4 py-4 font-medium text-gray-900">{row.ref}</td><td className="whitespace-nowrap px-4 py-4">{date(row.createdAt)}</td><td className="whitespace-nowrap px-4 py-4">{date(row.date)}</td><td className="max-w-56 break-words px-4 py-4">{row.client || "—"}</td><td className="whitespace-nowrap px-4 py-4">{money(row.amount, row.currency)} <span className="text-xs text-gray-500">{row.currency}</span></td><td className="px-4 py-4"><Status status={row.status} /></td><td className="px-4 py-4"><ActionButton label={`View payout ${row.ref}`} tooltip="View payout details" onClick={() => setSelected(row)} className="inline-flex rounded-md p-1.5 text-blue-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Eye className="h-4 w-4" /></ActionButton></td></tr>)}
        {(loading || error || !filtered.length) && <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-500"><DollarSign className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p role={loading ? "status" : undefined}>{loading ? "Loading payouts…" : error ? "Payout history unavailable" : rows.length ? "No matching payouts" : authenticated ? "No payouts yet." : "No payouts in this preview."}</p>{!loading && !error && !!rows.length && <p className="mt-1 text-xs">Try another search or change the filters.</p>}</td></tr>}
      </tbody></table></div>
      <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">{filtered.length} of {rows.length} payouts</div>
    </section>
    {selected && <PayoutDetails payout={selected} onClose={() => setSelected(null)} />}
  </div>;
}
