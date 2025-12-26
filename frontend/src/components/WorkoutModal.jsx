import { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import WorkoutBlockEditor from "./WorkoutBlockEditor";
import "./WorkoutModal.css";

function WorkoutModal({ workout, weekNumber, dayOfWeek, onSave, onClose }) {
  const isEditing = !!workout;
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    workoutType: "EASY_RUN",
    weekNumber: weekNumber || 1,
    dayOfWeek: dayOfWeek || 1,
  });

  const [workoutBlocks, setWorkoutBlocks] = useState([]);

  const handleBlocksChange = useCallback((newBlocks) => {
    setWorkoutBlocks(newBlocks);
  }, []);

  // Reset bloków gdy otwieramy modal z nowym treningiem
  useEffect(() => {
    // Reset state when modal opens with new workout
    return () => {
      setWorkoutBlocks([]);
    };
  }, [workout?.id]);

  useEffect(() => {
    if (workout) {
      setFormData({
        name: workout.name || "",
        description: workout.description || "",
        workoutType: workout.workoutType || "EASY_RUN",
        weekNumber: weekNumber || 1,
        dayOfWeek: workout.dayOfWeek || dayOfWeek || 1,
      });

      // Inicjalizuj bloki z istniejącego treningu
      if (workout.intervals?.blocks && Array.isArray(workout.intervals.blocks)) {
        setWorkoutBlocks(workout.intervals.blocks);
      } else {
        // Stwórz strukturę bloków z danych treningu jeśli nie ma zapisanej struktury
        const totalDuration = workout.targetDuration || 45;
        const pace = workout.targetPace || "5:00";
        
        // Zakładamy standardową strukturę: 20% rozgrzewka, 70% główna część, 10% schłodzenie
        const warmupDuration = Math.round(totalDuration * 0.2);
        const mainDuration = Math.round(totalDuration * 0.7);
        const cooldownDuration = totalDuration - warmupDuration - mainDuration;
        
        const parsePace = (paceStr) => {
          const match = paceStr.match(/(\d+):(\d+)/);
          if (!match) return 5.0;
          return parseInt(match[1]) + parseInt(match[2]) / 60;
        };
        
        const formatPace = (minutes) => {
          const mins = Math.floor(minutes);
          const secs = Math.round((minutes - mins) * 60);
          return `${mins}:${secs.toString().padStart(2, '0')}`;
        };
        
        const mainPaceMinutes = parsePace(pace);
        const warmupPace = formatPace(mainPaceMinutes + 1.0); // +1 min/km
        const cooldownPace = formatPace(mainPaceMinutes + 1.5); // +1.5 min/km
        
        setWorkoutBlocks([
          {
            id: Date.now() + 1,
            type: "warmup",
            duration: warmupDuration,
            pace: warmupPace,
            distance: warmupDuration / parsePace(warmupPace),
          },
          {
            id: Date.now() + 2,
            type: workout.workoutType === "INTERVALS" ? "intervals" : "main",
            duration: mainDuration,
            pace: pace,
            distance: mainDuration / mainPaceMinutes,
          },
          {
            id: Date.now() + 3,
            type: "cooldown",
            duration: cooldownDuration,
            pace: cooldownPace,
            distance: cooldownDuration / parsePace(cooldownPace),
          }
        ]);
      }
    } else {
      // Dla nowego treningu - domyślna struktura bloków
      setWorkoutBlocks([
        { id: Date.now() + 1, type: "warmup", duration: 10, pace: "6:00", distance: 1.7 },
        { id: Date.now() + 2, type: "main", duration: 30, pace: "5:00", distance: 6.0 },
        { id: Date.now() + 3, type: "cooldown", duration: 5, pace: "6:30", distance: 0.8 }
      ]);
    }
  }, [workout, weekNumber, dayOfWeek]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Oblicz parametry z bloków
    const totalDuration = workoutBlocks.reduce((sum, block) => sum + (block.duration || 0), 0);
    const totalDistance = workoutBlocks.reduce((sum, block) => sum + (block.distance || 0), 0);
    
    // Oblicz średnie tempo ważone czasem trwania wszystkich bloków
    const parsePace = (paceStr) => {
      const match = paceStr.match(/(\d+):(\d+)/);
      if (!match) return 5.0;
      return parseInt(match[1]) + parseInt(match[2]) / 60;
    };
    
    const formatPace = (minutes) => {
      const mins = Math.floor(minutes);
      const secs = Math.round((minutes - mins) * 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Średnia ważona tempa (każdy blok waży według swojego czasu)
    let weightedPaceSum = 0;
    workoutBlocks.forEach(block => {
      const paceMinutes = parsePace(block.pace);
      weightedPaceSum += paceMinutes * block.duration;
    });
    const avgPaceMinutes = totalDuration > 0 ? weightedPaceSum / totalDuration : 5.0;
    const avgPace = formatPace(avgPaceMinutes);
    
    // Oblicz intensywność na podstawie średniego tempa
    // Tempo < 4:00 = VERY_HARD, 4:00-4:45 = HARD, 4:45-5:30 = MODERATE, > 5:30 = EASY
    let intensityLevel = "MODERATE";
    if (avgPaceMinutes < 4.0) intensityLevel = "VERY_HARD";
    else if (avgPaceMinutes < 4.75) intensityLevel = "HARD";
    else if (avgPaceMinutes < 5.5) intensityLevel = "MODERATE";
    else intensityLevel = "EASY";
    
    const payload = {
      name: formData.name,
      description: formData.description,
      workoutType: formData.workoutType,
      weekNumber: parseInt(formData.weekNumber),
      dayOfWeek: parseInt(formData.dayOfWeek),
      targetDistance: totalDistance > 0 ? totalDistance : null,
      targetDuration: totalDuration > 0 ? totalDuration : null,
      targetPace: avgPace,
      intensity: intensityLevel,
      intervals: workoutBlocks.length > 0 ? { blocks: workoutBlocks } : null,
    };
    
    console.log('Submitting workout payload:', payload);
    onSave(payload);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const daysOfWeek = [
    { value: 1, label: "Poniedziałek" },
    { value: 2, label: "Wtorek" },
    { value: 3, label: "Środa" },
    { value: 4, label: "Czwartek" },
    { value: 5, label: "Piątek" },
    { value: 6, label: "Sobota" },
    { value: 7, label: "Niedziela" },
  ];

  const workoutTypes = [
    { value: "EASY_RUN", label: "Bieg spokojny" },
    { value: "LONG_RUN", label: "Bieg długi" },
    { value: "TEMPO_RUN", label: "Bieg tempo" },
    { value: "INTERVALS", label: "Interwały" },
    { value: "FARTLEK", label: "Fartlek" },
    { value: "RECOVERY", label: "Regeneracja" },
    { value: "RACE_PACE", label: "Tempo wyścigowe" },
    { value: "HILL_REPEATS", label: "Podbieg" },
    { value: "CROSS_TRAINING", label: "Cross-training" },
    { value: "REST", label: "Odpoczynek" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? "Edytuj trening" : "Dodaj nowy trening"}</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="workout-form">
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="name">Nazwa treningu</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="np. Bieg interwałowy"
              />
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Opis</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows="2"
                placeholder="Dodatkowe informacje o treningu"
              />
            </div>

            <div className="form-group">
              <label htmlFor="weekNumber">Tydzień</label>
              <input
                type="number"
                id="weekNumber"
                name="weekNumber"
                value={formData.weekNumber}
                onChange={handleChange}
                min="1"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="dayOfWeek">Dzień</label>
              <select
                id="dayOfWeek"
                name="dayOfWeek"
                value={formData.dayOfWeek}
                onChange={handleChange}
                required
              >
                {daysOfWeek.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group full-width">
              <label htmlFor="workoutType">Typ treningu</label>
              <select
                id="workoutType"
                name="workoutType"
                value={formData.workoutType}
                onChange={handleChange}
                required
              >
                {workoutTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="block-editor-container">
            {workoutBlocks.length > 0 && (
              <WorkoutBlockEditor
                initialBlocks={workoutBlocks}
                onChange={handleBlocksChange}
              />
            )}
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Anuluj
            </button>
            <button type="submit" className="btn-primary">
              {isEditing ? "Zapisz zmiany" : "Dodaj trening"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default WorkoutModal;
