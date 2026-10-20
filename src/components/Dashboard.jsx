import { useState, useEffect } from "react";
import { Zap, AlertTriangle, FileText, ArrowLeftRight } from "lucide-react";
import Tooltip from "./Tooltip";
import { CURRENCIES, FLAGS } from "../lib/currencies";
import HistoricalRates from "./HistoricalRates";
import { setPendingQuote } from "../lib/quoteHandoff";
import { useExchangeRate, getRate, round2, parseAmount, fmt2, fmtRate, niceDate } from "../lib/fx";

const QUOTE_SECONDS = 30;
const DELIVERY_TYPES = ["Same day", "Next day", "Standard (2-3 business days)"];

const STATUS_HELP = {
  "Awaiting funds": "We're waiting for your payment to arrive before we can send this.",
  "In transit": "Your payment has been sent and is on its way to the recipient.",
};

const BALANCES = [
  { currency: "USD", flag: "\u{1F1FA}\u{1F1F8}", accountId: "0031201", available: "$0.00", required: "$65,000.00", requiredFlag: true, incoming: "$10,000.00" },
  { currency: "CAD", flag: "\u{1F1E8}\u{1F1E6}", accountId: "0031202", available: "$4,200.00", required: "$0.00", requiredFlag: false, incoming: "$106,444.58", incomingGood: true },
];

const ACTIVITY = [
  { ref: "EBPOTR031499", pay: "CAD 13,839.34", receive: "$10,000.00", status: "Awaiting funds", tone: "warning" },
  { ref: "EBPOTR031305", pay: "$75,000.00", receive: "CAD 106,444.58", status: "In transit", tone: "success" },
];

