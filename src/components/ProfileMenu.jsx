import { useState, useRef, useEffect } from "react";
import { User, Shield, LogOut, ChevronUp, ChevronDown, UserCircle2 } from "lucide-react";

const MENU_ITEMS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Security", icon: Shield },
];

export default function ProfileMenu({ name = "User Name", email = "info@pulsefx.com", onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Popover card */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 right-0 mb-2 p-1.5 flex flex-col gap-0.5 rounded-lg
                     bg-[#0b1d33] border border-white/10
                     shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        >
          {MENU_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onSelect?.(key);
                setOpen(false);
              }}
              role="menuitem"
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-white/65
                         hover:bg-white/10 hover:text-white transition-colors text-left"
            >
              <Icon className="w-4 h-4 shrink-0 group-hover:text-brand" />
              {label}
            </button>
          ))}

          <div className="h-px bg-white/10 my-1" />

          <button
            type="button"
            onClick={() => {
              onSelect?.("logout");
              setOpen(false);
            }}
            role="menuitem"
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
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg
                   hover:bg-white/10 transition-colors border-t border-white/10"
      >
        <UserCircle2 className="w-6 h-6 text-white/70 shrink-0" />
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm text-white truncate">{name}</p>
          <p className="text-xs text-white/55 truncate">{email}</p>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-white/55 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-white/55 shrink-0" />
        )}
      </button>
    </div>
  );
}