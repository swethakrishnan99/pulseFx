import PortalDialog from "./PortalDialog";
import { dialogInput as input, dialogPrimary as primary, dialogSecondary as secondary } from "../lib/dialogStyles";
import { useRef, useState } from "react";
import { ArrowLeft, Mail, Pencil } from "lucide-react";

export default function PartnerEdit({ partner, onClose, onSave }) {
  const isAdmin = partner.role === "partner_admin";
  const submitting = useRef(false);
  const [company, setCompany] = useState(partner.company || "");
  const [name, setName] = useState(partner.name);
  const [email, setEmail] = useState(partner.email);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const originalEmail = partner.previousEmail || partner.email;
  const normalizedEmail = email.trim().toLowerCase();
  const emailChanged = normalizedEmail !== originalEmail;
  const valid = (isAdmin || company.trim()) && name.trim() && /^\S+@\S+\.\S+$/.test(normalizedEmail);
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
  return <PortalDialog title={confirming ? "Confirm email change" : partner.profileEditPending ? "Resume partner update" : isAdmin ? "Edit admin" : "Edit partner"} subtitle={partner.name} icon={confirming ? <Mail className="h-5 w-5" /> : <Pencil className="h-5 w-5" />} maxWidth="max-w-xl" busy={busy} onClose={() => { if (!submitting.current) onClose(); }}>
    <form onSubmit={submit} aria-busy={busy} className="space-y-4 p-6">
      {confirming ? <>
        <dl className="rounded-lg bg-gray-50 p-3 text-sm"><dt className="text-gray-500">Current email</dt><dd className="mt-1 break-all">{originalEmail}</dd><dt className="mt-3 text-gray-500">New email</dt><dd className="mt-1 break-all font-medium">{normalizedEmail}</dd></dl>
        <p className="text-sm text-gray-600">The user will sign in with the new email. Existing passwords stay unchanged. Existing sessions and access links will be revoked. {isAdmin ? "Administrator access stays linked to this account." : "Partner records and history stay linked to this account."}</p>
        <label className="flex items-start gap-2 text-sm text-gray-700"><input autoFocus type="checkbox" className="mt-1 accent-accent" disabled={busy} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I verified that this email belongs to the same contact. This does not transfer access to another person.</span></label>
      </> : <fieldset disabled={busy || partner.profileEditPending} className="space-y-3">
        {!isAdmin && <div><label htmlFor="edit-partner-company" className="mb-1 block text-xs text-gray-600">Partner name *</label><input id="edit-partner-company" className={input} required maxLength={160} value={company} onChange={(event) => setCompany(event.target.value)} autoFocus /></div>}
        <div><label htmlFor="edit-partner-contact" className="mb-1 block text-xs text-gray-600">{isAdmin ? "Name *" : "Contact name *"}</label><input id="edit-partner-contact" autoFocus={isAdmin} className={input} required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div><label htmlFor="edit-partner-email" className="mb-1 block text-xs text-gray-600">Email address *</label><input id="edit-partner-email" className={input} type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      </fieldset>}
      {partner.profileEditPending && <p className="rounded-lg bg-warning-100 p-3 text-sm text-gray-700">This update needs to be completed before other account actions. Resume using the saved values.</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">{confirming ? <button type="button" className={`${secondary} inline-flex items-center gap-1`} disabled={busy} onClick={() => { setConfirming(false); setConfirmed(false); setError(""); }}><ArrowLeft className="h-4 w-4" />Back</button> : <button type="button" className={secondary} disabled={busy} onClick={onClose}>Cancel</button>}<button type="submit" className={primary} disabled={!valid || busy || (confirming && !confirmed)}>{busy ? "Saving…" : confirming ? "Confirm and update email" : emailChanged ? "Continue" : partner.profileEditPending ? "Resume update" : "Save changes"}</button></div>
    </form>
  </PortalDialog>;
}
