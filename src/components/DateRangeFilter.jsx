import { airtableDay } from "../lib/airtableDates.mjs";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addDateDays, calendarDateKeys, formatDateRange, localDateKey, parseDateKey, presetDateRange, selectRangeDate } from "../lib/dateRange.mjs";

const fullDate = value => parseDateKey(value)?.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) || "";
const action = "rounded-lg border border-gray-200 bg-white px-2 py-2 text-sm font-medium text-gray-700 sm:px-3 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
function placement(anchor, height = 510) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(560, window.innerWidth - 24);
  const maxHeight = window.innerHeight - 24;
  const below = window.innerHeight - rect.bottom - 20;
  const top = below >= Math.min(height, maxHeight) ? rect.bottom + 8 : rect.top - height - 8 >= 12 ? rect.top - height - 8 : Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - Math.min(height, maxHeight) - 12));
  return { position: "fixed", width, maxHeight: Math.min(maxHeight, window.innerHeight - top - 12), top, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) };
}

function RangePicker({ label, from, to, anchor, initialPosition, onChange, onClose, id }) {
  const panel = useRef(null), focusCalendar = useRef(false);
  const [draft, setDraft] = useState({ from, to });
  const [today] = useState(() => airtableDay(new Date()));
  const [month, setMonth] = useState(() => {
    const date = parseDateKey(from) || parseDateKey(to) || parseDateKey(today);
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const [focused, setFocused] = useState(from || to || today);
  const [position, setPosition] = useState(initialPosition);
  const days = calendarDateKeys(month);
  const tabDate = days.includes(focused) ? focused : localDateKey(month);
  useEffect(() => {
    const update = () => { if (panel.current) setPosition(placement(anchor, panel.current.scrollHeight + 2)); };
    const frame = requestAnimationFrame(() => { update(); panel.current?.querySelector(`[data-date="${tabDate}"]`)?.focus(); });
    function outside(event) { if (!panel.current?.contains(event.target) && !anchor.contains(event.target)) onClose(false); }
    function escape(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(true); } }
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape, true); };
    // Keep dismissal handlers tied to this mounted picker, without refocusing on selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);
  useEffect(() => {
    if (!focusCalendar.current) return;
    focusCalendar.current = false;
    const frame = requestAnimationFrame(() => panel.current?.querySelector(`[data-date="${focused}"]`)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [focused, month]);
  function select(value) {
    setDraft(previous => selectRangeDate(previous, value));
    setFocused(value);
  }
  function moveFocus(event, value) {
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next;
    if (Object.hasOwn(offsets, event.key)) next = addDateDays(value, offsets[event.key]);
    else if (event.key === "Home") next = addDateDays(value, -parseDateKey(value).getDay());
    else if (event.key === "End") next = addDateDays(value, 6 - parseDateKey(value).getDay());
    else if (["PageUp", "PageDown"].includes(event.key)) {
      const date = parseDateKey(value), direction = event.key === "PageUp" ? -1 : 1;
      const lastDay = new Date(date.getFullYear(), date.getMonth() + direction + 1, 0).getDate();
      next = localDateKey(new Date(date.getFullYear(), date.getMonth() + direction, Math.min(date.getDate(), lastDay), 12));
    } else return;
    event.preventDefault(); focusCalendar.current = true; setFocused(next);
    const date = parseDateKey(next); setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }
  function preset(value) {
    const next = presetDateRange(value, parseDateKey(today)); setDraft(next); setFocused(next.from);
    const date = parseDateKey(next.from); setMonth(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  }
  const complete = (!draft.from && !draft.to) || !!(draft.from && draft.to && draft.from <= draft.to);
  return <section ref={panel} onBlur={event => { if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== anchor) onClose(false); }} id={id} role="dialog" aria-modal="false" aria-labelledby={`${id}-title`} style={position} className="z-[70] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 text-gray-900 shadow-xl">
    <h2 id={`${id}-title`} className="mb-3 text-sm font-semibold">{label} · Select period</h2>
    <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <div className="flex flex-wrap gap-1 sm:flex-col sm:border-r sm:border-gray-100 sm:pr-3" aria-label="Quick periods">{[["today", "Today"], ["week", "Last 7 days"], ["month30", "Last 30 days"], ["month", "This month"], ["lastMonth", "Last month"], ["year", "This year"], ["lastYear", "Last year"]].map(([value, text]) => <button key={value} type="button" onClick={() => preset(value)} className="rounded-md px-2 py-2 text-left text-sm hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-accent">{text}</button>)}</div>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2"><button type="button" aria-label="Previous month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() - 1, 1, 12))} className="rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"><ChevronLeft className="h-4 w-4" /></button><span className="text-sm font-medium">{month.toLocaleDateString("en-CA", { month: "long", year: "numeric" })}</span><button type="button" aria-label="Next month" onClick={() => setMonth(value => new Date(value.getFullYear(), value.getMonth() + 1, 1, 12))} className="rounded-md border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"><ChevronRight className="h-4 w-4" /></button></div>
        <div className="mb-1 grid grid-cols-7 text-center text-xs text-gray-500" aria-hidden="true">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(day => <span key={day}>{day}</span>)}</div>
        <div role="group" aria-label="Select start and end dates" className="grid grid-cols-7">{days.map(value => {
          const edge = value === draft.from || value === draft.to;
          const inside = draft.from && draft.to && value >= draft.from && value <= draft.to;
          return <button key={value} type="button" data-date={value} aria-label={fullDate(value)} aria-pressed={edge} aria-current={value === today ? "date" : undefined} tabIndex={value === tabDate ? 0 : -1} onClick={() => select(value)} onKeyDown={event => moveFocus(event, value)} className={`h-10 min-w-0 text-sm focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-accent ${edge ? "rounded-md bg-accent font-medium text-white" : inside ? "bg-accent-100 text-gray-900" : `${value.slice(0, 7) === localDateKey(month).slice(0, 7) ? "text-gray-900" : "text-gray-400"} rounded-md hover:bg-gray-100`} ${value === today && !edge ? "font-semibold underline underline-offset-4" : ""}`}>{parseDateKey(value).getDate()}</button>;
        })}</div>
        <p aria-live="polite" className="mt-3 min-h-8 text-xs text-gray-500">{draft.from && !draft.to ? `${fullDate(draft.from)} · Select an end date` : formatDateRange(draft.from, draft.to)}</p>
        <p className="mt-1 text-xs text-gray-400">Dates in Toronto time (EST/EDT)</p>
        <p className="sr-only">Use arrow keys to navigate dates and Enter or Space to select the start and end of the period.</p>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3"><button type="button" onClick={() => setDraft({ from: "", to: "" })} className="mr-auto rounded-md px-0 py-2 text-sm sm:px-2 font-medium text-accent hover:bg-accent-100">Clear period</button><button type="button" onClick={() => onClose(true)} className={action}>Cancel</button><button type="button" disabled={!complete} onClick={() => { onChange(draft); onClose(true); }} className="rounded-lg bg-brand px-2 py-2 text-sm sm:px-3 font-medium text-navy hover:bg-[#009a7d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40">Apply period</button></div>
  </section>;
}

export default function DateRangeFilter({ id, label, from = "", to = "", onChange }) {
  const generatedId = useId(), trigger = useRef(null);
  const [popup, setPopup] = useState(null);
  const pickerId = `${generatedId}-picker`;
  function close(restoreFocus) { setPopup(null); if (restoreFocus) trigger.current?.focus(); }
  return <div className="filter-field">
    <label htmlFor={id} className="mb-1.5 block text-xs text-gray-500">{label}</label>
    <button ref={trigger} id={id} type="button" aria-label={`${label} date range`} aria-describedby={`${id}-value`} aria-haspopup="dialog" aria-expanded={!!popup} aria-controls={popup ? pickerId : undefined} onClick={event => setPopup(popup ? null : { anchor: event.currentTarget, position: placement(event.currentTarget) })} className={`filter-control flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${popup ? "border-accent ring-2 ring-accent-100" : "border-gray-200 hover:border-gray-400"}`}>
      <span id={`${id}-value`} className="min-w-0 truncate">{formatDateRange(from, to)}</span><CalendarDays aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-500" />
    </button>
    {popup && <RangePicker label={label} from={from} to={to} anchor={popup.anchor} initialPosition={popup.position} onChange={onChange} onClose={close} id={pickerId} />}
  </div>;
}
