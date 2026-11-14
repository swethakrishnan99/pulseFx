export default function ClearFiltersButton({ onClick, className = "" }) {
  return <button type="button" onClick={onClick} className={`text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}>Clear filters</button>;
}
