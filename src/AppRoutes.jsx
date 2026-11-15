import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Login from "./components/Login";
import PulseMark from "./components/PulseMark";
import ClientApp from "./ClientApp";
import PartnerPortal from "./components/PartnerPortal";
import PartnerSession from "./components/PartnerSession";
import PartnerActivation from "./components/PartnerActivation";

// Addresses used before the router existed (https://site/#partner) still work.
const LEGACY_HASH = {
  "#partner": "/partner",
  "#partner-admin": "/partner",
  "#partner-admin-demo": "/partner",
  "#partner-demo": "/demo",
};

/** The first screen: portal choice, plus invitation and password-reset links that carry a token. */
function Entry() {
  const navigate = useNavigate();
  const { search } = useLocation();
  // Invitation and reset links open the site address with ?token_hash=...&type=... so this must keep working.
  if (new URLSearchParams(search).has("token_hash")) {
    return <PartnerActivation onExit={() => navigate("/", { replace: true })} />;
  }
  const legacy = LEGACY_HASH[window.location.hash];
  if (legacy) return <Navigate to={legacy} replace />;
  return (
    <Login onSignIn={(role) => navigate(role === "client" ? "/client" : role === "partner-demo" ? "/demo" : "/partner")} />
  );
}

function PartnerSignIn() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const from = typeof state?.from === "string" && state.from.startsWith("/partner") ? state.from : "/partner";
  return <Login initialPortal="partner" onBack={() => navigate("/")} onSignIn={() => navigate(from, { replace: true })} />;
}

function NotFound() {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl border border-gray-200/70 p-8 max-w-md text-center">
        <PulseMark className="w-10 h-10 mx-auto" />
        <h1 className="text-xl font-semibold text-gray-900 mt-4">Page not found</h1>
        <p className="text-sm text-gray-500 mt-1">This address doesn't match a page in the portal.</p>
        <Link to="/" className="inline-block mt-5 text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d]">Go to sign in</Link>
      </div>
    </main>
  );
}

export default function AppRoutes() {
  const navigate = useNavigate();
  const toStart = () => navigate("/", { replace: true });
  return (
    <Routes>
      <Route path="/" element={<Entry />} />
      <Route path="/partner/sign-in" element={<PartnerSignIn />} />
      <Route path="/partner/:page?" element={<PartnerSession onExit={toStart} />} />
      <Route path="/demo/:page?" element={<PartnerPortal onExit={toStart} basePath="/demo" />} />
      <Route path="/client" element={<ClientApp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}