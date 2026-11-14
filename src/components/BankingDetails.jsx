import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Eye, History, Landmark, X } from "lucide-react";
import ActionButton from "./ActionButton";
import { loadBanking, submitBanking } from "../lib/banking";

const card = "rounded-xl border border-gray-200/70 bg-white p-5";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const field = "w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const label = "mb-1 block text-xs text-gray-600";
const blank = () => ({ submissionId: crypto.randomUUID(), bank: "", holder: "", account: "", institutionCode: "", transitNumber: "", currency: "CAD" });
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
const styles = { Verified: "bg-success-100 text-success", "Pending verification": "bg-warning-100 text-gray-800", Rejected: "bg-danger-100 text-danger" };
const demoAccount = { id: "demo", bank: "RBC Royal Bank", holder: "ABC Accounting Inc.", account: "12344821", last4: "4821", currency: "CAD", status: "Verified", current: true, submittedAt: "", reviewNotes: "" };

function Status({ status }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
function Account({ account }) {
  return <dl className="mt-3">{[["Account holder", account.holder], ["Institution code", account.institutionCode], ["Institution name", account.bank], ["Transit number", account.transitNumber], ["Account number", account.account || "—"], ["Currency", account.currency]].map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm"><dt className="text-gray-500">{key}</dt><dd className="text-right text-gray-900 break-words min-w-0">{value || "—"}</dd></div>)}</dl>;
}

function AccountHistoryDetails({ account, isCurrent, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="account-history-title" onCancel={onClose} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-start justify-between gap-3"><h2 id="account-history-title" className="text-lg font-semibold">Bank submission details</h2><button type="button" aria-label="Close bank submission details" onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Status status={account.status} />{isCurrent && <span className="text-xs text-accent">Current account</span>}</div>
    <Account account={account} />
    <dl className="mt-3">{[["Submitted", account.submittedAt], ["Last modified", account.modifiedAt]].map(([key, value]) => <div key={key} className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm"><dt className="text-gray-500">{key}</dt><dd className="text-right text-gray-900">{date(value)}</dd></div>)}</dl>
    {account.reviewNotes && <div className="mt-4 rounded-lg bg-gray-50 p-3"><p className="text-xs font-medium text-gray-500">{account.status === "Rejected" ? "Reason for rejection" : "Review notes"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-700">{account.reviewNotes}</p></div>}
    <div className="mt-5 flex justify-end"><button type="button" className={secondary} onClick={onClose}>Close</button></div>
  </dialog>;
}

function BankDetailsDialog({ title, saving, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  return <dialog ref={dialog} aria-labelledby="bank-details-title" aria-describedby="bank-details-description"
    onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-center justify-between gap-3"><h2 id="bank-details-title" className="text-lg font-semibold">{title}</h2><button type="button" aria-label="Close bank details form" disabled={saving} onClick={onClose} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-50"><X className="h-5 w-5" /></button></div>
    <p id="bank-details-description" className="mt-2 text-sm text-gray-500">Enter the complete details. Previous submissions are kept in your account history.</p>
    {children}
  </dialog>;
}

export default function BankingDetails({ authenticated = false }) {
  const [data, setData] = useState({ accounts: authenticated ? [] : [demoAccount], currentAccount: authenticated ? null : demoAccount, currentIssue: false });
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState(false);
  const [viewId, setViewId] = useState(null);
  const submitting = useRef(false);
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    let active = true;
    loadBanking(controller.signal).then((result) => { if (active) { setData(result); setError(""); setLoading(false); } })
      .catch((failure) => { if (active) { setError(failure.message); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [authenticated, attempt]);
  const latest = data.accounts[0];
  const current = data.currentAccount;
  const viewed = data.accounts.find((account) => account.id === viewId);
  const valid = form.bank.trim() && form.holder.trim() && /^\d{4,34}$/.test(form.account) && /^\d{3}$/.test(form.institutionCode) && /^\d{5}$/.test(form.transitNumber);
  function begin() {
    const previous = latest || current;
    setForm({ ...blank(), bank: previous?.bank || "", holder: previous?.holder || "", account: previous?.account || "", institutionCode: previous?.institutionCode || "", transitNumber: previous?.transitNumber || "" });
    setSaveError(""); setSaved(false); setEdit(true);
  }
  function closeEdit() {
    if (submitting.current) return;
    setForm(blank()); setSaveError(""); setEdit(false);
  }
  function refresh() { setLoading(true); setError(""); setAttempt((value) => value + 1); }
  function change(key, value) {
    // A changed payload is a new submission; an unchanged failed request keeps its retry ID.
    setForm((previous) => ({ ...previous, submissionId: crypto.randomUUID(), [key]: value }));
  }
  async function save(event) {
    event.preventDefault();
    if (!valid || submitting.current) return;
    submitting.current = true; setSaving(true); setSaveError("");
    try {
      const input = { submissionId: form.submissionId, bank: form.bank.trim(), holder: form.holder.trim(), account: form.account, institutionCode: form.institutionCode, transitNumber: form.transitNumber, currency: form.currency };
      const account = authenticated ? await submitBanking(input) : { id: input.submissionId, bank: input.bank, holder: input.holder, account: input.account, institutionCode: form.institutionCode, transitNumber: form.transitNumber, last4: input.account.slice(-4), currency: "CAD", status: "Pending verification", current: false, submittedAt: new Date().toISOString(), reviewNotes: "" };
      setData((previous) => ({ ...previous, accounts: [account, ...previous.accounts.filter((item) => item.id !== account.id)] }));
      setForm(blank()); setEdit(false); setSaved(true);
    } catch (failure) { setSaveError(failure.message); }
    finally { submitting.current = false; setSaving(false); }
  }
  return <div className="flex max-w-3xl flex-col gap-4">
    {!loading && !error && <div className="flex justify-end"><button type="button" onClick={begin} disabled={edit} className={primary}>{latest || current ? "Update bank details" : "Add bank details"}</button></div>}
    <section className={card} aria-label="Payout account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-gray-900">Payout account</h2><p className="mt-1 text-sm text-gray-500">Manage where PulseFX sends your partner payouts.</p></div>
      </div>
      {loading ? <p role="status" className="mt-5 text-sm text-gray-500">Loading banking details…</p> : error ? <div role="alert" className="mt-4 text-sm text-danger"><p>{error}</p><button type="button" onClick={refresh} className={`${secondary} mt-3`}>Try again</button></div> : <>
        {data.currentIssue && <p role="alert" className="mt-4 rounded-lg bg-warning-100 p-3 text-sm text-gray-800">PulseFX needs to review which verified account is current. Please contact your partner manager.</p>}
        {current ? <div className="mt-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-gray-900">Current account</h3><Status status="Verified" /></div><Account account={current} /></div> : !data.currentIssue && <div className="mt-5 rounded-lg bg-gray-50 p-4"><Landmark className="mb-2 h-5 w-5 text-gray-400" /><p className="text-sm font-medium text-gray-700">No verified payout account yet</p><p className="mt-1 text-xs text-gray-500">{data.accounts.length ? "View submitted details and review notes in Account change history." : "Submit your bank details for PulseFX to review."}</p></div>}
        {saved && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4 shrink-0" />{authenticated ? "Bank details submitted for verification." : "Bank details updated in this preview only."}</p>}


      </>}
    </section>
    <section className={card} aria-label="Account change history">
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={history} aria-controls="account-change-history" onClick={() => setHistory((value) => !value)}><span><span className="flex items-center gap-2 text-base font-semibold text-gray-900"><History className="h-4 w-4" />Account change history{!loading && !error ? ` (${data.accounts.length})` : ""}</span><span className="mt-1 block text-sm text-gray-500">View submitted bank details and review notes.</span></span><ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${history ? "rotate-180" : ""}`} /></button>
      <div id="account-change-history" hidden={!history}>
        {history && (loading ? <p role="status" className="mt-4 text-sm text-gray-500">Loading account history…</p> : error ? <p className="mt-4 text-sm text-gray-500">Account history is unavailable. Try loading your banking details again.</p> : data.accounts.length ? <ul className="mt-3 space-y-3">{data.accounts.map((account) => <li key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"><div className="min-w-0 flex-1"><p className="break-words text-sm text-gray-900">{account.bank} · {account.account || "—"}{account.id === current?.id ? " · Current account" : ""}</p><p className="mt-1 text-xs text-gray-500">{date(account.submittedAt)}</p>{account.reviewNotes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-600"><span className="font-medium">{account.status === "Rejected" ? "Reason for rejection: " : "Review notes: "}</span>{account.reviewNotes}</p>}</div><div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><Status status={account.status} /><ActionButton label={`View bank details from ${date(account.submittedAt)}`} tooltip="View bank details" className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-blue-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setViewId(account.id)}><Eye className="h-4 w-4" /></ActionButton></div></li>)}</ul> : <p className="mt-4 text-sm text-gray-500">No bank submissions yet.</p>)}
      </div>
    </section>
    {edit && <BankDetailsDialog title={latest || current ? "Update bank details" : "Add bank details"} saving={saving} onClose={closeEdit}>
      <form onSubmit={save} aria-label="Update bank details" aria-busy={saving} className="mt-5">
          <fieldset disabled={saving} className="flex flex-col gap-3">
            <div className="w-full max-w-md"><label htmlFor="bk-h" className={label}>Account holder *</label><input id="bk-h" required maxLength={200} className={field} value={form.holder} onChange={(e) => change("holder", e.target.value)} autoFocus /></div>
            <div className="grid w-full max-w-xl grid-cols-[120px_minmax(0,1fr)] gap-3">
              <div><label htmlFor="bk-i" className={label}>Institution code *</label><input id="bk-i" required inputMode="numeric" autoComplete="off" minLength={3} maxLength={3} className={field} value={form.institutionCode} onChange={(e) => change("institutionCode", e.target.value.replace(/\D/g, ""))} /></div>
              <div><label htmlFor="bk-b" className={label}>Institution name *</label><input id="bk-b" required maxLength={200} className={field} value={form.bank} onChange={(e) => change("bank", e.target.value)} /></div>
            </div>
            <div className="grid w-full max-w-xl grid-cols-[120px_minmax(0,1fr)] gap-3">
              <div><label htmlFor="bk-t" className={label}>Transit number *</label><input id="bk-t" required inputMode="numeric" autoComplete="off" minLength={5} maxLength={5} className={field} value={form.transitNumber} onChange={(e) => change("transitNumber", e.target.value.replace(/\D/g, ""))} /></div>
              <div><label htmlFor="bk-a" className={label}>Account number *</label><input id="bk-a" required inputMode="numeric" autoComplete="off" minLength={4} maxLength={34} className={field} value={form.account} onChange={(e) => change("account", e.target.value.replace(/\D/g, ""))} /></div>
            </div>
            <p className="text-xs text-gray-500">Payout currency: CAD</p>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" disabled={saving} className={secondary} onClick={closeEdit}>Cancel</button><button type="submit" disabled={!valid || saving} className={primary}>{saving ? "Submitting…" : "Submit for verification"}</button></div>
          </fieldset>
          {saveError && <p role="alert" className="mt-3 text-sm text-danger">{saveError}</p>}
        </form>
    </BankDetailsDialog>}
    {viewed && <AccountHistoryDetails key={viewed.id} account={viewed} isCurrent={viewed.id === current?.id} onClose={() => setViewId(null)} />}
  </div>;
}
