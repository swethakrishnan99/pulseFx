import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Eye, RefreshCw, Search, ShieldCheck, X, XCircle } from "lucide-react";
import ActionButton from "./ActionButton";
import { loadBankingReviews, reviewBanking } from "../lib/banking";

const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
const statuses = { "Pending verification": "bg-warning-100 text-gray-800", Verified: "bg-success-100 text-success", Rejected: "bg-danger-100 text-danger" };
function Badge({ status }) { return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statuses[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>; }

function useModal() {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  return dialog;
}

function ReviewDialog({ submission, current, onClose, onReview }) {
  const [decision, setDecision] = useState("");
  const [notes, setNotes] = useState(submission.reviewNotes);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => () => previousFocus.current?.focus?.(), []);
  return decision
    ? <ReviewConfirmation submission={submission} current={current} action={decision} notes={notes} setNotes={setNotes} onBack={() => setDecision("")} onClose={onClose} onReview={onReview} />
    : <ReviewDetails submission={submission} notes={notes} setNotes={setNotes} onClose={onClose} onDecision={setDecision} />;
}

function ReviewDetails({ submission, notes, setNotes, onClose, onDecision }) {
  const dialog = useModal();
  const pending = submission.status === "Pending verification";
  return <dialog ref={dialog} aria-labelledby="bank-review-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50" onCancel={onClose}>
    <div className="flex items-start justify-between gap-3"><div><h2 id="bank-review-title" className="text-lg font-semibold">{pending ? "Review bank details" : "Bank submission"}</h2><p className="mt-1 text-sm text-gray-600">{submission.partnerName}</p></div><button type="button" aria-label="Close bank review" onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="mt-3"><Badge status={submission.status} /></div>
    {!submission.validOwnership && <p role="alert" className="mt-3 text-sm text-danger">The partner link is inconsistent. Correct it in Airtable before reviewing.</p>}
    <dl className="mt-3">{[["Partner contact", submission.contact], ["Email", submission.email], ["Account holder", submission.holder], ["Institution code", submission.institutionCode], ["Institution name", submission.bank], ["Transit number", submission.transitNumber], ["Account number", submission.account], ["Currency", submission.currency], ["Submitted", date(submission.submittedAt)], ["Partner Record ID", submission.partnerId]].map(([label, value]) => <div key={label} className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-gray-100 py-2 text-sm"><dt className="text-gray-500">{label}</dt><dd className="break-words text-right text-gray-900">{value || "—"}</dd></div>)}</dl>
    <div className="mt-4"><label htmlFor="bank-review-notes" className="mb-1 block text-xs text-gray-600">Review notes <span className="font-normal text-gray-500">(Visible to the partner)</span></label><textarea id="bank-review-notes" className={input} maxLength={2000} rows={3} disabled={!pending} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
    <div className="mt-4 flex flex-wrap justify-end gap-2">{pending ? <><button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed" disabled={!submission.validOwnership} onClick={() => onDecision("reject")}><XCircle className="h-4 w-4" />Reject</button><button type="button" className={primary} disabled={!submission.validOwnership} onClick={() => onDecision("approve")}><CheckCircle2 className="h-4 w-4" />Approve</button></> : <button type="button" className={secondary} onClick={onClose}>Close</button>}</div>
  </dialog>;
}

function ReviewConfirmation({ submission, current, action, notes, setNotes, onBack, onClose, onReview }) {
  const dialog = useModal(), submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const approving = action === "approve";
  async function confirm(event) {
    event.preventDefault();
    if (submitting.current || (!approving && !notes.trim())) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onReview({ id: submission.id, action, reviewNotes: notes.trim(), expectedModifiedAt: submission.modifiedAt }); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="bank-confirm-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-navy/50" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}>
    <div className="flex items-start justify-between gap-3"><span className={`rounded-full p-3 ${approving ? "bg-success-100 text-success" : "bg-danger-100 text-danger"}`}>{approving ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}</span><button type="button" aria-label="Close confirmation" disabled={busy} onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <h2 id="bank-confirm-title" className="mt-4 text-lg font-semibold">{approving ? "Approve bank details?" : "Reject bank details?"}</h2>
    <p className="mt-2 text-sm font-medium">{submission.partnerName}</p><p className="mt-1 break-words text-sm text-gray-600">{submission.bank} · {submission.account}</p>
    <p className="mt-4 text-sm text-gray-600">{approving ? current ? `This becomes the current payout account, replacing ${current.bank} · ${current.account}. The previous account stays in history.` : "This becomes the partner's current payout account." : "The submission will be rejected. The current payout account will stay unchanged."}</p>
    <form onSubmit={confirm} className="mt-4">
      <label htmlFor="bank-confirm-notes" className="mb-1 block text-xs text-gray-600">{approving ? "Review notes" : "Reason for rejection *"} <span className="font-normal text-gray-500">(Visible to the partner)</span></label><textarea id="bank-confirm-notes" required={!approving} disabled={busy} className={input} maxLength={2000} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className={secondary} disabled={busy} onClick={onBack}>Back</button><button type="submit" className={approving ? primary : "rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"} disabled={busy || (!approving && !notes.trim())}>{busy ? "Saving…" : approving ? "Confirm approval" : "Confirm rejection"}</button></div>
    </form>
  </dialog>;
}

export default function BankingApprovals() {
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
  const filtered = submissions.filter((row) => (status === "All statuses" || row.status === status) && [row.partnerName, row.email, row.contact, row.holder, row.bank, row.partnerId].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-gray-900">Bank submissions</h2><p className="mt-1 text-sm text-gray-500">Review partner bank changes and manage the current payout account.</p></div><button type="button" className={secondary} disabled={loading} onClick={refresh}><RefreshCw className="h-4 w-4" />Refresh</button></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[["Pending verification", Clock3], ["Verified", ShieldCheck], ["Rejected", XCircle]].map(([label, Icon]) => <div key={label} className="flex items-center justify-between rounded-xl border border-gray-200/70 bg-white p-5"><div><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{loading || error ? "—" : submissions.filter((row) => row.status === label).length}</p></div><Icon className="h-6 w-6 text-accent" /></div>)}</div>
    {success && <p role="status" className="rounded-lg bg-success-100 p-3 text-sm text-success">{success}</p>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-100 p-3 text-sm text-danger"><p>{error}</p><button type="button" className={secondary} onClick={refresh}>Try again</button></div>}
    <div className="overflow-hidden rounded-xl border border-gray-200/70 bg-white"><div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[1fr_200px]"><div><label htmlFor="bank-review-search" className="mb-1 block text-xs text-gray-500">Search partner, contact or institution</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input id="bank-review-search" className={`${input} pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div><label htmlFor="bank-review-status" className="mb-1 block text-xs text-gray-500">Submission status</label><select id="bank-review-status" className={input} value={status} onChange={(event) => setStatus(event.target.value)}>{["All statuses", "Pending verification", "Verified", "Rejected"].map((value) => <option key={value}>{value}</option>)}</select></div></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-busy={loading}><thead className="bg-gray-50 text-xs text-gray-500"><tr>{["Partner", "Account holder", "Institution", "Account number", "Submitted", "Status", "Actions"].map((label) => <th key={label} className="whitespace-nowrap px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="text-sm font-normal text-gray-700">{!loading && !error && filtered.map((row) => <tr key={row.id} className="border-t border-gray-100"><td className="px-4 py-3"><p className="text-gray-900">{row.partnerName}</p><p className="text-sm text-gray-500">{row.email}</p></td><td className="px-4 py-3">{row.holder}</td><td className="px-4 py-3">{row.bank}</td><td className="px-4 py-3">{row.account}</td><td className="whitespace-nowrap px-4 py-3">{date(row.submittedAt)}</td><td className="px-4 py-3"><Badge status={row.status} />{row.current && <p className="mt-1 text-xs text-accent">Current account</p>}{!row.validOwnership && <p className="mt-1 text-xs text-danger">Check partner link</p>}</td><td className="px-4 py-3"><ActionButton className={`inline-flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${row.status === "Pending verification" ? "text-accent" : "text-blue-600"}`} label={`${row.status === "Pending verification" ? "Review" : "View"} bank details for ${row.partnerName}`} tooltip={row.status === "Pending verification" ? "Review bank details" : "View bank details"} onClick={() => setSelected(row)}>{row.status === "Pending verification" ? <ClipboardCheck className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</ActionButton></td></tr>)}{(loading || error || !filtered.length) && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">{loading ? "Loading bank submissions…" : error ? "Bank submissions unavailable." : "No matching submissions."}</td></tr>}</tbody></table></div>
    </div>
    {selected && <ReviewDialog key={selected.id} submission={selected} current={submissions.find((row) => row.partnerId === selected.partnerId && row.current && row.status === "Verified")} onClose={() => setSelected(null)} onReview={review} />}
  </div>;
}
