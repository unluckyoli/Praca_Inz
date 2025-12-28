import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import GlobalFilters from "../components/GlobalFilters";
import { useFilters } from "../context/FilterContext";
import Accordion from "../components/analytics/Accordion";
import "./AnalyticsPage.css";

const CalendarHeatmapPanel = lazy(() =>
  import("../components/analytics/panels/CalendarHeatmapPanel"),
);
const RampRatePanel = lazy(() => import("../components/analytics/panels/RampRatePanel"));
const AerobicEfficiencyPanel = lazy(() =>
  import("../components/analytics/panels/AerobicEfficiencyPanel"),
);
const TimePatternsPanel = lazy(() =>
  import("../components/analytics/panels/TimePatternsPanel"),
);
const YearOverYearPanel = lazy(() =>
  import("../components/analytics/panels/YearOverYearPanel"),
);

function AnalyticsPage() {
  const { dateRange, activityType } = useFilters();
  const [searchParams, setSearchParams] = useSearchParams();

  const [openId, setOpenId] = useState(searchParams.get("panel") || null);

  const [cache, setCache] = useState({});

  useEffect(() => {
    // keep state in sync with back/forward navigation
    const p = searchParams.get("panel") || null;
    // if URL points to a removed/unknown panel, close it
    const allowed = new Set(["ramp", "ef", "time", "heatmap", "yoy"]);
    setOpenId(p && allowed.has(p) ? p : null);
  }, [searchParams]);

  const panels = useMemo(() => ([
    {
      id: "ramp",
      section: "Forma",
      badges: ["Forma"],
      title: "Bezpieczeństwo obciążenia (Ramp Rate)",
      collapsedDescription: "Jak szybko rośnie obciążenie tydzień do tygodnia (ryzyko przeciążenia).",
      requirements: [],
      Component: RampRatePanel,
    },
    {
      id: "ef",
      section: "Insights",
      badges: ["Insights"],
      title: "Efektywność aerobowa (tempo vs tętno)",
      collapsedDescription: "Czy biegasz szybciej przy tym samym tętnie? (EF trend).",
      requirements: ["HR"],
      Component: AerobicEfficiencyPanel,
    },
    {
      id: "time",
      section: "Insights",
      badges: ["Insights"],
      title: "Kiedy trenujesz najlepiej (wzorce czasowe)",
      collapsedDescription: "Godziny i dni tygodnia: częstotliwość i jakość (speed/EF/load).",
      requirements: [],
      Component: TimePatternsPanel,
    },
    {
      id: "heatmap",
      section: "Analiza",
      badges: ["Analiza"],
      title: "Kalendarz treningów (heatmapa)",
      collapsedDescription: "Systematyczność i bodziec dnia w stylu GitHub.",
      requirements: [],
      Component: CalendarHeatmapPanel,
    },
    {
      id: "yoy",
      section: "Analiza",
      badges: ["Analiza"],
      title: "Rok do roku (porównanie sezonów)",
      collapsedDescription: "Overlay miesięczny: ten rok vs poprzedni (km/czas/load).",
      requirements: [],
      Component: YearOverYearPanel,
    },
  ]), []);

  const grouped = useMemo(() => {
    const map = new Map([["Forma", []], ["Insights", []], ["Analiza", []]]);
    panels.forEach((p) => map.get(p.section).push(p));
    return map;
  }, [panels]);

  const toggle = (id) => {
    setOpenId((prev) => {
      const next = prev === id ? null : id;
      const sp = new URLSearchParams(searchParams);
      if (next) sp.set("panel", next);
      else sp.delete("panel");
      setSearchParams(sp, { replace: true });
      return next;
    });
  };

  return (
    <Layout>
      <div className="analytics-page">
        <h1>Analiza treningów</h1>

        <GlobalFilters showMetric={false} />

        <div className="analytics-sections">
          {Array.from(grouped.entries()).map(([sectionName, items]) => (
            <div key={sectionName} className="analytics-section">
              <h2 className="analytics-section-title">{sectionName}</h2>
              <Accordion
                items={items}
                openId={openId}
                onToggle={toggle}
                renderBody={(item) => {
                  const Comp = item.Component;
                  return (
                    <Suspense fallback={<div>Ładowanie modułu wykresu…</div>}>
                      <Comp
                        cache={cache}
                        setCache={setCache}
                        dateRange={dateRange}
                        activityType={activityType}
                      />
                    </Suspense>
                  );
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default AnalyticsPage;
