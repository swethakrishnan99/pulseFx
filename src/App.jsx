import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./AppRoutes";
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";
export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <AppRoutes />
    </BrowserRouter>
  );
}