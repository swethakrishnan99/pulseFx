import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { loadPayouts } from "../lib/payouts";

const secondary = "inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed";
const exportButton = "inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed";
const date = (value) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString("en-CA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" }) : "—";
const styles = { Paid: "bg-success-100 text-success", Pending: "bg-warning-100 text-gray-800", Failed: "bg-danger-100 text-danger", Cancelled: "bg-gray-100 text-gray-600" };

function Status({ status }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}
export default function PayoutHistory({ authenticated = false }) {
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
  return <div className="max-w-3xl"><section className="rounded-xl border border-gray-200/70 bg-white p-5" aria-label="Payout history">
    <h2 className="text-base font-semibold text-gray-900">Payout history</h2>
    <p className="mt-1 text-sm text-gray-500">View your payouts and download the history.</p>
    <div className="mt-4 border-t border-gray-100 pt-4" aria-label="Payout history records" role="region">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-gray-600">Total paid (CAD): {money(total)}</p><button type="button" className={exportButton} disabled={loading || !!error || rows.length === 0} onClick={download}><Download className="h-3.5 w-3.5" />Download</button></div>
    {loading ? <p role="status" className="mt-4 text-sm text-gray-500">Loading payouts…</p> : error ? <div role="alert" className="mt-4 text-sm text-danger"><p>{error}</p><button type="button" className={`${secondary} mt-2`} onClick={() => { setLoading(true); setAttempt((value) => value + 1); }}>Try again</button></div> : !rows.length ? <p className="mt-4 text-sm text-gray-500">{authenticated ? "No payouts yet." : "No payouts in this preview."}</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-gray-100 text-left text-xs text-gray-500">{["Reference", "Paid at", "Client", "Amount", "Status"].map((name) => <th key={name} className="px-2 py-2 font-medium">{name}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-gray-50"><td className="px-2 py-3">{row.ref}</td><td className="whitespace-nowrap px-2 py-3">{date(row.date)}</td><td className="px-2 py-3">{row.client || "—"}</td><td className="whitespace-nowrap px-2 py-3">{money(row.amount, row.currency)}</td><td className="px-2 py-3"><Status status={row.status} /></td></tr>)}</tbody></table></div>}
  </div></section></div>;
}
