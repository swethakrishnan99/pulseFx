import { useEffect, useState } from "react";
import { loadReferralSubmission } from "../lib/referrals";
import { Users, X, Check } from "lucide-react";
import PortalDialog from "./PortalDialog";
import { dialogSecondary } from "../lib/dialogStyles";
import { formatAirtableDateTime as prettyDateTime, airtableFieldValue } from "../lib/airtableDates.mjs";
import { REFERRAL_STATUSES as STATUSES, REFERRAL_STATUS_STYLE as STATUS_STYLE } from "../lib/referralStatuses.mjs";
const STEPS = ["Invite sent", "Account created", "Documents submitted", "Under review", "Onboarded"];
const stepIndex = s => s === "Rejected" ? 3 : STATUSES.indexOf(s);
const referralDateValue = (record, field) => airtableFieldValue(record, field === "created" ? "createdAt" : "modifiedAt", field);
function Badge({ s }) {
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[s] || STATUS_STYLE.Invited}`}>{s}</span>;
}

export default function ReferralDetail({ r, onClose, children, busy = false, admin = false, authenticated = false }) {
  const idx = stepIndex(r.status);
  const [form, setForm] = useState({ loading: true, submission: null, error: "" });
  const [attempt, setAttempt] = useState(0);
  const needsForm = (authenticated || admin) && r.source === "Referral Link";
  useEffect(() => {
    if (!needsForm) return;
    const controller = new AbortController();
    loadReferralSubmission(r.id, controller.signal).then(submission => {
      if (!controller.signal.aborted) setForm({ loading: false, submission, error: "" });
    }).catch(error => {
      if (!controller.signal.aborted) setForm({ loading: false, submission: null, error: error.message });
    });
    return () => controller.abort();
  }, [needsForm, r.id, attempt]);
  return (
    <PortalDialog title={r.company || r.contact || "Referral"} subtitle="Referral details and onboarding progress." icon={<Users className="h-5 w-5" />} maxWidth="max-w-xl" onClose={onClose} busy={busy}>
      <div className="p-6">
        <div className="mb-4"><Badge s={r.status} /></div>
        {[...(admin ? [["Partner", r.partnerName || "Unknown partner"]] : []), ["Source", r.source || "—"], ["Contact", r.contact], ["Email", r.email], ["Country", r.country], ["Expected monthly volume", r.volume || "—"], ["Currencies", r.cur?.join(", ") || "—"], ["Other currency", r.otherCur || "—"], ["Notes", r.notes || "—"], ["Created at", prettyDateTime(referralDateValue(r, "created"))], ["Last modified at", prettyDateTime(referralDateValue(r, "modified"))], ["Last status change at", prettyDateTime(r.statusChangedAt)], ...(admin ? [["Last modified by email", r.modifiedByEmail || "—"], ["Last modified by user ID", r.modifiedByUserId || "—"]] : []), ["Onboarded", r.status === "Onboarded" ? "Yes" : "No"]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{k}</span><span className="text-gray-900 text-right break-all">{v}</span></div>
        ))}
        {needsForm && <section aria-label="Submitted form details" className="mt-5">
          <h3 className="text-sm font-medium text-accent">Submitted form details</h3>
          {form.loading && <p className="mt-2 text-sm text-gray-500">Loading form details…</p>}
          {form.error && <div className="mt-2"><p role="alert" className="text-sm text-danger">{form.error}</p><button type="button" className={`${dialogSecondary} mt-2`} onClick={() => { setForm({ loading: true, submission: null, error: "" }); setAttempt(value => value + 1); }}>Try again</button></div>}
          {!form.loading && !form.error && !form.submission && <p className="mt-2 text-sm text-gray-500">No linked form details available.</p>}
          {form.submission && [["First name", form.submission.firstName], ["Last name", form.submission.lastName], ["Phone", form.submission.phone], ["Business interests", form.submission.interests.join(", ")]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm"><span className="text-gray-500">{label}</span><span className="break-words text-right text-gray-900">{value || "—"}</span></div>)}
        </section>}
        <p className="text-sm font-medium text-accent mt-5 mb-2">Onboarding progress</p>
        <ol className="flex flex-col gap-2">
          {STEPS.map((s, i) => {
            const rejectedHere = r.status === "Rejected" && i === 4;
            const done = r.status !== "Rejected" ? i <= idx : i <= 2;
            return (
              <li key={s} className="flex items-center gap-2 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${rejectedHere ? "bg-danger" : done ? "bg-success" : "bg-gray-200"}`} aria-hidden="true">
                  {rejectedHere ? <X className="w-3 h-3" /> : done ? <Check className="w-3 h-3" /> : null}
                </span>
                <span className={done || rejectedHere ? "text-gray-900" : "text-gray-400"}>{rejectedHere ? "Not approved" : s}</span>
              </li>
            );
          })}
        </ol>
      {children || <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={dialogSecondary}>Close</button></div>}
      </div>
    </PortalDialog>
  );
}
