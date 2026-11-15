import { ChevronLeft, ChevronRight } from "lucide-react";

const SIZES = [5, 10, 25];

export default function TablePager({ pager, noun = "rows", overall, className = "" }) {
  const { total, from, to, page, pages, size, setPage, setSize } = pager;
  const filteredNote = overall !== undefined && overall !== total ? ` (${overall} in total)` : "";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-xs text-gray-500 ${className}`}>
      <span>{total ? `${from}-${to} of ${total} ${noun}${filteredNote}` : `0 of ${overall ?? 0} ${noun}`}</span>
      <div className="flex items-center gap-3">
        <select value={size} onChange={(event) => setSize(Number(event.target.value))} aria-label="Rows per page"
          className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
          {SIZES.map((n) => <option key={n} value={n}>{n} per page</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}
            className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-accent disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span>Page {page + 1} of {pages}</span>
          <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}
            className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 hover:text-accent disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}