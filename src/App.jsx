import { BrowserRouter } from "react-router-dom";
import KeyboardNavigation from "./components/KeyboardNavigation";
import AppRoutes from "./AppRoutes";
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <KeyboardNavigation />
      <AppRoutes />
    </BrowserRouter>
  );
}