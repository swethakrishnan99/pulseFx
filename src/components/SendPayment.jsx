import { useState, useEffect } from "react";
import {
  ArrowLeftRight,
  RefreshCw,
  Check,
  CheckCircle2,
  Copy,
  Wallet,
  Landmark,
  AlertTriangle,
} from "lucide-react";
import Tooltip from "./Tooltip";
import { readPendingQuote, clearPendingQuote } from "../lib/quoteHandoff";
import { useExchangeRate, getRate, round2, parseAmount, fmt2, fmtRate, niceDate } from "../lib/fx";

const CURRENCIES = ["USD", "CAD"];
const otherCurrency = (c) => CURRENCIES.find((x) => x !== c);
const money = (cur, n) => `${cur} ${fmt2(n)}`;

// Demo data. It mirrors the Beneficiaries and Holding Accounts pages.
const BENEFICIARIES = [
  { id: "1", name: "Test Company Inc", currency: "CAD", bank: "TD Bank", last4: "5678" },
  { id: "2", name: "Maple Supply Co.", currency: "CAD", bank: "RBC Royal Bank", last4: "8842" },
  { id: "3", name: "Lone Star Logistics", currency: "USD", bank: "Chase", last4: "4127" },
]; // approved beneficiaries only
const DEBIT_ACCOUNTS = [
  { id: "usd-rbc", currency: "USD", label: "RBC ••••2231" },
  { id: "cad-rbc", currency: "CAD", label: "RBC ••••4410" },
  { id: "cad-td", currency: "CAD", label: "TD ••••8827" },
];
const BALANCES = { USD: 0, CAD: 4200 };

