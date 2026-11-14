import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export default function SortableHeader({ column, label, sort, onSort, className = "", right = false, as: Tag = "th", extra }) {
  const active = sort?.key === column;
  const Icon = active ? sort.dir === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  return <Tag scope={Tag === "th" ? "col" : undefined} role={Tag === "th" ? undefined : "columnheader"}
    aria-sort={active ? sort.dir === "asc" ? "ascending" : "descending" : "none"} className={className}>
    <span className={`flex items-center gap-1 ${right ? "justify-end" : ""}`}>
      <button type="button" onClick={() => onSort(column)} aria-label={`Sort by ${label}`}
        className={`inline-flex cursor-pointer items-center gap-1 text-left hover:text-gray-900 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "text-accent" : ""}`}>
        {label}<Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </button>{extra}
    </span>
  </Tag>;
}
