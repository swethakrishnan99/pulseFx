import { useState, useMemo } from "react";
import {
  Search, Plus, Send, CheckCircle2, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Pencil, Trash2, RefreshCw, Download, Printer, SlidersHorizontal, ArrowLeft, Check,
} from "lucide-react";
import Tooltip from "./Tooltip";
import { setPendingBeneficiary } from "../lib/quoteHandoff";
import { CURRENCIES, FLAGS, NAMES } from "../lib/currencies";
import { PURPOSES } from "../lib/reasons";

const COUNTRIES = [
  "Australia", "Canada", "France", "Germany", "Ireland", "Italy", "Mexico",
  "Netherlands", "Spain", "United Kingdom", "United States",
];

// Bank fields change with the currency (and country). role "account" is masked once saved;
// role "routing" is shown in the Routing column.
const SWIFT = { key: "swift", label: "SWIFT / BIC", role: "routing", placeholder: "e.g. TDOMCATT", pattern: /[^A-Za-z0-9]/g, min: 8, upper: true };
const ACCOUNT = { key: "account", label: "Account number", role: "account", placeholder: "Digits only", pattern: /\D/g, min: 4, mono: true };

function bankFields(currency, country) {
  if (currency === "USD" && country === "United States")
    return [ACCOUNT, { key: "aba", label: "ABA routing number", role: "routing", placeholder: "9 digits", pattern: /\D/g, min: 9, max: 9, mono: true }];
  if (currency === "EUR")
    return [{ key: "account", label: "IBAN", role: "account", placeholder: "e.g. DE89 3704 0044 0532 0130 00", pattern: /[^A-Za-z0-9]/g, min: 15, upper: true, mono: true }, SWIFT];
  if (currency === "GBP" && country === "United Kingdom")
    return [ACCOUNT, { key: "sort", label: "Sort code", role: "routing", placeholder: "6 digits", pattern: /\D/g, min: 6, max: 6, mono: true }];
  if (currency === "AUD" && country === "Australia")
    return [ACCOUNT, { key: "bsb", label: "BSB", role: "routing", placeholder: "6 digits", pattern: /\D/g, min: 6, max: 6, mono: true }];
  if (currency === "MXN" && country === "Mexico")
    return [{ key: "account", label: "CLABE", role: "account", placeholder: "18 digits", pattern: /\D/g, min: 18, max: 18, mono: true }, SWIFT];
  return [ACCOUNT, SWIFT];
}

const INITIAL = [
  { id: 1, nickname: "Test Company Inc", name: "Test Company Inc", currency: "CAD", country: "Canada", bank: "The Toronto-Dominion Bank", account: "12345678", routing: "TDOMCATT", routingLabel: "SWIFT / BIC", email: "accounts@example.com", notify: false, address: "88 Richmond St W Unit 100", city: "Toronto", state: "ON", postCode: "M5V 3P1", purpose: "Supplier or invoice payment", status: "approved" },
  { id: 2, nickname: "Maple Supply Co.", name: "Maple Supply Co.", currency: "CAD", country: "Canada", bank: "Royal Bank of Canada", account: "55018842", routing: "ROYCCAT2", routingLabel: "SWIFT / BIC", email: "billing@example.com", notify: true, address: "200 Bay St", city: "Toronto", state: "ON", postCode: "M5J 2J5", purpose: "Supplier or invoice payment", status: "approved" },
  { id: 3, nickname: "Lone Star Logistics", name: "Lone Star Logistics LLC", currency: "USD", country: "United States", bank: "JPMorgan Chase Bank", account: "90044127", routing: "021000021", routingLabel: "ABA routing number", email: "ap@example.com", notify: true, address: "1200 Main St", city: "Dallas", state: "TX", postCode: "75202", purpose: "Services", status: "approved" },
  { id: 4, nickname: "Pacific Freight LLC", name: "Pacific Freight LLC", currency: "USD", country: "United States", bank: "Bank of America", account: "30981265", routing: "026009593", routingLabel: "ABA routing number", email: "finance@example.com", notify: false, address: "500 Harbor Dr", city: "Seattle", state: "WA", postCode: "98101", purpose: "Services", status: "pending" },
];