function StepHeader({ step }) {
  const items = [
    { n: "①", label: "Payment details" },
    { n: "②", label: "Confirm & fund" },
    { n: "③", label: "Done" },
  ];
  return (
    <ol className="flex items-center gap-2.5 text-xs mb-5" aria-label="Progress">
      {items.map((it, i) => {
        const idx = i + 1;
        const done = idx < step;
        const current = idx === step;
        return (
          <li key={it.label} aria-current={current ? "step" : undefined} className="flex items-center gap-2.5">
            {i > 0 && <span className="text-gray-400" aria-hidden="true">—</span>}
            <span
              className={`flex items-center gap-1.5 ${
                current ? "font-semibold text-gray-900" : done ? "text-success" : "text-gray-400"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <span>{it.n}</span>}
              <span>{it.label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-100 last:border-b-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm text-right tabular-nums ${strong ? "font-semibold text-gray-900" : "text-gray-800"}`}>
        {value}
      </span>
    </div>
  );
}

export default function SendPayment({ onNavigate }) {
  // A quote accepted on the Dashboard pre-fills this form.
  const [bought] = useState(() => readPendingQuote());
  useEffect(() => () => clearPendingQuote(), []);
  const [step, setStep] = useState(1);
  const [payCur, setPayCur] = useState(bought?.payCur ?? "USD");
  const [recvCur, setRecvCur] = useState(bought?.recvCur ?? "CAD");
  // Whichever box the user typed in last is the "anchor"; the other box is calculated from it.
  const [anchor, setAnchor] = useState(bought?.anchor ?? "pay");
  const [amountStr, setAmountStr] = useState(
    bought ? (bought.anchor === "pay" ? bought.payAmt : bought.recvAmt).toFixed(2) : ""
  );
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [fundMethod, setFundMethod] = useState("balance");
  const [debitId, setDebitId] = useState("");
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fx = useExchangeRate();
  const rate = getRate(payCur, recvCur, fx.usdCad);

  // ---- amounts (derived, so they always stay in sync with the rate and currencies) ----
  const typed = parseAmount(amountStr);
  const payAmt = anchor === "pay" ? typed : round2(typed / rate);
  const recvAmt = anchor === "recv" ? typed : round2(typed * rate);
  const payDisplay = anchor === "pay" ? amountStr : amountStr === "" ? "" : fmt2(payAmt);
  const recvDisplay = anchor === "recv" ? amountStr : amountStr === "" ? "" : fmt2(recvAmt);

  // ---- options that depend on the chosen currencies ----
  const beneficiaryOptions = BENEFICIARIES.filter((b) => b.currency === recvCur);
  const beneficiary = beneficiaryOptions.find((b) => b.id === beneficiaryId) ?? null;
  const debitOptions = DEBIT_ACCOUNTS.filter((a) => a.currency === payCur);
  const debit = debitOptions.find((a) => a.id === debitId) ?? debitOptions[0] ?? null;

  const balance = BALANCES[payCur];
  const balanceTooLow = fundMethod === "balance" && payAmt > 0 && payAmt > balance;
  const canContinue =
    payAmt > 0 && recvAmt > 0 && beneficiary !== null && !balanceTooLow && (fundMethod === "balance" || debit !== null);

  // ---- handlers ----
  function changePayCur(c) {
    setPayCur(c);
    if (recvCur === c) setRecvCur(otherCurrency(c)); // the same currency can't be on both sides
  }

  function changeRecvCur(c) {
    if (c !== payCur) setRecvCur(c);
  }

  function swapCurrencies() {
    setPayCur(recvCur);
    setRecvCur(payCur);
    setAnchor((a) => (a === "pay" ? "recv" : "pay")); // the typed number stays with its currency
  }

  function handleAmountChange(which, raw) {
    const cleaned = raw.replace(/,/g, "");
    if (cleaned === "" || /^\d*\.?\d{0,2}$/.test(cleaned)) {
      setAnchor(which);
      setAmountStr(cleaned);
    }
  }

  function handleAmountBlur(which) {
    if (anchor !== which) return;
    if (amountStr === ".") setAmountStr("");
    else if (amountStr !== "") setAmountStr(Number(amountStr).toFixed(2));
  }

  function goToConfirm(e) {
    e.preventDefault();
    if (!canContinue) return;
    setQuote({
      payCur,
      recvCur,
      payAmt,
      recvAmt,
      rate,
      beneficiary,
      fundMethod,
      debit: fundMethod === "debit" ? debit : null,
      balanceBefore: BALANCES[payCur],
      rateNote:
        fx.status === "live" || fx.status === "stale"
          ? `ECB daily reference rate, ${niceDate(fx.asOf)}`
          : "Sample rate (demo)",
    });
    setStep(2);
  }

  function confirmPayment() {
    setResult({ reference: `PFX${Math.floor(100000 + Math.random() * 900000)}` });
    setStep(3);
  }

  function copyReference() {
    navigator.clipboard?.writeText(result.reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function startOver() {
    setStep(1);
    setPayCur("USD");
    setRecvCur("CAD");
    setAnchor("pay");
    setAmountStr("");
    setBeneficiaryId("");
    setFundMethod("balance");
    setDebitId("");
    setQuote(null);
    setResult(null);
  }

  const rateStatusNote = {
    loading: "Retrieving rate...",
    live: `ECB daily reference rate, ${niceDate(fx.asOf)}`,
    stale: `Unable to refresh. Showing the last available rate (${niceDate(fx.asOf)}).`,
    fallback: "Unable to retrieve the rate. Showing a sample rate.",
  }[fx.status];
  const rateIsWarning = fx.status === "stale" || fx.status === "fallback";

  // ================= STEP 2: CONFIRM & FUND =================
  if (step === 2 && quote) {
    const q = quote;
    return (
      <div className="flex-1 bg-gray-50 p-6 min-w-0">
        <StepHeader step={2} />
        <h1 className="text-xl font-semibold text-gray-900 mb-4">Confirm &amp; fund</h1>

        <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4">
          <p className="text-sm font-medium mb-1">Payment summary</p>
          <Row label="Paying to" value={`${q.beneficiary.name} (${q.beneficiary.bank} ••••${q.beneficiary.last4})`} />
          <Row label="You pay" value={money(q.payCur, q.payAmt)} strong />
          <Row label="Exchange rate" value={`1 ${q.payCur} = ${fmtRate(q.rate)} ${q.recvCur}`} />
          <Row label="They receive" value={money(q.recvCur, q.recvAmt)} strong />
          <p className="text-[11px] text-gray-400 mt-2">{q.rateNote}</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4">
          <p className="text-sm font-medium mb-3">How you're funding this</p>
          {q.fundMethod === "balance" ? (
            <div className="flex gap-3">
              <Wallet className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  We'll use {money(q.payCur, q.payAmt)} from your {q.payCur} balance.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Available now: {money(q.payCur, q.balanceBefore)}. Left after this payment:{" "}
                  {money(q.payCur, q.balanceBefore - q.payAmt)}.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Landmark className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  We'll collect {money(q.payCur, q.payAmt)} from your {q.debit.currency} account at {q.debit.label}.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Make sure the account has enough money, or the payment can't go ahead.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 max-w-xl">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirmPayment}
            className="ml-auto text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 transition-colors"
          >
            Confirm payment
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3 max-w-xl">Demo only: no money is moved.</p>
      </div>
    );
  }

  // ================= STEP 3: DONE =================
  if (step === 3 && quote && result) {
    const q = quote;
    const nextSteps =
      q.fundMethod === "balance"
        ? [
            `We've set aside ${money(q.payCur, q.payAmt)} from your ${q.payCur} balance.`,
            `We send ${money(q.recvCur, q.recvAmt)} to ${q.beneficiary.name}.`,
            "You can follow every step in Reports, under Payment tracker.",
          ]
        : [
            `We collect ${money(q.payCur, q.payAmt)} from your ${q.debit.label} account.`,
            `Once it arrives, we send ${money(q.recvCur, q.recvAmt)} to ${q.beneficiary.name}.`,
            "You can follow every step in Reports, under Payment tracker.",
          ];

    return (
      <div className="flex-1 bg-gray-50 p-6 min-w-0">
        <StepHeader step={3} />

        <div className="bg-white rounded-xl border border-gray-200/70 p-6 max-w-xl">
          <div className="flex flex-col items-center text-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-success mb-3" />
            <h1 className="text-xl font-semibold text-gray-900">Payment submitted</h1>
            <p className="text-sm text-gray-500 mt-1">
              Your payment to {q.beneficiary.name} is on its way to our team.
            </p>
          </div>

          <div className="flex items-center justify-between bg-gray-50 rounded-md px-3.5 py-2.5 mb-4">
            <div>
              <p className="text-[11px] text-gray-400">Reference</p>
              <p className="font-mono text-sm text-gray-900">{result.reference}</p>
            </div>
            <button
              type="button"
              onClick={copyReference}
              aria-label="Copy reference"
              className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mb-5">
            <Row label="You paid" value={money(q.payCur, q.payAmt)} strong />
            <Row label="They receive" value={money(q.recvCur, q.recvAmt)} strong />
          </div>

          <p className="text-sm font-medium mb-2">What happens next</p>
          <ol className="flex flex-col gap-2 mb-6">
            {nextSteps.map((text, i) => (
              <li key={text} className="flex gap-2.5 text-sm text-gray-600">
                <span className="w-5 h-5 shrink-0 rounded-full bg-accent-100 text-accent-800 text-[11px] font-medium flex items-center justify-center">
                  {i + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate("reports")}
              className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
            >
              Track this payment
            </button>
            <button
              type="button"
              onClick={() => onNavigate("dashboard")}
              className="text-sm font-medium text-gray-700 border border-gray-200 px-4 py-2 rounded-md hover:bg-gray-50"
            >
              Back to dashboard
            </button>
            <button
              type="button"
              onClick={startOver}
              className="text-sm font-medium text-accent px-2 py-2 hover:underline"
            >
              Send another payment
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">Demo only: this payment won't appear in Reports.</p>
        </div>
      </div>
    );
  }

  // ================= STEP 1: PAYMENT DETAILS =================
  return (
    <form onSubmit={goToConfirm} className="flex-1 bg-gray-50 p-6 min-w-0">
      <StepHeader step={1} />
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Send a payment</h1>


      {/* Amounts + converter */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2.5 items-end mb-4">
          <div>
            <label htmlFor="pay-amount" className="block text-[11px] text-gray-500 mb-1">You pay</label>
            <div className="flex gap-1.5">
              <select
                aria-label="Currency you pay"
                value={payCur}
                onChange={(e) => changePayCur(e.target.value)}
                className="w-[76px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                id="pay-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={payDisplay}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleAmountChange("pay", e.target.value)}
                onBlur={() => handleAmountBlur("pay")}
                className="min-w-0 flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2 tabular-nums"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={swapCurrencies}
            aria-label="Swap currencies"
            className="mb-0.5 p-2 rounded-full border border-gray-200 text-gray-500 hover:text-accent hover:border-accent transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div>
            <label htmlFor="recv-amount" className="block text-[11px] text-gray-500 mb-1">They receive</label>
            <div className="flex gap-1.5">
              <select
                aria-label="Currency they receive"
                value={recvCur}
                onChange={(e) => changeRecvCur(e.target.value)}
                className="w-[76px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} disabled={c === payCur}>{c}</option>
                ))}
              </select>
              <input
                id="recv-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={recvDisplay}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleAmountChange("recv", e.target.value)}
                onBlur={() => handleAmountBlur("recv")}
                className="min-w-0 flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2 tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Rate: amber highlight when the rate is good; red when it could not be refreshed */}
        <div
          className={`rounded-md px-3 py-2.5 flex items-center justify-between gap-3 mb-4 border-l-4 ${
            rateIsWarning
              ? "bg-danger-100 border-danger"
              : "bg-warning-100 border-warning"
          }`}
        >
          <div>
            <p className={`flex items-center gap-1.5 text-sm font-semibold tabular-nums ${rateIsWarning ? "text-danger" : "text-[#7a4e0b]"}`}>
              {rateIsWarning && <AlertTriangle className="w-4 h-4 shrink-0" />}
              1 {payCur} = {fmtRate(rate)} {recvCur}
              <Tooltip text="A market rate to help you plan. The rate you get is shown on the next step, before you confirm." />
            </p>
            <p className={`text-[11px] mt-0.5 ${rateIsWarning ? "text-danger" : "text-[#7a4e0b]/85"}`}>{rateStatusNote}</p>
          </div>
          <button
            type="button"
            onClick={fx.refresh}
            aria-label="Refresh rate"
            className={`p-1.5 rounded hover:bg-white/60 ${rateIsWarning ? "text-danger" : "text-[#7a4e0b]"}`}
          >
            <RefreshCw className={`w-4 h-4 ${fx.status === "loading" ? "animate-spin" : ""}`} />
          </button>
        </div>

        <label htmlFor="pay-to" className="block text-[11px] text-gray-500 mb-1">Pay to</label>
        <select
          id="pay-to"
          value={beneficiary ? beneficiary.id : ""}
          onChange={(e) => setBeneficiaryId(e.target.value)}
          className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
        >
          <option value="">
            {beneficiaryOptions.length ? "Choose who to pay" : `No ${recvCur} beneficiaries yet`}
          </option>
          {beneficiaryOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} — {b.bank} ••••{b.last4}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Showing approved {recvCur} beneficiaries.{" "}
          <button type="button" onClick={() => onNavigate("beneficiaries")} className="text-accent hover:underline">
            Add a beneficiary
          </button>
        </p>
      </div>

      {/* Funding */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl">
        <p className="text-sm font-medium mb-1">How will you fund this?</p>
        <p className="text-xs text-gray-500 mb-3.5">Choose where the money for this payment comes from.</p>

        <div className="flex flex-col gap-2 mb-3.5">
          {[
            { id: "balance", title: "Fund from an existing balance", desc: `Use money already in your account (${money(payCur, balance)} available)` },
            { id: "debit", title: "Direct debit", desc: "Collect the money directly from your bank" },
          ].map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                fundMethod === opt.id ? "border-accent bg-accent-100" : "border-gray-200 hover:border-accent"
              }`}
            >
              <input
                type="radio"
                name="fund-method"
                checked={fundMethod === opt.id}
                onChange={() => setFundMethod(opt.id)}
                className="accent-accent"
              />
              <div>
                <p className="text-sm font-medium">{opt.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {balanceTooLow && (
          <div role="alert" className="flex gap-2 text-xs text-warning bg-warning-100 rounded-md px-3 py-2.5 mb-3.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>
              Your {payCur} balance is {money(payCur, balance)}, which doesn't cover this payment. Choose Direct
              debit instead, or add funds first.
            </p>
          </div>
        )}

        {/* Only shown when Direct debit is selected */}
        {fundMethod === "debit" && (
          <div className="mb-1">
            <label htmlFor="debit-account" className="block text-[11px] text-gray-500 mb-1">Debit which account?</label>
            <select
              id="debit-account"
              value={debit ? debit.id : ""}
              onChange={(e) => setDebitId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            >
              {debitOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.currency} — {a.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1.5">
              {debitOptions.length > 1
                ? `You have more than one ${payCur} account linked. Pick the exact one so our team doesn't need to follow up.`
                : `This is the only ${payCur} account linked to your profile.`}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canContinue}
            className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </form>
  );
}