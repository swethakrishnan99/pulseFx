import SortableHeader from "./SortableHeader";
import TablePager from "./TablePager";
import { usePagination } from "../lib/usePagination";
import useTableSort from "../lib/useTableSort";
import ClearFiltersButton from "./ClearFiltersButton";
import { useEffect, useRef, useState } from "react";
import { Ban, CheckCircle2, DollarSign, Download, Eye, Landmark, Pencil, Plus, RefreshCw, Search, X } from "lucide-react";
import ActionButton from "./ActionButton";
import SearchableSelect from "./SearchableSelect";
import { loadAdminPayouts, loadPayoutReferrals, saveAdminPayout } from "../lib/payouts";

const primary = "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100 disabled:bg-gray-50 disabled:text-gray-500";
const iconButton = "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const statuses = ["Pending", "Paid", "Failed", "Cancelled"];
const styles = { Paid: "bg-success-100 text-success", Pending: "bg-warning-100 text-amber-800", Failed: "bg-danger-100 text-danger", Cancelled: "bg-danger-100 text-danger" };
const money = (value, currency = "CAD") => typeof value === "number" ? value.toLocaleString("en-CA", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "CAD" }) : "—";
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const localDate = (value) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parsed = new Date(value);
  return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const day = (value) => localDate(value).slice(0, 10);
