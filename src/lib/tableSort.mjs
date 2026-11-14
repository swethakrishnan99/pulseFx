const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export function sortTableRows(rows, sort, columns = {}) {
  if (!sort?.key) return [...rows];
  const definition = columns[sort.key];
  const column = typeof definition === "function" ? { value: definition } : definition || {};
  const get = column.value || ((row) => row[sort.key]);
  const normalize = (value) => {
    if (value === null || value === undefined || value === "") return null;
    if (column.type === "date") { const time = Date.parse(value); return Number.isFinite(time) ? time : null; }
    if (column.type === "number") { const number = Number(value); return Number.isFinite(number) ? number : null; }
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    if (typeof value === "boolean") return Number(value);
    return String(value);
  };
  const direction = sort.dir === "desc" ? -1 : 1;
  return rows.map((row, index) => ({ row, index, value: normalize(get(row)) })).sort((a, b) => {
    if (a.value === null || b.value === null) return a.value === b.value ? a.index - b.index : a.value === null ? 1 : -1;
    const comparison = typeof a.value === "number" && typeof b.value === "number" ? a.value - b.value : collator.compare(String(a.value), String(b.value));
    return comparison * direction || a.index - b.index;
  }).map(({ row }) => row);
}
