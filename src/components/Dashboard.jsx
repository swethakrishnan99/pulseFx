import { Zap, ArrowUpRight, AlertTriangle, FileText,ArrowRight, } from "lucide-react";
import RateSparkline from "./RateSparkline";
import Tooltip from "./Tooltip";
import { useState } from "react";

const STATUS_HELP = {
  "Awaiting funds": "We're waiting for your payment to arrive before we can send this.",
  "In transit": "Your payment has been sent and is on its way to the recipient.",
};

const RATE_POINTS = [
  { x: 0, y: 30 }, { x: 20, y: 29 }, { x: 40, y: 30 }, { x: 60, y: 26 },
  { x: 80, y: 27 }, { x: 100, y: 22 }, { x: 120, y: 24 }, { x: 140, y: 17 },
  { x: 160, y: 19 }, { x: 180, y: 12 }, { x: 200, y: 10 }, { x: 220, y: 6 },
];

const BALANCES = [
  { currency: "USD", flag: "\u{1F1FA}\u{1F1F8}", bank: "RBC", available: "$0.00", required: "$65,000.00", requiredFlag: true, incoming: "$10,000.00" },
  { currency: "CAD", flag: "\u{1F1E8}\u{1F1E6}", bank: "RBC", available: "$0.00", required: "$0.00", requiredFlag: false, incoming: "$106,444.58", incomingGood: true },
  { currency: "CAD", flag: "\u{1F1E8}\u{1F1E6}", bank: "TD", available: "$4,200.00", required: "$0.00", requiredFlag: false, incoming: "\u2014" },
];

const ACTIVITY = [
  { ref: "EBPOTR031499", pay: "CAD 13,839.34", receive: "$10,000.00", status: "Awaiting funds", tone: "warning" },
  { ref: "EBPOTR031305", pay: "$75,000.00", receive: "CAD 106,444.58", status: "In transit", tone: "success" },
];

export default function Dashboard({ onNavigate }) {
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="flex-1 bg-gray-50 p-6 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-gray-900 mt-5">Dashboard</h1>  
      </div>

      {/* Quick Quote + Rate chart */}
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-3.5 mb-4">
        <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100 shadow-sm border border-gray-100">
          <p className="flex items-center gap-1.5 text-xs text-gray-500 mb-2.5">
            <Zap className="w-3.5 h-3.5" />
            Quick Quote
            <Tooltip text="See today's exchange rate before committing to anything — checking a quote is free and doesn't lock you in." />
          </p>
          <div className="grid items-start">
            <div>
         <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-end mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 font-medium">You pay</label>
                <div className="flex gap-1.5">
                  <select className="w-[80px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white">
                    <option>{"\u{1F1FA}\u{1F1F8}"} USD</option>
                  </select>
                  <input
                    type="text"
                    defaultValue="10,000.00"
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white font-medium"
                  />
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-400 mb-2.5" />
              <div>
                <label className="block text-[11px] text-gray-500 mb-1 font-medium">They receive</label>
                <div className="flex gap-1.5">
                  <select className="w-[80px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2 bg-white">
                    <option>{"\u{1F1E8}\u{1F1E6}"} CAD</option>
                  </select>
                  <input
                    type="text"
                    defaultValue="13,839.34"
                    disabled
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-gray-100 text-gray-500"
                  />
                </div>
              </div>
            </div>
            </div>
            <button onClick={() => setShowQuoteModal(true)} className="text-xs font-medium bg-accent text-white rounded-md py-2 hover:bg-accent-800">
              Get a quote
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100">
          <div className="flex items-baseline justify-between mb-0.5">
            <p className="flex items-center gap-1 text-xs text-gray-500">
              USD / CAD
              <Tooltip text="Shows how the exchange rate has moved recently, so you can spot a good time to convert." />
            </p>
            <span className="flex items-center gap-0.5 text-xs text-success">
              <ArrowUpRight className="w-3 h-3" />
              0.2%
            </span>
          </div>
          <p className="text-lg font-medium mb-1.5">1.3841</p>
          <RateSparkline points={RATE_POINTS} />
        </div>
      </div>

      {/* Balances */}
      <div className="bg-white rounded-lg p-3.5 mb-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs text-gray-500">Holding accounts &amp; balances</p>
          <button className="flex items-center gap-1 text-xs text-accent hover:underline">
            <FileText className="w-3.5 h-3.5" />
            Download account certificate
          </button>
        </div>

        <div className="grid grid-cols-5 gap-2.5 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Currency</span>
          <span>Bank</span>
          <span>Available</span>
          <span className="flex items-center gap-1">
            Required
            <Tooltip text="The amount you need to have ready for an upcoming payment." />
          </span>
          <span>Incoming</span>
        </div>

        {BALANCES.map((row, i) => (
          <div
            key={`${row.currency}-${row.bank}`}
            className={`grid grid-cols-5 gap-2.5 text-sm items-center py-2.5 ${
              i < BALANCES.length - 1 ? "border-b border-gray-100" : ""
            }`}
          >
            <span>{row.flag} {row.currency}</span>
            <span>{row.bank}</span>
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
      <div className="bg-white rounded-lg p-3.5 shadow-sm border border-gray-100">
        <p className="text-xs text-gray-500 mb-2.5">Payments &amp; trades in progress</p>
        <div className="grid grid-cols-4 gap-2 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5">
          <span>Reference</span>
          <span>You pay</span>
          <span>They receive</span>
          <span>Status</span>
        </div>
        {ACTIVITY.map((row, i) => (
          <div
            key={row.ref}
            className={`grid grid-cols-4 gap-2 text-xs items-center py-2.5 ${
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
      {/* GET QUOTE POPUP MODAL (Matches Attached Design) */}
      {showQuoteModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 border border-gray-100 relative">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-5">
              <h2 className="text-lg font-bold text-gray-900 tracking-tight">Your Quote</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowQuoteModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quote details grid matching design */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-2">
                    <span>🏦</span> Test Company Inc
                  </div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Total to pay</p>
                  <p className="text-xl font-bold text-gray-900 mb-3">CAD 500.00</p>
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">FX Cost</p>
                  <p className="text-sm font-semibold text-gray-700">USD 353.66</p>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 flex flex-col items-center justify-center text-center">
                <p className="text-sm font-bold text-gray-900 mb-1">1 USD = 1.4138 CAD</p>
                <p className="text-[11px] text-gray-500 mb-3">Rate expires in:</p>
                {/* Circular timer indicator mockup */}
                <div className="w-14 h-14 rounded-full border-4 border-danger flex items-center justify-center text-danger font-bold text-lg bg-danger-100/30">
                  3
                </div>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <label className="flex items-start gap-2.5 mb-6 cursor-pointer bg-amber-50/50 p-3 rounded-lg border border-amber-200/60">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span className="text-xs text-gray-700 leading-relaxed font-medium">
                I understand that by selecting Buy, I enter into a binding contract to purchase the currency.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 mb-4">
              <button
                type="button"
                disabled={!agreed}
                onClick={() => {
                  alert("Quote executed successfully! (Demo mode)");
                  setShowQuoteModal(false);
                }}
                className="w-full bg-success text-white font-semibold py-3 rounded-xl hover:opacity-95 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => setShowQuoteModal(false)}
                className="w-full bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-xl hover:bg-gray-200 transition-all text-xs"
              >
                Decline
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-3 border-t border-gray-100">
              <button onClick={() => setShowQuoteModal(false)} className="hover:underline">
                RETURN TO SETUP PAYMENTS
              </button>
              <button onClick={() => setShowQuoteModal(false)} className="hover:underline">
                DECLINE AND RETURN TO DASHBOARD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}