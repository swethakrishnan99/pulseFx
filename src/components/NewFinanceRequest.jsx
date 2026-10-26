import { useState, useRef, useEffect } from "react";
import { X, Paperclip, Plus } from "lucide-react";
import { FORWARDS, canDrawdown } from "./ForwardsDrawdown";
import { FALLBACK_RATES } from "../lib/fx";

// Side panel for "New Request" on the Trade Finance page. Fields follow Ebury's
// "Submit a new request" help article. Demo only: nothing is sent anywhere.

const SUPPLIERS = ["Maple Supply Co.", "Test Company Inc", "Lone Star Logistics"];
const BENEFICIARIES = ["Maple Supply Co.", "Test Company Inc", "Lone Star Logistics"];
const TERMS = ["Payment in advance", "On delivery", "Net 30", "Net 60", "Net 90", "Other"];
const COUNTRIES = ["Canada", "China", "Germany", "India", "Italy", "Mexico", "Turkey", "United Kingdom", "United States", "Vietnam", "Other"];
const PAY_CURS = ["CAD", "USD", "EUR", "GBP", "AUD"];
const REPAY_CURS = ["EUR", "GBP", "USD", "CAD", "AUD"];
const MIN_GBP = 2000;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const plusDays = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const isBizDay = (iso) => { const d = new Date(`${iso}T12:00:00`).getDay(); return d !== 0 && d !== 6; };
const nextBiz = (iso) => { let x = iso; while (!isBizDay(x)) x = plusDays(x, 1); return x; };
// Smallest invoice amount in `cur` that equals GBP 2,000 (sample rates).
const minIn = (cur) => Math.ceil((MIN_GBP * FALLBACK_RATES[cur]) / FALLBACK_RATES.GBP);
const fmt = (n) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const field = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const lab = "block text-[11px] text-gray-500 mb-1";

const toCad = (n, cur) => (n / FALLBACK_RATES[cur]) * FALLBACK_RATES.CAD;

