import { useState, useEffect } from "react";
import { X, Eye, EyeOff, FileText, Copy, Check, Send, ArrowLeftRight, ArrowUpRight, ArrowDownRight, Search, RefreshCw, Download, Printer } from "lucide-react";
import Tooltip from "./Tooltip";
import { setPendingPayFrom } from "../lib/quoteHandoff";

const ACCOUNTS = [
  { id: "usd-rbc", accountId: "0031201", currency: "USD", bank: "RBC", type: "Holding", balance: 0, change90: 10000, account: "50031201", iban: "GB12DEMO20060550031201", ref: "PFXCLI1008905" },
  { id: "cad-td", accountId: "0031202", currency: "CAD", bank: "TD Bank", type: "Holding", balance: 4200, change90: 104644.58, account: "53031202", iban: "GB34DEMO20060553031202", ref: "PFXCLI1008906" },
];

// en-US prints a plain "$" for both USD and CAD amounts (en-CA would print "US$")
const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const signed = (n) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;

const amt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function DetailRow({ label, value, mono = false, action }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0">
      <div>
        <p className="text-[11px] text-gray-400">{label}</p>
        <p className={`text-sm text-gray-900 ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
      {action}
    </div>
  );
}

function DetailsPanel({ account, onClose }) {
  const [reveal, setReveal] = useState(false);
  const [copied, setCopied] = useState(null);
  const [download, setDownload] = useState("idle"); // idle | preparing | done

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownAccount = reveal ? account.account : `••••${account.account.slice(-4)}`;

  function handleCopy(key, text) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const copyBtn = (key, text, label) => (
    <button type="button" aria-label={label} onClick={() => handleCopy(key, text)} className="p-1.5 text-gray-400 hover:text-accent">
      {copied === key ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
    </button>
  );

  function handleDownload() {
    setDownload("preparing");
    setTimeout(() => setDownload("done"), 900); // demo only: no real file is generated
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside
        role="dialog"
        aria-label={`${account.currency} account details`}
        className="relative w-full max-w-sm bg-white h-full shadow-xl p-5 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">
            {account.currency} holding account
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Share these details with anyone who needs to send money into this account. Always include the payment reference.
        </p>

        <div className="bg-gray-50 rounded-lg px-4 mb-4">
          <DetailRow label="Holder" value="PulseFX Partners UK" />
          <DetailRow label="Holder address" value="Level 3, 100 Example Street, London SW1E 5JL" />
          <DetailRow label="Account ID" value={account.accountId} mono />
          <DetailRow
            label="Account number"
            value={shownAccount}
            mono
            action={
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label={reveal ? "Hide account number" : "Show account number"}
                  onClick={() => setReveal((r) => !r)}
                  className="p-1.5 text-gray-400 hover:text-accent"
                >
                  {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                {copyBtn("acct", account.account, "Copy account number")}
              </div>
            }
          />
          <DetailRow label="IBAN" value={account.iban} mono action={copyBtn("iban", account.iban, "Copy IBAN")} />
          <DetailRow label="BIC" value="DEMOGB22" mono action={copyBtn("bic", "DEMOGB22", "Copy BIC")} />
          <DetailRow label="Payment reference" value={account.ref} mono action={copyBtn("ref", account.ref, "Copy payment reference")} />
        </div>

        <button
          type="button"
          onClick={handleDownload}
          disabled={download === "preparing"}
          className="w-full flex items-center justify-center gap-2 bg-accent text-white text-sm font-medium px-4 py-2.5 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-60"
        >
          <FileText className="w-4 h-4" />
          {download === "preparing" ? "Preparing certificate..." : "Download account certificate (PDF)"}
        </button>

        {download === "done" && (
          <p className="flex items-center gap-1.5 text-xs text-success mt-2.5">
            <Check className="w-3.5 h-3.5" />
            Certificate ready. (Demo only: no file is created.)
          </p>
        )}
      </aside>
    </div>
  );
}

export default function HoldingAccounts({ onNavigate }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const q = query.trim().toLowerCase();
  const rows = ACCOUNTS.filter((a) => !q || a.currency.toLowerCase().includes(q) || a.accountId.includes(q));

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }

  function downloadCsv() {
    const lines = [
      ["Currency", "Account ID", "Account type", "Current balance", "Last 90 days"],
      ...rows.map((a) => [a.currency, a.accountId, a.type, a.balance.toFixed(2), a.change90.toFixed(2)]),
    ].map((r) => r.join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const el = document.createElement("a");
    el.href = url;
    el.download = "pulsefx-holding-accounts.csv";
    document.body.appendChild(el);
    el.click();
    el.remove();
    URL.revokeObjectURL(url);
  }

  const iconBtn = "p-1.5 rounded-md text-gray-500 hover:text-accent hover:bg-white border border-transparent hover:border-gray-200";

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Holding Accounts</h1>
          <p className="text-sm text-gray-500 max-w-xl">Money you hold with PulseFX. You have one account for each currency.</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={refresh} aria-label="Refresh" title="Refresh" className={iconBtn}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={downloadCsv} aria-label="Download CSV" title="Download CSV" className={iconBtn}>
            <Download className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Print" title="Print" className={iconBtn}>
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative max-w-xs mb-3.5">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search currency or account ID"
          aria-label="Search accounts"
          className="w-full text-sm border border-gray-200 rounded-md pl-9 pr-3 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100"
        />
      </div>

      {/* Accounts table */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 overflow-x-auto">
        <div className="grid grid-cols-[0.7fr_1fr_0.9fr_1.3fr_1.2fr_1.8fr] gap-4 min-w-[820px] text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Currency</span>
          <span>Account ID</span>
          <span>Account type</span>
          <span className="flex items-center gap-1">
            Current balance
            <Tooltip text="Money in this account that you can use right now." />
          </span>
          <span className="flex items-center gap-1">
            Last 90 days
            <Tooltip text="How much this account's balance has gone up or down over the past 90 days." />
          </span>
          <span />
        </div>

        {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No accounts match your search.</p>}

        {rows.map((acc, i) => (
          <div
            key={acc.id}
            className={`grid grid-cols-[0.7fr_1fr_0.9fr_1.3fr_1.2fr_1.8fr] gap-4 min-w-[820px] items-center py-3 text-sm ${
              i < rows.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="font-medium text-gray-900">{acc.currency}</span>
            <span className="font-mono text-gray-700">{acc.accountId}</span>
            <span className="text-gray-700">{acc.type}</span>
            <span className="tabular-nums font-medium text-gray-900">
              <span className="text-gray-500 font-normal mr-1.5">{acc.currency}</span>
              {amt(acc.balance)}
            </span>
            <span
              className={`flex items-center gap-1 tabular-nums text-xs ${
                acc.change90 >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {acc.change90 >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {signed(acc.change90)}
            </span>
            <span className="flex items-center justify-end gap-6 text-xs font-medium">
              <button type="button" onClick={() => setSelected(acc)} className="text-accent hover:underline">
                Details
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingPayFrom({ fromId: acc.id, convert: true });
                  onNavigate("send-payment");
                }}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Convert
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingPayFrom({ fromId: acc.id });
                  onNavigate("send-payment");
                }}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <Send className="w-3 h-3" />
                Pay
              </button>
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-3">
        Showing {rows.length} of {ACCOUNTS.length} accounts. Balances are demo data.
      </p>

      {selected && <DetailsPanel account={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}