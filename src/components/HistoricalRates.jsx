import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, LineChart, MoreHorizontal, Trash2 } from "lucide-react";
import Modal from "./Modal";
import RateChart from "./RateChart";
import Tooltip from "./Tooltip";
import { fmt2, niceDate } from "../lib/fx";
import {
  HISTORY_CURRENCIES,
  CURRENCY_NAMES,
  CURRENCY_FLAGS,
  PERIODS,
  useHistory,
  sliceDays,
} from "../lib/history";

const WATCHLIST_KEY = "pfx.watchlist";
const ALERTS_KEY = "pfx.alerts";
const DEFAULT_WATCHLIST = [
  { want: "USD", have: "CAD" },
  { want: "EUR", have: "CAD" },
];

function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the demo still works for this visit */
  }
}

const optionLabel = (c) => `${CURRENCY_FLAGS[c]} ${c} ${CURRENCY_NAMES[c]}`;
const selectCls = "w-full text-sm border border-gray-200 rounded-md px-2 py-2 bg-white focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";
const inputCls = "w-full text-sm border border-gray-200 rounded-md px-2.5 py-2 bg-white tabular-nums focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100";

function CurrencySelect({ id, value, onChange, other }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
      {HISTORY_CURRENCIES.map((c) => (
        <option key={c} value={c} disabled={c === other}>{optionLabel(c)}</option>
      ))}
    </select>
  );
}

