# 🏃 Aplikacja do Zarządzania Planami Treningowymi

Kompleksowy system do planowania, monitorowania i analizy treningów biegowych z integracją Google Calendar/Tasks oraz synchronizacją z zewnętrznymi serwisami (Strava, Garmin).

## 📋 Technologie

### Backend
- Node.js + Express
- PostgreSQL
- Prisma ORM
- Passport.js (OAuth2)
- Axios

### Frontend
- React 18
- Vite
- React Router
- Recharts (wykresy)
- Lucide React (ikony)

## 🏗️ Struktura projektu

```
Praca_Inz/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.js
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js
│   │   │   └── passport.js
│   │   ├── controllers/
│   │   │   ├── auth.controller.js
│   │   │   ├── activities.controller.js
│   │   │   ├── analytics.controller.js
│   │   │   ├── data.controller.js
│   │   │   └── trainingPlan.controller.js
│   │   ├── middleware/
│   │   │   └── auth.middleware.js
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── activities.routes.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── data.routes.js
│   │   │   └── trainingPlan.routes.js
│   │   ├── services/
│   │   │   └── strava.service.js
│   │   └── server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   └── Layout.css
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── DashboardPage.jsx
    │   │   ├── AnalyticsPage.jsx
    │   │   ├── DataPage.jsx
    │   │   └── TrainingPlanPage.jsx
    │   ├── services/
    │   │   └── api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    └── vite.config.js
```

## 🚀 Instalacja i uruchomienie

### Wymagania
- Node.js (v18+)
- PostgreSQL (v14+)
- **Ollama** (lokalny model AI - darmowy, bez API keys!)
- Konto Strava Developer (✅ Już skonfigurowane! Client ID: 185513)

⚠️ **WAŻNE**: 
- Sprawdź plik `STRAVA_SCOPE_UPDATE.md` aby zaktualizować uprawnienia OAuth!
- Zainstaluj i uruchom Ollama zgodnie z instrukcjami w `backend/OLLAMA_SETUP.md`

### 1. Sklonuj repozytorium

```bash
cd /Users/michalmroz/Documents/PJATK/Praca_Inz
```

### 2. Instalacja Ollama (Model AI)

**Aplikacja używa lokalnego modelu AI (Qwen2.5) zamiast OpenAI API - całkowicie za darmo!**

```bash
# macOS / Linux:
curl -fsSL https://ollama.com/install.sh | sh

# lub macOS (Homebrew):
brew install ollama

# Pobierz model (zalecana wersja):
ollama pull qwen2.5:7b

# Uruchom Ollama w tle:
ollama serve
```

**Szczegółowe instrukcje w:** `backend/OLLAMA_SETUP.md`

**Test instalacji:**
```bash
cd backend
node scripts/test-ollama.js
```

### 3. Konfiguracja PostgreSQL

Utwórz bazę danych:
```bash
createdb training_db
```

### 4. Konfiguracja Strava API

1. Zarejestruj aplikację na: https://www.strava.com/settings/api
2. Ustaw Authorization Callback Domain: `localhost`
3. Zapisz Client ID i Client Secret

### 5. Backend Setup

```bash
cd backend
npm install
```

Skopiuj i edytuj plik środowiskowy:
```bash
cp .env.example .env
```

Edytuj `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/training_db?schema=public"
PORT=5000
SESSION_SECRET=twoj_sekretny_klucz_sesji_min_32_znaki

STRAVA_CLIENT_ID=twoj_strava_client_id
STRAVA_CLIENT_SECRET=twoj_strava_client_secret
STRAVA_CALLBACK_URL=http://localhost:5000/api/auth/strava/callback

CLIENT_URL=http://localhost:3000

# Ollama będzie działać lokalnie, nie potrzebujesz klucza API!
# Upewnij się że Ollama działa: ollama serve
```