const STATUS_STYLES = {
  approved: { label: "Approved", className: "text-success bg-success-100", icon: CheckCircle2 },
  pending: { label: "Pending review", className: "text-warning bg-warning-100", icon: Clock },
};

// Show only the last 4 characters: never display a full account number on screen
const maskAccount = (acc) => `••••${String(acc).slice(-4)}`;

const EMPTY_FORM = {
  currency: "CAD", name: "", nickname: "", country: "", address: "", address2: "", city: "", state: "",
  postCode: "", email: "", purpose: "", purposeNote: "", bank: "", accountName: "", values: {},
};

const input = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const label = "block text-[11px] text-gray-500 mb-1";

function Field({ text, required, hint, children }) {
  return (
    <div>
      <label className={label}>
        {text}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function DetailLine({ k, v, mono }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{k}</span>
      <span className={`text-gray-900 break-words min-w-0 ${mono ? "font-mono" : ""}`}>{v || "-"}</span>
    </div>
  );
}

const OPTIONAL_COLS = [
  { key: "country", label: "Bank country" },
  { key: "account", label: "Account number" },
  { key: "routing", label: "Routing" },
];

export default function Beneficiaries({ onNavigate }) {
  const [beneficiaries, setBeneficiaries] = useState(INITIAL);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("list"); // list | form
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expanded, setExpanded] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [cols, setCols] = useState({ country: false, account: true, routing: true });
  const [chooser, setChooser] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return beneficiaries;
    return beneficiaries.filter((b) =>
      [b.nickname, b.name, b.bank, b.currency, b.country].some((v) => v.toLowerCase().includes(q))
    );
  }, [beneficiaries, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages - 1);
  const visible = filtered.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const from = filtered.length ? safePage * pageSize + 1 : 0;
  const to = Math.min(filtered.length, (safePage + 1) * pageSize);

  const template = [
    "1.5fr", "0.7fr", "1.5fr",
    cols.country && "1fr", cols.account && "1fr", cols.routing && "1.1fr",
    "1.1fr", "150px",
  ].filter(Boolean).join(" ");
  const minW = 700 + (cols.country ? 110 : 0) + (cols.account ? 110 : 0) + (cols.routing ? 120 : 0);

  // ---- form ----
  const fields = bankFields(form.currency, form.country);
  const showBank = form.currency && form.country;
  const bankOk = fields.every((f) => (form.values[f.key] || "").length >= f.min);
  const canSave =
    form.name.trim() && form.nickname.trim() && form.country && form.address.trim() && form.city.trim() &&
    form.purpose && form.purposeNote.trim() && form.bank.trim() && showBank && bankOk;

  function openForm(b) {
    setNotice("");
    if (b) {
      const f = bankFields(b.currency, b.country);
      setEditingId(b.id);
      setForm({
        ...EMPTY_FORM, currency: b.currency, name: b.name, nickname: b.nickname, country: b.country,
        address: b.address, city: b.city, state: b.state || "", postCode: b.postCode || "", email: b.email || "",
        purpose: b.purpose || "", purposeNote: "Existing beneficiary", bank: b.bank, accountName: b.name,
        values: Object.fromEntries(f.map((x) => [x.key, x.role === "account" ? b.account : b.routing])),
      });
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
    setView("form");
  }

  function save(addAnother) {
    if (!canSave) return;
    const account = fields.find((f) => f.role === "account");
    const routing = fields.find((f) => f.role === "routing");
    const record = {
      id: editingId || Date.now(), nickname: form.nickname.trim(), name: form.name.trim(), currency: form.currency,
      country: form.country, bank: form.bank.trim(), account: form.values[account.key],
      routing: form.values[routing.key], routingLabel: routing.label, email: form.email.trim(), notify: false,
      address: [form.address.trim(), form.address2.trim()].filter(Boolean).join(", "), city: form.city.trim(),
      state: form.state.trim(), postCode: form.postCode.trim(), purpose: form.purpose,
      status: editingId ? beneficiaries.find((b) => b.id === editingId).status : "pending",
    };
    setBeneficiaries((prev) => (editingId ? prev.map((b) => (b.id === editingId ? record : b)) : [record, ...prev]));
    setNotice(
      editingId ? `${record.nickname} was updated.` : `${record.nickname} was saved. Our team will review it before you can pay them.`
    );
    if (addAnother) {
      setEditingId(null);
      setForm(EMPTY_FORM);
      window.scrollTo?.(0, 0);
    } else {
      setView("list");
    }
  }

  function setValue(f, raw) {
    let v = raw.replace(f.pattern, "");
    if (f.upper) v = v.toUpperCase();
    if (f.max) v = v.slice(0, f.max);
    setForm((s) => ({ ...s, values: { ...s.values, [f.key]: v } }));
  }

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 700);
  }

  function downloadCsv() {
    const rows = [
      ["Nickname", "Currency", "Bank name", "Bank country", "Account number", "Routing", "Status"],
      ...filtered.map((b) => [b.nickname, b.currency, b.bank, b.country, maskAccount(b.account), b.routing, b.status]),
    ].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "pulsefx-beneficiaries.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const iconBtn = "p-1.5 rounded-md text-gray-500 hover:text-accent hover:bg-white border border-transparent hover:border-gray-200";

  // ================= FORM VIEW =================
  if (view === "form") {
    return (
      <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
        <button
          type="button"
          onClick={() => setView("list")}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to beneficiaries
        </button>
        <h1 className="text-xl font-semibold text-gray-900 mb-4">{editingId ? "Edit beneficiary" : "Add a beneficiary"}</h1>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(false);
          }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-5xl"
        >
          <div className="bg-white rounded-xl border border-gray-200/70 p-5">
            <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Beneficiary information</h2>
              <span className="text-[11px] text-gray-400"><span className="text-danger">*</span> Required</span>
            </div>
            <div className="flex flex-col gap-3.5">
              <Field text="Currency they receive" required>
                <select
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value, values: {} })}
                  className={input}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{`${FLAGS[c]} ${c} ${NAMES[c]}`}</option>
                  ))}
                </select>
              </Field>
              <Field text="Beneficiary name" required hint="The legal name on their bank account.">
                <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field text="Nickname" required hint="How this beneficiary appears in your lists.">
                <input className={input} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
              </Field>
              <Field text="Country" required>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value, values: {} })}
                  className={input}
                >
                  <option value="">-- Select country --</option>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field text="Address line 1" required>
                <input className={input} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </Field>
              <Field text="Address line 2">
                <input className={input} value={form.address2} onChange={(e) => setForm({ ...form, address2: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field text="City" required>
                  <input className={input} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </Field>
                <Field text="State / province">
                  <input className={input} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field text="Postal code">
                  <input className={input} value={form.postCode} onChange={(e) => setForm({ ...form, postCode: e.target.value })} />
                </Field>
                <Field text="Email address">
                  <input type="email" className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
              <Field text="Purpose of payment" required>
                <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} className={input}>
                  <option value="">-- Select purpose --</option>
                  {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field text="Purpose of payment description" required>
                <textarea
                  rows={3}
                  value={form.purposeNote}
                  onChange={(e) => setForm({ ...form, purposeNote: e.target.value })}
                  placeholder="Be specific, e.g. “This company is a supplier of leather goods. Each month we pay them for wallets and belts.”"
                  className={input}
                />
              </Field>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200/70 p-5 self-start">
            <div className="flex items-baseline justify-between border-b border-gray-100 pb-2 mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Bank information</h2>
              <span className="text-[11px] text-gray-400"><span className="text-danger">*</span> Required</span>
            </div>
            {!showBank ? (
              <p className="text-xs font-medium text-danger">Select a currency and a country first.</p>
            ) : (
              <div className="flex flex-col gap-3.5">
                <Field text="Bank name" required>
                  <input className={input} value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="e.g. The Toronto-Dominion Bank" />
                </Field>
                <Field text="Account name" hint="Defaults to the beneficiary name.">
                  <input className={input} value={form.accountName || form.name} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
                </Field>
                {fields.map((f) => (
                  <Field
                    key={f.key}
                    text={f.label}
                    required
                    hint={f.role === "account" ? "Once saved, only the last 4 characters are shown." : undefined}
                  >
                    <input
                      className={`${input} ${f.mono ? "font-mono" : ""}`}
                      value={form.values[f.key] || ""}
                      onChange={(e) => setValue(f, e.target.value)}
                      placeholder={f.placeholder}
                    />
                  </Field>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={!canSave}
              className="text-sm font-medium bg-accent text-white px-5 py-2 rounded-md hover:bg-accent-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingId ? "Save changes" : "Save this beneficiary"}
            </button>
            {!editingId && (
              <button
                type="button"
                disabled={!canSave}
                onClick={() => save(true)}
                className="text-sm font-medium border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save &amp; add another
              </button>
            )}
            <button
              type="button"
              onClick={() => setView("list")}
              className="text-sm font-medium text-gray-500 px-4 py-2 rounded-md hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ================= LIST VIEW =================
  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h1 className="text-xl font-semibold text-gray-900">Beneficiaries</h1>
        <div className="flex items-center gap-1 shrink-0">
          <button type="button" onClick={refresh} aria-label="Refresh" title="Refresh" className={iconBtn}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={downloadCsv} aria-label="Download CSV" title="Download CSV" className={iconBtn}>
            <Download className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => window.print()} aria-label="Print" title="Print" className={iconBtn}>
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4 max-w-xl">
        The people and companies you pay. New beneficiaries are reviewed by our team before you can send to them.
      </p>

      {notice && (
        <p role="status" className="flex items-center gap-1.5 text-xs text-success bg-success-100 rounded-md px-3 py-2 mb-3 max-w-xl">
          <Check className="w-3.5 h-3.5 shrink-0" />
          {notice}
        </p>
      )}

      <button
        type="button"
        onClick={() => openForm(null)}
        className="flex items-center gap-1.5 bg-accent text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-accent-800 transition-colors mb-4"
      >
        <Plus className="w-4 h-4" />
        Add beneficiary
      </button>

      <div className="flex flex-wrap items-center gap-2 mb-3.5">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search by name, bank or currency"
            aria-label="Search beneficiaries"
            className="w-full text-sm border border-gray-200 rounded-md pl-9 pr-3 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setChooser((o) => !o)}
            aria-label="Choose columns"
            aria-expanded={chooser}
            title="Choose columns"
            className={`${iconBtn} border-gray-200 bg-white`}
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          {chooser && (
            <>
              <button type="button" aria-label="Close column chooser" className="fixed inset-0 z-10 cursor-default" onClick={() => setChooser(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 w-48">
                <p className="text-[11px] text-gray-400 px-2 pb-1">Show columns</p>
                {OPTIONAL_COLS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-gray-700 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cols[c.key]}
                      onChange={() => setCols((s) => ({ ...s, [c.key]: !s[c.key] }))}
                      className="accent-accent"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
          <span>{from}-{to} of {filtered.length}</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            aria-label="Rows per page"
            className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white"
          >
            {[5, 10, 25].map((n) => <option key={n} value={n}>{n} per page</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200/70 p-4 overflow-x-auto">
        <div className="grid gap-3 text-[11px] text-gray-400 border-b border-gray-100 pb-1.5" style={{ gridTemplateColumns: template, minWidth: minW }}>
          <span>Nickname</span>
          <span>Currency</span>
          <span>Bank name</span>
          {cols.country && <span>Bank country</span>}
          {cols.account && (
            <span className="flex items-center gap-1">
              Account number
              <Tooltip text="For your security we only show the last 4 characters of each account number." />
            </span>
          )}
          {cols.routing && (
            <span className="flex items-center gap-1">
              Routing
              <Tooltip text="SWIFT/BIC, ABA, sort code or BSB: the code that identifies their bank." />
            </span>
          )}
          <span>Approval status</span>
          <span />
        </div>

        {visible.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            {query ? <>No beneficiaries match &ldquo;{query}&rdquo;.</> : "No beneficiaries yet."}
          </p>
        )}

        {visible.map((b, i) => {
          const status = STATUS_STYLES[b.status];
          const StatusIcon = status.icon;
          const open = expanded === b.id;
          return (
            <div key={b.id} className={i < visible.length - 1 ? "border-b border-gray-100" : ""}>
              <div className="grid gap-3 items-center py-3 text-sm" style={{ gridTemplateColumns: template, minWidth: minW }}>
                <span className="font-medium text-gray-900">{b.nickname}</span>
                <span className="text-gray-700">{b.currency}</span>
                <span className="text-gray-700">
                  {b.bank}
                  {!cols.country && <span className="block text-[11px] text-gray-400">{b.country}</span>}
                </span>
                {cols.country && <span className="text-gray-700">{b.country}</span>}
                {cols.account && <span className="font-mono text-gray-500">{maskAccount(b.account)}</span>}
                {cols.routing && <span className="font-mono text-gray-700">{b.routing}</span>}
                <span>
                  <span className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${status.className}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </span>
                <span className="flex items-center justify-end gap-3 text-xs font-medium">
                  {confirmId === b.id ? (
                    <>
                      <span className="text-gray-500">Delete?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setBeneficiaries((prev) => prev.filter((x) => x.id !== b.id));
                          setConfirmId(null);
                        }}
                        className="text-danger hover:underline"
                      >
                        Yes
                      </button>
                      <button type="button" onClick={() => setConfirmId(null)} className="text-gray-500 hover:underline">
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setExpanded(open ? null : b.id)}
                        aria-expanded={open}
                        aria-label={open ? `Less info about ${b.nickname}` : `More info about ${b.nickname}`}
                        title={open ? "Less info" : "More info"}
                        className="text-gray-500 hover:text-accent"
                      >
                        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        type="button"
                        disabled={b.status !== "approved"}
                        onClick={() => {
                          setPendingBeneficiary({ name: b.nickname, currency: b.currency, last4: String(b.account).slice(-4) });
                          onNavigate("send-payment");
                        }}
                        className="inline-flex items-center gap-1 text-accent hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                      >
                        <Send className="w-3 h-3" />
                        Pay
                      </button>
                      <button type="button" aria-label={`Edit ${b.nickname}`} title="Edit" onClick={() => openForm(b)} className="text-gray-400 hover:text-accent">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" aria-label={`Delete ${b.nickname}`} title="Delete" onClick={() => setConfirmId(b.id)} className="text-gray-400 hover:text-danger">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </span>
              </div>

              {open && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4 mb-3" style={{ minWidth: 0 }}>
                  <div>
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-200 pb-1.5 mb-1">Beneficiary details</p>
                    <DetailLine k="Name" v={b.name} />
                    <DetailLine k="Email" v={b.email} />
                    <DetailLine k="Email notification" v={b.notify ? "On" : "Off"} />
                    <DetailLine k="Address" v={b.address} />
                    <DetailLine k="Post code" v={b.postCode} />
                    <DetailLine k="City" v={b.city} />
                    <DetailLine k="Purpose" v={b.purpose} />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide border-b border-gray-200 pb-1.5 mb-1">Bank details</p>
                    <DetailLine k="Account name" v={b.name} />
                    <DetailLine k="Bank name" v={b.bank} />
                    <DetailLine k="Account number" v={maskAccount(b.account)} mono />
                    <DetailLine k={b.routingLabel} v={b.routing} mono />
                    <DetailLine k="Country" v={b.country} />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 mt-4">
        <button
          type="button"
          aria-label="Previous page"
          disabled={safePage === 0}
          onClick={() => setPage(safePage - 1)}
          className="p-1.5 rounded-full border border-gray-200 bg-white text-gray-500 disabled:opacity-40"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-gray-500">Page {safePage + 1} of {pages}</span>
        <button
          type="button"
          aria-label="Next page"
          disabled={safePage >= pages - 1}
          onClick={() => setPage(safePage + 1)}
          className="p-1.5 rounded-full border border-gray-200 bg-white text-gray-500 disabled:opacity-40"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}