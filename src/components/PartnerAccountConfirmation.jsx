import PortalDialog from "./PortalDialog";
import { Power, Trash2 } from "lucide-react";
import { dialogDanger, dialogPrimary, dialogSecondary } from "../lib/dialogStyles";
import { useState } from "react";

export default function PartnerAccountConfirmation({ action, partner, onClose, onConfirm }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = action === "delete" ? "Delete user" : action === "enable" ? "Reactivate user" : "Deactivate user";
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onConfirm(partner, action); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <PortalDialog title={`${label}?`} subtitle={partner.email} icon={action === "delete" ? <Trash2 className="h-5 w-5" /> : <Power className="h-5 w-5" />} maxWidth="max-w-xl" busy={busy} onClose={onClose}>
    <div className="p-6" aria-busy={busy}>
    <p className="text-sm text-gray-600 mt-3">{partner.role === "partner_admin" ? (action === "delete" ? "This permanently removes the administrator account and its access to the admin portal." : action === "enable" ? "This administrator will be able to sign in to the admin portal again." : "This administrator will lose access to the admin portal and existing sessions will be revoked. You can reactivate the account later.") : action === "delete" ? "This permanently removes the user's login. Partner records and referral history will be kept." : action === "enable" ? "This user will be able to access their partner account again." : "This user will lose sign-in and partner data access. You can reactivate the account later."}</p>
    {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
    <div className="flex justify-end gap-2 mt-5">
      <button type="button" onClick={onClose} disabled={busy} className={dialogSecondary}>Cancel</button>
      <button type="button" onClick={confirm} disabled={busy} className={action === "delete" ? dialogDanger : dialogPrimary}>{busy ? "Updating…" : label}</button>
    </div>
    </div>
  </PortalDialog>;
}
