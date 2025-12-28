import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import PanelShell from "../PanelShell";
import { analyticsAPI } from "../../../services/api";
import "./YearOverYearPanel.css";

const monthLabel = (m) =>
  new Date(Date.UTC(2025, m - 1, 1)).toLocaleDateString("pl-PL", { month: "short" });

export default function YearOverYearPanel({ cache, setCache, activityType }) {
  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState(nowYear);
  const [compareTo, setCompareTo] = useState(nowYear - 1);
  const [metric, setMetric] = useState("distance"); // distance | duration | load

  const cacheKey = useMemo(
    () => `yoy:${metric}:${year}:${compareTo}:${activityType}`,
    [activityType, compareTo, metric, year],
  );
  const cached = cache[cacheKey];

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (cache[cacheKey]) return;
      setLoading(true);
      setError(null);
      try {
        const params = { metric, year, compareTo };
        if (activityType !== "all") params.type = activityType;
        const res = await analyticsAPI.getYearOverYear(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać porównania rok-do-roku");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, compareTo, metric, setCache, year]);

  const months = cached?.months || [];
  const chartData = months.map((m) => ({
    month: monthLabel(m.month),
    current: m.current,
    previous: m.previous,
    deltaPct: m.deltaPct,
  }));

  const unit = metric === "distance" ? "km" : metric === "duration" ? "h" : "load";
  const insight = useMemo(() => {
    if (!months.length) return null;
    const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0);
    const cur = sum(months, "current");
    const prev = sum(months, "previous");
    if (!prev) return `Suma ${year}: ${cur.toFixed(1)} ${unit} (brak danych ${compareTo}).`;
    const pct = ((cur - prev) / prev) * 100;
    const dir = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    return `Suma ${year} vs ${compareTo}: ${dir} ${pct.toFixed(1)}% (${cur.toFixed(1)} vs ${prev.toFixed(1)} ${unit}).`;
  }, [compareTo, metric, months, unit, year]);

  return (
    <PanelShell
      title="Rok do roku (porównanie sezonów)"
      description={
        <>
          Porównanie miesięczne dwóch lat pokazuje, czy robisz więcej pracy niż rok temu i jak wygląda
          sezonowość. To świetny „kontekst długiego horyzontu”.
        </>
      }
      interpretation={
        <>
          Patrz na różnice w poszczególnych miesiącach: okresy budowania, startów i regeneracji.
          Uwaga: ten panel ignoruje filtr „OD/DO” i operuje pełnymi latami.
        </>
      }
      insight={insight}
    >
      <div className="yoy-controls">
        <label>
          Rok A&nbsp;
          <select
            value={year}
            onChange={(e) => {
              const y = Number(e.target.value);
              setYear(y);
              if (compareTo === y) setCompareTo(y - 1);
            }}
          >
            {Array.from({ length: 10 }, (_, i) => nowYear - i).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rok B&nbsp;
          <select value={compareTo} onChange={(e) => setCompareTo(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => nowYear - i).map((y) => (
              <option key={y} value={y} disabled={y === year}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Metryka&nbsp;
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="distance">Dystans (km)</option>
            <option value="duration">Czas (h)</option>
            <option value="load">Obciążenie (load)</option>
          </select>
        </label>
      </div>

      {loading && <div>Ładowanie…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && chartData.length === 0 && <div>Brak danych dla tych lat.</div>}

      {!loading && !error && chartData.length > 0 && (
        <>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="current" name={`${year}`} stroke="#4f46e5" dot={false} />
              <Line type="monotone" dataKey="previous" name={`${compareTo}`} stroke="#10b981" dot={false} />
            </LineChart>
          </ResponsiveContainer>

          <div className="yoy-table">
            <div className="yoy-table-head">
              <div>Miesiąc</div>
              <div>{year}</div>
              <div>{compareTo}</div>
              <div>Δ%</div>
            </div>
            {months.map((m) => (
              <div key={m.month} className="yoy-table-row">
                <div>{monthLabel(m.month)}</div>
                <div>{m.current ?? 0}</div>
                <div>{m.previous ?? 0}</div>
                <div className={m.deltaPct != null && m.deltaPct < 0 ? "neg" : "pos"}>
                  {m.deltaPct == null ? "brak" : `${m.deltaPct}%`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </PanelShell>
  );
}


