import { useRef, useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import PortalDialog from "./PortalDialog";
import { dialogInput, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import { requestPasswordRecovery } from "../lib/passwordRecovery";

export default function PasswordRecoveryModal({ initialEmail = "", onClose }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const validEmail = email.length <= 254 && /^\S+@\S+\.\S+$/.test(email.trim());
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !validEmail) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try { await requestPasswordRecovery(email); setDone(true); }
    catch (failure) { setError(failure.message); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <PortalDialog title="Reset your password" subtitle="Recover access to your partner account." icon={<KeyRound className="h-5 w-5" />} maxWidth="max-w-md" busy={busy} onClose={onClose}>
    {done ? <div role="status" className="p-6 sm:p-8">
      <CheckCircle2 className="mb-3 h-7 w-7 text-success" aria-hidden="true" />
      <h3 className="font-semibold">Check your inbox</h3>
      <p className="mt-2 text-sm text-gray-600">If this email belongs to an active partner account, you will receive a password reset link that expires 1 hour after it is requested. Please check your spam or junk folder too.</p>
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={dialogPrimary}>Back to sign in</button></div>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy} className="space-y-4 px-6 py-6 sm:px-8">
        <p className="text-sm text-gray-600">Enter your email address. If it belongs to an active partner account, you will receive a password reset link that expires 1 hour after it is requested. Please check your spam or junk folder too.</p>
        <div><label htmlFor="recovery-email" className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label><input autoFocus id="recovery-email" type="email" required maxLength={254} autoComplete="email" aria-describedby="recovery-email-help" value={email} onChange={event => setEmail(event.target.value)} className={dialogInput} /><p id="recovery-email-help" className="mt-2 text-xs text-gray-500">Please wait 5 minutes before requesting another password reset link.</p></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </fieldset>
      <footer className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4 sm:px-8"><button type="button" disabled={busy} onClick={onClose} className={dialogSecondary}>Cancel</button><button type="submit" disabled={busy || !validEmail} className={dialogPrimary}>{busy ? "Submitting…" : "Send reset link"}</button></footer>
    </form>}
  </PortalDialog>;
}
