import { useEffect, useRef, useState } from "react";

export default function PartnerAccountConfirmation({ action, partner, onClose, onConfirm }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = action === "delete" ? "Delete user" : action === "enable" ? "Reactivate user" : "Deactivate user";
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await onConfirm(partner, action); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <dialog ref={dialog} aria-labelledby="account-action-title" onCancel={(event) => { if (busy) event.preventDefault(); else onClose(); }}
    className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
    <h2 id="account-action-title" className="text-lg font-semibold">{label}?</h2>
    <p className="mt-3 text-sm font-medium break-all">{partner.email}</p>
    <p className="text-sm text-gray-600 mt-3">{action === "delete" ? "This permanently removes the user's login. Partner records and referral history will be kept." : action === "enable" ? "This user will be able to access their partner account again." : "This user will lose sign-in and partner data access. You can reactivate the account later."}</p>
    {error && <p role="alert" className="text-sm text-danger mt-3">{error}</p>}
    <div className="flex justify-end gap-2 mt-5">
      <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">Cancel</button>
      <button type="button" onClick={confirm} disabled={busy} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${action === "delete" ? "bg-danger text-white hover:bg-red-800" : "bg-brand text-navy hover:bg-accent"}`}>{busy ? "Updating…" : label}</button>
    </div>
  </dialog>;
}
