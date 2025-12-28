import { useEffect, useMemo, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from "recharts";
import PanelShell from "../PanelShell";
import { analyticsAPI } from "../../../services/api";

const iso = (d) => d.toISOString();
const fmtDay = (isoStr) =>
  new Date(isoStr).toLocaleDateString("pl-PL", { month: "short", day: "numeric" });

export default function AerobicEfficiencyPanel({ cache, setCache, dateRange, activityType }) {
  const [mode, setMode] = useState("easy"); // easy | all
  const [maxHr, setMaxHr] = useState(150);

  const cacheKey = useMemo(
    () =>
      `ef:${mode}:${maxHr}:${activityType}:${dateRange?.start?.toISOString() || ""}:${dateRange?.end?.toISOString() || ""}`,
    [activityType, dateRange?.end, dateRange?.start, maxHr, mode],
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
        const params = {
          mode,
          maxHr,
        };
        if (activityType !== "all") params.type = activityType;
        if (dateRange?.start) params.startDate = iso(dateRange.start);
        if (dateRange?.end) params.endDate = iso(dateRange.end);
        const res = await analyticsAPI.getAerobicEfficiency(params);
        if (!mounted) return;
        setCache((prev) => ({ ...prev, [cacheKey]: res.data }));
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.error || "Nie udało się pobrać EF");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [activityType, cache, cacheKey, dateRange?.end, dateRange?.start, maxHr, mode, setCache]);

  const points = (cached?.points || []).map((p) => ({
    date: p.date,
    label: fmtDay(p.date),
    ef: p.ef,
    speed: p.avgSpeedKmh,
    hr: p.avgHr,
  }));

  const { filteredPoints, removedOutliers } = useMemo(() => {
    // basic sanity + robust outlier filter on EF (MAD)
    const base = points.filter((p) => {
      if (p.ef == null) return false;
      if (p.hr == null || p.hr < 60 || p.hr > 220) return false;
      if (p.speed == null || p.speed <= 0 || p.speed > 80) return false;
      return true;
    });

    if (base.length < 8) {
      return { filteredPoints: base, removedOutliers: points.length - base.length };
    }

    const efs = base.map((p) => p.ef).filter((x) => typeof x === "number").sort((a, b) => a - b);
    const median = efs[Math.floor(efs.length / 2)];
    const absDev = efs.map((x) => Math.abs(x - median)).sort((a, b) => a - b);
    const mad = absDev[Math.floor(absDev.length / 2)] || 0;

    // If MAD is 0 (very uniform data), only apply sanity filters above
    if (mad === 0) {
      return { filteredPoints: base, removedOutliers: points.length - base.length };
    }

    const k = 6; // more conservative than classic 3–4
    const lo = median - k * mad;
    const hi = median + k * mad;

    const filtered = base.filter((p) => p.ef >= lo && p.ef <= hi);
    return {
      filteredPoints: filtered,
      removedOutliers: points.length - filtered.length,
    };
  }, [points]);

  // simple trend line: rolling average of 14 points
  const trend = useMemo(() => {
    if (filteredPoints.length < 5) return [];
    const out = [];
    const win = 14;
    for (let i = 0; i < filteredPoints.length; i++) {
      const start = Math.max(0, i - win + 1);
      const slice = filteredPoints.slice(start, i + 1).filter((x) => x.ef != null);
      const avg = slice.length ? slice.reduce((s, x) => s + x.ef, 0) / slice.length : null;
      out.push({ ...filteredPoints[i], trend: avg != null ? Number(avg.toFixed(4)) : null });
    }
    return out;
  }, [filteredPoints]);

  const insight = useMemo(() => {
    if (filteredPoints.length < 8) {
      return removedOutliers > 0
        ? `Za mało punktów po odfiltrowaniu anomalii (${removedOutliers}) — wybierz dłuższy okres.`
        : "Za mało punktów z HR, żeby ocenić trend.";
    }
    const first = filteredPoints[0].ef;
    const last = filteredPoints[filteredPoints.length - 1].ef;
    if (!first || !last) return null;
    const pct = ((last - first) / first) * 100;
    const dir = pct > 0 ? "↑" : pct < 0 ? "↓" : "→";
    const outlierNote =
      removedOutliers > 0 ? ` Odfiltrowano anomalie: ${removedOutliers}.` : "";
    return `Trend EF ${dir} ${pct.toFixed(1)}% w wybranym okresie. (EF = prędkość / tętno).${outlierNote}`;
  }, [filteredPoints, removedOutliers]);

  return (
    <PanelShell
      title="Efektywność aerobowa (tempo vs tętno)"
      description={
        <>
          EF (Efficiency Factor) to relacja <strong>prędkości</strong> do <strong>tętna</strong>.
          Odpowiada na pytanie: czy przy podobnym wysiłku sercowym poruszasz się szybciej?
        </>
      }
      interpretation={
        <>
          <strong>Kiedy jest dobrze?</strong> Gdy trend EF rośnie lub utrzymuje się przy podobnych
          warunkach (teren, temperatura, podobna intensywność). <strong>Kiedy nie?</strong> Gdy EF
          wyraźnie spada przez kilka tygodni — często oznacza zmęczenie, zbyt dużo intensywności albo
          gorsze warunki. Najbardziej miarodajne są spokojne biegi („easy”).
        </>
      }
      insight={insight}
    >
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <label style={{ fontWeight: 700, color: "#374151" }}>
          Tryb&nbsp;
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="easy">Easy (HR ≤ próg)</option>
            <option value="all">Wszystkie</option>
          </select>
        </label>
        {mode === "easy" && (
          <label style={{ fontWeight: 700, color: "#374151" }}>
            Próg „easy” (średnie HR ≤)&nbsp;
            <input
              type="number"
              min="100"
              max="200"
              value={maxHr}
              onChange={(e) => setMaxHr(Number(e.target.value))}
              style={{ width: 90, marginLeft: 6 }}
            />
          </label>
        )}
        {mode === "easy" && (
          <div style={{ color: "#6b7280", fontSize: "0.92rem" }}>
            W trybie <strong>Easy</strong> analizujemy tylko treningi, gdzie <strong>średnie tętno</strong> nie
            przekracza progu. Dzięki temu porównujesz podobną intensywność (bardziej „baza tlenowa”).
          </div>
        )}
      </div>

      {loading && <div>Ładowanie…</div>}
      {!loading && error && <div style={{ color: "#b91c1c" }}>{error}</div>}
      {!loading && !error && filteredPoints.length === 0 && (
        <div>Brak danych HR+speed w tym okresie (EF wymaga tętna i prędkości).</div>
      )}
      {!loading && !error && filteredPoints.length > 0 && (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" type="category" />
            <YAxis dataKey="ef" />
            <Tooltip
              formatter={(v, name) => {
                if (name === "ef") return [v, "EF"];
                return [v, name];
              }}
              labelFormatter={(l) => `Dzień: ${l}`}
            />
            <Scatter name="EF (punkty)" data={filteredPoints} fill="#4f46e5" />
            <Line
              type="monotone"
              dataKey="trend"
              data={trend}
              stroke="#10b981"
              dot={false}
              connectNulls
              name="Trend (rolling avg)"
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}
    </PanelShell>
  );
}


