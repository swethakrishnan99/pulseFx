import { useState, useEffect } from "react";
import { Landmark, Plus, Trash2, X, Eye, EyeOff, FileText, Copy, Check, Send, ArrowLeftRight, ArrowUpRight, ArrowDownRight, Search, RefreshCw, Download, Printer } from "lucide-react";
import Tooltip from "./Tooltip";
import { setPendingPayFrom } from "../lib/quoteHandoff";
import { isVerified, getBankAccounts, addBankAccount, removeBankAccount, takePendingTab } from "../lib/bankAccounts";
import { CURRENCIES, FLAGS } from "../lib/currencies";

const ACCOUNTS = [
  { id: "usd-rbc", accountId: "0031201", currency: "USD", type: "Holding", balance: 0, change90: 10000, account: "50031201", iban: "GB12DEMO20060550031201", ref: "PFXCLI1008905" },
  { id: "cad-td", accountId: "0031202", currency: "CAD", type: "Holding", balance: 4200, change90: 104644.58, account: "53031202", iban: "GB34DEMO20060553031202", ref: "PFXCLI1008906" },
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
            {FLAGS[account.currency]} {account.currency} holding account
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

function LinkedAccounts() {
  const [, force] = useState(0);
  const refresh = () => force((n) => n + 1);
  const list = getBankAccounts();
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ currency: "CAD", bank: "", holder: "", account: "", routing: "" });
  const [confirmId, setConfirmId] = useState(null);
  const [notice, setNotice] = useState("");

  const routingLabel = f.currency === "USD" ? "ABA routing number" : f.currency === "CAD" ? "Institution and transit number" : f.currency === "GBP" ? "Sort code" : f.currency === "AUD" ? "BSB" : "SWIFT / BIC";
  const ok = f.bank.trim() && f.holder.trim() && f.account.length >= 4 && f.routing.trim().length >= 3;
  const field = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";

  const duplicate = getBankAccounts().some((a) => a.currency === f.currency && a.last4 === f.account.slice(-4) && a.bank.toLowerCase() === f.bank.trim().toLowerCase());

  function save(e) {
    e.preventDefault();
    if (!ok || duplicate) return;
    addBankAccount({ currency: f.currency, bank: f.bank.trim(), last4: f.account.slice(-4), holder: f.holder.trim() });
    setNotice(`${f.bank.trim()} ••••${f.account.slice(-4)} was linked. PulseFX will now verify it. Until then it shows as Pending and can't be used for direct debit.`);
    setF({ currency: "CAD", bank: "", holder: "", account: "", routing: "" });
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-start gap-2.5 bg-white border border-gray-200/70 rounded-xl px-4 py-3 mb-4 max-w-2xl">
        <Landmark className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-gray-600">
          These are <span className="font-medium">your own</span> bank accounts, separate from your holding accounts. When you choose
          &ldquo;Pay by direct debit&rdquo; in Move Money, we collect the money from one of these. PulseFX verifies each new account before you can use it.
        </p>
      </div>

      {notice && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-success bg-success-100 rounded-md px-3 py-2 mb-3 max-w-2xl">
          <Check className="w-3.5 h-3.5 shrink-0" />
          {notice}
        </p>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => { setNotice(""); setAdding(true); }}
          className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors mb-4"
        >
          <Plus className="w-4 h-4" />
          Link a bank account
        </button>
      )}

      {adding && (
        <form onSubmit={save} className="bg-white rounded-xl border border-gray-200/70 p-5 mb-4 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-4">Link a bank account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Currency of the account</label>
              <select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })} className={field}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{FLAGS[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Bank name</label>
              <input className={field} value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} placeholder="e.g. RBC Chequing" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] text-gray-500 mb-1">Account holder name</label>
              <input className={field} value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} />
              <p className="text-[11px] text-gray-400 mt-1">Must match the name on the bank account.</p>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Account number</label>
              <input
                className={`${field} font-mono`}
                inputMode="numeric"
                value={f.account}
                onChange={(e) => setF({ ...f, account: e.target.value.replace(/\D/g, "") })}
                placeholder="Digits only"
              />
              <p className="text-[11px] text-gray-400 mt-1">Once saved, only the last 4 digits are shown.</p>
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">{routingLabel}</label>
              <input className={`${field} font-mono`} value={f.routing} onChange={(e) => setF({ ...f, routing: e.target.value })} />
            </div>
          </div>
          {duplicate && <p role="alert" className="text-[11px] text-danger mt-3">You have already linked this account.</p>}
          <div className="flex gap-2 mt-4">
            <button
              type="submit"
              disabled={!ok || duplicate}
              className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Link account
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100">
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200/70 p-4 overflow-x-auto">
        <div className="grid grid-cols-[1.4fr_0.7fr_1fr_1.4fr_1fr_0.5fr] gap-4 min-w-[720px] text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Bank</span>
          <span>Currency</span>
          <span>Account number</span>
          <span>Account holder</span>
          <span>Status</span>
          <span />
        </div>
        {list.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No bank accounts linked yet.</p>}
        {list.map((a, i) => (
          <div
            key={a.id}
            className={`grid grid-cols-[1.4fr_0.7fr_1fr_1.4fr_1fr_0.5fr] gap-4 min-w-[720px] items-center py-3 text-sm ${i < list.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            <span className="font-medium text-gray-900">{a.bank}</span>
            <span className="text-gray-700">{FLAGS[a.currency]} {a.currency}</span>
            <span className="font-mono text-gray-500">••••{a.last4}</span>
            <span className="text-gray-700">{a.holder}</span>
            <span>
              {isVerified(a) ? (
                <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-100 text-success">Verified</span>
              ) : (
                <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full bg-warning-100 text-[#7a4e0b]">Pending verification</span>
              )}
            </span>
            <span className="flex items-center justify-end gap-3 text-xs font-medium">
              {confirmId === a.id ? (
                <>
                  <span className="text-gray-500">Remove?</span>
                  <button type="button" onClick={() => { removeBankAccount(a.id); setConfirmId(null); refresh(); }} className="text-danger hover:underline">Yes</button>
                  <button type="button" onClick={() => setConfirmId(null)} className="text-gray-500 hover:underline">No</button>
                </>
              ) : (
                <>
                  <button type="button" aria-label={`Remove ${a.bank}`} title="Remove" onClick={() => setConfirmId(a.id)} className="text-gray-400 hover:text-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HoldingAccounts({ onNavigate }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState(() => takePendingTab() || "holding");

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
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Accounts</h1>
          <p className="text-sm text-gray-500 max-w-xl">
            {tab === "holding"
              ? "Money you hold with PulseFX. You have one account for each currency."
              : "Your own bank accounts that we can collect money from by direct debit."}
          </p>
        </div>
        <div className={`items-center gap-1 shrink-0 ${tab === "holding" ? "flex" : "hidden"}`}>
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

      <div role="tablist" aria-label="Account type" className="flex gap-1 border-b border-gray-200 mb-4">
        {[["holding", "Holding accounts"], ["linked", "Linked bank accounts"]].map(([k, t]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`text-sm px-3 py-2 -mb-px border-b-2 transition-colors ${
              tab === k ? "border-accent text-accent font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "linked" ? (
        <LinkedAccounts />
      ) : (
      <>
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
            <span className="font-medium text-gray-900">{FLAGS[acc.currency]} {acc.currency}</span>
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
      </>
      )}
    </div>
  );
}