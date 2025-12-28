import { useEffect, useMemo, useState } from "react";
import PanelShell from "../PanelShell";
import { analyticsAPI } from "../../../services/api";
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import "./CalendarHeatmapPanel.css";

const iso = (d) => d.toISOString();
const dayKey = (d) => d.toISOString().slice(0, 10);

const buildDateRange = (dateRange) => {
  if (dateRange?.start && dateRange?.end) {
    return { start: dateRange.start, end: dateRange.end };
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 365);
  return { start, end };
};

const getColor = (value, max) => {
  if (!value || value <= 0) return "h0";
  const pct = max > 0 ? value / max : 0;
  if (pct < 0.2) return "h1";
  if (pct < 0.4) return "h2";
  if (pct < 0.6) return "h3";
  if (pct < 0.8) return "h4";
  return "h5";
};

export default function CalendarHeatmapPanel({
  cache,
  setCache,
  dateRange,
  activityType,
}) {
  const [metric, setMetric] = useState("load"); // load | duration | distance
  const [view, setView] = useState("day"); // day | week

  const { start, end } = buildDateRange(dateRange);
  const cacheKey = useMemo(
    () => `heatmap:${activityType}:${dayKey(start)}:${dayKey(end)}`,
    [activityType, start, end],
  );
  const cached = cache[cacheKey];

  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (cache[cacheKey]) return;
      setLoading(true);
      setError(null);
      try {
        const params = {
          startDate: iso(start),
          endDate: iso(end),
        };
        if (activityType !== "all") params.type = activityType;
        const res = await analyticsAPI.getCalendarHeatmap(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać danych heatmapy");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, end, setCache, start]);

  const days = cached?.days || [];
  const byDay = useMemo(() => {
    const m = new Map();
    for (const d of days) m.set(d.date, d);
    return m;
  }, [days]);

  const allKeys = useMemo(() => {
    // Build contiguous days to render consistently
    const out = [];
    const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const endUTC = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cur <= endUTC) {
      out.push(dayKey(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  }, [start, end]);

  const values = allKeys.map((k) => {
    const row = byDay.get(k);
    if (!row) return 0;
    if (metric === "distance") return (row.totalDistance || 0) / 1000;
    if (metric === "duration") return (row.totalDuration || 0) / 3600;
    return row.totalLoad || 0;
  });
  const max = Math.max(0, ...values);

  const weekly = useMemo(() => {
    // Aggregate contiguous day keys into ISO weeks (UTC), for a more meaningful "count of trainings"
    const out = new Map();
    const weekStartUTC = (k) => {
      const d = new Date(`${k}T00:00:00.000Z`);
      const day = d.getUTCDay(); // 0..6
      const diff = day === 0 ? -6 : 1 - day;
      d.setUTCDate(d.getUTCDate() + diff);
      return d.toISOString().slice(0, 10);
    };

    for (const k of allKeys) {
      const row = byDay.get(k) || { count: 0, totalLoad: 0, totalDuration: 0, totalDistance: 0 };
      const wk = weekStartUTC(k);
      if (!out.has(wk)) {
        out.set(wk, { week: wk, count: 0, totalLoad: 0, totalDuration: 0, totalDistance: 0 });
      }
      const w = out.get(wk);
      w.count += row.count || 0;
      w.totalLoad += row.totalLoad || 0;
      w.totalDuration += row.totalDuration || 0;
      w.totalDistance += row.totalDistance || 0;
    }

    return Array.from(out.values()).sort((a, b) => a.week.localeCompare(b.week));
  }, [allKeys, byDay]);

  const insight = useMemo(() => {
    const activeDays = values.filter((v) => v > 0).length;
    const totalDays = values.length;
    if (!totalDays) return null;
    const pct = Math.round((activeDays / totalDays) * 100);
    if (view === "week") {
      const weeks = weekly.length;
      const activeWeeks = weekly.filter((w) => (w.count || 0) > 0).length;
      return `Aktywne tygodnie: ${activeWeeks}/${weeks}. Słupki pokazują sumę (${metric}) i liczbę treningów/tydzień.`;
    }
    return `Aktywne dni: ${activeDays}/${totalDays} (${pct}%). Ciemniejsze pola = większy bodziec (${metric}).`;
  }, [metric, values, view, weekly]);

  return (
    <PanelShell
      title="Kalendarz treningów (heatmapa)"
      description={
        <>
          Heatmapa pokazuje <strong>regularność</strong> i <strong>obciążenie dnia</strong> w
          czasie. Kolor oznacza wartość dla wybranego wskaźnika.
        </>
      }
      interpretation={
        <>
          Szukaj wzorców: długie przerwy, serie ciężkich dni bez odpoczynku, „weekend warrior”.
          To szybki sposób, żeby zobaczyć, czy trening jest systematyczny.
        </>
      }
      insight={insight}
    >
      <div className="hm-controls">
        <div className="hm-control">
          <label>Koloruj wg</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="load">Obciążenie (load)</option>
            <option value="duration">Czas (h)</option>
            <option value="distance">Dystans (km)</option>
          </select>
        </div>
        <div className="hm-control">
          <label>Grupowanie</label>
          <select value={view} onChange={(e) => setView(e.target.value)}>
            <option value="day">Dzień</option>
            <option value="week">Tydzień</option>
          </select>
        </div>
        {hover && (
          <div className="hm-hover">
            <strong>{hover.date}</strong> · treningów: {hover.count} ·{" "}
            {metric === "load"
              ? `load: ${Math.round(hover.totalLoad || 0)}`
              : metric === "duration"
                ? `czas: ${((hover.totalDuration || 0) / 3600).toFixed(2)} h`
                : `dystans: ${((hover.totalDistance || 0) / 1000).toFixed(2)} km`}
          </div>
        )}
      </div>

      {loading && <div>Ładowanie heatmapy…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && allKeys.length === 0 && <div>Brak danych.</div>}

      {!loading && !error && allKeys.length > 0 && (
        <>
        {view === "week" ? (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={weekly.map((w) => ({
                week: w.week,
                trainings: w.count,
                value:
                  metric === "distance"
                    ? (w.totalDistance || 0) / 1000
                    : metric === "duration"
                      ? (w.totalDuration || 0) / 3600
                      : w.totalLoad || 0,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" hide />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="trainings" name="Treningi / tydzień" fill="#4f46e5" />
              <Bar dataKey="value" name={metric === "load" ? "Load / tydzień" : metric === "duration" ? "Czas (h) / tydzień" : "Dystans (km) / tydzień"} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
        <div className="hm-grid" role="img" aria-label="Heatmapa aktywności">
          {allKeys.map((k) => {
            const row = byDay.get(k) || { date: k, count: 0, totalLoad: 0, totalDuration: 0, totalDistance: 0 };
            const v =
              metric === "distance"
                ? (row.totalDistance || 0) / 1000
                : metric === "duration"
                  ? (row.totalDuration || 0) / 3600
                  : row.totalLoad || 0;
            const cls = getColor(v, max);
            return (
              <div
                key={k}
                className={`hm-cell ${cls}`}
                onMouseEnter={() => setHover(row)}
                onMouseLeave={() => setHover(null)}
                title={`${k} · ${row.count} treningów`}
              />
            );
          })}
        </div>
        )}
        </>
      )}
    </PanelShell>
  );
}


