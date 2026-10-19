import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Small "?" icon that reveals a plain-language explanation.
 * Works on hover (desktop) AND tap (mobile/touch) since clients
 * may be on either — and closes when you click elsewhere.
 *
 * Usage:
 *   <Tooltip text="See today's exchange rate before committing to anything." />
 */
export default function Tooltip({ text, side = "top" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="text-gray-400 hover:text-accent transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute z-20 w-56 text-xs leading-snug text-white bg-gray-900 rounded-md px-3 py-2 shadow-lg pointer-events-none ${sideClasses[side]}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}