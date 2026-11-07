import { useState, useMemo } from "react";
import { Home, Users, Landmark, BookOpen, Headset, Copy, Check, X, ArrowUpDown, Download, UserPlus, ChevronDown, CheckCircle2, ArrowLeft, Palette, Upload, Phone, MessageSquare, Mail, FileText, History, Trash2 } from "lucide-react";
import PulseMark from "./PulseMark";

// Partner portal demo for referral partners (for example an accounting firm that refers its clients to PulseFX).
// Reached at  #partner  on the demo URL. All data is sample data and nothing is sent anywhere.

const PARTNER = { name: "ABC Accounting", onboardedOn: "2026-09-02", slug: "abc-accounting" };
const LINK = `https://partners.pulsefx.example/${PARTNER.slug}/signup`;

const DAY = 86400000;
const iso = (off) => { const d = new Date(Date.now() + off * DAY); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const pretty = (s) => new Date(`${s}T12:00:00`).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });

const STEPS = ["Invite sent", "Account created", "Documents submitted", "Under review", "Onboarded"];
const STATUSES = ["Invited", "Account created", "Documents submitted", "Under review", "Onboarded", "Rejected"];
const STATUS_STYLE = {
  Invited: "bg-gray-100 text-gray-700", "Account created": "bg-gray-100 text-gray-700", "Documents submitted": "bg-accent-100 text-accent",
  "Under review": "bg-warning-100 text-gray-800", Onboarded: "bg-success-100 text-success", Rejected: "bg-danger-100 text-danger",
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
const lab = "block text-[11px] text-gray-500 mb-1";
const primary = "text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed";

const ghost = "inline-flex items-center gap-1.5 text-sm font-medium border border-gray-200 px-3 py-2 rounded-md hover:bg-gray-50";
const PHONE = { display: "416 848 1028", tel: "+14168481028" };
const EMAIL = "partnerships@pulsefx.com";

// Download helpers. CSV cells that start with a formula character get a leading ' so Excel won't run them.
const safeCell = (v) => { let t = String(v ?? ""); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Badge({ s }) {
  return <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_STYLE[s]}`}>{s}</span>;
}

const NAV = [["home", "Home", Home], ["referrals", "Referrals", Users], ["add", "Add a client", UserPlus], ["banking", "Banking details", Landmark], ["brand", "Brand kit", Palette], ["guide", "Partner guide", BookOpen], ["contact", "Contact", Headset]];

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
        <p className="text-[11px] text-gray-500">Your partner status</p>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <p className="text-lg font-semibold text-gray-900">{PARTNER.name}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-success-100 text-success"><CheckCircle2 className="w-3.5 h-3.5" />Onboarded</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Your partner application was approved on {pretty(PARTNER.onboardedOn)}. You can refer clients and track them here.</p>
      </div>

      <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-gray-900">Referral link</p>
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
          <div key={k} className={`${card} p-5`}><p className="text-[11px] text-gray-500">{k}</p><p className="text-2xl font-semibold text-gray-900 mt-1">{v}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          ["Referrals", "Track every business you've referred and where they are in onboarding.", "Open referrals", "referrals"],
          ["Add a new client", "Invite a client yourself by entering their details. We'll send them the sign-up link.", "Add a client", "add"],
          ["Partner guide", "Answers to common questions about referring and onboarding clients.", "Read the guide", "guide"],
          ["Banking details", "Where we send partner payouts. Keep these up to date.", "View details", "banking"],
        ].map(([t, d, b, k]) => (
          <div key={k} className={`${card} p-5 flex flex-col`}>
            <p className="text-sm font-medium text-gray-900">{t}</p>
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
    ["Company", "Contact", "Email", "Country", "Status", "Onboarded", "Created", "Last modified"],
    ...rows.map((r) => [r.company, r.contact, r.email, r.country, r.status, r.status === "Onboarded" ? "Yes" : "No", r.created, r.modified]),
  ].map((r) => r.map(cell).join(","));
  const url = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url; a.download = `pulsefx-referrals-${iso(0)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function Referrals() {
  const [f, setF] = useState({ company: "", status: "", cFrom: "", cTo: "", mFrom: "", mTo: "" });
  const [sort, setSort] = useState({ key: "created", dir: "desc" });
  const [open, setOpen] = useState(null);
  const [tick] = useState(0);
  const rows = useMemo(() => {
    const r = REFERRALS.filter((x) =>
      (!f.company || x.company === f.company) && (!f.status || x.status === f.status) &&
      (!f.cFrom || x.created >= f.cFrom) && (!f.cTo || x.created <= f.cTo) &&
      (!f.mFrom || x.modified >= f.mFrom) && (!f.mTo || x.modified <= f.mTo));
    const k = sort.key;
    return [...r].sort((a, b) => (a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0) * (sort.dir === "asc" ? 1 : -1));
  }, [f, sort, tick]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "asc" ? "desc" : "asc" }));
  const th = "text-left text-[11px] font-medium text-gray-500 px-3 py-2.5 whitespace-nowrap";
  const SortTh = ({ k, children }) => (
    <th className={th} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => sortBy(k)} className="inline-flex items-center gap-1 hover:text-gray-800">{children}<ArrowUpDown className="w-3 h-3" /></button>
    </th>
  );
  const td = "px-3 py-3 text-sm text-gray-700 whitespace-nowrap";
  const dateBad = (a, b) => a && b && a > b;
  return (
    <div className={card}>
      <div className="px-4 pt-4">
        <p className="text-sm text-gray-500">Keep track of your referrals and where each one is in onboarding.</p>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mt-3 items-end">
          <div><label htmlFor="rf-co" className={lab}>Company</label>
            <select id="rf-co" className={field} value={f.company} onChange={set("company")}><option value="">All companies</option>{REFERRALS.map((r) => <option key={r.id}>{r.company}</option>)}</select></div>
          <div><label htmlFor="rf-st" className={lab}>Status</label>
            <select id="rf-st" className={field} value={f.status} onChange={set("status")}><option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label htmlFor="rf-cf" className={lab}>Created from</label><input id="rf-cf" type="date" className={field} value={f.cFrom} onChange={set("cFrom")} /></div>
          <div><label htmlFor="rf-ct" className={lab}>Created to</label><input id="rf-ct" type="date" className={field} value={f.cTo} onChange={set("cTo")} /></div>
          <div><label htmlFor="rf-mf" className={lab}>Modified from</label><input id="rf-mf" type="date" className={field} value={f.mFrom} onChange={set("mFrom")} /></div>
          <div><label htmlFor="rf-mt" className={lab}>Modified to</label><input id="rf-mt" type="date" className={field} value={f.mTo} onChange={set("mTo")} /></div>
        </div>
        {(dateBad(f.cFrom, f.cTo) || dateBad(f.mFrom, f.mTo)) && <p role="alert" className="text-[11px] text-danger mt-2">The "from" date must be before the "to" date.</p>}
        <div className="flex items-center justify-between gap-3 mt-3">
          <button type="button" onClick={() => setF({ company: "", status: "", cFrom: "", cTo: "", mFrom: "", mTo: "" })} className="text-xs font-medium text-accent hover:underline">Clear filters</button>
          <button type="button" onClick={() => exportReferrals(rows)} disabled={rows.length === 0} className="inline-flex items-center gap-1.5 text-sm font-medium bg-brand text-navy px-4 py-2 rounded-md hover:bg-[#009a7d] disabled:opacity-50 disabled:cursor-not-allowed">
            <Download className="w-4 h-4" />Download Excel
          </button>
        </div>
      </div>
      <div className="overflow-x-auto mt-2">
        <table className="w-full">
          <thead className="bg-gray-50"><tr>
            <SortTh k="company">Company</SortTh><SortTh k="status">Status</SortTh><th className={th}>Onboarded</th><SortTh k="created">Created</SortTh><SortTh k="modified">Last modified</SortTh>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-gray-100">
                <td className={td}><button type="button" onClick={() => setOpen(r)} className="text-accent hover:underline font-medium text-left">{r.company}</button></td>
                <td className={td}><Badge s={r.status} /></td>
                <td className={td}>{r.status === "Onboarded" ? "Yes" : "No"}</td>
                <td className={td}>{pretty(r.created)}</td><td className={td}>{pretty(r.modified)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-gray-400">No referrals match those filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && <Detail r={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Detail({ r, onClose }) {
  const idx = stepIndex(r.status);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-label={r.company} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white h-full overflow-y-auto p-5 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div><p className="text-base font-semibold text-gray-900">{r.company}</p><div className="mt-1"><Badge s={r.status} /></div></div>
          <button type="button" aria-label="Close" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
        </div>
        {[["Contact", r.contact], ["Email", r.email], ["Country", r.country], ["Created", pretty(r.created)], ["Last modified", pretty(r.modified)], ["Onboarded", r.status === "Onboarded" ? "Yes" : "No"]].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{k}</span><span className="text-gray-900 text-right break-all">{v}</span></div>
        ))}
        <p className="text-sm font-medium text-gray-900 mt-5 mb-2">Onboarding progress</p>
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
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------- Add client */
function AddClient({ go }) {
  const empty = { company: "", contact: "", email: "", country: "", volume: "", cur: [], notes: "" };
  const [v, setV] = useState(empty);
  const [done, setDone] = useState(null);
  const dup = REFERRALS.some((r) => r.company.toLowerCase() === v.company.trim().toLowerCase()) && v.company.trim() !== "";
  const emailOk = /^\S+@\S+\.\S+$/.test(v.email);
  const ok = v.company.trim() && !dup && v.contact.trim() && emailOk && v.country && v.volume && v.cur.length > 0;
  const toggle = (c) => setV((x) => ({ ...x, cur: x.cur.includes(c) ? x.cur.filter((y) => y !== c) : [...x.cur, c] }));
  function submit(e) {
    e.preventDefault();
    if (!ok) return;
    REFERRALS.unshift({ id: nextId++, company: v.company.trim(), contact: v.contact.trim(), email: v.email.trim(), country: v.country, status: "Invited", created: iso(0), modified: iso(0) });
    setDone(v.company.trim()); setV(empty);
  }
  if (done) return (
    <div className={`${card} p-6 max-w-xl`}>
      <CheckCircle2 className="w-8 h-8 text-success" />
      <p className="text-base font-semibold text-gray-900 mt-2">{done} has been invited</p>
      <p className="text-sm text-gray-500 mt-1">We'll email them the sign-up link. You can follow their progress under Referrals. Demo only: no email is sent.</p>
      <div className="flex gap-2 mt-4"><button type="button" className={primary} onClick={() => go("referrals")}>View referrals</button><button type="button" className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100" onClick={() => setDone(null)}>Add another</button></div>
    </div>
  );
  return (
    <form onSubmit={submit} noValidate className={`${card} p-5 max-w-xl flex flex-col gap-4`}>
      <p className="text-sm text-gray-500">Enter your client's details and we'll invite them to open a PulseFX account. They then show under Referrals.</p>
      <div><label htmlFor="ac-co" className={lab}>Company name *</label><input id="ac-co" className={field} value={v.company} onChange={(e) => setV({ ...v, company: e.target.value })} />
        {dup && <p role="alert" className="text-[11px] text-danger mt-1">You have already referred this company.</p>}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label htmlFor="ac-ct" className={lab}>Contact name *</label><input id="ac-ct" className={field} value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} /></div>
        <div><label htmlFor="ac-em" className={lab}>Contact email *</label><input id="ac-em" type="email" className={field} value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} aria-invalid={v.email !== "" && !emailOk} />
          {v.email !== "" && !emailOk && <p role="alert" className="text-[11px] text-danger mt-1">Enter a valid email address.</p>}</div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label htmlFor="ac-cn" className={lab}>Country *</label><select id="ac-cn" className={field} value={v.country} onChange={(e) => setV({ ...v, country: e.target.value })}><option value="">Select</option>{["Canada", "United States", "United Kingdom", "Mexico", "Other"].map((c) => <option key={c}>{c}</option>)}</select></div>
        <div><label htmlFor="ac-vo" className={lab}>Expected monthly volume *</label><select id="ac-vo" className={field} value={v.volume} onChange={(e) => setV({ ...v, volume: e.target.value })}><option value="">Select</option>{["Under CAD 50,000", "CAD 50,000 to 250,000", "CAD 250,000 to 1,000,000", "Over CAD 1,000,000"].map((c) => <option key={c}>{c}</option>)}</select></div>
      </div>
      <fieldset><legend className={lab}>Currencies they will use *</legend>
        <div className="flex flex-wrap gap-3 text-sm">{["CAD", "USD", "EUR", "GBP", "AUD", "MXN"].map((c) => <label key={c} className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" className="accent-accent" checked={v.cur.includes(c)} onChange={() => toggle(c)} />{c}</label>)}</div></fieldset>
      <div><label htmlFor="ac-no" className={lab}>Notes (optional)</label><textarea id="ac-no" rows={2} className={field} value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
      <div><button type="submit" disabled={!ok} className={primary}>Send invitation</button></div>
    </form>
  );
}

/* ------------------------------------------------------------- Banking */
let PAYOUT = { bank: "RBC Royal Bank", holder: "ABC Accounting Inc.", last4: "4821", currency: "CAD", status: "Verified" };
function Banking() {
  const [p, setP] = useState(PAYOUT);
  const [edit, setEdit] = useState(false);
  const [hist, setHist] = useState(false);
  const [f, setF] = useState({ bank: "", holder: "", account: "", routing: "" });
  const ok = f.bank.trim() && f.holder.trim() && f.account.length >= 4 && f.routing.length >= 3;
  function save(e) {
    e.preventDefault();
    if (!ok) return;
    PAYOUT = { bank: f.bank.trim(), holder: f.holder.trim(), last4: f.account.slice(-4), currency: "CAD", status: "Pending verification" };
    setP(PAYOUT); setEdit(false); setF({ bank: "", holder: "", account: "", routing: "" });
  }
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-gray-900">Payout account</p>
        <p className="text-xs text-gray-500 mt-0.5">Where PulseFX sends partner payouts.</p>
        {[["Bank", p.bank], ["Account holder", p.holder], ["Account", `•••• ${p.last4}`], ["Currency", p.currency]].map(([k, val]) => (
          <div key={k} className="flex justify-between gap-4 py-2 border-b border-gray-100 text-sm"><span className="text-gray-500">{k}</span><span className="text-gray-900">{val}</span></div>
        ))}
        <p className="mt-3"><span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${p.status === "Verified" ? "bg-success-100 text-success" : "bg-gray-100 text-gray-700"}`}>{p.status}</span></p>
        {p.status !== "Verified" && <p className="text-xs text-gray-500 mt-2">PulseFX will verify your new details. Payouts go to your previous account until then.</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          {!edit && <button type="button" onClick={() => setEdit(true)} className={ghost}>Update bank details</button>}
          <button type="button" aria-expanded={hist} onClick={() => setHist(!hist)} className={ghost}><History className="w-4 h-4" />Payout history</button>
        </div>
      </div>
      {hist && <PayoutHistory onClose={() => setHist(false)} />}
      {edit && (
        <form onSubmit={save} className={`${card} p-5 flex flex-col gap-3`}>
          <div><label htmlFor="bk-b" className={lab}>Bank name *</label><input id="bk-b" className={field} value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
          <div><label htmlFor="bk-h" className={lab}>Account holder *</label><input id="bk-h" className={field} value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label htmlFor="bk-a" className={lab}>Account number *</label><input id="bk-a" inputMode="numeric" className={`${field} font-mono`} value={f.account} onChange={(e) => setF({ ...f, account: e.target.value.replace(/\D/g, "") })} /></div>
            <div><label htmlFor="bk-r" className={lab}>Institution and transit number *</label><input id="bk-r" inputMode="numeric" className={`${field} font-mono`} value={f.routing} onChange={(e) => setF({ ...f, routing: e.target.value.replace(/\D/g, "") })} /></div>
          </div>
          <div className="flex gap-2"><button type="submit" disabled={!ok} className={primary}>Save</button><button type="button" onClick={() => setEdit(false)} className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100">Cancel</button></div>
        </form>
      )}
    </div>
  );
}

const PAYOUTS = [
  { ref: "PO-0007", date: iso(-12), client: "Redline Outdoor Gear", amount: 420, status: "Paid" },
  { ref: "PO-0006", date: iso(-45), client: "Summit Dental Group", amount: 310, status: "Paid" },
  { ref: "PO-0005", date: iso(-78), client: "Birchwood Furniture", amount: 275, status: "Paid" },
  { ref: "PO-0004", date: iso(-110), client: "Redline Outdoor Gear", amount: 180, status: "Paid" },
];
function PayoutHistory({ onClose }) {
  const total = PAYOUTS.reduce((a, r) => a + r.amount, 0);
  const cad = (n) => n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
  function csv() {
    const rows = [["Reference", "Date", "Client", "Amount (CAD)", "Status"], ...PAYOUTS.map((r) => [r.ref, r.date, r.client, r.amount.toFixed(2), r.status])];
    saveBlob(new Blob(["\uFEFF" + rows.map((r) => r.map(safeCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }), "payout-history.csv");
  }
  return (
    <div className={`${card} p-5`} role="region" aria-label="Payout history">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-sm font-medium text-gray-900">Payout history</p><p className="text-xs text-gray-500 mt-0.5">Total paid: {cad(total)}</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={csv} className={ghost}><Download className="w-4 h-4" />Download</button>
          <button type="button" onClick={onClose} aria-label="Close payout history" className="p-2 rounded-md text-gray-500 hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
      </div>
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm min-w-[420px]">
          <thead><tr className="text-left text-[11px] text-gray-500 border-b border-gray-100"><th className="py-2 font-normal">Date</th><th className="py-2 font-normal">Client</th><th className="py-2 font-normal text-right">Amount</th><th className="py-2 font-normal pl-4">Status</th></tr></thead>
          <tbody>{PAYOUTS.map((r) => (
            <tr key={r.ref} className="border-b border-gray-50 last:border-0"><td className="py-2 text-gray-600 whitespace-nowrap">{pretty(r.date)}</td><td className="py-2 text-gray-900">{r.client}</td><td className="py-2 text-right tabular-nums">{cad(r.amount)}</td><td className="py-2 pl-4"><span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-success-100 text-success">{r.status}</span></td></tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">Demo only: sample payouts. Real amounts will depend on the payout terms PulseFX confirms.</p>
    </div>
  );
}

/* --------------------------------------------------------------- Brand kit */

// Module-level so uploads survive tab switches (reset on reload; nothing is sent anywhere).
let BRAND = { logo: null, headshot: null, description: "" };
const TYPES = { png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml" };
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
      <p className="text-sm font-medium text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
      {file && (
        <div className="flex items-center gap-3 mt-3 p-2 rounded-md bg-gray-50">
          <img src={file.url} alt={`${label} preview`} className={`w-12 h-12 object-contain bg-white border border-gray-200 ${kind === "headshot" ? "rounded-full object-cover" : "rounded-md"}`} />
          <div className="min-w-0 flex-1"><p className="text-sm text-gray-900 truncate">{file.name}</p><p className="text-[11px] text-gray-500">{(file.size / 1024).toFixed(0)} KB</p></div>
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
        <p className="text-sm font-medium text-gray-900">Your details for referral pages</p>
        <p className="text-xs text-gray-500 mt-0.5">Add your own logo, head shot and description. Clients may see these when they sign up through your link.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Uploader id="bk-logo" kind="logo" label="Referral logo" hint="PNG, JPG or SVG, up to 2 MB." accept={["image/png", "image/jpeg", "image/svg+xml"]} maxMB={2} />
        <Uploader id="bk-head" kind="headshot" label="Head shot" hint="PNG or JPG, up to 5 MB." accept={["image/png", "image/jpeg"]} maxMB={5} />
      </div>
      <form onSubmit={save} className={`${card} p-5`}>
        <label htmlFor="bk-desc" className="text-sm font-medium text-gray-900">Description</label>
        <p className="text-xs text-gray-500 mt-0.5">A short introduction to your firm.</p>
        <textarea id="bk-desc" rows={4} maxLength={max} className={`${field} mt-3`} value={desc} onChange={(e) => { setDesc(e.target.value); setSaved(false); }} />
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-3"><button type="submit" className={primary}>Save description</button>{saved && <span role="status" className="text-xs text-success flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Saved</span>}</div>
          <span className="text-[11px] text-gray-400">{desc.length}/{max}</span>
        </div>
      </form>

      <div className={`${card} p-5`}>
        <p className="text-sm font-medium text-gray-900">PulseFX brand assets</p>
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
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-3 text-left px-5 py-4 text-sm font-medium text-gray-900 hover:bg-gray-50">
            {q}<ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 ${open === i ? "rotate-180" : ""}`} />
          </button>
          {open === i && <p className="px-5 pb-4 text-sm text-gray-600">{a}</p>}
        </div>
      ))}
      <p className="px-5 py-3 text-[11px] text-gray-400">Demo only: wording is a placeholder until PulseFX confirms the real partner terms.</p>
    </div>
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-gray-900">One-pagers</p>
      <p className="text-xs text-gray-500 mt-0.5">Download and share these with your clients.</p>
      <ul className="mt-3 divide-y divide-gray-100">
        {ONE_PAGERS.map(([n, f]) => (
          <li key={f} className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-gray-900 min-w-0"><FileText className="w-4 h-4 text-gray-400 shrink-0" /><span className="truncate">{n}</span><span className="text-[11px] text-gray-400 shrink-0">PDF</span></span>
            <a href={`${base}onepagers/${f}`} download={f} aria-label={`Download ${n}`} className={ghost}><Download className="w-4 h-4" />Download</a>
          </li>
        ))}
      </ul>
      
    </div>
    </div>
  );
}