Wygeneruj Prisma Client i uruchom migracje:
```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Uruchom serwer:
```bash
npm run dev
```

**WAŻNE:** Upewnij się, że Ollama działa w tle przed uruchomieniem backendu:
```bash
# W osobnym terminalu:
ollama serve
```

### 6. Frontend Setup

W nowym terminalu:
```bash
cd frontend
npm install
npm run dev
```

## 📱 Funkcjonalności

### ✨ Nowa funkcja: Generowanie planów treningowych AI

**Wykorzystanie lokalnego modelu Qwen2.5 (przez Ollama):**
- ✅ **Całkowicie darmowe** - brak kosztów API
- ✅ **Prywatne** - dane nie opuszczają twojego komputera
- ✅ **Offline** - działa bez internetu (po pobraniu modelu)
- ✅ **Spersonalizowane** - analizuje twoje dane ze Strava
- ✅ **Metodyka Jacka Danielsa** - profesjonalne plany treningowe

**Wymagania:**
- Ollama zainstalowane i uruchomione (`ollama serve`)
- Model pobrany (`ollama pull qwen2.5:7b`)
- Co najmniej 8GB RAM (zalecane 16GB dla szybszego działania)

**Zobacz:** `backend/OLLAMA_SETUP.md` dla szczegółów konfiguracji

### 1. Strona główna
- Wybór źródła danych (Strava/Garmin)
- Autoryzacja OAuth2
- Prezentacja funkcji aplikacji

### 2. Panel główny (Dashboard)
- Podsumowanie statystyk użytkownika
- Synchronizacja danych
- Lista ostatnich aktywności
- Wylogowanie

### 3. Analiza (Analytics)
- Rozkład typów aktywności (wykres kołowy)
- Statystyki tygodniowe (wykres słupkowy)
- Trendy miesięczne (wykres liniowy)
- Rozkład intensywności

### 4. Dane (Data)
- Najdłuższy trening
- Najtrudniejszy trening
- Rekordy według typów aktywności (SQL z agregacjami)
- Średnie wartości (złożone zapytania SQL)

### 5. Plan treningowy (Training Plan)
- Rekomendacja planu na podstawie danych użytkownika (zaawansowane SQL)
- Szczegółowy harmonogram tygodniowy
- Alternatywne plany
- 15 gotowych szablonów planów treningowych

## 🗃️ Baza danych

### Główne tabele:
- **User** - użytkownicy
- **Activity** - aktywności treningowe
- **UserStats** - statystyki użytkownika
- **TrainingPlanTemplate** - szablony planów
- **TrainingWeek** - tygodnie treningowe
- **TrainingSession** - pojedyncze sesje

### Zaawansowane zapytania SQL:
- Agregacje z GROUP BY
- Window functions (ROW_NUMBER, PARTITION BY)
- CTE (Common Table Expressions)
- Date truncation i interwały
- CASE statements
- Złączenia wielotabelowe

## 🔧 API Endpoints

### Auth
- `GET /api/auth/strava` - inicjalizacja OAuth Strava
- `GET /api/auth/strava/callback` - callback OAuth
- `GET /api/auth/me` - dane zalogowanego użytkownika
- `POST /api/auth/logout` - wylogowanie

### Activities
- `GET /api/activities` - lista aktywności
- `POST /api/activities/sync` - synchronizacja z API

### Analytics
- `GET /api/analytics/distribution` - rozkład typów
- `GET /api/analytics/weekly-stats` - statystyki tygodniowe
- `GET /api/analytics/monthly-trends` - trendy miesięczne
- `GET /api/analytics/intensity-distribution` - rozkład intensywności
- `GET /api/analytics/progress` - postępy w czasie

### Data
- `GET /api/data/stats` - statystyki użytkownika
- `GET /api/data/longest-activity` - najdłuższy trening
- `GET /api/data/hardest-activity` - najtrudniejszy trening
- `GET /api/data/records` - rekordy
- `GET /api/data/averages` - średnie wartości

### Training Plan
- `GET /api/training-plan/recommend` - rekomendowany plan
- `GET /api/training-plan/templates` - wszystkie szablony
- `GET /api/training-plan/:id` - szczegóły planu

## 🎨 UI/UX

- Nowoczesny, czysty design
- Gradient backgrounds
- Responsywne layout
- Intuicyjna nawigacja
- Interaktywne wykresy
- Loading states
- Error handling

## 📊 Przykładowe dane

Aplikacja zawiera 5 gotowych szablonów planów treningowych:
1. Beginner Running Base (4 tygodnie)
2. Intermediate Endurance Builder (6 tygodni)
3. Advanced Speed Development (8 tygodni)
4. Mixed Training - Intermediate (6 tygodni)
5. Elite Performance Plan (8 tygodni)

## 🔐 Bezpieczeństwo

- Sesje HTTP-only
- CORS z whitelist
- Middleware autoryzacji
- Walidacja danych wejściowych
- Bezpieczne przechowywanie tokenów

## 📝 Notatki rozwojowe

### Garmin API
Garmin Connect API wymaga specjalnej umowy partnerskiej. W obecnej wersji endpoint zwraca status 501 (Not Implemented).

### Rozszerzenia
Możliwe rozszerzenia:
- Export planów do PDF
- Powiadomienia e-mail
- Współdzielenie planów
- Integracja z dodatkowymi platformami
- Mobile app (React Native)

## 🤝 Autor

Michał Mróz - Praca Inżynierska PJATK
