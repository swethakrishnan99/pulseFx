import { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import PulseMark from "./PulseMark";
import { createActivationClient } from "../lib/supabase";
import { createPartnerAccessFlow } from "../lib/partnerAccess.mjs";

export default function PartnerActivation({ onExit }) {
  const [invitation] = useState(() => {
    const query = new URLSearchParams(window.location.search);
    return { token_hash: query.get("token_hash"), type: query.get("type") };
  });
  const recovery = invitation.type === "recovery";
  const [client] = useState(createActivationClient);
  const valid = !!invitation.token_hash && ["invite", "recovery"].includes(invitation.type);
  const [flow] = useState(() => createPartnerAccessFlow(client, invitation));
  const [validation, setValidation] = useState({ checking: valid && !!client, valid: false });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Keep the credential out of history, copied addresses and referrer headers.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!valid || !client) return;
    let active = true;
    // The flow deduplicates this call when React replays mount effects.
    flow.verify().then((result) => { if (active) setValidation({ checking: false, ...result }); });
    return () => { active = false; };
  }, [client, flow, valid]);

  async function retryValidation() {
    setValidation({ checking: true, valid: false });
    const result = await flow.verify({ retry: true });
    setValidation({ checking: false, ...result });
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || done || !validation.valid || !client) return;
    setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    if (password.length < 8) { setError("Use at least 8 characters for your password."); return; }
    setBusy(true);
    try {
      await flow.savePassword(password);
      setPassword("");
      setConfirmation("");
      setDone(true);
    } catch (failure) {
      if (["invalid_link", "session_expired"].includes(failure.code)) {
        setValidation({ checking: false, valid: false, reason: "invalid" });
      } else if (failure.code === "already_completed") {
        setDone(true);
      } else if (failure.code !== "in_progress") {
        setError(failure.code === "access_unavailable" ? "Unable to verify your session. Please try again." : failure.code === "same_password" ? "Choose a password different from your current password." : "Unable to save your password. Check the password requirements and try again.");
      }
    }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-gray-50 flex items-center justify-center p-5">
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-7"><PulseMark className="w-8 h-8" /><span className="font-semibold text-lg text-navy">PulseFX</span></div>
      {done ? <><CheckCircle2 className="w-8 h-8 text-accent mb-3" /><h1 className="text-xl font-semibold">{recovery ? "Password reset" : "Your account is ready"}</h1><p role="status" className="mt-3 text-sm text-gray-600">{recovery ? "Your password has been updated. Sign in with your email and new password." : "Your password has been saved. Sign in to the Partner portal with your email and password."}</p><button type="button" onClick={onExit} className="mt-5 bg-brand text-navy rounded-lg px-4 py-2.5 text-sm font-medium">Go to sign in</button></> : validation.checking ? <>
        <h1 className="text-xl font-semibold">Checking your link</h1>
        <p role="status" className="mt-3 text-sm text-gray-600">Please wait while we verify your access link.</p>
      </> : !valid || !client || !validation.valid ? <>
        <h1 className="text-xl font-semibold">{validation.reason === "unavailable" ? "Unable to check this link" : !client ? "Password setup unavailable" : "Link expired or already used"}</h1>
        <p role="alert" className="mt-3 text-sm text-danger">{validation.reason === "unavailable" ? "We could not reach the sign-in service. Check your connection and try again." : !client ? "Password setup is not configured. Please contact PulseFX." : recovery ? "This password reset link is invalid, has expired or has already been used. Request a new recovery link from PulseFX." : "This invitation link is invalid, has expired or has already been used. Request a new invitation link from PulseFX."}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {validation.reason === "unavailable" && <button type="button" onClick={retryValidation} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-navy">Try again</button>}
          <button type="button" onClick={onExit} className="text-accent text-sm">Return to sign in</button>
        </div>
      </> : <>
        <h1 className="text-xl font-semibold">{recovery ? "Reset your password" : "Set your password"}</h1>
        <p className="mt-2 text-sm text-gray-600">{recovery ? "Choose a new password for your PulseFX partner account." : "Choose a password to access your PulseFX partner account."}</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <fieldset disabled={busy} className="space-y-4">
            <div><label htmlFor="activation-password" className="block text-xs font-medium mb-1.5">Password</label><input id="activation-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-accent" aria-describedby="password-hint" /><p id="password-hint" className="mt-1.5 text-xs text-gray-500">Use at least 8 characters.</p></div>
            <div><label htmlFor="activation-confirmation" className="block text-xs font-medium mb-1.5">Confirm password</label><input id="activation-confirmation" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-accent" /></div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy disabled:opacity-50">{busy ? "Saving password…" : recovery ? "Reset password" : "Set password"}</button>
          <p className="flex gap-2 text-xs text-gray-500"><ShieldCheck className="w-4 h-4 shrink-0" />Your password is private. PulseFX will never ask you to share it.</p>
        </form>
      </>}
    </div>
  </main>;
}
