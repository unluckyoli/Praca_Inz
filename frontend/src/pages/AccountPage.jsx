import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Link2,
  Unlink,
  RefreshCw,
  User,
  Mail,
  Calendar,
  CheckCircle,
  Edit2,
} from "lucide-react";
import Layout from "../components/Layout";
import { useAuth } from "../hooks/useAuth";
import { authAPI, activitiesAPI } from "../services/api";
import "./AccountPage.css";

function AccountPage() {
  const { isLoading: authLoading } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    fetchUserData();

    const stravaLinked = searchParams.get("strava") === "linked";
    const stravaError = searchParams.get("error");
    const googleStatus = searchParams.get("google");

    if (stravaLinked) {
      setShowSuccessMessage(true);
      setSearchParams({});
      setTimeout(() => setShowSuccessMessage(false), 5000);
      setTimeout(() => handleFirstSync(), 1500);
    }

    if (googleStatus === "success") {
      alert("✅ Google Calendar został połączony pomyślnie!\n\nMożesz teraz synchronizować plany treningowe z kalendarzem.");
      setSearchParams({});
      fetchUserData();
    } else if (googleStatus === "error") {
      alert("❌ Wystąpił błąd podczas łączenia z Google Calendar.\n\nSpróbuj ponownie.");
      setSearchParams({});
    }

    if (stravaError === "strava_already_linked") {
      alert(
        "To konto Strava jest już połączone z innym użytkownikiem.\n\n" +
          "Jeśli to Twoje konto, zaloguj się używając tego konta Strava lub odłącz je najpierw od starego konta.",
      );
      setSearchParams({});
    } else if (stravaError === "auth_failed") {
      alert(
        "Wystąpił błąd podczas łączenia z kontem Strava.\n\n" +
          "Spróbuj ponownie lub skontaktuj się z administratorem.",
      );
      setSearchParams({});
    }
  }, []);

  const fetchUserData = async () => {
    try {
      const { data } = await authAPI.getCurrentUser();
      setUser(data.user);
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLinkStrava = () => {
    setLinking(true);

    const accessToken = localStorage.getItem("accessToken");

    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001/api";
    window.location.href = `${apiUrl}/auth/strava?mode=connect&token=${encodeURIComponent(accessToken)}`;
  };

  const handleFirstSync = async () => {
    setSyncing(true);
    try {
      console.log("Auto-sync po połączeniu ze Stravą...");
      const response = await activitiesAPI.syncActivities();
      console.log("Sync response:", response.data);
      await fetchUserData(); 
      alert(
        `Zsynchronizowano aktywności ze Stravą!\n\nNowe aktywności: ${response.data.newActivitiesCount}`,
      );
    } catch (error) {
      console.error("Auto-sync error:", error);
      alert(
        "Błąd podczas automatycznej synchronizacji. Możesz spróbować ręcznie z Dashboard.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlinkStrava = async () => {
    if (
      !confirm(
        "Czy na pewno chcesz odłączyć konto Strava? Utracisz dostęp do synchronizacji danych.",
      )
    ) {
      return;
    }

    try {
      await authAPI.unlinkStrava();
      await fetchUserData();
      alert("Konto Strava zostało odłączone pomyślnie.");
    } catch (error) {
      console.error("Unlink Strava error:", error);
      alert(
        "Błąd podczas odłączania konta Strava: " +
          (error.response?.data?.error || error.message),
      );
    }
  };

  const handleLinkGoogle = async () => {
    setLinking(true);
    try {
      const response = await authAPI.googleAuth();
      window.location.href = response.data.authUrl;
    } catch (error) {
      console.error("Google auth error:", error);
      alert("Błąd podczas łączenia z Google Calendar: " + (error.response?.data?.error || error.message));
      setLinking(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm("Czy na pewno chcesz odłączyć Google Calendar?\n\n⚠️ WAŻNE: Musisz ponownie połączyć konto, aby synchronizacja kalendarza działała poprawnie.")) {
      return;
    }

    try {
      await authAPI.unlinkGoogle();
      await fetchUserData();
      alert("✅ Google Calendar został odłączony.\n\n📅 Połącz ponownie, aby synchronizować treningi z kalendarzem.");
    } catch (error) {
      console.error("Unlink Google error:", error);
      alert("Błąd podczas odłączania Google Calendar: " + (error.response?.data?.error || error.message));
    }
  };

  const handleEditProfile = () => {
    setProfileForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || ''
    });
    setEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    try {
      const response = await authAPI.updateProfile(profileForm);
      await fetchUserData();
      setEditingProfile(false);
      alert('✅ Profil został zaktualizowany pomyślnie!');
    } catch (error) {
      console.error('Update profile error:', error);
      alert('Błąd podczas aktualizacji profilu: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleCancelEditProfile = () => {
    setEditingProfile(false);
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="loading">Ładowanie...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="account-page">
        {syncing && (
          <div className="syncing-message">
            <RefreshCw size={24} className="spinning" />
            <div>
              <strong>Synchronizacja w toku...</strong>
              <p>Pobieranie aktywności ze Strava. To może potrwać chwilę.</p>
            </div>
          </div>
        )}

        {showSuccessMessage && (
          <div className="success-message">
            <CheckCircle size={24} />
            <div>
              <strong>Połączono pomyślnie!</strong>
              <p>
                Twoje konto Strava zostało połączone. Możesz teraz
                synchronizować aktywności.
              </p>
            </div>
          </div>
        )}

        <div className="account-header">
          <h1>Moje konto</h1>
          <p className="subtitle">Zarządzaj swoim kontem i połączeniami</p>
        </div>

        <div className="account-content">
          <div className="account-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Informacje o koncie</h2>
              {!editingProfile && (
                <button
                  onClick={handleEditProfile}
                  style={{
                    padding: '8px 16px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Edit2 size={16} />
                  Edytuj profil
                </button>
              )}
            </div>

            {editingProfile ? (
              <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Imię</label>
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Nazwisko</label>
                  <input
                    type="text"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {!user?.isStravaEmail && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>Email</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    onClick={handleSaveProfile}
                    style={{
                      padding: '10px 20px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Zapisz zmiany
                  </button>
                  <button
                    onClick={handleCancelEditProfile}
                    style={{
                      padding: '10px 20px',
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                {user?.email && (
                  <div className="info-item">
                    <Mail size={20} />
                    <div>
                      <label>Email</label>
                      <p>{user.email}</p>
                    </div>
                  </div>
                )}
                {user?.isStravaEmail && (
                  <div className="info-item">
                    <Mail size={20} />
                    <div>
                      <label>Email</label>
                      <p className="text-muted">Zalogowano przez Strava</p>
                    </div>
                  </div>
                )}
                {user?.firstName && (
                  <div className="info-item">
                    <User size={20} />
                    <div>
                      <label>Imię i nazwisko</label>
                      <p>
                        {user.firstName} {user.lastName}
                      </p>
                    </div>
                  </div>
                )}
                <div className="info-item">
                  <Calendar size={20} />
                  <div>
                    <label>Data utworzenia</label>
                    <p>
                      {new Date(user?.createdAt || Date.now()).toLocaleDateString(
                        "pl-PL",
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="account-section">
            <h2>Połączenia z aplikacjami</h2>

            <div className="connection-card">
              <div className="connection-header">
                <div className="connection-info">
                  <div className="connection-icon strava-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                  </div>
                  <div>
                    <h3>Strava</h3>
                    <p className="connection-description">
                      Synchronizuj aktywności, treningi i statystyki
                    </p>
                  </div>
                </div>
                <div className="connection-status">
                  {user?.hasStravaData ? (
                    <span className="status-badge connected">
                      <span className="status-dot"></span>
                      Połączone
                    </span>
                  ) : (
                    <span className="status-badge disconnected">
                      <span className="status-dot"></span>
                      Niepołączone
                    </span>
                  )}
                </div>
              </div>

              <div className="connection-actions">
                {user?.hasStravaData ? (
                  <>
                    <div className="connection-details">
                      <p> Twoje konto Strava jest połączone</p>
                      <p className="text-muted">
                        Możesz teraz synchronizować swoje aktywności z panelu
                        głównego
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={handleUnlinkStrava}
                    >
                      <Unlink size={18} />
                      Odłącz konto Strava
                    </button>
                  </>
                ) : (
                  <>
                    <div className="connection-details">
                      <p>
                        {" "}
                        Połącz swoje konto Strava, aby synchronizować aktywności
                      </p>
                      <p className="text-muted">
                        Po połączeniu będziesz mógł automatycznie importować
                        wszystkie swoje treningi
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleLinkStrava}
                      disabled={linking}
                    >
                      <Link2 size={18} className={linking ? "spinning" : ""} />
                      {linking
                        ? "Przekierowywanie..."
                        : "Połącz z kontem Strava"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="connection-card">
              <div className="connection-header">
                <div className="connection-info">
                  <div className="connection-icon google-icon">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <h3>Google Calendar</h3>
                    <p className="connection-description">
                      Synchronizuj plany treningowe z kalendarzem
                    </p>
                  </div>
                </div>
                <div className="connection-status">
                  {user?.hasGoogleCalendar ? (
                    <span className="status-badge connected">
                      <span className="status-dot"></span>
                      Połączone
                    </span>
                  ) : (
                    <span className="status-badge disconnected">
                      <span className="status-dot"></span>
                      Niepołączone
                    </span>
                  )}
                </div>
              </div>

              <div className="connection-actions">
                {user?.hasGoogleCalendar ? (
                  <>
                    <div className="connection-details">
                      <p>✅ Twoje konto Google Calendar jest połączone</p>
                      <p className="text-muted">
                        Możesz teraz synchronizować plany treningowe z kalendarzem
                      </p>
                    </div>
                    <button
                      className="btn-secondary"
                      onClick={handleUnlinkGoogle}
                    >
                      <Unlink size={18} />
                      Odłącz Google Calendar
                    </button>
                  </>
                ) : (
                  <>
                    <div className="connection-details">
                      <p>
                        📅 Połącz Google Calendar, aby wysyłać treningi do kalendarza
                      </p>
                      <p className="text-muted">
                        Po połączeniu będziesz mógł automatycznie dodawać treningi do swojego kalendarza Google
                      </p>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={handleLinkGoogle}
                      disabled={linking}
                    >
                      <Link2 size={18} className={linking ? "spinning" : ""} />
                      {linking
                        ? "Przekierowywanie..."
                        : "Połącz z Google Calendar"}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="connection-card disabled">
              <div className="connection-header">
                <div className="connection-info">
                  <div className="connection-icon garmin-icon">
                    <span>G</span>
                  </div>
                  <div>
                    <h3>Garmin Connect</h3>
                    <p className="connection-description">Wkrótce dostępne</p>
                  </div>
                </div>
                <div className="connection-status">
                  <span className="status-badge coming-soon">Wkrótce</span>
                </div>
              </div>
            </div>
          </div>

          {user?.stats && (
            <div className="account-section">
              <h2>Twoje statystyki</h2>
              <div className="stats-grid">
                <div className="stat-box">
                  <span className="stat-value">
                    {user.stats.totalActivities || 0}
                  </span>
                  <span className="stat-label">Aktywności</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">
                    {((user.stats.totalDistance || 0) / 1000).toFixed(0)} km
                  </span>
                  <span className="stat-label">Dystans</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">
                    {Math.floor((user.stats.totalDuration || 0) / 3600)} h
                  </span>
                  <span className="stat-label">Czas</span>
                </div>
                <div className="stat-box">
                  <span className="stat-value">
                    {(user.stats.totalElevationGain || 0).toFixed(0)} m
                  </span>
                  <span className="stat-label">Przewyższenie</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default AccountPage;
