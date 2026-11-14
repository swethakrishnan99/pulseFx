import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** An icon action with a tooltip that escapes scrollable table boundaries. */
export default function ActionButton({ label, tooltip = label, disabled = false, className = "", onClick, children }) {
  const anchor = useRef(null);
  const tooltipId = useId();
  const [position, setPosition] = useState(null);

  function show() {
    const rect = anchor.current.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 24);
    const above = rect.top >= 90;
    setPosition({
      left: Math.max(width / 2 + 12, Math.min(rect.left + rect.width / 2, window.innerWidth - width / 2 - 12)),
      top: above ? rect.top - 8 : rect.bottom + 8,
      maxWidth: width,
      transform: above ? "translate(-50%, -100%)" : "translateX(-50%)",
    });
  }

  useEffect(() => {
    if (!position) return;
    const close = () => setPosition(null);
    const onKey = (event) => { if (event.key === "Escape") close(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [position]);

  return <>
    <span ref={anchor} className="inline-flex" onPointerEnter={show}
      onPointerLeave={() => { if (!anchor.current.contains(document.activeElement)) setPosition(null); }}
      onFocus={show} onBlur={() => setPosition(null)}
      tabIndex={disabled ? 0 : undefined} aria-label={disabled ? label : undefined}
      aria-disabled={disabled || undefined} aria-describedby={disabled && position ? tooltipId : undefined}>
      <button type="button" disabled={disabled} aria-label={label}
        aria-describedby={position ? tooltipId : undefined}
        className={`${className} disabled:pointer-events-none`}
        onClick={(event) => { setPosition(null); onClick?.(event); }}>
        {children}
      </button>
    </span>
    {position && createPortal(<span id={tooltipId} role="tooltip" style={position}
      className="fixed z-[100] w-max rounded-md bg-navy px-3 py-2 text-xs leading-snug text-white shadow-lg pointer-events-none break-words">
      {tooltip}
    </span>, document.body)}
  </>;
}
