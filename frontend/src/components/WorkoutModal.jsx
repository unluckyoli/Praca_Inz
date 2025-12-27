import { useState, useEffect, useCallback } from "react";
import { X, Edit2, Eye } from "lucide-react";
import WorkoutBlockEditor from "./WorkoutBlockEditor";
import "./WorkoutModal.css";

function WorkoutModal({ workout, weekNumber, dayOfWeek, onSave, onClose }) {
  const isEditing = !!workout;
  const [isEditMode, setIsEditMode] = useState(!isEditing); // Nowy trening od razu w trybie edycji
  const [isRestMobility, setIsRestMobility] = useState(false);
  
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

  const handleRestMobilityToggle = (checked) => {
    setIsRestMobility(checked);
    if (checked) {
      setFormData(prev => ({
        ...prev,
        name: "Rest/Mobility",
        workoutType: "REST_MOBILITY",
        description: ""
      }));
      setWorkoutBlocks([]);
    } else {
      setFormData(prev => ({
        ...prev,
        name: "",
        workoutType: "EASY_RUN"
      }));
    }
  };

  useEffect(() => {
    return () => {
      setWorkoutBlocks([]);
    };
  }, [workout?.id]);

  useEffect(() => {
    if (workout) {
      const isRest = workout.workoutType === 'REST_MOBILITY';
      setIsRestMobility(isRest);
      
      setFormData({
        name: workout.name || "",
        description: workout.description || "",
        workoutType: workout.workoutType || "EASY_RUN",
        weekNumber: weekNumber || 1,
        dayOfWeek: workout.dayOfWeek || dayOfWeek || 1,
      });

      if (workout.intervals?.blocks && Array.isArray(workout.intervals.blocks)) {
        const parsePace = (paceStr) => {
          if (!paceStr) return 5.0;
          const match = paceStr.match(/(\d+):(\d+)/);
          if (!match) return 5.0;
          return parseInt(match[1]) + parseInt(match[2]) / 60;
        };
        
        const blocksWithIds = workout.intervals.blocks.map((block, index) => {
          const blockCopy = { ...block };
          
          if (!blockCopy.id) {
            blockCopy.id = Date.now() + index + Math.random() * 1000;
          }
          
          if (blockCopy.duration && blockCopy.pace) {
            const paceMinutes = parsePace(blockCopy.pace);
            blockCopy.distance = parseFloat((blockCopy.duration / paceMinutes).toFixed(2));
          }
          
          return blockCopy;
        });
        setWorkoutBlocks(blocksWithIds);
      } else {
        const totalDuration = workout.targetDuration || 45;
        const pace = workout.targetPace || "5:00";
        
        const isRest = workout.workoutType === 'REST_MOBILITY' || workout.workoutType === 'REST';
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
        const warmupPace = formatPace(mainPaceMinutes + 1.0); 
        const cooldownPace = formatPace(mainPaceMinutes + 1.5); 
        
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
      setWorkoutBlocks([
        { id: Date.now() + 1, type: "warmup", duration: 10, pace: "6:00", distance: 1.7 },
        { id: Date.now() + 2, type: "main", duration: 30, pace: "5:00", distance: 6.0 },
        { id: Date.now() + 3, type: "cooldown", duration: 5, pace: "6:30", distance: 0.8 }
      ]);
    }
  }, [workout, weekNumber, dayOfWeek]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const totalDuration = workoutBlocks.reduce((sum, block) => sum + (block.duration || 0), 0);
    const totalDistance = workoutBlocks.reduce((sum, block) => sum + (block.distance || 0), 0);
    
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
    
    let weightedPaceSum = 0;
    workoutBlocks.forEach(block => {
      const paceMinutes = parsePace(block.pace);
      weightedPaceSum += paceMinutes * block.duration;
    });
    const avgPaceMinutes = totalDuration > 0 ? weightedPaceSum / totalDuration : 5.0;
    const avgPace = formatPace(avgPaceMinutes);
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
    { value: "REST_MOBILITY", label: "Rest/Mobility" },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? "Szczegóły treningu" : "Dodaj nowy trening"}</h2>
          <div className="modal-header-actions">
            {isEditing && (
              <button
                type="button"
                className={`mode-toggle-btn ${isEditMode ? 'active' : ''}`}
                onClick={() => setIsEditMode(!isEditMode)}
                title={isEditMode ? "Podgląd" : "Edytuj"}
              >
                {isEditMode ? <Eye size={18} /> : <Edit2 size={18} />}
                {isEditMode ? "Podgląd" : "Edytuj"}
              </button>
            )}
            <button className="close-btn" onClick={onClose}>
              <X size={24} />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="workout-form">
          <div className="rest-mobility-toggle">
            <label className="rest-toggle-label">
              <input
                type="checkbox"
                checked={isRestMobility}
                onChange={(e) => handleRestMobilityToggle(e.target.checked)}
                disabled={!isEditMode}
              />
              <span className="rest-toggle-text">
                <span className="rest-toggle-icon">🧘</span>
                Rest/Mobility
              </span>
            </label>
          </div>

          {!isRestMobility && (
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="name">Nazwa treningu</label>
              {isEditMode ? (
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="np. Bieg interwałowy"
                />
              ) : (
                <div className="form-value">{formData.name}</div>
              )}
            </div>

            <div className="form-group full-width">
              <label htmlFor="description">Opis</label>
              {isEditMode ? (
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="2"
                  placeholder="Dodatkowe informacje o treningu"
                />
              ) : (
                <div className="form-value">{formData.description || "Brak opisu"}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="weekNumber">Tydzień</label>
              {isEditMode ? (
                <input
                  type="number"
                  id="weekNumber"
                  name="weekNumber"
                  value={formData.weekNumber}
                  onChange={handleChange}
                  min="1"
                  required
                />
              ) : (
                <div className="form-value">{formData.weekNumber}</div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="dayOfWeek">Dzień</label>
              {isEditMode ? (
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
              ) : (
                <div className="form-value">
                  {daysOfWeek.find(d => d.value === formData.dayOfWeek)?.label}
                </div>
              )}
            </div>

            <div className="form-group full-width">
              <label htmlFor="workoutType">Typ treningu</label>
              {isEditMode ? (
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
              ) : (
                <div className="form-value">
                  {workoutTypes.find(t => t.value === formData.workoutType)?.label}
                </div>
              )}
            </div>
          </div>
          )}

          {!isRestMobility && (
            <div className="block-editor-container">
              {workoutBlocks.length > 0 && (
                <WorkoutBlockEditor
                  initialBlocks={workoutBlocks}
                  onChange={handleBlocksChange}
                  readOnly={!isEditMode}
                />
              )}
            </div>
          )}

          {isRestMobility && isEditMode && (
            <div className="rest-mobility-info">
              <p>✨ Dzień odpoczynku i mobilności</p>
              <p className="rest-info-text">
                Nie musisz dodawać szczegółów treningu. Skup się na regeneracji! 🧘‍♀️
              </p>
            </div>
          )}

          {isEditMode && (
            <div className="form-actions">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Anuluj
              </button>
              <button type="submit" className="btn-primary">
                {isEditing ? "Zapisz zmiany" : "Dodaj trening"}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default WorkoutModal;
