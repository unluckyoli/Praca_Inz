import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Target,
  TrendingUp,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  CalendarPlus,
  Edit2,
  Trash2,
  Plus,
  Grid3x3,
  List,
  Wand2,
} from "lucide-react";
import Layout from "../components/Layout";
import WorkoutModal from "../components/WorkoutModal";
import WeekView from "../components/WeekView";
import { trainingPlanAPI, authAPI } from "../services/api";
import "./TrainingPlanDetailPage.css";

function TrainingPlanDetailPage() {
  const { planId } = useParams();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedWeeks, setExpandedWeeks] = useState([0]);
  const [completingWorkout, setCompletingWorkout] = useState(null);
  const [syncingToCalendar, setSyncingToCalendar] = useState(false);
  const [calendarSyncMessage, setCalendarSyncMessage] = useState(null);
  const [recomputeMsg, setRecomputeMsg] = useState(null);
  const [recomputing, setRecomputing] = useState(false);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(null);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [viewMode, setViewMode] = useState("week"); // "week" or "list"
  const [showStartDateModal, setShowStartDateModal] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [editingPlanName, setEditingPlanName] = useState(false);
  const [planNameInput, setPlanNameInput] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      setError(null);
      const res = await trainingPlanAPI.getMyPlanById(planId);
      setPlan(res.data.plan);
      
      const currentWeek = findCurrentWeek(res.data.plan.weeks);
      if (currentWeek !== -1) {
        setExpandedWeeks([currentWeek]);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/");
        return;
      }
      console.error("Fetch plan error:", error);
      setError("Błąd podczas ładowania planu treningowego");
    } finally {
      setLoading(false);
    }
  };

  const findCurrentWeek = (weeks) => {
    if (!weeks) return -1;
    
    for (let i = 0; i < weeks.length; i++) {
      const hasIncomplete = weeks[i].workouts?.some((w) => !w.completed);
      if (hasIncomplete) return i;
    }
    
    return weeks.length - 1; 
  };

  const toggleWeek = (weekIndex) => {
    setExpandedWeeks((prev) =>
      prev.includes(weekIndex)
        ? prev.filter((i) => i !== weekIndex)
        : [...prev, weekIndex]
    );
  };

  const handleCompleteWorkout = async (workoutId) => {
    const actualDistance = prompt("Dystans (w km, opcjonalnie):");
    const actualDuration = prompt("Czas (w minutach, opcjonalnie):");
    const notes = prompt("Notatki (opcjonalnie):");

    setCompletingWorkout(workoutId);

    try {
      const payload = {
        actualDistance: actualDistance ? parseFloat(actualDistance) * 1000 : null,
        actualDuration: actualDuration ? parseInt(actualDuration) * 60 : null,
        notes: notes || null,
      };

      await trainingPlanAPI.completeWorkout(workoutId, payload);
      await fetchPlan(); 
    } catch (error) {
      console.error("Complete workout error:", error);
      alert("Błąd podczas zapisywania treningu");
    } finally {
      setCompletingWorkout(null);
    }
  };

  const handleSyncToCalendar = () => {
    // Pokaż modal wyboru daty rozpoczęcia
    const nextMonday = getNextMonday();
    setSelectedStartDate(nextMonday);
    setShowStartDateModal(true);
  };

  const getNextMonday = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  };

  const handleConfirmSync = async () => {
    setShowStartDateModal(false);
    setSyncingToCalendar(true);
    setCalendarSyncMessage(null);

    try {
      const response = await trainingPlanAPI.syncToCalendar(planId, selectedStartDate);
      
      setCalendarSyncMessage({
        type: 'success',
        text: `✅ Zsynchronizowano ${response.data.totalEvents || response.data.totalTasks || 0} treningów do Google Calendar!`,
      });
      
      await fetchPlan();
      
      setTimeout(() => setCalendarSyncMessage(null), 5000);
    } catch (error) {
      console.error("Sync to calendar error:", error);
      
      const code = error.response?.data?.code;
      if (error.response?.data?.requiresGoogleAuth) {
        const userConfirmed = window.confirm(
          code === "google_missing_refresh_token"
            ? "Twoje połączenie Google jest niekompletne (brak refresh tokena).\n\nKliknij OK aby połączyć ponownie Google.\nJeśli problem wróci: wejdź w ustawienia konta Google i cofnij dostęp aplikacji, a potem połącz ponownie."
            : code === "google_calendar_scope_missing"
            ? "Aby zsynchronizować plan do Google Calendar, musisz połączyć konto Google z uprawnieniami do Kalendarza. Czy chcesz to zrobić teraz?"
            : "Aby zsynchronizować plan do Google Calendar, musisz połączyć konto Google. Czy chcesz to zrobić teraz?"
        );
        
        if (userConfirmed) {
          try {
            const authRes = await authAPI.googleAuth();
            window.location.href = authRes.data.authUrl;
          } catch (authError) {
            console.error('Google auth error:', authError);
            setCalendarSyncMessage({
              type: 'error',
              text: 'Błąd podczas łączenia z Google',
            });
          }
        }
      } else {
        setCalendarSyncMessage({
          type: 'error',
          text: error.response?.data?.error || 'Błąd podczas synchronizacji do Google Calendar',
        });
      }
      
      setTimeout(() => setCalendarSyncMessage(null), 5000);
    } finally {
      setSyncingToCalendar(false);
    }
  };

  const handleRecomputeWorkouts = async () => {
    const ok = window.confirm(
      "Naprawić tytuły i metryki treningów na podstawie struktury (warmup/interwały/cooldown)?\n\n" +
        "To przeliczy nazwę, dystans, czas i tempo z intervals.blocks dla treningów w tym planie.",
    );
    if (!ok) return;

    setRecomputing(true);
    setRecomputeMsg(null);
    try {
      const res = await trainingPlanAPI.recomputeWorkouts(planId);
      setRecomputeMsg({
        type: "success",
        text: `✅ Przeliczono: ${res.data.updated}/${res.data.processed} (pominięto: ${res.data.skipped}, błędy: ${res.data.errors})`,
      });
      await fetchPlan();
      setTimeout(() => setRecomputeMsg(null), 7000);
    } catch (e) {
      setRecomputeMsg({
        type: "error",
        text: e.response?.data?.error || "Błąd podczas przeliczania treningów",
      });
      setTimeout(() => setRecomputeMsg(null), 7000);
    } finally {
      setRecomputing(false);
    }
  };

  const handleEditWorkout = (workout, weekNumber) => {
    setEditingWorkout(workout);
    setSelectedWeek(weekNumber);
    setShowWorkoutModal(true);
  };

  const handleDeleteWorkout = async (workoutId) => {
    if (!confirm("Czy na pewno chcesz usunąć ten trening?")) {
      return;
    }

    try {
      await trainingPlanAPI.deleteWorkout(workoutId);
      await fetchPlan();
    } catch (error) {
      console.error("Delete workout error:", error);
      alert("Błąd podczas usuwania treningu");
    }
  };

  const handleSaveWorkout = async (workoutData) => {
    try {
      console.log('Saving workout data:', workoutData);
      
      if (editingWorkout) {
        const response = await trainingPlanAPI.updateWorkout(editingWorkout.id, workoutData);
        console.log('Update response:', response.data);
      } else {
        const response = await trainingPlanAPI.addWorkout(planId, workoutData);
        console.log('Add response:', response.data);
      }
      
      setShowWorkoutModal(false);
      setEditingWorkout(null);
      setSelectedWeek(null);
      setSelectedDay(null);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchPlan();
    } catch (error) {
      console.error("Save workout error:", error);
      console.error("Error response:", error.response?.data);
      alert("Błąd podczas zapisywania treningu: " + (error.response?.data?.error || error.message));
    }
  };

  const handleWorkoutMove = async (workoutId, newDayOfWeek) => {
    try {
      const workout = plan.weeks
        .flatMap(w => w.workouts)
        .find(w => w.id === workoutId);
      
      if (!workout) {
        throw new Error("Workout not found");
      }

      setPlan(prevPlan => ({
        ...prevPlan,
        weeks: prevPlan.weeks.map(week => ({
          ...week,
          workouts: week.workouts.map(w =>
            w.id === workoutId ? { ...w, dayOfWeek: newDayOfWeek } : w
          )
        }))
      }));

      await trainingPlanAPI.updateWorkout(workoutId, {
        ...workout,
        dayOfWeek: newDayOfWeek,
      });

      await fetchPlan();
    } catch (error) {
      console.error("Move workout error:", error);
      alert("Błąd podczas przenoszenia treningu");
      await fetchPlan();
    }
  };

  const handleWorkoutReorder = async (workoutId, newOrder) => {
    try {
      const workout = plan.weeks
        .flatMap(w => w.workouts)
        .find(w => w.id === workoutId);
      
      if (!workout) {
        throw new Error("Workout not found");
      }

      const sameDayWorkouts = plan.weeks
        .flatMap(w => w.workouts)
        .filter(w => w.dayOfWeek === workout.dayOfWeek && w.planWeekId === workout.planWeekId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));

      const reorderedWorkouts = [...sameDayWorkouts];
      const oldIndex = reorderedWorkouts.findIndex(w => w.id === workoutId);
      const [movedWorkout] = reorderedWorkouts.splice(oldIndex, 1);
      reorderedWorkouts.splice(newOrder, 0, movedWorkout);

      for (let i = 0; i < reorderedWorkouts.length; i++) {
        await trainingPlanAPI.updateWorkout(reorderedWorkouts[i].id, {
          ...reorderedWorkouts[i],
          order: i,
        });
      }

      await fetchPlan();
    } catch (error) {
      console.error("Reorder workout error:", error);
      alert("Błąd podczas zmiany kolejności");
      await fetchPlan();
    }
  };

  const handleAddWorkout = (weekNumber, dayOfWeek) => {
    setSelectedWeek(weekNumber);
    setSelectedDay(dayOfWeek);
    setEditingWorkout(null);
    setShowWorkoutModal(true);
  };

  const handleWorkoutClick = (workout) => {
    setEditingWorkout(workout);
    setShowWorkoutModal(true);
  };

  const handleEditPlanName = () => {
    setPlanNameInput(plan.name || "");
    setEditingPlanName(true);
  };

  const handleSavePlanName = async () => {
    if (!planNameInput.trim()) {
      alert("Nazwa planu nie może być pusta");
      return;
    }

    try {
      await trainingPlanAPI.updatePlanName(planId, planNameInput.trim());
      setEditingPlanName(false);
      await fetchPlan();
    } catch (error) {
      console.error("Update plan name error:", error);
      alert("Błąd podczas zapisywania nazwy planu");
    }
  };

  const handleCancelEditPlanName = () => {
    setEditingPlanName(false);
    setPlanNameInput("");
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getDayName = (dayNum) => {
    const days = [
      "Poniedziałek",
      "Wtorek",
      "Środa",
      "Czwartek",
      "Piątek",
      "Sobota",
      "Niedziela",
    ];
    return days[dayNum - 1] || "";
  };

  const getWorkoutTypeLabel = (type) => {
    const labels = {
      EASY_RUN: "Bieg łatwy",
      LONG_RUN: "Bieg długi",
      TEMPO_RUN: "Bieg tempo",
      INTERVALS: "Interwały",
      THRESHOLD_RUN: "Bieg progowy",
      RECOVERY_RUN: "Bieg regeneracyjny",
      HILL_REPEATS: "Podbieganie",
      FARTLEK: "Fartlek",
      RACE_PACE: "Tempo wyścigowe",
      REST: "Odpoczynek",
    };
    return labels[type] || type;
  };

  const calculateProgress = () => {
    if (!plan || !plan.weeks) return 0;
    
    let totalWorkouts = 0;
    let completedWorkouts = 0;

    plan.weeks.forEach((week) => {
      if (week.workouts) {
        totalWorkouts += week.workouts.length;
        completedWorkouts += week.workouts.filter((w) => w.completed).length;
      }
    });

    return totalWorkouts > 0
      ? Math.round((completedWorkouts / totalWorkouts) * 100)
      : 0;
  };

  if (loading) {
    return (
      <Layout>
        <div className="plan-detail-page">
          <div className="loading">Ładowanie planu...</div>
        </div>
      </Layout>
    );
  }

  if (error || !plan) {
    return (
      <Layout>
        <div className="plan-detail-page">
          <div className="error-message">{error || "Plan nie znaleziony"}</div>
          <button className="btn btn-primary" onClick={() => navigate("/training-plans")}>
            Powrót do planów
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="plan-detail-page">
        {showStartDateModal && (
          <div className="modal-overlay" onClick={() => setShowStartDateModal(false)}>
            <div className="start-date-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Wybierz datę rozpoczęcia planu</h2>
              <p className="modal-description">
                Plan treningowy rozpocznie się w poniedziałek wybranego tygodnia.
              </p>
              
              <div className="date-picker-container">
                <label htmlFor="startDate">Data rozpoczęcia (poniedziałek):</label>
                <input
                  type="date"
                  id="startDate"
                  value={selectedStartDate}
                  onChange={(e) => setSelectedStartDate(e.target.value)}
                  className="date-input"
                />
              </div>

              <div className="modal-actions">
                <button 
                  className="modal-btn cancel-btn"
                  onClick={() => setShowStartDateModal(false)}
                >
                  Anuluj
                </button>
                <button 
                  className="modal-btn confirm-btn"
                  onClick={handleConfirmSync}
                >
                  <CalendarPlus size={18} />
                  Synchronizuj
                </button>
              </div>
            </div>
          </div>
        )}

        <button className="back-btn" onClick={() => navigate("/training-plans")}>
          <ArrowLeft size={20} />
          Powrót do planów
        </button>

        <div className="plan-header">
          <div>
            {editingPlanName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="text"
                  value={planNameInput}
                  onChange={(e) => setPlanNameInput(e.target.value)}
                  style={{
                    fontSize: '1.75rem',
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    border: '2px solid #3b82f6',
                    borderRadius: '6px',
                    minWidth: '300px'
                  }}
                  autoFocus
                />
                <button
                  onClick={handleSavePlanName}
                  style={{
                    padding: '8px 16px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Zapisz
                </button>
                <button
                  onClick={handleCancelEditPlanName}
                  style={{
                    padding: '8px 16px',
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Anuluj
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h1>{plan.name || plan.goal}</h1>
                <button
                  onClick={handleEditPlanName}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    padding: '4px 8px'
                  }}
                  title="Edytuj nazwę planu"
                >
                  <Edit2 size={18} />
                </button>
              </div>
            )}
            <p className="plan-goal">{plan.goal}</p>
          </div>

          <div className="plan-header-actions">
            <button
              className="recompute-btn"
              onClick={handleRecomputeWorkouts}
              disabled={recomputing}
              title="Napraw tytuły i metryki treningów na podstawie struktury"
            >
              <Wand2 size={18} />
              {recomputing ? "Przeliczam..." : "Napraw tytuły"}
            </button>

            <button 
              className="sync-calendar-btn"
              onClick={handleSyncToCalendar}
              disabled={syncingToCalendar}
            >
              <CalendarPlus size={20} />
              {syncingToCalendar ? 'Synchronizacja...' : plan.syncedToGoogleTasks ? 'Aktualizuj zadania' : 'Wyślij do zadań'}
            </button>
          </div>
        </div>

        {calendarSyncMessage && (
          <div className={`calendar-sync-message ${calendarSyncMessage.type}`}>
            {calendarSyncMessage.text}
          </div>
        )}

        {recomputeMsg && (
          <div className={`calendar-sync-message ${recomputeMsg.type}`}>
            {recomputeMsg.text}
          </div>
        )}

        <div className="plan-stats-row">
          <div className="plan-stats">
            <div className="stat-card">
              <Calendar size={20} />
              <div>
                <div className="stat-label">Data biegu</div>
                <div className="stat-value">{formatDate(plan.targetRaceDate)}</div>
              </div>
            </div>
            <div className="stat-card">
              <Target size={20} />
              <div>
                <div className="stat-label">Czas trwania</div>
                <div className="stat-value">{plan.weeksCount} tygodni</div>
              </div>
            </div>
            <div className="stat-card">
              <TrendingUp size={20} />
              <div>
                <div className="stat-label">Treningów/tydzień</div>
                <div className="stat-value">{plan.sessionsPerWeek}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="progress-section">
          <div className="progress-header">
            <span className="progress-label">Postęp: {calculateProgress()}%</span>
          </div>
          <div className="progress-bar-large">
            <div
              className="progress-fill"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>

        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === "week" ? "active" : ""}`}
            onClick={() => setViewMode("week")}
            title="Widok tygodniowy"
          >
            <Grid3x3 size={18} />
            <span>Tydzień</span>
          </button>
          <button
            className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => setViewMode("list")}
            title="Widok listy"
          >
            <List size={18} />
            <span>Lista</span>
          </button>
        </div>

        <div className="weeks-container">
          {plan.weeks?.map((week, weekIndex) => (
            <div key={week.id} className="week-card">
              {viewMode === "week" ? (
                <>
                  <div className="week-header-simple">
                    <h3>Tydzień {week.weekNumber}</h3>
                    {week.weekGoal && <p className="week-goal">{week.weekGoal}</p>}
                    <div className="week-stats-inline">
                      <span>{week.totalDistance?.toFixed(1) || 0} km</span>
                      <span>{Math.floor((week.totalDuration || 0) / 60)}h {(week.totalDuration || 0) % 60}min</span>
                    </div>
                  </div>
                  <WeekView
                    week={week}
                    onWorkoutClick={handleWorkoutClick}
                    onWorkoutMove={handleWorkoutMove}
                    onWorkoutReorder={handleWorkoutReorder}
                    onAddWorkout={(dayOfWeek) => handleAddWorkout(week.weekNumber, dayOfWeek)}
                    onDeleteWorkout={handleDeleteWorkout}
                  />
                </>
              ) : (
                <>
              <div
                className="week-header"
                onClick={() => toggleWeek(weekIndex)}
              >
                <div>
                  <h3>Tydzień {week.weekNumber}</h3>
                  {week.weekGoal && <p className="week-goal">{week.weekGoal}</p>}
                </div>
                <div className="week-header-right">
                  <div className="week-meta">
                    <span>
                      {week.workouts?.filter((w) => w.completed).length || 0} /{" "}
                      {week.workouts?.length || 0} treningów
                    </span>
                    {week.totalDistance && (
                      <span>
                        {week.totalDistance.toFixed(1)} km
                      </span>
                    )}
                  </div>
                  {expandedWeeks.includes(weekIndex) ? (
                    <ChevronUp size={20} />
                  ) : (
                    <ChevronDown size={20} />
                  )}
                </div>
              </div>

              {expandedWeeks.includes(weekIndex) && (
                <div className="workouts-list">
                  {week.workouts?.map((workout) => {
                    const isRestDay = workout.workoutType === 'REST' || workout.workoutType === 'REST_MOBILITY';
                    
                    return (
                    <div
                      key={workout.id}
                      className={`workout-card ${workout.completed ? "completed" : ""} ${isRestDay ? "rest-day" : ""}`}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        if (e.target.closest('button')) return;
                        handleWorkoutClick(workout);
                      }}
                      onKeyDown={(e) => {
                        if (e.target.closest('button')) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleWorkoutClick(workout);
                        }
                      }}
                    >
                      {isRestDay ? (
                        <>
                          <div className="workout-header">
                            <div className="workout-day">
                              {getDayName(workout.dayOfWeek)}
                            </div>
                          </div>
                          
                          <h4 className="workout-name">Dzień odpoczynku</h4>
                          <div className="workout-type rest-type">
                            Regeneracja
                          </div>
                          
                          <p className="rest-description">
                            Aktywna regeneracja organizmu. Możesz wykonać lekki spacer lub stretching.
                          </p>

                          <div className="workout-actions">
                            <button
                              className={`complete-btn ${workout.completed ? "completed" : ""}`}
                              onClick={() =>
                                !workout.completed && handleCompleteWorkout(workout.id)
                              }
                              disabled={workout.completed || completingWorkout === workout.id}
                            >
                              {workout.completed ? (
                                <CheckCircle2 size={18} />
                              ) : (
                                <Circle size={18} />
                              )}
                              {workout.completed ? "Ukończono" : "Oznacz jako ukończone"}
                            </button>
                            
                            {!workout.completed && (
                              <div className="edit-actions">
                                <button
                                  className="delete-btn"
                                  onClick={() => handleDeleteWorkout(workout.id)}
                                  title="Usuń dzień odpoczynku"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                      <div className="workout-header">
                        <div className="workout-day">
                          {getDayName(workout.dayOfWeek)}
                        </div>
                      </div>

                      <h4 className="workout-name">{workout.name}</h4>
                      <div className="workout-type">
                        {getWorkoutTypeLabel(workout.workoutType)}
                      </div>

                      {(() => {
                        let parsedIntervals;
                        try {
                          parsedIntervals = typeof workout.intervals === 'string' 
                            ? JSON.parse(workout.intervals) 
                            : workout.intervals;
                        } catch {
                          parsedIntervals = null;
                        }
                        const hasStructure = parsedIntervals && (parsedIntervals.warmup || parsedIntervals.main || parsedIntervals.intervals);

                        return (
                          <>
                            {!hasStructure && <p className="workout-description">{workout.description}</p>}

                            {!hasStructure && (
                              <div className="workout-targets">
                                {workout.targetDistance && (
                                  <div className="target-item">
                                    <span className="target-label">Dystans:</span>
                                    <span className="target-value">
                                      {workout.targetDistance.toFixed(1)} km
                                    </span>
                                  </div>
                                )}
                                {workout.targetDuration && (
                                  <div className="target-item">
                                    <span className="target-label">Czas:</span>
                                    <span className="target-value">
                                      {workout.targetDuration} min
                                    </span>
                                  </div>
                                )}
                                {workout.targetPace && (
                                  <div className="target-item">
                                    <span className="target-label">Tempo:</span>
                                    <span className="target-value">
                                      {workout.targetPace}
                                    </span>
                                  </div>
                                )}
                                {workout.intensity && (
                                  <div className="target-item">
                                    <span className="target-label">Intensywność:</span>
                                    <span className="target-value">{workout.intensity}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {workout.intervals && (() => {
                        let parsedIntervals;
                        try {
                          parsedIntervals = typeof workout.intervals === 'string' 
                            ? JSON.parse(workout.intervals) 
                            : workout.intervals;
                        } catch {
                          parsedIntervals = null;
                        }
                        
                        // Nowa struktura z blokami
                        if (parsedIntervals?.blocks && Array.isArray(parsedIntervals.blocks)) {
                          const blocks = parsedIntervals.blocks;
                          const totalDuration = blocks.reduce((sum, b) => sum + (b.duration || 0), 0);
                          
                          const blockTypeLabels = {
                            warmup: "Rozgrzewka",
                            intervals: "Interwały",
                            tempo: "Tempo",
                            main: "Główna część",
                            recovery: "Regeneracja",
                            cooldown: "Wychłodzenie"
                          };
                          
                          const blockColors = {
                            warmup: "#10b981",
                            intervals: "#ef4444",
                            tempo: "#f59e0b",
                            main: "#8b5cf6",
                            recovery: "#3b82f6",
                            cooldown: "#6366f1"
                          };
                          
                          const groupedBlocks = [];
                          let i = 0;
                          while (i < blocks.length) {
                            const block = blocks[i];
                            const nextBlock = blocks[i + 1];

                            const isIntervalPair =
                              block?.type === 'intervals' &&
                              nextBlock?.type === 'recovery';

                            if (isIntervalPair) {
                              const repetitions = Number.isFinite(block.repetitions)
                                ? Math.max(1, block.repetitions)
                                : 1;

                              if (repetitions > 1) {
                                groupedBlocks.push({
                                  type: 'interval-set',
                                  interval: block,
                                  recovery: nextBlock,
                                  count: repetitions,
                                });
                                i += 2;
                                continue;
                              }

                             const signature = `${block.duration}|${block.pace}|${nextBlock.duration}|${nextBlock.pace || ''}`;
                              let count = 1;
                              let j = i + 2;

                              while (j + 1 < blocks.length) {
                                const b = blocks[j];
                                const r = blocks[j + 1];
                                if (b?.type !== 'intervals' || r?.type !== 'recovery') break;
                                const sig2 = `${b.duration}|${b.pace}|${r.duration}|${r.pace || ''}`;
                                if (sig2 !== signature) break;
                                count += 1;
                                j += 2;
                              }

                              groupedBlocks.push({
                                type: 'interval-set',
                                interval: block,
                                recovery: nextBlock,
                                count,
                              });

                              i += count * 2;
                            } else {
                              groupedBlocks.push(block);
                              i++;
                            }
                          }
                          
                          return (
                            <div className="workout-blocks-preview">
                              <div className="blocks-timeline-preview">
                                {blocks.map((block, idx) => {
                                  const prevBlock = blocks[idx - 1];
                                  const nextBlock = blocks[idx + 1];
                                  const isInterval = block.type === 'intervals';
                                  const isRecovery = block.type === 'recovery';
                                  const isIntervalWithRecovery = isInterval && nextBlock?.type === 'recovery';
                                  const isRecoveryAfterInterval = isRecovery && prevBlock?.type === 'intervals';

                                  const widthPercent = (block.duration / totalDuration) * 100;
                                  return (
                                    <div
                                      key={idx}
                                      className={`block-preview ${isIntervalWithRecovery ? 'paired-interval' : ''} ${isRecoveryAfterInterval ? 'paired-recovery' : ''}`}
                                      style={{
                                        width: `${widthPercent}%`,
                                        backgroundColor: blockColors[block.type] || "#6b7280"
                                      }}
                                      title={`${blockTypeLabels[block.type] || block.type}: ${block.duration}min @ ${block.pace}/km`}
                                    />
                                  );
                                })}
                              </div>
                              <div className="blocks-legend-preview">
                                {groupedBlocks.map((item, idx) => {
                                  if (item.type === 'interval-set') {
                                    const count = item.count || 1;
                                    return (
                                      <div key={idx} className="legend-item-preview interval-set">
                                        <span className="legend-dot" style={{ backgroundColor: blockColors.intervals }} />
                                        <span className="legend-text">
                                          {count > 1
                                            ? `${count}x (${item.interval.duration}min @ ${item.interval.pace}/km + regeneracja ${item.recovery.duration}min)`
                                            : `Interwał: ${item.interval.duration}min @ ${item.interval.pace}/km + regeneracja ${item.recovery.duration}min`}
                                        </span>
                                      </div>
                                    );
                                  }
                                  return (
                                    <div key={idx} className="legend-item-preview">
                                      <span 
                                        className="legend-dot" 
                                        style={{ backgroundColor: blockColors[item.type] }}
                                      />
                                      <span className="legend-text">
                                        {blockTypeLabels[item.type]}: {item.duration}min @ {item.pace}/km
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        }
                        
                        return parsedIntervals && (parsedIntervals.warmup || parsedIntervals.main || parsedIntervals.intervals) && (
                          <div className="intervals-section">
                            <div className="interval-phases">
                              {parsedIntervals.warmup && (
                                <div className="interval-phase warmup">
                                  <div className="phase-info">
                                    <div className="phase-title">Rozgrzewka</div>
                                    <div className="phase-desc">{parsedIntervals.warmup}</div>
                                  </div>
                                </div>
                              )}
                              {(parsedIntervals.main || parsedIntervals.intervals) && (
                                <div className="interval-phase main">
                                  <div className="phase-info">
                                    <div className="phase-title">Część główna</div>
                                    <div className="phase-desc">{parsedIntervals.main || parsedIntervals.intervals}</div>
                                    {parsedIntervals.recovery && (
                                      <div className="phase-recovery">
                                        {parsedIntervals.recovery}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              {parsedIntervals.cooldown && (
                                <div className="interval-phase cooldown">
                                  <div className="phase-info">
                                    <div className="phase-title">Wyciszenie</div>
                                    <div className="phase-desc">{parsedIntervals.cooldown}</div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {workout.completed && (
                        <div className="actual-data">
                          <div className="actual-label">Wykonane:</div>
                          {workout.actualDistance && (
                            <div className="actual-item">
                              Dystans: {(workout.actualDistance / 1000).toFixed(1)} km
                            </div>
                          )}
                          {workout.actualDuration && (
                            <div className="actual-item">
                              Czas: {Math.floor(workout.actualDuration / 60)} min
                            </div>
                          )}
                          {workout.notes && (
                            <div className="actual-item">
                              Notatki: {workout.notes}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="workout-actions">
                        <button
                          className={`complete-btn ${workout.completed ? "completed" : ""}`}
                          onClick={() =>
                            !workout.completed && handleCompleteWorkout(workout.id)
                          }
                          disabled={workout.completed || completingWorkout === workout.id}
                        >
                          {workout.completed ? (
                            <CheckCircle2 size={18} />
                          ) : (
                            <Circle size={18} />
                          )}
                          {workout.completed ? "Ukończono" : "Oznacz jako ukończone"}
                        </button>
                        
                        {!workout.completed && (
                          <div className="edit-actions">
                            <button
                              className="edit-btn"
                              onClick={() => handleEditWorkout(workout, week.weekNumber)}
                              title="Edytuj trening"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="delete-btn"
                              onClick={() => handleDeleteWorkout(workout.id)}
                              title="Usuń trening"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                      </>
                      )}
                    </div>
                    );
                  })}
                  
                  {expandedWeeks.includes(weekIndex) && (
                    <button
                      className="add-workout-btn"
                      onClick={() => handleAddWorkout(week.weekNumber, 1)}
                    >
                      <Plus size={18} />
                      Dodaj trening
                    </button>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {showWorkoutModal && (
        <WorkoutModal
          workout={editingWorkout}
          weekNumber={selectedWeek}
          dayOfWeek={selectedDay}
          onSave={handleSaveWorkout}
          onClose={() => {
            setShowWorkoutModal(false);
            setEditingWorkout(null);
            setSelectedWeek(null);
            setSelectedDay(null);
          }}
        />
      )}
    </Layout>
  );
}

export default TrainingPlanDetailPage;
