import PortalDialog from "./PortalDialog";
import { dialogDanger, dialogInput, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import { formatAirtableDateTime } from "../lib/airtableDates.mjs";
import SearchFilter from "./SearchFilter";
import SortableHeader from "./SortableHeader";
import TablePager from "./TablePager";
import { usePagination } from "../lib/usePagination";
import useTableSort from "../lib/useTableSort";
import ClearFiltersButton from "./ClearFiltersButton";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Eye, Landmark, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import ActionButton from "./ActionButton";
import { loadBankingReviews, reviewBanking } from "../lib/banking";

const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const date = formatAirtableDateTime;
const statuses = { "Pending verification": "bg-warning-100 text-amber-800", Verified: "bg-success-100 text-success", Rejected: "bg-danger-100 text-danger" };
function Badge({ status }) { return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${statuses[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>; }

function ReviewVisibility({ checked, onChange, disabled, rejection = false }) {
  return <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" className="accent-accent" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} />{rejection ? "Show rejection reason to partner" : "Show approval reason to partner"}</label>;
}

function BankComparison({ submission, current }) {
  const fields = [["Account holder", "holder"], ["Institution code", "institutionCode"], ["Institution name", "bank"], ["Transit number", "transitNumber"], ["Account number", "account"], ["Currency", "currency"]];
  return <section aria-label="Bank account comparison" className="mt-4 grid gap-4 sm:grid-cols-2">
    <div className="min-w-0 rounded-xl border border-gray-200 p-4"><h3 className="text-sm font-semibold text-gray-900">Submitted details</h3><dl className="mt-3 space-y-3">{fields.map(([label, key]) => {
      const changed = !!current && (submission[key] || "") !== (current[key] || "");
      return <div key={key} className={`rounded-md p-2 ${changed ? "bg-amber-50 ring-1 ring-amber-200" : "bg-gray-50"}`}><dt className="flex flex-wrap items-center justify-between gap-1 text-xs text-gray-500">{label}{changed && <span className="font-medium text-amber-800">Changed</span>}</dt><dd className="mt-1 whitespace-pre-wrap break-all text-sm text-gray-900">{submission[key] || "—"}</dd></div>;
    })}</dl></div>
    <div className="min-w-0 rounded-xl border border-gray-200 p-4"><h3 className="text-sm font-semibold text-gray-900">Current verified account</h3>{current ? <dl className="mt-3 space-y-3">{fields.map(([label, key]) => <div key={key} className="rounded-md bg-gray-50 p-2"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-all text-sm text-gray-900">{current[key] || "—"}</dd></div>)}</dl> : <p className="mt-3 text-sm text-gray-500">No verified payout account yet.</p>}</div>
  </section>;
}

function ReviewDialog({ submission, current, onClose, onReview }) {
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState(submission.reviewNotes);
  const [showNotes, setShowNotes] = useState(submission.showReviewNotesToPartner === true);
  const [rejectionReason, setRejectionReason] = useState(submission.rejectionReason || "");
  const [showRejectionReason, setShowRejectionReason] = useState(submission.showRejectionReasonToPartner === true);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => () => previousFocus.current?.focus?.(), []);
  return decision
    ? <ReviewConfirmation submission={submission} current={current} action={decision} notes={decision === "approve" ? notes : rejectionReason} setNotes={decision === "approve" ? setNotes : setRejectionReason} showNotes={decision === "approve" ? showNotes : showRejectionReason} setShowNotes={decision === "approve" ? setShowNotes : setShowRejectionReason} onBack={() => setDecision("")} onClose={onClose} onReview={onReview} />
    : <ReviewDetails submission={submission} current={current} notes={notes} showNotes={showNotes} onClose={onClose} onDecision={setDecision} />;
}

function ReviewDetails({ submission, current, notes, showNotes, onClose, onDecision }) {
  const input = dialogInput, primary = dialogPrimary, secondary = dialogSecondary;
  const pending = submission.status === "Pending verification";
  return <PortalDialog title={pending ? "Review bank details" : "Bank submission"} subtitle={submission.partnerName} icon={<Landmark className="h-5 w-5" />} maxWidth={pending ? "max-w-3xl" : "max-w-xl"} onClose={onClose}>
    <div className="p-6">
    <div className="mt-3"><Badge status={submission.status} /></div>
    {!submission.validOwnership && <p role="alert" className="mt-3 text-sm text-danger">The partner link is inconsistent. Correct it in Airtable before reviewing.</p>}
    <dl className="mt-3">{[["Partner contact", submission.contact], ["Email", submission.email], ...(!pending ? [["Account holder", submission.holder], ["Institution code", submission.institutionCode], ["Institution name", submission.bank], ["Transit number", submission.transitNumber], ["Account number", submission.account], ["Currency", submission.currency]] : []), ["Submitted at", date(submission.submittedAt)], ["Partner Record ID", submission.partnerId], ...(submission.status === "Verified" || submission.approvedAt ? [["Approved at", date(submission.approvedAt)], ["Approved by user ID", submission.approvedByUserId], ["Approved by email", submission.approvedByEmail]] : []), ...(submission.status === "Rejected" || submission.rejectedAt ? [["Rejected at", date(submission.rejectedAt)], ["Rejected by user ID", submission.rejectedByUserId], ["Rejected by email", submission.rejectedByEmail]] : [])].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-gray-100 py-2 text-sm"><dt className="text-gray-500">{label}</dt><dd className="break-words text-right text-gray-900">{value || "—"}</dd></div>)}</dl>
    {pending && <BankComparison submission={submission} current={current} />}
    {submission.comments && <div className="mt-4 rounded-lg bg-gray-50 p-3"><p className="text-xs font-medium text-gray-500">Partner comments</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">{submission.comments}</p></div>}
    {!pending && submission.status !== "Rejected" && <div className="mt-4"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><label htmlFor="bank-review-notes" className="text-xs text-gray-600">Approval reason</label><ReviewVisibility checked={showNotes} disabled /></div><textarea id="bank-review-notes" className={input} rows={3} disabled readOnly value={notes} /></div>}
    {submission.status === "Rejected" && <div className="mt-4"><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><label htmlFor="bank-rejection-reason" className="text-xs text-gray-600">Reason for rejection</label><ReviewVisibility checked={submission.showRejectionReasonToPartner === true} disabled rejection /></div><textarea id="bank-rejection-reason" className={input} rows={3} disabled readOnly value={submission.rejectionReason || ""} /></div>}
    <div className="mt-4 flex flex-wrap justify-end gap-2">{pending ? <><button type="button" className={dialogDanger} disabled={!submission.validOwnership} onClick={() => onDecision("reject")}><XCircle className="h-4 w-4" />Reject</button><button type="button" className={primary} disabled={!submission.validOwnership} onClick={() => onDecision("approve")}><CheckCircle2 className="h-4 w-4" />Approve</button></> : <button type="button" className={secondary} onClick={onClose}>Close</button>}</div>
    </div>
  </PortalDialog>;
}

function ReviewConfirmation({ submission, current, action, notes, setNotes, showNotes, setShowNotes, onBack, onClose, onReview }) {
  const input = dialogInput, primary = dialogPrimary, secondary = dialogSecondary;
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const approving = action === "approve";
  async function confirm(event) {
    event.preventDefault();
    if (submitting.current || (!approving && !notes.trim())) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onReview({ id: submission.id, action, ...(approving ? { reviewNotes: notes.trim(), showReviewNotesToPartner: showNotes } : { rejectionReason: notes.trim(), showRejectionReasonToPartner: showNotes }), expectedModifiedAt: submission.modifiedAt }); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalDialog title={approving ? "Approve bank details?" : "Reject bank details?"} subtitle={`${submission.partnerName} · ${submission.bank} · ${submission.account}`} icon={approving ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />} maxWidth="max-w-3xl" busy={busy} onClose={() => { if (!submitting.current) onClose(); }}>
    <div className="p-6" aria-busy={busy}>
    <p className="mt-4 text-sm text-gray-600">{approving ? current ? `This becomes the current payout account, replacing ${current.bank} · ${current.account}. The previous account stays in history.` : "This becomes the partner's current payout account." : "The submission will be rejected. The current payout account will stay unchanged."}</p>
    <BankComparison submission={submission} current={current} />
    <form onSubmit={confirm} className="mt-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><label htmlFor="bank-confirm-notes" className="text-xs text-gray-600">{approving ? "Approval reason" : "Reason for rejection *"}</label><ReviewVisibility checked={showNotes} onChange={setShowNotes} disabled={busy} rejection={!approving} /></div><textarea id="bank-confirm-notes" required={!approving} disabled={busy} className={input} maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className={secondary} disabled={busy} onClick={onBack}>Back</button><button type="submit" className={approving ? primary : dialogDanger} disabled={busy || (!approving && !notes.trim())}>{busy ? "Saving…" : approving ? "Confirm approval" : "Confirm rejection"}</button></div>
    </form>
    </div>
  </PortalDialog>;
}

export default function BankingApprovals() {
  const { sort, toggleSort, sortRows } = useTableSort({ key: "submittedAt", dir: "asc" });
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Pending verification");
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(null);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    loadBankingReviews(controller.signal).then((rows) => { if (active) { setSubmissions(rows); setLoading(false); setError(""); } })
      .catch((failure) => { if (active) { setError(failure.message); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [attempt]);
  function refresh() { setLoading(true); setError(""); setAttempt((value) => value + 1); }
  async function review(details) {
    await reviewBanking(details);
    setSelected(null);
    setSuccess(details.action === "approve" ? "Bank details approved. The account is now current." : "Bank submission rejected. The current account is unchanged.");
    refresh();
  }
  const filtered = sortRows(submissions.filter((row) => (status === "All statuses" || row.status === status) && [row.partnerName, row.email, row.contact, row.holder, row.bank, row.account, row.partnerId].join(" ").toLowerCase().includes(query.trim().toLowerCase())), { submittedAt: { type: "date" } });
  const pager = usePagination(filtered, [query, status, sort?.key, sort?.dir].join("|"));
  return <div className="max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-end gap-3"><button type="button" className={secondary} disabled={loading} onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</button></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Pending verification", Clock3, "bg-warning-100 text-warning"], ["Verified", ShieldCheck, "bg-success-100 text-success"], ["Rejected", XCircle, "bg-danger-100 text-danger"]].map(([label, Icon, tone]) => <div key={label} className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white p-5"><div><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{loading || error ? "—" : submissions.filter((row) => row.status === label).length}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div>)}</div>
    {success && <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success">{success}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-100 p-3 text-sm text-danger"><p>{error}</p><button type="button" className={secondary} onClick={refresh}>Try again</button></div>}
    <div className="overflow-hidden rounded-xl border border-gray-200/70 bg-white"><div className="flex flex-wrap items-end gap-3 p-4"><SearchFilter id="bank-review-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Partner, bank or account number" /><div className="filter-field"><label htmlFor="bank-review-status" className="mb-1 block text-xs text-gray-500">Submission status</label><select id="bank-review-status" className={`${input} filter-control`} value={status} onChange={(event) => setStatus(event.target.value)}>{["All statuses", ...Object.keys(statuses).sort()].map((value) => <option key={value}>{value}</option>)}</select></div></div>
      <div className="border-b border-gray-100 px-4 pb-4"><ClearFiltersButton onClick={() => { setQuery(""); setStatus("All statuses"); }} /></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-busy={loading}><thead className="text-xs text-gray-400 border-b border-gray-100"><tr>{[["partnerName", "Partner"], ["holder", "Account holder"], ["bank", "Institution"], ["account", "Account number"], ["submittedAt", "Submitted at"], ["status", "Status"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-4 py-3 font-medium" />)}<th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Actions</th></tr></thead><tbody className="text-sm font-normal text-gray-700">{!loading && !error && pager.rows.map((row) => <tr key={row.id} className="border-t border-gray-100"><td className="px-4 py-3"><p className="text-gray-900">{row.partnerName}</p><p className="text-xs text-gray-400">{row.email}</p></td><td className="px-4 py-3">{row.holder}</td><td className="px-4 py-3">{row.bank}</td><td className="px-4 py-3">{row.account}</td><td className="whitespace-nowrap px-4 py-3">{date(row.submittedAt)}</td><td className="px-4 py-3"><Badge status={row.status} />{row.current && <p className="mt-1 text-xs text-accent">Current account</p>}{!row.validOwnership && <p className="mt-1 text-xs text-danger">Check partner link</p>}</td><td className="px-4 py-3"><ActionButton className={`inline-flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent text-gray-500 hover:text-accent`} label={`${row.status === "Pending verification" ? "Review" : "View"} bank details for ${row.partnerName}`} tooltip={row.status === "Pending verification" ? "Review bank details" : "View bank details"} onClick={() => setSelected(row)}>{row.status === "Pending verification" ? <ClipboardCheck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</ActionButton></td></tr>)}{(loading || error || !filtered.length) && <tr><td colSpan={7} className="px-5 py-14 text-center text-gray-500"><Landmark className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p role={loading ? "status" : undefined}>{loading ? "Loading bank submissions…" : error ? "Bank submissions unavailable" : submissions.length ? "No matching submissions" : "No bank submissions yet"}</p><p className="mt-1 text-xs">{loading ? "Please wait." : error ? "Try refreshing the list." : submissions.length ? "Try another search or change the filters." : "Submissions from partners will appear here."}</p></td></tr>}</tbody></table></div>
      <TablePager pager={pager} noun="submissions" overall={submissions.length} />
    </div>
    {selected && <ReviewDialog key={selected.id} submission={selected} current={submissions.find((row) => row.partnerId === selected.partnerId && row.current && row.status === "Verified")} onClose={() => setSelected(null)} onReview={review} />}
  </div>;
}