import { useState } from "react";
import { Eye, EyeOff, Check, Circle, Laptop, Smartphone, CheckCircle2, ShieldCheck } from "lucide-react";
import Toggle from "./Toggle";

const CARD = "bg-white rounded-xl border border-gray-200/70 p-4 md:p-5 mb-4";
const INPUT =
  "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";

const RULES = [
  { key: "len", label: "At least 12 characters", test: (p) => p.length >= 12 },
  { key: "case", label: "Upper and lower case letters", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: "num", label: "At least one number", test: (p) => /\d/.test(p) },
  { key: "sym", label: "At least one symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const SESSIONS = [
  { id: 1, device: "MacBook Pro, Chrome", place: "Toronto, Canada", when: "Active now", current: true, icon: Laptop },
  { id: 2, device: "iPhone, Safari", place: "Toronto, Canada", when: "Yesterday, 6:42 PM", icon: Smartphone },
  { id: 3, device: "Windows PC, Edge", place: "Mississauga, Canada", when: "Oct 12, 2026", icon: Laptop },
];

function PasswordField({ id, label, value, onChange, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          className={`${INPUT} pr-9`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-[11px] text-danger mt-1" role="alert">{error}</p>}
    </div>
  );
}

export default function SecurityTab() {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwErr, setPwErr] = useState({});
  const [pwDone, setPwDone] = useState(false);
  const [twoStep, setTwoStep] = useState(false);
  const [method, setMethod] = useState("app");
  const [alerts, setAlerts] = useState(true);
  const [sessions, setSessions] = useState(SESSIONS);

  const setField = (k) => (e) => {
    setPw((p) => ({ ...p, [k]: e.target.value }));
    setPwErr((er) => ({ ...er, [k]: undefined }));
    setPwDone(false);
  };

  function updatePassword(e) {
    e.preventDefault();
    const er = {};
    if (!pw.current) er.current = "Enter your current password.";
    if (!RULES.every((r) => r.test(pw.next))) er.next = "Your new password does not meet all the requirements.";
    else if (pw.next === pw.current) er.next = "Your new password must be different from your current password.";
    if (pw.confirm !== pw.next) er.confirm = "The passwords do not match.";
    setPwErr(er);
    if (Object.keys(er).length) return;
    setPw({ current: "", next: "", confirm: "" });
    setPwDone(true);
  }

  const others = sessions.filter((s) => !s.current);

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-4 items-start">
        <div>
      <form onSubmit={updatePassword} noValidate className={CARD} aria-labelledby="sec-pw">
        <h2 id="sec-pw" className="text-sm font-medium text-gray-900">Password</h2>
        <p className="text-xs text-gray-500 mb-3">Last changed 3 months ago.</p>
        <div className="grid grid-cols-1 gap-3 max-w-sm">
          <PasswordField id="sec-cur" label="Current password" value={pw.current} onChange={setField("current")} error={pwErr.current} autoComplete="current-password" />
          <PasswordField id="sec-new" label="New password" value={pw.next} onChange={setField("next")} error={pwErr.next} autoComplete="new-password" />
          <ul className="grid grid-cols-1 gap-1 -mt-1" aria-label="Password requirements">
            {RULES.map((r) => {
              const ok = r.test(pw.next);
              return (
                <li key={r.key} className={`flex items-center gap-1.5 text-xs ${ok ? "text-success" : "text-gray-500"}`}>
                  {ok ? <Check className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                  {r.label}
                </li>
              );
            })}
          </ul>
          <PasswordField id="sec-confirm" label="Confirm new password" value={pw.confirm} onChange={setField("confirm")} error={pwErr.confirm} autoComplete="new-password" />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <button
            type="submit"
            className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors"
          >
            Update password
          </button>
          {pwDone && (
            <p role="status" className="flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="w-4 h-4" />
              Password updated.
            </p>
          )}
        </div>
      </form>

      <section className={CARD} aria-labelledby="sec-2fa">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="sec-2fa" className="text-sm font-medium text-gray-900 flex items-center gap-2">
              Two-step verification
              <span className={`text-[11px] font-normal px-1.5 py-0.5 rounded ${twoStep ? "bg-accent-100 text-accent-800" : "bg-gray-100 text-gray-600"}`}>
                {twoStep ? "On" : "Off"}
              </span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5 max-w-md">
              Add a second check when you sign in, so your account stays protected even if your password is stolen.
            </p>
          </div>
          <Toggle checked={twoStep} onChange={setTwoStep} label="Two-step verification" />
        </div>

        {twoStep && (
          <fieldset className="mt-4 max-w-md">
            <legend className="text-[11px] text-gray-500 mb-2">Verification method</legend>
            {[
              ["app", "Authenticator app", "Use a code from an app such as Microsoft Authenticator or Google Authenticator."],
              ["sms", "Text message", "We send a code to +1 416 555 ••42."],
            ].map(([key, title, hint]) => (
              <label
                key={key}
                className={`flex items-start gap-3 p-3 mb-2 rounded-lg border cursor-pointer ${
                  method === key ? "border-accent bg-accent-100/50" : "border-gray-200"
                }`}
              >
                <input type="radio" name="method" checked={method === key} onChange={() => setMethod(key)} className="mt-1 accent-[#00785F]" />
                <span>
                  <span className="block text-sm text-gray-900">{title}</span>
                  <span className="block text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </section>

        </div>
        <div>
      <section className={`${CARD} flex items-center justify-between gap-4`} aria-labelledby="sec-alerts">
        <div className="min-w-0">
          <h2 id="sec-alerts" className="text-sm font-medium text-gray-900">Sign-in alerts</h2>
          <p className="text-xs text-gray-500 mt-0.5">Email me when my account is accessed from a new device.</p>
        </div>
        <Toggle checked={alerts} onChange={setAlerts} label="Sign-in alerts" />
      </section>

      <section className={CARD} aria-labelledby="sec-sessions">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 id="sec-sessions" className="text-sm font-medium text-gray-900">Where you're signed in</h2>
          <button
            type="button"
            disabled={others.length === 0}
            onClick={() => setSessions((s) => s.filter((x) => x.current))}
            className="text-xs font-medium text-accent hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
          >
            Sign out of all other sessions
          </button>
        </div>
        <ul className="divide-y divide-gray-100">
          {sessions.map(({ id, device, place, when, current, icon: Icon }) => (
            <li key={id} className="flex items-center gap-3 py-3">
              <Icon className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 flex flex-wrap items-center gap-2">
                  {device}
                  {current && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent-100 text-accent-800">This device</span>
                  )}
                </p>
                <p className="text-xs text-gray-500">{place} · {when}</p>
              </div>
              {!current && (
                <button
                  type="button"
                  onClick={() => setSessions((s) => s.filter((x) => x.id !== id))}
                  className="text-xs font-medium text-danger hover:underline shrink-0"
                  aria-label={`Sign out ${device}`}
                >
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
        {others.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-gray-500 pt-2">
            <ShieldCheck className="w-4 h-4 text-success" />
            You are only signed in on this device.
          </p>
        )}
      </section>

        </div>
      </div>

      <p className="text-[11px] text-gray-400">Demo only. No changes are sent to a server.</p>
    </div>
  );
}