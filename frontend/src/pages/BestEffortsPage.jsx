import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Calendar } from "lucide-react";
import Layout from "../components/Layout";
import GlobalFilters from "../components/GlobalFilters";
import ActivityModal from "../components/ActivityModal";
import { useFilters } from "../context/FilterContext";
import { dataAPI, activitiesAPI } from "../services/api";
import "./BestEffortsPage.css";

function BestEffortsPage() {
  const [bestEfforts, setBestEfforts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filling, setFilling] = useState(false);
  const [fillLimit, setFillLimit] = useState(200);
  const [fillMsg, setFillMsg] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const navigate = useNavigate();
  const { activityType, dateRange } = useFilters();

  useEffect(() => {
    fetchBestEfforts();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchBestEfforts();
    }
  }, [activityType, dateRange?.start, dateRange?.end, loading]);

  const fetchBestEfforts = async () => {
    try {
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

      const response = await dataAPI.getBestEfforts(params);
      setBestEfforts(response.data.bestEfforts || []);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
      }
      console.error("Fetch best efforts error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fillDetailsForPeriod = async () => {
    try {
      setFilling(true);
      setFillMsg(null);

      const payload = {
        limit: Math.max(1, Math.min(fillLimit, 300)),
      };
      if (activityType !== "all") payload.type = activityType;
      if (dateRange.start) payload.startDate = dateRange.start.toISOString();
      if (dateRange.end) payload.endDate = dateRange.end.toISOString();

      if (!payload.startDate || !payload.endDate) {
        setFillMsg("Ustaw zakres dat (OD/DO), aby uzupełnić rekordy dla okresu.");
        return;
      }

      const res = await activitiesAPI.batchFetchDetailsRange(payload);
      setFillMsg(
        `Uzupełniono szczegóły dla okresu: ${res.data.updated}/${res.data.processed} (błędy: ${res.data.errors})` +
          (res.data.rateLimited ? " — trafiono limit API Strava, spróbuj później." : ""),
      );

      await fetchBestEfforts();
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
      }
      setFillMsg(error.response?.data?.error || "Nie udało się uzupełnić rekordów dla okresu");
    } finally {
      setFilling(false);
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

  const handleRefreshActivity = async () => {
    if (selectedActivity) {
      try {
        const res = await activitiesAPI.getActivityById(selectedActivity.id);
        setSelectedActivity(res.data.activity);
      } catch (error) {
        console.error("Refresh activity error:", error);
      }
    }
  };

  const formatEffortTime = (seconds) => {
    if (seconds == null) return "-";
    const total = Math.max(0, Math.floor(seconds));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
    return `${s}s`;
  };

  const formatPace = (seconds, meters) => {
    if (!meters || meters === 0) return '-';
    const paceSecondsPerKm = (seconds / meters) * 1000;
    const mins = Math.floor(paceSecondsPerKm / 60);
    const secs = Math.floor(paceSecondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/km`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie rekordów...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="best-efforts-page">
        <div className="page-header">
          <div className="header-title">
            <Trophy size={32} />
            <h1>Najlepsze Wyniki</h1>
          </div>
          <p className="page-description">
            Twoje rekordy na różnych dystansach ze wszystkich aktywności
          </p>
        </div>

        <GlobalFilters showMetric={false} />

        <div className="fill-card">
          <div className="fill-top">
            <div className="fill-title">Uzupełnij rekordy dla okresu</div>
            <div className="fill-sub">
              Pobieramy szczegóły i streamy ze Stravy dla aktywności w wybranym okresie (limit API jest możliwy).
            </div>
          </div>

          <div className="fill-controls">
            <div className="fill-field">
              <div className="fill-label">Max aktywności</div>
              <input
                className="fill-input"
                type="number"
                min="1"
                max="300"
                value={fillLimit}
                onChange={(e) => setFillLimit(Number(e.target.value))}
              />
            </div>

            <button className="fill-btn" disabled={filling} onClick={fillDetailsForPeriod}>
              {filling ? "Uzupełniam…" : "Uzupełnij"}
            </button>
          </div>

          {fillMsg && (
            <div className={`fill-msg ${fillMsg.includes("limit") ? "warn" : "ok"}`}>
              {fillMsg}
            </div>
          )}
        </div>

        {bestEfforts.length === 0 ? (
          <div className="no-data-container">
            <Trophy size={64} className="no-data-icon" />
            <h3>Brak danych o najlepszych wynikach</h3>
            <p>
              Synchronizuj aktywności ze Stravą, aby zobaczyć swoje rekordy na różnych dystansach
            </p>
          </div>
        ) : (
          <div className="efforts-grid">
            {bestEfforts.map((effort, index) => (
              <div 
                key={index} 
                className="effort-record-card"
                onClick={() => effort.activityId && handleActivityClick(effort.activityId)}
              >
                <div className="effort-header">
                  <Trophy className="trophy-icon" size={24} />
                  <h3 className="effort-name">{effort.name}</h3>
                </div>
                
                <div className="effort-main">
                  <div className="effort-time-large">
                    {formatEffortTime(effort.elapsed_time)}
                  </div>
                  <div className="effort-pace-large">
                    {formatPace(effort.elapsed_time, effort.distance)}
                  </div>
                </div>

                <div className="effort-details">
                  <div className="effort-distance-info">
                    {(effort.distance / 1000).toFixed(2)} km
                  </div>
                  {effort.moving_time && effort.moving_time !== effort.elapsed_time && (
                    <div className="effort-moving-time">
                      Czas ruchu: {formatEffortTime(effort.moving_time)}
                    </div>
                  )}
                </div>

                {effort.activityName && (
                  <div className="effort-activity-info">
                    <Calendar size={14} />
                    <span className="activity-name">{effort.activityName}</span>
                  </div>
                )}

                {effort.activityDate && (
                  <div className="effort-date">
                    {new Date(effort.activityDate).toLocaleDateString("pl-PL", {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showModal && (
          <ActivityModal
            activity={selectedActivity}
            onRefresh={handleRefreshActivity}
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

export default BestEffortsPage;
