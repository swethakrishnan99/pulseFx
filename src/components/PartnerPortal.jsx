import ReferralSourceBadge from "./ReferralSourceBadge";
import { dialogDanger } from "../lib/dialogStyles";
import { referralEmailConflict } from "../../supabase/functions/_shared/referral-duplicates.mjs";
import { DEMO_REFERRALS, DEMO_BRAND_KIT, DEMO_BRAND_ASSETS, DEMO_ONE_PAGERS } from "../lib/partnerDemo";
import { REFERRAL_STATUSES as STATUSES, REFERRAL_STATUS_STYLE as STATUS_STYLE } from "../lib/referralStatuses.mjs";
import PartnerReferralLink from "./PartnerReferralLink";
import PartnerSupport from "./PartnerSupport";
import useViewFocus from "../lib/useViewFocus";
import DocumentPreview from "./DocumentPreview";
import Documents from "./Documents";
import { loadOnePagers } from "../lib/onePagers";
import { canPreviewFile, fileFormat } from "../lib/fileFormat.mjs";
import { loadBrandAssets } from "../lib/brandAssets";
import { brandKitRequest, encodeBrandFile } from "../lib/brandKit";
import { airtableFieldValue, formatAirtableDateTime, inAirtableDateRange } from "../lib/airtableDates.mjs";
import SearchFilter from "./SearchFilter";
import PortalDialog from "./PortalDialog";
import Detail from "./ReferralDetail";
import AdminReferrals from "./AdminReferrals";
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
import { AlertTriangle, Clock3, XCircle, Home, Users, DollarSign, Landmark, BookOpen, Headset, Copy, Check, Eye, Download, UserPlus, ChevronDown, CheckCircle2, Palette, ArrowRight, Upload, FileText, RefreshCw } from "lucide-react";
import Sidebar from "./Sidebar";
import PartnerAdmin from "./PartnerAdmin";
import BankingDetails from "./BankingDetails";
import PayoutHistory from "./PayoutHistory";
import BankingApprovals from "./BankingApprovals";
import AdminPayouts from "./AdminPayouts";
import { createPartnerReferral, loadPartnerReferrals, loadPartnerProfile } from "../lib/referrals";

// Partner portal demo for referral partners (for example an accounting firm that refers its clients to PulseFX).
// The public demo is reached at #partner-demo. Authenticated referrals use Airtable.

const PARTNER = { name: "ABC Accounting", slug: "abc-accounting" };
const LINK = `https://partners.pulsefx.example/${PARTNER.slug}/signup`;

