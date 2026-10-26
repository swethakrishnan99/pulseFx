import { useState, useMemo, useRef } from "react";
import { Download, X, Calculator, FileDown, AlertTriangle, Search, Plus, Paperclip, CheckCircle2 } from "lucide-react";
import NewFinanceRequest from "./NewFinanceRequest";

// Demo data only. Dates are generated relative to today so overdue days always look right.
const DAY = 86400000;
const iso = (offsetDays) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pretty = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
const money = (n, cur = "CAD") => `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CREDIT_LINE = 500000;

const REQUESTS = [
  { ref: "PFXTF-100482", supplier: "Maple Supply Co.", invoice: "INV-7741", amount: 82500, fee: 1237.5, submitted: iso(-52), due: iso(-8), status: "Overdue", repaid: 0 },
  { ref: "PFXTF-100455", supplier: "Test Company Inc", invoice: "INV-7702", amount: 120000, fee: 1800, submitted: iso(-40), due: iso(20), status: "Funded", repaid: 0 },
  { ref: "PFXTF-100431", supplier: "Lone Star Logistics", invoice: "INV-7650", amount: 64000, fee: 960, submitted: iso(-33), due: iso(27), status: "Funded", repaid: 0 },
  { ref: "PFXTF-100390", supplier: "Maple Supply Co.", invoice: "INV-7588", amount: 45000, fee: 675, submitted: iso(-70), due: iso(-12), status: "Repaid", repaid: 45675 },
  { ref: "PFXTF-100512", supplier: "Test Company Inc", invoice: "INV-7790", amount: 30000, fee: 450, submitted: iso(-1), due: iso(59), status: "Pending", repaid: 0 },
  { ref: "PFXTF-100377", supplier: "Lone Star Logistics", invoice: "INV-7544", amount: 18000, fee: 270, submitted: iso(-80), due: iso(-30), status: "Rejected", repaid: 0 },
];

let nextSeq = 100513;

const STATUS_STYLE = {
  Pending: "bg-gray-100 text-gray-700",
  Funded: "bg-accent-100 text-accent",
  Repaid: "bg-success-100 text-success",
  Overdue: "bg-danger-100 text-danger",
  Rejected: "bg-gray-100 text-gray-500",
};

function Badge({ s }) {
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[s] ?? STATUS_STYLE.Pending}`}>{s}</span>;
}

const daysOverdue = (r) => (r.status === "Overdue" ? Math.max(1, Math.round((Date.now() - new Date(`${r.due}T12:00:00`).getTime()) / DAY)) : 0);
const reserved = (r) => (r.status === "Pending" ? r.amount + r.fee : 0); // credit held back while a request is under review
const owing = (r) => (r.status === "Funded" || r.status === "Overdue" ? r.amount + r.fee : 0);

