import { useState, useEffect } from "react";
import { GripVertical, Plus, ChevronRight, ChevronDown, ChevronUp, X } from "lucide-react";
import "./WeekView.css";

function WeekView({ week, onWorkoutClick, onWorkoutMove, onAddWorkout, onWorkoutReorder, onDeleteWorkout }) {
  const [draggedWorkout, setDraggedWorkout] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dragOverWorkout, setDragOverWorkout] = useState(null);
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
    </div>
  );
}

export default WeekView;
