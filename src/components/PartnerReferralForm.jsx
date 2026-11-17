import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Users } from "lucide-react";
import PortalDialog from "./PortalDialog";
import PulseMark from "./PulseMark";
import { dialogInput, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import { publicReferralRequest } from "../lib/referralForm";
import { BUSINESS_INTERESTS } from "../../supabase/functions/_shared/referral-form-fields.mjs";
const empty = { firstName: "", lastName: "", company: "", email: "", phone: "", interests: [], website: "" };
export default function PartnerReferralForm({ token }) {
  const [remote, setRemote] = useState({ loading: true, partner: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const [values, setValues] = useState(empty);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [rejection, setRejection] = useState(null);
  const submitting = useRef(false);
  const submissionId = useRef(crypto.randomUUID());
  useEffect(() => {
    const controller = new AbortController();
    publicReferralRequest({ action: "load", token }, controller.signal).then(result => {
      if (!result?.partner?.name) throw new Error("This referral link is unavailable.");
      if (!controller.signal.aborted) setRemote({ loading: false, partner: result.partner, error: "" });
    }).catch(error => { if (!controller.signal.aborted) setRemote({ loading: false, partner: null, error: error.message }); });
    return () => controller.abort();
  }, [token, attempt]);
  useEffect(() => { document.title = `${remote.partner?.name || "Referral"} & PulseFX`; }, [remote.partner]);
  const valid = !!(values.firstName.trim() && values.lastName.trim() && /^\S+@\S+\.\S+$/.test(values.email.trim()));
  const set = name => event => { setRejection(null); setValues(previous => ({ ...previous, [name]: event.target.value })); };
  async function submit(event, confirmedRejection = null) {
    event.preventDefault();
    if (submitting.current || !valid) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await publicReferralRequest({ action: "submit", token, submissionId: submissionId.current, ...values, ...(confirmedRejection ? { confirmedRejection } : {}) });
      if (!result?.submitted) throw new Error("Unable to confirm your submission. Please contact PulseFX.");
      setDone(true);
    } catch (failure) { setRejection(failure.rejection || null); setError(failure.rejection ? "" : failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <main id="main-content" className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
    <div className="text-center"><div className="flex items-center justify-center gap-2"><PulseMark /><span className="text-lg font-semibold">PulseFX</span></div><h1 className="mt-5 text-2xl font-semibold">{remote.partner ? `${remote.partner.name} & PulseFX` : "Partner referral"}</h1><p className="mt-2 text-sm text-gray-500">See how much you could save on international payments.</p>{!open && <button type="button" onClick={() => setOpen(true)} className={`${dialogPrimary} mt-5`}>{done ? "View confirmation" : "Open referral form"}</button>}</div>
    {open && <PortalDialog title={remote.partner ? `${remote.partner.name} & PulseFX` : "Partner referral"} subtitle="See how much you could save on international payments." icon={<Users className="h-5 w-5" />} onClose={() => setOpen(false)} busy={busy} collapseOnStatus={false}>
      <div className="p-6 sm:p-8">
        {remote.loading && <p role="status" className="text-sm text-gray-500">Loading referral form…</p>}
        {remote.error && <div><p role="alert" className="text-sm text-danger">{remote.error}</p><button type="button" className={`${dialogSecondary} mt-4`} onClick={() => { setRemote({ loading: true, partner: null, error: "" }); setAttempt(value => value + 1); }}>Try again</button></div>}
        {remote.partner && (done ? <div role="status" className="py-8 text-center"><CheckCircle2 className="mx-auto h-12 w-12 text-accent" /><h3 className="mt-4 text-xl font-semibold">Thank you for your interest</h3><p className="mt-2 text-sm text-gray-500">Your details have been sent to PulseFX. Our team will be in touch.</p><button type="button" onClick={() => setOpen(false)} className={`${dialogPrimary} mt-5`}>Close</button></div> : <form onSubmit={event => submit(event, rejection)}>
          <fieldset disabled={busy} aria-busy={busy} className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 sm:grid-cols-2">
            {[["firstName", "First name", true, "given-name", 100], ["lastName", "Last name", true, "family-name", 100], ["company", "Company name", false, "organization", 200], ["email", "Email", true, "email", 254], ["phone", "Phone number", false, "tel", 60]].map(([name, label, required, autoComplete, maxLength]) => <div key={name}><label htmlFor={`public-${name}`} className="mb-1.5 block text-sm">{label}{required && <span className="text-danger"> *</span>}</label><input id={`public-${name}`} autoFocus={name === "firstName"} type={name === "email" ? "email" : name === "phone" ? "tel" : "text"} autoComplete={autoComplete} required={required} maxLength={maxLength} value={values[name]} onChange={set(name)} className={dialogInput} /></div>)}
            <div><label htmlFor="public-partner" className="mb-1.5 block text-sm">Partner organization</label><input id="public-partner" value={remote.partner.name} readOnly className={`${dialogInput} text-gray-500`} /></div>
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Select what applies to your business</legend><div className="space-y-2">{BUSINESS_INTERESTS.map((interest, index) => <label key={interest} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={values.interests.includes(interest)} onChange={event => setValues(previous => ({ ...previous, interests: event.target.checked ? [...previous.interests, interest] : previous.interests.filter(value => value !== interest) }))} className="h-4 w-4 accent-accent" /><span className={`rounded-full px-2 py-0.5 ${["bg-blue-100", "bg-sky-100", "bg-teal-100", "bg-green-100"][index]}`}>{interest}</span></label>)}</div></fieldset>
            <div className="hidden" aria-hidden="true"><label htmlFor="public-website">Website</label><input id="public-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set("website")} /></div>
          </fieldset>
          {rejection && <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-medium">Previously rejected referral</p><p className="mt-1">A previous referral for this email was rejected. Select Confirm and continue to submit a new referral.</p></div>}
          {error && <p role="alert" className="mt-4 text-sm text-danger">{error}{error.startsWith("A referral already exists for this email.") && <><br /><a href="mailto:partnerships@pulsefx.com" className="underline underline-offset-2">partnerships@pulsefx.com</a></>}</p>}
          <div className="mt-6 flex items-center justify-end gap-3"><button type="button" disabled={busy} onClick={() => { setValues(empty); setError(""); setRejection(null); }} className={dialogSecondary}>Clear form</button><button type="submit" disabled={busy || !valid} className={dialogPrimary}>{busy ? "Submitting…" : rejection ? "Confirm and continue" : "Submit"}</button></div>
        </form>)}
      </div>
    </PortalDialog>}
  </main>;
}
