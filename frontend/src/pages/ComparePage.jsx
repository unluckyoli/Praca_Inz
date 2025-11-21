import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { activitiesAPI, analyticsAPI } from "../services/api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import "./ComparePage.css";

function ComparePage() {
  const [activities, setActivities] = useState([]);
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const [comparison, setComparison] = useState(null);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [error, setError] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data } = await activitiesAPI.getActivities({
          page: 1,
          limit: 100,
        });
        setActivities(data.activities || []);
      } catch (err) {
        if (err.response?.status === 401) {
          navigate("/");
        } else {
          setError("Nie udało się pobrać listy aktywności");
        }
      } finally {
        setLoadingActivities(false);
      }
    };

    fetchActivities();
  }, [navigate]);

  const handleCompare = async () => {
    if (!firstId || !secondId || firstId === secondId) {
      setError("Wybierz dwie różne aktywności");
      return;
    }
    setError(null);
    setLoadingCompare(true);
    try {
      const { data } = await analyticsAPI.compareActivities(firstId, secondId);
      setComparison(data);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/");
      } else {
        setError("Nie udało się porównać aktywności");
      }
    } finally {
      setLoadingCompare(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("pl-PL", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds) => {
    if (!seconds && seconds !== 0) return "";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const getDistanceKm = (m) =>
    m != null ? (m / 1000).toFixed(2) : "";

  const formatPaceMinPerKm = (pace) => {
    if (!pace) return "";
    const minutes = Math.floor(pace);
    const seconds = Math.round((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")} min/km`;
  };








  const summaryChartData = useMemo(() => {
    if (!comparison) return [];

    const { first, second } = comparison;

    const distance1 = first.distance ? first.distance / 1000 : null;
    const distance2 = second.distance ? second.distance / 1000 : null;

    const duration1 = first.duration ? first.duration / 60 : null; // minuty
    const duration2 = second.duration ? second.duration / 60 : null;

    const speed1 = first.averageSpeed ? first.averageSpeed * 3.6 : null; // km/h
    const speed2 = second.averageSpeed ? second.averageSpeed * 3.6 : null;

    return [
      {
        metric: "Dystans (km)",
        first: distance1,
        second: distance2,
      },
      {
        metric: "Czas (minuty)",
        first: duration1,
        second: duration2,
      },
      {
        metric: "Śr. prędkość (km/h)",
        first: speed1,
        second: speed2,
      },
    ].filter((row) => row.first != null || row.second != null);
  }, [comparison]);

  





  const pacePerKmChartData = useMemo(() => {
    if (
      !comparison ||
      !comparison.first?.pacePerKm ||
      !comparison.second?.pacePerKm
    ) {
      return [];
    }

    const firstArr = comparison.first.pacePerKm || [];
    const secondArr = comparison.second.pacePerKm || [];
    const maxLen = Math.max(firstArr.length, secondArr.length);

    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        km: i + 1,
        first: firstArr[i] ?? null,
        second: secondArr[i] ?? null,
      });
    }
    return data;
  }, [comparison]);

  

  const renderValueWithHighlight = (v1, v2, higherIsBetter = true, formatter = (v) => v) => {
    if (v1 == null) return <span className="value-muted">brak</span>;
    if (v2 == null) return <span className="value-plain">{formatter(v1)}</span>;

    const firstBetter = higherIsBetter ? v1 > v2 : v1 < v2;

    return (
      <span
        className={
          firstBetter
            ? "value-pill value-pill-better"
            : "value-pill value-pill-normal"
        }
      >
        {formatter(v1)}
      </span>
    );
  };

  return (
    <Layout>
      <div className="compare-page">
        <h1 className="compare-title">Porównaj treningi</h1>

        <div className="compare-card">
          {loadingActivities && <p>Ładowanie listy aktywności...</p>}
          {error && <p className="compare-error">{error}</p>}

          {!loadingActivities && activities.length === 0 && (
            <p>Brak aktywności do porównania. Najpierw zaimportuj dane.</p>
          )}

          {activities.length > 0 && (
            <div className="compare-selects">
              <div className="compare-select">
                <label>Pierwszy trening</label>
                <select
                  value={firstId}
                  onChange={(e) => setFirstId(e.target.value)}
                >
                  <option value="">-- wybierz --</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatDate(a.startDate)} · {a.name || "Trening"} ·{" "}
                      {a.distance
                        ? `${getDistanceKm(a.distance)} km`
                        : "brak dystansu"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="compare-select">
                <label>Drugi trening</label>
                <select
                  value={secondId}
                  onChange={(e) => setSecondId(e.target.value)}
                >
                  <option value="">-- wybierz --</option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatDate(a.startDate)} · {a.name || "Trening"} ·{" "}
                      {a.distance
                        ? `${getDistanceKm(a.distance)} km`
                        : "brak dystansu"}
                    </option>
                  ))}
                </select>
              </div>

                <div className="flex justify-end mt-4">
                  <button className="purple-button" onClick={handleCompare}>Porównaj</button>
                </div>

            </div>
          )}
        </div>

        {comparison && (
          <>
            {/*  PODSUMOWANIA */}
            <div className="compare-summary-row">
              <div className="compare-summary-card">
                <h2>Pierwszy trening</h2>
                <p className="summary-name">
                  {comparison.first.name || "Trening"}
                </p>
                <p className="summary-date">
                  {formatDate(comparison.first.startDate)}
                </p>
              </div>
              <div className="compare-summary-card">
                <h2>Drugi trening</h2>
                <p className="summary-name">
                  {comparison.second.name || "Trening"}
                </p>
                <p className="summary-date">
                  {formatDate(comparison.second.startDate)}
                </p>
              </div>
            </div>

            {/* dystans / czas / prędkosc */}
            {summaryChartData.length > 0 && (
              <div className="compare-chart-card">
                <h3>Porównanie obciążeń (dystans / czas / prędkość)</h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={summaryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="first"
                      name="Pierwszy"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="second"
                      name="Drugi"
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/*  tempo na km  */}
            <div className="compare-chart-card">
              <h3>Tempo na poszczególnych kilometrach</h3>
              {pacePerKmChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={pacePerKmChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="km" label={{ value: "km", position: "insideBottom", offset: -5 }} />
                    <YAxis />
                    <Tooltip
                      formatter={(value) =>
                        value ? formatPaceMinPerKm(value) : "brak danych"
                      }
                      labelFormatter={(label) => `Kilometr ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="first"
                      name="Pierwszy"
                      dot={false}
                      stroke="#4f46e5"
                    />
                    <Line
                      type="monotone"
                      dataKey="second"
                      name="Drugi"
                      dot={false}
                      stroke="#10b981"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="compare-hint">
                  Brak przeliczonych danych per kilometr. Po dodaniu obliczania
                  <code>pacePerKm</code> w backendzie, tutaj pojawi się wykres tempa.
                </p>
              )}
            </div>

            {/* TABELA PARAMETROW */}
            <div className="compare-table-wrapper">
              <h3>Porównanie parametrów</h3>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Parametr</th>
                    <th>Pierwszy</th>
                    <th>Drugi</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dystans (km)</td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.first.distance
                          ? comparison.first.distance / 1000
                          : null,
                        comparison.second.distance
                          ? comparison.second.distance / 1000
                          : null,
                        true,
                        (v) => v.toFixed(2),
                      )}
                    </td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.second.distance
                          ? comparison.second.distance / 1000
                          : null,
                        comparison.first.distance
                          ? comparison.first.distance / 1000
                          : null,
                        true,
                        (v) => v.toFixed(2),
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Czas trwania</td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.first.duration,
                        comparison.second.duration,
                        false,
                        (v) => formatDuration(v),
                      )}
                    </td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.second.duration,
                        comparison.first.duration,
                        false,
                        (v) => formatDuration(v),
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Średnie tętno</td>
                    <td>
                      {comparison.first.averageHeartRate ?? "brak"}
                    </td>
                    <td>
                      {comparison.second.averageHeartRate ?? "brak"}
                    </td>
                  </tr>
                  <tr>
                    <td>Średnia prędkość (km/h)</td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.first.averageSpeed
                          ? comparison.first.averageSpeed * 3.6
                          : null,
                        comparison.second.averageSpeed
                          ? comparison.second.averageSpeed * 3.6
                          : null,
                        true,
                        (v) => v.toFixed(2),
                      )}
                    </td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.second.averageSpeed
                          ? comparison.second.averageSpeed * 3.6
                          : null,
                        comparison.first.averageSpeed
                          ? comparison.first.averageSpeed * 3.6
                          : null,
                        true,
                        (v) => v.toFixed(2),
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Przewyższenie (m)</td>
                    <td>{comparison.first.elevationGain ?? "brak"}</td>
                    <td>{comparison.second.elevationGain ?? "brak"}</td>
                  </tr>
                  <tr>
                    <td>Kalorie</td>
                    <td>{comparison.first.calories ?? "brak"}</td>
                    <td>{comparison.second.calories ?? "brak"}</td>
                  </tr>
                </tbody>
              </table>
              <p className="compare-hint">
                Podświetlenie oznacza lepszą wartość dla danego parametru
                (np. krótszy czas, większy dystans, wyższa prędkość).
              </p>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export default ComparePage;