function download(name, rows) {
  const csv = rows.map((r) => r.map((c) => { const t = String(c); const v = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; return `"${v.replace(/"/g, '""')}"`; }).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

export default function TradeFinance() {
  const [tab, setTab] = useState("requests");
  const [status, setStatus] = useState("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(null);
  const [early, setEarly] = useState("");
  const [earlyResult, setEarlyResult] = useState(null);
  const [pdfMsg, setPdfMsg] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [tick, setTick] = useState(0);
  const docRef = useRef(null);

  const used = REQUESTS.reduce((s, r) => s + owing(r) + reserved(r), 0);
  const pct = Math.min(100, Math.round((used / CREDIT_LINE) * 100));
  const overdue = REQUESTS.filter((r) => r.status === "Overdue");
  const overdueTotal = overdue.reduce((s, r) => s + owing(r), 0);

  const list = useMemo(() => {
    const base = tab === "requests" ? REQUESTS : REQUESTS.filter((r) => ["Funded", "Overdue", "Repaid"].includes(r.status));
    return base.filter((r) => (status === "All" || r.status === status) && (!q || `${r.ref} ${r.supplier} ${r.invoice}`.toLowerCase().includes(q.toLowerCase())));
  }, [tab, status, q, tick]);

  const statuses = tab === "requests" ? ["All", "Pending", "Funded", "Overdue", "Repaid", "Rejected"] : ["All", "Funded", "Overdue", "Repaid"];

  function submitNew(d) {
    const ref = `PFXTF-${nextSeq++}`;
    REQUESTS.unshift({ ref, supplier: d.supplier, invoice: d.invoice, amount: d.amount, cur: d.cur, fee: Math.round(d.amount * 0.015 * 100) / 100, submitted: iso(0), due: d.payDate, status: "Pending", repaid: 0, docs: d.files, details: d });
    setTab("requests"); setStatus("All"); setQ(""); setTick((t) => t + 1); setNewOpen(false);
    setNotice(`Request ${ref} submitted. It shows as Pending until it has been reviewed.`);
  }

  function addDocs(files) {
    if (!open || !files.length) return;
    open.docs = [...(open.docs ?? []), ...files.map((f) => f.name)];
    setTick((t) => t + 1);
  }

  function openPanel(r) { setOpen(r); setEarly(""); setEarlyResult(null); setPdfMsg(""); }

  function calcEarly() {
    const r = open;
    if (!early || !r) return;
    const start = new Date(`${r.submitted}T12:00:00`).getTime();
    const end = new Date(`${early}T12:00:00`).getTime();
    const total = Math.max(1, new Date(`${r.due}T12:00:00`).getTime() - start);
    const used = Math.min(total, Math.max(0, end - start));
    const interest = Math.round(r.fee * (used / total) * 100) / 100;
    setEarlyResult({ interest, total: r.amount + interest, saved: Math.round((r.fee - interest) * 100) / 100 });
  }

  function exportCsv() {
    download("supplier-payment-finance-statement.csv", [
      ["Reference", "Supplier", "Invoice", "Amount (CAD)", "Fee (CAD)", "Submitted", "Due", "Status"],
      ...list.map((r) => [r.ref, r.supplier, r.invoice, r.amount, r.fee, r.submitted, r.due, r.status]),
    ]);
  }

  const th = "text-left text-[11px] font-medium text-gray-500 px-3 py-2.5 whitespace-nowrap";
  const td = "px-3 py-3 text-sm text-gray-700 whitespace-nowrap";

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Trade finance</h1>
          <p className="text-sm text-gray-500 max-w-xl">Supplier payment finance: pay your suppliers now and repay later.</p>
        </div>
        <button type="button" onClick={() => { setNotice(""); setNewOpen(true); }} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-800"><Plus className="w-4 h-4" />New request</button>
      </div>

      {notice && (
        <div role="status" className="flex gap-2 items-start bg-success-100 border-l-4 border-success rounded-md px-3 py-2.5 mb-4">
          <CheckCircle2 className="w-4 h-4 text-success mt-0.5 shrink-0" />
          <p className="text-sm text-gray-800 flex-1">{notice}</p>
          <button type="button" aria-label="Dismiss" onClick={() => setNotice("")} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
      )}

      {overdue.length > 0 && (
        <div role="alert" className="flex gap-2 items-start bg-danger-100 border-l-4 border-danger rounded-md px-3 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
          <p className="text-sm text-gray-800">
            You have {overdue.length} overdue repayment{overdue.length > 1 ? "s" : ""} totalling <span className="font-semibold">{money(overdueTotal)}</span>. Repay as soon as you can to avoid extra charges.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200/70 p-5">
          <p className="text-[11px] text-gray-500">Credit line</p>
          <p className="text-lg font-semibold text-gray-900">{money(CREDIT_LINE)}</p>
          <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Credit line used">
            <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Used {money(used)} ({pct}%)</span>
            <span>Available {money(CREDIT_LINE - used)}</span>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 p-5">
          <p className="text-[11px] text-gray-500">Financial account status</p>
          <p className="mt-1"><span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success">Active</span></p>
          <p className="text-xs text-gray-500 mt-2">Your supplier payment finance account is open and in good standing.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70">
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3 border-b border-gray-100">
          {[["requests", "Submitted requests"], ["repayments", "Repayments"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setTab(k); setStatus("All"); }} className={`text-sm px-3 py-2 -mb-px border-b-2 ${tab === k ? "border-accent text-accent font-medium" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{l}</button>
          ))}
          <button type="button" onClick={exportCsv} aria-label="Download statement" title="Download statement (CSV)" className="ml-auto mb-1 p-2 text-gray-500 hover:text-accent"><FileDown className="w-4 h-4" /></button>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reference or supplier" className="text-sm border border-gray-200 rounded-md pl-8 pr-2.5 py-1.5 w-64 focus:outline-none focus:border-accent" />
          </div>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="text-sm border border-gray-200 rounded-md px-2.5 py-1.5 bg-white">
            {statuses.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Reference</th>
                <th className={th}>Supplier</th>
                <th className={th}>Invoice</th>
                <th className={`${th} text-right`}>Amount</th>
                <th className={th}>{tab === "requests" ? "Submitted" : "Due date"}</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.ref} className="border-t border-gray-100">
                  <td className={td}><button type="button" onClick={() => openPanel(r)} className="font-mono text-xs text-accent hover:underline">{r.ref}</button></td>
                  <td className={td}>{r.supplier}</td>
                  <td className={td}>{r.invoice}</td>
                  <td className={`${td} text-right`}>{money(tab === "requests" ? r.amount : owing(r) || r.repaid, r.cur)}</td>
                  <td className={td}>{pretty(tab === "requests" ? r.submitted : r.due)}</td>
                  <td className={td}>
                    <Badge s={r.status} />
                    {r.status === "Overdue" && <span className="text-[11px] text-danger ml-2">{daysOverdue(r)} days</span>}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-gray-400">Nothing matches those filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Demo only: figures are sample data.</p>

      {newOpen && <NewFinanceRequest available={CREDIT_LINE - used} onClose={() => setNewOpen(false)} onSubmit={submitNew} />}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(null)}>
          <aside role="dialog" aria-label={`Request ${open.ref}`} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white h-full overflow-y-auto p-5 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-mono text-sm text-gray-900">{open.ref}</p>
                <div className="mt-1"><Badge s={open.status} /></div>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
            </div>
            {[
              ["Supplier", open.supplier],
              ["Invoice", open.invoice],
              ["Amount financed", money(open.amount, open.cur)],
              ["Finance fee", money(open.fee, open.cur)],
              ...(open.details ? [["Date to pay supplier", pretty(open.details.payDate)], ["Payment terms", open.details.terms], ["Goods", open.details.goods], ["Country of origin", open.details.origin], ["Repayment currency", open.details.repayCur], ...(open.details.settlement ? [["Settlement", open.details.settlement]] : [])] : []),
              ["Submitted", pretty(open.submitted)],
              ["Due date", pretty(open.due)],
              ...(open.status === "Overdue" ? [["Days overdue", String(daysOverdue(open))]] : []),
              ["To repay", money(owing(open), open.cur)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm">
                <span className="text-gray-500">{k}</span><span className="text-gray-900 text-right">{v}</span>
              </div>
            ))}

            <div className="mt-5">
              <p className="text-sm font-medium text-gray-900 mb-2">Documents</p>
              {(open.docs ?? []).length === 0 ? <p className="text-xs text-gray-400 mb-2">No documents yet.</p> : (
                <ul className="mb-2 flex flex-col gap-1">{open.docs.map((n, i) => <li key={`${n}-${i}`} className="text-xs bg-gray-50 rounded px-2.5 py-1.5 truncate">{n}</li>)}</ul>
              )}
              <input ref={docRef} type="file" multiple className="hidden" aria-label="Upload more documents" onChange={(e) => { addDocs(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
              <button type="button" onClick={() => docRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50"><Paperclip className="w-4 h-4" />Add documents</button>
            </div>

            <button type="button" onClick={() => setPdfMsg("Demo only: a PDF would download here.")} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50">
              <Download className="w-4 h-4" />Download PDF
            </button>
            {pdfMsg && <p className="text-xs text-gray-500 mt-2">{pdfMsg}</p>}

            {owing(open) > 0 && open.status === "Funded" && (
              <div className="mt-5 bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5"><Calculator className="w-4 h-4 text-accent" />Calculate early repayment</p>
                <label htmlFor="early" className="block text-[11px] text-gray-500 mt-3 mb-1">Repayment date</label>
                <input id="early" type="date" value={early} min={iso(0)} max={open.due} onChange={(e) => { setEarly(e.target.value); setEarlyResult(null); }} className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white" />
                <button type="button" disabled={!early} onClick={calcEarly} className="mt-3 text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed">Calculate</button>
                {earlyResult && (
                  <div className="mt-3 text-sm">
                    <div className="flex justify-between py-1"><span className="text-gray-500">Interest to that date</span><span>{money(earlyResult.interest)}</span></div>
                    <div className="flex justify-between py-1"><span className="text-gray-500">Revised settlement</span><span className="font-medium">{money(earlyResult.total)}</span></div>
                    <div className="flex justify-between py-1"><span className="text-gray-500">You save</span><span>{money(earlyResult.saved)}</span></div>
                    <p className="text-xs text-gray-500 mt-2">We've emailed you this calculation. Demo figures only.</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}