const creationDate = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "long" }).format(new Date(value)) : "—";
const snapshot = (row) => ({ ref: row.ref, partnerId: row.partnerId, client: row.client, amount: row.amount, currency: row.currency, status: row.status, date: row.date, notes: row.notes, showNotesToClient: row.showNotesToClient === true, lastEditedAt: row.lastEditedAt || "", lastEditedByEmail: row.lastEditedByEmail || "", lastEditedByUserId: row.lastEditedByUserId || "" });
function ClientCell({ value }) {
  if (!value) return "—";
  const [name, ...rest] = String(value).split(" | ");
  return <>{name}{rest.length > 0 && <span className="block text-[11px] text-gray-400">{rest.join(" | ")}</span>}</>;
}
function Status({ value }) { return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs ${styles[value] || "bg-gray-100 text-gray-600"}`}>{value}</span>; }

function PayoutDialog({ mode, payout, partners, onClose, onSave }) {
  const dialog = useRef(null), submitting = useRef(false), requestId = useRef(crypto.randomUUID());
  const [referrals, setReferrals] = useState({ partnerId: "", rows: [], error: "", loading: false });
  const [referralAttempt, setReferralAttempt] = useState(0);
  const [showCancellationReasonToClient, setShowCancellationReasonToClient] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [form, setForm] = useState(() => ({
    ref: payout?.ref || `PAY-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    partnerId: payout?.partnerId || "", clientId: "", client: payout?.client || "", amount: payout?.amount == null ? "" : String(payout.amount),
    status: payout?.status || "Pending", date: localDate(payout?.date), notes: payout?.notes || "", showNotesToClient: payout?.showNotesToClient === true,
  }));
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const viewing = mode === "view", cancelling = mode === "cancel", editing = mode === "edit";
  const partner = partners.find((item) => item.id === form.partnerId);
  const partnerOptions = partners.map((item) => ({ value: item.id, label: `${item.name} | ${item.email}${item.disabled ? " (deactivated)" : ""}` }));
  const currentReferrals = referrals.partnerId === form.partnerId ? referrals.rows : [];
  const clientOptions = currentReferrals.map((item) => ({ value: item.id, label: `${item.company} | ${item.email}` }));
  const selectedClientId = form.clientId || clientOptions.find((item) => item.label === form.client)?.value || "";
  const clientsLoading = !!form.partnerId && (referrals.partnerId !== form.partnerId || referrals.loading);
  const clientError = referrals.partnerId === form.partnerId ? referrals.error : "";
  useEffect(() => {
    if (!form.partnerId || viewing || cancelling) return;
    const controller = new AbortController();
    const partnerId = form.partnerId;
    loadPayoutReferrals(partnerId, controller.signal).then((rows) => {
      if (!controller.signal.aborted) setReferrals({ partnerId, rows, error: "", loading: false });
    }).catch((failure) => {
      if (!controller.signal.aborted) setReferrals({ partnerId, rows: [], error: failure.message, loading: false });
    });
    return () => controller.abort();
  }, [form.partnerId, viewing, cancelling, referralAttempt]);
  const valid = /^[A-Za-z0-9][A-Za-z0-9 _./-]{0,79}$/.test(form.ref.trim()) && partner && (!form.client || selectedClientId || (editing && form.client === payout.client)) && /^\d{1,9}(\.\d{1,2})?$/.test(form.amount) && Number(form.amount) > 0 && (form.status !== "Paid" || (form.date && partner.bank?.submissionId));
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  function change(key, value) {
    if (submitting.current) return;
    requestId.current = crypto.randomUUID();
    setForm((previous) => ({ ...previous, [key]: value, ...(key === "partnerId" ? { clientId: "", client: "" } : {}), ...(key === "status" ? { date: value === "Paid" ? previous.date || localDate(new Date().toISOString()) : "" } : {}) }));
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || (!cancelling && !valid)) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const payload = cancelling ? { action: "cancel", id: payout.id, expected: snapshot(payout), cancellationReason: cancellationReason.trim(), showCancellationReasonToClient } : {
        action: editing ? "edit" : "create", ...(editing ? { id: payout.id, expected: snapshot(payout) } : {}),
        ref: form.ref.trim(), partnerId: form.partnerId, clientId: selectedClientId, client: form.client.trim(), amount: form.amount,
        submissionId: form.status === "Paid" ? partner?.bank?.submissionId || "" : "",
        status: form.status, date: form.status === "Paid" ? new Date(form.date).toISOString() : "", notes: form.notes.trim(), showNotesToClient: form.showNotesToClient,
      };
      const saved = await saveAdminPayout({ ...payload, requestId: requestId.current });
      onSave(saved);
    } catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  const title = viewing ? "Payout details" : cancelling ? "Cancel payout?" : editing ? "Edit payout" : "Add payout";
  return <dialog ref={dialog} aria-labelledby="payout-dialog-title" onCancel={(event) => { event.preventDefault(); if (!submitting.current) onClose(); }}
    className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-center justify-between gap-3"><h2 id="payout-dialog-title" className="flex items-center gap-2 text-lg font-semibold">{title}</h2><button type="button" aria-label="Close payout" disabled={busy} onClick={onClose} className={iconButton}><X className="h-5 w-5" /></button></div>
    {viewing ? <>
      <dl className="mt-4 divide-y divide-gray-100">{[["Reference", payout.ref], ["Partner", payout.partnerName], ["Client", payout.client], ["Amount (CAD)", money(payout.amount, payout.currency)], ["Status", payout.status], ["Paid at", date(payout.date)], ...(payout.bank ? [["Paid to account holder", payout.bank.holder], ["Paid to institution", payout.bank.name], ["Paid to account number", payout.bank.account], ["Institution code", payout.bank.institutionCode], ["Transit number", payout.bank.transitNumber], ["Account currency", payout.bank.currency]] : []), ["Created at", creationDate(payout.createdAt)], ["Created by user ID", payout.createdByUserId], ["Created by email", payout.createdByEmail], ["Last edited at", creationDate(payout.lastEditedAt)], ["Last edited by email", payout.lastEditedByEmail], ["Last edited by user ID", payout.lastEditedByUserId], ...(payout.status === "Cancelled" || payout.cancelledAt ? [["Cancelled at", creationDate(payout.cancelledAt)], ["Cancelled by email", payout.cancelledByEmail], ["Cancelled by user ID", payout.cancelledByUserId]] : []), ["Notes", payout.notes], ["Notes visible to partner", payout.showNotesToClient ? "Yes" : "No"], ...(payout.status === "Cancelled" || payout.cancelledAt ? [["Cancellation reason", payout.cancellationReason], ["Cancellation reason visible to partner", payout.showCancellationReasonToClient ? "Yes" : "No"]] : [])].map(([label, value]) => <div key={label} className="py-3"><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value || "—"}</dd></div>)}</dl>
      {!payout.validOwnership && <p className="mt-3 text-sm text-danger">The partner link is inconsistent. Correct it before editing this payout.</p>}
      <div className="mt-4 flex justify-end"><button type="button" className={secondary} onClick={onClose}>Close</button></div>
    </> : <form onSubmit={submit} aria-busy={busy} className="mt-4 space-y-4">
      {cancelling ? <><p className="text-sm text-gray-600">This payout will be marked Cancelled and kept in the partner’s history.</p><div className="rounded-lg bg-gray-50 p-3 text-sm"><p className="font-medium">{payout.ref} · {payout.partnerName}</p><p className="mt-1 text-gray-600">{money(payout.amount, payout.currency)} CAD</p></div><div><div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label htmlFor="payout-cancellation-reason" className="text-xs font-medium">Cancellation reason (optional)</label><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" disabled={busy} checked={showCancellationReasonToClient} onChange={event => { if (submitting.current) return; requestId.current = crypto.randomUUID(); setShowCancellationReasonToClient(event.target.checked); }} className="accent-accent" />Show cancellation reason to partner</label></div><textarea id="payout-cancellation-reason" rows={3} maxLength={2000} disabled={busy} value={cancellationReason} onChange={(event) => { if (submitting.current) return; requestId.current = crypto.randomUUID(); setCancellationReason(event.target.value); }} className={input} /></div></> : <fieldset disabled={busy} className="space-y-4">
        <div><label htmlFor="payout-ref" className="mb-1.5 block text-xs font-medium">Reference *</label><input id="payout-ref" value={form.ref} readOnly aria-readonly="true" className={`${input} bg-gray-50 text-gray-500`} /><p className="mt-1 text-xs text-gray-500">Reference generated automatically.</p></div>
        <SearchableSelect id="payout-partner" label="Partner *" value={form.partnerId} options={partnerOptions} onChange={(value) => change("partnerId", value)} disabled={editing || busy} required placeholder="Search partner or email" />
        {partner && <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm"><p className="flex items-center gap-2 font-medium"><Landmark className="h-4 w-4 text-accent" />Current payout account <span className={partner.bank ? "text-success" : "text-warning"}>{partner.bankingStatus}</span></p>{partner.bank ? <dl className="mt-2 divide-y divide-gray-200/70">{[["Account holder", partner.bank.holder], ["Institution code", partner.bank.institutionCode], ["Institution name", partner.bank.name], ["Transit number", partner.bank.transitNumber], ["Account number", partner.bank.account], ["Currency", partner.bank.currency]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2"><dt className="shrink-0 text-gray-500">{label}</dt><dd className="min-w-0 select-text break-all text-right text-gray-900">{value || "—"}</dd></div>)}</dl> : <p className="mt-2 text-gray-600">Confirm the partner’s banking details before arranging a payment.</p>}</div>}
        <div>
          <SearchableSelect key={form.partnerId || "no-partner"} id="payout-client" label="Client (optional)" value={selectedClientId} valueLabel={form.client} options={clientOptions} placeholder={form.partnerId ? "Search referred company or email" : "Select a partner first"} loading={clientsLoading} disabled={!form.partnerId || busy || !!clientError}
            emptyText="No referred clients found for this partner." onChange={(value) => {
              if (submitting.current) return;
              const selected = clientOptions.find((item) => item.value === value);
              requestId.current = crypto.randomUUID();
              setForm((previous) => ({ ...previous, clientId: value, client: selected?.label || "" }));
            }} />
          {clientError && <div role="alert" className="mt-2 text-xs text-danger">{clientError}<button type="button" className="ml-2 font-medium underline" disabled={busy} onClick={() => { setReferrals((previous) => ({ ...previous, error: "", loading: true })); setReferralAttempt((value) => value + 1); }}>Try again</button></div>}
          {editing && form.client && !selectedClientId && !clientsLoading && !clientError && <p className="mt-1 text-xs text-gray-500">The existing client is kept unless you select another client or clear this field.</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label htmlFor="payout-amount" className="mb-1.5 block text-xs font-medium">Amount (CAD) *</label><input id="payout-amount" inputMode="decimal" value={form.amount} onChange={(event) => change("amount", event.target.value)} required placeholder="0.00" pattern="[0-9]+(\.[0-9]{1,2})?" className={input} /></div><div><label htmlFor="payout-status" className="mb-1.5 block text-xs font-medium">Status *</label><select id="payout-status" value={form.status} onChange={(event) => change("status", event.target.value)} className={input}>{statuses.filter((value) => value !== "Cancelled").map((value) => <option key={value}>{value}</option>)}</select></div></div>
        {form.status === "Paid" && <div><label htmlFor="payout-paid-at" className="mb-1.5 block text-xs font-medium">Paid at *</label><input id="payout-paid-at" type="datetime-local" value={form.date} onChange={(event) => change("date", event.target.value)} required className={input} /><p className="mt-1 text-xs text-gray-500">Your local time. Paid payouts become read-only after saving.</p></div>}
        <div><div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><label htmlFor="payout-notes" className="text-xs font-medium">Notes (optional)</label><label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={form.showNotesToClient} onChange={event => change("showNotesToClient", event.target.checked)} className="accent-accent" />Show notes to partner</label></div><textarea id="payout-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => change("notes", event.target.value)} className={input} /><p className="mt-1 text-xs text-gray-500">Additional information about this payout.</p></div>
      </fieldset>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-gray-100 pt-4"><button type="button" className={secondary} disabled={busy} onClick={onClose}>{cancelling ? "Keep payout" : "Cancel"}</button><button type="submit" disabled={busy || (!cancelling && !valid)} className={cancelling ? "rounded-lg bg-danger px-4 py-2.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50" : primary}>{busy ? "Saving…" : cancelling ? "Cancel payout" : "Save payout"}</button></div>
    </form>}
  </dialog>;
}

