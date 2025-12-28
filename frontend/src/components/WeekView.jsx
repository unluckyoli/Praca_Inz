import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Plus, ChevronRight, ChevronDown, ChevronUp, X } from "lucide-react";
import "./WeekView.css";

function WeekView({ week, onWorkoutClick, onWorkoutMove, onAddWorkout, onWorkoutReorder, onDeleteWorkout }) {
  const [draggedWorkout, setDraggedWorkout] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dragOverWorkout, setDragOverWorkout] = useState(null);
  const [hoverTip, setHoverTip] = useState(null); // { lines, left, top, placement, width }
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(`week-${week?.id}-expanded`);
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    if (week?.id) {
      localStorage.setItem(`week-${week.id}-expanded`, JSON.stringify(isExpanded));
    }
  }, [isExpanded, week?.id]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const daysOfWeek = [
    { value: 1, label: "Pon", fullLabel: "Poniedziałek" },
    { value: 2, label: "Wto", fullLabel: "Wtorek" },
    { value: 3, label: "Śro", fullLabel: "Środa" },
    { value: 4, label: "Czw", fullLabel: "Czwartek" },
    { value: 5, label: "Pią", fullLabel: "Piątek" },
    { value: 6, label: "Sob", fullLabel: "Sobota" },
    { value: 7, label: "Nie", fullLabel: "Niedziela" },
  ];

  const workoutTypeColors = {
    EASY_RUN: "#10b981",
    LONG_RUN: "#3b82f6",
    TEMPO_RUN: "#f59e0b",
    INTERVALS: "#ef4444",
    FARTLEK: "#ec4899",
    RECOVERY: "#8b5cf6",
    RACE_PACE: "#f97316",
    HILL_REPEATS: "#14b8a6",
    CROSS_TRAINING: "#6366f1",
    REST: "#9ca3af",
    REST_MOBILITY: "#a78bfa",
  };

  const workoutTypeIcons = {
    EASY_RUN: "🏃",
    LONG_RUN: "🏃‍♂️",
    TEMPO_RUN: "⚡",
    INTERVALS: "🔥",
    FARTLEK: "💨",
    RECOVERY: "😌",
    RACE_PACE: "🎯",
    HILL_REPEATS: "⛰️",
    CROSS_TRAINING: "🚴",
    REST: "😴",
    REST_MOBILITY: "🧘",
  };

  const parseIntervals = (intervals) => {
    if (!intervals) return null;
    try {
      return typeof intervals === "string" ? JSON.parse(intervals) : intervals;
    } catch {
      return null;
    }
  };

  const fmtPace = (pace) => (pace ? `${pace}/km` : "");

  const summarizeBlocks = (blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return null;
    const warmup = blocks.find((b) => b?.type === "warmup");
    const cooldown = blocks.findLast ? blocks.findLast((b) => b?.type === "cooldown") : [...blocks].reverse().find((b) => b?.type === "cooldown");
    const main = blocks.filter((b) => !["warmup", "cooldown"].includes(b?.type));

    // find first interval+recovery pattern and count repeats
    let mainLine = null;
    for (let i = 0; i < main.length - 1; i++) {
      const a = main[i];
      const b = main[i + 1];
      if (a?.type === "intervals" && b?.type === "recovery") {
        const durA = Math.round(Number(a.duration) || 0);
        const durB = Math.round(Number(b.duration) || 0);
        const paceA = a.pace;
        const sig = `${durA}|${paceA}|${durB}`;
        let count = 1;
        let j = i + 2;
        while (j + 1 < main.length) {
          const aa = main[j];
          const bb = main[j + 1];
          if (aa?.type !== "intervals" || bb?.type !== "recovery") break;
          const sig2 = `${Math.round(Number(aa.duration) || 0)}|${aa.pace}|${Math.round(Number(bb.duration) || 0)}`;
          if (sig2 !== sig) break;
          count += 1;
          j += 2;
        }
        mainLine = `${count}x (${durA}min ${fmtPace(paceA)} + ${durB}min rec)`;
        break;
      }
    }

    if (!mainLine) {
      const tempo = main.find((b) => b?.type === "tempo");
      const primary = tempo || main.find((b) => b?.type === "main") || main[0];
      if (primary?.duration) {
        mainLine = `${Math.round(primary.duration)}min ${fmtPace(primary.pace)}`.trim();
      }
    }

    const lines = [];
    if (warmup?.duration) lines.push(`Rozgrzewka: ${Math.round(warmup.duration)}min ${fmtPace(warmup.pace)}`.trim());
    if (mainLine) lines.push(mainLine);
    if (cooldown?.duration) lines.push(`Wychłodzenie: ${Math.round(cooldown.duration)}min ${fmtPace(cooldown.pace)}`.trim());
    return lines.filter(Boolean);
  };

  const getWorkoutPreviewLines = (workout) => {
    const intervals = parseIntervals(workout?.intervals);
    if (!intervals) return null;
    if (intervals.blocks) return summarizeBlocks(intervals.blocks);
    // legacy string format
    const lines = [];
    if (intervals.warmup) lines.push(`Rozgrzewka: ${intervals.warmup}`);
    if (intervals.main || intervals.intervals) lines.push(intervals.main || intervals.intervals);
    if (intervals.cooldown) lines.push(`Wychłodzenie: ${intervals.cooldown}`);
    return lines.length ? lines : null;
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  const showTooltipFor = (el, workout) => {
    if (!el || draggedWorkout) return;
    const lines = getWorkoutPreviewLines(workout);
    if (!lines || lines.length === 0) {
      setHoverTip(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(360, window.innerWidth - margin * 2);

    const left = clamp(rect.left, margin, window.innerWidth - width - margin);
    const preferBelowTop = rect.bottom + 10;
    const estimatedHeight = 110; // 3 short lines + padding
    const fitsBelow = preferBelowTop + estimatedHeight <= window.innerHeight - margin;
    const placement = fitsBelow ? "below" : "above";
    const top = placement === "below" ? preferBelowTop : rect.top - 10;

    setHoverTip({
      lines: lines.slice(0, 3),
      left,
      top,
      placement,
      width,
    });
  };

  const hideTooltip = () => setHoverTip(null);

  useEffect(() => {
    if (!hoverTip) return;
    const onScroll = () => setHoverTip(null);
    const onResize = () => setHoverTip(null);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [hoverTip]);

  const getWorkoutsForDay = (dayOfWeek) => {
    if (!week?.workouts) return [];
    return week.workouts
      .filter((w) => w.dayOfWeek === dayOfWeek)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  };

  const handleDragStart = (e, workout) => {
    setDraggedWorkout(workout);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", workout.id);
    e.currentTarget.classList.add("dragging");
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove("dragging");
    setDraggedWorkout(null);
    setDragOverDay(null);
  };

  const handleDragOver = (e, dayOfWeek) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDragOverDay(dayOfWeek);
  };

  const handleDragEnter = (e, dayOfWeek) => {
    e.preventDefault();
    setDragOverDay(dayOfWeek);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setDragOverDay(null);
    }
  };

  const handleDrop = async (e, targetDayOfWeek, targetOrder = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDay(null);
    setDragOverWorkout(null);

    if (!isExpanded) {
      setDraggedWorkout(null);
      return;
    }

    if (!draggedWorkout) {
      setDraggedWorkout(null);
      return;
    }

    if (draggedWorkout.dayOfWeek === targetDayOfWeek && targetOrder !== null) {
      if (onWorkoutReorder) {
        await onWorkoutReorder(draggedWorkout.id, targetOrder);
      }
      setDraggedWorkout(null);
      return;
    }
    
    if (draggedWorkout.dayOfWeek === targetDayOfWeek && targetOrder === null) {
      setDraggedWorkout(null);
      return;
    }

    try {
      await onWorkoutMove(draggedWorkout.id, targetDayOfWeek);
    } catch (error) {
      console.error("Failed to move workout:", error);
    }

    setDraggedWorkout(null);
  };

  const handleWorkoutDragOver = (e, workout, index) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverWorkout(workout.id);
  };

  const handleWorkoutDrop = async (e, targetWorkout, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverWorkout(null);

    if (!draggedWorkout || draggedWorkout.id === targetWorkout.id) {
      setDraggedWorkout(null);
      return;
    }

    await handleDrop(e, targetWorkout.dayOfWeek, targetIndex);
  };

  return (
    <div className="week-view">
      <div className="week-view-header">
        <button 
          className="week-toggle-btn"
          onClick={toggleExpanded}
          title={isExpanded ? "Zwiń tydzień" : "Rozwiń tydzień"}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          <span className="week-toggle-text">
            {isExpanded ? "Zwiń" : "Rozwiń"}
          </span>
        </button>
        <div className="week-summary">
          {week && (
            <>
              <span className="week-workouts-count">
                {week.workouts?.length || 0} {week.workouts?.length === 1 ? 'trening' : 'treningi'}
              </span>
              {(week.totalDistance > 0 || week.totalDuration > 0) && (
                <span className="week-stats-compact">
                  {week.totalDistance > 0 && `${week.totalDistance.toFixed(1)}km`}
                  {week.totalDistance > 0 && week.totalDuration > 0 && ' • '}
                  {week.totalDuration > 0 && `${week.totalDuration}min`}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className={`week-days-grid ${!isExpanded ? 'collapsed' : ''}`}>
        {daysOfWeek.map((day) => {
          const workouts = getWorkoutsForDay(day.value);
          const hasWorkouts = workouts.length > 0;
          const isDragOver = dragOverDay === day.value;

          return (
            <div
              key={day.value}
              className={`day-cell ${!hasWorkouts ? "empty" : ""} ${
                isDragOver ? "drag-over" : ""
              } ${!isExpanded ? "collapsed" : ""}`}
              onDragOver={isExpanded ? (e) => handleDragOver(e, day.value) : undefined}
              onDragEnter={isExpanded ? (e) => handleDragEnter(e, day.value) : undefined}
              onDragLeave={isExpanded ? handleDragLeave : undefined}
              onDrop={isExpanded ? (e) => handleDrop(e, day.value) : undefined}
              onClick={!isExpanded && hasWorkouts ? () => setIsExpanded(true) : undefined}
            >
              <div className="day-header">
                <div className="day-header-content">
                  <span className="day-label">{day.label}</span>
                </div>
              </div>

              {!isExpanded ? (
                <div className="day-collapsed-indicator">
                  {hasWorkouts && (
                    <div className="workout-dots">
                      {workouts.slice(0, 3).map((workout) => (
                        <div
                          key={workout.id}
                          className="workout-dot"
                          style={{
                            backgroundColor: workoutTypeColors[workout.workoutType] || "#9ca3af",
                          }}
                          title={workout.name}
                        />
                      ))}
                      {workouts.length > 3 && (
                        <span className="workout-dot-count">+{workouts.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="day-workouts">
                  {workouts.length === 0 ? (
                    <div className="no-workout">
                      <span className="no-workout-text">Brak</span>
                    </div>
                  ) : workouts.length === 1 ? (
                  <div
                    className="workout-badge"
                    draggable
                    onDragStart={(e) => handleDragStart(e, workouts[0])}
                    onDragEnd={handleDragEnd}
                    onMouseEnter={(e) => showTooltipFor(e.currentTarget, workouts[0])}
                    onMouseLeave={hideTooltip}
                    style={{
                      borderLeftColor:
                        workoutTypeColors[workouts[0].workoutType] || "#9ca3af",
                    }}
                  >
                    <div 
                      className="workout-badge-main"
                      onClick={() => onWorkoutClick(workouts[0])}
                    >
                      <div className="workout-grip">
                        <GripVertical size={12} />
                      </div>
                      <div className="workout-badge-content">
                      <span className="workout-icon">
                        {workoutTypeIcons[workouts[0].workoutType] || "🏃"}
                      </span>
                      <div className="workout-info">
                        <div className="workout-name">{workouts[0].name}</div>
                        <div className="workout-meta">
                          {workouts[0].targetDistance > 0 && (
                            <span>{workouts[0].targetDistance.toFixed(1)}km</span>
                          )}
                          {workouts[0].targetDuration > 0 && (
                            <span>{workouts[0].targetDuration}min</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="workout-arrow" />
                    </div>
                    <button
                      className="workout-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteWorkout && window.confirm(`Czy na pewno chcesz usunąć trening "${workouts[0].name}"?`)) {
                          onDeleteWorkout(workouts[0].id);
                        }
                      }}
                      title="Usuń trening"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  ) : (
                    <div className="multiple-workouts">
                    {workouts.slice(0, 2).map((workout, index) => (
                      <div
                        key={workout.id}
                        className={`workout-badge compact ${dragOverWorkout === workout.id ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, workout)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleWorkoutDragOver(e, workout, index)}
                        onDrop={(e) => handleWorkoutDrop(e, workout, index)}
                        onMouseEnter={(e) => showTooltipFor(e.currentTarget, workout)}
                        onMouseLeave={hideTooltip}
                        style={{
                          borderLeftColor:
                            workoutTypeColors[workout.workoutType] || "#9ca3af",
                        }}
                      >
                        <div 
                          className="workout-badge-main"
                          onClick={() => onWorkoutClick(workout)}
                        >
                          <div className="workout-grip">
                            <GripVertical size={10} />
                          </div>
                          <span className="workout-icon small">
                            {workoutTypeIcons[workout.workoutType] || "🏃"}
                          </span>
                          <div className="workout-info">
                          <span className="workout-name compact">
                            {workout.name}
                          </span>
                          {(workout.targetDistance > 0 || workout.targetDuration > 0) && (
                            <span className="workout-compact-distance">
                              {workout.targetDistance > 0 && `${workout.targetDistance.toFixed(1)}km`}
                              {workout.targetDistance > 0 && workout.targetDuration > 0 && ' • '}
                              {workout.targetDuration > 0 && `${workout.targetDuration}min`}
                            </span>
                          )}
                        </div>
                        </div>
                        <button
                          className="workout-delete-btn compact"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onDeleteWorkout && window.confirm(`Czy na pewno chcesz usunąć trening "${workout.name}"?`)) {
                              onDeleteWorkout(workout.id);
                            }
                          }}
                          title="Usuń trening"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {workouts.length > 2 && (
                      <div 
                        className="more-workouts"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay({ day: day.value, workouts, dayLabel: day.fullLabel });
                          setShowDayModal(true);
                        }}
                      >
                        +{workouts.length - 2}
                      </div>
                    )}
                  </div>
                  )}
                  {isExpanded && (
                    <button
                      className="add-workout-btn-bottom"
                      onClick={() => onAddWorkout(day.value)}
                      title={`Dodaj trening w ${day.fullLabel}`}
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showDayModal && selectedDay && (
        <div className="day-modal-overlay" onClick={() => setShowDayModal(false)}>
          <div className="day-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="day-modal-header">
              <h3>Treningi - {selectedDay.dayLabel}</h3>
              <button className="day-modal-close" onClick={() => setShowDayModal(false)}>
                ✕
              </button>
            </div>
            <div className="day-modal-workouts">
              {selectedDay.workouts.map((workout, index) => (
                <div
                  key={workout.id}
                  className="day-modal-workout"
                  draggable
                  onDragStart={(e) => handleDragStart(e, workout)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleWorkoutDragOver(e, workout, index)}
                  onDrop={(e) => handleWorkoutDrop(e, workout, index)}
                  onClick={() => {
                    onWorkoutClick(workout);
                    setShowDayModal(false);
                  }}
                  style={{
                    borderLeftColor: workoutTypeColors[workout.workoutType] || "#9ca3af",
                  }}
                >
                  <div className="workout-grip">
                    <GripVertical size={14} />
                  </div>
                  <span className="workout-icon">
                    {workoutTypeIcons[workout.workoutType] || "🏃"}
                  </span>
                  <div className="workout-info">
                    <div className="workout-name">{workout.name}</div>
                    <div className="workout-meta">
                      {workout.targetDistance > 0 && (
                        <span>{workout.targetDistance.toFixed(1)}km</span>
                      )}
                      {workout.targetDuration > 0 && (
                        <span>{workout.targetDuration}min</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="workout-arrow" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hoverTip &&
        createPortal(
          <div
            className={`workout-hover-tooltip-fixed ${hoverTip.placement}`}
            style={{
              left: `${hoverTip.left}px`,
              top: `${hoverTip.top}px`,
              width: `${hoverTip.width}px`,
            }}
            role="tooltip"
          >
            {hoverTip.lines.map((line, idx) => (
              <div key={idx} className="workout-hover-line">
                {line}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default WeekView;
