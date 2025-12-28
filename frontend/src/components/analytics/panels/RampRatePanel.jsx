import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
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

const iso = (d) => d.toISOString();
const fmtWeek = (isoDate) =>
  new Date(isoDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" });

export default function RampRatePanel({ cache, setCache, dateRange, activityType }) {
  const weeks =
    dateRange?.start && dateRange?.end
      ? Math.max(4, Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24 * 7)))
      : 26;

  const cacheKey = useMemo(
    () => `ramp:${weeks}:${activityType}:${dateRange?.start?.toISOString() || ""}:${dateRange?.end?.toISOString() || ""}`,
    [activityType, dateRange?.end, dateRange?.start, weeks],
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
        const params = { weeks };
        if (activityType !== "all") params.type = activityType;
        if (dateRange?.start) params.endDate = iso(dateRange.end || new Date());
        const res = await analyticsAPI.getRampRate(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać ramp rate");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, dateRange?.end, dateRange?.start, setCache, weeks]);

  const data = (cached?.weeks || []).map((w) => ({
    week: fmtWeek(w.weekStart),
    totalLoad: w.totalLoad,
    ramp: w.rampRatePct,
  }));

  const last = cached?.weeks?.length ? cached.weeks[cached.weeks.length - 1] : null;
  const insight = last?.rampRatePct != null
    ? `Ostatni tydzień: ${last.totalLoad} load, ramp rate ${last.rampRatePct}%. ` +
      (last.rampRatePct > 10
        ? "To szybki wzrost — rozważ lżejszy tydzień lub dodatkową regenerację."
        : last.rampRatePct > 5
          ? "Umiarkowany wzrost — OK, ale obserwuj zmęczenie."
          : "Bezpieczne tempo wzrostu obciążenia.")
    : "Ramp rate liczymy dopiero, gdy jest co najmniej 2 tygodnie danych.";

  return (
    <PanelShell
      title="Bezpieczeństwo obciążenia (Ramp Rate)"
      description={
        <>
          Pokazuje tygodniowe <strong>obciążenie treningowe</strong> oraz to, jak szybko rośnie ono
          tydzień do tygodnia.
        </>
      }
      interpretation={
        <>
          Stały wzrost 0–5% zwykle jest bezpieczny. 5–10% to strefa ostrożności. Powyżej 10%
          przez kilka tygodni zwiększa ryzyko przeciążenia.
        </>
      }
      insight={insight}
    >
      {loading && <div>Ładowanie…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && data.length < 2 && <div>Za mało danych do obliczenia ramp rate.</div>}
      {!loading && !error && data.length >= 2 && (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalLoad" name="Load / tydzień" fill="#4f46e5" />
            </BarChart>
          </ResponsiveContainer>

          <div style={{ height: 10 }} />

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip formatter={(v) => (v == null ? "brak" : `${v}%`)} />
              <Legend />
              <Line type="monotone" dataKey="ramp" name="Ramp rate (%)" stroke="#f97316" dot />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </PanelShell>
  );
}


