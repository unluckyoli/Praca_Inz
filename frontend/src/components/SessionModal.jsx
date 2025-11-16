import { X, Clock, Target, Activity } from 'lucide-react';
import './SessionModal.css';

function SessionModal({ session, intervals, onClose }) {
  if (!session) return null;

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins} min`;
  };

  const getIntensityColor = (intensity) => {
    switch(intensity) {
      case 'EASY': return '#10b981';
      case 'MODERATE': return '#f59e0b';
      case 'HARD': return '#ef4444';
      case 'VERY_HARD': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getIntensityLabel = (intensity) => {
    switch(intensity) {
      case 'EASY': return 'Łatwa';
      case 'MODERATE': return 'Umiarkowana';
      case 'HARD': return 'Ciężka';
      case 'VERY_HARD': return 'Bardzo ciężka';
      default: return intensity;
    }
  };

  const getTypeLabel = (type) => {
    switch(type) {
      case 'EASY_RUN': return 'Bieg regeneracyjny';
      case 'LONG_RUN': return 'Bieg długi';
      case 'TEMPO_RUN': return 'Bieg tempo';
      case 'INTERVAL': return 'Interwały';
      case 'RECOVERY': return 'Regeneracja';
      case 'STRENGTH': return 'Siłowy';
      case 'CROSS_TRAINING': return 'Trening krzyżowy';
      default: return type;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content session-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{getTypeLabel(session.sessionType)}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="session-summary">
            <div className="summary-item">
              <Clock size={20} />
              <div>
                <div className="summary-label">Czas trwania</div>
                <div className="summary-value">{formatDuration(session.duration)}</div>
              </div>
            </div>
            
            {session.distance && (
              <div className="summary-item">
                <Target size={20} />
                <div>
                  <div className="summary-label">Dystans</div>
                  <div className="summary-value">{(session.distance / 1000).toFixed(1)} km</div>
                </div>
              </div>
            )}
            
            <div className="summary-item">
              <Activity size={20} />
              <div>
                <div className="summary-label">Intensywność</div>
                <div className="summary-value">
                  <span 
                    className="intensity-badge" 
                    style={{ backgroundColor: getIntensityColor(session.intensity) }}
                  >
                    {getIntensityLabel(session.intensity)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {session.description && (
            <div className="session-description">
              <h3>Opis treningu</h3>
              <p>{session.description}</p>
            </div>
          )}
          
          {intervals && (
            <div className="interval-details">
              <h3>Szczegóły interwałów</h3>
              <div className="interval-info">
                <div className="interval-item">
                  <span className="interval-label">Liczba powtórzeń:</span>
                  <span className="interval-value">{intervals.sets}</span>
                </div>
                <div className="interval-item">
                  <span className="interval-label">Czas pojedynczego interwału:</span>
                  <span className="interval-value">{intervals.duration} min</span>
                </div>
                <div className="interval-item">
                  <span className="interval-label">Łączny czas interwałów:</span>
                  <span className="interval-value">{intervals.sets * intervals.duration} min</span>
                </div>
              </div>
            </div>
          )}
          
          {session.targetHeartRateZone && (
            <div className="heart-rate-zone">
              <h3>Strefa tętna</h3>
              <p className="zone-text">{session.targetHeartRateZone}</p>
            </div>
          )}
          
          <div className="session-notes">
            <h3>Wskazówki</h3>
            <ul>
              {session.sessionType === 'EASY_RUN' && (
                <>
                  <li>Utrzymuj komfortowe tempo, przy którym możesz swobodnie rozmawiać</li>
                  <li>Skup się na technice biegu i relaksacji</li>
                </>
              )}
              {session.sessionType === 'LONG_RUN' && (
                <>
                  <li>Rozpocznij w wolnym tempie i stopniowo zwiększaj intensywność</li>
                  <li>Pamiętaj o regularnym nawadnianiu</li>
                </>
              )}
              {session.sessionType === 'INTERVAL' && (
                <>
                  <li>Rozgrzewka 10-15 minut w łatwym tempie</li>
                  <li>Przerwy między interwałami: aktywny odpoczynek (trucht)</li>
                  <li>Zakończ 10-minutową rozciągką</li>
                </>
              )}
              {session.sessionType === 'RECOVERY' && (
                <>
                  <li>To trening regeneracyjny - priorytetem jest odpoczynek</li>
                  <li>Możesz wykonać lekki stretching lub spacer</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SessionModal;
