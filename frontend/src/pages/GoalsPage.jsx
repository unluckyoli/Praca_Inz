import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { goalsAPI } from "../services/api";
import "./GoalsPage.css";

const PRESETS = [
  { title: "20 km / tydzień", type: "DISTANCE_KM", period: "WEEK", target: 20 },
  { title: "40 km / miesiąc", type: "DISTANCE_KM", period: "MONTH", target: 40 },
  { title: "4 treningi / tydzień", type: "ACTIVITIES_COUNT", period: "WEEK", target: 4 },
  { title: "240 min / miesiąc", type: "DURATION_MIN", period: "MONTH", target: 240 },
];

const typeLabel = (t) => {
  switch (t) {
    case "DISTANCE_KM": return "Dystans (km)";
    case "DURATION_MIN": return "Czas (min)";
    case "ACTIVITIES_COUNT": return "Liczba aktywności";
    case "ELEVATION_M": return "Przewyższenie (m)";
    default: return t;
  }
};

const periodLabel = (p) => (p === "WEEK" ? "Tydzień" : "Miesiąc");

function statusBadge(goal) {
  if (goal.isActive) return { text: "W trakcie", cls: "badge badge-live" };
  if (goal.isCompleted === true) return { text: "Zaliczony", cls: "badge badge-ok" };
  if (goal.isCompleted === false) return { text: "Nie zaliczony", cls: "badge badge-bad" };
  return { text: "Zakończony", cls: "badge" };
}

export default function GoalsPage() {
  const [current, setCurrent] = useState(null); 
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const [type, setType] = useState("DISTANCE_KM");
  const [period, setPeriod] = useState("WEEK");
  const [target, setTarget] = useState(20);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, h] = await Promise.all([goalsAPI.getCurrent(), goalsAPI.history()]);
      setCurrent(c.data);
      setHistory(h.data.goals || []);
    } catch (e) {
      setError("Nie udało się pobrać celów");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const submitGoal = async (payload) => {
    setCreating(true);
    setError(null);
    try {
      await goalsAPI.create(payload);
      await fetchAll();
    } catch (e) {
      setError(e.response?.data?.error || "Nie udało się utworzyć celu");
    } finally {
      setCreating(false);
    }
  };

  const activeGoal = current?.goal;

  return (
    <Layout>
      <div className="goals-page">
        <h1 className="goals-title">Cele i postęp</h1>

        {loading && <p>Ładowanie...</p>}
        {error && <p className="goals-error">{error}</p>}

        {!loading && (
          <>
            <div className="goals-grid">
              <div className="goals-card">
                <h2>Aktualny cel</h2>

                {activeGoal ? (
                  <>
                    <div className="current-row">
                      <div>
                        <div className="current-main">
                          {typeLabel(activeGoal.type)} · {periodLabel(activeGoal.period)}
                        </div>
                        <div className="current-sub">
                          Okno: {new Date(current.progress.windowStart).toLocaleDateString("pl-PL")} –{" "}
                          {new Date(current.progress.windowEnd).toLocaleDateString("pl-PL")}
                        </div>
                      </div>
                      <div className="current-right">
                        <div className="big">
                          {current.progress.current} / {current.progress.target} {current.progress.unit}
                        </div>
                        <div className="bar">
                          <div className="fill" style={{ width: `${current.progress.percent}%` }} />
                        </div>
                        <div className="pct">{current.progress.percent}%</div>
                      </div>
                    </div>

                    <div className="hint">
                      Progres liczymy automatycznie z Twoich aktywności w wybranym oknie czasu.
                    </div>
                  </>
                ) : (
                  <div className="empty">
                    Nie masz ustawionego aktywnego celu. Wybierz preset lub ustaw własny poniżej.
                  </div>
                )}
              </div>

              <div className="goals-card">
                <h2>Szybkie cele</h2>
                <div className="presets">
                  {PRESETS.map((p) => (
                    <div
                      key={p.title}
                      className="preset"
                      onClick={() => submitGoal(p)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="preset-title">{p.title}</div>
                      <div className="preset-sub">
                        {typeLabel(p.type)} · {periodLabel(p.period)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="goals-card">
              <h2>Ustaw własny cel</h2>

              <div className="form-row">
                <div className="field">
                  <label>Typ</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="DISTANCE_KM">Dystans (km)</option>
                    <option value="DURATION_MIN">Czas (min)</option>
                    <option value="ACTIVITIES_COUNT">Liczba aktywności</option>
                    <option value="ELEVATION_M">Przewyższenie (m)</option>
                  </select>
                </div>

                <div className="field">
                  <label>Okres</label>
                  <select value={period} onChange={(e) => setPeriod(e.target.value)}>
                    <option value="WEEK">Tydzień</option>
                    <option value="MONTH">Miesiąc</option>
                  </select>
                </div>

                <div className="field">
                  <label>Cel</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  />
                </div>

                <div className="field">
                  <label>&nbsp;</label>
                  <button
                    className="primary"
                    disabled={creating}
                    onClick={() => submitGoal({ type, period, target })}
                  >
                    {creating ? "Ustawiam..." : "Ustaw cel"}
                  </button>
                </div>
              </div>

              <div className="hint">
                Uwaga: ustawienie nowego celu dezaktywuje poprzedni aktywny cel.
              </div>
            </div>

            <div className="goals-card">
              <h2>Historia celów</h2>

              {history.length === 0 ? (
                <div className="empty">Brak historii.</div>
              ) : (
                <div className="history">
                  {history.map((g) => {
                    const b = statusBadge(g);
                    return (
                      <div key={g.id} className="history-row">
                        <div>
                          <div className="history-main">
                            {typeLabel(g.type)} · {periodLabel(g.period)} · cel: <strong>{g.target}</strong>
                          </div>
                          <div className="history-sub">
                            {new Date(g.windowStart).toLocaleDateString("pl-PL")} –{" "}
                            {new Date(g.windowEnd).toLocaleDateString("pl-PL")}
                          </div>
                        </div>
                        <div className={b.cls}>{b.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
