import {
  LayoutDashboard,
  Send,
  Users,
  Building2,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import BrandLogo from "../assets/logo-pulsefx-horizontal-white.png";
import ProfileMenu from "./ProfileMenu";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "send-payment", label: "Send Payment", icon: Send },
  { key: "beneficiaries", label: "Beneficiaries", icon: Users },
  { key: "holding-accounts", label: "Holding Accounts", icon: Building2 },
  { key: "reports", label: "Reports", icon: BarChart3 },
];

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="w-[200px] shrink-0 bg-navy flex flex-col p-3.5">
      <div className="flex items-center gap-2 px-1.5 mb-7">
        <img src={BrandLogo} alt="PulseFX" className="w-auto h-9 mt-5" />
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              className={`flex items-center gap-2.5 text-sm px-2.5 py-2 rounded-lg text-left transition-colors ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/65 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1">
        <button className="flex items-center gap-2.5 text-sm px-2.5 py-2 rounded-lg text-white/55 hover:text-white hover:bg-white/10">
          <HelpCircle className="w-4 h-4" />
          Help
        </button>

        <ProfileMenu
          name="User Name"
          email="info@pulsefx.com"
          onSelect={(key) => {
            // wire these up to real routes/actions later
            console.log("profile menu:", key);
          }}
        />
      </div>
    </aside>
  );
}