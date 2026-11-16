import { Search } from "lucide-react";

export default function SearchFilter({ id, value, onChange, placeholder, className = "" }) {
  return <div className={`filter-search ${className}`}>
    <label htmlFor={id} className="mb-1.5 block text-xs text-gray-500">Search</label>
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input id={id} type="search" value={value} onChange={onChange} placeholder={placeholder}
        className="filter-control w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-100" />
    </div>
  </div>;
}
