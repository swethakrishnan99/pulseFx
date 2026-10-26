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
import { readPendingQuote, clearPendingQuote, readPendingBeneficiary, clearPendingBeneficiary, readPendingPayFrom, clearPendingPayFrom } from "../lib/quoteHandoff";
import { useExchangeRate, getRate, round2, parseAmount, fmt2, fmtRate, niceDate } from "../lib/fx";

import { CURRENCIES, FLAGS } from "../lib/currencies";
import { getBankAccounts, isVerified, setPendingTab } from "../lib/bankAccounts";
const money = (cur, n) => `${cur} ${fmt2(n)}`;

const CONVERT_REASONS = [
  "Prepare for an upcoming payment",
  "Lock in an exchange rate",
  "Rebalance my currencies",
  "Other",
];
const REASONS = [
  "Supplier or invoice payment",
  "Services",
  "Payroll",
  "Rent or lease",
  "Taxes",
  "Loan repayment",
  "Other",
];
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const prettyDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
};

// Demo data. It mirrors the Beneficiaries and Accounts pages.
const BENEFICIARIES = [
  { id: "1", name: "Test Company Inc", currency: "CAD", bank: "TD Bank", last4: "5678" },
  { id: "2", name: "Maple Supply Co.", currency: "CAD", bank: "RBC Royal Bank", last4: "8842" },
  { id: "3", name: "Lone Star Logistics", currency: "USD", bank: "Chase", last4: "4127" },
  { id: "4", name: "Rhein Components GmbH", currency: "EUR", bank: "Deutsche Bank", last4: "3390" },
  { id: "5", name: "Thames Trading Ltd", currency: "GBP", bank: "Barclays", last4: "7714" },
  { id: "6", name: "Harbour Imports Pty", currency: "AUD", bank: "Commonwealth Bank", last4: "2086" },
  { id: "7", name: "Azteca Manufactura SA", currency: "MXN", bank: "BBVA México", last4: "5521" },
]; // approved beneficiaries only
// Holding accounts (mirrors the Accounts page). Only accounts in the currency being paid are offered.
const HOLDING = [
  { id: "usd-rbc", currency: "USD", accountId: "0031201", balance: 0 },
  { id: "cad-td", currency: "CAD", accountId: "0031202", balance: 4200 },
  { id: "eur-rbc", currency: "EUR", accountId: "0031203", balance: 0 },
  { id: "gbp-rbc", currency: "GBP", accountId: "0031204", balance: 0 },
  { id: "aud-rbc", currency: "AUD", accountId: "0031205", balance: 0 },
  { id: "mxn-rbc", currency: "MXN", accountId: "0031206", balance: 0 },
];
// Bank accounts at the client's own bank, linked for direct debit. These are NOT PulseFX holding accounts.
// Holding accounts are identified by their PulseFX account ID; bank accounts by bank name and last 4 digits.
const acctLabel = (a) => (a.accountId ? a.accountId : `${a.bank} ••••${a.last4}`);