function Field({ label, htmlFor, children, hint }) {
  return (
    <div className="grid grid-cols-[150px_1fr] gap-3 items-start">
      <label htmlFor={htmlFor} className="text-xs font-medium text-accent pt-2.5">{label}</label>
      <div>
        {children}
        {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

/* ---------- One chart card ---------- */
function PairChart({ pair, period, compact = false }) {
  const { status, points } = useHistory(pair.want, pair.have);
  const [hovered, setHovered] = useState(null);
  const days = PERIODS.find((p) => p.key === period).days;
  const shown = sliceDays(points, days);

  const first = shown[0]?.value;
  const last = shown[shown.length - 1]?.value;
  const change = first && last ? ((last - first) / first) * 100 : null;
  const up = change !== null && change >= 0;
  const periodLabel = PERIODS.find((p) => p.key === period).label.toLowerCase();

  const chartLabel =
    change === null
      ? `${pair.want} vs ${pair.have}`
      : `${pair.want} vs ${pair.have} over ${periodLabel}: from ${first.toFixed(4)} to ${last.toFixed(4)}, ${up ? "up" : "down"} ${Math.abs(change).toFixed(2)} percent`;

  if (compact) {
    return (
      <div className="rounded-lg border border-gray-200/70 px-3 pt-2 pb-1">
        <div className="flex items-center justify-between gap-2 h-6 text-xs tabular-nums" aria-live="polite">
          <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
            <span className="text-accent">{pair.want}</span>
            <span className="text-gray-400 font-normal mx-1">vs</span>
            <span className="text-accent">{pair.have}</span>
          </p>
          {status === "loading" ? (
            <span className="text-gray-400">Loading...</span>
          ) : hovered ? (
            <span className="text-gray-600">{niceDate(hovered.date)} &middot; <b>{hovered.value.toFixed(4)}</b></span>
          ) : change !== null ? (
            <span className="flex items-center gap-2">
              <span className="text-gray-600">{last.toFixed(4)}</span>
              <span className={`font-semibold ${up ? "text-success" : "text-danger"}`}>
                <span aria-hidden="true">{up ? "\u25B2" : "\u25BC"}</span> {Math.abs(change).toFixed(3)}%
                <span className="sr-only"> {up ? "up" : "down"} over {periodLabel}</span>
              </span>
            </span>
          ) : null}
        </div>
        {status === "loading" ? (
          <div className="aspect-[320/118] rounded bg-gray-50 animate-pulse" />
        ) : (
          <RateChart points={shown} period={period} onHover={setHovered} label={chartLabel} compact />
        )}
        {status === "sample" && <p className="text-[11px] text-danger">Sample data. Unable to reach the rate service.</p>}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200/70 p-3">
      <p className="text-center text-sm font-semibold text-gray-900">
        <span className="text-accent">{pair.want}</span>
        <span className="text-gray-400 font-normal mx-1.5">vs</span>
        <span className="text-accent">{pair.have}</span>
      </p>

      <div className="h-6 flex items-center justify-center text-xs tabular-nums mb-1" aria-live="polite">
        {status === "loading" ? (
          <span className="text-gray-400">Loading...</span>
        ) : hovered ? (
          <span className="text-gray-600">{niceDate(hovered.date)} &middot; <b>{hovered.value.toFixed(4)}</b></span>
        ) : change !== null ? (
          <span className={`font-semibold ${up ? "text-success" : "text-danger"}`}>
            <span aria-hidden="true">{up ? "▲" : "▼"}</span>{" "}
            {Math.abs(change).toFixed(3)}%
            <span className="sr-only"> {up ? "up" : "down"} over {periodLabel}</span>
          </span>
        ) : null}
      </div>

      {status === "loading" ? (
        <div className="aspect-[320/150] rounded bg-gray-50 animate-pulse" />
      ) : (
        <RateChart
          points={shown}
          period={period}
          onHover={setHovered}
          label={chartLabel}
        />
      )}
      {status === "sample" && (
        <p className="text-[11px] text-danger mt-1">Sample data. Unable to reach the rate service.</p>
      )}
    </div>
  );
}

/* ---------- Update watchlist ---------- */
function WatchlistModal({ pairs, onSave, onClose }) {
  const [draft, setDraft] = useState(pairs);
  const set = (i, patch) => setDraft((d) => d.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  return (
    <Modal title="Update watchlist" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <div className="px-5 py-4 space-y-5">
          {draft.map((p, i) => (
            <fieldset key={i} className="space-y-3">
              <legend className="text-sm font-semibold text-navy mb-2">Currency pair {i + 1}</legend>
              <Field label="Currency to buy" htmlFor={`wl-want-${i}`}>
                <CurrencySelect id={`wl-want-${i}`} value={p.want} other={p.have} onChange={(v) => set(i, { want: v })} />
              </Field>
              <Field label="Currency I have" htmlFor={`wl-have-${i}`}>
                <CurrencySelect id={`wl-have-${i}`} value={p.have} other={p.want} onChange={(v) => set(i, { have: v })} />
              </Field>
            </fieldset>
          ))}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 bg-gray-100 rounded-md px-4 py-2 hover:bg-gray-200">Cancel</button>
          <button type="submit" className="text-sm font-medium bg-accent text-white rounded-md px-5 py-2 hover:bg-accent-800">Save</button>
        </div>
      </form>
    </Modal>
  );
}

/* ---------- Rate alerts ---------- */
function AlertsModal({ alerts, onChange, onClose }) {
  const [tab, setTab] = useState("set");
  const [buy, setBuy] = useState("EUR");
  const [have, setHave] = useState("USD");
  const [amount, setAmount] = useState("");
  const [target, setTarget] = useState("");
  const [email, setEmail] = useState(true);
  const [text, setText] = useState(false);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(false);

  const numOnly = (setter, field) => (e) => {
    const v = e.target.value.replace(/,/g, "");
    if (/^\d*\.?\d{0,6}$/.test(v)) {
      setter(v);
      setErrors((er) => ({ ...er, [field]: undefined })); // clear the message once the user edits the field
    }
  };

  function submit(e) {
    e.preventDefault();
    const next = {};
    if (!(Number(amount) > 0)) next.amount = "Enter an amount greater than 0.";
    if (!(Number(target) > 0)) next.target = "Enter the rate you want to be notified at.";
    if (!email && !text) next.via = "Choose at least one way to be notified.";
    setErrors(next);
    if (Object.keys(next).length) return;
    onChange([...alerts, { id: Date.now(), buy, have, amount: Number(amount), target: Number(target), email, text }]);
    setAmount("");
    setTarget("");
    setSaved(true);
    setTab("manage");
  }

  const tabBtn = (key, label) => (
    <button
      type="button"
      role="tab"
      id={`ra-tab-${key}`}
      aria-selected={tab === key}
      aria-controls="ra-panel"
      onClick={() => { setTab(key); if (key === "set") setSaved(false); }}
      className={`text-xs font-semibold uppercase tracking-wide pb-2 -mb-px border-b-2 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 rounded-sm ${
        tab === key ? "border-accent text-gray-900" : "border-transparent text-gray-400 hover:text-gray-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal title="Rate alerts" onClose={onClose} maxWidth="max-w-lg">
      <div className="px-5 pt-3">
        <div role="tablist" className="flex gap-6 border-b border-gray-100">
          {tabBtn("set", "Set rate alert")}
          {tabBtn("manage", `Manage rate alerts (${alerts.length})`)}
        </div>
      </div>

      <div id="ra-panel" role="tabpanel" aria-labelledby={`ra-tab-${tab}`}>
        {tab === "set" ? (
          <form onSubmit={submit} noValidate>
            <div className="px-5 py-4 space-y-3.5">
              <p className="text-sm text-gray-600">
                Tell us the rate you are looking for and we will notify you when it is reached.
              </p>
              <Field label="Currency to buy" htmlFor="ra-buy">
                <CurrencySelect id="ra-buy" value={buy} other={have} onChange={setBuy} />
              </Field>
              <Field label="Currency I have" htmlFor="ra-have">
                <CurrencySelect id="ra-have" value={have} other={buy} onChange={setHave} />
              </Field>
              <Field label="Amount" htmlFor="ra-amount" hint={errors.amount ? undefined : `Amount of ${buy} you want to buy.`}>
                <div className="flex gap-2">
                  <input id="ra-amount" inputMode="decimal" placeholder="0.00" value={amount} onChange={numOnly(setAmount, "amount")} aria-invalid={!!errors.amount} className={inputCls} />
                  <span className="shrink-0 w-16 text-sm border border-gray-200 rounded-md px-2 py-2 bg-gray-50 text-gray-600 text-center">{buy}</span>
                </div>
                {errors.amount && <p className="text-[11px] text-danger mt-1">{errors.amount}</p>}
              </Field>
              <Field label="Notify me when the rate reaches" htmlFor="ra-target" hint={errors.target ? undefined : `1 ${buy} = ? ${have}`}>
                <input id="ra-target" inputMode="decimal" placeholder="0.0000" value={target} onChange={numOnly(setTarget, "target")} aria-invalid={!!errors.target} className={inputCls} />
                {errors.target && <p className="text-[11px] text-danger mt-1">{errors.target}</p>}
              </Field>
              <Field label="Notify me by">
                <div className="flex gap-5 pt-2.5">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={email} onChange={(e) => { setEmail(e.target.checked); setErrors((er) => ({ ...er, via: undefined })); }} className="accent-[#00785f]" /> Email
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={text} onChange={(e) => { setText(e.target.checked); setErrors((er) => ({ ...er, via: undefined })); }} className="accent-[#00785f]" /> Text message
                  </label>
                </div>
                {errors.via && <p className="text-[11px] text-danger mt-1">{errors.via}</p>}
              </Field>
              <p className="text-[11px] text-gray-400">Demo only. No notifications are sent.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 bg-gray-100 rounded-md px-4 py-2 hover:bg-gray-200">Cancel</button>
              <button type="submit" className="text-sm font-medium bg-accent text-white rounded-md px-5 py-2 hover:bg-accent-800">Save</button>
            </div>
          </form>
        ) : (
          <div className="px-5 py-4">
            {saved && <p role="status" className="text-xs text-success bg-success-100 rounded-md px-3 py-2 mb-3">Rate alert saved.</p>}
            {alerts.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">You have no rate alerts yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 tabular-nums">
                        {a.buy} vs {a.have}: notify at <b>{a.target}</b>
                      </p>
                      <p className="text-xs text-gray-500 tabular-nums">
                        Amount {a.buy} {fmt2(a.amount)} &middot; {[a.email && "Email", a.text && "Text"].filter(Boolean).join(" and ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(alerts.filter((x) => x.id !== a.id))}
                      aria-label={`Delete alert ${a.buy} vs ${a.have} at ${a.target}`}
                      className="p-1.5 rounded-md text-gray-400 hover:text-danger hover:bg-danger-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end mt-4">
              <button type="button" onClick={onClose} className="text-sm font-medium text-gray-600 bg-gray-100 rounded-md px-4 py-2 hover:bg-gray-200">Close</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------- The section ---------- */
export default function HistoricalRates({ compact = false }) {
  const [period, setPeriod] = useState("Y");
  const [pairs, setPairs] = useState(() => load(WATCHLIST_KEY, DEFAULT_WATCHLIST));
  const [alerts, setAlerts] = useState(() => load(ALERTS_KEY, []));
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState(null); // "watchlist" | "alerts" | null
  const [view, setView] = useState({ idx: 0, dir: 1 }); // compact mode shows one chart at a time
  const go = (delta) => setView((v) => ({ idx: (v.idx + delta + pairs.length) % pairs.length, dir: delta }));
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const closeModal = () => setModal(null);

  return (
    <div className={`bg-white rounded-xl border border-gray-200/70 p-4 ${compact ? "" : "mb-4"}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <LineChart className="w-3.5 h-3.5" />
          Historical rates
          <Tooltip text="See how exchange rates have moved over time, using daily reference rates from the European Central Bank." />
        </p>

        <div className="flex items-center gap-3">
          <div role="group" aria-label="Time period" className="flex items-center gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                aria-pressed={period === p.key}
                aria-label={p.label}
                title={p.label}
                className={`${compact ? "w-6 h-6" : "w-7 h-7"} rounded-full text-[11px] font-semibold transition-colors ${
                  period === p.key ? "bg-navy text-white" : "bg-accent-100 text-accent hover:bg-accent/20"
                }`}
              >
                {p.key}
              </button>
            ))}
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="More options"
              className="p-1.5 rounded-md text-accent hover:bg-accent-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-44 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
                {[
                  { key: "watchlist", label: "Update watchlist" },
                  { key: "alerts", label: "Set rate alerts" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); setModal(item.key); }}
                    className="w-full text-left text-sm text-gray-700 px-3 py-2 hover:bg-gray-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {compact ? (
        <div className="flex items-stretch gap-2">
          <div className="flex-1 min-w-0 overflow-hidden">
            <div key={`${view.idx}-${pairs[view.idx].want}${pairs[view.idx].have}`} className={view.dir > 0 ? "pfx-slide-up" : "pfx-slide-down"}>
              <PairChart pair={pairs[view.idx]} period={period} compact />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1 shrink-0" role="group" aria-label="Choose currency pair">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous currency pair"
              className="p-1.5 rounded-full text-accent bg-accent-100 hover:bg-accent/20"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <span className="text-[11px] text-gray-500 tabular-nums" aria-live="polite">
              {view.idx + 1} of {pairs.length}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next currency pair"
              className="p-1.5 rounded-full text-accent bg-accent-100 hover:bg-accent/20"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {pairs.map((pair) => (
            <PairChart key={`${pair.want}/${pair.have}`} pair={pair} period={period} />
          ))}
        </div>
      )}
      <p className="text-[11px] text-gray-400 mt-2.5">
        {compact
          ? `ECB daily reference rates \u00B7 ${PERIODS.find((p) => p.key === period).label}`
          : `ECB daily reference rates. Showing the ${PERIODS.find((p) => p.key === period).label.toLowerCase()}. Hover over a chart to see a day's rate.`}
      </p>

      {modal === "watchlist" && (
        <WatchlistModal
          pairs={pairs}
          onClose={closeModal}
          onSave={(next) => { setPairs(next); save(WATCHLIST_KEY, next); closeModal(); }}
        />
      )}
      {modal === "alerts" && (
        <AlertsModal
          alerts={alerts}
          onClose={closeModal}
          onChange={(next) => { setAlerts(next); save(ALERTS_KEY, next); }}
        />
      )}
    </div>
  );
}