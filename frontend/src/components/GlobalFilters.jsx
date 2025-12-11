import { Filter, X, Calendar } from "lucide-react";
import { useFilters } from "../context/FilterContext";
import "./GlobalFilters.css";

function GlobalFilters({
  showMetric = true,
  showPeriod = true,
  showType = true,
}) {
  const {
    activityType,
    setActivityType,
    metric,
    setMetric,
    dateRange,
    setDateRange,
    availableTypes,
    resetFilters,
  } = useFilters();

  const metricOptions = [
    { value: "distance", label: "Dystans" },
    { value: "duration", label: "Czas" },
    { value: "averageSpeed", label: "Średnia prędkość" },
    { value: "averageHeartRate", label: "Średnie tętno" },
    { value: "elevationGain", label: "Przewyższenie" },
    { value: "calories", label: "Kalorie" },
  ];

  const formatDateForInput = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleStartDateChange = (e) => {
    const newStart = e.target.value ? new Date(e.target.value) : null;
    setDateRange({ ...dateRange, start: newStart });
  };

  const handleEndDateChange = (e) => {
    const newEnd = e.target.value ? new Date(e.target.value) : null;
    setDateRange({ ...dateRange, end: newEnd });
  };

  const hasActiveFilters =
    activityType !== "all" || metric !== "distance";

  return (
    <div className="global-filters">
      <div className="filters-header">
        <div className="filters-title">
          <Filter size={20} />
          <span>Filtry</span>
        </div>
        {hasActiveFilters && (
          <button className="reset-filters" onClick={resetFilters}>
            <X size={16} />
            Resetuj
          </button>
        )}
      </div>

      <div className="filters-content">
        {showType && (
          <div className="filter-group">
            <label htmlFor="activity-type">Typ aktywności</label>
            <select
              id="activity-type"
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="filter-select"
            >
              <option value="all">Wszystkie typy</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        )}

        {showPeriod && (
          <div className="filter-group">
            <label>
              <Calendar size={16} />
              Okres
            </label>
            <div className="date-range-inputs">
              <div className="date-input-wrapper">
                <span className="date-label">Od</span>
                <input
                  type="date"
                  value={formatDateForInput(dateRange.start)}
                  onChange={handleStartDateChange}
                  className="filter-date-input"
                />
              </div>
              <div className="date-input-wrapper">
                <span className="date-label">Do</span>
                <input
                  type="date"
                  value={formatDateForInput(dateRange.end)}
                  onChange={handleEndDateChange}
                  className="filter-date-input"
                />
              </div>
            </div>
          </div>
        )}

        {showMetric && (
          <div className="filter-group">
            <label htmlFor="metric">Metryka</label>
            <select
              id="metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="filter-select"
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {hasActiveFilters && (
        <div className="active-filters-summary">
          <span className="filters-count">
            {activityType !== "all" && (
              <span className="filter-badge">{activityType}</span>
            )}
            {metric !== "distance" && (
              <span className="filter-badge">
                {metricOptions.find((m) => m.value === metric)?.label}
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

export default GlobalFilters;
