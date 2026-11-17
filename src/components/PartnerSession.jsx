import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase, requirePartner } from "../lib/supabase";
import PartnerPortal from "./PartnerPortal";
import PortalDialog from "./PortalDialog";
import { Clock } from "lucide-react";
import { sessionActivityKey, watchSessionIdle } from "../lib/sessionIdle.mjs";

export default function PartnerSession({ onExit }) {
  const [access, setAccess] = useState({ loading: true });
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const location = useLocation();
  const manualLogout = useRef(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let version = 0;
    let timer;
    let stopIdle;
    let activityKey;
    let expired = false;
    let hadSession = false;
    function expire() {
      if (expired || !active) return;
      expired = true;
      setSessionExpired(true);
      // Block the UI immediately, even if the network is unavailable.
      void supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const current = ++version;
      clearTimeout(timer);
      // Auth callbacks finish before starting another Supabase request.
      timer = setTimeout(async () => {
        if (!active || expired) return;
        if (!session) {
          if (hadSession && !manualLogout.current) { expire(); return; }
          // No session: the router sends the visitor to the partner sign-in page.
          if (current === version) setAccess({ loading: false, signedOut: true });
          return;
        }
        hadSession = true;
        const nextKey = sessionActivityKey(session);
        if (nextKey !== activityKey) {
          stopIdle?.();
          activityKey = nextKey;
          stopIdle = watchSessionIdle({ key: activityKey, onExpire: expire });
        }
        if (expired) return;
        setAccess((previous) => session?.user?.id && previous.user?.id === session.user.id
          ? previous
          : { loading: true });
        try {
          const partner = await requirePartner(session);
          if (active && current === version) setAccess({ loading: false, ...partner });
        } catch {
          if (active && current === version) {
            setAccess({ loading: false, error: "Partner access could not be verified. Please sign in again." });
          }
        }
      }, 0);
    });
    return () => {
      active = false;
      clearTimeout(timer);
      stopIdle?.();
      data.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    manualLogout.current = true;
    setSigningOut(true);
    setSignOutError("");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      manualLogout.current = false;
      setSignOutError("Unable to sign out. Please try again.");
      setSigningOut(false);
      return;
    }
    onExit();
  }

  if (!sessionExpired && supabase && access.signedOut) {
    return signingOut ? null : <Navigate to="/partner/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (!sessionExpired && (!supabase || access.loading || !access.user)) {
    return (
      <main id="main-content" className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
          <p role="status" className="text-sm text-gray-700">
            {!supabase ? "Partner sign-in is not configured." : access.loading ? "Verifying partner access…" : access.error}
          </p>
          {(!supabase || !access.loading) && (
            <button type="button" onClick={onExit} className="mt-4 text-sm font-medium text-accent">
              Return to sign in
            </button>
          )}
        </div>
      </main>
    );
  }

  return (
    <>
    <div inert={sessionExpired} aria-hidden={sessionExpired || undefined} className={sessionExpired ? "pointer-events-none blur-sm select-none" : undefined}>
    {access.user && <PartnerPortal
      onExit={signOut}
      user={access.user}
      isAdmin={access.isAdmin}
      basePath="/partner"
      signingOut={signingOut}
      signOutError={signOutError}
    />}
    </div>
    {sessionExpired && (
      <PortalDialog showCloseButton={false} title="Session expired" icon={<Clock className="h-5 w-5" />} maxWidth="max-w-md" onClose={onExit}>
        <div className="px-6 py-6 sm:px-8">
          <p className="text-sm text-gray-600">Your session has expired. Please sign in again to continue.</p>
          <button type="button" onClick={onExit} className="mt-6 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent/90 focus-visible:outline-accent">Sign in again</button>
        </div>
      </PortalDialog>
    )}
    </>
  );
}