export default function Dashboard({ onNavigate }) {
  const fx = useExchangeRate();
  const [payCur, setPayCur] = useState("USD");
  const [recvCur, setRecvCur] = useState("CAD");
  const [amountStr, setAmountStr] = useState("");
  const [anchor, setAnchor] = useState("pay"); // the box the user typed in; the other box is calculated and locked
  const [delivery, setDelivery] = useState("Same day");
  const [quote, setQuote] = useState(null); // the locked quote, shown for QUOTE_SECONDS
  const [secondsLeft, setSecondsLeft] = useState(QUOTE_SECONDS);
  const [agreed, setAgreed] = useState(false);

  const rate = getRate(payCur, recvCur, fx.rates);
  const typed = parseAmount(amountStr);
  const payAmt = anchor === "pay" ? typed : round2(typed / rate);
  const recvAmt = anchor === "recv" ? typed : round2(typed * rate);
  const payDisplay = anchor === "pay" ? amountStr : ""; // the other amount only appears in the quote
  const recvDisplay = anchor === "recv" ? amountStr : "";
  const payLocked = amountStr !== "" && anchor !== "pay";
  const recvLocked = amountStr !== "" && anchor !== "recv";
  const rateIsWarning = fx.status === "stale" || fx.status === "fallback";
  const rateNote = {
    loading: "Retrieving rate...",
    live: `ECB daily reference rate, ${niceDate(fx.asOf)}`,
    stale: `Unable to refresh. Showing the last available rate (${niceDate(fx.asOf)}).`,
    fallback: "Unable to retrieve the rate. Showing a sample rate.",
  }[fx.status];

  function changePay(cur) {
    setPayCur(cur);
    if (cur === recvCur) setRecvCur(payCur);
  }
  function changeRecv(cur) {
    setRecvCur(cur);
    if (cur === payCur) setPayCur(recvCur);
  }
  function swap() {
    setPayCur(recvCur);
    setRecvCur(payCur);
    setAnchor((a) => (a === "pay" ? "recv" : "pay"));
  }
  function onAmountChange(side) {
    return (e) => {
      const v = e.target.value.replace(/,/g, "");
      if (/^\d*\.?\d{0,2}$/.test(v)) {
        setAnchor(side);
        setAmountStr(v);
          }
    };
  }
  // Countdown for the locked quote
  useEffect(() => {
    if (!quote || secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [quote, secondsLeft]);

  const expired = quote && secondsLeft <= 0;

  function getQuote(e) {
    e.preventDefault();
    if (payAmt <= 0) return;
    setQuote({ payCur, recvCur, payAmt, recvAmt, rate, anchor, delivery, rateIsWarning, rateNote });
    setSecondsLeft(QUOTE_SECONDS);
    setAgreed(false);
  }
  function cancelQuote() {
    setQuote(null);
    setAgreed(false);
  }
  function buy() {
    if (!quote || expired || !agreed) return;
    setPendingQuote(quote);
    onNavigate("send-payment");
  }

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
      </div>

      {/* Quick Quote + Rate chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-3.5 mb-4">
        <div className="bg-white rounded-xl border border-gray-200/70 p-4 flex flex-col">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
            <Zap className="w-3.5 h-3.5" />
            Quick Quote
            <Tooltip text="See today's exchange rate before committing to anything. Checking a quote is free and doesn't lock you in." />
          </p>

          {!quote ? (
            <form onSubmit={getQuote} className="flex-1 flex flex-col">
              <p className="text-sm font-medium text-accent">Get a quote for a single currency.</p>
              <p id="qq-help" className="text-[11px] text-gray-500 mb-3">
                Enter an amount in either field. The other amount appears in your quote.
                {amountStr !== "" && (
                  <button type="button" onClick={() => setAmountStr("")} className="ml-1.5 text-accent hover:underline">Clear</button>
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <div className="min-w-0">
                  <label htmlFor="qq-pay" className="block text-[11px] font-medium text-accent mb-1">You pay</label>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="You pay currency"
                      value={payCur}
                      onChange={(e) => changePay(e.target.value)}
                      className="w-[100px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-1.5 bg-white"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{FLAGS[c]} {c}</option>
                      ))}
                    </select>
                    <input
                      id="qq-pay"
                      inputMode="decimal"
                      placeholder={payLocked ? "" : "0.00"}
                      value={payDisplay}
                      onChange={onAmountChange("pay")}
                      disabled={payLocked}
                      aria-describedby="qq-help"
                      className="min-w-0 w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 tabular-nums focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap currencies"
                  className="mb-0.5 p-1.5 justify-self-center self-center sm:self-end rounded-full border border-gray-200 text-gray-500 hover:text-accent hover:border-accent"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                </button>
                <div className="min-w-0">
                  <label htmlFor="qq-recv" className="block text-[11px] font-medium text-accent mb-1">They receive</label>
                  <div className="flex gap-1.5">
                    <select
                      aria-label="They receive currency"
                      value={recvCur}
                      onChange={(e) => changeRecv(e.target.value)}
                      className="w-[100px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-1.5 bg-white"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c} value={c}>{FLAGS[c]} {c}</option>
                      ))}
                    </select>
                    <input
                      id="qq-recv"
                      inputMode="decimal"
                      placeholder={recvLocked ? "" : "0.00"}
                      value={recvDisplay}
                      onChange={onAmountChange("recv")}
                      disabled={recvLocked}
                      aria-describedby="qq-help"
                      className="min-w-0 w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 tabular-nums focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end mt-3">
                <div>
                  <label htmlFor="qq-delivery" className="block text-[11px] font-medium text-accent mb-1">Delivery type</label>
                  <select
                    id="qq-delivery"
                    value={delivery}
                    onChange={(e) => setDelivery(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
                  >
                    {DELIVERY_TYPES.map((d) => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={payAmt <= 0}
                  className="w-full text-sm font-medium bg-accent text-white rounded-md py-2 hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Get a quote
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-auto pt-3">Indicative rate only. The rate is confirmed before you buy.</p>
            </form>
          ) : (
            <div role="status">
              <div className={`rounded-md border px-3 py-2 text-center tabular-nums ${quote.rateIsWarning ? "bg-danger-100 border-danger text-danger" : "bg-gray-100 border-gray-200 text-gray-700"}`}>
                <span className="text-xs">{FLAGS[quote.payCur]} {quote.payCur}</span>{" "}
                <span className="text-base font-semibold">1</span>{" "}
                <span className="mx-1 text-gray-400">=</span>{" "}
                <span className="text-base font-semibold">{fmtRate(quote.rate)}</span>{" "}
                <span className="text-xs">{quote.recvCur}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1 text-center">{quote.rateNote.replace(/\.$/, "")}</p>

              <div className="flex gap-4 mt-3 items-start">
                <div className="flex flex-col items-center shrink-0">
                  <p className="text-[10px] text-gray-500 mb-1">Rate expires in</p>
                  <div className="relative w-16 h-16">
                    <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90" aria-hidden="true">
                      <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="5" />
                      <circle
                        cx="32" cy="32" r="28" fill="none"
                        stroke={expired ? "#b42318" : "#00785f"} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 28}
                        strokeDashoffset={2 * Math.PI * 28 * (1 - secondsLeft / QUOTE_SECONDS)}
                        style={{ transition: "stroke-dashoffset 1s linear" }}
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-xl tabular-nums ${expired ? "text-danger" : "text-accent"}`}>
                      {secondsLeft}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm tabular-nums">
                    You pay {quote.payCur} <b>{fmt2(quote.payAmt)}</b><br />They receive {quote.recvCur} <b>{fmt2(quote.recvAmt)}</b>
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Delivery: {quote.delivery}</p>
                  {expired ? (
                    <p className="text-xs text-danger mt-2">This quote has expired. Please request a new quote.</p>
                  ) : (
                    <label className="flex items-start gap-2 mt-2 text-xs text-gray-600 cursor-pointer">
                      <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 accent-[#00785f]" />
                      <span>I understand that by selecting Buy, I agree to purchase this currency at the rate shown. <i className="text-gray-400">(Demo only. No money is moved.)</i></span>
                    </label>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button type="button" onClick={cancelQuote} className="text-xs font-medium text-gray-600 bg-gray-100 rounded-md px-4 py-2 hover:bg-gray-200">
                  {expired ? "New quote" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={buy}
                  disabled={!agreed || expired}
                  className="text-xs font-medium bg-accent text-white rounded-md px-5 py-2 hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Buy
                </button>
              </div>
            </div>
          )}
        </div>

        <HistoricalRates compact />
      </div>

      {/* Balances */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 mb-4 overflow-x-auto">
        <div className="flex items-center justify-between mb-2.5 min-w-[560px]">
          <p className="text-xs text-gray-500">Holding accounts &amp; balances</p>
          <button className="flex items-center gap-1 text-xs text-accent hover:underline">
            <FileText className="w-3.5 h-3.5" />
            Download account certificate
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2.5 min-w-[560px] text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Currency</span>
          <span>Account ID</span>
          <span>Available</span>
          <span className="flex items-center gap-1">
            Required
            <Tooltip text="The amount you need to have ready for an upcoming payment." />
          </span>
          <span>Incoming</span>
        </div>

        {BALANCES.map((row, i) => (
          <div
            key={row.accountId}
            className={`grid grid-cols-5 gap-2.5 min-w-[560px] text-sm items-center py-2.5 ${
              i < BALANCES.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span>{row.flag} {row.currency}</span>
            <span className="font-mono text-gray-700">{row.accountId}</span>
            <span>{row.available}</span>
            <span>
              {row.requiredFlag ? (
                <span className="text-danger bg-danger-100 text-xs px-1.5 py-0.5 rounded">
                  {row.required}
                </span>
              ) : (
                row.required
              )}
            </span>
            <span className={row.incomingGood ? "text-success" : ""}>{row.incoming}</span>
          </div>
        ))}
      </div>

      {/* Payments & trades in progress */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 overflow-x-auto">
        <p className="text-xs text-gray-500 mb-2.5 min-w-[480px]">Payments &amp; trades in progress</p>
        <div className="grid grid-cols-4 gap-2 min-w-[480px] text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Reference</span>
          <span>You pay</span>
          <span>They receive</span>
          <span>Status</span>
        </div>
        {ACTIVITY.map((row, i) => (
          <div
            key={row.ref}
            className={`grid grid-cols-4 gap-2 min-w-[480px] text-xs items-center py-2.5 ${
              i < ACTIVITY.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span>{row.ref}</span>
            <span>{row.pay}</span>
            <span>{row.receive}</span>
            <span className="flex items-center gap-1">
              {row.tone === "warning" && <AlertTriangle className="w-3 h-3 text-warning" />}
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded ${
                  row.tone === "warning"
                    ? "text-warning bg-warning-100"
                    : "text-success bg-success-100"
                }`}
              >
                {row.status}
              </span>
              <Tooltip text={STATUS_HELP[row.status]} side="right" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}