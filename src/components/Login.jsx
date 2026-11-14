import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, Users, Wallet, ArrowLeft } from "lucide-react";
import PulseMark from "./PulseMark";
import Modal from "./Modal";
import { supabase, requirePartner } from "../lib/supabase";

const INPUT_WRAP =
  "flex items-center gap-2 border rounded-md px-3 bg-white focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-100";

const TIPS = [
  "We will never ask for your password. Do not share your password with anyone.",
  "Always check the web address in your browser before you sign in.",
  "Turn on two-step verification in User settings for extra protection.",
  "PulseFX will never ask you to move money to a safe account. If you are unsure, contact us.",
];

const DOT_PATTERN = {
  backgroundImage:
    "radial-gradient(circle at 20% 25%, rgba(0,175,142,0.28), transparent 28%)," +
    "radial-gradient(circle at 80% 70%, rgba(0,175,142,0.18), transparent 30%)," +
    "radial-gradient(rgba(255,255,255,0.09) 1.4px, transparent 1.6px)",
  backgroundSize: "auto, auto, 16px 16px",
};

function AccessHelpModal({ mode, onClose }) {
  const isReset = mode === "reset";
  const subject = encodeURIComponent(isReset ? "Partner portal password recovery" : "Partner portal activation");
  return <Modal title={isReset ? "Reset your password" : "Activate your account"} onClose={onClose}>
    <div className="p-5 space-y-4 text-sm text-gray-600">
      <p>{isReset ? "Contact the PulseFX partnerships team to request a password reset link." : "Contact the PulseFX partnerships team to request an invitation link."}</p>
      <p>Include your registered email address and partner name. After verifying your request, the team will share a private link with you.</p>
      <a href={`mailto:partnerships@pulsefx.com?subject=${subject}`} className="inline-flex items-center gap-2 text-accent font-medium break-all"><Mail className="w-4 h-4 shrink-0" />partnerships@pulsefx.com</a>
      <p className="text-xs text-gray-500">Never send your password. PulseFX will not ask you to share it.</p>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded-md hover:bg-gray-100">Back to sign in</button>
        <a href={`mailto:partnerships@pulsefx.com?subject=${subject}`} className="bg-brand text-navy text-sm font-medium px-4 py-2 rounded-md hover:bg-[#009a7d]">Email PulseFX</a>
      </div>
    </div>
  </Modal>;
}