/* ------------------------------------------------------------- Contact */
function Contact() {
  const [m, setM] = useState({ subject: "", body: "" });
  const [sent, setSent] = useState(false);
  const ok = m.subject.trim() && m.body.trim();
  return (
    <div className="flex flex-col gap-4 max-w-xl">
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-gray-900">Reach the partnerships team</p>
      <div className="flex flex-wrap gap-2 mt-3">
        <a href={`tel:${PHONE.tel}`} className={ghost}><Phone className="w-4 h-4" />Call {PHONE.display}</a>
        <a href={`sms:${PHONE.tel}`} className={ghost}><MessageSquare className="w-4 h-4" />Text {PHONE.display}</a>
        <a href={`mailto:${EMAIL}`} className={ghost}><Mail className="w-4 h-4" />{EMAIL}</a>
      </div>
    </div>
    <div className={`${card} p-5`}>
      <p className="text-sm font-medium text-gray-900">Contact your partner manager</p>
      <p className="text-xs text-gray-500 mt-0.5">Questions about a client, payouts or the programme? Send a message.</p>
      {sent ? (
        <p role="status" className="mt-4 text-sm text-success flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Message sent. Demo only: nothing was actually sent.</p>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); if (ok) setSent(true); }} className="flex flex-col gap-3 mt-4">
          <div><label htmlFor="ct-s" className={lab}>Subject *</label><input id="ct-s" className={field} value={m.subject} onChange={(e) => setM({ ...m, subject: e.target.value })} /></div>
          <div><label htmlFor="ct-b" className={lab}>Message *</label><textarea id="ct-b" rows={4} className={field} value={m.body} onChange={(e) => setM({ ...m, body: e.target.value })} /></div>
          <div><button type="submit" disabled={!ok} className={primary}>Send message</button></div>
        </form>
      )}
    </div>
    </div>
  );
}

