import { useEffect, useState } from "react";
import { Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import PulseMark from "./PulseMark";
import Modal from "./Modal";

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

function EmailRequestModal({ mode, onClose }) {
  const isReset = mode === "reset";
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setDone(true);
  }

  return (
    <Modal title={isReset ? "Reset your password" : "Activate your account"} onClose={onClose}>
      <div className="p-5">
      {done ? (
        <div>
          <p role="status" className="text-sm text-gray-700 mb-4">
            {isReset
              ? "If an account exists for this email address, we have sent a link to reset your password."
              : "If this email address has an invitation, we have sent instructions to activate your account."}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <p className="text-sm text-gray-600 mb-3">
            {isReset
              ? "Enter the email address you use to sign in and we will send you a reset link."
              : "Enter the email address your administrator used to invite you."}
          </p>
          <label htmlFor="lg-modal-email" className="block text-[11px] text-gray-500 mb-1">Email address</label>
          <input
            id="lg-modal-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            autoComplete="email"
            className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100"
          />
          {error && <p className="text-[11px] text-danger mt-1" role="alert">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="text-sm text-gray-600 px-3 py-2 rounded-md hover:bg-gray-100">
              Cancel
            </button>
            <button
              type="submit"
              className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
            >
              {isReset ? "Send reset link" : "Send instructions"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">Demo only. No email is sent.</p>
        </form>
      )}
      </div>
    </Modal>
  );
}

/** Sign-in screen. `onSignIn` is called after a successful (demo) sign-in. */
export default function Login({ onSignIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
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

  function submit(e) {
    e.preventDefault();
    const er = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) er.email = "Enter a valid email address.";
    if (!password) er.password = "Enter your password.";
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    setTimeout(() => onSignIn?.(), 600);
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
        <section className="flex flex-col">
          <div className="md:hidden flex items-center gap-2 bg-navy text-white px-5 py-4">
            <PulseMark className="w-8 h-8" />
            <span className="text-lg font-medium tracking-tight">PulseFX</span>
          </div>

          <form onSubmit={submit} noValidate className="flex-1 flex flex-col justify-center p-6 md:p-10 w-full max-w-sm mx-auto">
            <h1 className="text-xl font-semibold text-gray-900 mb-1">Sign in</h1>
            <p className="text-sm text-gray-500 mb-6">Welcome back. Enter your details to continue.</p>

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

            <button
              type="submit"
              disabled={busy}
              className="mt-5 w-full bg-accent text-white text-sm font-medium py-2.5 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {busy ? "Signing in..." : "Sign in"}
            </button>

            <div className="border-t border-gray-100 mt-6 pt-4 text-center text-sm text-gray-500">
              First time here?{" "}
              <button type="button" onClick={() => setModal("activate")} className="font-medium text-accent hover:underline">
                Activate your account
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center mt-3">Demo only. Enter any email address and password.</p>
          </form>
        </section>
      </div>

      <p className="text-[11px] text-gray-400 mt-4 text-center">
        PulseFX &copy; 2026 &nbsp;|&nbsp; Regulations &amp; Terms of Use
      </p>

      {modal && <EmailRequestModal mode={modal} onClose={() => setModal(null)} />}
    </div>
  );
}