export default function NewFinanceRequest({ onClose, onSubmit, available = Infinity }) {
  const [supplier, setSupplier] = useState("");
  const [newSupplier, setNewSupplier] = useState({ name: "", country: "" });
  const [benef, setBenef] = useState("");
  const [newBenef, setNewBenef] = useState("");
  const [invoice, setInvoice] = useState("");
  const [payDate, setPayDate] = useState(nextBiz(plusDays(todayIso(), 1)));
  const [terms, setTerms] = useState("");
  const [termsOther, setTermsOther] = useState("");
  const [goods, setGoods] = useState("");
  const [origin, setOrigin] = useState("");
  const [cur, setCur] = useState("CAD");
  const [amount, setAmount] = useState("");
  const [deposit, setDeposit] = useState("no"); // "no" | "yes"
  const [depDate, setDepDate] = useState("");
  const [depAmt, setDepAmt] = useState("");
  const [repayCur, setRepayCur] = useState("CAD");
  const [method, setMethod] = useState(""); // "forward" | "other"
  const [fwdIds, setFwdIds] = useState([]);
  const [methodOther, setMethodOther] = useState("");
  const [files, setFiles] = useState([]);
  const [agree, setAgree] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  const num = (t) => { const n = parseFloat(String(t).replace(/,/g, "")); return Number.isFinite(n) && n > 0 ? n : 0; };
  const amt = num(amount);
  const min = minIn(cur);
  const belowMin = amt > 0 && amt < min;
  const amtCad = toCad(amt, cur);
  const overLine = amt > 0 && amtCad > available;
  const needMethod = repayCur !== cur;
  const fwdOptions = FORWARDS.filter((f) => canDrawdown(f) && f.sell === repayCur && f.buy === cur);

  const supplierOk = supplier === "__new" ? newSupplier.name.trim() && newSupplier.country : !!supplier;
  const benefOk = benef === "__new" ? newBenef.trim() : !!benef;
  const dateOk = payDate >= todayIso() && isBizDay(payDate);
  const termsOk = terms && (terms !== "Other" || termsOther.trim());
  const depositOk = deposit === "no" || (depDate && depDate <= todayIso() && num(depAmt) > 0 && num(depAmt) < amt);
  const methodOk = !needMethod || (method === "forward" ? fwdIds.length > 0 : method === "other" ? methodOther.trim() : false);
  const ready = supplierOk && benefOk && invoice.trim() && dateOk && termsOk && goods.trim() && origin && amt >= min && !overLine && depositOk && methodOk && agree;

  function toggleFwd(id) { setFwdIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id])); }

  function submit(e) {
    e.preventDefault();
    if (!ready) return;
    onSubmit({
      supplier: supplier === "__new" ? newSupplier.name.trim() : supplier,
      beneficiary: benef === "__new" ? newBenef.trim() : benef,
      invoice: invoice.trim(), payDate, terms: terms === "Other" ? termsOther.trim() : terms,
      goods: goods.trim(), origin, cur, amount: amt,
      deposit: deposit === "yes" ? { date: depDate, amount: num(depAmt) } : null,
      repayCur, settlement: !needMethod ? null : method === "forward" ? `Drawdown from forward: ${FORWARDS.filter((f) => fwdIds.includes(f.id)).map((f) => f.ref).join(", ")}` : `Other: ${methodOther.trim()}`,
      files: files.map((f) => f.name),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <form
        role="dialog"
        aria-label="New request"
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white h-full flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">New request</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
          <div>
            <label htmlFor="nr-supplier" className={lab}>Supplier name *</label>
            <select id="nr-supplier" className={field} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
              <option value="">Select a supplier</option>
              {SUPPLIERS.map((s) => <option key={s}>{s}</option>)}
              <option value="__new">+ Add a new supplier</option>
            </select>
            {supplier === "__new" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <input aria-label="Supplier company name" className={field} placeholder="Company name" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
                <select aria-label="Supplier country" className={field} value={newSupplier.country} onChange={(e) => setNewSupplier({ ...newSupplier, country: e.target.value })}>
                  <option value="">Country</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <p className="col-span-2 text-[11px] text-gray-400">The company name must be the entity that issued the invoice.</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="nr-benef" className={lab}>Beneficiary *</label>
            <select id="nr-benef" className={field} value={benef} onChange={(e) => setBenef(e.target.value)}>
              <option value="">Select a beneficiary</option>
              {BENEFICIARIES.map((s) => <option key={s}>{s}</option>)}
              <option value="__new">+ Add a new beneficiary</option>
            </select>
            {benef === "__new" && <input aria-label="New beneficiary name" className={`${field} mt-2`} placeholder="Beneficiary name" value={newBenef} onChange={(e) => setNewBenef(e.target.value)} />}
            <p className="text-[11px] text-gray-400 mt-1">Who receives the funds.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="nr-inv" className={lab}>Invoice number *</label>
              <input id="nr-inv" className={field} value={invoice} onChange={(e) => setInvoice(e.target.value)} />
            </div>
            <div>
              <label htmlFor="nr-date" className={lab}>Date to pay supplier *</label>
              <input id="nr-date" type="date" className={field} min={todayIso()} value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <p className={`col-span-2 text-[11px] -mt-1.5 ${payDate && !dateOk ? "text-danger" : "text-gray-400"}`}>
              {payDate && !dateOk ? "Choose a business day that is not in the past." : "The date you'd like the supplier to be paid. Payment on that date is not guaranteed."}
            </p>
          </div>

          <div>
            <label htmlFor="nr-terms" className={lab}>Payment terms of the invoice *</label>
            <select id="nr-terms" className={field} value={terms} onChange={(e) => setTerms(e.target.value)}>
              <option value="">Select payment terms</option>
              {TERMS.map((t) => <option key={t}>{t}</option>)}
            </select>
            {terms === "Other" && <input aria-label="Other payment terms" className={`${field} mt-2`} placeholder="Describe the agreed terms" value={termsOther} onChange={(e) => setTermsOther(e.target.value)} />}
          </div>

          <div>
            <label htmlFor="nr-goods" className={lab}>Goods being purchased *</label>
            <textarea id="nr-goods" rows={2} className={field} placeholder="Describe the goods or services on the invoice" value={goods} onChange={(e) => setGoods(e.target.value)} />
          </div>

          <div>
            <label htmlFor="nr-origin" className={lab}>Goods country of origin *</label>
            <select id="nr-origin" className={field} value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">Select a country</option>
              {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">This may differ from the country the goods shipped from.</p>
          </div>

          <div>
            <label htmlFor="nr-amt" className={lab}>Amount to finance *</label>
            <div className="flex gap-2">
              <select aria-label="Currency" className={`${field} w-24`} value={cur} onChange={(e) => { setCur(e.target.value); setMethod(""); setFwdIds([]); }}>
                {PAY_CURS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input id="nr-amt" inputMode="decimal" className={field} placeholder="0.00" value={amount} onChange={(e) => { const v = e.target.value.replace(/,/g, ""); if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v); }} />
            </div>
            <p className={`text-[11px] mt-1 ${belowMin ? "text-danger" : "text-gray-400"}`} role={belowMin ? "alert" : undefined}>
              {belowMin ? `The amount must be above GBP 2,000, which is about ${cur} ${fmt(min)}.` : `Must be above GBP 2,000 (about ${cur} ${fmt(min)}). You can combine several smaller invoices from the same supplier: enter their total.`}
            </p>
            {overLine && <p role="alert" className="text-[11px] text-danger mt-1">This is more than your available credit line (CAD {fmt(Math.max(0, available))}). Enter a smaller amount.</p>}
          </div>

          <fieldset>
            <legend className={lab}>Deposit paid *</legend>
            <div className="flex gap-4 text-sm">
              {[["no", "No"], ["yes", "Yes"]].map(([v, l]) => (
                <label key={v} className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="deposit" className="accent-accent" checked={deposit === v} onChange={() => setDeposit(v)} />{l}</label>
              ))}
            </div>
            {deposit === "yes" && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label htmlFor="nr-depd" className={lab}>Deposit date</label>
                  <input id="nr-depd" type="date" max={todayIso()} className={field} value={depDate} onChange={(e) => setDepDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="nr-depa" className={lab}>Deposit amount ({cur})</label>
                  <input id="nr-depa" inputMode="decimal" className={field} aria-describedby="nr-dep-hint" value={depAmt} onChange={(e) => { const v = e.target.value.replace(/,/g, ""); if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setDepAmt(v); }} />
                </div>
              </div>
            )}
            {deposit === "yes" && <p id="nr-dep-hint" className={`text-[11px] mt-1 ${depAmt && num(depAmt) >= amt && amt > 0 ? "text-danger" : "text-gray-400"}`}>The deposit date can't be in the future, and the deposit must be less than the invoice amount.</p>}
          </fieldset>

          <div>
            <label htmlFor="nr-repay" className={lab}>Repayment currency *</label>
            <select id="nr-repay" className={field} value={repayCur} onChange={(e) => { setRepayCur(e.target.value); setMethod(""); setFwdIds([]); }}>
              {REPAY_CURS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          {needMethod && (
            <fieldset>
              <legend className={lab}>Settlement method * <span className="text-gray-400">(repaying in {repayCur}, paying in {cur})</span></legend>
              <div className="flex flex-col gap-1.5 text-sm">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="method" className="accent-accent" checked={method === "forward"} onChange={() => setMethod("forward")} />Drawdown from forward</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="method" className="accent-accent" checked={method === "other"} onChange={() => setMethod("other")} />Other</label>
              </div>
              {method === "forward" && (
                <div className="mt-2 border border-gray-200 rounded-lg p-2.5">
                  {fwdOptions.length === 0 ? (
                    <p className="text-xs text-gray-500">You have no open forwards that sell {repayCur} and buy {cur}. Choose Other instead.</p>
                  ) : (
                    <>
                      <p className="text-[11px] text-gray-500 mb-1.5">Select one or more of your open forwards.</p>
                      {fwdOptions.map((f) => (
                        <label key={f.id} className="flex items-start gap-2 text-sm py-1 cursor-pointer">
                          <input type="checkbox" className="mt-1 accent-accent" checked={fwdIds.includes(f.id)} onChange={() => toggleFwd(f.id)} />
                          <span><span className="font-mono text-xs text-accent">{f.ref}</span> · rate {f.rate} · {f.sell} {fmt(f.remaining)} available</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
              {method === "other" && <textarea aria-label="Other settlement method" rows={2} className={`${field} mt-2`} placeholder="Describe the alternative, for example a mix of spot and forward" value={methodOther} onChange={(e) => setMethodOther(e.target.value)} />}
            </fieldset>
          )}

          <div>
            <p className={lab}>Attachments</p>
            <p className="text-[11px] text-gray-400 mb-1.5">Upload the invoice, transport documents and packing lists so we can process the request smoothly.</p>
            <input ref={fileRef} type="file" multiple className="hidden" aria-label="Upload documents" onChange={(e) => { setFiles((l) => [...l, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
            <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50"><Paperclip className="w-4 h-4" />Add documents</button>
            {files.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2.5 py-1.5">
                    <span className="truncate">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((l) => l.filter((_, j) => j !== i))} className="text-gray-400 hover:text-danger"><X className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-5 py-4">
          <label className="flex items-start gap-2 text-xs text-gray-600 mb-3 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-accent" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I accept the terms of use
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100">Cancel</button>
            <button type="submit" disabled={!ready} className="ml-auto text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 disabled:opacity-50 disabled:cursor-not-allowed">Submit</button>
          </div>
        </div>
      </form>
    </div>
  );
}