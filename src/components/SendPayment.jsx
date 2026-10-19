import { useState } from "react";
import { ArrowRight,ShieldCheck,CheckCircle2 } from "lucide-react";

const DEBIT_ACCOUNTS = [
  { id: "usd-rbc", label: "USD \u2014 RBC \u20224231", available: "Available: $0.00" },
  { id: "cad-rbc", label: "CAD \u2014 RBC \u20224410", available: "Available: $0.00" },
  { id: "cad-td", label: "CAD \u2014 TD \u20228827", available: "Available: $4,200.00" },
];

const RATES = {
  "USD-CAD": 1.3839,
  "CAD-USD": 0.7226,
};

export default function SendPayment({ onNavigate }) {
  const [step, setStep] = useState(1); // 1: Details, 2: Confirm & Fund, 3: Done
  const [fundMethod, setFundMethod] = useState("balance");
  const [debitAccount, setDebitAccount] = useState(DEBIT_ACCOUNTS[2].id);

  // Currency selection states
  const [payCurrency, setPayCurrency] = useState("USD");
  const [receiveCurrency, setReceiveCurrency] = useState("CAD");
  const [payAmount, setPayAmount] = useState("10000");

  const handlePayCurrencyChange = (val) => {
    setPayCurrency(val);
    if (val === receiveCurrency) {
      setReceiveCurrency(val === "USD" ? "CAD" : "USD");
    }
  };

  const handleReceiveCurrencyChange = (val) => {
    setReceiveCurrency(val);
    if (val === payCurrency) {
      setPayCurrency(val === "USD" ? "CAD" : "USD");
    }
  };

  const rateKey = `${payCurrency}-${receiveCurrency}`;
  const currentRate = RATES[rateKey] || 1.3839;
  const numericPay = parseFloat(payAmount) || 0;
  const calculatedReceive = (numericPay * currentRate).toFixed(2);

  return (
    <div className="flex-1 bg-gray-50 p-6 min-w-0">
      {/* Step Indicator */}
      <div className="flex items-center gap-2.5 text-xs mb-5">
        <span className={`font-semibold ${step === 1 ? "text-gray-900" : "text-gray-400"}`}>① Payment details</span>
        <span className="text-gray-400">—</span>
        <span className={`font-semibold ${step === 2 ? "text-gray-900" : "text-gray-400"}`}>② Confirm &amp; fund</span>
        <span className="text-gray-400">—</span>
        <span className={`font-semibold ${step === 3 ? "text-gray-900" : "text-gray-400"}`}>③ Done</span>
      </div>

      <h1 className="text-xl font-semibold text-gray-900 mb-4.5 mt-5">
        {step === 1 && "Send a payment"}
        {step === 2 && "Confirm and fund payment"}
        {step === 3 && "Payment submitted"}
      </h1>

      {/* STEP 1: PAYMENT DETAILS */}
      {step === 1 && (
        <>
          <div className="bg-white rounded-lg p-5 max-w-2xl mb-4 shadow-sm border border-gray-100">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2.5 items-end mb-4">
              <div>
                <label className="block text-[11px] text-gray-500 mb-1">You pay</label>
                <div className="flex gap-1.5">
                  <select
                    value={payCurrency}
                    onChange={(e) => handlePayCurrencyChange(e.target.value)}
                    className="w-[90px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2"
                  >
                    <option value="USD">{"\u{1F1FA}\u{1F1F8}"} USD</option>
                    <option value="CAD">{"\u{1F1E8}\u{1F1E6}"} CAD</option>
                  </select>
                  <input
                    type="text"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2"
                  />
                </div>
              </div>

              <ArrowRight className="w-4 h-4 text-gray-400 mb-2.5" />

              <div>
                <label className="block text-[11px] text-gray-500 mb-1">They receive</label>
                <div className="flex gap-1.5">
                  <select
                    value={receiveCurrency}
                    onChange={(e) => handleReceiveCurrencyChange(e.target.value)}
                    className="w-[90px] shrink-0 text-sm border border-gray-200 rounded-md px-1.5 py-2"
                  >
                    <option value="CAD">{"\u{1F1E8}\u{1F1E6}"} CAD</option>
                    <option value="USD">{"\u{1F1FA}\u{1F1F8}"} USD</option>
                  </select>
                  <input
                    type="text"
                    value={calculatedReceive}
                    disabled
                    className="flex-1 text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-gray-50 text-gray-400"
                  />
                </div>
              </div>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] text-gray-500 mb-1">Pay to</label>
              <select className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2">
                <option>Test Company Inc — TD Bank •5678</option>
              </select>
            </div>

            <div className="bg-accent-100 rounded-md px-3 py-2.5">
              <p className="text-xs text-accent-800">
                Rate {currentRate} · They receive {receiveCurrency} {calculatedReceive} for every {payCurrency} {payAmount || 0} you send
              </p>
            </div>
          </div>

          {/* Funding card */}
          <div className="bg-white rounded-lg p-5 max-w-2xl mb-4 shadow-sm border border-gray-100">
            <p className="text-sm font-medium mb-1">How will you fund this?</p>
            <p className="text-xs text-gray-500 mb-3.5">
              Choose the account this payment should come from.
            </p>

            <div className="flex flex-col gap-2 mb-3.5">
              {[
                { id: "balance", title: "Fund from an existing balance", desc: "Use funds already sitting in one of your accounts" },
                { id: "debit", title: "Direct debit", desc: "Pull funds directly from your bank" },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-2.5 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
                    fundMethod === opt.id
                      ? "border-accent bg-accent-100"
                      : "border-gray-200 hover:border-accent"
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

            {/* CONDITIONAL DEBIT SELECTOR */}
            {fundMethod === "debit" && (
              <div className="mb-3.5">
                <label className="block text-[11px] text-gray-500 mb-1">Debit which account?</label>
                <select
                  value={debitAccount}
                  onChange={(e) => setDebitAccount(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2"
                >
                  {DEBIT_ACCOUNTS.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.label} ({acc.available})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  You hold CAD at more than one bank — pick the exact account so our team
                  doesn&apos;t need to follow up with you.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4.5">
              <button
                type="button"
                onClick={() => onNavigate("dashboard")}
                className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800"
              >
                Continue
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 2: CONFIRM & FUND */}
      {step === 2 && (
        <div className="bg-white rounded-lg p-5 max-w-2xl mb-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5 text-amber-800 text-xs">
            <ShieldCheck className="w-5 h-5 shrink-0 text-amber-600" />
            <span>Please review your transfer details carefully before final authorization.</span>
          </div>
          <div className="space-y-2.5 text-xs text-gray-600 mb-4.5 bg-gray-50 p-3.5 rounded-md border border-gray-200">
            <div className="flex justify-between">
              <span>You pay:</span>
              <span className="font-semibold text-gray-900">{payCurrency} {payAmount}</span>
            </div>
            <div className="flex justify-between">
              <span>They receive:</span>
              <span className="font-semibold text-gray-900">{receiveCurrency} {calculatedReceive}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchange Rate:</span>
              <span className="font-semibold text-gray-900">1 {payCurrency} = {currentRate} {receiveCurrency}</span>
            </div>
            <div className="flex justify-between">
              <span>Funding Source:</span>
              <span className="font-semibold text-gray-900">
                {fundMethod === "balance" ? "Existing Balance" : `Direct Debit (${debitAccount})`}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800"
            >
              Confirm &amp; Execute
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: DONE */}
      {step === 3 && (
        <div className="bg-white rounded-lg p-8 max-w-2xl text-center shadow-sm border border-gray-100">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Payment Order Received</h2>
          <p className="text-xs text-gray-500 mb-6">
            Your transfer of <span className="font-semibold text-gray-800">{payCurrency} {payAmount}</span> has been successfully queued for processing.
          </p>

          <div className="bg-gray-50 p-4 rounded-lg text-left text-xs space-y-2 mb-6 max-w-md mx-auto border border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-500">Reference ID:</span>
              <span className="font-mono font-medium text-gray-800">FX-2026-89421</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estimated Delivery:</span>
              <span className="font-medium text-gray-800">Today, 4:00 PM EST</span>
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button
            type="button"
            onClick={() => onNavigate("dashboard")}
            className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800"
          >
            Return to Dashboard
          </button>
          </div>
        </div>
      )}
    </div>
  );
}