import { useState, useMemo } from "react";
import { Search, Download, FileText, Check } from "lucide-react";
import Tooltip from "./Tooltip";

// Fixed "today" so the demo's date filters behave the same every time it's opened
const TODAY = new Date("2026-10-06T00:00:00Z");

const PAYMENTS = [
  { ref: "EBPOTR031499", date: "2026-10-05", to: "Test Company Inc", paid: { cur: "CAD", amt: 13839.34 }, received: { cur: "USD", amt: 10000 }, rate: 1.3839, status: "awaiting", note: "We're waiting for your CAD 13,839.34 to arrive before we can send this." },
  { ref: "EBPOTR031305", date: "2026-10-02", to: "Maple Supply Co.", paid: { cur: "USD", amt: 75000 }, received: { cur: "CAD", amt: 106444.58 }, rate: 1.4193, status: "transit", note: "Sent. It should reach the recipient's bank within 1 business day." },
  { ref: "EBPOTR030981", date: "2026-09-18", to: "Lone Star Logistics", paid: { cur: "USD", amt: 25000 }, received: { cur: "CAD", amt: 34602.5 }, rate: 1.3841, status: "completed" },
  { ref: "EBPOTR030754", date: "2026-08-27", to: "Pacific Freight LLC", paid: { cur: "CAD", amt: 8210 }, received: { cur: "USD", amt: 5940.15 }, rate: 1.382, status: "completed" },
  { ref: "EBPOTR030212", date: "2026-06-14", to: "Maple Supply Co.", paid: { cur: "USD", amt: 12000 }, received: { cur: "CAD", amt: 16380 }, rate: 1.365, status: "completed" },
];

const STATUS = {
  awaiting: { label: "Awaiting funds", className: "text-warning bg-warning-100", help: "We're waiting for your payment to arrive before we can send this." },
  transit: { label: "In transit", className: "text-accent-800 bg-accent-100", help: "Your payment has been sent and is on its way to the recipient." },
  completed: { label: "Completed", className: "text-success bg-success-100", help: "The recipient has received the money." },
};

const STEPS = ["Created", "Funds received", "Sent", "Delivered"];
const STEPS_DONE = { awaiting: 1, transit: 3, completed: 4 };

const RANGES = { "30": "Last 30 days", "90": "Last 90 days", all: "All time" };

const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = ({ cur, amt }) => `${cur} ${fmt(amt)}`;
const niceDate = (iso) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function daysAgo(iso) {
  return Math.round((TODAY - new Date(`${iso}T00:00:00Z`)) / 86400000);
}

