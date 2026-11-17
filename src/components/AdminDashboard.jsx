import { useEffect, useState } from "react";
import { ArrowRight, RefreshCw, Users, UserPlus, Send, TrendingUp, Landmark, Palette, DollarSign, Clock3 } from "lucide-react";
import { loadAdminDashboard } from "../lib/pulsefxAdminDashboard";
import { dashboardMetrics, distribution, initialDashboardFilters, paretoRows, previousPeriod } from "../lib/adminDashboard.mjs";
import { airtableDay, formatAirtableDateTime, inAirtableDateRange } from "../lib/airtableDates.mjs";
import DateRangeFilter from "./DateRangeFilter";
import SearchFilter from "./SearchFilter";
import SearchableSelect from "./SearchableSelect";
import TablePager from "./TablePager";
import SortableHeader from "./SortableHeader";
import useTableSort from "../lib/useTableSort";
import { usePagination } from "../lib/usePagination";
const panel = "rounded-xl border border-gray-200 bg-white";
const control = "filter-control w-full rounded-lg border border-gray-200 bg-white px-3 text-sm";
const action = "inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50";
const percent = value => `${value.toLocaleString("en-CA", {
  maximumFractionDigits: 1
})}%`;
const number = value => value.toLocaleString("en-CA", {
  maximumFractionDigits: 1
});
const money = (value, currency) => `${currency} ${value.toLocaleString("en-CA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})}`;
const unique = (rows, field) => [...new Set(rows.map(row => row[field]).filter(Boolean))].sort();
function Select({
  label,
  value,
  onChange,
  options,
  all = "All"
}) {
  return <label className="block min-w-0">
    <span className="mb-1.5 block text-xs text-gray-500">{label}</span>
    <select value={value} onChange={event => onChange(event.target.value)} className={control}>
      {all !== null && <option value="">{all}</option>}
      {options.map(option => {
        const [key, text] = Array.isArray(option) ? option : [option, option];
        return <option key={key} value={key}>{text}</option>;
      })}
    </select>
  </label>;
}
function Metric({
  label,
  value,
  note,
  icon: Icon,
  onClick,
  selected,
  delta
}) {
  const content = <>
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-gray-500">{label}</span>
      <Icon className="h-4 w-4 text-accent" />
    </div>
    <p className="mt-3 break-words text-2xl font-semibold tracking-tight text-gray-900">{value}</p>
    <p className="mt-1 text-xs text-gray-500">{note}</p>
    {delta !== undefined && <p className="mt-2 text-xs text-gray-500">{delta > 0 ? "+" : ""}{number(delta)} vs previous period</p>}
  </>;
  return onClick ? <button type="button" aria-pressed={selected} onClick={onClick} className={`${panel} p-4 text-left transition-colors hover:border-accent ${selected ? "border-accent ring-1 ring-accent" : ""}`}>{content}</button> : <div className={`${panel} p-4`}>
    {content}
  </div>;
}
function Breakdown({
  title,
  rows,
  field,
  value,
  onSelect
}) {
  const groups = distribution(rows, field);
  return <section className={`${panel} p-5`}>
    <h2 className="mb-4 text-sm font-semibold text-gray-900">{title}</h2>
    <div className="max-h-64 space-y-3 overflow-y-auto">
      {groups.map(group => <button type="button" key={group.label} aria-pressed={value === group.label} onClick={() => onSelect(value === group.label ? "" : group.label)} className={`block w-full rounded-md p-1 text-left hover:bg-gray-50 ${value === group.label ? "bg-accent-100" : ""}`}>
        <span className="flex justify-between gap-3 text-xs">
          <span>{group.label}</span>
          <span className="font-medium tabular-nums">{group.count} · {percent(group.count / rows.length * 100)}</span>
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
          <span className="block h-full rounded-full bg-brand" style={{
            width: `${group.count / rows.length * 100}%`
          }} />
        </span>
      </button>)}
      {!groups.length && <p className="text-sm text-gray-500">No matching records.</p>}
    </div>
  </section>;
}
function DataTable({
  rows,
  columns,
  resetKey,
  noun,
  initialSort
}) {
  const definitions = Object.fromEntries(columns.map(column => [column.key, {
    type: column.type
  }]));
  const {
    sort,
    toggleSort,
    sortRows
  } = useTableSort(initialSort);
  const sorted = sortRows(rows, definitions);
  const pager = usePagination(sorted, `${resetKey}-${sort.key}-${sort.dir}`);
  return <>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-gray-100 bg-gray-50 text-xs text-gray-500">
          <tr>
            {columns.map(column => <SortableHeader key={column.key} column={column.key} label={column.label} sort={sort} onSort={toggleSort} className="whitespace-nowrap px-4 py-3 font-medium" />)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {pager.rows.map(row => <tr key={row.id} className="hover:bg-gray-50">
            {columns.map(column => <td key={column.key} className="px-4 py-3 align-top text-gray-700">{column.render ? column.render(row) : row[column.key] || "—"}</td>)}
          </tr>)}
          {!rows.length && <tr>
            <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">No matching {noun}. Try adjusting the filters.</td>
          </tr>}
        </tbody>
      </table>
    </div>
    <TablePager pager={pager} noun={noun} />
  </>;
}
function Trend({
  referrals,
  payouts,
  currency,
  grouping,
  onGrouping,
  from,
  to
}) {
  const buckets = new Map();
  const keyFor = value => {
    const day = airtableDay(value);
    if (!day) return "";
    if (grouping === "month") return day.slice(0, 7);
    if (grouping === "week") {
      const date = new Date(`${day}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
      return date.toISOString().slice(0, 10);
    }
    return day;
  };
  function bucket(value) {
    const key = keyFor(value);
    if (!key) return null;
    if (!buckets.has(key)) buckets.set(key, {
      label: key,
      referrals: 0,
      paid: 0
    });
    return buckets.get(key);
  }
  for (const row of referrals) {
    const item = bucket(row.createdAt);
    if (item) item.referrals++;
  }
  for (const row of payouts) {
    const item = bucket(row.eventDate);
    if (item && row.status === "Paid" && Number.isFinite(row.amount)) item.paid += row.amount;
  }
  // Include quiet periods so adjacent bars represent equal calendar intervals.
  const eventDays = [...referrals.map(row => airtableDay(row.createdAt)), ...payouts.map(row => airtableDay(row.eventDate))].filter(Boolean).sort();
  if (eventDays.length) {
    const cursor = new Date(`${from || eventDays[0]}T12:00:00Z`);
    const end = to || eventDays.at(-1);
    while (cursor.toISOString().slice(0, 10) <= end) {
      bucket(cursor.toISOString());
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  const points = [...buckets.values()].sort((a, b) => a.label.localeCompare(b.label));
  const maxReferrals = Math.max(1, ...points.map(row => row.referrals));
  const maxPaid = Math.max(1, ...points.map(row => row.paid));
  return <section className={`${panel} min-w-0 p-5`}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold">Activity over time</h2>
      <div className="w-36">
        <Select label="Group by" value={grouping} onChange={onGrouping} options={[["day", "Day"], ["week", "Week starting Monday"], ["month", "Month"]]} all={null} />
      </div>
    </div>
    <div className="flex gap-4 text-xs text-gray-500">
      <span>● Referrals</span>
      <span className="text-accent">● Paid ({currency})</span>
    </div>
    {points.length ? <div className="mt-4 overflow-x-auto">
      <div className="flex h-48 items-end gap-3 border-b border-gray-200" style={{
        minWidth: `${Math.max(400, points.length * 52)}px`
      }}>
        {points.map(row => <div key={row.label} className="flex h-full flex-1 items-end justify-center gap-1" title={`${row.label}: ${row.referrals} referrals, ${money(row.paid, currency)} paid`}>
          <div className="w-3 rounded-t bg-gray-700" style={{
            height: `${row.referrals / maxReferrals * 100}%`
          }} />
          <div className="w-3 rounded-t bg-brand" style={{
            height: `${row.paid / maxPaid * 100}%`
          }} />
        </div>)}
      </div>
      <div className="mt-2 flex gap-3" style={{
        minWidth: `${Math.max(400, points.length * 52)}px`
      }}>
        {points.map(row => <span key={row.label} className="flex-1 text-center text-[10px] text-gray-500">{row.label}</span>)}
      </div>
    </div> : <p className="py-12 text-center text-sm text-gray-500">No activity in this period.</p>}
    <p className="mt-3 text-xs text-gray-500">Each series has its own scale. Hover for exact values. Dates in Toronto time.</p>
    <details className="mt-3 text-xs text-gray-500">
      <summary className="cursor-pointer">View activity values</summary>
      <div className="mt-2 max-h-64 overflow-auto">
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-2">Period</th>
              <th>Referrals</th>
              <th>Paid ({currency})</th>
            </tr>
          </thead>
          <tbody>
            {points.map(row => <tr key={row.label}>
              <td className="py-1">{row.label}</td>
              <td>{row.referrals}</td>
              <td>{money(row.paid, currency)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </details>
  </section>;
}
function Pareto({
  rows,
  metric,
  currency,
  onMetric,
  onPartner
}) {
  const ranking = paretoRows(rows, metric);
  const top = ranking.slice(0, 10);
  const threshold = ranking.findIndex(row => row.cumulative >= 80) + 1;
  const max = Math.max(1, ...top.map(row => row[metric]));
  const width = 720,
    height = 180;
  const point = (row, index) => `${(index + 0.5) * width / top.length},${height - row.cumulative / 100 * height}`;
  return <section className={`${panel} min-w-0 overflow-hidden`}>
    <div className="flex flex-wrap items-start justify-between gap-3 p-5">
      <div>
        <h2 className="text-sm font-semibold">Partner contribution · Pareto</h2>
        <p className="mt-1 text-xs text-gray-500">{ranking.length ? `${threshold} of ${ranking.length} contributing partners account for 80% of ${metric === "paid" ? "paid value" : "referrals"}.` : "No contributions for these filters."}</p>
      </div>
      <div className="w-44">
        <Select label="Rank by" value={metric} onChange={onMetric} options={[["referrals", "Referrals"], ["paid", `Paid value (${currency})`]]} all={null} />
      </div>
    </div>
    {top.length > 0 && <div className="overflow-x-auto px-5 pb-4">
      <svg role="img" aria-label="Top ten partner contributions. Bars show individual values and the line shows cumulative share. Exact figures are in the table below." viewBox="0 0 760 215" className="min-w-[540px] w-full">
        <line x1="0" y1="36" x2={width} y2="36" stroke="#d1d5db" strokeDasharray="4 4" />
        <text x="724" y="39" fontSize="10" fill="#6b7280">80%</text>
        {top.map((row, index) => <g key={row.id}>
          <title>{row.name} · {row.email} · {metric === "paid" ? money(row[metric], currency) : row[metric]} · {percent(row.cumulative)} cumulative</title>
          <rect x={(index + 0.18) * width / top.length} y={height - row[metric] / max * height} width={width / top.length * 0.64} height={row[metric] / max * height} rx="3" fill="#00b894" />
          <text x={(index + 0.5) * width / top.length} y="200" textAnchor="middle" fontSize="10" fill="#6b7280">{(row.name || row.company || "Unknown").slice(0, 12)}</text>
        </g>)}
        <polyline points={top.map(point).join(" ")} fill="none" stroke="#12263a" strokeWidth="2.5" />
        {top.map((row, index) => <circle key={row.id} cx={(index + 0.5) * width / top.length} cy={height - row.cumulative / 100 * height} r="3" fill="#12263a" />)}
      </svg>
      <p className="text-xs text-gray-500">Top 10 shown above. The table includes every contributing partner. Line = cumulative share across the full ranking.</p>
    </div>}
    <DataTable rows={ranking} resetKey={JSON.stringify(ranking)} noun="partners" initialSort={{
      key: metric,
      dir: "desc"
    }} columns={[{
      key: "name",
      label: "Partner",
      render: row => <button type="button" onClick={() => onPartner(row.id)} className="text-left text-accent hover:underline">
        <span className="block font-medium">{row.name || row.company}</span>
        <span className="block text-xs text-gray-500">{row.email || "Email unavailable"}</span>
      </button>
    }, {
      key: metric,
      label: metric === "paid" ? `Paid (${currency})` : "Referrals",
      type: "number",
      render: row => metric === "paid" ? money(row.paid, currency) : number(row.referrals)
    }, {
      key: "share",
      label: "Share",
      type: "number",
      render: row => percent(row.share)
    }, {
      key: "cumulative",
      label: "Cumulative",
      type: "number",
      render: row => percent(row.cumulative)
    }]} />
  </section>;
}
export default function AdminDashboard({
  go
}) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({
    data: null,
    error: "",
    loading: true
  });
  useEffect(() => {
    const controller = new AbortController();
    loadAdminDashboard(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({
        data,
        loading: false,
        error: ""
      });
    }).catch(error => {
      if (!controller.signal.aborted) setResult(previous => ({
        ...previous,
        loading: false,
        error: error.message
      }));
    });
    return () => controller.abort();
  }, [attempt]);
  function refresh() {
    setResult(previous => ({ ...previous, loading: true, error: "" }));
    setAttempt(value => value + 1);
  }
  if (result.loading && !result.data) return <div role="status" className={`${panel} p-12 text-center text-sm text-gray-500`}>
    
Loading administration dashboard…

  </div>;
  if (result.error && !result.data) return <div role="alert" className={`${panel} p-6`}>
    <p className="text-sm text-danger">{result.error}</p>
    <button type="button" className={`${action} mt-4`} onClick={refresh}>
      <RefreshCw className="h-4 w-4" />
      Try again
    </button>
  </div>;
  return <AdminDashboardContent data={result.data} go={go} refresh={refresh} loading={result.loading} error={result.error} />;
}
export function AdminDashboardContent({
  data,
  go,
  refresh,
  loading = false,
  error = ""
}) {
  const [filters, setFilters] = useState(initialDashboardFilters);
  const [metric, setMetric] = useState("referrals");
  const [grouping, setGrouping] = useState("day");
  const [list, setList] = useState("partners");
  const change = (key, value) => setFilters(previous => ({
    ...previous,
    [key]: value
  }));
  const toggle = (key, value) => change(key, filters[key] === value ? "" : value);
  const current = dashboardMetrics(data, filters);
  const previous = previousPeriod(filters.from, filters.to);
  const comparison = previous ? dashboardMetrics(data, {
    ...filters,
    ...previous
  }) : null;
  const missingBank = current.partners.filter(row => row.banking === "Missing").length;
  const missingBrand = current.partners.filter(row => row.brand === "Missing").length;
  const newPartners = current.partners.filter(row => inAirtableDateRange(row.createdAt, filters.from, filters.to)).length;
  const previousPartners = previous ? current.partners.filter(row => inAirtableDateRange(row.createdAt, previous.from, previous.to)).length : null;
  const ready = current.partners.filter(row => row.banking === "Verified" && row.brand === "Complete").length;
  const resetKey = JSON.stringify(filters);
  const currencies = [...new Set(["CAD", ...unique(data.payouts, "currency")])];
  const knownPartners = new Set(data.partners.map(row => row.id));
  const invalid = [...data.referrals, ...data.payouts].filter(row => !row.validOwnership || !knownPartners.has(row.partnerId)).length;
  const partnerName = id => data.partners.find(row => row.id === id)?.name || "Unknown partner";
  return <div className="space-y-5" aria-busy={loading}>
    {error && <p role="alert" className="text-sm text-danger">{error} Showing the last loaded data.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-gray-500">Updated {formatAirtableDateTime(data.loadedAt)}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => go("admin")} className={action}>
          Manage users
          <ArrowRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={refresh} disabled={loading} className={action}>
          <RefreshCw className="h-4 w-4" />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
    <section aria-label="Dashboard filters" className={`${panel} p-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter id="dashboard-period" label="Activity period" from={filters.from} to={filters.to} onChange={({
          from,
          to
        }) => setFilters(value => ({
          ...value,
          from,
          to
        }))} />
        <DateRangeFilter id="dashboard-joined" label="Partner account created" from={filters.joinedFrom} to={filters.joinedTo} onChange={({
          from,
          to
        }) => setFilters(value => ({
          ...value,
          joinedFrom: from,
          joinedTo: to
        }))} />
        <SearchFilter id="dashboard-search" value={filters.search} onChange={event => change("search", event.target.value)} placeholder="Partner name, email or company" />
        <button type="button" className="pb-2 text-xs font-medium text-accent hover:underline" onClick={() => setFilters({
          ...initialDashboardFilters(),
          from: "",
          to: ""
        })}>Clear all filters</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="dashboard-partner" className="mb-1.5 block text-xs text-gray-500">Partner</label>
          <SearchableSelect id="dashboard-partner" label="Partner" value={filters.partner} onChange={value => change("partner", value)} options={data.partners.map(row => ({
            value: row.id,
            label: `${row.name || row.company} | ${row.email || "Email unavailable"}`
          }))} placeholder="All partners" />
        </div>
        <Select label="Account status" value={filters.access} onChange={value => change("access", value)} options={unique(data.partners, "status")} />
        <Select label="Banking" value={filters.banking} onChange={value => change("banking", value)} options={["Missing", "Pending verification", "Needs review", "Verified"]} />
        <Select label="Brand kit" value={filters.brand} onChange={value => change("brand", value)} options={["Missing", "Partial", "Complete"]} />
        <Select label="Referral activity in period" value={filters.engagement} onChange={value => change("engagement", value)} options={[["with", "With matching referrals"], ["without", "Without matching referrals"]]} />
        <Select label="Referral status" value={filters.referralStatus} onChange={value => change("referralStatus", value)} options={unique(data.referrals, "status")} />
        <Select label="Referral country" value={filters.country} onChange={value => change("country", value)} options={unique(data.referrals, "country")} />
        <Select label="Referral currency" value={filters.referralCurrency} onChange={value => change("referralCurrency", value)} options={[...new Set(data.referrals.flatMap(row => row.currencies))].sort()} />
      </div>
      <details className="mt-4">
        <summary className="cursor-pointer text-xs font-medium text-accent">Payment, volume and referral count filters</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[["minReferrals", "Minimum referrals per partner"], ["maxReferrals", "Maximum referrals per partner"]].map(([key, label]) => <label key={key}>
            <span className="mb-1.5 block text-xs text-gray-500">{label}</span>
            <input type="number" min="0" step="1" value={filters[key]} onChange={event => change(key, event.target.value)} className={control} />
          </label>)}
          <Select label="Expected monthly referral volume" value={filters.volume} onChange={value => change("volume", value)} options={unique(data.referrals, "volume")} />
          <Select label="Payment status" value={filters.payoutStatus} onChange={value => change("payoutStatus", value)} options={unique(data.payouts, "status")} />
          <Select label="Payment currency" value={filters.currency} onChange={value => change("currency", value)} options={currencies} all={null} />
          <Select label="Payment date basis" value={filters.payoutDate} onChange={value => change("payoutDate", value)} options={[["createdAt", "Payout created"], ["date", "Paid at"]]} all={null} />
        </div>
      </details>
      <p className="mt-4 text-xs leading-relaxed text-gray-500">Partner totals and setup reflect the current selected base. Activity period applies to referral submission and the selected payment date. Referral filters define matching referral activity. Payment filters apply to payments. Brand kit is complete with a logo, headshot and description.</p>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Partners" value={number(current.partners.length)} note={`${data.partners.length} across the full base`} icon={Users} />
      <Metric label="New partners" value={number(newPartners)} note="Account created in activity period" icon={UserPlus} delta={previousPartners === null ? undefined : newPartners - previousPartners} />
      <Metric label="Active accounts" value={number(current.partners.filter(row => row.status === "Active").length)} note="Activated accounts with enabled access" icon={Users} onClick={() => toggle("access", "Active")} selected={filters.access === "Active"} />
      <Metric label="Partners sending referrals" value={number(current.active)} note={`${percent(current.partners.length ? current.active / current.partners.length * 100 : 0)} of selected partners`} icon={Send} onClick={() => toggle("engagement", "with")} selected={filters.engagement === "with"} />
      <Metric label="Referrals submitted" value={number(current.referrals.length)} note="Matching referrals in activity period" icon={Send} delta={comparison ? current.referrals.length - comparison.referrals.length : undefined} />
      <Metric label="Onboarded referrals" value={number(current.onboarded)} note={`${percent(current.referrals.length ? current.onboarded / current.referrals.length * 100 : 0)} of matching submissions · current status`} icon={TrendingUp} />
      <Metric label="Referrals per contributing partner" value={number(current.active ? current.referrals.length / current.active : 0)} note="Matching submissions / contributing partners" icon={TrendingUp} />
      <Metric label="Partners without referrals" value={number(current.partners.length - current.active)} note="Without matching submissions in activity period" icon={Clock3} onClick={() => toggle("engagement", "without")} selected={filters.engagement === "without"} />
      <Metric label="Missing banking" value={number(missingBank)} note="No banking submission registered" icon={Landmark} onClick={() => toggle("banking", "Missing")} selected={filters.banking === "Missing"} />
      <Metric label="Missing brand kit" value={number(missingBrand)} note="No logo, headshot or description" icon={Palette} onClick={() => toggle("brand", "Missing")} selected={filters.brand === "Missing"} />
      <Metric label="Setup complete" value={number(ready)} note="Verified banking and complete brand kit" icon={Users} selected={filters.banking === "Verified" && filters.brand === "Complete"} onClick={() => setFilters(value => ({
        ...value,
        banking: filters.banking === "Verified" && filters.brand === "Complete" ? "" : "Verified",
        brand: filters.banking === "Verified" && filters.brand === "Complete" ? "" : "Complete"
      }))} />
      <Metric label="Awaiting banking verification" value={number(current.partners.filter(row => row.banking === "Pending verification").length)} note="Banking submission pending verification" icon={Landmark} onClick={() => toggle("banking", "Pending verification")} selected={filters.banking === "Pending verification"} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Paid", current.paid], ["Pending", current.pending], ["Failed", current.failed], ["Cancelled", current.cancelled]].map(([status, value]) => <Metric key={status} label={`${status} payments`} value={money(value, filters.currency)} note={`${current.payouts.filter(row => row.status === status).length} payments · ${filters.payoutDate === "date" ? "paid date" : "creation date"}`} icon={DollarSign} onClick={() => toggle("payoutStatus", status)} selected={filters.payoutStatus === status} delta={status === "Paid" && comparison ? current.paid - comparison.paid : undefined} />)}
    </div>
    {previous && <p className="text-xs text-gray-500">Comparison period {previous.from} – {previous.to}, using the same segments. Partner activity segments are recalculated for each period.</p>}
    <Trend referrals={current.referrals} payouts={current.payouts.map(row => ({
      ...row,
      eventDate: row[filters.payoutDate]
    }))} currency={filters.currency} grouping={grouping} onGrouping={setGrouping} from={filters.from} to={filters.to} />
    <Pareto key={metric} rows={current.ranking} metric={metric} currency={filters.currency} onMetric={setMetric} onPartner={id => change("partner", id)} />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Breakdown title="Partner account status" rows={current.partners} field="status" value={filters.access} onSelect={value => change("access", value)} />
      <Breakdown title="Banking readiness" rows={current.partners} field="banking" value={filters.banking} onSelect={value => change("banking", value)} />
      <Breakdown title="Brand kit readiness" rows={current.partners} field="brand" value={filters.brand} onSelect={value => change("brand", value)} />
      <Breakdown title="Referral pipeline" rows={current.referrals} field="status" value={filters.referralStatus} onSelect={value => change("referralStatus", value)} />
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <Breakdown title="Referrals by country" rows={current.referrals} field="country" value={filters.country} onSelect={value => change("country", value)} />
      <Breakdown title="Expected monthly volume" rows={current.referrals} field="volume" value={filters.volume} onSelect={value => change("volume", value)} />
    </div>
    <section className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="text-sm font-semibold">Explore records</h2>
        <div className="flex flex-wrap gap-2">
          {[["partners", "Partners"], ["pending", "Setup pending"], ["referrals", "Referrals"], ["payouts", "Payments"]].map(([key, label]) => <button type="button" key={key} aria-pressed={list === key} onClick={() => setList(key)} className={`rounded-lg px-3 py-2 text-xs font-medium ${list === key ? "bg-accent-100 text-accent" : "text-gray-500 hover:bg-gray-50"}`}>{label}</button>)}
        </div>
      </div>
      {(list === "partners" || list === "pending") && <DataTable key={list} rows={list === "pending" ? current.ranking.filter(row => row.banking !== "Verified" || row.brand !== "Complete") : current.ranking} noun="partners" resetKey={resetKey} initialSort={{
        key: "name",
        dir: "asc"
      }} columns={[{
        key: "name",
        label: "Partner",
        render: row => <>
          <p className="font-medium">{row.name || row.company}</p>
          <p className="text-xs text-gray-500">{row.email || "Email unavailable"}</p>
          <p className="text-xs text-gray-400">{row.company}</p>
          <button type="button" onClick={() => go("admin", {
            partnerId: row.registrationId
          })} className="mt-1 text-xs text-accent hover:underline">{row.registrationId ? "View partner" : "Manage users"}</button>
        </>
      }, {
        key: "status",
        label: "Account status"
      }, {
        key: "banking",
        label: "Banking"
      }, {
        key: "brand",
        label: "Brand kit"
      }, {
        key: "referrals",
        label: "Referrals",
        type: "number",
        render: row => row.referrals
      }, {
        key: "createdAt",
        label: "Account created",
        type: "date",
        render: row => formatAirtableDateTime(row.createdAt)
      }, {
        key: "lastReferral",
        label: "Last matching referral",
        type: "date",
        render: row => formatAirtableDateTime(row.lastReferral)
      }]} />}
      {list === "referrals" && <DataTable key={list} rows={current.referrals.map(row => ({
        ...row,
        partnerName: partnerName(row.partnerId)
      }))} noun="referrals" resetKey={resetKey} initialSort={{
        key: "createdAt",
        dir: "desc"
      }} columns={[{
        key: "company",
        label: "Client",
        render: row => <>
          <p>{row.company || "Unnamed client"}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </>
      }, {
        key: "partnerName",
        label: "Partner"
      }, {
        key: "status",
        label: "Status"
      }, {
        key: "country",
        label: "Country"
      }, {
        key: "volume",
        label: "Expected volume"
      }, {
        key: "createdAt",
        label: "Submitted",
        type: "date",
        render: row => formatAirtableDateTime(row.createdAt)
      }]} />}
      {list === "payouts" && <>
        <div className="px-5 pb-4">
          <button type="button" className="text-xs font-medium text-accent hover:underline" onClick={() => go("admin-payouts")}>Open Payouts to view or manage payments →</button>
        </div>
        <DataTable key={list} rows={current.payouts.map(row => ({
          ...row,
          partnerName: partnerName(row.partnerId)
        }))} noun="payments" resetKey={resetKey} initialSort={{
          key: filters.payoutDate,
          dir: "desc"
        }} columns={[{
          key: "partnerName",
          label: "Partner"
        }, {
          key: "amount",
          label: `Amount (${filters.currency})`,
          type: "number",
          render: row => Number.isFinite(row.amount) ? money(row.amount, row.currency) : "Unknown"
        }, {
          key: "status",
          label: "Status"
        }, {
          key: "createdAt",
          label: "Created",
          type: "date",
          render: row => formatAirtableDateTime(row.createdAt)
        }, {
          key: "date",
          label: "Paid at",
          type: "date",
          render: row => formatAirtableDateTime(row.date)
        }]} />
      </>}
    </section>
    {(invalid > 0 || data.partners.some(row => !row.createdAt) || data.payouts.some(row => row.amount === null)) && <p className="text-xs text-gray-500">{invalid > 0 && `${invalid} records with missing or inconsistent partner links are excluded from activity totals. `}Records with unknown dates are included only when their date filter is cleared. Payments with unknown amounts are excluded from value totals.</p>}
  </div>;
}
