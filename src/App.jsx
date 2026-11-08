import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import SendPayment from "./components/SendPayment";
import Beneficiaries from "./components/Beneficiaries";
import HoldingAccounts from "./components/HoldingAccounts";
import Reports from "./components/Reports";
import Account from "./components/Account";
import HelpSupport from "./components/HelpSupport";
import Login from "./components/Login";
import ForwardsDrawdown from "./components/Forwardsdrawdown";
import TradeFinance from "./components/Tradefinance";
import PartnerPortal from "./components/PartnerPortal";
import PartnerSession from "./components/PartnerSession";



export default function App() {
  const [screen, setScreen] = useState(() => {
    if (window.location.hash === "#partner") return "partner";
    if (window.location.hash === "#partner-demo") return "partner-demo";
    return "login";
  });

  function returnToLogin() {
    window.location.hash = "";
    setScreen("login");
  }

  if (screen === "partner") return <PartnerSession onExit={returnToLogin} />;
  if (screen === "partner-demo") return <PartnerPortal onExit={returnToLogin} />;
  if (screen === "login") {
    return <Login onSignIn={(role) => {
      if (role === "partner" || role === "partner-demo") {
        window.location.hash = role;
        setScreen(role);
      } else {
        setScreen("dashboard");
      }
    }} />;
  }

  return (
    <div className="h-screen w-full bg-white bg-center bg-no-repeat">
    <div className="flex min-h-screen">
      <Sidebar active={screen} onNavigate={setScreen} />
      {screen === "dashboard" && <Dashboard onNavigate={setScreen} />}
      {screen === "send-payment" && <SendPayment onNavigate={setScreen} />}
      {screen === "beneficiaries" && <Beneficiaries onNavigate={setScreen} />}
      {screen === "holding-accounts" && <HoldingAccounts onNavigate={setScreen} />}
      {screen === "reports" && <Reports onNavigate={setScreen} />}
      {(screen === "profile" || screen === "security") && <Account tab={screen} />}
      {screen === "forwards-drawdown" && <ForwardsDrawdown onNavigate={setScreen} />}
      {screen === "trade-finance" && <TradeFinance onNavigate={setScreen} />}
     {screen === "help" && <HelpSupport />}
    </div>
    </div>
  );
}