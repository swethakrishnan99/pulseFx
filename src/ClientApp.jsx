import useViewFocus from "./lib/useViewFocus";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import SendPayment from "./components/SendPayment";
import Beneficiaries from "./components/Beneficiaries";
import HoldingAccounts from "./components/HoldingAccounts";
import Reports from "./components/Reports";
import Account from "./components/Account";
import HelpSupport from "./components/HelpSupport";
import ForwardsDrawdown from "./components/Forwardsdrawdown";
import TradeFinance from "./components/Tradefinance";

// The client portal demo. It still switches screens with state and lives under /client.
export default function ClientApp() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState("dashboard");
  useViewFocus(screen);
  return (
    <div className="h-screen w-full bg-white bg-center bg-no-repeat">
    <div className="flex min-h-screen">
      <Sidebar active={screen} onNavigate={setScreen} account={{ onLogout: () => navigate("/") }} />
      <main id="main-content" className="flex min-w-0 flex-1">
      {screen === "dashboard" && <Dashboard onNavigate={setScreen} />}
      {screen === "send-payment" && <SendPayment onNavigate={setScreen} />}
      {screen === "beneficiaries" && <Beneficiaries onNavigate={setScreen} />}
      {screen === "holding-accounts" && <HoldingAccounts onNavigate={setScreen} />}
      {screen === "reports" && <Reports onNavigate={setScreen} />}
      {(screen === "profile" || screen === "security") && <Account tab={screen} />}
      {screen === "forwards-drawdown" && <ForwardsDrawdown onNavigate={setScreen} />}
      {screen === "trade-finance" && <TradeFinance onNavigate={setScreen} />}
      {screen === "help" && <HelpSupport />}
      </main>
    </div>
    </div>
  );
}