function StatusBadge({ status }) {
  const s = STATUS[status];
  return <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded ${s.className}`}>{s.label}</span>;
}

function Stepper({ status }) {
  const done = STEPS_DONE[status];
  return (
    <ol className="flex items-start w-full max-w-md">
      {STEPS.map((label, i) => {
        const isDone = i < done;
        const isCurrent = i === done;
        return (
          <li key={label} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <span
                className={`absolute top-3 right-1/2 w-full h-0.5 ${i < done ? "bg-success" : "bg-gray-200"}`}
              />
            )}
            <span
              className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium border-2 ${
                isDone
                  ? "bg-success border-success text-white"
                  : isCurrent
                  ? "bg-white border-accent text-accent"
                  : "bg-white border-gray-200 text-gray-300"
              }`}
            >
              {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={`mt-1.5 text-[11px] text-center ${isDone || isCurrent ? "text-gray-700" : "text-gray-400"}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function csvEscape(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportCsv(rows) {
  const header = ["Reference", "Date", "Paid to", "You paid (currency)", "You paid (amount)", "They received (currency)", "They received (amount)", "Rate", "Status"];
  const lines = rows.map((p) =>
    [p.ref, p.date, p.to, p.paid.cur, p.paid.amt.toFixed(2), p.received.cur, p.received.amt.toFixed(2), p.rate, STATUS[p.status].label]
      .map(csvEscape)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pulsefx-payments-${TODAY.toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [tab, setTab] = useState("tracker");
  const [range, setRange] = useState("90");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const inProgress = PAYMENTS.filter((p) => p.status !== "completed");
  const completed90 = PAYMENTS.filter((p) => p.status === "completed" && daysAgo(p.date) <= 90).length;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PAYMENTS.filter((p) => {
      if (range !== "all" && daysAgo(p.date) > Number(range)) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (q && !(p.ref.toLowerCase().includes(q) || p.to.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [range, statusFilter, query]);

  function showReceiptNotice() {
    setNotice("Demo only: payment confirmations aren't generated in this prototype.");
    setTimeout(() => setNotice(""), 3000);
  }

  return (
    <div className="flex-1 bg-gray-50 p-6 min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Reports</h1>
      <p className="text-sm text-gray-500 mb-4 max-w-xl">
        Follow your payments from start to finish, or look back at what you've sent.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3.5 max-w-lg mb-5">
        <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">In progress</p>
          <p className="text-xl font-semibold text-gray-900">{inProgress.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">Completed, last 90 days</p>
          <p className="text-xl font-semibold text-gray-900">{completed90}</p>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex gap-1 border-b border-gray-200 mb-4 ">
        {[
          { key: "tracker", label: "Payment tracker" },
          { key: "history", label: "Payment history" },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 -mb-px border-b-2 transition-colors ${
              tab === t.key ? "border-accent text-accent font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TRACKER */}
      {tab === "tracker" && (
        <div className="flex flex-col gap-3.5">
          {inProgress.length === 0 && (
            <div className="bg-white rounded-lg p-8 text-center text-sm text-gray-400">
              Nothing in progress right now. Payments you send will show up here.
            </div>
          )}
          {inProgress.map((p) => (
            <div key={p.ref} className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.to}</p>
                  <p className="text-xs text-gray-400 font-mono">{p.ref} · {niceDate(p.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900 tabular-nums">
                    You pay <span className="font-medium">{money(p.paid)}</span>
                  </p>
                  <p className="text-xs text-gray-500 tabular-nums">
                    They receive {money(p.received)}
                  </p>
                </div>
              </div>
              <Stepper status={p.status} />
              <p className="text-xs text-gray-500 mt-4">{p.note}</p>
            </div>
          ))}
        </div>
      )}

      {/* HISTORY */}
      {tab === "history" && (
        <>
          <div className="flex flex-wrap items-center gap-2.5 mb-3.5 ">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search reference or name"
                className="w-56 text-sm border border-gray-200 rounded-md pl-9 pr-3 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100"
              />
            </div>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              aria-label="Date range"
              className="text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            >
              {Object.entries(RANGES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Status"
              className="text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            >
              <option value="all">All statuses</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => exportCsv(rows)}
              disabled={rows.length === 0}
              className="ml-auto flex items-center gap-1.5 text-sm font-medium text-accent border border-accent/40 rounded-md px-3 py-2 hover:bg-accent-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
          </div>

          <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100">
            <div className="grid grid-cols-[1.1fr_0.9fr_1.3fr_1fr_1fr_1fr_0.8fr] gap-3 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
              <span>Reference</span>
              <span>Date</span>
              <span>Paid to</span>
              <span>You paid</span>
              <span>They received</span>
              <span className="flex items-center gap-1">
                Status
                <Tooltip text="Awaiting funds: we haven't received your money yet. In transit: sent and on its way. Completed: the recipient has it." />
              </span>
              <span />
            </div>

            {rows.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No payments match these filters.</p>
            )}

            {rows.map((p, i) => (
              <div
                key={p.ref}
                className={`grid grid-cols-[1.1fr_0.9fr_1.3fr_1fr_1fr_1fr_0.8fr] gap-3 items-center py-3 text-sm ${
                  i < rows.length - 1 ? "border-b border-gray-100" : ""
                }`}
              >
                <span className="font-mono text-xs text-gray-700">{p.ref}</span>
                <span className="text-gray-500 text-xs">{niceDate(p.date)}</span>
                <span className="text-gray-900">{p.to}</span>
                <span className="tabular-nums">{money(p.paid)}</span>
                <span className="tabular-nums">{money(p.received)}</span>
                <span><StatusBadge status={p.status} /></span>
                <span className="text-right">
                  <button
                    type="button"
                    disabled={p.status === "awaiting"}
                    onClick={showReceiptNotice}
                    title={p.status === "awaiting" ? "Available once your funds arrive" : "Download payment confirmation"}
                    className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    <FileText className="w-3 h-3" />
                    Receipt
                  </button>
                </span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-3">
            Showing {rows.length} of {PAYMENTS.length} payments.
          </p>
          {notice && (
            <p role="status" className="text-xs text-gray-600 bg-white border border-gray-200 rounded-md px-3 py-2 mt-2 inline-block">
              {notice}
            </p>
          )}
        </>
      )}
    </div>
  );
}