/* --------------------------------------------------------------- Shell */
export default function PartnerPortal({ onExit }) {
  const [tab, setTab] = useState("home");
  const title = NAV.find((n) => n[0] === tab)?.[1];
  return (
    <div className="flex min-h-screen bg-gray-50 flex-col md:flex-row">
      <nav aria-label="Partner navigation" className="md:w-60 md:shrink-0 bg-navy text-white md:min-h-screen md:sticky md:top-0 md:h-screen flex md:flex-col">
        <div className="flex items-center gap-2 px-4 py-4 md:py-5">
          <PulseMark className="w-8 h-8" /><div className="leading-tight"><p className="text-base font-medium">PulseFX</p><p className="text-[11px] text-white/60">Partner portal</p></div>
        </div>
        <ul className="hidden md:flex flex-col gap-1 px-3 flex-1">
          {NAV.map(([k, l, Icon]) => (
            <li key={k}><button type="button" aria-label={l} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${tab === k ? "bg-white/10 text-white font-medium" : "text-white/70 hover:bg-white/5"}`}><Icon className="w-4 h-4" />{l}</button></li>
          ))}
        </ul>
        {onExit && <button type="button" onClick={onExit} className="hidden md:flex items-center gap-2 mx-3 mb-4 px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 rounded-lg"><ArrowLeft className="w-4 h-4" />Client portal</button>}
      </nav>

      <div className="md:hidden bg-navy-800 overflow-x-auto"><ul className="flex gap-1 px-2 pb-2">
        {NAV.map(([k, l]) => <li key={k}><button type="button" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs ${tab === k ? "bg-white/15 text-white font-medium" : "text-white/70"}`}>{l}</button></li>)}
      </ul></div>

      <main className="flex-1 min-w-0 p-4 md:p-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div><h1 className="text-xl font-semibold text-gray-900">{tab === "home" ? `Welcome, ${PARTNER.name}` : title}</h1>
            {tab === "home" && <p className="text-sm text-gray-500">Refer clients to PulseFX and track their onboarding.</p>}</div>
          {onExit && <button type="button" onClick={onExit} className="md:hidden text-xs font-medium text-accent">Client portal</button>}
        </div>
        {tab === "home" && <PartnerHome go={setTab} />}
        {tab === "referrals" && <Referrals />}
        {tab === "add" && <AddClient go={setTab} />}
        {tab === "banking" && <Banking />}
        {tab === "brand" && <BrandKit />}
        {tab === "guide" && <Guide />}
        {tab === "contact" && <Contact />}
        <p className="text-[11px] text-gray-400 mt-4">Demo only: all names and figures are sample data.</p>
      </main>
    </div>
  );
}