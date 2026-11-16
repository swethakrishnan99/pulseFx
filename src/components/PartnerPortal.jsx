import { airtableFieldValue, formatAirtableDateTime, inAirtableDateRange } from "../lib/airtableDates.mjs";
import { createSupportRequest } from "../lib/support";
import SearchFilter from "./SearchFilter";
import PortalDialog from "./PortalDialog";
import AddClientFormFields, { AddClientDialog } from "./AddClientModal";
import ActionButton from "./ActionButton";
import DateRangeFilter from "./DateRangeFilter";
import SortableHeader from "./SortableHeader";
import TablePager from "./TablePager";
import { usePagination } from "../lib/usePagination";
import { sortTableRows } from "../lib/tableSort.mjs";
import ClearFiltersButton from "./ClearFiltersButton";
import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Home, Users, DollarSign, Landmark, BookOpen, Headset, Copy, Check, X, Eye, Download, UserPlus, ChevronDown, CheckCircle2, Palette, Upload, Phone, MessageSquare, Mail, FileText, Trash2, RefreshCw } from "lucide-react";
import Sidebar from "./Sidebar";
import PartnerAdmin from "./PartnerAdmin";
import BankingDetails from "./BankingDetails";
import PayoutHistory from "./PayoutHistory";
import BankingApprovals from "./BankingApprovals";
import AdminPayouts from "./AdminPayouts";
import { createPartnerReferral, loadPartnerReferrals, loadPartnerProfile } from "../lib/referrals";

// Partner portal demo for referral partners (for example an accounting firm that refers its clients to PulseFX).
// The public demo is reached at #partner-demo. Authenticated referrals use Airtable.

const PARTNER = { name: "ABC Accounting", onboardedOn: "2026-09-02", slug: "abc-accounting" };
const LINK = `https://partners.pulsefx.example/${PARTNER.slug}/signup`;