function StepHeader({ step, convert }) {
  const items = [
    { n: "①", label: convert ? "Conversion details" : "Payment details" },
    { n: "②", label: convert ? "Confirm" : "Confirm & fund" },
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
  // Coming from the Beneficiaries page ("Pay"): the person to pay and their currency are already decided.
  const [fixedBen, setFixedBen] = useState(() => {
    const pb = readPendingBeneficiary();
    return pb ? BENEFICIARIES.find((b) => b.name === pb.name && b.last4 === pb.last4) ?? null : null;
  });
  // Coming from Accounts ("Pay"): that account, and so the currency you pay in, is already chosen.
  const [pendingConvertMode] = useState(() => readPendingPayFrom()?.convert === true);
  const [convert, setConvert] = useState(pendingConvertMode); // false = send to someone, true = convert into my own account
  const [toId, setToId] = useState("");
  const [payFromAcct] = useState(() => {
    const pf = readPendingPayFrom();
    return pf ? HOLDING.find((a) => a.id === pf.fromId) ?? null : null;
  });
  useEffect(() => () => { clearPendingQuote(); clearPendingBeneficiary(); clearPendingPayFrom(); }, []);
  const [step, setStep] = useState(1);
  const [payCur, setPayCur] = useState(bought?.payCur ?? payFromAcct?.currency ?? (fixedBen?.currency === "USD" ? "CAD" : "USD"));
  const [recvCur, setRecvCur] = useState(bought?.recvCur ?? fixedBen?.currency ?? (payFromAcct?.currency === "CAD" ? "USD" : "CAD"));
  // Whichever box the user typed in last is the "anchor"; the other box is calculated from it.
  const [anchor, setAnchor] = useState(bought?.anchor ?? "pay");
  const [amountStr, setAmountStr] = useState(
    bought ? (bought.anchor === "pay" ? bought.payAmt : bought.recvAmt).toFixed(2) : ""
  );
  const [beneficiaryId, setBeneficiaryId] = useState(fixedBen?.id ?? "");
  const [payDate, setPayDate] = useState(todayIso);
  const [reason, setReason] = useState("");
  const [fundMethod, setFundMethod] = useState("holding"); // "holding" = from a PulseFX holding account, "debit" = direct debit from your bank
  const [debitId, setDebitId] = useState("");
  const [fromId, setFromId] = useState(payFromAcct?.id ?? "");
  const [reference, setReference] = useState("");
  const [quote, setQuote] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fx = useExchangeRate();
  const rate = getRate(payCur, recvCur, fx.rates);

  // ---- amounts (derived, so they always stay in sync with the rate and currencies) ----
  const typed = parseAmount(amountStr);
  const payAmt = anchor === "pay" ? typed : round2(typed / rate);
  const recvAmt = anchor === "recv" ? typed : round2(typed * rate);
  const payDisplay = anchor === "pay" ? amountStr : amountStr === "" ? "" : fmt2(payAmt);
  const recvDisplay = anchor === "recv" ? amountStr : amountStr === "" ? "" : fmt2(recvAmt);

  // ---- options that depend on the chosen currencies ----
  const beneficiaryOptions = BENEFICIARIES.filter((b) => b.currency === recvCur);
  const locked = fixedBen !== null; // beneficiary chosen on the Beneficiaries page
  const beneficiary = beneficiaryOptions.find((b) => b.id === beneficiaryId) ?? null;

  const sameCur = payCur === recvCur;
  const dateOk = payDate !== "" && payDate >= todayIso() && ![0, 6].includes(new Date(`${payDate}T12:00:00`).getDay());
  const fromOptions = HOLDING.filter((a) => a.currency === payCur);
  // The chosen account, or (if none chosen yet) the one with the most money in it.
  const fromAcct =
    fromOptions.find((a) => a.id === fromId) ??
    [...fromOptions].sort((a, b) => b.balance - a.balance)[0] ??
    null;
  const balance = fromAcct ? fromAcct.balance : 0;
  const useDebit = fundMethod === "debit";
  const payCurBanks = getBankAccounts().filter((a) => a.currency === payCur);
  const debitOptions = payCurBanks.filter(isVerified); // only accounts PulseFX has verified
  const waitingBanks = payCurBanks.length - debitOptions.length;
  const debitAcct = debitOptions.find((a) => a.id === debitId) ?? debitOptions[0] ?? null;
  const balanceTooLow = !useDebit && payAmt > 0 && payAmt > balance;
  // Convert mode: the money lands in one of your own holding accounts (in the receive currency).
  const toOptions = HOLDING.filter((a) => a.currency === recvCur);
  const toAcct = toOptions.find((a) => a.id === toId) ?? toOptions[0] ?? null;
  const canContinue = convert
    ? payAmt > 0 && recvAmt > 0 && !sameCur && toAcct !== null && dateOk && reason !== "" && !balanceTooLow && (!useDebit || debitAcct !== null)
    : payAmt > 0 && recvAmt > 0 && beneficiary !== null && dateOk && reason !== "" && !balanceTooLow && (!useDebit || debitAcct !== null);

  function chooseMode(toConvert) {
    setConvert(toConvert);
    setReason(""); // the reasons differ between sending and converting
    if (toConvert) {
      setFixedBen(null);
      setBeneficiaryId("");
      if (payCur === recvCur) setRecvCur(CURRENCIES.find((c) => c !== payCur));
    }
  }

  // ---- handlers ----
  // Paying and receiving in the same currency is allowed (no conversion).
  function changePayCur(c) {
    setPayCur(c);
  }

  function changeRecvCur(c) {
    setRecvCur(c);
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
      convert,
      toAcct: convert ? toAcct : null,
      beneficiary,
      sameCur,
      payDate,
      reason,
      reference: reference.trim(),
      balanceBefore: balance,
      fromAcct,
      useDebit,
      debitAcct: useDebit ? debitAcct : null,
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
    setFixedBen(null);
    setConvert(false);
    setToId("");
    setPayDate(todayIso());
    setReason("");
    setFromId("");
    setFundMethod("holding");
    setDebitId("");
    setReference("");
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
      <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
        <StepHeader step={2} convert={q.convert} />
        <h1 className="text-xl font-semibold text-gray-900 mb-4">{q.convert ? "Confirm conversion" : "Confirm &amp; fund"}</h1>

        <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4">
          <p className="text-sm font-medium mb-1">{q.convert ? "Conversion summary" : "Payment summary"}</p>
          {q.convert ? (
            <>
              <Row label="From" value={q.useDebit ? `${q.payCur} bank account ${acctLabel(q.debitAcct)} (direct debit)` : `${q.payCur} holding account ${acctLabel(q.fromAcct)}`} />
              <Row label="Into" value={`${q.recvCur} holding account ${acctLabel(q.toAcct)}`} />
            </>
          ) : (
            <Row label="Paying to" value={`${q.beneficiary.name} (${q.beneficiary.bank} ••••${q.beneficiary.last4})`} />
          )}
          <Row label={q.convert ? "You convert" : "You pay"} value={money(q.payCur, q.payAmt)} strong />
          {q.sameCur ? (
            <Row label="Currency conversion" value="Not needed (same currency)" />
          ) : (
            <Row label="Exchange rate" value={`1 ${q.payCur} = ${fmtRate(q.rate)} ${q.recvCur}`} />
          )}
          <Row label={q.convert ? "You receive" : "They receive"} value={money(q.recvCur, q.recvAmt)} strong />
          <Row label={q.convert ? "Conversion date" : "Payment date"} value={prettyDate(q.payDate)} />
          <Row label={q.convert ? "Reason for conversion" : "Reason for payment"} value={q.reason} />
          {q.reference && <Row label={q.convert ? "Reference" : "Payment reference"} value={q.reference} />}
          {!q.sameCur && <p className="text-[11px] text-gray-400 mt-2">{q.rateNote}</p>}
        </div>

        <div className={`${q.convert && !q.useDebit ? "hidden" : ""} bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4`}>
          <p className="text-sm font-medium mb-3">How you're funding this</p>
          {q.useDebit ? (
            <div className="flex gap-3">
              <Landmark className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  We'll collect {money(q.payCur, q.payAmt)} from your bank account {acctLabel(q.debitAcct)} by direct debit.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {q.convert
                    ? "This usually takes 1 to 3 business days. We convert it once the money arrives."
                    : "This usually takes 1 to 3 business days. We send the payment once the money arrives."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Wallet className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-900">
                  We'll use {money(q.payCur, q.payAmt)} from your {q.payCur} holding account {acctLabel(q.fromAcct)}.
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Available now: {money(q.payCur, q.balanceBefore)}. Left after this payment:{" "}
                  {money(q.payCur, q.balanceBefore - q.payAmt)}.
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
            {q.convert ? "Confirm conversion" : "Confirm payment"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3 max-w-xl">Demo only: no money is moved.</p>
      </div>
    );
  }

  // ================= STEP 3: DONE =================
  if (step === 3 && quote && result) {
    const q = quote;
    const nextSteps = q.convert && q.useDebit
      ? [
          `We collect ${money(q.payCur, q.payAmt)} from your bank account ${acctLabel(q.debitAcct)} (1 to 3 business days).`,
          `Once it arrives, we convert it and add ${money(q.recvCur, q.recvAmt)} to your ${q.recvCur} holding account ${acctLabel(q.toAcct)}.`,
          "You can see the new balance on Accounts.",
        ]
      : q.convert
      ? [
          `We take ${money(q.payCur, q.payAmt)} from your ${q.payCur} holding account ${acctLabel(q.fromAcct)}.`,
          `We convert it and add ${money(q.recvCur, q.recvAmt)} to your ${q.recvCur} holding account ${acctLabel(q.toAcct)}.`,
          "You can see the new balance on Accounts.",
        ]
      : [
      q.useDebit
        ? `We collect ${money(q.payCur, q.payAmt)} from your bank account ${acctLabel(q.debitAcct)} (1 to 3 business days).`
        : `We've set aside ${money(q.payCur, q.payAmt)} from your ${q.payCur} holding account ${acctLabel(q.fromAcct)}.`,
      q.useDebit
        ? `Once it arrives, we send ${money(q.recvCur, q.recvAmt)} to ${q.beneficiary.name}.`
        : `We send ${money(q.recvCur, q.recvAmt)} to ${q.beneficiary.name}.`,
      "You can follow every step in Reports, under Payment tracker.",
    ];

    return (
      <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
        <StepHeader step={3} convert={q.convert} />

        <div className="bg-white rounded-xl border border-gray-200/70 p-6 max-w-xl">
          <div className="flex flex-col items-center text-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-success mb-3" />
            <h1 className="text-xl font-semibold text-gray-900">{q.convert ? "Conversion submitted" : "Payment submitted"}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {q.convert ? "Your conversion is on its way to our team." : `Your payment to ${q.beneficiary.name} is on its way to our team.`}
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
            <Row label={q.convert ? "You converted" : "You paid"} value={money(q.payCur, q.payAmt)} strong />
            <Row label={q.convert ? "You receive" : "They receive"} value={money(q.recvCur, q.recvAmt)} strong />
            <Row label={q.convert ? "Conversion date" : "Payment date"} value={prettyDate(q.payDate)} />
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
              onClick={() => onNavigate(q.convert ? "holding-accounts" : "reports")}
              className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
            >
              {q.convert ? "View holding accounts" : "Track this payment"}
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
              {q.convert ? "Convert more" : "Send another payment"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">{q.convert ? "Demo only: balances won't change." : "Demo only: this payment won't appear in Reports."}</p>
        </div>
      </div>
    );
  }

  // ================= STEP 1: PAYMENT DETAILS =================
  return (
    <form onSubmit={goToConfirm} className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <StepHeader step={1} convert={convert} />
      <h1 className="text-xl font-semibold text-gray-900 mb-3">Move Money</h1>

      <div role="tablist" aria-label="What do you want to do?" className="inline-flex p-1 bg-gray-200/70 rounded-lg mb-4 max-w-full">
        {[
          { v: false, label: "Send to someone" },
          { v: true, label: "Convert my money" },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="tab"
            aria-selected={convert === o.v}
            onClick={() => chooseMode(o.v)}
            className={`text-sm font-medium px-4 py-1.5 rounded-md transition-colors ${
              convert === o.v ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {convert && (
        <p className="text-xs text-gray-500 -mt-2 mb-4 max-w-xl">
          Exchange money into another currency. It stays with you, in your own holding account.
        </p>
      )}


      {/* Amounts + converter */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 max-w-xl mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-2.5 items-end mb-4">
          <div>
            <label htmlFor="pay-amount" className="block text-[11px] text-gray-500 mb-1">{convert ? "You convert" : "You pay"}</label>
            <div className="flex gap-1.5">
              <select
                aria-label="Currency you pay"
                value={payCur}
                onChange={(e) => changePayCur(e.target.value)}
                className="w-[100px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{FLAGS[c]} {c}</option>
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
            disabled={locked}
            title={locked ? "Currency is set by the beneficiary" : undefined}
            aria-label="Swap currencies"
            className="mb-0.5 p-2 justify-self-center self-center sm:self-end rounded-full border border-gray-200 text-gray-500 hover:text-accent hover:border-accent transition-colors disabled:opacity-40 disabled:hover:text-gray-500 disabled:hover:border-gray-200 disabled:cursor-not-allowed"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div>
            <label htmlFor="recv-amount" className="block text-[11px] text-gray-500 mb-1">{convert ? "You receive" : "They receive"}</label>
            <div className="flex gap-1.5">
              <select
                aria-label="Currency they receive"
                disabled={locked}
                title={locked ? `Set by the beneficiary (${recvCur})` : undefined}
                value={recvCur}
                onChange={(e) => changeRecvCur(e.target.value)}
                className="w-[100px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{FLAGS[c]} {c}</option>
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

        {sameCur && !convert && (
          <div className="rounded-md px-3 py-2.5 mb-4 border-l-4 bg-gray-50 border-gray-300">
            <p className="text-sm font-semibold text-gray-700">No currency conversion</p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              You are paying and receiving in {payCur}, so the amounts are the same.
            </p>
          </div>
        )}

        {/* Rate: amber highlight when the rate is good; red when it could not be refreshed */}
        <div
          className={`${sameCur ? "hidden" : "flex"} rounded-md px-3 py-2.5 items-center justify-between gap-3 mb-4 border-l-4 ${
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

        {(
          <fieldset className="mb-4">
            <legend className="block text-[11px] text-gray-500 mb-1.5">How will you fund this?</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { id: "holding", title: "Holding account", desc: "Use money you already hold with PulseFX" },
                { id: "debit", title: "Direct debit", desc: "Collect the money from your bank account" },
              ].map((o) => (
                <label
                  key={o.id}
                  className={`flex items-start gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    fundMethod === o.id ? "border-accent bg-accent-100" : "border-gray-200 hover:border-accent"
                  }`}
                >
                  <input
                    type="radio"
                    name="fund-method"
                    checked={fundMethod === o.id}
                    onChange={() => setFundMethod(o.id)}
                    className="accent-accent mt-1"
                  />
                  <div>
                    <p className="text-sm font-medium">{o.title}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{o.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {useDebit ? (
          <div className="mb-4">
            {debitOptions.length > 1 ? (
              <>
                <label htmlFor="debit-account" className="block text-[11px] text-gray-500 mb-1">Debit which bank account?</label>
                <select
                  id="debit-account"
                  value={debitAcct ? debitAcct.id : ""}
                  onChange={(e) => setDebitId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
                >
                  {debitOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {FLAGS[a.currency]} {a.currency} · {acctLabel(a)}
                    </option>
                  ))}
                </select>
              </>
            ) : debitAcct ? (
              <>
                <p className="block text-[11px] text-gray-500 mb-1">Debit from</p>
                <div className="flex gap-3 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Landmark className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900">
                      {FLAGS[debitAcct.currency]} {debitAcct.currency} bank account · {acctLabel(debitAcct)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">This is your only linked {payCur} bank account.</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="border border-dashed border-gray-300 rounded-lg px-3 py-2.5">
                <p className="text-sm text-gray-700">
                  {waitingBanks > 0
                    ? `Your ${payCur} bank account is waiting for PulseFX to verify it. You can use it for direct debit once it's verified.`
                    : `No ${payCur} bank account is linked yet.`}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPendingTab("linked");
                    onNavigate("holding-accounts");
                  }}
                  className="text-xs font-medium text-accent hover:underline mt-1"
                >
                  {waitingBanks > 0 ? "View linked bank accounts" : "Link a bank account"}
                </button>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-1.5">
              We collect the money from your bank, which usually takes 1 to 3 business days. {convert ? "We convert it once it arrives." : "We send the payment once it arrives."}
            </p>
          </div>
        ) : (
          <>
        {fromOptions.length > 1 ? (
          <div className="mb-4">
            <label htmlFor="pay-from" className="block text-[11px] text-gray-500 mb-1">
              {convert ? "Convert from" : "Pay from"}
            </label>
            <select
              id="pay-from"
              value={fromAcct ? fromAcct.id : ""}
              onChange={(e) => setFromId(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            >
              {fromOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {FLAGS[a.currency]} {a.currency} · {acctLabel(a)} · {money(a.currency, a.balance)} available
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1.5">
              You have {fromOptions.length} {payCur} holding accounts. Choose the one to {convert ? "convert" : "pay"} from.
            </p>
          </div>
        ) : fromAcct ? (
          <div className="mb-4">
          <p className="block text-[11px] text-gray-500 mb-1">{convert ? "Convert from" : "Pay from"}</p>
          <div className="flex gap-3 border border-gray-200 rounded-lg px-3 py-2.5 mb-4">
            <Wallet className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-gray-900">
                {FLAGS[fromAcct.currency]} {fromAcct.currency} holding account · {acctLabel(fromAcct)}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {money(payCur, balance)} available. This is your only {payCur} holding account.
              </p>
            </div>
          </div>
          </div>
        ) : null}

        {balanceTooLow && (
          <div role="alert" className="flex gap-2 items-start text-xs text-[#7a4e0b] bg-warning-100 border-l-4 border-warning rounded-md px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p>
              The {acctLabel(fromAcct)} account has {money(payCur, balance)}, which doesn't cover this payment.{fromOptions.length > 1 ? " Choose another account or add funds first." : " Add funds to your holding account first."}
            </p>
          </div>
        )}

          </>
        )}

        {convert ? (
          <>
            {sameCur && (
              <div role="alert" className="flex gap-2 items-start text-xs text-[#7a4e0b] bg-warning-100 border-l-4 border-warning rounded-md px-3 py-2.5 mb-4">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>Choose two different currencies to convert.</p>
              </div>
            )}
            {toOptions.length > 1 ? (
              <div className="mb-1">
                <label htmlFor="recv-into" className="block text-[11px] text-gray-500 mb-1">Receive into</label>
                <select
                  id="recv-into"
                  value={toAcct ? toAcct.id : ""}
                  onChange={(e) => setToId(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
                >
                  {toOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {FLAGS[a.currency]} {a.currency} · {acctLabel(a)} · {money(a.currency, a.balance)} available
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  You have {toOptions.length} {recvCur} holding accounts. Choose the one to receive into.
                </p>
              </div>
            ) : toAcct ? (
              <div className="mb-1">
                <p className="block text-[11px] text-gray-500 mb-1">Receive into</p>
                <div className="flex gap-3 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Wallet className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900">
                      {FLAGS[toAcct.currency]} {toAcct.currency} holding account · {acctLabel(toAcct)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">This is your only {recvCur} holding account.</p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
        <label htmlFor="pay-to" className="block text-[11px] text-gray-500 mb-1">Pay to</label>
        <select
          id="pay-to"
          value={beneficiary ? beneficiary.id : ""}
          onChange={(e) => setBeneficiaryId(e.target.value)}
          disabled={locked}
          className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white disabled:bg-gray-100 disabled:text-gray-700 disabled:cursor-not-allowed"
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
        {locked ? (
          <p className="text-[11px] text-gray-400 mt-1.5">
            Chosen from your Beneficiaries, so the {recvCur} currency is set.{" "}
            <button
              type="button"
              onClick={() => { setFixedBen(null); setBeneficiaryId(""); }}
              className="text-accent hover:underline"
            >
              Pay someone else
            </button>
          </p>
        ) : (
        <p className="text-[11px] text-gray-400 mt-1.5">
          Showing approved {recvCur} beneficiaries.{" "}
          <button type="button" onClick={() => onNavigate("beneficiaries")} className="text-accent hover:underline">
            Add a beneficiary
          </button>
        </p>
        )}

          </>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <div>
            <label htmlFor="pay-date" className="block text-[11px] text-gray-500 mb-1">{convert ? "Conversion date" : "Payment date"}</label>
            <input
              id="pay-date"
              type="date"
              min={todayIso()}
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              aria-invalid={!dateOk}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            />
            {!dateOk && (
              <p className="text-[11px] text-danger mt-1" role="alert">
                Choose today or a future business day (not a weekend).
              </p>
            )}
          </div>
          <div>
            <label htmlFor="pay-reason" className="block text-[11px] text-gray-500 mb-1">{convert ? "Reason for conversion" : "Reason for payment"}</label>
            <select
              id="pay-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
            >
              <option value="">Select a reason</option>
              {(convert ? CONVERT_REASONS : REASONS).map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="pay-ref" className="flex items-center gap-1.5 text-[11px] text-gray-500">
              {convert ? "Reference" : "Payment reference"}
              <Tooltip text={convert ? "A note for your own records." : "A note your beneficiary sees with the payment, such as an invoice number."} />
            </label>
            <span className="text-[11px] text-gray-400">Optional</span>
          </div>
          <input
            id="pay-ref"
            type="text"
            maxLength={35}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={convert ? "Your own reference" : "Custom reference for the beneficiary"}
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white"
          />
          <p className="text-[11px] text-gray-400 mt-1 text-right">{reference.length}/35</p>
        </div>


        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
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