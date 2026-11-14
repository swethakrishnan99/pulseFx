import { useState } from "react";
import { sortTableRows } from "./tableSort.mjs";

export default function useTableSort(initialSort = null) {
  const [sort, setSort] = useState(initialSort);
  function toggleSort(key) { setSort((previous) => ({ key, dir: previous?.key === key && previous.dir === "asc" ? "desc" : "asc" })); }
  return { sort, toggleSort, sortRows: (rows, columns) => sortTableRows(rows, sort, columns) };
}
