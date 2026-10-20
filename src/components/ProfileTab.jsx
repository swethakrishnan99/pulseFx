import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

const STORAGE_KEY = "pfx.profile2";
const INPUT =
  "w-full max-w-xs text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const DEFAULTS = { jobTitle: "Finance Manager", workPhone: "", mobilePhone: "" };

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

function Row({ label, htmlFor, children, hint, error }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-1 sm:gap-6 items-start sm:items-center py-4 border-b border-gray-100 last:border-b-0">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-500">{label}</label>
      <div>
        {children}
        {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
        {error && <p className="text-[11px] text-danger mt-1" role="alert">{error}</p>}
      </div>
    </div>
  );
}

export default function ProfileTab({ username, email }) {
  const [saved, setSaved] = useState(load);
  const [form, setForm] = useState(saved);
  const [errors, setErrors] = useState({});
  const [justSaved, setJustSaved] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((er) => ({ ...er, [key]: undefined }));
    setJustSaved(false);
  };

  function onSave(e) {
    e.preventDefault();
    const er = {};
    const phone = /^[+()\d\s.-]{7,20}$/;
    if (form.workPhone && !phone.test(form.workPhone)) er.workPhone = "Enter a valid phone number.";
    if (form.mobilePhone && !phone.test(form.mobilePhone)) er.mobilePhone = "Enter a valid phone number.";
    setErrors(er);
    if (Object.keys(er).length) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    } catch {
      /* storage unavailable: demo still works */
    }
    setSaved(form);
    setJustSaved(true);
  }

  return (
    <form onSubmit={onSave} noValidate>
      <div className="bg-white rounded-xl border border-gray-200/70 px-4 md:px-6 py-2 mb-4">
        <Row label="Username">
          <p className="text-sm font-medium text-gray-900">{username}</p>
        </Row>
        <Row label="Job title" htmlFor="pf-title">
          <input id="pf-title" className={INPUT} value={form.jobTitle} onChange={set("jobTitle")} autoComplete="organization-title" />
        </Row>
        <Row label="Email" hint="To change your email, contact your account administrator.">
          <p className="text-sm font-medium text-gray-900 break-all">{email}</p>
        </Row>
        <Row label="Work phone" htmlFor="pf-work" error={errors.workPhone}>
          <input id="pf-work" type="tel" className={INPUT} value={form.workPhone} onChange={set("workPhone")} autoComplete="tel" />
        </Row>
        <Row label="Mobile phone" htmlFor="pf-mobile" error={errors.mobilePhone}>
          <input id="pf-mobile" type="tel" className={INPUT} value={form.mobilePhone} onChange={set("mobilePhone")} autoComplete="tel-national" />
        </Row>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {justSaved && !dirty && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success">
            <CheckCircle2 className="w-4 h-4" />
            Changes saved.
          </p>
        )}
        <button
          type="submit"
          disabled={!dirty}
          className="bg-accent text-white text-sm font-medium px-5 py-2 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Demo only. Details are stored in this browser and are not sent anywhere.</p>
    </form>
  );
}