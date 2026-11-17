import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, RefreshCw, Send, UserCheck, Files, Clock3, CheckCircle2, XCircle } from "lucide-react";
import { loadAdminReferrals, updateReferralStatus } from "../lib/referrals";
import { REFERRAL_STATUSES, REFERRAL_STATUS_STYLE } from "../lib/referralStatuses.mjs";
import { formatAirtableDateTime } from "../lib/airtableDates.mjs";
import { sortTableRows } from "../lib/tableSort.mjs";
import { usePagination } from "../lib/usePagination";
import { dialogInput, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import SearchFilter from "./SearchFilter";
import SortableHeader from "./SortableHeader";
import TablePager from "./TablePager";
import ActionButton from "./ActionButton";
import ClearFiltersButton from "./ClearFiltersButton";
import ReferralDetail from "./ReferralDetail";

const SUMMARY_STAGES = [
  ["Invited", "Invite sent", Send],
  ["Account created", "Account created", UserCheck],
  ["Documents submitted", "Documents submitted", Files],
  ["Under review", "Under review", Clock3],
  ["Onboarded", "Onboarded", CheckCircle2],
  ["Rejected", "Rejected", XCircle],
];

function StatusEditor({ referral, onClose, onSaved }) {
  const [status, setStatus] = useState(referral.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    if (busy || status === referral.status) return;
    setBusy(true); setError("");
    try { onSaved(await updateReferralStatus(referral, status)); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <ReferralDetail r={referral} onClose={onClose} busy={busy} admin>
    <form onSubmit={save} className="mt-6 border-t border-gray-100 pt-5" aria-busy={busy}>
      <div className="w-full sm:max-w-50"><label htmlFor="referral-followup-status" className="mb-1.5 block text-xs font-medium">Onboarding status</label>
      <div className="relative"><select id="referral-followup-status" value={status} onChange={event => setStatus(event.target.value)} disabled={busy} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-10 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-100 disabled:bg-gray-50 disabled:text-gray-500">
        {!REFERRAL_STATUSES.includes(referral.status) && <option value={referral.status}>{referral.status}</option>}
        {REFERRAL_STATUSES.map(value => <option key={value}>{value}</option>)}
      </select><ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-gray-400" /></div></div>
      <p className="mt-2 text-xs text-gray-500">Status changes are visible to the referring partner. Your account and email are recorded with each change.</p>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} disabled={busy} className={dialogSecondary}>Close</button><button type="submit" disabled={busy || status === referral.status} className={dialogPrimary}>{busy ? "Saving…" : "Save status"}</button></div>
    </form>
  </ReferralDetail>;
}

export default function AdminReferrals() {
  const [remote, setRemote] = useState({ records: [], loading: true, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [sort, setSort] = useState({ key: "modifiedAt", dir: "desc" });
  const [open, setOpen] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadAdminReferrals(controller.signal).then(records => {
      if (!controller.signal.aborted) setRemote({ records, loading: false, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setRemote({ records: [], loading: false, error: error.message });
    });
    return () => controller.abort();
  }, [attempt]);
  function refresh() {
    setNotice(""); setOpen(null);
    setRemote({ records: [], loading: true, error: "" });
    setAttempt(value => value + 1);
  }
  const rows = useMemo(() => sortTableRows(remote.records.filter(row => (!status || row.status === status) && (!source || row.source === source) &&
    (!query.trim() || [row.company, row.contact, row.email, row.partnerName].some(value => (value || "").toLowerCase().includes(query.trim().toLowerCase())))), sort,
  { createdAt: { value: row => row.createdAt, type: "date" }, modifiedAt: { value: row => row.modifiedAt, type: "date" } }), [remote.records, query, status, source, sort]);
  const pager = usePagination(rows, JSON.stringify([query, status, source, sort]));
  const onSort = key => setSort(previous => ({ key, dir: previous.key === key && previous.dir === "asc" ? "desc" : "asc" }));
  const th = "px-3 py-3 text-left text-xs font-medium text-gray-400 whitespace-nowrap";
  const td = "px-3 py-3 text-sm text-gray-700";
  return <div className="w-full space-y-5">
    <div className="flex flex-wrap items-center justify-end gap-3"><button type="button" onClick={refresh} disabled={remote.loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className="h-4 w-4" />Refresh</button></div>
    <div role="group" aria-label="Referral summary" aria-busy={remote.loading} className="grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {SUMMARY_STAGES.map(([stage, label, Icon]) => <div key={stage} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white p-5">
        <div className="min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{remote.loading || remote.error ? "—" : remote.records.filter(row => row.status === stage).length}</p></div>
        <span aria-hidden="true" className={`shrink-0 rounded-xl p-3 ${REFERRAL_STATUS_STYLE[stage]}`}><Icon className="h-5 w-5" /></span>
      </div>)}
    </div>
    <div className="rounded-xl border border-gray-200/70 bg-white">
    <div className="p-4">
      <fieldset disabled={remote.loading || !!remote.error} className="flex flex-wrap items-end gap-3">
        <SearchFilter id="admin-referrals-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Company, contact, email or partner" />
        <div className="filter-field"><label htmlFor="admin-referrals-status" className="mb-1 block text-xs text-gray-500">Status</label><select id="admin-referrals-status" value={status} onChange={event => setStatus(event.target.value)} className={`${dialogInput} filter-control`}><option value="">All statuses</option>{REFERRAL_STATUSES.map(value => <option key={value}>{value}</option>)}</select></div>
        <div className="filter-field"><label htmlFor="admin-referrals-source" className="mb-1 block text-xs text-gray-500">Source</label><select id="admin-referrals-source" value={source} onChange={event => setSource(event.target.value)} className={`${dialogInput} filter-control`}><option value="">All sources</option><option value="Partner Portal">Partner Portal</option><option value="Referral Link">Referral Link</option></select></div>
      </fieldset>
      <div className="mt-3 flex items-center justify-between gap-3"><ClearFiltersButton onClick={() => { setQuery(""); setStatus(""); setSource(""); }} /></div>
      {notice && <p role="status" className="mt-3 text-sm text-success">{notice}</p>}
    </div>
    <div className="overflow-x-auto"><table className="w-full" aria-busy={remote.loading}>
      <thead className="border-b border-gray-100"><tr>{[["company", "Company"], ["contact", "Contact"], ["email", "Email"], ["source", "Source"], ["status", "Status"], ["partnerName", "Referred by"], ["createdAt", "Created at"], ["modifiedAt", "Last modified at"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={onSort} className={th} />)}<th className={th} scope="col">Modified by</th><th className={th} scope="col">Actions</th></tr></thead>
      <tbody>
        {pager.rows.map(row => <tr key={row.id} className="border-t border-gray-100"><td className={td}>{row.company}</td><td className={td}>{row.contact}</td><td className={td}>{row.email}</td><td className={td}>{row.source || "—"}</td><td className={`${td} whitespace-nowrap`}><span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${REFERRAL_STATUS_STYLE[row.status] || REFERRAL_STATUS_STYLE.Invited}`}>{row.status}</span></td><td className={td}>{row.partnerName}</td><td className={`${td} whitespace-nowrap`}>{formatAirtableDateTime(row.createdAt)}</td><td className={`${td} whitespace-nowrap`}>{formatAirtableDateTime(row.modifiedAt)}</td><td className={td}>{row.modifiedByEmail || "—"}</td><td className={td}><ActionButton label={`Update status for ${row.company}`} tooltip="Update status" onClick={() => { setNotice(""); setOpen(row); }} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-accent"><Pencil className="h-4 w-4" /></ActionButton></td></tr>)}
        {remote.loading && <tr><td colSpan={10} className="p-8 text-center text-sm text-gray-500"><span role="status">Loading referrals…</span></td></tr>}
        {remote.error && <tr><td colSpan={10} className="p-8 text-center text-sm"><p role="alert" className="text-danger">{remote.error}</p><button type="button" onClick={refresh} className="mt-3 text-accent underline">Try again</button></td></tr>}
        {!remote.loading && !remote.error && !rows.length && <tr><td colSpan={10} className="p-8 text-center text-sm text-gray-500">{remote.records.length ? "No referrals match those filters." : "No referrals yet."}</td></tr>}
      </tbody>
    </table></div>
    <TablePager pager={pager} noun="referrals" overall={remote.records.length} />
    {open && <StatusEditor key={open.id} referral={open} onClose={() => setOpen(null)} onSaved={saved => {
      setRemote(previous => ({ ...previous, records: previous.records.map(row => row.id === saved.id ? { ...row, ...saved } : row) }));
      setOpen(null); setNotice(`Status updated for ${open.company}.`);
    }} />}
    </div>
  </div>;
}
