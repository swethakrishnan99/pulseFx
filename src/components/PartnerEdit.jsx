import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mail, Pencil, X } from "lucide-react";

const input = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const primary = "rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";
const secondary = "rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50";
export default function PartnerEdit({ partner, onClose, onSave }) {
  const dialog = useRef(null), submitting = useRef(false);
  const [company, setCompany] = useState(partner.company);
  const [name, setName] = useState(partner.name);
  const [email, setEmail] = useState(partner.email);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const originalEmail = partner.previousEmail || partner.email;
  const normalizedEmail = email.trim().toLowerCase();
  const emailChanged = normalizedEmail !== originalEmail;
  const valid = company.trim() && name.trim() && /^\S+@\S+\.\S+$/.test(normalizedEmail);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (!valid || submitting.current) return;
    if (emailChanged && !confirming) { setConfirming(true); setConfirmed(false); return; }
    if (emailChanged && !confirmed) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onSave({ id: partner.id, company: company.trim(), name: name.trim(), email: normalizedEmail,
      expected: { company: partner.company, name: partner.name, email: partner.email }, confirmEmailChange: emailChanged && confirmed }); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="edit-partner-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2">{confirming ? <Mail className="h-5 w-5 text-accent" /> : <Pencil className="h-5 w-5 text-accent" />}<h2 id="edit-partner-title" className="text-lg font-semibold">{confirming ? "Confirm email change" : partner.profileEditPending ? "Resume partner update" : "Edit partner"}</h2></div><button type="button" aria-label="Close partner edit" disabled={busy} onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button></div>
    <form onSubmit={submit} className="mt-4 space-y-4">
      {confirming ? <>
        <dl className="rounded-lg bg-gray-50 p-3 text-sm"><dt className="text-gray-500">Current email</dt><dd className="mt-1 break-all">{originalEmail}</dd><dt className="mt-3 text-gray-500">New email</dt><dd className="mt-1 break-all font-medium">{normalizedEmail}</dd></dl>
        <p className="text-sm text-gray-600">The user will sign in with the new email. Existing passwords stay unchanged. Existing sessions and access links will be revoked. Partner records and history stay linked to this account.</p>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input type="checkbox" className="mt-1 accent-accent" disabled={busy} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I verified that this email belongs to the same contact. This does not transfer access to another person.</span></label>
      </> : <fieldset disabled={busy || partner.profileEditPending} className="space-y-3">
        <div><label htmlFor="edit-partner-company" className="mb-1 block text-xs text-gray-600">Partner name *</label><input id="edit-partner-company" className={input} required maxLength={160} value={company} onChange={(event) => setCompany(event.target.value)} autoFocus /></div>
        <div><label htmlFor="edit-partner-contact" className="mb-1 block text-xs text-gray-600">Contact name *</label><input id="edit-partner-contact" className={input} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><label htmlFor="edit-partner-email" className="mb-1 block text-xs text-gray-600">Email address *</label><input id="edit-partner-email" className={input} type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      </fieldset>}
      {partner.profileEditPending && <p className="rounded-lg bg-warning-100 p-3 text-sm text-gray-700">This update needs to be completed before other account actions. Resume using the saved values.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">{confirming ? <button type="button" className={`${secondary} inline-flex items-center gap-1`} disabled={busy} onClick={() => { setConfirming(false); setConfirmed(false); setError(""); }}><ArrowLeft className="h-4 w-4" />Back</button> : <button type="button" className={secondary} disabled={busy} onClick={onClose}>Cancel</button>}<button type="submit" className={primary} disabled={!valid || busy || (confirming && !confirmed)}>{busy ? "Saving…" : confirming ? "Confirm and update email" : emailChanged ? "Continue" : partner.profileEditPending ? "Resume update" : "Save changes"}</button></div>
    </form>
  </dialog>;
}
