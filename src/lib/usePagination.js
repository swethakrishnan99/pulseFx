import { useState } from "react";

// Splits `items` into pages. `resetKey` is any string that changes when the search, filters or sorting
// change, so the table goes back to page 1 without an effect.
export function usePagination(items, resetKey = "") {
  const [size, setSize] = useState(10);
  const [state, setState] = useState({ key: resetKey, page: 0 });
  const requested = state.key === resetKey ? state.page : 0;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = Math.min(requested, pages - 1);
  const start = page * size;
  return {
    rows: items.slice(start, start + size),
    total: items.length, page, pages, size,
    from: items.length ? start + 1 : 0,
    to: Math.min(items.length, start + size),
    setPage: (next) => setState({ key: resetKey, page: next }),
    setSize: (next) => { setSize(next); setState({ key: resetKey, page: 0 }); },
  };
}