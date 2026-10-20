import { useState, useEffect } from "react";
import { X, Eye, EyeOff, FileText, Copy, Check, Send, ArrowLeftRight, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Tooltip from "./Tooltip";

const ACCOUNTS = [
  { id: "usd-rbc", currency: "USD", bank: "RBC", type: "Holding", balance: 0, change90: 10000, institution: "003", transit: "01234", account: "5002231" },
  { id: "cad-rbc", currency: "CAD", bank: "RBC", type: "Holding", balance: 0, change90: 106444.58, institution: "003", transit: "01234", account: "5004410" },
  { id: "cad-td", currency: "CAD", bank: "TD Bank", type: "Holding", balance: 4200, change90: -1800, institution: "004", transit: "56789", account: "6408827" },
];

// en-US prints a plain "$" for both USD and CAD amounts (en-CA would print "US$")
const money = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const signed = (n) => `${n >= 0 ? "+" : "-"}${money(Math.abs(n))}`;

const totalFor = (currency) =>
  ACCOUNTS.filter((a) => a.currency === currency).reduce((sum, a) => sum + a.balance, 0);

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
  const [copied, setCopied] = useState(false);
  const [download, setDownload] = useState("idle"); // idle | preparing | done

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shownAccount = reveal ? account.account : `••••${account.account.slice(-4)}`;

  function handleCopy() {
    navigator.clipboard?.writeText(account.account);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
            {account.currency} account at {account.bank}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Share these details with anyone who needs to send money into this account.
        </p>

        <div className="bg-gray-50 rounded-lg px-4 mb-4">
          <DetailRow label="Account holder" value="PulseFX Test Account" />
          <DetailRow label="Bank" value={account.bank} />
          <DetailRow label="Institution number" value={account.institution} mono />
          <DetailRow label="Transit number" value={account.transit} mono />
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
                <button
                  type="button"
                  aria-label="Copy account number"
                  onClick={handleCopy}
                  className="p-1.5 text-gray-400 hover:text-accent"
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            }
          />
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

  return (
    <div className="flex-1 bg-gray-50 p-6 min-w-0">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Holding Accounts</h1>
      <p className="text-sm text-gray-500 mb-4 max-w-xl">
        Money you hold with PulseFX, by currency and bank.
      </p>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3.5 max-w-lg mb-4">
        {["USD", "CAD"].map((cur) => (
          <div key={cur} className="bg-white rounded-xl border border-gray-200/70 p-4">
            <p className="text-xs text-gray-500 mb-1">Total {cur}</p>
            <p className="text-xl font-semibold text-gray-900 tabular-nums">{money(totalFor(cur))}</p>
          </div>
        ))}
      </div>

      {/* Accounts table */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4">
        <div className="grid grid-cols-[0.7fr_1fr_1fr_1.2fr_1.2fr_1.6fr] gap-3 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Currency</span>
          <span>Bank</span>
          <span>Account</span>
          <span className="flex items-center gap-1">
            Available
            <Tooltip text="Money in this account that you can use right now." />
          </span>
          <span className="flex items-center gap-1">
            Last 90 days
            <Tooltip text="How much this account's balance has gone up or down over the past 90 days." />
          </span>
          <span />
        </div>

        {ACCOUNTS.map((acc, i) => (
          <div
            key={acc.id}
            className={`grid grid-cols-[0.7fr_1fr_1fr_1.2fr_1.2fr_1.6fr] gap-3 items-center py-3 text-sm ${
              i < ACCOUNTS.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span className="font-medium text-gray-900">{acc.currency}</span>
            <span className="text-gray-700">{acc.bank}</span>
            <span className="font-mono text-gray-500">{`••••${acc.account.slice(-4)}`}</span>
            <span className="tabular-nums font-medium text-gray-900">{money(acc.balance)}</span>
            <span
              className={`flex items-center gap-1 tabular-nums text-xs ${
                acc.change90 >= 0 ? "text-success" : "text-danger"
              }`}
            >
              {acc.change90 >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {signed(acc.change90)}
            </span>
            <span className="flex items-center justify-end gap-3 text-xs font-medium">
              <button type="button" onClick={() => setSelected(acc)} className="text-accent hover:underline">
                Details
              </button>
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <ArrowLeftRight className="w-3 h-3" />
                Convert
              </button>
              <button
                type="button"
                onClick={() => onNavigate("send-payment")}
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
        Showing {ACCOUNTS.length} accounts. Balances are demo data.
      </p>

      {selected && <DetailsPanel account={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}