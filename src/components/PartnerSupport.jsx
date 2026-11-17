import { useRef, useState } from "react";
import { Headset, CheckCircle2, MessageSquare, Phone, Mail } from "lucide-react";
import { SUPPORT_CATEGORIES } from "../../supabase/functions/_shared/support-categories.mjs";
import { createSupportRequest } from "../lib/support";
import PortalDialog from "./PortalDialog";
const primary = "text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const ghost = "inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50";
const PHONE = { display: "416 848 1028", tel: "+14168481028" };
const EMAIL = "partnerships@pulsefx.com";
export default function PartnerSupport({ authenticated = false, login = false, onClose }) {
  const [m, setM] = useState(() => !authenticated && !login ? { name: "Alex Morgan", email: "alex@abc-accounting.example", category: "Referral Status & Updates", subject: "Onboarding documents for Northwind Machining Ltd.", body: "Hello, could you confirm whether Northwind Machining Ltd. has submitted all required onboarding documents? Their team is preparing its first USD supplier payment and would appreciate an update on the next steps. Thank you, Alex." } : { name: "", email: "", category: "", subject: "", body: "" });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const ok = (!login || (m.name.trim() && /^\S+@\S+\.\S+$/.test(m.email.trim()))) && SUPPORT_CATEGORIES.includes(m.category) && m.subject.trim() && m.body.trim() && m.subject.length <= 200 && m.body.length <= 10000;
  async function submit(event) {
    event.preventDefault();
    if (!ok || submitting.current || uncertain) return;
    if (!login && !authenticated) { setSent({ supportId: "DEMO", preview: true }); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try { setSent(await createSupportRequest({ category: m.category, subject: m.subject.trim(), message: m.body.trim(), ...(login ? { name: m.name.trim(), email: m.email.trim() } : {}) }, { login })); }
    catch (failure) { setError(failure.message); setUncertain(failure.uncertain === true); }
    finally { submitting.current = false; setBusy(false); }
  }
  const close = () => { if (!submitting.current) onClose(); };
  const supportField = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
  const supportLabel = "mb-1.5 block text-sm font-medium text-gray-700";
  return <PortalDialog title="Help & support" subtitle="Get in touch with the partnerships team." icon={<Headset className="h-5 w-5" />} maxWidth="max-w-2xl" onClose={close}>
    {sent ? <div role="status" className="p-6 sm:p-8">
      <div className="flex items-center gap-2.5 pr-5"><CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-success" /><h3 className="text-base font-semibold text-gray-900">{sent.preview ? "Support request preview" : "Support request received"}</h3></div>
      <p className="mt-2 text-sm text-gray-500">{sent.preview ? "Preview only: no message was sent." : "Your message has been sent to the PulseFX partnerships team."}</p>
      {!sent.preview && <p className="mt-2 break-words text-sm text-gray-700">Your reference: <span className="font-medium">{sent.supportId}</span></p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className={ghost} onClick={() => { setSent(null); setM({ name: "", email: "", category: "", subject: "", body: "" }); setError(""); setUncertain(false); }}>Send another</button><button type="button" className={primary} onClick={close}>Done</button></div>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || uncertain} className="space-y-6 px-6 py-6 sm:px-8">
        <section aria-labelledby="support-message-heading">
          <h3 id="support-message-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-accent" />How can we help?</h3>
          <p className="mb-5 text-sm text-gray-500">Questions about a client, payouts or the programme? Send your partner manager a message.</p>
          {login && <div className="mb-4 space-y-4">
            <div><label htmlFor="ct-name" className={supportLabel}>Name *</label><input id="ct-name" autoFocus required maxLength={200} autoComplete="name" className={supportField} value={m.name} onChange={event => setM({ ...m, name: event.target.value })} /></div>
            <div><label htmlFor="ct-email" className={supportLabel}>Email *</label><input id="ct-email" type="email" required maxLength={254} autoComplete="email" className={supportField} value={m.email} onChange={event => setM({ ...m, email: event.target.value })} /></div>
          </div>}
          <div><label htmlFor="ct-category" className={supportLabel}>Category *</label><select autoFocus={!login} id="ct-category" required className={`${supportField} filter-control`} value={m.category} onChange={event => setM({ ...m, category: event.target.value })}><option value="" disabled>Select a category</option>{SUPPORT_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}</select></div>
          <div className="mt-4"><label htmlFor="ct-s" className={supportLabel}>Subject *</label><input id="ct-s" required maxLength={200} placeholder="What would you like help with?" className={supportField} value={m.subject} onChange={event => setM({ ...m, subject: event.target.value })} /></div>
          <div className="mt-4"><label htmlFor="ct-b" className={supportLabel}>Message *</label><textarea id="ct-b" required maxLength={10000} rows={5} placeholder="Share the details so we can help you." className={`${supportField} resize-y`} value={m.body} onChange={event => setM({ ...m, body: event.target.value })} /></div>
        </section>
        <section aria-labelledby="support-direct-heading" className="border-t border-gray-100 pt-5">
          <h3 id="support-direct-heading" className="text-sm font-semibold text-gray-900">Prefer to reach us directly?</h3>
          <div className="mt-3 flex flex-wrap gap-2"><a href={`tel:${PHONE.tel}`} className={ghost}><Phone className="h-4 w-4 text-accent" />Call {PHONE.display}</a><a href={`sms:${PHONE.tel}`} className={ghost}><MessageSquare className="h-4 w-4 text-accent" />Text {PHONE.display}</a><a href={`mailto:${EMAIL}`} className={`${ghost} break-all`}><Mail className="h-4 w-4 shrink-0 text-accent" />{EMAIL}</a></div>
        </section>
      </fieldset>
      <footer className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 sm:px-8">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={close} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!ok || busy || uncertain} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-navy hover:bg-[#009a7d] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending…" : "Send message"}</button></div>
      </footer>
    </form>}
  </PortalDialog>;
}

