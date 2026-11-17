import { focusMenuItem, navigateMenu } from "../lib/menuNavigation";
import { useState, useRef, useEffect, useId } from "react";
import { Settings, ShieldCheck, LogOut, ChevronUp, ChevronDown, UserCircle2 } from "lucide-react";

const MENU_ITEMS = [{ key: "settings", label: "User settings", icon: Settings }];

export default function ProfileMenu({ name = "User Name", email = "info@pulsefx.com", onSelect, collapsible = false, showSettings = true, showAdmin = false, disabled = false }) {
  const wide = collapsible ? "hidden lg:block" : "";
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const trigger = useRef(null);
  const menuId = useId();

  const openLast = useRef(false);
  useEffect(() => {
    if (open) focusMenuItem(ref.current, openLast.current);
  }, [open]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      {/* Popover card */}
      {open && (
        <div
          role="menu" id={menuId} aria-label="Account" onKeyDown={event => navigateMenu(event, trigger.current, () => setOpen(false))}
          className={`absolute bottom-full left-0 mb-2 p-1.5 ${collapsible ? "w-44 lg:w-auto lg:right-0" : "right-0"} flex flex-col gap-0.5 rounded-lg
                     bg-[#0b1d33] border border-white/10
                     shadow-[0_8px_24px_rgba(0,0,0,0.35)]`}
        >
          {showSettings && MENU_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelect?.(key);
                setOpen(false);
              }}
              role="menuitem" tabIndex={-1}
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-white/65
                         hover:bg-white/10 hover:text-white transition-colors text-left"
            >
              <Icon className="w-4 h-4 shrink-0 group-hover:text-brand" />
              {label}
            </button>
          ))}

          {showAdmin && <button type="button" role="menuitem" tabIndex={-1} disabled={disabled}
            onClick={() => { onSelect?.("admin"); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-white/65 hover:bg-white/10 hover:text-white text-left">
            <ShieldCheck className="w-4 h-4 shrink-0" />Administration
          </button>}
          {(showSettings || showAdmin) && <div className="h-px bg-white/10 my-1" />}

          <button
            type="button"
            onClick={() => {
              onSelect?.("logout");
              setOpen(false);
            }}
            role="menuitem" tabIndex={-1}
            disabled={disabled}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-danger-dark
                       hover:bg-white/10 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Logout
          </button>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { openLast.current = false; setOpen((o) => !o); }}
        disabled={disabled}
        aria-expanded={open}
        ref={trigger}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onKeyDown={event => { if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); openLast.current = event.key === "ArrowUp"; setOpen(true); } }}
        title={`${name}\n${email}`}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg
                   hover:bg-white/10 transition-colors border-t border-white/10 ${collapsible ? "justify-center lg:justify-start" : ""}`}
      >
        <UserCircle2 className="w-6 h-6 text-white/70 shrink-0" />
        <div className={`flex-1 min-w-0 text-left ${wide}`}>
          <p className="text-sm text-white truncate">{name}</p>
          <p className="text-xs text-white/55 truncate">{email}</p>
        </div>
        {open ? (
          <ChevronDown className={`w-4 h-4 text-white/55 shrink-0 ${wide}`} />
        ) : (
          <ChevronUp className={`w-4 h-4 text-white/55 shrink-0 ${wide}`} />
        )}
      </button>
    </div>
  );
}
