import { useNavigate, useLocation } from "react-router-dom";
import { Home, BarChart3, Database, Calendar, User, GitCompare } from "lucide-react";
import "./Layout.css";

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/dashboard", icon: Home, label: "Panel" },
    { path: "/analytics", icon: BarChart3, label: "Analizuj" },
    { path: "/data", icon: Database, label: "Dane" },
    { path: "/training-plan", icon: Calendar, label: "Plan treningowy" },
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
            const isActive = location.pathname === item.path;
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