export default function AdminPayouts() {
  const { sort, toggleSort, sortRows } = useTableSort();
  const [data, setData] = useState({ payouts: [], partners: [] });
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0), [query, setQuery] = useState(""), [status, setStatus] = useState("All statuses");
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  const [createdFrom, setCreatedFrom] = useState(""), [createdTo, setCreatedTo] = useState("");
  const [filterReset, setFilterReset] = useState(0);
  const [dialog, setDialog] = useState(null), [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadAdminPayouts(controller.signal).then((result) => { if (!controller.signal.aborted) { setData(result); setError(""); } })
      .catch((failure) => { if (!controller.signal.aborted) setError(failure.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  function refresh() { setLoading(true); setError(""); setAttempt((value) => value + 1); }
  function clearFilters() {
    setQuery(""); setStatus("All statuses"); setFrom(""); setTo(""); setCreatedFrom(""); setCreatedTo("");
    // Also discard incomplete date segments kept inside the browser's native controls.
    setFilterReset((value) => value + 1);
  }
  const normalized = query.trim().toLowerCase();
  const invalidPeriod = (from && to && from > to) || (createdFrom && createdTo && createdFrom > createdTo);
  const filtered = sortRows(data.payouts.filter((row) => !invalidPeriod && [row.ref, row.partnerName, row.client].some((value) => (value || "").toLowerCase().includes(normalized))
    && (status === "All statuses" || row.status === status) && (!createdFrom || day(row.createdAt) >= createdFrom) && (!createdTo || (day(row.createdAt) && day(row.createdAt) <= createdTo)) && (!from || day(row.date) >= from) && (!to || (day(row.date) && day(row.date) <= to))), { amount: { type: "number" }, createdAt: { type: "date" }, date: { type: "date" } });
  const pager = usePagination(filtered, [query, status, createdFrom, createdTo, from, to, sort?.key, sort?.dir].join("|"));
  const sum = (rows) => rows.reduce((total, row) => total + (row.currency === "CAD" && typeof row.amount === "number" ? Math.round(row.amount * 100) : 0), 0) / 100;
  const month = localDate(new Date().toISOString()).slice(0, 7);
  const stats = [["Total paid (CAD)", sum(data.payouts.filter((row) => row.status === "Paid"))], ["Pending (CAD)", sum(data.payouts.filter((row) => row.status === "Pending"))], ["Paid this month (CAD)", sum(data.payouts.filter((row) => row.status === "Paid" && localDate(row.date).startsWith(month)))]];
  function saved(row) {
    const partnerName = data.partners.find((partner) => partner.id === row.partnerId)?.name || row.partnerName;
    setData((previous) => ({ ...previous, payouts: [{ ...row, partnerName }, ...previous.payouts.filter((item) => item.id !== row.id)] }));
    setDialog(null); setNotice(`${row.ref} ${row.status === "Cancelled" ? "cancelled" : "saved"}.`);
  }
  function download() {
    const cell = (value) => { let text = String(value ?? ""); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"`; };
    const rows = [["Reference", "Partner", "Client", "Amount", "Currency", "Status", "Created at", "Paid at", "Notes"], ...filtered.map((row) => [row.ref, row.partnerName, row.client, row.amount, row.currency, row.status, row.createdAt, row.date, row.notes])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "payouts.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }
  return <div className="max-w-6xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-gray-500">Record and track payments to your partners.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={refresh} disabled={loading} className={secondary}><RefreshCw className="h-4 w-4" />Refresh</button><button type="button" onClick={() => setDialog({ mode: "create" })} disabled={loading || !!error || !data.partners.length} className={primary}><Plus className="h-4 w-4" />Add payout</button></div></div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{stats.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200/70 bg-white p-5"><div><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{loading || error ? "—" : money(value)}</p></div></div>)}</div>
    {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-lg bg-accent-100 p-3 text-sm text-accent"><p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" />{notice}</p><button type="button" aria-label="Dismiss notification" onClick={() => setNotice("")}><X className="h-4 w-4" /></button></div>}
    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-100 p-3 text-sm text-danger"><p>{error}</p><button type="button" onClick={refresh} disabled={loading} className={secondary}>Try again</button></div>}
    <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white" aria-label="Payouts">
      <div className="flex flex-wrap gap-3 p-4"><div className="min-w-0 flex-1 basis-56"><label htmlFor="payout-search" className="mb-1.5 block text-xs text-gray-500">Search partner, reference or client</label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input id="payout-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={`${input} pl-9`} /></div></div><div><label htmlFor="payout-filter-status" className="mb-1.5 block text-xs text-gray-500">Status</label><select id="payout-filter-status" value={status} onChange={(event) => setStatus(event.target.value)} className={input}><option>All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></div><div><label htmlFor="payout-created-from" className="mb-1.5 block text-xs text-gray-500">Created from</label><input key={`created-from-${filterReset}`} id="payout-created-from" type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} className={input} /></div><div><label htmlFor="payout-created-to" className="mb-1.5 block text-xs text-gray-500">Created to</label><input key={`created-to-${filterReset}`} id="payout-created-to" type="date" min={createdFrom || undefined} value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} className={input} /></div><div><label htmlFor="payout-from" className="mb-1.5 block text-xs text-gray-500">Paid from</label><input key={`from-${filterReset}`} id="payout-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={input} /></div><div><label htmlFor="payout-to" className="mb-1.5 block text-xs text-gray-500">Paid to</label><input key={`to-${filterReset}`} id="payout-to" type="date" min={from || undefined} value={to} onChange={(event) => setTo(event.target.value)} className={input} /></div></div>
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 pb-4"><ClearFiltersButton onClick={clearFilters} /><button type="button" onClick={download} disabled={loading || !!error || !filtered.length} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"><Download className="w-3.5 h-3.5" />Download</button></div>
      {invalidPeriod && <p role="alert" className="px-4 pt-3 text-sm text-danger">The end date must be on or after the start date.</p>}
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="text-[11px] text-gray-400 border-b border-gray-100"><tr>{[["ref", "Reference"], ["partnerName", "Partner"], ["client", "Client"], ["amount", "Amount"], ["status", "Status"], ["createdAt", "Created at"], ["date", "Paid at"]].map(([key, label]) => <SortableHeader key={key} column={key} label={label} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-4 py-3 font-medium" />)}<th scope="col" className="whitespace-nowrap px-4 py-3 font-medium">Actions</th></tr></thead><tbody className="divide-y divide-gray-100 text-gray-700">{!loading && !error && pager.rows.map((row) => {
        const readOnly = ["Paid", "Cancelled"].includes(row.status) || !row.validOwnership || row.currency !== "CAD";
        return <tr key={row.id}><td className="max-w-48 break-words px-4 py-3 font-mono text-xs text-accent">{row.ref}</td><td className="max-w-52 break-words px-4 py-3">{row.partnerName}{!row.validOwnership && <p className="mt-1 text-xs text-danger">Partner link needs review</p>}</td><td className="max-w-40 break-words px-4 py-3"><ClientCell value={row.client} /></td><td className="whitespace-nowrap px-4 py-3">{money(row.amount, row.currency)} <span className="text-xs text-gray-500">{row.currency}</span></td><td className="px-4 py-3"><Status value={row.status} /></td><td className="whitespace-nowrap px-4 py-3">{date(row.createdAt)}</td><td className="whitespace-nowrap px-4 py-3">{date(row.date)}</td><td className="px-4 py-3"><div className="flex gap-1.5" role="group" aria-label={`Actions for payout ${row.ref}`}><ActionButton label={`View payout ${row.ref}`} tooltip="View payout" className={`${iconButton} text-gray-500 enabled:hover:text-accent`} onClick={() => setDialog({ mode: "view", payout: row })}><Eye className="h-4 w-4" /></ActionButton><ActionButton label={`Edit payout ${row.ref}`} tooltip={readOnly ? "Read-only payout history" : "Edit payout"} disabled={readOnly} className={`${iconButton} text-gray-500 enabled:hover:text-accent`} onClick={() => setDialog({ mode: "edit", payout: row })}><Pencil className="h-4 w-4" /></ActionButton><ActionButton label={`Cancel payout ${row.ref}`} tooltip={readOnly ? "Read-only payout history" : "Cancel payout"} disabled={readOnly} className={`${iconButton} text-gray-500 enabled:hover:text-danger`} onClick={() => setDialog({ mode: "cancel", payout: row })}><Ban className="h-4 w-4" /></ActionButton></div></td></tr>;
      })}{(loading || error || !filtered.length) && <tr><td colSpan={8} className="px-5 py-14 text-center text-gray-500"><DollarSign className="mx-auto mb-3 h-8 w-8 text-gray-300" /><p role={loading ? "status" : undefined}>{loading ? "Loading payouts…" : error ? "Payout list unavailable" : data.payouts.length ? "No matching payouts" : "No payouts yet"}</p>{!loading && !error && <p className="mt-1 text-xs">{data.payouts.length ? "Try another search or change the filters." : data.partners.length ? "Add your first partner payout." : "Register a partner before adding payouts."}</p>}</td></tr>}</tbody></table></div>
      <TablePager pager={pager} noun="payouts" overall={data.payouts.length} />
    </section>
    {dialog && <PayoutDialog key={`${dialog.mode}:${dialog.payout?.id || "new"}`} {...dialog} partners={data.partners} onClose={() => setDialog(null)} onSave={saved} />}
  </div>;
}