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
import { analyticsAPI } from "../../../services/api";
import PanelShell from "../PanelShell";

const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString("pl-PL", { month: "short", day: "numeric" });

export default function PmcPanel({ cache, setCache, dateRange, activityType }) {
  const cacheKey = useMemo(
    () => `pmc:${activityType}:${dateRange?.start?.toISOString() || ""}:${dateRange?.end?.toISOString() || ""}`,
    [activityType, dateRange?.start, dateRange?.end],
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
        // backend uses days; we map dateRange to days (fallback 180)
        const days =
          dateRange?.start && dateRange?.end
            ? Math.max(
                7,
                Math.ceil((dateRange.end - dateRange.start) / (1000 * 60 * 60 * 24)),
              )
            : 180;
        const res = await analyticsAPI.getFitnessMetrics({ days });
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać metryk formy");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [cache, cacheKey, dateRange, setCache]);

  const data = cached?.metrics || [];
  const chartData = data.map((m) => ({
    date: m.date,
    label: fmtDay(m.date),
    ctl: m.ctl,
    atl: m.atl,
    tsb: m.tsb,
  }));

  const last = data.length ? data[data.length - 1] : null;
  const insight =
    last
      ? `Dziś: CTL ${last.ctl}, ATL ${last.atl}, TSB ${last.tsb}. ` +
        (last.tsb < -20
          ? "TSB jest mocno ujemny — to zwykle oznacza nagromadzone zmęczenie."
          : last.tsb > 10
            ? "TSB dodatni — jesteś świeższy, często dobry moment na mocniejszy akcent lub start."
            : "TSB w okolicy zera — balans trening/regeneracja wygląda stabilnie.")
      : null;

  return (
    <PanelShell
      title="Forma i zmęczenie (Fitness & Freshness)"
      description={
        <>
          Wykres pokazuje <strong>CTL</strong> (forma długoterminowa), <strong>ATL</strong>{" "}
          (zmęczenie krótkoterminowe) oraz <strong>TSB</strong> (świeżość).
        </>
      }
      interpretation={
        <>
          CTL rośnie, gdy trenujesz regularnie. ATL rośnie po cięższych tygodniach. TSB spada,
          gdy kumuluje się zmęczenie — długo utrzymujące się niskie TSB sugeruje potrzebę
          regeneracji.
        </>
      }
      insight={insight}
    >
      {loading && <div>Ładowanie wykresu…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && chartData.length === 0 && (
        <div>Brak danych CTL/ATL/TSB. Zsynchronizuj aktywności ze Stravą.</div>
      )}
      {!loading && !error && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip
              formatter={(v, name) => [v, name.toUpperCase()]}
              labelFormatter={(l) => `Dzień: ${l}`}
            />
            <Legend />
            <Line type="monotone" dataKey="ctl" name="CTL (forma)" stroke="#4f46e5" dot={false} />
            <Line type="monotone" dataKey="atl" name="ATL (zmęczenie)" stroke="#ef4444" dot={false} />
            <Line type="monotone" dataKey="tsb" name="TSB (świeżość)" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </PanelShell>
  );
}


