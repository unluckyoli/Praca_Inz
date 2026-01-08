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
  const [aiSummary, setAiSummary] = useState(null);
  const [loadingAISummary, setLoadingAISummary] = useState(false);

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
      setAiSummary(null); // Reset AI summary when new comparison is loaded
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

  const handleGenerateAISummary = async () => {
    if (!firstId || !secondId) return;
    
    setLoadingAISummary(true);
    try {
      const { data } = await analyticsAPI.generateActivityComparisonSummary(firstId, secondId);
      setAiSummary(data.summary);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate("/");
      } else {
        setError("Nie udało się wygenerować podsumowania AI");
      }
    } finally {
      setLoadingAISummary(false);
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





    const formatSecondsShort = (seconds) => {
    if (seconds == null) return "brak";
    const s = Math.round(Math.abs(seconds));
    return `${s}s`;
  };

  const formatSecondsDelta = (seconds) => {
    if (seconds == null) return "0s";
    const sign = seconds > 0 ? "+" : seconds < 0 ? "−" : "";
    const s = Math.round(Math.abs(seconds));
    return `${sign}${s}s/km`;
  };

  const formatPercent = (value) => {
    if (value == null) return "brak";
    return `${value.toFixed(1)}%`;
  };

  const paceZoneConfig = {
    easy: { label: "≥ 6:00 min/km (łatwo)", color: "#a5b4fc" },
    steady: { label: "5:00–5:59 min/km (umiarkowanie)", color: "#4f46e5" },
    tempo: { label: "4:30–4:59 min/km (tempo)", color: "#10b981" },
    fast: { label: "< 4:30 min/km (szybko)", color: "#f97316" },
  };

  const loadLegend = [
      { label: "Bardzo lekki", range: "< 50", desc: "regeneracja, bardzo spokojny trening" },
      { label: "Lekki", range: "50–120", desc: "komfortowy wysiłek, baza tlenowa" },
      { label: "Średni", range: "120–220", desc: "solidny trening, wyraźne zmęczenie" },
      { label: "Ciężki", range: "220–350", desc: "mocny bodziec, po którym potrzebna jest regeneracja" },
      { label: "Bardzo ciężki", range: "> 350", desc: "bardzo wymagający trening / zawody" },
    ];


  const buildPaceZonesChartData = (first, second) => {
  const z1 = first?.paceZones?.zones;
  const z2 = second?.paceZones?.zones;
  if (!z1 || !z2) return [];

  return [
    {
      name: "Trening 1",
      easy: z1.easy.km,
      steady: z1.steady.km,
      tempo: z1.tempo.km,
      fast: z1.fast.km,
    },
    {
      name: "Trening 2",
      easy: z2.easy.km,
      steady: z2.steady.km,
      tempo: z2.tempo.km,
      fast: z2.fast.km,
    },
  ];
  };

  const PaceZonesSection = ({ first, second }) => {
    if (!first?.paceZones || !second?.paceZones) return null;

    const chartData = buildPaceZonesChartData(first, second);
    if (!chartData.length) return null;

    const zones1 = first.paceZones.zones;
    const zones2 = second.paceZones.zones;

    return (
      <div className="compare-section">
        <h3>Strefy tempa</h3>

        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis unit=" km" />
            <Tooltip />
            <Legend />

            <Bar dataKey="easy" stackId="pace" name={paceZoneConfig.easy.label} fill={paceZoneConfig.easy.color} />
            <Bar dataKey="steady" stackId="pace" name={paceZoneConfig.steady.label} fill={paceZoneConfig.steady.color} />
            <Bar dataKey="tempo" stackId="pace" name={paceZoneConfig.tempo.label} fill={paceZoneConfig.tempo.color} />
            <Bar dataKey="fast" stackId="pace" name={paceZoneConfig.fast.label} fill={paceZoneConfig.fast.color} />
          </BarChart>
        </ResponsiveContainer>

        <div className="compare-legend">
          <h4>Udział stref (w %)</h4>
          <div className="pace-zones-summary-row">
            <div>
              <strong>Trening 1</strong>
              <ul>
                <li>Easy: {formatPercent(zones1.easy.percent)}</li>
                <li>Steady: {formatPercent(zones1.steady.percent)}</li>
                <li>Tempo: {formatPercent(zones1.tempo.percent)}</li>
                <li>Fast: {formatPercent(zones1.fast.percent)}</li>
              </ul>
            </div>
            <div>
              <strong>Trening 2</strong>
              <ul>
                <li>Easy: {formatPercent(zones2.easy.percent)}</li>
                <li>Steady: {formatPercent(zones2.steady.percent)}</li>
                <li>Tempo: {formatPercent(zones2.tempo.percent)}</li>
                <li>Fast: {formatPercent(zones2.fast.percent)}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };



  const ClimbMetricsSection = ({ first, second }) => {
  if (!first?.climbMetrics || !second?.climbMetrics) return null;

  const c1 = first.climbMetrics;
  const c2 = second.climbMetrics;

  const data = [
    {
      name: "Przewyższenie (m/km)",
      first: c1.elevPerKm,
      second: c2.elevPerKm,
    },
    {
      name: "prędkość pionowa (m/h)",
      first: c1.verticalSpeed,
      second: c2.verticalSpeed,
    },
    {
      name: "średnie nachylenie (%)",
      first: c1.avgGradientPercent,
      second: c2.avgGradientPercent,
    },
  ];

  return (
    <div className="compare-section">
      <h3>Parametry wspinaczkowe</h3>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="first" name="Trening 1" fill="#4f46e5"/>
          <Bar dataKey="second" name="Trening 2" fill="#10b981" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};





  const TrainingLoadSection = ({ first, second }) => {

    if (!first?.trainingLoad && !second?.trainingLoad) return null;

    const duration1h = first.duration ? first.duration / 3600 : null;
    const duration2h = second.duration ? second.duration / 3600 : null;
    const distance1km = first.distance ? first.distance / 1000 : null;
    const distance2km = second.distance ? second.distance / 1000 : null;

    const rows = [
      {
        name: "Obciążenie (Strava score)",
        first: first.trainingLoad ?? null,
        second: second.trainingLoad ?? null,
      },
      {
        name: "Obciążenie na godzinę",
        first:
          first.trainingLoad && duration1h
            ? first.trainingLoad / duration1h
            : null,
        second:
          second.trainingLoad && duration2h
            ? second.trainingLoad / duration2h
            : null,
      },
      {
        name: "Obciążenie na km",
        first:
          first.trainingLoad && distance1km
            ? first.trainingLoad / distance1km
            : null,
        second:
          second.trainingLoad && distance2km
            ? second.trainingLoad / distance2km
            : null,
      },
    ].filter((row) => row.first != null || row.second != null);

    if (rows.length === 0) return null;

    return (
      <div className="compare-section">
        <h3>Obciążenie treningowe</h3>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="first" name="Trening 1" fill="#4f46e5" />
            <Bar dataKey="second" name="Trening 2" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>

        

        <p className="compare-hint">
          Obciążenie jest liczone na podstawie dystansu, tempa biegu i przewyższenia.{" "}
          To własny wskaźnik aplikacji: rośnie, gdy trening jest dłuższy, szybszy
          albo bardziej górzysty.
          load = distance(km) * intensity * 10 + elevationGain * 1.1
        </p>

        <div className="compare-legend">
            <h4>Jak czytać obciążenie?</h4>
            <ul>
              {loadLegend.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>{" "} <span className="range">({item.range})</span>{" "}
                  <span className="desc">– {item.desc}</span>
                </li>
              ))}
            </ul>
          </div>
      </div>
    );
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



  const PaceConsistencySection = ({ first, second }) => {
    if (!first?.paceStats || !second?.paceStats) return null;

    const s1 = first.paceStats;
    const s2 = second.paceStats;

    const cv1 = s1.cvPace != null ? s1.cvPace * 100 : null;
    const cv2 = s2.cvPace != null ? s2.cvPace * 100 : null;

    const data = [
      {
        name: "Odchylenie tempa (s/km)",
        first: s1.stdDevSeconds,
        second: s2.stdDevSeconds,
      },
      {
        name: "Zmienność względna (%)",
        first: cv1,
        second: cv2,
      },
    ];

    const formatSplitLabel = (stats) => {
      if (!stats || stats.splitType === "brak") return "brak danych";

      let label;
      if (stats.splitType === "negative") {
        label = "negative split (szybciej w drugiej połowie)";
      } else if (stats.splitType === "positive") {
        label = "positive split (wolniej w drugiej połowie)";
      } else {
        label = "równy bieg (even split)";
      }

      return `${label}, Δ ${formatSecondsShort(stats.splitDeltaSeconds)}`;
    };

    return (
      <div className="compare-section">
        <h3>Stabilność tempa i rozkład wysiłku</h3>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />

            <Bar dataKey="first" name="Trening 1" fill="#4f46e5" />
            <Bar dataKey="second" name="Trening 2" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>

        <div className="compare-legend">
          <h4>Jak interpretować splity?</h4>
          <div className="split-info">
            <p><strong>Trening 1:</strong> {formatSplitLabel(s1)}</p>
            <p><strong>Trening 2:</strong> {formatSplitLabel(s2)}</p>
          </div>
        </div>
      </div>
    );
  };





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
                {firstId && (
                  <div className="selected-activity-info">
                    <span className="activity-type">
                      {activities.find(a => a.id === firstId)?.type || "Nieznany typ"}
                    </span>
                  </div>
                )}
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
                {secondId && (
                  <div className="selected-activity-info">
                    <span className="activity-type">
                      {activities.find(a => a.id === secondId)?.type || "Nieznany typ"}
                    </span>
                  </div>
                )}
              </div>

                <div className="compare-actions">
                <button
                  className="purple-button"
                  onClick={handleCompare}
                  disabled={loadingCompare}
                  >
                  {loadingCompare ? "Porównuję..." : "Porównaj"}
                </button>
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



            {/* WYKRES 1*/}
            {/* dystans / czas / predkosc */}
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



            {/* WYKRES 2*/}
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


            {/* WYKRES 3*/}
            {/*stabilnosc + split */}
            <div className="compare-chart-card">
              <PaceConsistencySection
                first={comparison.first}
                second={comparison.second}
              />
            </div>


            {/* WYKRES 4*/}
            {/* strefy tempa */}
            <div className="compare-chart-card">
              <PaceZonesSection
                first={comparison.first}
                second={comparison.second}
              />
            </div>

            
            {/* WYKRES 5*/}
            {/* sekcja wspinaczkowa */}
            <div className="compare-chart-card">
              <ClimbMetricsSection
                first={comparison.first}
                second={comparison.second}
              />
            </div>



            {/* WYKRES 6 */}
            {/* obciążenie treningowe */}
            <div className="compare-chart-card">
              <TrainingLoadSection
                first={comparison.first}
                second={comparison.second}
              />
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
                    <td>Średnie tempo (cały bieg)</td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.first.avgPaceMinPerKm,
                        comparison.second.avgPaceMinPerKm,
                        false,
                        (v) => formatPaceMinPerKm(v),
                      )}
                    </td>
                    <td>
                      {renderValueWithHighlight(
                        comparison.second.avgPaceMinPerKm,
                        comparison.first.avgPaceMinPerKm,
                        false,
                        (v) => formatPaceMinPerKm(v),
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
                  <tr>
                    <td>Obciążenie treningowe</td>
                    <td>{comparison.first.trainingLoad ?? "brak"}</td>
                    <td>{comparison.second.trainingLoad ?? "brak"}</td>
                  </tr>

                </tbody>
              </table>
              <p className="compare-hint">
                Podświetlenie oznacza lepszą wartość dla danego parametru
                (np. krótszy czas, większy dystans, wyższa prędkość).
              </p>
            </div>

            {/* AI Summary Section */}
            <div className="compare-section compare-ai-section">
              <h3>Podsumowanie AI</h3>
              <p className="compare-description">
                AI analizuje obie aktywności i podaje szczegółowe porównanie, spostrzeżenia oraz rekomendacje.
              </p>
              
              {!aiSummary && (
                <button 
                  onClick={handleGenerateAISummary}
                  disabled={loadingAISummary}
                  className="compare-ai-button"
                >
                  {loadingAISummary ? "Generowanie podsumowania..." : "Wygeneruj podsumowanie AI"}
                </button>
              )}
              
              {aiSummary && (
                <div className="ai-summary-content">
                  <div className="ai-summary-text">
                    {aiSummary.split('\n').map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                  <button 
                    onClick={() => setAiSummary(null)}
                    className="compare-ai-regenerate-button"
                  >
                    Wygeneruj ponownie
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

export default ComparePage;
