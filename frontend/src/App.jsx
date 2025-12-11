import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { FilterProvider } from "./context/FilterContext";
import { authAPI } from "./services/api";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AccountPage from "./pages/AccountPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import BestEffortsPage from "./pages/BestEffortsPage";
import TrainingPlanPage from "./pages/TrainingPlanPage";
import MyTrainingPlansPage from "./pages/MyTrainingPlansPage";
import CreateTrainingPlanPage from "./pages/CreateTrainingPlanPage";
import TrainingPlanDetailPage from "./pages/TrainingPlanDetailPage";
import ComparePage from "./pages/ComparePage";

function App() {
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await authAPI.initAuth();
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        setAuthInitialized(true);
      }
    };
    init();
  }, []);

  if (!authInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Ładowanie...
      </div>
    );
  }

  return (
    <Router>
      <FilterProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/best-efforts" element={<BestEffortsPage />} />
          <Route path="/training-plan" element={<TrainingPlanPage />} />
          <Route path="/training-plans" element={<MyTrainingPlansPage />} />
          <Route path="/training-plans/create" element={<CreateTrainingPlanPage />} />
          <Route path="/training-plans/:planId" element={<TrainingPlanDetailPage />} />
          <Route path="/compare" element={<ComparePage />} />
        </Routes>
      </FilterProvider>
    </Router>
  );
}

export default App;
