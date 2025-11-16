import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Target, TrendingUp, Clock, ChevronRight, Eye } from 'lucide-react';
import Layout from '../components/Layout';
import SessionModal from '../components/SessionModal';
import { trainingPlanAPI } from '../services/api';
import './TrainingPlanPage.css';

function TrainingPlanPage() {
  const [recommendedPlan, setRecommendedPlan] = useState(null);
  const [alternativePlans, setAlternativePlans] = useState([]);
  const [allTemplates, setAllTemplates] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionIntervals, setSessionIntervals] = useState(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [viewMode, setViewMode] = useState('recommended'); // 'recommended' | 'browse'
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [recommendRes, templatesRes] = await Promise.all([
        trainingPlanAPI.getRecommended(),
        trainingPlanAPI.getTemplates({})
      ]);

      setRecommendedPlan(recommendRes.data.recommendedPlan);
      setAlternativePlans(recommendRes.data.alternativePlans || []);
      setUserProfile(recommendRes.data.userProfile);
      setAllTemplates(templatesRes.data.templates || []);
      setSelectedPlan(recommendRes.data.recommendedPlan);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/');
      }
      console.error('Fetch plan error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanClick = async (planId) => {
    try {
      const res = await trainingPlanAPI.getPlanById(planId);
      setSelectedPlan(res.data.plan);
    } catch (error) {
      console.error('Fetch plan details error:', error);
    }
  };

  const handleSessionClick = async (sessionId) => {
    try {
      const res = await trainingPlanAPI.getSessionById(sessionId);
      setSelectedSession(res.data.session);
      setSessionIntervals(res.data.intervals);
      setShowSessionModal(true);
    } catch (error) {
      console.error('Fetch session details error:', error);
    }
  };

  const getLevelBadgeColor = (level) => {
    switch (level) {
      case 'BEGINNER': return '#10b981';
      case 'INTERMEDIATE': return '#f59e0b';
      case 'ADVANCED': return '#ef4444';
      case 'ELITE': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getLevelLabel = (level) => {
    switch (level) {
      case 'BEGINNER': return 'Początkujący';
      case 'INTERMEDIATE': return 'Średniozaawansowany';
      case 'ADVANCED': return 'Zaawansowany';
      case 'ELITE': return 'Elita';
      default: return level;
    }
  };

  const getFocusLabel = (focus) => {
    switch (focus) {
      case 'ENDURANCE': return 'Wytrzymałość';
      case 'SPEED': return 'Szybkość';
      case 'STRENGTH': return 'Siła';
      case 'MIXED': return 'Mix';
      default: return focus;
    }
  };

  const getDayName = (dayNum) => {
    const days = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];
    return days[dayNum - 1] || '';
  };

  if (loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie planu treningowego...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="training-plan-page">
        <div className="page-header">
          <h1>Plan treningowy</h1>
          <div className="view-toggle">
            <button 
              className={viewMode === 'recommended' ? 'active' : ''}
              onClick={() => setViewMode('recommended')}
            >
              Rekomendowany
            </button>
            <button 
              className={viewMode === 'browse' ? 'active' : ''}
              onClick={() => setViewMode('browse')}
            >
              Przeglądaj wszystkie
            </button>
          </div>
        </div>

        {viewMode === 'recommended' && userProfile && (
          <div className="user-profile-section">
            <h2>Twój profil treningowy</h2>
            <div className="profile-stats">
              <div className="profile-stat">
                <span className="stat-label">Poziom</span>
                <span 
                  className="stat-badge" 
                  style={{ backgroundColor: getLevelBadgeColor(userProfile.level) }}
                >
                  {getLevelLabel(userProfile.level)}
                </span>
              </div>
              <div className="profile-stat">
                <span className="stat-label">Fokus</span>
                <span className="stat-value">{getFocusLabel(userProfile.focusType)}</span>
              </div>
              <div className="profile-stat">
                <span className="stat-label">Śr. godz. tygodniowo</span>
                <span className="stat-value">{userProfile.avgWeeklyHours}h</span>
              </div>
              <div className="profile-stat">
                <span className="stat-label">Treningów/tydzień</span>
                <span className="stat-value">{userProfile.activitiesPerWeek}</span>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'browse' && (
          <div className="browse-plans-section">
            <h2>Dostępne plany treningowe</h2>
            <div className="plans-grid">
              {allTemplates.map(plan => (
                <div 
                  key={plan.id} 
                  className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
                  onClick={() => handlePlanClick(plan.id)}
                >
                  <h3>{plan.name}</h3>
                  <div className="plan-meta">
                    <span 
                      className="level-badge"
                      style={{ backgroundColor: getLevelBadgeColor(plan.level) }}
                    >
                      {getLevelLabel(plan.level)}
                    </span>
                    <span className="focus-badge">{getFocusLabel(plan.focusType)}</span>
                  </div>
                  <p className="plan-description">{plan.description}</p>
                  <div className="plan-details">
                    <span><Calendar size={16} /> {plan.durationWeeks} tygodni</span>
                    <span><Clock size={16} /> {plan.weeklyHours}h/tydzień</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'recommended' && alternativePlans.length > 0 && (
          <div className="alternatives-section">
            <h2>Alternatywne plany</h2>
            <div className="alternatives-grid">
              {alternativePlans.map(plan => (
                <div 
                  key={plan.id} 
                  className="alternative-card"
                  onClick={() => handlePlanClick(plan.id)}
                >
                  <h4>{plan.name}</h4>
                  <div className="alternative-badges">
                    <span 
                      className="level-badge small"
                      style={{ backgroundColor: getLevelBadgeColor(plan.level) }}
                    >
                      {getLevelLabel(plan.level)}
                    </span>
                    <span className="focus-badge small">{getFocusLabel(plan.focusType)}</span>
                  </div>
                  <button className="view-plan-btn">
                    <Eye size={16} />
                    Zobacz szczegóły
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedPlan && (
          <div className="plan-details-section">
            <div className="plan-header">
              <div>
                <h2>{selectedPlan.name}</h2>
                <p className="plan-desc">{selectedPlan.description}</p>
              </div>
              <div className="plan-info">
                <div className="info-item">
                  <Target size={20} />
                  <div>
                    <div className="info-label">Czas trwania</div>
                    <div className="info-value">{selectedPlan.durationWeeks} tygodni</div>
                  </div>
                </div>
                <div className="info-item">
                  <Clock size={20} />
                  <div>
                    <div className="info-label">Tygodniowo</div>
                    <div className="info-value">{selectedPlan.weeklyHours} godzin</div>
                  </div>
                </div>
                <div className="info-item">
                  <TrendingUp size={20} />
                  <div>
                    <div className="info-label">Sesji/tydzień</div>
                    <div className="info-value">{selectedPlan.sessionsPerWeek}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="weeks-container">
              {selectedPlan.weeks?.map((week) => (
                <div key={week.id} className="week-card">
                  <div className="week-header">
                    <h3>Tydzień {week.weekNumber}</h3>
                    {week.description && <p>{week.description}</p>}
                  </div>

                  <div className="sessions-list">
                    {week.sessions?.map((session) => (
                      <div 
                        key={session.id} 
                        className="session-item"
                        onClick={() => handleSessionClick(session.id)}
                      >
                        <div className="session-day">{getDayName(session.dayOfWeek)}</div>
                        <div className="session-content">
                          <div className="session-title">{session.sessionType?.replace('_', ' ') || 'Trening'}</div>
                          <div className="session-meta">
                            <span><Clock size={14} /> {session.duration} min</span>
                            {session.distance && <span><Target size={14} /> {(session.distance / 1000).toFixed(1)} km</span>}
                            <span className="intensity-dot" data-intensity={session.intensity}></span>
                            <span>{session.intensity}</span>
                          </div>
                        </div>
                        <ChevronRight size={20} className="session-arrow" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showSessionModal && (
          <SessionModal 
            session={selectedSession}
            intervals={sessionIntervals}
            onClose={() => {
              setShowSessionModal(false);
              setSelectedSession(null);
              setSessionIntervals(null);
            }} 
          />
        )}
      </div>
    </Layout>
  );
}

export default TrainingPlanPage;