const DAY = 86400000;
const iso = (off) => { const d = new Date(Date.now() + off * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const prettyDateTime = formatAirtableDateTime;
const referralDateValue = (record, field) => airtableFieldValue(record, field === "created" ? "createdAt" : "modifiedAt", field);




// Module-level so a new client survives moving between tabs (resets on reload).
const REFERRALS = [...DEMO_REFERRALS];
let nextId = 19;

const card = "bg-white rounded-xl border border-gray-200/70";
const field = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const lab = "block text-xs text-gray-500 mb-1";
const primary = "text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";

const ghost = "inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50";

function Badge({ s }) {
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[s] || STATUS_STYLE.Invited}`}>{s}</span>;
}

const NAV = [["home", "Home", Home], ["referrals", "Referrals", Users], ["add", "Add a client", UserPlus], ["banking", "Banking details", Landmark], ["payouts", "Payout history", DollarSign], ["brand", "Brand kit", Palette], ["guide", "Partner guide", BookOpen], ["contact", "Contact", Headset]];
const PAGE_SUBTITLES = {
  admin: "Manage portal access for partners and PulseFX administrators.",
  "banking-approvals": "Review banking updates and approve or reject partner submissions.",
  "admin-payouts": "Manage partner payouts and review payment history.",
  "admin-referrals": "Follow up on referred clients and update their onboarding status.",
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
function PartnerHome({ go, authenticated }) {
  const [copied, setCopied] = useState(false);
  const [activity, setActivity] = useState({ loading: authenticated, referrals: authenticated ? [] : REFERRALS, error: "" });
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    const controller = new AbortController();
    loadPartnerReferrals({ signal: controller.signal }).then((referrals) => {
      if (active) setActivity({ loading: false, referrals, error: "" });
    }).catch((error) => {
      if (active) setActivity({ loading: false, referrals: [], error: error.message });
    });
    return () => { active = false; controller.abort(); };
  }, [authenticated, reload]);
  const total = activity.referrals.length;
  const isOnboarded = (referral) => referral.status === "Onboarded";
  const onboarded = activity.referrals.filter(isOnboarded).length;
  const rejected = activity.referrals.filter((referral) => referral.status === "Rejected").length;
  const inProgress = activity.referrals.filter((r) => r.status !== "Rejected" && !isOnboarded(r)).length;
  function copy() { navigator.clipboard?.writeText(LINK); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <div className="flex flex-col gap-4">
      {authenticated && <PartnerReferralLink />}
      {!authenticated && <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-accent">Referral link</p>
        <p className="text-xs text-gray-500 mt-0.5">Share this link with your clients. Anyone who signs up with it appears under Referrals.</p>
        <div className="flex items-center gap-2 mt-3">
          <input readOnly aria-label="Referral link" value={LINK} className={`${field} font-mono text-xs bg-gray-50`} />
          <button type="button" onClick={copy} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50">
            {copied ? <Check className="w-4 h-4 text-accent" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>}

      {activity.error && <div role="alert" className={`${card} p-5 text-sm text-danger`}>{activity.error}<button type="button" className={`${ghost} ml-3`} onClick={() => { setActivity({ loading: true, referrals: [], error: "" }); setReload((value) => value + 1); }}>Try again</button></div>}
      {activity.loading && <p role="status" className="text-sm text-gray-500">Loading referral activity…</p>}
      <div role="group" aria-label="Referral summary" aria-busy={activity.loading} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Referred", total, Users, "bg-blue-100 text-blue-600"],
          ["Onboarded", onboarded, CheckCircle2, STATUS_STYLE.Onboarded],
          ["In progress", inProgress, Clock3, STATUS_STYLE["Under review"]],
          ["Rejected", rejected, XCircle, STATUS_STYLE.Rejected],
        ].map(([label, value, Icon, style]) => (
          <div key={label} className={`${card} flex min-w-0 items-center justify-between gap-3 p-5`}>
            <div className="min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold text-gray-900">{activity.loading || activity.error ? "—" : value}</p></div>
            <span aria-hidden="true" className={`shrink-0 rounded-xl p-3 ${style}`}><Icon className="h-5 w-5" /></span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          ["Referrals", "Track every business you've referred and where they are in onboarding.", "Open referrals", "referrals"],
          ["Add a new client", "Register a client's details and track their progress under Referrals.", "Add a client", "add"],
          ["Banking details", "Where we send partner payouts. Keep these up to date.", "View details", "banking"],
          ["Payout history", "Track your partner payouts and review payment details.", "View payouts", "payouts"],
          ["Brand kit", "Manage your referral branding and access PulseFX assets.", "Open brand kit", "brand"],
          ["Partner guide", "Answers to common questions about referring and onboarding clients.", "Read the guide", "guide"],
          ["Contact", "Get in touch with the PulseFX partnerships team.", "Contact us", "contact"],
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
    ["Company", "Contact", "Email", "Country", "Expected monthly volume", "Currencies", "Other currency", "Notes", "Source", "Status", "Onboarded", "Created at", "Last modified at"],
    ...rows.map((r) => [r.company, r.contact, r.email, r.country, r.volume || "", (r.cur || []).join(", "), r.otherCur || "", r.notes || "", r.source || "—", r.status, r.status === "Onboarded" ? "Yes" : "No", referralDateValue(r, "created"), referralDateValue(r, "modified")]),
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
          <DateRangeFilter id="rf-modified-period" label="Last modified at" from={f.mFrom} to={f.mTo} onChange={range => setF(previous => ({ ...previous, mFrom: range.from, mTo: range.to }))} />
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
            <ReferralSortHeader column="source" sort={sort} onSort={sortBy}>Source</ReferralSortHeader>
            <ReferralSortHeader column="status" sort={sort} onSort={sortBy}>Status</ReferralSortHeader>
            <ReferralSortHeader column="onboarded" sort={sort} onSort={sortBy}>Onboarded</ReferralSortHeader>
            <ReferralSortHeader column="created" sort={sort} onSort={sortBy}>Created at</ReferralSortHeader>
            <ReferralSortHeader column="modified" sort={sort} onSort={sortBy}>Last modified at</ReferralSortHeader>
            <th scope="col" className={referralHeader}>Actions</th>
          </tr></thead>
          <tbody>
            {pager.rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className={`${td} font-medium text-gray-900`}>{r.company}</td>
                <td className={td}>{r.contact || "—"}</td>
                <td className={td}>{r.email || "—"}</td>
                <td className={td}><ReferralSourceBadge source={r.source} /></td>
                <td className={td}><Badge s={r.status} /></td>
                <td className={td}>{r.status === "Onboarded" ? "Yes" : "No"}</td>
                <td className={td}>{prettyDateTime(referralDateValue(r, "created"))}</td><td className={td}>{prettyDateTime(referralDateValue(r, "modified"))}</td>
                <td className={td}><ActionButton label={`View referral ${r.company}`} tooltip="View referral details" onClick={() => setOpen(r)} className="inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-gray-500 hover:text-accent hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"><Eye className="h-4 w-4" /></ActionButton></td>
              </tr>
            ))}
            {remote.loading && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-500"><span role="status">Loading referrals…</span></td></tr>}
            {remote.error && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm"><p role="alert" className="text-danger">{remote.error}</p><button type="button" onClick={reload} className="mt-3 font-medium text-accent hover:underline">Try again</button></td></tr>}
            {!remote.loading && !remote.error && rows.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-gray-400">{referrals.length === 0 ? "No referrals yet." : "No referrals match those filters."}</td></tr>}
          </tbody>
        </table>
      </div>
      <TablePager pager={pager} noun="referrals" overall={referrals.length} />
      {open && <Detail authenticated={authenticated} r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

/* ----------------------------------------------------------- Add client */
function AddClient({ go, authenticated = false }) {
  const close = () => go("referrals");
  return <AddClientDialog onClose={close}><AddClientForm go={go} authenticated={authenticated} onClose={close} /></AddClientDialog>;
}

function AddClientForm({ go, authenticated = false, onClose }) {
  const empty = { company: "", contact: "", email: "", country: "", volume: "", cur: [], otherCur: "", notes: "" };
  const [v, setV] = useState(authenticated ? empty : { company: "Westbridge Consulting Inc.", contact: "Alex Morgan", email: "alex@westbridge.example", country: "Canada", volume: "CAD 50,000 to 250,000", cur: ["CAD", "USD", "EUR", "Other"], otherCur: "CHF", notes: "Consulting firm receiving international client payments and paying European software suppliers. Interested in scheduled transfers and exchange rate protection." });
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);
  const [rejection, setRejection] = useState(null);
  const [duplicate, setDuplicate] = useState(false);
  const emailOk = /^\S+@\S+\.\S+$/.test(v.email);
  const otherOk = !v.cur.includes("Other") || v.otherCur.trim() !== "";
  const ok = v.company.trim() && v.contact.trim() && emailOk && v.country && v.volume && v.cur.length > 0 && otherOk;
  async function submit(e, confirmedRejection = null) {
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
        await createPartnerReferral({ ...details, ...(confirmedRejection ? { confirmedRejection } : {}) });
      } else {
        const conflict = referralEmailConflict(REFERRALS, details.email);
        if (conflict.blocked) {
          setRejection(null);
          setDuplicate(true);
          return;
        }
        if (conflict.rejection && (confirmedRejection?.id !== conflict.rejection.id || confirmedRejection?.statusChangedAt !== conflict.rejection.statusChangedAt)) {
          setRejection(conflict.rejection);
          return;
        }
        REFERRALS.unshift({ ...details, id: nextId++, status: "Invited", created: iso(0), modified: iso(0) });
      }
      setRejection(null);
      setDone(details.company);
      setV(empty);
    } catch (error) {
      if (error.duplicate) { setRejection(null); setDuplicate(true); }
      else if (error.rejection) setRejection(error.rejection);
      else setSaveError(error.message || "Unable to save the client. Please try again.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  if (rejection || duplicate) return (
    <div className="p-6 sm:p-8" aria-busy={saving}>
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-amber-950">{duplicate ? "Client already referred" : "Previously rejected referral"}</h3>
            {duplicate ? <>
              <p className="mt-2 text-sm text-amber-900">You have already referred a client with this email address.</p>
              <p className="mt-2 break-all text-sm font-semibold text-amber-950">{v.email.trim()}</p>
            </> : <>
              <p className="mt-2 text-sm text-amber-900">A previous referral for <span className="font-semibold break-all">{v.email.trim()}</span> was rejected.</p>
              <p className="mt-2 text-sm text-amber-900">{rejection.statusChangedAt ? <>The most recent rejection was on <span className="font-semibold">{prettyDateTime(rejection.statusChangedAt)}</span>.</> : "The date and time of the rejection are unavailable."}</p>
              <p className="mt-4 border-t border-amber-200 pt-3 text-sm font-medium text-amber-950">Would you like to add this client again?</p>
            </>}
          </div>
        </div>
      </div>
      {saveError && <p role="alert" className="mt-3 text-sm text-danger">{saveError}</p>}
      <div className="mt-5 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={() => { setRejection(null); setDuplicate(false); setSaveError(""); }} className={ghost}>Back</button>
        {duplicate ? <button type="button" disabled={saving} onClick={onClose} className={dialogDanger}>Cancel</button> : <button type="button" disabled={saving} onClick={event => submit(event, rejection)} className={primary}>{saving ? "Adding…" : "Continue and add client"}</button>}
      </div>
    </div>
  );
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
  return <AddClientFormFields values={v} setValues={setV} canSubmit={!!ok} saving={saving} saveError={saveError} onSubmit={submit} onClose={() => { if (!submitting.current) onClose(); }} />;
}

/* --------------------------------------------------------------- Brand kit */

function Uploader({ id, label, hint, kind, accept, maxMB, file, disabled, onUpload }) {
  const [err, setErr] = useState("");
  const [viewing, setViewing] = useState(false);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!pending) return;
    return () => URL.revokeObjectURL(pending.url);
  }, [pending]);
  async function upload(f) {
    setBusy(true); setErr("");
    try { await onUpload(kind, f); setPending(null); }
    catch (error) { setErr(error.message); setPending(null); }
    finally { setBusy(false); }
  }
  function pick(e) {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    if (!accept.includes(f.type)) { setErr("Use a supported image type."); return; }
    if (!f.size || f.size > maxMB * 1024 * 1024) { setErr(`Use a non-empty file up to ${maxMB} MB.`); return; }
    setErr("");
    if (file) setPending({ file: f, url: URL.createObjectURL(f) }); else upload(f);
  }
  async function download() {
    try {
      setErr("");
      const response = await fetch(file.url);
      if (!response.ok) throw new Error("Unable to download. Reload the Brand kit and try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setErr(error.message); }
  }
  const actionClass = "inline-flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-gray-200 px-1.5 py-2 text-xs font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
  return <div className={`${card} min-w-0 p-5`}>
    <p className="text-sm font-medium text-accent">{label}</p><p className="text-xs text-gray-500 mt-0.5">{hint}</p>
    {file && <div className="flex items-center gap-3 mt-3 p-2 rounded-md bg-gray-50">
      <img src={file.url} alt={`${label} preview`} className="w-12 h-12 shrink-0 object-contain rounded-md bg-white border border-gray-200" />
      <div className="min-w-0"><p className="text-sm truncate">{file.name}</p><p className="text-xs text-gray-400">{fileFormat(file.name)}</p>{Number.isFinite(file.size) && <p className="text-xs text-gray-500">{Math.round(file.size / 1024)} KB</p>}</div>
    </div>}
    <input id={id} type="file" disabled={disabled || busy} accept={accept.join(",")} onChange={pick} className="sr-only" />
    <div className={`mt-3 ${file ? "grid grid-cols-[0.8fr_1.2fr_1fr] gap-1.5" : "flex"}`}>
      {file && <><button type="button" onClick={() => setViewing(true)} className={actionClass}><Eye className="w-3.5 h-3.5 shrink-0" />View</button><button type="button" onClick={download} className={actionClass}><Download className="w-3.5 h-3.5 shrink-0" />Download</button></>}
      <button type="button" disabled={disabled || busy} onClick={() => document.getElementById(id).click()} className={actionClass}><Upload className="w-3.5 h-3.5 shrink-0" />{busy ? "Uploading…" : file ? "Replace" : "Upload"}</button>
    </div>
    {err && <p role="alert" className="text-xs text-danger mt-2">{err}</p>}
    {viewing && file && <PortalDialog title={`${label} preview`} subtitle={file.name} onClose={() => setViewing(false)} icon={<Eye className="h-5 w-5" />} maxWidth="max-w-2xl">
      <div className="p-6"><div className="flex h-56 sm:h-72 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-6"><img src={file.url} alt={label} className="h-full w-full object-contain" /></div>
        <p className="mt-3 break-all text-xs text-gray-500">{file.name}</p>
        {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
        <div className="mt-4 flex justify-end"><button type="button" onClick={download} className={`inline-flex items-center gap-1.5 ${primary}`}><Download className="h-4 w-4" />Download</button></div>
      </div>
    </PortalDialog>}
    {pending && <PortalDialog title={`Replace ${label.toLowerCase()}?`} onClose={() => { if (!busy) setPending(null); }} icon={<RefreshCw className="w-5 h-5" />} maxWidth="max-w-lg">
      <div className="p-6" aria-busy={busy}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 mb-5">
          <figure className="min-w-0"><figcaption className="text-xs font-medium text-gray-500 mb-2">Current image</figcaption><div className="flex h-28 sm:h-36 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-2"><img src={file.url} alt={`Current ${label.toLowerCase()}`} className="h-full w-full object-contain" /></div><p title={file.name} className="mt-2 truncate text-xs text-gray-600">{file.name}</p></figure>
          <ArrowRight aria-hidden="true" className="h-5 w-5 text-accent" />
          <figure className="min-w-0"><figcaption className="text-xs font-medium text-accent mb-2">New image</figcaption><div className="flex h-28 sm:h-36 items-center justify-center rounded-lg border border-accent/30 bg-accent-100 p-2"><img src={pending.url} alt={`New ${label.toLowerCase()}`} className="h-full w-full object-contain" /></div><p title={pending.file.name} className="mt-2 truncate text-xs text-gray-600">{pending.file.name}</p></figure>
        </div>
        <p className="text-sm text-gray-600">Only the latest file will be kept. The previous file will be removed after the new upload succeeds.</p>
        <div className="flex justify-end gap-3 mt-5"><button type="button" disabled={busy} onClick={() => setPending(null)} className={ghost}>Cancel</button><button type="button" disabled={busy} onClick={() => upload(pending.file)} className={primary}>{busy ? "Uploading…" : "Replace file"}</button></div>
      </div>
    </PortalDialog>}
  </div>;
}

function BrandAssets({ authenticated }) {
  const [assets, setAssets] = useState(authenticated ? [] : DEMO_BRAND_ASSETS);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(authenticated);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    loadBrandAssets().then(value => { if (active) { setAssets(value); setError(""); } }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, revision]);
  async function openPreview(asset) {
    if (!canPreviewFile(asset.file?.name)) return;
    try {
      const current = (authenticated ? await loadBrandAssets() : DEMO_BRAND_ASSETS).find(item => item.id === asset.id);
      if (!current) throw new Error("This asset is no longer available.");
      if (!canPreviewFile(current.file?.name)) throw new Error("Preview is available only for PDF and images.");
      setPreview(current);
    } catch (error) { setError(error.message); }
  }
  async function download(asset) {
    try {
      // Refresh the attachment URL before downloading because Airtable links expire.
      const current = (authenticated ? await loadBrandAssets() : DEMO_BRAND_ASSETS).find(item => item.id === asset.id);
      if (!current) throw new Error("This asset is no longer available.");
      const response = await fetch(current.file.url);
      if (!response.ok) throw new Error("Unable to download this asset. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = current.file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
  }
  return <div className={`${card} p-5`}>
    <p className="text-sm font-medium text-accent">PulseFX brand assets</p>
    <p className="text-xs text-gray-500 mt-0.5">Use these when you talk about PulseFX to your clients.</p>
    {loading ? <p className="mt-3 text-sm text-gray-500">Loading assets…</p> : <>
      {error && <div role="alert" className="mt-3 text-sm text-danger">{error}<button type="button" className={ghost} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Try again</button></div>}
      {!error && !assets.length && <p className="mt-3 text-sm text-gray-500">No brand assets are available yet.</p>}
      <ul className="mt-3 divide-y divide-gray-100">{assets.map(asset => <li key={asset.id} className="flex flex-wrap items-center gap-3 py-3">
        <button type="button" onClick={() => openPreview(asset)} disabled={!canPreviewFile(asset.file.name)} title={canPreviewFile(asset.file.name) ? "View document" : "Preview is available only for PDF and images"} aria-label={`Preview ${asset.name}`} className={`flex h-16 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 p-2 enabled:hover:ring-2 enabled:hover:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 ${/white/i.test(asset.file.name) ? "bg-navy" : "bg-gray-50"}`}>{["PNG", "JPG", "JPEG", "SVG", "WEBP", "GIF", "AVIF"].includes(fileFormat(asset.file.name)) ? <img src={asset.file.url} alt={asset.name} loading="lazy" className="h-full w-full object-contain" /> : <FileText className="h-6 w-6 text-gray-400" />}</button>
        <span className="min-w-0 flex-1 flex items-center gap-2 text-sm text-gray-900"><span className="truncate">{asset.name}</span><span className="text-xs text-gray-400 shrink-0">{fileFormat(asset.file.name)}</span></span>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => openPreview(asset)} disabled={!canPreviewFile(asset.file.name)} title={canPreviewFile(asset.file.name) ? "View document" : "Preview is available only for PDF and images"} aria-label={`View ${asset.name}`} className={`${ghost} disabled:cursor-not-allowed disabled:opacity-50`}><Eye className="w-4 h-4" />View</button><button type="button" onClick={() => download(asset)} aria-label={`Download ${asset.name}`} className={ghost}><Download className="w-4 h-4" />Download</button></div>
      </li>)}</ul>
    </>}
    {preview && <PortalDialog title="Brand asset preview" subtitle={preview.name} onClose={() => setPreview(null)} icon={<Eye className="h-5 w-5" />} maxWidth="max-w-2xl">
      <div className="p-6"><DocumentPreview file={preview.file} name={preview.name} />
        <p className="mt-3 break-all text-xs text-gray-500">{preview.file.name}</p>
        <div className="mt-4 flex justify-end"><button type="button" onClick={() => download(preview)} className={`inline-flex items-center gap-1.5 ${primary}`}><Download className="h-4 w-4" />Download</button></div>
      </div>
    </PortalDialog>}
  </div>;
}
function BrandKit({ authenticated }) {
  const [kit, setKit] = useState(authenticated ? { logo: null, headshot: null, description: "" } : DEMO_BRAND_KIT);
  const [desc, setDesc] = useState(authenticated ? "" : DEMO_BRAND_KIT.description);
  const [loading, setLoading] = useState(authenticated);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    brandKitRequest({ action: "load" }).then(value => { if (active) { setKit(value); setDesc(value.description); setError(""); } }).catch(error => { if (active) setError(error.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, revision]);
  const max = 500;
  async function upload(kind, file) {
    setBusy(true);
    try {
      const value = await brandKitRequest({ action: "upload", kind, filename: file.name, contentType: file.type, file: await encodeBrandFile(file) });
      setKit(current => ({ ...current, [kind]: value[kind] }));
    } finally { setBusy(false); }
  }
  async function save(e) {
    e.preventDefault(); setBusy(true); setError(""); setSaved(false);
    try { const value = await brandKitRequest({ action: "description", description: desc }); setKit(value); setDesc(value.description); setSaved(true); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div>
        <p className="text-sm font-medium text-accent">Your details for referral pages</p>
        <p className="text-xs text-gray-500 mt-0.5">Add your own logo, headshot and description. Clients may see these when they sign up through your link.</p>
      </div>
      {!authenticated && <p className="text-sm text-gray-500">Sign in to manage your Brand kit.</p>}
      {loading && <p role="status">Loading Brand kit…</p>}
      {error && <div role="alert" className="text-sm text-danger">{error}<button type="button" className={ghost} disabled={busy} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Reload Brand kit</button></div>}
      <div className="grid sm:grid-cols-2 gap-4">
        <Uploader file={kit.logo} disabled={!authenticated || loading || busy || !!error} onUpload={upload} id="bk-logo" kind="logo" label="Referral logo" hint="Images only (PNG, JPG or SVG). Maximum file size: 5 MB." accept={["image/png", "image/jpeg", "image/svg+xml"]} maxMB={5} />
        <Uploader file={kit.headshot} disabled={!authenticated || loading || busy || !!error} onUpload={upload} id="bk-head" kind="headshot" label="Headshot" hint="Images only (PNG or JPG). Maximum file size: 5 MB." accept={["image/png", "image/jpeg"]} maxMB={5} />
      </div>
      <form onSubmit={save} className={`${card} p-5`}>
        <label htmlFor="bk-desc" className="text-sm font-medium text-accent">Description</label>
        <p className="text-xs text-gray-500 mt-0.5">A short introduction to your firm.</p>
        <textarea id="bk-desc" disabled={!authenticated || loading || busy || !!error} rows={4} maxLength={max} className={`${field} mt-3`} value={desc} onChange={(e) => { setDesc(e.target.value); setSaved(false); }} />
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3"><button type="submit" disabled={!authenticated || loading || busy || !!error || desc === kit.description} className={primary}>{busy ? "Saving…" : "Save description"}</button>{saved && <span role="status" className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span>}</div>
          <span className="text-xs text-gray-400">{desc.length}/{max}</span>
        </div>
      </form>

      <BrandAssets authenticated={authenticated} />
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
function Guide({ authenticated }) {
  const [open, setOpen] = useState(0);
  const [onePagers, setOnePagers] = useState(authenticated ? [] : DEMO_ONE_PAGERS);
  const [loading, setLoading] = useState(authenticated);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    loadOnePagers().then(value => { if (active) { setOnePagers(value); setError(""); } })
      .catch(error => { if (active) setError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticated, revision]);
  async function download(item) {
    try {
      const current = (authenticated ? await loadOnePagers() : DEMO_ONE_PAGERS).find(record => record.id === item.id);
      if (!current) throw new Error("This one-pager is no longer available.");
      const response = await fetch(current.file.url);
      if (!response.ok) throw new Error("Unable to download this one-pager. Please try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = current.file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(error.message); }
  }
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
      {loading ? <p className="mt-3 text-sm text-gray-500">Loading one-pagers…</p> : <>
        {error && <div role="alert" className="mt-3 text-sm text-danger">{error}<button type="button" className={ghost} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Try again</button></div>}
        {!error && !onePagers.length && <p className="mt-3 text-sm text-gray-500">No one-pagers are available yet.</p>}
        <ul className="mt-3 divide-y divide-gray-100">
          {onePagers.map(item => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-2 text-sm text-gray-900 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{item.name}</span><span className="text-xs text-gray-400 shrink-0">{fileFormat(item.file.name)}</span></span>
              <button type="button" onClick={() => download(item)} aria-label={`Download ${item.name}`} className={ghost}><Download className="w-4 h-4" />Download</button>
            </li>
          ))}
        </ul>
      </>}
      
    </div>
    </div>
  );
}

/* ------------------------------------------------------------- Contact */
/* --------------------------------------------------------------- Shell */
const PARTNER_NAV_ITEMS = NAV
  .filter(([key]) => key !== "contact")
  .map(([key, label, icon]) => ({
    key,
    label,
    icon,
  }));

const ADMIN_NAV_ITEMS = [{ key: "admin", label: "User management", icon: Users }, { key: "banking-approvals", label: "Banking approvals", icon: Landmark }, { key: "admin-payouts", label: "Payouts", icon: DollarSign }, { key: "admin-referrals", label: "Referral follow-up", icon: Users }, { key: "documents", label: "Documents", icon: FileText }];

export default function PartnerPortal({ onExit, user, isAdmin = false, signingOut = false, signOutError = "", basePath = "/demo" }) {
  const canAdmin = !!user && isAdmin;
  // The current page comes from the address (for example /partner/referrals), so back, forward, refresh and bookmarks work.
  const { page } = useParams();
  const navigate = useNavigate();
  const defaultTab = canAdmin ? "admin" : "home";
  const allowedTabs = canAdmin ? [...ADMIN_NAV_ITEMS.map((item) => item.key), "contact"] : NAV.map((item) => item[0]);
  const tab = page && allowedTabs.includes(page) ? page : defaultTab;
  useViewFocus(tab);
  const setTab = (key) => navigate(key === defaultTab ? basePath : `${basePath}/${key}`);
  useEffect(() => {
    // An unknown or not-permitted page goes back to the start page.
    if (page && !allowedTabs.includes(page)) navigate(basePath, { replace: true });
  }, [page, canAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  const title = tab === "admin-referrals" ? "Referral follow-up" : tab === "documents" ? "Documents" : tab === "admin" ? "User management" : tab === "banking-approvals" ? "Banking approvals" : tab === "admin-payouts" ? "Payouts" : tab === "home" ? "Home" : NAV.find((n) => n[0] === tab)?.[1];
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
        portalLabel={canAdmin ? "Administration" : user ? "Partner portal" : "DEMO Partner Portal"}
        account={{
          name: username,
          email: user?.email || "partner@pulsefx.example",
          onLogout: onExit,
          showSettings: false,
          showAdmin: false,
          disabled: signingOut,
        }}
      />
      <main id="main-content" className={`flex-1 min-w-0 p-4 pt-[72px] md:p-6 ${tab === "add" || tab === "contact" ? "bg-white" : "bg-gray-50"}`}>
        {tab !== "add" && tab !== "contact" && <div className="flex items-center justify-between mb-4">
          <div><h1 className="text-xl font-semibold text-gray-900">{title}</h1>{PAGE_SUBTITLES[tab] && <p className="mt-0.5 text-sm text-gray-500">{PAGE_SUBTITLES[tab]}</p>}</div>
        </div>}
        {signOutError && <p role="alert" className="text-sm text-danger mb-4">{signOutError}</p>}
        {tab === "documents" && canAdmin && <Documents key={user?.id} />}
        {tab === "admin" && canAdmin && <PartnerAdmin />}
        {tab === "banking-approvals" && canAdmin && <BankingApprovals />}
        {tab === "admin-payouts" && canAdmin && <AdminPayouts />}
        {tab === "admin-referrals" && canAdmin && <AdminReferrals key={user?.id} />}
        {tab === "home" && <PartnerHome key={user?.id || "demo"} go={setTab} authenticated={!!user} />}
        {tab === "referrals" && <Referrals key={user?.id || "demo"} authenticated={!!user} go={setTab} />}
        {tab === "add" && <AddClient go={setTab} authenticated={!!user} />}
        {tab === "banking" && <BankingDetails authenticated={!!user} />}
        {tab === "payouts" && <PayoutHistory authenticated={!!user} showDescription={false} />}
        {tab === "brand" && <BrandKit key={user?.id || "demo"} authenticated={!!user} />}
        {tab === "guide" && <Guide key={user?.id || "demo"} authenticated={!!user} />}
        {tab === "contact" && !canAdmin && <PartnerSupport key={user?.id || "demo"} authenticated={!!user} onClose={() => setTab("home")} />}
        {tab !== "admin" && tab !== "add" && tab !== "contact" && !user && <p className="text-xs text-gray-400 mt-4">Portal preview: all names and figures are sample data.</p>}
      </main>
    </div>
  );
}
