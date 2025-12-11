import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw, LogOut } from "lucide-react";
import Layout from "../components/Layout";
import GlobalFilters from "../components/GlobalFilters";
import ActivityModal from "../components/ActivityModal";
import { useFilters } from "../context/FilterContext";
import { useAuth } from "../hooks/useAuth";
import { authAPI, activitiesAPI } from "../services/api";
import "./DashboardPage.css";

function DashboardPage() {
  const { isLoading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [activities, setActivities] = useState([]);
  const [filteredStats, setFilteredStats] = useState({
    totalActivities: 0,
    totalDistance: 0,
    totalDuration: 0,
    totalElevationGain: 0,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();
  const { activityType, dateRange } = useFilters();
  const params = new URLSearchParams(window.location.search);

if (params.get("auth") === "success") {
  const access = params.get("access");
  const refresh = params.get("refresh");

  if (access && refresh) {
      localStorage.setItem("accessToken", access);
      localStorage.setItem("refreshToken", refresh);
      window.location.replace("/dashboard");
  }
}

  useEffect(() => {
    fetchUserData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchActivities();
    }
  }, [activityType, dateRange?.start, dateRange?.end, loading]);

  const fetchUserData = async () => {
    try {
      const { data } = await authAPI.getCurrentUser();
      setUser(data.user);

      await fetchActivities();
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const params = { limit: 1000 }; 

      if (activityType !== "all") {
        params.type = activityType;
      }

      if (dateRange.start) {
        params.startDate = dateRange.start.toISOString();
      }

      if (dateRange.end) {
        params.endDate = dateRange.end.toISOString();
      }

      const activitiesData = await activitiesAPI.getActivities(params);
      const fetchedActivities = activitiesData.data.activities || [];
      
      setActivities(fetchedActivities.slice(0, 50));

      const stats = {
        totalActivities: fetchedActivities.length,
        totalDistance: fetchedActivities.reduce((sum, a) => sum + (a.distance || 0), 0),
        totalDuration: fetchedActivities.reduce((sum, a) => sum + (a.duration || 0), 0),
        totalElevationGain: fetchedActivities.reduce((sum, a) => sum + (a.elevationGain || 0), 0),
      };
      setFilteredStats(stats);
    } catch (error) {
      console.error("Fetch activities error:", error);
      setFilteredStats({
        totalActivities: 0,
        totalDistance: 0,
        totalDuration: 0,
        totalElevationGain: 0,
      });
    }
  };

  const handleSync = async () => {
    if (!user?.hasStravaData) {
      const confirmLink = confirm(
        "Aby synchronizować dane ze Stravą, musisz najpierw połączyć swoje konto.\n\n" +
          "Czy chcesz przejść do ustawień konta?",
      );
      if (confirmLink) {
        navigate("/account");
      }
      return;
    }

    setSyncing(true);
    try {
      const response = await activitiesAPI.syncActivities();
      
      const detailsResponse = await activitiesAPI.syncBestEfforts();
      
      await fetchUserData();
      
      let message = "Dane zsynchronizowane pomyślnie!";
      if (response.data.newActivitiesCount > 0) {
        message += `\n\nNowe aktywności: ${response.data.newActivitiesCount}`;
      }
      if (detailsResponse.data.updated > 0) {
        message += `\nZaktualizowano szczegóły: ${detailsResponse.data.updated} aktywności`;
      }
      if (detailsResponse.data.lapsUpdated > 0) {
        message += `\nZ odcinkami (laps): ${detailsResponse.data.lapsUpdated}`;
      }
      
      alert(message);
    } catch (error) {
      console.error("Sync error:", error);
      
      if (error.response?.status === 429) {
        const resetDate = error.response.data?.rateLimitReset;
        let message = "Osiągnięto limit zapytań do Strava API.\n\n";
        
        if (resetDate) {
          const resetTime = new Date(resetDate);
          const now = new Date();
          const minutesUntilReset = Math.ceil((resetTime - now) / 60000);
          
          if (minutesUntilReset > 0) {
            message += `Limit zostanie zresetowany za około ${minutesUntilReset} minut.\n\n`;
          }
        }
        
        message += "Strava API pozwala na:\n" +
                   "• 100 zapytań na 15 minut\n" +
                   "• 1000 zapytań dziennie\n\n" +
                   "Spróbuj ponownie później.";
        
        alert(message);
      } else if (error.response?.status === 401 || error.response?.data?.requiresStravaLink) {
        await fetchUserData();
        
        const confirmLink = confirm(
          "Twoje połączenie ze Stravą wygasło i wymaga ponownej autoryzacji.\n\n" +
            "Czy chcesz przejść do ustawień konta, aby połączyć się ponownie?",
        );
        if (confirmLink) {
          navigate("/account");
        }
      } else {
        alert(
          "Błąd podczas synchronizacji danych: " +
            (error.response?.data?.error || error.message),
        );
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleActivityClick = async (activityId) => {
    try {
      const res = await activitiesAPI.getActivityById(activityId);
      setSelectedActivity(res.data.activity);
      setShowModal(true);
    } catch (error) {
      console.error("Fetch activity details error:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="dashboard-page">
        <div className="dashboard-header">
          <div>
            <h1>Panel główny</h1>
            <p className="user-email">
              {user?.email}
              {user?.hasStravaData && (
                <span
                  style={{
                    marginLeft: "10px",
                    color: "#fc5200",
                    fontSize: "0.9em",
                  }}
                >
                  Połączono ze Stravą
                </span>
              )}
            </p>
          </div>
          <div className="header-actions">
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={syncing}
              title="Synchronizuj aktywności, Best Efforts i Laps"
            >
              <RefreshCw size={20} className={syncing ? "spinning" : ""} />
              {syncing ? "Synchronizacja..." : "Synchronizuj dane"}
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              <LogOut size={20} />
              Wyloguj
            </button>
          </div>
        </div>

        <GlobalFilters showMetric={false} />

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Łączna liczba treningów</h3>
            <p className="stat-value">{filteredStats?.totalActivities || 0}</p>
          </div>
          <div className="stat-card">
            <h3>Całkowity dystans</h3>
            <p className="stat-value">
              {((filteredStats?.totalDistance || 0) / 1000).toFixed(1)} km
            </p>
          </div>
          <div className="stat-card">
            <h3>Całkowity czas</h3>
            <p className="stat-value">
              {Math.floor((filteredStats?.totalDuration || 0) / 3600)} godz.{" "}
              {Math.floor(((filteredStats?.totalDuration || 0) % 3600) / 60)} min
            </p>
          </div>
          <div className="stat-card">
            <h3>Suma podejść</h3>
            <p className="stat-value">
              {(filteredStats?.totalElevationGain || 0).toFixed(0)} m
            </p>
          </div>
        </div>

        <div className="recent-activities">
          <h2>Ostatnie aktywności</h2>
          {activities.length === 0 ? (
            <p className="no-data">
              Brak aktywności. Kliknij "Synchronizuj dane" aby załadować
              treningi.
            </p>
          ) : (
            <div className="activities-list">
              {activities.map((activity) => (
                <div 
                  key={activity.id} 
                  className="activity-item"
                  onClick={() => handleActivityClick(activity.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="activity-info">
                    <h4>{activity.name}</h4>
                    <p className="activity-type">{activity.type}</p>
                    <p className="activity-date">
                      {new Date(activity.startDate).toLocaleDateString("pl-PL")}
                    </p>
                  </div>
                  <div className="activity-stats">
                    <div className="activity-stat">
                      <span className="label">Dystans</span>
                      <span className="value">
                        {(activity.distance / 1000).toFixed(2)} km
                      </span>
                    </div>
                    <div className="activity-stat">
                      <span className="label">Czas</span>
                      <span className="value">
                        {Math.floor(activity.duration / 60)} min
                      </span>
                    </div>
                    {activity.averageHeartRate && (
                      <div className="activity-stat">
                        <span className="label">Śr. tętno</span>
                        <span className="value">
                          {activity.averageHeartRate} bpm
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showModal && selectedActivity && (
          <ActivityModal
            activity={selectedActivity}
            onClose={() => setShowModal(false)}
          />
        )}
      </div>
    </Layout>
  );
}

export default DashboardPage;
