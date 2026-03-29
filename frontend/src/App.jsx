import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}
