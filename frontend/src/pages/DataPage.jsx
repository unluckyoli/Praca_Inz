import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Award, TrendingUp, Activity as ActivityIcon } from "lucide-react";
import Layout from "../components/Layout";
import GlobalFilters from "../components/GlobalFilters";
import ActivityModal from "../components/ActivityModal";
import { useFilters } from "../context/FilterContext";
import { dataAPI, activitiesAPI } from "../services/api";
import "./DataPage.css";

function DataPage() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [longestActivity, setLongestActivity] = useState(null);
  const [hardestActivity, setHardestActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();
  const { activityType, dateRange, metric } = useFilters();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchActivitiesWithFilters();
      fetchFilteredData();
    }
  }, [activityType, dateRange?.start, dateRange?.end, metric, loading]);

  const fetchActivitiesWithFilters = async () => {
    try {
      const params = { limit: 50 };
      
      if (activityType !== "all") {
        params.type = activityType;
      }
      
      if (dateRange.start) {
        params.startDate = dateRange.start.toISOString();
      }
      
      if (dateRange.end) {
        params.endDate = dateRange.end.toISOString();
      }

      const filteredActivities = await activitiesAPI.getActivities(params);
      setActivities(filteredActivities.data.activities || []);
    } catch (error) {
      console.error("Fetch activities error:", error);
    }
  };

  const fetchData = async () => {
    try {
      const [statsRes, activitiesRes] = await Promise.all([
        dataAPI.getUserStats(),
        activitiesAPI.getActivities({ limit: 50 }),
      ]);

      setStats(statsRes.data.stats);

      const params = { limit: 50 };
      if (activityType !== "all") {
        params.type = activityType;
      }
      if (dateRange.start) {
        params.startDate = dateRange.start.toISOString();
      }
      if (dateRange.end) {
        params.endDate = dateRange.end.toISOString();
      }

      const filteredActivities = await activitiesAPI.getActivities(params);
      setActivities(filteredActivities.data.activities || []);

      await fetchFilteredData();
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
      }
      console.error("Fetch data error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredData = async () => {
    try {
      // Przygotuj parametry filtrów
      const params = {};
      
      if (activityType !== "all") {
        params.type = activityType;
      }
      
      if (dateRange.start) {
        params.startDate = dateRange.start.toISOString();
      }
      
      if (dateRange.end) {
        params.endDate = dateRange.end.toISOString();
      }

      const [longestRes, hardestRes] = await Promise.all([
        dataAPI.getLongestActivity(metric, params),
        dataAPI.getHardestActivity(params),
      ]);

      setLongestActivity(longestRes.data.activity);
      setHardestActivity(hardestRes.data.activity);
    } catch (error) {
      console.error("Fetch filtered data error:", error);
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

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie danych...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="data-page">
        <div className="page-header">
          <h1>Szczegółowe dane</h1>
        </div>

        <GlobalFilters />

        <div className="highlights-section">
          <div
            className="highlight-card clickable"
            onClick={() =>
              longestActivity && handleActivityClick(longestActivity.id)
            }
          >
            <div className="highlight-icon">
              <Award size={40} />
            </div>
            <h3>
              {metric === "distance" && "Najdłuższy dystans"}
              {metric === "duration" && "Najdłuższy czas"}
              {metric === "elevationGain" && "Największe przewyższenie"}
            </h3>
            {longestActivity ? (
              <>
                <p className="highlight-value">
                  {metric === "distance" &&
                    `${(longestActivity.distance / 1000).toFixed(2)} km`}
                  {metric === "duration" &&
                    formatDuration(longestActivity.duration)}
                  {metric === "elevationGain" &&
                    `${longestActivity.elevationGain} m`}
                </p>
                <p className="highlight-detail">{longestActivity.name}</p>
                <p className="highlight-date">
                  {new Date(longestActivity.startDate).toLocaleDateString(
                    "pl-PL",
                  )}
                </p>
              </>
            ) : (
              <p className="no-data-text">Brak danych</p>
            )}
          </div>

          <div
            className="highlight-card clickable"
            onClick={() =>
              hardestActivity && handleActivityClick(hardestActivity.id)
            }
          >
            <div className="highlight-icon">
              <ActivityIcon size={40} />
            </div>
            <h3>Najtrudniejszy trening</h3>
            {hardestActivity ? (
              <>
                <p className="highlight-value">
                  {hardestActivity.averageHeartRate} bpm
                </p>
                <p className="highlight-detail">{hardestActivity.name}</p>
                <p className="highlight-date">
                  {new Date(hardestActivity.startDate).toLocaleDateString(
                    "pl-PL",
                  )}
                </p>
              </>
            ) : (
              <p className="no-data-text">Brak danych</p>
            )}
          </div>

          <div className="highlight-card">
            <div className="highlight-icon">
              <TrendingUp size={40} />
            </div>
            <h3>Łączna statystyka</h3>
            {stats ? (
              <>
                <p className="highlight-value">{stats.totalActivities}</p>
                <p className="highlight-detail">Treningów</p>
                <p className="highlight-date">
                  {(stats.totalDistance / 1000).toFixed(0)} km łącznie
                </p>
              </>
            ) : (
              <p className="no-data-text">Brak danych</p>
            )}
          </div>
        </div>

        <div className="activities-list-section">
          <h2>Ostatnie aktywności</h2>
          <div className="activities-table">
            {activities.slice(0, 20).map((activity) => (
              <div
                key={activity.id}
                className="activity-row"
                onClick={() => handleActivityClick(activity.id)}
              >
                <div className="activity-info">
                  <span className="activity-type">{activity.type}</span>
                  <span className="activity-name">
                    {activity.name || "Trening"}
                  </span>
                  <span className="activity-date">
                    {new Date(activity.startDate).toLocaleDateString("pl-PL")}
                  </span>
                </div>
                <div className="activity-stats">
                  <span>{(activity.distance / 1000).toFixed(2)} km</span>
                  <span>{formatDuration(activity.duration)}</span>
                  {activity.averageHeartRate && (
                    <span>{activity.averageHeartRate} bpm</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showModal && (
          <ActivityModal
            activity={selectedActivity}
            onClose={() => {
              setShowModal(false);
              setSelectedActivity(null);
            }}
          />
        )}
      </div>
    </Layout>
  );
}

export default DataPage;