const DAY = 86400000;
const iso = (off) => { const d = new Date(Date.now() + off * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pretty = (s) => s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—";

const prettyDateTime = formatAirtableDateTime;
const referralDateValue = (record, field) => airtableFieldValue(record, field === "created" ? "createdAt" : "modifiedAt", field);

const STEPS = ["Invite sent", "Account created", "Documents submitted", "Under review", "Onboarded"];
const STATUSES = ["Invited", "Account created", "Documents submitted", "Under review", "Onboarded", "Rejected"];
const STATUS_STYLE = {
  Invited: "bg-gray-100 text-gray-700", "Account created": "bg-gray-100 text-gray-700", "Documents submitted": "bg-accent-100 text-accent",
  "Under review": "bg-warning-100 text-amber-800", Onboarded: "bg-success-100 text-success", Rejected: "bg-danger-100 text-danger",
};
const stepIndex = (s) => (s === "Rejected" ? 3 : STATUSES.indexOf(s));

// Module-level so a new client survives moving between tabs (resets on reload).
const REFERRALS = [
  { id: 1, company: "Northwind Machining Ltd.", contact: "Ana Costa", email: "ana@northwind.example", country: "Canada", status: "Documents submitted", created: iso(-6), modified: iso(-2) },
  { id: 2, company: "Harbour Street Foods", contact: "Tom Reyes", email: "tom@harbourstreet.example", country: "Canada", status: "Under review", created: iso(-20), modified: iso(-3) },
  { id: 3, company: "Lakeside Imports Inc.", contact: "Mei Lin", email: "mei@lakeside.example", country: "Canada", status: "Invited", created: iso(-40), modified: iso(-40) },
  { id: 4, company: "Pinecrest Logistics", contact: "Sam Okafor", email: "sam@pinecrest.example", country: "United States", status: "Account created", created: iso(-47), modified: iso(-44) },
  { id: 5, company: "Redline Outdoor Gear", contact: "Julia Park", email: "julia@redline.example", country: "Canada", status: "Onboarded", created: iso(-62), modified: iso(-50) },
  { id: 6, company: "Summit Dental Group", contact: "Raj Patel", email: "raj@summitdental.example", country: "Canada", status: "Onboarded", created: iso(-96), modified: iso(-80) },
  { id: 7, company: "Cobalt Packaging Co.", contact: "Elena Rossi", email: "elena@cobalt.example", country: "Italy", status: "Rejected", created: iso(-120), modified: iso(-110) },
  { id: 8, company: "Birchwood Furniture", contact: "Dan Wu", email: "dan@birchwood.example", country: "Canada", status: "Onboarded", created: iso(-170), modified: iso(-150) },
];
let nextId = 9;

const card = "bg-white rounded-xl border border-gray-200/70";
const field = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const lab = "block text-xs text-gray-500 mb-1";
const primary = "text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";

const ghost = "inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50";
const PHONE = { display: "416 848 1028", tel: "+14168481028" };
const EMAIL = "partnerships@pulsefx.com";

function Badge({ s }) {
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[s] || STATUS_STYLE.Invited}`}>{s}</span>;
}

const NAV = [["home", "Home", Home], ["referrals", "Referrals", Users], ["add", "Add a client", UserPlus], ["banking", "Banking details", Landmark], ["payouts", "Payout history", DollarSign], ["brand", "Brand kit", Palette], ["guide", "Partner guide", BookOpen], ["contact", "Contact", Headset]];
const PAGE_SUBTITLES = {
  admin: "Manage portal access for partners and PulseFX administrators.",
  "banking-approvals": "Review banking updates and approve or reject partner submissions.",
  "admin-payouts": "Manage partner payouts and review payment history.",
  home: "View your referral activity and onboarding progress.",
  referrals: "Track your referrals from invitation to onboarding.",
  add: "Refer a client and add their company and contact details.",
  banking: "Update your bank details and track the review status.",
  payouts: "Track your payouts and review payment details.",
  brand: "Manage your referral branding and download PulseFX assets.",
  guide: "Explore the referral process and resources for your clients.",
  contact: "Get in touch with the PulseFX partnerships team.",
};


/* ---------------------------------------------------------------- Home */
function PartnerHome({ go }) {
  const [copied, setCopied] = useState(false);
  const total = REFERRALS.length;
  const onboarded = REFERRALS.filter((r) => r.status === "Onboarded").length;
  const inProgress = REFERRALS.filter((r) => !["Onboarded", "Rejected"].includes(r.status)).length;
  function copy() { navigator.clipboard?.writeText(LINK); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} p-5`}>
        <p className="text-xs text-gray-500">Your partner status</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-lg font-semibold text-gray-900">{PARTNER.name}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success"><CheckCircle2 className="w-3.5 h-3.5" />Onboarded</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Your partner application was approved on {pretty(PARTNER.onboardedOn)}. You can refer clients and track them here.</p>
      </div>

      <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-accent">Referral link</p>
        <p className="text-xs text-gray-500 mt-0.5">Share this link with your clients. Anyone who signs up with it appears under Referrals.</p>
        <div className="flex items-center gap-2 mt-3">
          <input readOnly aria-label="Referral link" value={LINK} className={`${field} font-mono text-xs bg-gray-50`} />
          <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50">
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[["Referred", total], ["In progress", inProgress], ["Onboarded", onboarded]].map(([k, v]) => (
          <div key={k} className={`${card} p-5`}><p className="text-xs text-gray-500">{k}</p><p className="text-2xl font-semibold text-gray-900 mt-1">{v}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          ["Referrals", "Track every business you've referred and where they are in onboarding.", "Open referrals", "referrals"],
          ["Add a new client", "Register a client's details and track their progress under Referrals.", "Add a client", "add"],
          ["Partner guide", "Answers to common questions about referring and onboarding clients.", "Read the guide", "guide"],
          ["Banking details", "Where we send partner payouts. Keep these up to date.", "View details", "banking"],
        ].map(([t, d, b, k]) => (
          <div key={k} className={`${card} p-5 flex flex-col`}>
            <p className="text-sm font-medium text-accent">{t}</p>
            <p className="text-sm text-gray-500 mt-1 flex-1">{d}</p>
            <button type="button" onClick={() => go(k)} className={`${primary} mt-4 self-start`}>{b}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Referrals */
// Opens in Excel. Cells that start with = + - @ are prefixed so Excel doesn't run them as formulas.
function exportReferrals(rows) {
  const cell = (v) => { const t = String(v); const safe = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t; return `"${safe.replace(/"/g, '""')}"`; };
  const lines = [
    ["Company", "Contact", "Email", "Country", "Expected monthly volume", "Currencies", "Other currency", "Notes", "Status", "Onboarded", "Created", "Last modified"],
    ...rows.map((r) => [r.company, r.contact, r.email, r.country, r.volume || "", (r.cur || []).join(", "), r.otherCur || "", r.notes || "", r.status, r.status === "Onboarded" ? "Yes" : "No", referralDateValue(r, "created"), referralDateValue(r, "modified")]),
  ].map((r) => r.map(cell).join(","));
  const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = `pulsefx-referrals-${iso(0)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

const referralHeader = "text-left text-xs font-medium text-gray-400 px-3 py-2.5 whitespace-nowrap";
function ReferralSortHeader({ column, sort, onSort, children }) {
  return <SortableHeader column={column} label={children} sort={sort} onSort={onSort} className={referralHeader} />;
}

function Referrals({ authenticated = false, go }) {
  const [f, setF] = useState({ query: "", status: "", cFrom: "", cTo: "", mFrom: "", mTo: "" });
  const [filterReset, setFilterReset] = useState(0);
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [open, setOpen] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [remote, setRemote] = useState({ loading: authenticated, records: [], error: "" });
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    let active = true;
    loadPartnerReferrals({ signal: controller.signal }).then((records) => {
      if (active) setRemote({ loading: false, records, error: "" });
    }).catch((error) => {
      if (active) setRemote({ loading: false, records: [], error: error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [authenticated, attempt]);
  const referrals = authenticated ? remote.records : REFERRALS;
  function reload() {
    setOpen(null);
    setRemote({ loading: true, records: [], error: "" });
    setAttempt((value) => value + 1);
  }
  const rows = useMemo(() => {
    const r = referrals.filter((x) =>
      (!f.query.trim() || [x.company, x.contact, x.email].some(value => (value || "").toLowerCase().includes(f.query.trim().toLowerCase()))) && (!f.status || x.status === f.status) &&
      inAirtableDateRange(referralDateValue(x, "created"), f.cFrom, f.cTo) &&
      inAirtableDateRange(referralDateValue(x, "modified"), f.mFrom, f.mTo));
    return sortTableRows(r, sort, { onboarded: (row) => row.status === "Onboarded", created: { value: row => referralDateValue(row, "created"), type: "date" }, modified: { value: row => referralDateValue(row, "modified"), type: "date" } });
  }, [f, sort, referrals]);
  const pager = usePagination(rows, [JSON.stringify(f), sort?.key, sort?.dir].join("|"));
  const set = (k) => (e) => {
    const value = e.target.value;
    setF((current) => ({ ...current, [k]: value }));
  };
  function clearFilters() {
    setF({ query: "", status: "", cFrom: "", cTo: "", mFrom: "", mTo: "" });
    // Also discard any unconfirmed calendar selections.
    setFilterReset((current) => current + 1);
  }
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  const td = "px-3 py-3 text-sm text-gray-700 whitespace-nowrap";
  const dateBad = (a, b) => a && b && a > b;
  return (
    <div className={card}>
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap gap-2">
            {authenticated && <button type="button" onClick={reload} disabled={remote.loading} className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><RefreshCw className="w-4 h-4" />Refresh</button>}
            <button type="button" onClick={() => go("add")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-navy hover:bg-[#009a7d]"><UserPlus className="w-4 h-4" />Add a client</button>
          </div>
        </div>
        <fieldset key={filterReset} disabled={remote.loading || !!remote.error} className="flex flex-wrap items-end gap-3 mt-3">
          <SearchFilter id="referrals-search" value={f.query} onChange={set("query")} placeholder="Company, contact or email" />
          <div className="filter-field"><label htmlFor="rf-st" className={lab}>Status</label>
            <select id="rf-st" className={`${field} filter-control`} value={f.status} onChange={set("status")}><option value="">All statuses</option>{[...STATUSES].sort().map((s) => <option key={s}>{s}</option>)}</select></div>
          <DateRangeFilter id="rf-created-period" label="Created at" from={f.cFrom} to={f.cTo} onChange={range => setF(previous => ({ ...previous, cFrom: range.from, cTo: range.to }))} />
          <DateRangeFilter id="rf-modified-period" label="Last modified" from={f.mFrom} to={f.mTo} onChange={range => setF(previous => ({ ...previous, mFrom: range.from, mTo: range.to }))} />
        </fieldset>
        {(dateBad(f.cFrom, f.cTo) || dateBad(f.mFrom, f.mTo)) && <p role="alert" className="text-xs text-danger mt-2">The "from" date must be before the "to" date.</p>}
        <div className="flex items-center justify-between gap-3 mt-3">
          <ClearFiltersButton onClick={clearFilters} />
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => exportReferrals(rows)} disabled={remote.loading || !!remote.error || rows.length === 0} className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-3.5 h-3.5" />Download
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto mt-2">
        <table className="w-full" aria-busy={remote.loading}>
          <thead className="border-b border-gray-100"><tr>
            <ReferralSortHeader column="company" sort={sort} onSort={sortBy}>Company</ReferralSortHeader>
            <ReferralSortHeader column="contact" sort={sort} onSort={sortBy}>Contact</ReferralSortHeader>
            <ReferralSortHeader column="email" sort={sort} onSort={sortBy}>Email</ReferralSortHeader>
            <ReferralSortHeader column="status" sort={sort} onSort={sortBy}>Status</ReferralSortHeader>
            <ReferralSortHeader column="onboarded" sort={sort} onSort={sortBy}>Onboarded</ReferralSortHeader>
            <ReferralSortHeader column="created" sort={sort} onSort={sortBy}>Created</ReferralSortHeader>
            <ReferralSortHeader column="modified" sort={sort} onSort={sortBy}>Last modified</ReferralSortHeader>
            <th scope="col" className={referralHeader}>Actions</th>
          </tr></thead>
          <tbody>
            {pager.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className={`${td} font-medium text-gray-900`}>{r.company}</td>
                <td className={td}>{r.contact || "—"}</td>
                <td className={td}>{r.email || "—"}</td>
                <td className={td}><Badge s={r.status} /></td>
                <td className={td}>{r.status === "Onboarded" ? "Yes" : "No"}</td>
                <td className={td}>{prettyDateTime(referralDateValue(r, "created"))}</td><td className={td}>{prettyDateTime(referralDateValue(r, "modified"))}</td>
                <td className={td}><ActionButton label={`View referral ${r.company}`} tooltip="View referral details" onClick={() => setOpen(r)} className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-accent hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Eye className="h-4 w-4" /></ActionButton></td>
              </tr>
            ))}
            {remote.loading && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-500"><span role="status">Loading referrals…</span></td></tr>}
            {remote.error && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm"><p role="alert" className="text-danger">{remote.error}</p><button type="button" onClick={reload} className="mt-3 font-medium text-accent hover:underline">Try again</button></td></tr>}
            {!remote.loading && !remote.error && rows.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-gray-400">{referrals.length === 0 ? "No referrals yet." : "No referrals match those filters."}</td></tr>}
          </tbody>
        </table>
      </div>
      <TablePager pager={pager} noun="referrals" overall={referrals.length} />
      {open && <Detail r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ r, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current, previous = document.activeElement;
    element.showModal();
    return () => { element.close(); previous?.focus?.(); };
  }, []);
  const idx = stepIndex(r.status);
  return (
    <dialog ref={dialog} aria-label={r.company} onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 text-gray-900 shadow-xl backdrop:bg-navy/50">
        <div className="flex items-start justify-between mb-4">
          <div><h2 className="text-lg font-semibold text-gray-900">{r.company}</h2><div className="mt-1"><Badge s={r.status} /></div></div>
          <button type="button" aria-label="Close referral details" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        {[["Contact", r.contact], ["Email", r.email], ["Country", r.country], ["Expected monthly volume", r.volume || "—"], ["Currencies", r.cur?.join(", ") || "—"], ["Other currency", r.otherCur || "—"], ["Notes", r.notes || "—"], ["Created", prettyDateTime(referralDateValue(r, "created"))], ["Last modified", prettyDateTime(referralDateValue(r, "modified"))], ["Onboarded", r.status === "Onboarded" ? "Yes" : "No"]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{k}</span><span className="text-gray-900 text-right break-all">{v}</span></div>
        ))}
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
      <div className="mt-5 flex justify-end"><button type="button" onClick={onClose} className={ghost}>Close</button></div>
    </dialog>
  );
}

/* ----------------------------------------------------------- Add client */
function AddClient({ go, authenticated = false }) {
  const close = () => go("referrals");
  return <AddClientDialog onClose={close}><AddClientForm go={go} authenticated={authenticated} onClose={close} /></AddClientDialog>;
}

function AddClientForm({ go, authenticated = false, onClose }) {
  const empty = { company: "", contact: "", email: "", country: "", volume: "", cur: [], otherCur: "", notes: "" };
  const [v, setV] = useState(empty);
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);
  const dup = !authenticated && REFERRALS.some((r) => r.company.toLowerCase() === v.company.trim().toLowerCase()) && v.company.trim() !== "";
  const emailOk = /^\S+@\S+\.\S+$/.test(v.email);
  const otherOk = !v.cur.includes("Other") || v.otherCur.trim() !== "";
  const ok = v.company.trim() && !dup && v.contact.trim() && emailOk && v.country && v.volume && v.cur.length > 0 && otherOk;
  async function submit(e) {
    e.preventDefault();
    if (submitting.current) return;
    if (!ok) {
      setSaveError("Complete the required fields, select at least one currency, and check the company and email details.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const details = { ...v, company: v.company.trim(), contact: v.contact.trim(), email: v.email.trim(), otherCur: v.cur.includes("Other") ? v.otherCur.trim() : "", notes: v.notes.trim() };
      if (authenticated) {
        await createPartnerReferral(details);
      } else {
        REFERRALS.unshift({ ...details, id: nextId++, status: "Invited", created: iso(0), modified: iso(0) });
      }
      setDone(details.company);
      setV(empty);
    } catch (error) {
      setSaveError(error.message || "Unable to save the client. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  if (done) return (
    <div role="status" className="p-6 sm:p-8">
      <div className="flex items-center gap-2.5">
        <CheckCircle2 aria-hidden="true" className="w-6 h-6 shrink-0 text-success" />
        <p className="text-base font-semibold text-gray-900">{done} has been added</p>
      </div>
      <p className="text-sm text-gray-500 mt-1">{authenticated ? "The client has been saved. You can follow their progress under Referrals." : "Client added to this preview only. No invitation has been sent."}</p>
      <div className="flex flex-wrap justify-end gap-2 mt-4"><button type="button" className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setDone(null)}><UserPlus className="w-4 h-4" />Add another</button><button type="button" className={primary} onClick={() => go("referrals")}>View referrals</button></div>
    </div>
  );
  return <AddClientFormFields values={v} setValues={setV} duplicate={dup} saving={saving} saveError={saveError} onSubmit={submit} onClose={() => { if (!submitting.current) onClose(); }} />;
}

/* --------------------------------------------------------------- Brand kit */

// Module-level so uploads survive tab switches (reset on reload; nothing is sent anywhere).
let BRAND = { logo: null, headshot: null, description: "" };
function Uploader({ id, label, hint, kind, accept, maxMB }) {
  const [file, setFile] = useState(BRAND[kind]);
  const [err, setErr] = useState("");
  function pick(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!accept.includes(f.type)) { setErr(`Use a ${accept.map((t) => t.split("/")[1].replace("jpeg", "JPG").replace("svg+xml", "SVG").toUpperCase()).join(", ")} file.`); return; }
    if (f.size > maxMB * 1024 * 1024) { setErr(`That file is over ${maxMB} MB.`); return; }
    if (BRAND[kind]?.url) URL.revokeObjectURL(BRAND[kind].url);
    BRAND[kind] = { name: f.name, size: f.size, url: URL.createObjectURL(f) };
    setFile(BRAND[kind]); setErr("");
  }
  function remove() { if (file?.url) URL.revokeObjectURL(file.url); BRAND[kind] = null; setFile(null); }
  return (
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-accent">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
      {file && (
        <div className="flex items-center gap-3 mt-3 p-2 rounded-md bg-gray-50">
          <img src={file.url} alt={`${label} preview`} className={`w-12 h-12 object-contain bg-white border border-gray-200 ${kind === "headshot" ? "rounded-full object-cover" : "rounded-md"}`} />
          <div className="min-w-0 flex-1"><p className="text-sm text-gray-900 truncate">{file.name}</p><p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p></div>
          <button type="button" onClick={remove} aria-label={`Remove ${label}`} className="p-2 rounded-md text-gray-500 hover:bg-gray-100"><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
      <div className="mt-3">
        <input id={id} type="file" accept={accept.join(",")} onChange={pick} className="sr-only" />
        <label htmlFor={id} className={`${ghost} cursor-pointer focus-within:ring-2`}><Upload className="w-4 h-4" />{file ? "Replace" : "Upload"}</label>
      </div>
      {err && <p role="alert" className="text-xs text-danger mt-2">{err}</p>}
    </div>
  );
}

const ASSETS = [
  { name: "PulseFX logo, full colour (PNG)", file: "pulsefx-logo-colour.png" },
  { name: "PulseFX logo, white text for dark backgrounds (PNG)", file: "pulsefx-logo-white.png" },
  { name: "PulseFX logo mark on navy circle (SVG)", file: "pulsefx-logo-navy-circle.svg" },
];
function BrandKit() {
  const [desc, setDesc] = useState(BRAND.description);
  const [saved, setSaved] = useState(false);
  const max = 500;
  function save(e) { e.preventDefault(); BRAND.description = desc.trim(); setDesc(BRAND.description); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <p className="text-sm font-medium text-accent">Your details for referral pages</p>
        <p className="text-xs text-gray-500 mt-0.5">Add your own logo, head shot and description. Clients may see these when they sign up through your link.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Uploader id="bk-logo" kind="logo" label="Referral logo" hint="PNG, JPG or SVG, up to 2 MB." accept={["image/png", "image/jpeg", "image/svg+xml"]} maxMB={2} />
        <Uploader id="bk-head" kind="headshot" label="Head shot" hint="PNG or JPG, up to 5 MB." accept={["image/png", "image/jpeg"]} maxMB={5} />
      </div>
      <form onSubmit={save} className={`${card} p-5`}>
        <label htmlFor="bk-desc" className="text-sm font-medium text-accent">Description</label>
        <p className="text-xs text-gray-500 mt-0.5">A short introduction to your firm.</p>
        <textarea id="bk-desc" rows={4} maxLength={max} className={`${field} mt-3`} value={desc} onChange={(e) => { setDesc(e.target.value); setSaved(false); }} />
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3"><button type="submit" className={primary}>Save description</button>{saved && <span role="status" className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span>}</div>
          <span className="text-xs text-gray-400">{desc.length}/{max}</span>
        </div>
      </form>

      <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-accent">PulseFX brand assets</p>
        <p className="text-xs text-gray-500 mt-0.5">Use these when you talk about PulseFX to your clients.</p>
        <ul className="mt-3 divide-y divide-gray-100">
          {ASSETS.map((a) => (
            <li key={a.file} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-gray-900 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{a.name}</span></span>
              <a href={`${import.meta.env.BASE_URL}Brand/${a.file}`} download={a.file} aria-label={`Download ${a.name}`} className={ghost}><Download className="w-4 h-4" />Download</a>
            </li>
          ))}
        </ul>
        
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Guide */
const GUIDE = [
  ["How does referring a client work?", "Share your referral link or add the client yourself. The client opens a PulseFX account, submits their documents and goes through review. You can follow every step under Referrals."],
  ["What does each status mean?", "Invited: the link has been sent. Account created: the client has registered. Documents submitted: we have their documents. Under review: our team is checking them. Onboarded: the account is open and ready to use. Rejected: we couldn't approve the application."],
  ["What does a client need to onboard?", "Business details, ownership information, and identification documents for the directors and owners. The exact list is shown to the client when they sign up."],
  ["How long does onboarding take?", "Timing depends on the client and the documents provided. Your PulseFX partner manager will confirm typical timelines."],
  ["How and when am I paid?", "Payouts go to the account under Banking details. Your PulseFX partner manager will confirm the payout terms."],
];
const ONE_PAGERS = [
  ["PulseFX company and core offerings", "pulsefx-company-overview.pdf"],
  ["PulseFX hedging solutions", "hedging-solutions.pdf"],
];
function Guide() {
  const [open, setOpen] = useState(0);
  const base = import.meta.env.BASE_URL;
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
    <div className={`${card} divide-y divide-gray-100`}>
      {GUIDE.map(([q, a], i) => (
        <div key={q}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-3 text-left px-5 py-4 text-sm font-medium text-accent hover:bg-gray-50">
            {q}<ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <p className="px-5 pb-4 text-sm text-gray-600">{a}</p>}
        </div>
      ))}
      {/* <p className="px-5 py-3 text-xs text-gray-400">Demo only: wording is a placeholder until PulseFX confirms the real partner terms.</p> */}
    </div>
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-accent">One-pagers</p>
      <p className="text-xs text-gray-500 mt-0.5">Download and share these with your clients.</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {ONE_PAGERS.map(([n, f]) => (
          <li key={f} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-gray-900 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{n}</span><span className="text-xs text-gray-400 shrink-0">PDF</span></span>
            <a href={`${base}onepagers/${f}`} download={f} aria-label={`Download ${n}`} className={ghost}><Download className="w-4 h-4" />Download</a>
          </li>
        ))}
      </ul>
      
    </div>
    </div>
  );
}

/* ------------------------------------------------------------- Contact */
function Contact({ authenticated, go }) {
  const [m, setM] = useState({ subject: "", body: "" });
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const submitting = useRef(false);
  const ok = m.subject.trim() && m.body.trim() && m.subject.length <= 200 && m.body.length <= 10000;
  async function submit(event) {
    event.preventDefault();
    if (!ok || submitting.current || uncertain) return;
    if (!authenticated) { setSent({ supportId: "DEMO", preview: true }); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try { setSent(await createSupportRequest({ subject: m.subject.trim(), message: m.body.trim() })); }
    catch (failure) { setError(failure.message); setUncertain(failure.uncertain === true); }
    finally { submitting.current = false; setBusy(false); }
  }
  const close = () => { if (!submitting.current) go("home"); };
  const supportField = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
  const supportLabel = "mb-1.5 block text-sm font-medium text-gray-700";
  return <PortalDialog title="Help & support" subtitle="Get in touch with the partnerships team." icon={<Headset className="h-5 w-5" />} maxWidth="max-w-2xl" onClose={close}>
    {sent ? <div role="status" className="p-6 sm:p-8">
      <div className="flex items-center gap-2.5 pr-5"><CheckCircle2 aria-hidden="true" className="h-6 w-6 shrink-0 text-success" /><h3 className="text-base font-semibold text-gray-900">{sent.preview ? "Support request preview" : "Support request received"}</h3></div>
      <p className="mt-2 text-sm text-gray-500">{sent.preview ? "Preview only: no message was sent." : "Your message has been sent to the PulseFX partnerships team."}</p>
      {!sent.preview && <p className="mt-2 break-words text-sm text-gray-700">Your reference: <span className="font-medium">{sent.supportId}</span></p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className={ghost} onClick={() => { setSent(null); setM({ subject: "", body: "" }); setError(""); setUncertain(false); }}>Send another</button><button type="button" className={primary} onClick={close}>Done</button></div>
    </div> : <form onSubmit={submit} aria-busy={busy}>
      <fieldset disabled={busy || uncertain} className="space-y-6 px-6 py-6 sm:px-8">
        <section aria-labelledby="support-message-heading">
          <h3 id="support-message-heading" className="mb-1 flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-accent" />How can we help?</h3>
          <p className="mb-5 text-sm text-gray-500">Questions about a client, payouts or the programme? Send your partner manager a message.</p>
          <div><label htmlFor="ct-s" className={supportLabel}>Subject</label><input autoFocus id="ct-s" required maxLength={200} placeholder="What would you like help with?" className={supportField} value={m.subject} onChange={event => setM({ ...m, subject: event.target.value })} /></div>
          <div className="mt-4"><label htmlFor="ct-b" className={supportLabel}>Message</label><textarea id="ct-b" required maxLength={10000} rows={5} placeholder="Share the details so we can help you." className={`${supportField} resize-y`} value={m.body} onChange={event => setM({ ...m, body: event.target.value })} /></div>
        </section>
        <section aria-labelledby="support-direct-heading" className="border-t border-gray-100 pt-5">
          <h3 id="support-direct-heading" className="text-sm font-semibold text-gray-900">Prefer to reach us directly?</h3>
          <div className="mt-3 flex flex-wrap gap-2"><a href={`tel:${PHONE.tel}`} className={ghost}><Phone className="h-4 w-4 text-accent" />Call {PHONE.display}</a><a href={`sms:${PHONE.tel}`} className={ghost}><MessageSquare className="h-4 w-4 text-accent" />Text {PHONE.display}</a><a href={`mailto:${EMAIL}`} className={`${ghost} break-all`}><Mail className="h-4 w-4 shrink-0 text-accent" />{EMAIL}</a></div>
        </section>
      </fieldset>
      <footer className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4 sm:px-8">
        {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><button type="button" disabled={busy} onClick={close} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={!ok || busy || uncertain} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-navy hover:bg-[#009a7d] disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Sending…" : "Send message"}</button></div>
      </footer>
    </form>}
  </PortalDialog>;
}

/* --------------------------------------------------------------- Shell */
const PARTNER_NAV_ITEMS = NAV
  .filter(([key]) => key !== "contact")
  .map(([key, label, icon]) => ({
    key,
    label: key === "home" ? "Dashboard" : label,
    icon,
  }));

const ADMIN_NAV_ITEMS = [{ key: "admin", label: "User management", icon: Users }, { key: "banking-approvals", label: "Banking approvals", icon: Landmark }, { key: "admin-payouts", label: "Payouts", icon: DollarSign }];

export default function PartnerPortal({ onExit, user, isAdmin = false, signingOut = false, signOutError = "", basePath = "/demo" }) {
  const canAdmin = !!user && isAdmin;
  // The current page comes from the address (for example /partner/referrals), so back, forward, refresh and bookmarks work.
  const { page } = useParams();
  const navigate = useNavigate();
  const defaultTab = canAdmin ? "admin" : "home";
  const allowedTabs = canAdmin ? [...ADMIN_NAV_ITEMS.map((item) => item.key), "contact"] : NAV.map((item) => item[0]);
  const tab = page && allowedTabs.includes(page) ? page : defaultTab;
  const setTab = (key) => navigate(key === defaultTab ? basePath : `${basePath}/${key}`);
  useEffect(() => {
    // An unknown or not-permitted page goes back to the start page.
    if (page && !allowedTabs.includes(page)) navigate(basePath, { replace: true });
  }, [page, canAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = tab === "admin" ? "User management" : tab === "banking-approvals" ? "Banking approvals" : tab === "admin-payouts" ? "Payouts" : tab === "home" ? "Dashboard" : NAV.find((n) => n[0] === tab)?.[1];
  useEffect(() => {
    document.title = `${title || "Partner portal"} · PulseFX`;
    window.scrollTo(0, 0);
  }, [title]);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const userId = user?.id;
  useEffect(() => {
    if (!userId || canAdmin) return;
    let active = true;
    const controller = new AbortController();
    loadPartnerProfile(controller.signal).then((profile) => {
      if (active) setPartnerProfile({ ...profile, userId });
    }).catch(() => { /* A profile lookup cannot grant or revoke partner access. */ });
    return () => { active = false; controller.abort(); };
  }, [userId, canAdmin]);
  const username = canAdmin
    ? user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Administrator"
    : userId ? partnerProfile?.userId === userId ? partnerProfile.name : "Partner" : PARTNER.name;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        active={tab}
        onNavigate={setTab}
        items={canAdmin ? ADMIN_NAV_ITEMS : PARTNER_NAV_ITEMS}
        helpKey={canAdmin ? null : "contact"}
        portalLabel={canAdmin ? "Administration" : "Partner portal"}
        account={{
          name: username,
          email: user?.email || "partner@pulsefx.example",
          onLogout: onExit,
          showSettings: false,
          showAdmin: false,
          disabled: signingOut,
        }}
      />
      <main className={`flex-1 min-w-0 p-4 pt-[72px] md:p-6 ${tab === "add" || tab === "contact" ? "bg-white" : "bg-gray-50"}`}>
        {tab !== "add" && tab !== "contact" && <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-xl font-semibold text-gray-900">{title}</h1>{PAGE_SUBTITLES[tab] && <p className="mt-0.5 text-sm text-gray-500">{PAGE_SUBTITLES[tab]}</p>}</div>
        </div>}
        {signOutError && <p role="alert" className="text-sm text-danger mb-4">{signOutError}</p>}
        {tab === "admin" && canAdmin && <PartnerAdmin />}
        {tab === "banking-approvals" && canAdmin && <BankingApprovals />}
        {tab === "admin-payouts" && canAdmin && <AdminPayouts />}
        {tab === "home" && <PartnerHome go={setTab} />}
        {tab === "referrals" && <Referrals key={user?.id || "demo"} authenticated={!!user} go={setTab} />}
        {tab === "add" && <AddClient go={setTab} authenticated={!!user} />}
        {tab === "banking" && <BankingDetails authenticated={!!user} />}
        {tab === "payouts" && <PayoutHistory authenticated={!!user} showDescription={false} />}
        {tab === "brand" && <BrandKit />}
        {tab === "guide" && <Guide />}
        {tab === "contact" && !canAdmin && <Contact key={user?.id || "demo"} authenticated={!!user} go={setTab} />}
        {tab !== "admin" && tab !== "add" && tab !== "contact" && !user && <p className="text-xs text-gray-400 mt-4">Portal preview: all names and figures are sample data.</p>}
      </main>
    </div>
  );
}