import { useNavigate, useLocation } from "react-router-dom";
import { Home, BarChart3, Trophy, Calendar, User, GitCompare, ListChecks } from "lucide-react";
import "./Layout.css";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/dashboard", icon: Home, label: "Panel" },
    { path: "/analytics", icon: BarChart3, label: "Analizuj" },
    { path: "/best-efforts", icon: Trophy, label: "Best Efforts" },
    { path: "/training-plan", icon: Calendar, label: "Plan treningowy" },
    { path: "/training-plans", icon: ListChecks, label: "Moje plany" },
    { path: "/compare", icon: GitCompare, label: "Porównaj" },
    { path: "/account", icon: User, label: "Moje konto" },
  ];

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="nav-header">
          <h2>Training App</h2>
        </div>
        <div className="nav-items">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = 
              location.pathname === item.path ||
              (item.path === "/training-plans" && location.pathname.startsWith("/training-plans"));
            return (
              <button
                key={item.path}
                className={`nav-item ${isActive ? "active" : ""}`}
                onClick={() => navigate(item.path)}
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}

export default Layout;