/** Partner credentials are verified by Supabase before opening the portal. */
export default function Login({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [portal, setPortal] = useState(null);
  const partner = portal === "partner";
  const [tip, setTip] = useState(0);
  const [modal, setModal] = useState(null); // "reset" | "activate" | null
  const [paused, setPaused] = useState(false);

  // Change the security tip every 3 seconds. Pauses while the tip is hovered or
  // focused, and does not run for people who prefer reduced motion.
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (paused || reduce) return;
    const id = setTimeout(() => setTip((t) => (t + 1) % TIPS.length), 3000);
    return () => clearTimeout(id);
  }, [tip, paused]);

  function choosePortal(role) {
    setEmail("");
    setPassword("");
    setShow(false);
    setErrors({});
    setModal(null);
    setPortal(role);
  }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const er = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) er.email = "Enter a valid email address.";
    if (!password) er.password = "Enter your password.";
    setErrors(er);
    if (Object.keys(er).length) return;

    setBusy(true);
    try {
      if (partner) {
        if (!supabase) {
          throw new Error("Partner sign-in is not configured. Please contact PulseFX.");
        }
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        await requirePartner(data.session);
      }
      onSignIn?.(partner ? "partner" : "client");
    } catch (error) {
      let message = "Unable to sign in. Please try again.";
      if (error.code === "invalid_credentials") message = "Invalid email or password.";
      else if (error.code === "email_not_confirmed") message = "Please confirm your email before signing in.";
      else if (error.message === "Your account does not have partner access. Please contact PulseFX." ||
               error.message === "Partner sign-in is not configured. Please contact PulseFX.") {
        message = error.message;
      }
      setErrors({ auth: message });
    } finally {
      setBusy(false);
    }
  }


  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-[960px] grid grid-cols-1 md:grid-cols-[1.05fr_1fr] bg-white rounded-xl border border-gray-200/70 overflow-hidden shadow-[0_8px_30px_rgba(0,18,41,0.08)]">
        {/* Brand panel (tablet and larger) */}
        <aside className="hidden md:flex flex-col justify-between bg-navy text-white p-8 min-h-[520px]" style={DOT_PATTERN}>
          <div className="flex items-center gap-2">
            <PulseMark className="w-9 h-9" />
            <span className="text-xl font-medium tracking-tight">PulseFX</span>
          </div>

          <h2 className="text-2xl lg:text-[28px] leading-tight font-semibold max-w-sm">
            More than just payments, we&rsquo;re your FX strategy team
          </h2>

          <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-brand mb-2">
              <ShieldCheck className="w-4 h-4" />
              Security tip
            </p>
            <div className="min-h-[72px] max-w-sm overflow-hidden">
              <p key={tip} className="pfx-tip text-sm text-white/85">
                {TIPS[tip]}
              </p>
            </div>
            <div className="flex items-center justify-between max-w-sm mt-2">
              <button
                type="button"
                onClick={() => setTip((t) => (t + 1) % TIPS.length)}
                className="text-xs font-medium tracking-wide text-white/80 hover:text-white underline underline-offset-4"
              >
                Next tip
              </button>
              <div className="flex items-center gap-1.5" role="group" aria-label="Choose a tip">
                {TIPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTip(i)}
                    aria-label={`Tip ${i + 1} of ${TIPS.length}`}
                    aria-current={i === tip}
                    className={`h-1.5 rounded-full transition-all ${i === tip ? "w-5 bg-brand" : "w-1.5 bg-white/30 hover:bg-white/50"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Sign-in form */}
        <section className="relative flex flex-col">
          <div className="md:hidden flex items-center gap-2 bg-navy text-white px-5 py-4">
            <PulseMark className="w-8 h-8" />
            <span className="text-lg font-medium tracking-tight">PulseFX</span>
          </div>

          {!portal ? (
            <div className="flex-1 flex flex-col justify-start p-6 pt-12 md:p-10 w-full max-w-sm mx-auto md:min-h-[520px]">
              <h1 className="text-xl font-semibold text-gray-900 mb-1">Welcome to PulseFX</h1>
              <p className="text-sm text-gray-500 mb-6">Choose your portal to continue.</p>
              <div className="flex flex-col gap-3">
                {[
                  { role: "client", title: "Client portal", description: "Access your accounts and manage payments.", Icon: Wallet },
                  { role: "partner", title: "Partner portal", description: "Refer clients and track their onboarding.", Icon: Users },
                ].map(({ role, title, description, Icon }) => (
                  <section key={role} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-5 h-5 text-gray-500" aria-hidden="true" />
                      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">{description}</p>
                    <button type="button" onClick={() => choosePortal(role)} className="w-full bg-brand text-navy text-sm font-medium py-2.5 rounded-md hover:bg-[#009a7d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                      Login
                    </button>
                  </section>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-6 pt-4 text-center text-sm text-gray-500">
                <p>Want to take a look first?</p>
                <select
                  aria-label="Explore a demo"
                  value=""
                  onChange={(event) => onSignIn?.(event.target.value)}
                  className="mt-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <option value="" disabled>Explore a demo</option>
                  <option value="client">Client demo</option>
                  <option value="partner-demo">Partner demo</option>
                </select>
              </div>
            </div>
          ) : (
          <form onSubmit={submit} noValidate className="flex-1 flex flex-col justify-start p-6 pt-12 md:p-10 w-full max-w-sm mx-auto md:min-h-[520px]">
            <button type="button" disabled={busy} onClick={() => choosePortal(null)} className="absolute top-[76px] md:top-3 left-6 md:left-10 flex items-center gap-1 text-xs text-gray-500 hover:text-accent disabled:opacity-50">
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Choose another portal
            </button>
            <h1 className="text-xl font-semibold text-gray-900 mb-1">{partner ? "Partner sign in" : "Client sign in"}</h1>
            <p className="text-sm text-gray-500 mb-6">{partner ? "Sign in to the PulseFX partner portal to track your referrals." : "Welcome back. Enter your details to continue."}</p>

            <label htmlFor="lg-email" className="block text-[11px] font-medium text-gray-500 mb-1">Email address</label>
            <div className={`${INPUT_WRAP} ${errors.email ? "border-danger" : "border-gray-200"}`}>
              <Mail className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <input
                id="lg-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors((er) => ({ ...er, email: undefined }));
                }}
                autoComplete="username"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "lg-email-err" : undefined}
                className="w-full py-2.5 text-sm bg-transparent focus:outline-none"
              />
            </div>
            {errors.email && <p id="lg-email-err" className="text-[11px] text-danger mt-1" role="alert">{errors.email}</p>}

            <label htmlFor="lg-password" className="block text-[11px] font-medium text-gray-500 mb-1 mt-4">Password</label>
            <div className={`${INPUT_WRAP} ${errors.password ? "border-danger" : "border-gray-200"}`}>
              <Lock className="w-4 h-4 text-gray-400 shrink-0" aria-hidden="true" />
              <input
                id="lg-password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrors((er) => ({ ...er, password: undefined }));
                }}
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "lg-pw-err" : undefined}
                className="w-full py-2.5 text-sm bg-transparent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p id="lg-pw-err" className="text-[11px] text-danger mt-1" role="alert">{errors.password}</p>}

            <div className="flex justify-end mt-2">
              <button type="button" onClick={() => setModal("reset")} className="text-xs font-medium text-accent hover:underline">
                Forgot password?
              </button>
            </div>

            {errors.auth && <p role="alert" className="text-xs text-danger mt-3">{errors.auth}</p>}

            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full bg-brand text-navy text-sm font-medium py-2.5 rounded-md hover:bg-[#009a7d] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

          </form>
          )}
        </section>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center">
        PulseFX &copy; 2026 &nbsp;|&nbsp; Regulations &amp; Terms of Use
      </p>

      {modal && <AccessHelpModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}