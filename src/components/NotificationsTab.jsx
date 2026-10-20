import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import Toggle from "./Toggle";

const STORAGE_KEY = "pfx.notifications";
const CARD = "bg-white rounded-xl border border-gray-200/70 p-4 md:p-5 mb-4";

const ROWS = [
  ["payments", "Payment updates", "When a payment is created, funded, sent or delivered."],
  ["alerts", "Rate alerts", "When a rate you are watching is reached."],
  ["funding", "Funding reminders", "When a payment is waiting for funds."],
  ["news", "Product updates", "Occasional news about new PulseFX features."],
];
const DEFAULTS = { payments: true, alerts: true, funding: true, news: false, via: "email" };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export default function NotificationsTab() {
  const [saved, setSaved] = useState(load);
  const [form, setForm] = useState(saved);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const change = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setJustSaved(false);
  };
  function onSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable: demo still works */
    }
    setSaved(form);
    setJustSaved(true);
  }

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-x-4 items-start">
      <section className={CARD} aria-labelledby="nt-what">
        <h2 id="nt-what" className="text-sm font-medium text-gray-900 mb-1">What you are notified about</h2>
        <ul className="divide-y divide-gray-100">
          {ROWS.map(([key, title, hint]) => (
            <li key={key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-gray-900">{title}</p>
                <p className="text-xs text-gray-500">{hint}</p>
              </div>
              <Toggle checked={form[key]} onChange={(v) => change({ [key]: v })} label={title} />
            </li>
          ))}
        </ul>
      </section>

      <section className={CARD} aria-labelledby="nt-how">
        <h2 id="nt-how" className="text-sm font-medium text-gray-900 mb-3">How you are notified</h2>
        <fieldset className="max-w-md">
          <legend className="sr-only">Delivery method</legend>
          {[
            ["email", "Email", "Sent to info@pulsefx.com"],
            ["sms", "Text message", "Sent to your mobile phone"],
            ["both", "Email and text message", "Get both"],
          ].map(([key, title, hint]) => (
            <label
              key={key}
              className={`flex items-start gap-3 p-3 mb-2 rounded-lg border cursor-pointer ${
                form.via === key ? "border-accent bg-accent-100/50" : "border-gray-200"
              }`}
            >
              <input type="radio" name="via" checked={form.via === key} onChange={() => change({ via: key })} className="mt-1 accent-[#00785F]" />
              <span>
                <span className="block text-sm text-gray-900">{title}</span>
                <span className="block text-xs text-gray-500">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </section>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty}
          className="bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
        {justSaved && !dirty && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="w-4 h-4" />
            Preferences saved.
          </p>
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Demo only. No notifications are sent.</p>
    </div>
  );
}