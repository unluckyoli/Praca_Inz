import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import PanelShell from "../PanelShell";
import { analyticsAPI } from "../../../services/api";

const iso = (d) => d.toISOString();

export default function TimePatternsPanel({ cache, setCache, dateRange, activityType }) {
  const [metric, setMetric] = useState("count"); // count | speed | ef | load

  const cacheKey = useMemo(
    () =>
      `time:${metric}:${activityType}:${dateRange?.start?.toISOString() || ""}:${dateRange?.end?.toISOString() || ""}`,
    [activityType, dateRange?.end, dateRange?.start, metric],
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
        const params = { metric, tzOffsetMinutes: new Date().getTimezoneOffset() };
        if (activityType !== "all") params.type = activityType;
        if (dateRange?.start) params.startDate = iso(dateRange.start);
        if (dateRange?.end) params.endDate = iso(dateRange.end);
        const res = await analyticsAPI.getTimePatterns(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać wzorców czasowych");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, dateRange?.end, dateRange?.start, metric, setCache]);

  const byHour = cached?.byHour || [];
  const note = cached?.timezoneNote;

  const insight = useMemo(() => {
    if (!byHour.length) return null;
    const scored = byHour
      .map((h) => ({
        hour: h.hour,
        count: h.count,
        samples: h.samples ?? (metric === "count" ? h.count : 0),
        value: h.value,
      }))
      .filter((h) => (metric === "count" ? true : h.value != null));

    if (!scored.length) return "Brak danych dla wybranej metryki (np. EF wymaga HR+speed).";

    if (metric === "count") {
      const best = scored.reduce((a, b) => (b.count > a.count ? b : a));
      return `Najczęściej trenujesz o ${best.hour}:00 (liczba treningów: ${best.count}).`;
    }

    // avoid "one perfect workout" dominating: weight quality by sample size
    const minSamples = 5;
    const weighted = scored.filter((h) => (h.samples ?? 0) >= minSamples);
    const pool = weighted.length ? weighted : scored;
    const score = (h) => (h.value ?? 0) * Math.log1p(h.samples ?? 0);
    const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));

    const warning =
      (best.samples ?? 0) < minSamples
        ? " (mało próbek — traktuj to ostrożnie)"
        : "";
    return `Najlepszy “kompromis jakość×próbki” to ${best.hour}:00 (średnio: ${best.value}, próbki: ${best.samples})${warning}.`;
  }, [byHour, metric]);

  const metricLabel =
    metric === "count"
      ? "Liczba treningów"
      : metric === "speed"
        ? "Śr. prędkość (km/h)"
        : metric === "ef"
          ? "Śr. EF (speed/hr)"
          : "Śr. load";

  return (
    <PanelShell
      title="Kiedy trenujesz najlepiej (wzorce czasowe)"
      description={
        <>
          Analiza godzin i dni tygodnia pokazuje, kiedy trenujesz najczęściej oraz jak zmienia się
          jakość treningu w zależności od pory dnia.
        </>
      }
      interpretation={
        <>
          Wybierz metrykę „EF” lub „prędkość”, żeby zobaczyć, czy masz pory dnia z lepszą dyspozycją.
          To dobry sygnał do układania akcentów w planie.
          {note ? <> <em>Uwaga:</em> {note}.</> : null}
        </>
      }
      insight={insight}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontWeight: 700, color: "#374151" }}>
          Metryka&nbsp;
          <select value={metric} onChange={(e) => setMetric(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="count">Częstotliwość (count)</option>
            <option value="speed">Prędkość (speed)</option>
            <option value="ef">Efektywność (EF)</option>
            <option value="load">Obciążenie (load)</option>
          </select>
        </label>
      </div>

      {loading && <div>Ładowanie…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && byHour.length === 0 && <div>Brak danych w wybranym okresie.</div>}
      {!loading && !error && byHour.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={byHour}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" tickFormatter={(h) => `${h}`} />
            <YAxis />
            <Tooltip
              labelFormatter={(h) => `Godzina: ${h}:00`}
              formatter={(v) => (v == null ? "brak" : v)}
            />
            <Legend />
            <Bar dataKey={metric === "count" ? "count" : "value"} name={metricLabel} fill="#4f46e5" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </PanelShell>
  );
}


