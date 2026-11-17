import PortalDialog from "./PortalDialog";
import { Building2, UserRound, Check, ArrowLeftRight } from "lucide-react";

const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const label = "block text-sm font-medium text-gray-700 mb-1.5";

export function AddClientDialog({ onClose, children }) {
  return <PortalDialog title="Add a client" subtitle="A new connection starts here." icon={<Building2 className="h-5 w-5" />} onClose={onClose}>{children}</PortalDialog>;
}

export default function AddClientFormFields({ values: v, setValues: setV, duplicate, canSubmit = false, saving, saveError, onSubmit, onClose }) {
  const set = key => event => setV(previous => ({ ...previous, [key]: event.target.value }));
  const toggle = currency => setV(previous => ({ ...previous, cur: previous.cur.includes(currency) ? previous.cur.filter(item => item !== currency) : [...previous.cur, currency] }));
  return (
    <form onSubmit={onSubmit} aria-busy={saving}>
      <fieldset disabled={saving} className="space-y-7 px-6 py-6 sm:px-8">
        <p className="text-sm text-gray-500">Tell us about your client so we can get to know their business. Fields marked * are required.</p>
        <section aria-labelledby="preview-business">
          <h3 id="preview-business" className="mb-4 flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-accent" />Company details</h3>
          <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
            <div><label htmlFor="preview-company" className={label}>Company name *</label><input autoFocus id="preview-company" required maxLength={200} placeholder="e.g. Northwind Trading Ltd." className={input} value={v.company} onChange={set("company")} aria-invalid={duplicate} aria-describedby={duplicate ? "preview-duplicate" : undefined} />{duplicate && <p id="preview-duplicate" role="alert" className="mt-1 text-xs text-danger">You have already referred this company.</p>}</div>
            <div><label htmlFor="preview-country" className={label}>Country *</label><select id="preview-country" required className={`${input} filter-control`} value={v.country} onChange={set("country")}><option value="">Select country</option><option>Canada</option><option>United States</option></select></div>
          </div>
        </section>
        <section aria-labelledby="preview-contact" className="border-t border-gray-100 pt-6">
          <h3 id="preview-contact" className="mb-1 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4 text-accent" />Primary contact</h3>
          <p className="mb-4 text-xs text-gray-500">Who should our team connect with?</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="preview-name" className={label}>Full name *</label><input id="preview-name" required maxLength={200} autoComplete="name" placeholder="e.g. Alex Morgan" className={input} value={v.contact} onChange={set("contact")} /></div>
            <div><label htmlFor="preview-email" className={label}>Work email *</label><input id="preview-email" required type="email" maxLength={254} autoComplete="email" placeholder="alex@company.com" className={input} value={v.email} onChange={set("email")} /></div>
          </div>
        </section>
        <section aria-labelledby="preview-fx" className="border-t border-gray-100 pt-6">
          <h3 id="preview-fx" className="mb-4 flex items-center gap-2 text-sm font-semibold"><ArrowLeftRight className="h-4 w-4 text-accent" />Currency needs</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr]"><div>
          <label htmlFor="preview-volume" className={label}>Expected monthly volume *</label>
          <select id="preview-volume" required className={`${input} filter-control`} value={v.volume} onChange={set("volume")}><option value="">Select a range in CAD</option>{["Under CAD 50,000", "CAD 50,000 to 250,000", "CAD 250,000 to 1,000,000", "Over CAD 1,000,000"].map(item => <option key={item}>{item}</option>)}</select>
          </div></div>
          <fieldset className="mt-4"><legend className={label}>Currencies * <span className="font-normal text-gray-500">· Select all that apply</span></legend>
            <div className="flex flex-wrap gap-2">{["CAD", "USD", "EUR", "GBP", "AUD", "MXN", "Other"].map(currency => <label key={currency} className={`relative inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium focus-within:ring-2 focus-within:ring-accent ${v.cur.includes(currency) ? "border-accent bg-accent-100 text-accent-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}><input type="checkbox" className="peer sr-only" checked={v.cur.includes(currency)} onChange={() => toggle(currency)} /><span className="flex h-4 w-4 items-center justify-center rounded border border-current" aria-hidden="true">{v.cur.includes(currency) && <Check className="h-3 w-3" />}</span>{currency}</label>)}</div>
            {v.cur.includes("Other") && <div className="mt-3"><label htmlFor="preview-other" className={label}>Other currency *</label><input id="preview-other" required maxLength={60} placeholder="e.g. JPY, CHF" className={input} value={v.otherCur} onChange={set("otherCur")} /></div>}
          </fieldset>
        </section>
        <div><label htmlFor="preview-notes" className={label}>Anything else we should know? <span className="font-normal text-gray-400">(optional)</span></label><textarea id="preview-notes" rows={2} maxLength={5000} placeholder="Payment needs, timing, or helpful context…" className={`${input} resize-y`} value={v.notes} onChange={set("notes")} /></div>
      </fieldset>
      <footer className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 sm:px-8">
        {saveError && <p role="alert" className="mb-3 text-sm text-danger">{saveError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">Once added, you can follow your client’s progress in Referrals.</p><div className="flex items-center gap-3"><button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || !canSubmit} className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-navy hover:bg-[#009a7d] disabled:opacity-50">{saving ? "Saving…" : "Add client"}</button></div></div>
      </footer>
    </form>
  );
}
