import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";

export default function SearchableSelect({ id, label, options, value, valueLabel = "", onChange, placeholder, disabled = false, loading = false, required = false, emptyText = "No matching options." }) {
  const listId = useId(), input = useRef(null);
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const activeIndex = Math.min(active, Math.max(0, filtered.length - 1));
  const expanded = open && !disabled;
  const activeOptionId = expanded && filtered[activeIndex] ? `${listId}-${activeIndex}` : undefined;
  useEffect(() => {
    if (activeOptionId) document.getElementById(activeOptionId)?.scrollIntoView({ block: "nearest" });
  }, [activeOptionId]);
  function choose(option) { if (loading || disabled) return; onChange(option.value); setOpen(false); setQuery(""); }
  function keyDown(event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) { setOpen(true); setQuery(""); setActive(event.key === "ArrowUp" ? options.length - 1 : 0); }
      else setActive((previous) => (previous + (event.key === "ArrowDown" ? 1 : -1) + filtered.length) % (filtered.length || 1));
    } else if (event.key === "Enter" && open) {
      event.preventDefault(); if (filtered[activeIndex]) choose(filtered[activeIndex]);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); setQuery("");
    }
  }
  return <div className="relative">
    <label htmlFor={id} className="mb-1.5 block text-xs font-medium">{label}</label>
    <div className="relative">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-controls={listId} aria-expanded={expanded}
        aria-activedescendant={activeOptionId} aria-required={required || undefined}
        autoComplete="off" disabled={disabled} value={expanded ? query : selected?.label || valueLabel}
        placeholder={loading ? "Loading…" : placeholder}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }} onBlur={() => setOpen(false)}
        onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }} onKeyDown={keyDown}
        className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-3 pr-16 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-100 disabled:bg-gray-50 disabled:text-gray-500" />
      {!disabled && (value || valueLabel) && !required && <button type="button" aria-label={`Clear ${label}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(""); input.current?.focus(); setQuery(""); setOpen(false); }} className="absolute right-8 top-2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"><X className="h-4 w-4" /></button>}
      <button type="button" aria-label={`Show ${label} options`} disabled={disabled} tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => { input.current.focus(); setOpen(!expanded); setQuery(""); setActive(0); }} className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-gray-100 disabled:pointer-events-none"><ChevronDown className="h-4 w-4" /></button>
    </div>
    {expanded && <ul id={listId} role="listbox" aria-label={label} className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg">
      {loading ? <li role="presentation" className="px-3 py-3 text-gray-500">Loading…</li> : !filtered.length ? <li role="presentation" className="px-3 py-3 text-gray-500">{emptyText}</li> : filtered.map((option, index) => <li key={option.value} id={`${listId}-${index}`} role="option" aria-selected={option.value === value}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)} onPointerMove={() => setActive(index)}
        className={`cursor-pointer break-words px-3 py-2.5 ${index === activeIndex ? "bg-accent-100 text-accent" : "text-gray-700 hover:bg-gray-50"}`}>{option.label}</li>)}
    </ul>}
  </div>;
}
