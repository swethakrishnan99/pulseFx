import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Download, Eye, History, Landmark, RefreshCw, X } from "lucide-react";
import ActionButton from "./ActionButton";
import { loadBanking, loadPayouts, submitBanking } from "../lib/banking";

const card = "rounded-xl border border-gray-200/70 bg-white p-5";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const field = "w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const label = "mb-1 block text-xs text-gray-600";
const exportButton = "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
const blank = () => ({ submissionId: crypto.randomUUID(), bank: "", holder: "", account: "", institutionCode: "", transitNumber: "", currency: "CAD" });
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
const styles = { Verified: "bg-success-100 text-success", "Pending verification": "bg-warning-100 text-gray-800", Rejected: "bg-danger-100 text-danger", Paid: "bg-success-100 text-success", Pending: "bg-warning-100 text-gray-800", Failed: "bg-danger-100 text-danger", Cancelled: "bg-gray-100 text-gray-600" };
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
    <section className={card} aria-label="Payout account">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-base font-semibold text-gray-900">Payout account</h2><p className="mt-1 text-sm text-gray-500">Manage where PulseFX sends your partner payouts.</p></div>
        {authenticated && <button type="button" className={secondary} onClick={refresh} disabled={loading || saving}><RefreshCw className="h-4 w-4" />Refresh</button>}
      </div>
      {loading ? <p role="status" className="mt-5 text-sm text-gray-500">Loading banking details…</p> : error ? <div role="alert" className="mt-4 text-sm text-danger"><p>{error}</p><button type="button" onClick={refresh} className={`${secondary} mt-3`}>Try again</button></div> : <>
        {data.currentIssue && <p role="alert" className="mt-4 rounded-lg bg-warning-100 p-3 text-sm text-gray-800">PulseFX needs to review which verified account is current. Please contact your partner manager.</p>}
        {current ? <div className="mt-4"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium text-gray-900">Current account</h3><Status status="Verified" /></div><Account account={current} /></div> : !data.currentIssue && <div className="mt-5 rounded-lg bg-gray-50 p-4"><Landmark className="mb-2 h-5 w-5 text-gray-400" /><p className="text-sm font-medium text-gray-700">No verified payout account yet</p><p className="mt-1 text-xs text-gray-500">{data.accounts.length ? "View submitted details and review notes in Account change history." : "Submit your bank details for PulseFX to review."}</p></div>}
        {saved && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4 shrink-0" />{authenticated ? "Bank details submitted for verification." : "Bank details updated in this preview only."}</p>}
        {!edit && <button type="button" onClick={begin} className={`${primary} mt-4`}>{latest || current ? "Update bank details" : "Add bank details"}</button>}
        {edit && <form onSubmit={save} aria-label="Update bank details" aria-busy={saving} className="mt-5 border-t border-gray-200 pt-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">{latest ? "Submit new bank details" : "Add bank details"}</h3><p className="mb-4 text-xs text-gray-500">Enter the complete details. Previous submissions are kept in your account history.</p>
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
            <div className="flex flex-wrap gap-2"><button type="submit" disabled={!valid || saving} className={primary}>{saving ? "Submitting…" : "Submit for verification"}</button><button type="button" className={secondary} onClick={() => { setForm(blank()); setSaveError(""); setEdit(false); }}>Cancel</button></div>
          </fieldset>
          {saveError && <p role="alert" className="mt-3 text-sm text-danger">{saveError}</p>}
        </form>}
        {data.accounts.length > 0 && <details className="mt-5 border-t border-gray-100 pt-4"><summary className="cursor-pointer text-sm font-medium text-gray-700">Account change history ({data.accounts.length})</summary><ul className="mt-3 space-y-3">{data.accounts.map((account) => <li key={account.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 p-3"><div className="min-w-0 flex-1"><p className="break-words text-sm text-gray-900">{account.bank} · {account.account || "—"}{account.id === current?.id ? " · Current account" : ""}</p><p className="mt-1 text-xs text-gray-500">{date(account.submittedAt)}</p>{account.reviewNotes && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-600"><span className="font-medium">{account.status === "Rejected" ? "Reason for rejection: " : "Review notes: "}</span>{account.reviewNotes}</p>}</div><div className="flex shrink-0 flex-wrap items-center justify-end gap-2"><Status status={account.status} /><ActionButton label={`View bank details from ${date(account.submittedAt)}`} tooltip="View bank details" className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-blue-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setViewId(account.id)}><Eye className="h-4 w-4" /></ActionButton></div></li>)}</ul></details>}
      </>}
    </section>
    <section className={card}>
      <button type="button" className="flex w-full items-center justify-between gap-3 text-left" aria-expanded={history} aria-controls="payout-history" onClick={() => setHistory((value) => !value)}><span><span className="flex items-center gap-2 text-base font-semibold text-gray-900"><History className="h-4 w-4" />Payout history</span><span className="mt-1 block text-sm text-gray-500">View your payouts and download the history.</span></span><ChevronDown className={`h-5 w-5 shrink-0 text-gray-500 transition-transform ${history ? "rotate-180" : ""}`} /></button>
      <div id="payout-history" hidden={!history}>{history && <PayoutHistory authenticated={authenticated} />}</div>
    </section>
    {viewed && <AccountHistoryDetails key={viewed.id} account={viewed} isCurrent={viewed.id === current?.id} onClose={() => setViewId(null)} />}
  </div>;
}

function PayoutHistory({ authenticated }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const controller = new AbortController();
    loadPayouts(controller.signal).then((payouts) => { if (active) { setRows(payouts); setLoading(false); setError(""); } })
      .catch((failure) => { if (active) { setError(failure.message); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [authenticated, attempt]);
  const money = (amount, currency = "CAD") => typeof amount === "number" ? amount.toLocaleString("en-CA", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "CAD" }) : "—";
  const total = rows.filter((row) => row.status === "Paid" && row.currency === "CAD").reduce((sum, row) => sum + (row.amount ?? 0), 0);
  function download() {
    const cell = (value) => { let text = String(value ?? ""); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const csv = [["Reference", "Paid at", "Client", "Amount", "Currency", "Status", "Notes"], ...rows.map((row) => [row.ref, row.date, row.client, row.amount, row.currency, row.status, row.notes])].map((row) => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "payout-history.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <div className="mt-4 border-t border-gray-100 pt-4" aria-label="Payout history records" role="region">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600">Total paid (CAD): {money(total)}</p><button type="button" className={exportButton} disabled={loading || !!error || rows.length === 0} onClick={download}><Download className="h-3.5 w-3.5" />Download</button></div>
    {loading ? <p role="status" className="mt-4 text-sm text-gray-500">Loading payouts…</p> : error ? <div role="alert" className="mt-4 text-sm text-danger"><p>{error}</p><button type="button" className={`${secondary} mt-2`} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Try again</button></div> : !rows.length ? <p className="mt-4 text-sm text-gray-500">{authenticated ? "No payouts yet." : "No payouts in this preview."}</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500">{["Reference", "Paid at", "Client", "Amount", "Status"].map((name) => <th key={name} className="px-2 py-2 font-medium">{name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-gray-50"><td className="px-2 py-3">{row.ref}</td><td className="whitespace-nowrap px-2 py-3">{date(row.date)}</td><td className="px-2 py-3">{row.client || "—"}</td><td className="whitespace-nowrap px-2 py-3">{money(row.amount, row.currency)}</td><td className="px-2 py-3"><Status status={row.status} /></td></tr>)}</tbody></table></div>}
  </div>;
}
