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
import { activitiesAPI, analyticsAPI } from "../../../services/api";

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

export default function PerformanceCurvePanel({ cache, setCache, dateRange, activityType }) {
  const [mode, setMode] = useState("pace"); // pace | power
  const [fillN, setFillN] = useState(50);
  const [filling, setFilling] = useState(false);
  const [fillMsg, setFillMsg] = useState(null);
  const { start, end } = buildDateRange(dateRange);

  const cacheKey = useMemo(
    () => `curve:${mode}:${activityType}:${dayKey(start)}:${dayKey(end)}`,
    [activityType, end, mode, start],
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
        const params = { mode, startDate: iso(start), endDate: iso(end) };
        if (activityType !== "all") params.type = activityType;
        const res = await analyticsAPI.getPerformanceCurve(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać profilu");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, end, mode, setCache, start]);

  const points = cached?.points || [];
  const unit = cached?.unit || (mode === "power" ? "W" : "min/km");

  const insight = useMemo(() => {
    const available = points.filter((p) => p.value != null).length;
    if (!available) {
      return mode === "power"
        ? "Brak danych mocy — potrzebujesz aktywności z power (rower/indoor + czujnik)."
        : "Brak danych tempa — potrzebujesz przeliczonych dystansów (paceDistance).";
    }
    const best = mode === "power"
      ? points.reduce((acc, p) => (p.value != null && (acc == null || p.value > acc.value) ? p : acc), null)
      : points.reduce((acc, p) => (p.value != null && (acc == null || p.value < acc.value) ? p : acc), null);
    return best
      ? `Najlepszy punkt profilu: ${best.label} → ${best.value} ${unit}.`
      : null;
  }, [mode, points, unit]);

  return (
    <PanelShell
      title="Profil wysiłku (Power / Pace Curve)"
      description={
        <>
          To przekrój Twojej wydajności dla różnych czasów (power) lub standardowych dystansów (pace).
          Zamiast „sum km” widzisz, <strong>w czym jesteś najlepszy</strong>.
        </>
      }
      interpretation={
        <>
          Jeśli krzywa rośnie w górę (power) albo spada (pace), to realny progres. Warto porównywać
          okna czasu (np. ostatnie 12 tygodni) i patrzeć, które odcinki rosną najszybciej.
        </>
      }
      insight={insight}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontWeight: 700, color: "#374151" }}>
          Tryb&nbsp;
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="pace">Pace (min/km)</option>
            <option value="power">Power (W)</option>
          </select>
        </label>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 12,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid rgba(15, 23, 42, 0.10)",
          background: "rgba(15, 23, 42, 0.03)",
        }}
      >
        <div style={{ fontWeight: 800, color: "#111827" }}>Uzupełnij rekordy</div>
        <label style={{ fontWeight: 700, color: "#374151" }}>
          Ostatnie&nbsp;
          <input
            type="number"
            min="1"
            max="200"
            value={fillN}
            onChange={(e) => setFillN(Number(e.target.value))}
            style={{ width: 90, marginLeft: 6 }}
          />
        </label>
        <button
          className="primary"
          disabled={filling}
          onClick={async () => {
            setFilling(true);
            setFillMsg(null);
            try {
              const res = await activitiesAPI.batchFetchDetails(fillN);
              setFillMsg(
                `Uzupełniono: ${res.data.updated}/${res.data.processed} (błędy: ${res.data.errors})` +
                  (res.data.rateLimited ? " — trafiono limit API Strava, spróbuj później." : ""),
              );
              // invalidate curve cache and refetch on next render
              setCache((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                  if (k.startsWith("curve:")) delete next[k];
                });
                return next;
              });
            } catch (e) {
              setFillMsg(e?.response?.data?.error || "Nie udało się uzupełnić rekordów");
            } finally {
              setFilling(false);
            }
          }}
        >
          {filling ? "Uzupełniam…" : "Uzupełnij"}
        </button>
        <div style={{ color: "#6b7280", fontSize: "0.92rem" }}>
          Pobieramy szczegóły i streamy z Stravy dla N ostatnich aktywności (może trafić w limit API).
        </div>
        {fillMsg && <div style={{ width: "100%", color: "#111827" }}>{fillMsg}</div>}
      </div>

      {loading && <div>Ładowanie profilu…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && points.filter((p) => p.value != null).length === 0 && (
        <div>{insight}</div>
      )}
      {!loading && !error && points.filter((p) => p.value != null).length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip formatter={(v) => (v == null ? "brak" : `${v} ${unit}`)} />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              name={mode === "power" ? "Best power" : "Best pace"}
              stroke={mode === "power" ? "#f97316" : "#4f46e5"}
              dot
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </PanelShell>
  );
}


