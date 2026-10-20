import { useEffect, useState } from "react";
import ProfileTab from "./ProfileTab";
import SecurityTab from "./SecurityTab";
import NotificationsTab from "./NotificationsTab";

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "security", label: "Security" },
  { key: "notifications", label: "Notifications" },
];

const USER = { name: "User Name", username: "User Name", email: "info@pulsefx.com", account: "Test Company Inc" };

/** Account page with Profile, Security and Notifications tabs.
 *  `tab` sets the tab to open when arriving from the profile menu. */
export default function Account({ tab: initialTab = "profile" }) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);

  const initials = USER.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex-1 bg-gray-50 p-4 pt-[72px] md:p-6 min-w-0">
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-14 h-14 rounded-full border-2 border-navy text-navy flex items-center justify-center text-lg font-semibold shrink-0"
          aria-hidden="true"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900 truncate">{USER.name}</h1>
          <p className="text-sm text-gray-500 truncate">{USER.account}</p>
        </div>
      </div>

      <div role="tablist" aria-label="Account sections" className="flex gap-1 border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`acct-tab-${t.key}`}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            aria-controls={`acct-panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`text-sm px-4 py-2 -mb-px border-b-2 whitespace-nowrap transition-colors ${
              tab === t.key ? "border-accent text-accent font-medium" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id={`acct-panel-${tab}`} role="tabpanel" aria-labelledby={`acct-tab-${tab}`} className={tab === "profile" ? "max-w-3xl" : "max-w-5xl"}>
        {tab === "profile" && <ProfileTab username={USER.username} email={USER.email} />}
        {tab === "security" && <SecurityTab />}
        {tab === "notifications" && <NotificationsTab />}
      </div>
    </div>
  );
}