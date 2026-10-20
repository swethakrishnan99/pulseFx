import { useEffect, useState } from "react";
import {
  Menu,
  X,
  LayoutDashboard,
  Send,
  Users,
  Building2,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import ProfileMenu from "./ProfileMenu";
import PulseMark from "./PulseMark";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "send-payment", label: "Send Payment", icon: Send },
  { key: "beneficiaries", label: "Beneficiaries", icon: Users },
  { key: "holding-accounts", label: "Holding Accounts", icon: Building2 },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

function SidebarContent({ active, onNavigate, collapsible = false }) {
  // collapsible: on tablet widths show icons only; labels return at laptop width
  const lbl = collapsible ? "hidden lg:inline" : "";
  const center = collapsible ? "justify-center lg:justify-start" : "";
  return (
    <>
      <div className={`flex items-center gap-2 px-1.5 mb-7 ${center}`}>
        <PulseMark className="w-8 h-8" />
        <span className={`text-white text-lg font-medium tracking-tight ${lbl}`}>
          PulseFX
        </span>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              title={label}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-2.5 text-sm px-2.5 py-2.5 lg:py-2 rounded-lg ${center} text-left transition-colors ${
                isActive
                  ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-brand)]"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-brand" : ""}`} />
              <span className={lbl}>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <button
          type="button"
          onClick={() => onNavigate("help")}
          title="Help & support"
          aria-label="Help & support"
          aria-current={active === "help" ? "page" : undefined}
          className={`flex items-center gap-2.5 text-sm px-2.5 py-2 rounded-lg transition-colors ${center} ${
            active === "help"
              ? "bg-white/10 text-white shadow-[inset_3px_0_0_var(--color-brand)]"
              : "text-white/55 hover:text-white hover:bg-white/10"
          }`}
        >
          <HelpCircle className={`w-4 h-4 ${active === "help" ? "text-brand" : ""}`} />
          <span className={lbl}>Help &amp; support</span>
        </button>

        <ProfileMenu
          collapsible={collapsible}
          name="User Name"
          email="info@pulsefx.com"
          onSelect={(key) => {
            if (key === "settings") onNavigate("profile"); // opens the Account page (tabs: Profile, Security, Notifications)
            else if (key === "logout") onNavigate("login");
          }}
        />
      </div>
    </>
  );
}

export default function Sidebar({ active, onNavigate }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (key) => {
    setOpen(false);
    onNavigate(key);
  };

  return (
    <>
      {/* Tablet: icon-only sidebar. Laptop and larger: full sidebar */}
      <aside className="hidden md:flex w-[72px] lg:w-[200px] shrink-0 bg-navy flex-col p-2.5 lg:p-3.5 sticky top-0 h-screen self-start z-20">
        <SidebarContent active={active} onNavigate={onNavigate} collapsible />
      </aside>

      {/* Phone: top bar with a slide-in menu */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 bg-navy flex items-center gap-3 px-3.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="p-2 -ml-2 rounded-lg text-white/80 hover:bg-white/10"
        >
          <Menu className="w-5 h-5" />
        </button>
        <PulseMark className="w-7 h-7" />
        <span className="text-white text-base font-medium tracking-tight">PulseFX</span>
      </header>

      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside
            className="pfx-drawer absolute inset-y-0 left-0 w-[260px] max-w-[85vw] bg-navy flex flex-col p-3.5"
            role="dialog"
            aria-label="Main menu"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-3 right-3 p-2 rounded-lg text-white/70 hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent active={active} onNavigate={go} />
          </aside>
        </div>
      )}
    </>
  );
}