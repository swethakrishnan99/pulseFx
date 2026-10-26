import { useState, useEffect } from "react";
import { Check, Plus, Trash2, CalendarClock, Wallet, ArrowDownToLine, CheckCircle2, AlertTriangle, RefreshCw, FileText, FileSpreadsheet, Printer, Search, SlidersHorizontal, ChevronDown, Info, Download, X } from "lucide-react";
import { FLAGS } from "../lib/currencies";
import { PURPOSES } from "../lib/reasons";

// Demo data: forward contracts the client has already booked. Drawdowns take money out of one of these.
// "sell" is the currency the client pays, "buy" is the currency the client receives, at the locked contract rate.
const dayIso = (n) => {
  const d = new Date(Date.now() + n * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
// original = amount sold when the forward was booked; remaining = still available to draw down.
// type: "Window" forwards can be drawn down any time up to the value date; "Fixed" settle on the value date.
export const FORWARDS = [
  { id: "f1", ref: "PFXFWD-210931", sell: "USD", buy: "CAD", rate: 1.372, entry: dayIso(-75), maturity: dayIso(96), type: "Window", original: 200000, remaining: 150000, deposit: 10000, status: "Open" },
  { id: "f2", ref: "PFXFWD-210478", sell: "CAD", buy: "USD", rate: 0.732, entry: dayIso(-120), maturity: dayIso(54), type: "Window", original: 100000, remaining: 60000, deposit: 5000, status: "Open" },
  { id: "f3", ref: "PFXFWD-209812", sell: "CAD", buy: "USD", rate: 0.7298, entry: dayIso(-30), maturity: dayIso(157), type: "Fixed", original: 220000, remaining: 220000, deposit: 11000, status: "Open" },
  { id: "f5", ref: "PFXFWD-207760", sell: "CAD", buy: "USD", rate: 0.7410, entry: dayIso(-190), maturity: dayIso(-5), type: "Window", original: 60000, remaining: 20000, deposit: 3000, status: "Open" },
  { id: "f4", ref: "PFXFWD-208114", sell: "USD", buy: "CAD", rate: 1.3590, entry: dayIso(-200), maturity: dayIso(-20), type: "Window", original: 80000, remaining: 0, deposit: 0, status: "Closed" },
];

// Approved beneficiaries a drawdown can be paid to (pending ones are left out on purpose).
// Business-day helpers. Currency can't settle on weekends or bank holidays.
const HOLIDAYS = ["2026-12-25", "2026-12-28", "2027-01-01", "2027-02-15", "2027-03-26"];
const isBizDay = (iso) => {
  const d = new Date(`${iso}T12:00:00`).getDay();
  return d !== 0 && d !== 6 && !HOLIDAYS.includes(iso);
};
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nextBizDay = (iso) => { let x = iso; while (!isBizDay(x)) x = plusDays(x, 1); return x; };
const addBizDays = (iso, n) => { let x = iso, left = n; while (left > 0) { x = plusDays(x, 1); if (isBizDay(x)) left--; } return x; };
// A forward is Open only while it has money left and its value date has not passed. Only Window forwards can be drawn down.
const statusOf = (f) => (f.remaining > 0 && f.maturity >= dayIso(0) ? "Open" : "Closed");
export const canDrawdown = (f) => statusOf(f) === "Open" && f.type === "Window";

const BENEFICIARIES = [
  { id: "1", name: "Test Company Inc", currency: "CAD" },
  { id: "2", name: "Maple Supply Co.", currency: "CAD" },
  { id: "3", name: "Lone Star Logistics", currency: "USD" },
];

const HOLDING_ID = { USD: "0031201", CAD: "0031202" };
const HOLDING_BAL = { USD: 0, CAD: 4200 }; // demo balances, same as the Accounts page

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const money = (cur, n) => `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const round2 = (n) => Math.round(n * 100) / 100;
const pretty = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

const STEPS = ["Drawdown details", "Funding & confirm"];

function StepHeader({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mb-5" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const cur = step === n;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`w-5 h-5 rounded-full border flex items-center justify-center text-[11px] ${
                done ? "bg-accent border-accent text-white" : cur ? "border-gray-900 text-gray-900 font-semibold" : "border-gray-300 text-gray-400"
              }`}
            >
              {done ? <Check className="w-3 h-3" /> : n}
            </span>
            <span className={cur ? "font-semibold text-gray-900" : done ? "text-accent" : "text-gray-400"}>{label}</span>
            {n < STEPS.length && <span className="text-gray-300">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

const field = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const lab = "block text-[11px] text-gray-500 mb-1";

function DrawdownForm({ onNavigate, initialFwd = "", onBack }) {
  const [step, setStep] = useState(1);
  const [fwdId, setFwdId] = useState(initialFwd);
  const [sellText, setSellText] = useState("");
  const [buyText, setBuyText] = useState("");
  const [date, setDate] = useState(() => nextBizDay(todayIso()));
  const [reason, setReason] = useState("");
  const [allocs, setAllocs] = useState([]); // [{id, benId, text}]
  const [funding, setFunding] = useState("send"); // "send" | "deposit"
  const [done, setDone] = useState(null);

  useEffect(() => { window.scrollTo?.(0, 0); }, [step, done]);

  const fwd = FORWARDS.find((f) => f.id === fwdId) ?? null;
  const num = (t) => {
    const n = parseFloat(String(t).replace(/,/g, ""));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const sellAmt = num(sellText);
  const buyAmt = num(buyText);
  const options = fwd ? BENEFICIARIES.filter((b) => b.currency === fwd.buy) : [];
  const allocated = round2(allocs.reduce((s, a) => s + num(a.text), 0));
  const overAllocated = allocated > buyAmt + 0.001;
  const credited = Math.max(0, round2(buyAmt - allocated));
  // Funding: a deposit is used first, and whatever it does not cover is sent.
  const depositAvail = fwd ? fwd.deposit : 0;
  const depositUsed = funding === "deposit" ? Math.min(depositAvail, sellAmt) : 0;
  const sendAmt = round2(sellAmt - depositUsed);
  const holdBal = fwd ? HOLDING_BAL[fwd.sell] ?? 0 : 0;
  // The money to send always comes from the client's holding account. If it is short, they move money in first.
  const holdingTooLow = sendAmt > 0 && holdBal < sendAmt;
  const fundOk = !holdingTooLow;
  const allocsOk = !overAllocated && allocs.every((a) => a.benId && num(a.text) > 0);
  const tooMuch = fwd && sellAmt > fwd.remaining;
  const dateOk = fwd && date >= todayIso() && date <= fwd.maturity && isBizDay(date);
  const dateMsg = fwd && date && !isBizDay(date) ? "Weekends and bank holidays aren't available. Choose a business day." : "";
  const step1Ok = fwd && sellAmt > 0 && buyAmt > 0 && !tooMuch && dateOk && reason !== "" && !overAllocated && allocs.every((a) => a.benId && num(a.text) > 0);

  function changeSell(t) {
    setSellText(t);
    const n = num(t);
    setBuyText(n > 0 && fwd ? String(round2(n * fwd.rate)) : "");
  }
  function changeBuy(t) {
    setBuyText(t);
    const n = num(t);
    setSellText(n > 0 && fwd ? String(round2(n / fwd.rate)) : "");
  }


  function addAlloc() {
    setAllocs((a) => [...a, { id: Date.now() + Math.random(), benId: options[0]?.id ?? "", text: "" }]);
  }

  function confirm() {
    fwd.remaining = round2(fwd.remaining - sellAmt);
    fwd.deposit = round2(Math.max(0, fwd.deposit - depositUsed));
    setDone({
      ref: `PFXDD-${String(Math.floor(100000 + Math.random() * 900000))}`,
      fwd, sellAmt, buyAmt, date, reason, funding, depositUsed, sendAmt,
      sendFrom: `your ${fwd.sell} holding account ${HOLDING_ID[fwd.sell] ?? ""}`,
      payments: allocs.map((a) => ({ name: BENEFICIARIES.find((b) => b.id === a.benId)?.name, amt: num(a.text) })),
      credited,
    });
  }

  function reset() {
    setStep(1); setFwdId(""); setSellText(""); setBuyText(""); setDate(nextBizDay(todayIso())); setReason(""); setAllocs([]); setFunding("send"); setDone(null);
  }

  // ---------- Done ----------
  if (done) {
    const d = done;
    return (
      <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
        <div className="bg-white rounded-xl border border-gray-200/70 p-6 max-w-xl">
          <div className="flex flex-col items-center text-center mb-5">
            <CheckCircle2 className="w-12 h-12 text-success mb-2" />
            <h1 className="text-lg font-semibold text-gray-900">Drawdown booked</h1>
            <p className="text-sm text-gray-500">We've sent you a confirmation notification.</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-2.5 mb-4">
            <p className="text-[11px] text-gray-400">Reference</p>
            <p className="font-mono text-sm text-gray-900">{d.ref}</p>
          </div>
          {[
            ["From forward", `${d.fwd.ref} (${d.fwd.sell}/${d.fwd.buy} at ${d.fwd.rate})`],
            ["You sell", money(d.fwd.sell, d.sellAmt)],
            ["You buy", money(d.fwd.buy, d.buyAmt)],
            ["Drawdown date", pretty(d.date)],
            ["Reason", d.reason],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-900 text-right">{v}</span>
            </div>
          ))}
          <p className="text-sm font-medium mt-5 mb-2">What happens next</p>
          <ol className="text-sm text-gray-600 flex flex-col gap-2 mb-5">
            <li className="flex gap-2"><span className="text-accent font-medium">1.</span>{d.depositUsed > 0 ? (d.sendAmt > 0 ? `We apply ${money(d.fwd.sell, d.depositUsed)} from your deposit. We take the other ${money(d.fwd.sell, d.sendAmt)} from ${d.sendFrom}.` : `We apply ${money(d.fwd.sell, d.depositUsed)} from your deposit. It covers the whole amount.`) : `We take ${money(d.fwd.sell, d.sellAmt)} from ${d.sendFrom}.`}</li>
            {d.payments.map((p) => (
              <li key={p.name} className="flex gap-2"><span className="text-accent font-medium">•</span>We pay {money(d.fwd.buy, p.amt)} to {p.name}.</li>
            ))}
            <li className="flex gap-2"><span className="text-accent font-medium">{d.payments.length ? "•" : "2."}</span>{d.credited > 0 ? `We credit ${money(d.fwd.buy, d.credited)} to your ${d.fwd.buy} holding account ${HOLDING_ID[d.fwd.buy] ?? ""}.` : "Nothing is left to credit to your holding account."}</li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate("holding-accounts")} className="text-sm font-medium bg-accent text-white px-4 py-2 rounded-md hover:bg-accent-800">View holding accounts</button>
            <button type="button" onClick={() => onNavigate("dashboard")} className="text-sm font-medium border border-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">Back to dashboard</button>
            <button type="button" onClick={onBack} className="text-sm font-medium text-accent px-3 py-2 hover:underline">Back to forwards</button>
          </div>
          <p className="text-[11px] text-gray-400 mt-4">Demo only: no drawdown is created and balances won't change.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <button type="button" onClick={onBack} className="text-xs font-medium text-accent hover:underline mb-2">&larr; Back to forwards</button>
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Drawdown</h1>
      <p className="text-sm text-gray-500 mb-4 max-w-xl">
        Use some or all of a forward contract you've already booked. The rate is the one you locked in.
      </p>
      <StepHeader step={step} />

      <div className="bg-white rounded-xl border border-gray-200/70 p-5 max-w-xl">
        {/* STEP 1: everything about the drawdown on one page */}
        {step === 1 && (
          <>
            <div className="mb-4">
              <label htmlFor="dd-fwd" className={lab}>Forward contract</label>
              <select
                id="dd-fwd"
                className={field}
                value={fwdId}
                onChange={(e) => { setFwdId(e.target.value); setSellText(""); setBuyText(""); setAllocs([]); }}
              >
                <option value="">Select a forward</option>
                {FORWARDS.filter(canDrawdown).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.ref} · {f.sell}/{f.buy} at {f.rate} · {money(f.sell, f.remaining)} available
                  </option>
                ))}
              </select>
              {fwd && <p className="text-[11px] text-gray-500 mt-1">Matures {pretty(fwd.maturity)}.</p>}
            </div>

            {fwd && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
                  <div>
                    <label htmlFor="dd-sell" className={lab}>You sell ({fwd.sell})</label>
                    <input id="dd-sell" inputMode="decimal" className={field} value={sellText} onChange={(e) => changeSell(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label htmlFor="dd-buy" className={lab}>You buy ({fwd.buy})</label>
                    <input id="dd-buy" inputMode="decimal" className={field} value={buyText} onChange={(e) => changeBuy(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mb-4">Enter either amount. The other fills in at the forward rate.</p>
                {tooMuch && (
                  <p role="alert" className="text-xs text-[#7a4e0b] bg-warning-100 border-l-4 border-warning rounded-md px-3 py-2 mb-4">
                    That is more than the {money(fwd.sell, fwd.remaining)} left on this forward.
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="dd-date" className={lab}>Drawdown date</label>
                    <input id="dd-date" type="date" className={field} value={date} min={todayIso()} max={fwd.maturity} onChange={(e) => setDate(e.target.value)} />
                    <p className={`text-[11px] mt-1 ${dateMsg ? "text-danger" : "text-gray-400"}`} role={dateMsg ? "alert" : undefined}>{dateMsg || `Business days between today and ${pretty(fwd.maturity)}.`}</p>
                  </div>
                  <div>
                    <label htmlFor="dd-reason" className={lab}>Reason for the trade</label>
                    <select id="dd-reason" className={field} value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="">Select a reason</option>
                      {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* Beneficiaries, on the same page */}
                <div className="border-t border-gray-100 mt-5 pt-4">
                  <p className="text-sm font-medium text-gray-900 mb-1">Pay someone from this drawdown (optional)</p>
                  <p className="text-xs text-gray-500 mb-3">
                    {buyAmt > 0
                      ? `You're buying ${money(fwd.buy, buyAmt)}. Anything you don't pay out is credited to your ${fwd.buy} holding account.`
                      : `Anything you don't pay out is credited to your ${fwd.buy} holding account.`}
                  </p>

                  {allocs.map((a) => (
                    <div key={a.id} className="grid grid-cols-[1fr_8rem_auto] gap-2 items-end mb-2">
                      <div>
                        <label className={lab}>Pay to</label>
                        <select className={field} value={a.benId} onChange={(e) => setAllocs((l) => l.map((x) => (x.id === a.id ? { ...x, benId: e.target.value } : x)))}>
                          {options.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={lab}>Amount ({fwd.buy})</label>
                        <input inputMode="decimal" className={field} value={a.text} placeholder="0.00" onChange={(e) => setAllocs((l) => l.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)))} />
                      </div>
                      <button type="button" aria-label="Remove payment" onClick={() => setAllocs((l) => l.filter((x) => x.id !== a.id))} className="p-2 text-gray-400 hover:text-danger">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {options.length === 0 ? (
                    <p className="text-xs text-gray-500">You have no approved {fwd.buy} beneficiaries yet.</p>
                  ) : (
                    <button type="button" onClick={addAlloc} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mt-1">
                      <Plus className="w-3.5 h-3.5" />
                      {allocs.length ? "Add another payment" : "Add a payment"}
                    </button>
                  )}

                  {buyAmt > 0 && (
                    <div className="mt-3 bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
                      <div className="flex justify-between py-1"><span className="text-gray-500">Paid out</span><span>{money(fwd.buy, allocated)}</span></div>
                      <div className="flex justify-between py-1"><span className="text-gray-500">Credited to holding account</span><span className={overAllocated ? "text-danger" : ""}>{money(fwd.buy, credited)}</span></div>
                    </div>
                  )}
                  {overAllocated && (
                    <p role="alert" className="text-xs text-danger mt-2">The payments add up to more than the {money(fwd.buy, buyAmt)} you're buying.</p>
                  )}
                </div>
              </>
            )}

            <div className="flex justify-end mt-5">
              <button type="button" disabled={!step1Ok} onClick={() => setStep(2)} className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
            </div>
          </>
        )}

        {/* STEP 2: funding and confirm */}
        {step === 2 && fwd && (
          <>
            <fieldset>
              <legend className="text-sm font-medium text-gray-900 mb-1">How will you fund the {money(fwd.sell, sellAmt)}?</legend>
              <p className="text-xs text-gray-500 mb-3">Pay it all from your holding account, or use your deposit first. If the deposit doesn't cover it all, the rest comes from your holding account.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "send", icon: Wallet, title: "Send the funds", desc: "Take the full amount from your holding account" },
                  { id: "deposit", icon: ArrowDownToLine, title: "Use a deposit", desc: depositAvail > 0 ? `${money(fwd.sell, depositAvail)} deposit available` : "No deposit available on this forward" },
                ].map((o) => {
                  const Icon = o.icon;
                  return (
                    <label key={o.id} className={`flex gap-2.5 border rounded-lg px-3 py-2.5 transition-colors ${o.id === "deposit" && depositAvail <= 0 ? "opacity-50 cursor-not-allowed border-gray-200" : `cursor-pointer ${funding === o.id ? "border-accent bg-accent-100" : "border-gray-200 hover:border-accent"}`}`}>
                      <input type="radio" name="fund" checked={funding === o.id} disabled={o.id === "deposit" && depositAvail <= 0} onChange={() => setFunding(o.id)} className="mt-1 accent-accent" />
                      <div>
                        <p className="text-sm text-gray-900 flex items-center gap-1.5"><Icon className="w-4 h-4 text-accent" />{o.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{o.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {funding === "deposit" && depositUsed > 0 && (
              <div className="mt-3 border border-gray-200 rounded-lg px-4 py-2.5 text-sm" data-testid="fund-split">
                <div className="flex justify-between py-1"><span className="text-gray-500">From your deposit</span><span>{money(fwd.sell, depositUsed)}</span></div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">You send</span>
                  <span className={sendAmt > 0 ? "font-medium text-gray-900" : "text-gray-900"}>{sendAmt > 0 ? money(fwd.sell, sendAmt) : "Nothing, the deposit covers it"}</span>
                </div>
                {sendAmt > 0 && <p className="text-[11px] text-gray-500 mt-1">Your deposit doesn't cover the full {money(fwd.sell, sellAmt)}, so you send the remaining {money(fwd.sell, sendAmt)}.</p>}
              </div>
            )}

            {sendAmt > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-900 mb-2">Paying the {money(fwd.sell, sendAmt)}</p>
                <div className={`flex gap-2.5 border rounded-lg px-3 py-2.5 ${holdingTooLow ? "border-danger bg-danger-100" : "border-accent bg-accent-100"}`}>
                  <Wallet className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-900">From your {fwd.sell} holding account {HOLDING_ID[fwd.sell] ?? ""}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Balance {money(fwd.sell, holdBal)}</p>
                  </div>
                </div>
                {holdingTooLow && (
                  <div role="alert" className="flex gap-2 items-start bg-danger-100 border-l-4 border-danger rounded-md px-3 py-2.5 mt-3">
                    <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-800">
                      Your {fwd.sell} holding account doesn't have enough money. You need {money(fwd.sell, sendAmt)} but have {money(fwd.sell, holdBal)}. Move {money(fwd.sell, round2(sendAmt - holdBal))} more into your holding account first, then come back to complete this drawdown.{" "}
                    <button type="button" onClick={() => onNavigate("send-payment")} className="font-medium underline">Go to Move Money</button>
                  
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
              {[
                ["Forward", `${fwd.ref} (${fwd.sell}/${fwd.buy} at ${fwd.rate})`],
                ["You sell", money(fwd.sell, sellAmt)],
                ["You buy", money(fwd.buy, buyAmt)],
                ["Drawdown date", pretty(date)],
                ["Reason", reason],
                ["Funding", [depositUsed > 0 ? `${money(fwd.sell, depositUsed)} from deposit` : null, sendAmt > 0 ? `${money(fwd.sell, sendAmt)} from holding account` : null].filter(Boolean).join(" + ")],
                ["Payments", allocs.length ? `${allocs.length} · ${money(fwd.buy, allocated)}` : "None (credited to your holding account)"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1"><span className="text-gray-500">{k}</span><span className="text-right text-gray-900">{v}</span></div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100">Back</button>
              <button type="button" disabled={!fundOk} onClick={confirm} className="ml-auto text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed">Confirm</button>
            </div>
            <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1"><CalendarClock className="w-3 h-3" />Demo only: no drawdown is created.</p>
          </>
        )}
      </div>
    </div>
  );
}


// ---------- Forwards list (the page people land on) ----------
const STATUS_TIP = {
  Open: "This forward is active and has not reached its value date.",
  Closed: "Nothing is left to draw down, or the value date has passed.",
};

// Every column the table can show. "on" = shown by default; the rest are added from the column chooser.
const COLUMNS = [
  { key: "deal", label: "Deal #", on: true, locked: true, cell: (f) => <span className="font-mono text-xs text-accent">{f.ref}</span> },
  { key: "status", label: "Status", tip: "Open forwards can still be drawn down. Closed forwards have nothing left.", on: true,
    cell: (f) => <span title={STATUS_TIP[statusOf(f)]} className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${statusOf(f) === "Open" ? "bg-accent-100 text-accent" : "bg-gray-100 text-gray-500"}`}>{statusOf(f)}</span> },
  { key: "pair", label: "Pair", on: true, cell: (f) => <span>{FLAGS[f.sell]} {f.sell} <span className="text-gray-400">&rarr;</span> {FLAGS[f.buy]} {f.buy}</span> },
  { key: "rate", label: "Exchange rate", on: true, right: true, cell: (f) => f.rate },
  { key: "value", label: "Value date", on: true, cell: (f) => pretty(f.maturity) },
  { key: "available", label: "Available to draw down", tip: "What is left to sell on this forward, after any drawdowns.", on: true, right: true, cell: (f) => money(f.sell, f.remaining) },
  { key: "entry", label: "Entry date", cell: (f) => pretty(f.entry) },
  { key: "type", label: "Forward type", cell: (f) => f.type },
  { key: "obuy", label: "Original buy amount", right: true, cell: (f) => money(f.buy, f.original * f.rate) },
  { key: "osell", label: "Original sell amount", right: true, cell: (f) => money(f.sell, f.original) },
  { key: "xbuy", label: "Outstanding buy amount", tip: "What is left to buy, after any drawdowns.", right: true, cell: (f) => money(f.buy, f.remaining * f.rate) },
  { key: "deposit", label: "Cash deposit amount", right: true, cell: (f) => money(f.sell, f.deposit) },
];
const DEFAULT_COLS = COLUMNS.filter((c) => c.on).map((c) => c.key);
let savedCols = DEFAULT_COLS; // remembered while you move around the demo

export default function Forwards({ onNavigate }) {
  const [view, setView] = useState("list"); // list | drawdown
  const [startWith, setStartWith] = useState("");
  const [q, setQ] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [status, setStatus] = useState("All");
  const [cols, setColsState] = useState(savedCols);
  const [, force] = useState(0);
  const [note, setNote] = useState("");

  const setCols = (next) => { savedCols = next; setColsState(next); };
  const toggleCol = (key) => setCols(cols.includes(key) ? cols.filter((k) => k !== key) : [...COLUMNS.map((c) => c.key), "confirmation"].filter((k) => k === key || cols.includes(k)));

  if (view === "drawdown") {
    return <DrawdownForm key={startWith} onNavigate={onNavigate} initialFwd={startWith} onBack={() => setView("list")} />;
  }

  const shown = COLUMNS.filter((c) => cols.includes(c.key));
  const showConfirm = cols.includes("confirmation");
  const rows = FORWARDS.filter((f) => (status === "All" || statusOf(f) === status) && (!q || f.ref.toLowerCase().includes(q.toLowerCase())));
  const td = "px-3 py-3.5 text-sm text-gray-700 whitespace-nowrap";
  const iconBtn = "p-1.5 text-gray-400 hover:text-accent";
  const changed = cols.length !== DEFAULT_COLS.length || DEFAULT_COLS.some((k) => !cols.includes(k));

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Forwards</h1>
          <p className="text-sm text-gray-600 max-w-md">
            View your forward activity below. Choose Drawdown on a forward to use money from it.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-1">
          <button type="button" aria-label="Refresh" className={iconBtn} onClick={() => force((n) => n + 1)}><RefreshCw className="w-4 h-4" /></button>
          <button type="button" aria-label="Download PDF" className={iconBtn} onClick={() => setNote("Demo only: a PDF would download here.")}><FileText className="w-4 h-4" /></button>
          <button type="button" aria-label="Download Excel" className={iconBtn} onClick={() => setNote("Demo only: an Excel file would download here.")}><FileSpreadsheet className="w-4 h-4" /></button>
          <button type="button" aria-label="Print" className={iconBtn} onClick={() => window.print?.()}><Printer className="w-4 h-4" /></button>
        </div>
      </div>
      {note && <p role="status" className="text-xs text-gray-500 mt-2">{note}</p>}

      <div className="bg-white rounded-xl border border-gray-200/70 mt-5">
        <div className="relative flex flex-wrap items-center gap-2 px-4 py-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input aria-label="Deal number" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Enter deal number" className="text-sm border border-gray-200 rounded-full pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:border-accent" />
          </div>
          <button
            type="button"
            aria-label="Choose columns and filters"
            aria-expanded={showPanel}
            onClick={() => setShowPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border ${showPanel || changed ? "border-accent text-accent bg-accent-100" : "border-gray-200 text-gray-500 hover:text-accent"}`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Columns
          </button>

          {showPanel && (
            <div role="dialog" aria-label="Columns and filters" className="absolute left-4 top-full z-20 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-900">Show columns</p>
                <button type="button" aria-label="Close" onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
              </div>
              <ul className="flex flex-col gap-1.5">
                {COLUMNS.map((c) => (
                  <li key={c.key}>
                    <label className={`flex items-center gap-2 text-sm ${c.locked ? "text-gray-400" : "text-gray-700 cursor-pointer"}`}>
                      <input type="checkbox" className="accent-accent" checked={cols.includes(c.key)} disabled={c.locked} onChange={() => toggleCol(c.key)} />
                      {c.label}
                    </label>
                  </li>
                ))}
                <li>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" className="accent-accent" checked={showConfirm} onChange={() => toggleCol("confirmation")} />
                    Confirmation
                  </label>
                </li>
              </ul>
              <div className="border-t border-gray-100 mt-3 pt-3">
                <label htmlFor="fw-status" className="block text-[11px] text-gray-500 mb-1">Status</label>
                <select id="fw-status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 bg-white">
                  {["All", "Open", "Closed"].map((st) => <option key={st}>{st}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { setCols(DEFAULT_COLS); setStatus("All"); }} className="text-xs font-medium text-accent hover:underline mt-3">Reset to default</button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                {shown.map((c) => (
                  <th key={c.key} className={`text-[11px] font-medium text-gray-500 px-3 py-2.5 leading-tight ${c.right ? "text-right" : "text-left"}`}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {c.tip && <span title={c.tip}><Info className="w-3 h-3 text-gray-400" aria-label={c.tip} /></span>}
                    </span>
                  </th>
                ))}
                {showConfirm && <th className="text-[11px] font-medium text-gray-500 px-3 py-2.5 text-right">Confirmation</th>}
                <th className="w-px sticky right-0 bg-gray-50" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id} className={`border-t border-gray-100 ${!canDrawdown(f) && statusOf(f) === "Closed" ? "text-gray-400" : ""}`}>
                  {shown.map((c) => (
                    <td key={c.key} className={`${td} ${c.right ? "text-right" : ""} ${statusOf(f) === "Closed" && c.key !== "status" ? "!text-gray-400" : ""}`}>{c.cell(f)}</td>
                  ))}
                  {showConfirm && (
                    <td className={`${td} text-right`}>
                      <button type="button" aria-label={`Download confirmation for ${f.ref}`} title="Download confirmation (demo)" onClick={() => setNote("Demo only: a confirmation PDF would download here.")} className="text-gray-400 hover:text-accent"><Download className="w-4 h-4" /></button>
                    </td>
                  )}
                  <td className={`${td} text-right sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]`}>
                    <button
                      type="button"
                      disabled={!canDrawdown(f)}
                      title={statusOf(f) === "Closed" ? "This forward is closed" : f.type !== "Window" ? "Fixed forwards settle on the value date and can't be drawn down" : undefined}
                      onClick={() => { setStartWith(f.id); setView("drawdown"); }}
                      className="text-xs font-medium bg-accent text-white rounded-md px-3.5 py-1.5 hover:bg-accent-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Drawdown
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="px-3 py-8 text-center text-sm italic text-gray-500">{FORWARDS.length === 0 ? "You don't have forwards yet" : "No forwards match those filters."}</p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Demo only: forwards are sample data.</p>
    </div>
  );
}