# 🏃 Aplikacja do Zarządzania Planami Treningowymi

**System webowy do planowania, monitorowania i analizy treningów biegowych z integracją zewnętrznych platform (Strava, Google) oraz sztucznej inteligencji (OpenAI).**

**Autor:** Michał Mróz - Praca Inżynierska PJATK

---

## 📑 Spis treści

1. [Cel systemu](#-cel-systemu)
2. [Główne funkcjonalności](#-główne-funkcjonalności)
3. [Architektura systemu](#-architektura-systemu)
4. [Technologie](#-technologie)
5. [Model bazy danych](#-model-bazy-danych)
6. [Struktura projektu](#-struktura-projektu)
7. [Instalacja i konfiguracja](#-instalacja-i-konfiguracja)
8. [API Endpoints](#-api-endpoints)
9. [Frontend - Komponenty](#-frontend---komponenty)
10. [Bezpieczeństwo](#-bezpieczeństwo)
11. [Dalszy rozwój](#-dalszy-rozwój)

---

## 🎯 Cel systemu

Celem aplikacji jest stworzenie kompleksowego narzędzia wspierającego biegaczy w:
- **Planowaniu treningów** – tworzenie spersonalizowanych planów treningowych z wykorzystaniem AI (OpenAI GPT-4)
- **Monitorowaniu postępów** – synchronizacja aktywności ze Strava i Garmin
- **Analizie danych** – zaawansowana analityka metryk treningowych (dystans, tempo, tętno, przewyższenie)
- **Zarządzaniu celami** – system osiągnięć i nagród motywujących do regularnych treningów
- **Integracji z kalendarzem** – synchronizacja planów z Google Calendar/Tasks

System adresuje potrzeby zarówno początkujących biegaczy (gotowe szablony planów), jak i zaawansowanych sportowców (personalizacja AI, szczegółowa analityka).

---

## ✨ Główne funkcjonalności

### 1. **Autoryzacja OAuth 2.0**
   - Logowanie przez Google/Strava
   - JWT access token + refresh token
   - Automatyczne odświeżanie tokenów

### 2. **Synchronizacja aktywności ze Strava**
   - Pobieranie aktywności użytkownika z API Strava
   - Przechowywanie metryk: dystans, czas, tempo, przewyższenie, tętno (średnie/max)
   - Aktualizacja danych przy każdej synchronizacji

### 3. **Generowanie planów treningowych AI**
   - Analiza historii treningów użytkownika (ostatnie 12 tygodni)
   - Wykorzystanie OpenAI GPT-4 do personalizacji planu
   - Zgodność z metodologią Jacka Danielsa (VDOT, strefy tętna)
   - Parametry wejściowe: cel wyścigowy (5K/10K/21K/42K), data, poziom zaawansowania

### 4. **Kreator planu treningowego (GUI)**
   - **Widok tygodniowy** – collapse/expand, drag-and-drop treningów między dniami
   - **Edytor bloków treningowych** – WARMUP, INTERVAL, RECOVERY, COOLDOWN, REST_MOBILITY
   - **Zaawansowana edycja bloków**:
     - Zmiana czasu i tempa (uchwyty narożne i górne)
     - Drag-and-drop bloków z automatycznym grupowaniem (interval+recovery)
     - Kompresja powtórzeń (np. "3x 800m @ 4:00/km")
     - Wizualne parowanie interval-recovery
   - **Specjalny tryb REST/MOBILITY** – bez struktury bloków, auto-uzupełnianie nazwy

### 5. **Synchronizacja z Google**
   - **Google Calendar** – synchronizacja treningów jako wydarzenia (events)
   - **Google Tasks** – synchronizacja treningów jako zadania (tasks) z due date
   - **Modal wyboru daty** – wybór daty rozpoczęcia planu (domyślnie: najbliższy poniedziałek)

### 6. **Analityka treningowa**
   - Rozkład typów aktywności (pie chart)
   - Statystyki tygodniowe (bar chart)
   - Trendy miesięczne (line chart)
   - Rozkład intensywności (histogram tętna)
   - Zaawansowane SQL: agregacje (GROUP BY), window functions (PARTITION BY), CTE

### 7. **Strona "Dane"**
   - Najdłuższy trening (SQL: ORDER BY LIMIT)
   - Najtrudniejszy trening (złożone zapytanie: dystans × tempo × przewyższenie)
   - Rekordy według typów aktywności
   - Średnie wartości per typ aktywności

### 8. **Dashboard**
   - Podsumowanie statystyk: łączny dystans, liczba aktywności, średnie tempo
   - Wykres aktywności z ostatnich 7/30 dni
   - Lista ostatnich 10 aktywności

### 9. **System celów i osiągnięć**
   - Cele: DISTANCE, TIME, COUNT (DAILY, WEEKLY, MONTHLY, YEARLY)
   - Odznaki za kamienie milowe (np. "100 km w miesiącu")
   - Śledzenie postępu realizacji celów

### 10. **Filtrowanie aktywności**
   - Filtry: zakres dat, typ aktywności, źródło danych
   - Globalne filtry (Context API) współdzielone między stronami

---

## 🏛️ Architektura systemu

System oparty jest na architekturze **klient-serwer** z wyraźnym podziałem na warstwy:

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                            │
│  ┌────────────────────────────────────────────────────┐     │
│  │  React 18 + Vite                                   │     │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────────┐         │     │
│  │  │  Pages   │ │Components│ │   Context   │         │     │
│  │  └──────────┘ └──────────┘ └─────────────┘         │     │
│  │  ┌──────────────────────────────────────┐          │     │
│  │  │   Axios HTTP Client (JWT interceptor)│          │     │
│  │  └──────────────────────────────────────┘          │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTPS (REST API)
                            │
┌─────────────────────────────────────────────────────────────┐
│                         BACKEND                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Node.js + Express                                 │     │
│  │  ┌──────────┐ ┌──────────────┐ ┌──────────────┐    │     │
│  │  │  Routes  │→│ Controllers  │→│   Services   │    │     │
│  │  └──────────┘ └──────────────┘ └──────────────┘    │     │
│  │  ┌──────────────────────────────────────┐          │     │
│  │  │   Middleware (Auth, CORS, Error)     │          │     │
│  │  └──────────────────────────────────────┘          │     │
│  │  ┌──────────────────────────────────────┐          │     │
│  │  │   Prisma ORM (Query Builder)         │          │     │
│  │  └──────────────────────────────────────┘          │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                      SQL Queries
                            │
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL 15                          │
│  ┌──────────┐ ┌──────────┐ ┌───────────────┐                │
│  │   User   │ │ Activity │ │ TrainingPlan  │  ...           │
│  └──────────┘ └──────────┘ └───────────────┘                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐      │
│  │ Strava  │  │ Google  │  │ Garmin  │  │  OpenAI    │      │
│  │   API   │  │   API   │  │   API   │  │    API     │      │
│  └─────────┘  └─────────┘  └─────────┘  └────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Warstwy systemu:

1. **Warstwa prezentacji (Frontend)**
   - React 18 z hooks (useState, useEffect, useContext)
   - React Router 6 (routing SPA, protected routes)
   - Axios (HTTP client z interceptorami JWT)
   - CSS Modules (izolowane style)
   - Chart.js + Recharts (wizualizacje)
   - Leaflet (mapy tras)
   - Lucide React (ikony)

2. **Warstwa logiki biznesowej (Backend)**
   - Express.js (routing, middleware)
   - Controllers (obsługa requestów, walidacja, delegacja do serwisów)
   - Services (logika biznesowa, integracje API, obliczenia metryczne)
   - Middleware (autoryzacja JWT, CORS, error handling)

3. **Warstwa dostępu do danych**
   - Prisma ORM (type-safe query builder, migrations)
   - Connection pooling (optymalizacja wydajności)
   - Seed scripts (dane testowe)

4. **Warstwa danych**
   - PostgreSQL 15 (relacyjna baza danych)
   - Indeksy (userId, stravaId, googleId dla szybkich lookup)
   - Constraints (unique, foreign keys, check)

---

## 💻 Technologie

### Backend

| Technologia | Wersja | Zastosowanie |
|-------------|--------|--------------|
| **Node.js** | 18+ | Runtime środowisko JavaScript |
| **Express** | 4.18 | Web framework (routing, middleware) |
| **PostgreSQL** | 15+ | Relacyjna baza danych |
| **Prisma ORM** | 5.7 | ORM + migrations + type-safety |
| **bcrypt** | 5.1 | Szyfrowanie haseł (salt rounds: 10) |
| **jsonwebtoken** | 9.0 | JWT generowanie i weryfikacja |
| **axios** | 1.6 | HTTP client (integracje API) |
| **googleapis** | 168 | Google Calendar/Tasks API |
| **dotenv** | 16.0 | Zarządzanie zmiennymi środowiskowymi |
| **cors** | 2.8 | Cross-Origin Resource Sharing |
| **cookie-parser** | 1.4 | Parsowanie cookies (JWT) |
| **nodemailer** | 6.9 | Wysyłka email (planowane) |

### Frontend

| Technologia | Wersja | Zastosowanie |
|-------------|--------|--------------|
| **React** | 18.2 | UI library (hooks, functional components) |
| **Vite** | 5.0 | Build tool (HMR, bundling) |
| **React Router** | 6.20 | Routing SPA (protected routes) |
| **Axios** | 1.6 | HTTP client (interceptory JWT) |
| **Chart.js** | 4.5 | Wykresy (bar, line, pie) |
| **Recharts** | 2.10 | Deklaratywne wykresy (React) |
| **Leaflet** | 1.9 | Mapy interaktywne (trasy GPS) |
| **Lucide React** | 0.309 | Ikony SVG (tree-shakeable) |
| **date-fns** | 3.0 | Manipulacja datami |

### Narzędzia deweloperskie

- **ESLint** – Linter JavaScript (code quality)
- **Prettier** – Code formatter (consistent style)
- **Prisma Studio** – GUI do zarządzania bazą danych
- **Postman** – Testowanie API endpoints
- **pgAdmin** – Zarządzanie PostgreSQL

---

## 🗃️ Model bazy danych

### Schemat ERD (Entity Relationship Diagram)

```
┌──────────────┐         ┌──────────────────┐
│     User     │────────<│    Activity      │
│              │ 1     N │                  │
│ • id (PK)    │         │ • id (PK)        │
│ • email      │         │ • userId (FK)    │
│ • googleId   │         │ • stravaId       │
│ • stravaId   │         │ • type           │
│ • tokens     │         │ • distance       │
└──────────────┘         │ • movingTime     │
      │                  │ • pace           │
      │                  │ • elevationGain  │
      │ 1                │ • avgHeartrate   │
      │                  └──────────────────┘
      │
      │ N
      ▼
┌──────────────────┐
│  TrainingPlan    │
│                  │
│ • id (PK)        │
│ • userId (FK)    │
│ • name           │
│ • status         │
│ • raceDistance   │
│ • targetRaceDate │
│ • level          │
│ • focusType      │
│ • syncedToTasks  │
│ • syncedToCalendar│
└──────────────────┘
      │ 1
      │
      │ N
      ▼
┌──────────────┐
│  PlanWeek    │
│              │
│ • id (PK)    │
│ • planId (FK)│
│ • weekNumber │
│ • description│
└──────────────┘
      │ 1
      │
      │ N
      ▼
┌──────────────────┐
│  PlanWorkout     │
│                  │
│ • id (PK)        │
│ • weekId (FK)    │
│ • dayOfWeek      │
│ • name           │
│ • type           │
│ • duration       │
│ • workoutBlocks  │ (JSON: WorkoutBlock[])
│ • googleEventId  │
│ • googleTaskId   │
└──────────────────┘


┌──────────────┐         ┌──────────────────┐
│     User     │────────<│      Goal        │
│              │ 1     N │                  │
└──────────────┘         │ • id (PK)        │
                         │ • userId (FK)    │
                         │ • type           │ (DISTANCE/TIME/COUNT)
                         │ • period         │ (DAILY/WEEKLY/MONTHLY)
                         │ • targetValue    │
                         │ • currentValue   │
                         └──────────────────┘

┌──────────────┐         ┌──────────────────┐
│     User     │────────<│  Achievement     │
│              │ 1     N │                  │
└──────────────┘         │ • id (PK)        │
                         │ • userId (FK)    │
                         │ • name           │
                         │ • description    │
                         │ • earnedAt       │
                         └──────────────────┘
```

### Główne tabele:

#### 1. **User**
Przechowuje dane użytkownika i tokeny OAuth.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `email` | String | Email użytkownika (unique) |
| `googleId` | String? | ID użytkownika Google (unique) |
| `stravaId` | String? | ID użytkownika Strava (unique) |
| `googleAccessToken` | String? | Access token Google (encrypted) |
| `googleRefreshToken` | String? | Refresh token Google (encrypted) |
| `googleScopes` | String? | Uprawnienia Google (comma-separated) |
| `stravaAccessToken` | String? | Access token Strava (encrypted) |
| `stravaRefreshToken` | String? | Refresh token Strava (encrypted) |
| `jwtRefreshToken` | String? | JWT refresh token |
| `createdAt` | DateTime | Data utworzenia konta |
| `updatedAt` | DateTime | Data ostatniej modyfikacji |

**Relacje:** 
- `activities` → Activity[] (1:N)
- `trainingPlans` → TrainingPlan[] (1:N)
- `goals` → Goal[] (1:N)
- `achievements` → Achievement[] (1:N)

---

#### 2. **Activity**
Przechowuje dane treningowe z zewnętrznych platform.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `userId` | UUID | FK do User |
| `stravaId` | String? | ID aktywności Strava (unique) |
| `garminId` | String? | ID aktywności Garmin (unique) |
| `name` | String | Nazwa aktywności |
| `type` | String | Typ (Run/Ride/Swim/Walk/Hike) |
| `startDate` | DateTime | Data rozpoczęcia |
| `distance` | Float | Dystans (metry) |
| `movingTime` | Int | Czas ruchu (sekundy) |
| `totalTime` | Int | Czas całkowity (sekundy) |
| `pace` | Float | Tempo (min/km) |
| `averageSpeed` | Float | Średnia prędkość (m/s) |
| `maxSpeed` | Float | Maksymalna prędkość (m/s) |
| `elevationGain` | Float | Przewyższenie (metry) |
| `averageHeartrate` | Int? | Średnie tętno (bpm) |
| `maxHeartrate` | Int? | Maksymalne tętno (bpm) |
| `calories` | Int? | Kalorie |
| `source` | Enum | Źródło danych (STRAVA/GARMIN/MANUAL) |
| `createdAt` | DateTime | Data utworzenia rekordu |

**Indeksy:**
- `userId` (foreign key index)
- `stravaId` (unique)
- `startDate` (dla filtrowania po datach)

---

#### 3. **TrainingPlan**
Przechowuje plany treningowe (AI-generowane lub ręczne).

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `userId` | UUID | FK do User |
| `name` | String | Nazwa planu |
| `description` | String? | Opis planu |
| `status` | Enum | Status (ACTIVE/COMPLETED/ARCHIVED) |
| `raceDistance` | String | Dystans wyścigu (5K/10K/21K/42K) |
| `targetRaceDate` | DateTime? | Data docelowego wyścigu |
| `weeksCount` | Int | Liczba tygodni |
| `level` | Enum | Poziom (BEGINNER/INTERMEDIATE/ADVANCED/ELITE) |
| `focusType` | Enum | Fokus (ENDURANCE/SPEED/MIXED) |
| `vdot` | Float? | Wskaźnik VDOT (Jack Daniels) |
| `syncedToGoogleTasks` | Boolean | Czy zsynchronizowany z Google Tasks |
| `googleTaskListId` | String? | ID listy zadań Google |
| `syncedToCalendar` | Boolean | Czy zsynchronizowany z Google Calendar |
| `aiGenerated` | Boolean | Czy wygenerowany przez AI |
| `createdAt` | DateTime | Data utworzenia |
| `updatedAt` | DateTime | Data ostatniej modyfikacji |

**Relacje:**
- `weeks` → PlanWeek[] (1:N)

---

#### 4. **PlanWeek**
Przechowuje tygodnie w planie treningowym.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `planId` | UUID | FK do TrainingPlan |
| `weekNumber` | Int | Numer tygodnia (1, 2, 3...) |
| `description` | String? | Opis tygodnia (np. "Base Building") |
| `totalDistance` | Float? | Łączny dystans (km) |
| `createdAt` | DateTime | Data utworzenia |

**Relacje:**
- `workouts` → PlanWorkout[] (1:N)

---

#### 5. **PlanWorkout**
Przechowuje poszczególne treningi w tygodniu.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `weekId` | UUID | FK do PlanWeek |
| `dayOfWeek` | Int | Dzień tygodnia (0=pon, 6=ndz) |
| `name` | String | Nazwa treningu |
| `type` | Enum | Typ (EASY/TEMPO/INTERVAL/LONG/RECOVERY/REST_MOBILITY) |
| `duration` | Int? | Czas trwania (minuty) |
| `distance` | Float? | Dystans (km) |
| `workoutBlocks` | JSON | Struktura bloków treningowych (WorkoutBlock[]) |
| `notes` | String? | Notatki |
| `completed` | Boolean | Czy wykonany |
| `completedAt` | DateTime? | Data wykonania |
| `googleEventId` | String? | ID wydarzenia Google Calendar |
| `googleTaskId` | String? | ID zadania Google Tasks |
| `createdAt` | DateTime | Data utworzenia |

**JSON Schema `workoutBlocks`:**
```json
[
  {
    "id": "uuid",
    "type": "WARMUP|INTERVAL|RECOVERY|COOLDOWN|REST_MOBILITY",
    "duration": 600, // sekundy
    "distance": 1000, // metry (opcjonalne)
    "paceMin": 240, // s/km (opcjonalne)
    "paceMax": 300, // s/km (opcjonalne)
    "heartrateZone": 2, // 1-5 (opcjonalne)
    "description": "Easy jog" // (opcjonalne)
  }
]
```

---

#### 6. **Goal**
Przechowuje cele użytkownika.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `userId` | UUID | FK do User |
| `type` | Enum | Typ (DISTANCE/TIME/COUNT) |
| `period` | Enum | Okres (DAILY/WEEKLY/MONTHLY/YEARLY) |
| `targetValue` | Float | Wartość docelowa |
| `currentValue` | Float | Wartość bieżąca |
| `startDate` | DateTime | Data rozpoczęcia |
| `endDate` | DateTime | Data zakończenia |
| `completed` | Boolean | Czy zrealizowany |
| `createdAt` | DateTime | Data utworzenia |

---

#### 7. **Achievement**
Przechowuje osiągnięcia użytkownika.

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | UUID | Klucz główny |
| `userId` | UUID | FK do User |
| `name` | String | Nazwa osiągnięcia |
| `description` | String | Opis osiągnięcia |
| `iconUrl` | String? | URL ikony |
| `earnedAt` | DateTime | Data zdobycia |

---

### Enumy:

```prisma
enum DataSource {
  STRAVA
  GARMIN
  MANUAL
}

enum TrainingPlanStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
}

enum Level {
  BEGINNER
  INTERMEDIATE
  ADVANCED
  ELITE
}

enum FocusType {
  ENDURANCE
  SPEED
  MIXED
}

enum WorkoutType {
  EASY
  TEMPO
  INTERVAL
  LONG
  RECOVERY
  REST_MOBILITY
}

enum GoalType {
  DISTANCE
  TIME
  COUNT
}

enum GoalPeriod {
  DAILY
  WEEKLY
  MONTHLY
  YEARLY
}
```

---

## 📂 Struktura projektu

```
Praca_Inz/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Definicja modeli bazy danych
│   │   ├── seed.js                # Dane testowe (seed)
│   │   └── migrations/            # Historia migracji
│   │       ├── 20251114173604_init/
│   │       ├── 20251116113104_add_activity_cluster_relation/
│   │       ├── 20251116124441_add_pace_distance_model/
│   │       └── 20251117230927_add_jwt_auth/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js        # Konfiguracja Prisma Client
│   │   │   └── passport.js        # Konfiguracja Passport OAuth (deprecated)
│   │   ├── controllers/
│   │   │   ├── auth.controller.js         # Logika autoryzacji (OAuth, JWT)
│   │   │   ├── activities.controller.js   # CRUD aktywności
│   │   │   ├── analytics.controller.js    # Agregacje i wykresy
│   │   │   ├── data.controller.js         # Statystyki i rekordy
│   │   │   └── trainingPlan.controller.js # CRUD planów, sync z Google
│   │   ├── middleware/
│   │   │   └── auth.middleware.js         # Weryfikacja JWT
│   │   ├── routes/
│   │   │   ├── auth.routes.js
│   │   │   ├── activities.routes.js
│   │   │   ├── analytics.routes.js
│   │   │   ├── data.routes.js
│   │   │   └── trainingPlan.routes.js
│   │   ├── services/
│   │   │   ├── strava.service.js          # Integracja Strava API
│   │   │   ├── google.service.js          # Integracja Google Calendar/Tasks
│   │   │   ├── jwt.service.js             # Generowanie/weryfikacja JWT
│   │   │   └── email.service.js           # Wysyłka email (nodemailer)
│   │   ├── utils/
│   │   │   ├── auth.utils.js              # Funkcje pomocnicze OAuth
│   │   │   └── trainingMetrics.js         # Obliczenia metryk (VDOT, tempo, HR zones)
│   │   └── server.js                      # Entry point (Express app)
│   ├── scripts/
│   │   ├── check-activities.js            # Debug: sprawdzanie aktywności w DB
│   │   ├── check-strava-tokens.js         # Debug: walidacja tokenów Strava
│   │   ├── clear-activities.js            # Utility: czyszczenie aktywności
│   │   ├── fullStravaSync.js              # Pełna synchronizacja Strava
│   │   ├── getStravaToken.js              # Utility: pobranie tokenu Strava
│   │   ├── importStravaZip.js             # Import aktywności z ZIP
│   │   ├── show-strava-connections.js     # Debug: lista połączeń Strava
│   │   └── unlink-strava.js               # Utility: odłączenie Strava
│   ├── package.json
│   ├── .env.example                       # Przykładowa konfiguracja środowiska
│   └── command_zip.txt                    # Notatki (komenda ZIP)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx                 # Layout aplikacji (navbar, sidebar)
│   │   │   ├── Layout.css
│   │   │   ├── GlobalFilters.jsx          # Komponenty filtrów (daty, typ, źródło)
│   │   │   ├── GlobalFilters.css
│   │   │   ├── ActivityModal.jsx          # Modal szczegółów aktywności
│   │   │   ├── ActivityModal.css
│   │   │   ├── SessionModal.jsx           # Modal szczegółów treningu w planie
│   │   │   ├── SessionModal.css
│   │   │   ├── WorkoutModal.jsx           # Modal edycji/tworzenia treningu
│   │   │   ├── WorkoutBlockEditor.jsx     # Edytor bloków treningowych (DnD)
│   │   │   ├── WeekView.jsx               # Widok tygodniowy planu (DnD, collapse)
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── HomePage.jsx               # Strona powitalna (wybór OAuth)
│   │   │   ├── HomePage.css
│   │   │   ├── LoginPage.jsx              # Strona logowania (legacy)
│   │   │   ├── RegisterPage.jsx           # Strona rejestracji (legacy)
│   │   │   ├── DashboardPage.jsx          # Dashboard (stats, ostatnie aktywności)
│   │   │   ├── DashboardPage.css
│   │   │   ├── AnalyticsPage.jsx          # Analityka (wykresy, trendy)
│   │   │   ├── AnalyticsPage.css
│   │   │   ├── DataPage.jsx               # Statystyki (rekordy, średnie)
│   │   │   ├── DataPage.css
│   │   │   ├── TrainingPlanPage.jsx       # Lista planów treningowych
│   │   │   ├── TrainingPlanPage.css
│   │   │   ├── TrainingPlanDetailPage.jsx # Szczegóły planu (week/list view)
│   │   │   ├── TrainingPlanDetailPage.css
│   │   │   ├── ComparePage.jsx            # Porównanie aktywności (future)
│   │   │   ├── ComparePage.css
│   │   │   ├── AccountPage.jsx            # Ustawienia konta
│   │   │   └── AccountPage.css
│   │   ├── context/
│   │   │   └── FilterContext.jsx          # Context API (globalne filtry)
│   │   ├── services/
│   │   │   └── api.js                     # Axios client (interceptory JWT)
│   │   ├── App.jsx                        # Routing główny (React Router)
│   │   ├── main.jsx                       # Entry point (ReactDOM)
│   │   └── index.css                      # Style globalne
│   ├── index.html                         # HTML template
│   ├── package.json
│   └── vite.config.js                     # Konfiguracja Vite (proxy, build)
│
├── README.md                              # Dokumentacja projektu
├── setup.sh                               # Skrypt instalacyjny (backend + frontend)
└── start.sh                               # Skrypt uruchamiający (backend + frontend)
```

---

## ⚙️ Instalacja i konfiguracja

### Wymagania systemowe

- **Node.js** >= 18.x
- **PostgreSQL** >= 14.x
- **npm** >= 9.x (lub **yarn** >= 1.22)
- **Git**

### 1. Klonowanie repozytorium

```bash
git clone <URL_REPOZYTORIUM>
cd Praca_Inz
```

### 2. Konfiguracja PostgreSQL

Utwórz bazę danych:

```bash
createdb training_db
```

Lub przez psql:

```sql
CREATE DATABASE training_db;
```

### 3. Konfiguracja backendu

Przejdź do folderu backend i zainstaluj zależności:

```bash
cd backend
npm install
```

Skopiuj przykładową konfigurację środowiska:

```bash
cp .env.example .env
```

Edytuj plik `.env`:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/training_db?schema=public"

# Server
PORT=5000
NODE_ENV=development

# JWT
JWT_SECRET=<WYGENERUJ_LOSOWY_SECRET_MIN_32_ZNAKI>
JWT_REFRESH_SECRET=<WYGENERUJ_LOSOWY_SECRET_MIN_32_ZNAKI>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Frontend URL
CLIENT_URL=http://localhost:3000

# Strava OAuth
STRAVA_CLIENT_ID=<TWOJ_STRAVA_CLIENT_ID>
STRAVA_CLIENT_SECRET=<TWOJ_STRAVA_CLIENT_SECRET>
STRAVA_CALLBACK_URL=http://localhost:5000/api/auth/strava/callback

# Google OAuth
GOOGLE_CLIENT_ID=<TWOJ_GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<TWOJ_GOOGLE_CLIENT_SECRET>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback

# OpenAI (dla generowania planów AI)
OPENAI_API_KEY=<TWOJ_OPENAI_API_KEY>
```

#### Generowanie JWT secrets:

```bash
# W terminalu:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Ustawienie Strava OAuth:

1. Zarejestruj aplikację: https://www.strava.com/settings/api
2. **Authorization Callback Domain:** `localhost`
3. Skopiuj **Client ID** i **Client Secret** do `.env`

#### Ustawienie Google OAuth:

1. Przejdź do: https://console.cloud.google.com/
2. Utwórz nowy projekt (lub wybierz istniejący)
3. Włącz API:
   - Google Calendar API
   - Google Tasks API
   - Google+ API (dla userinfo)
4. Utwórz credentials (OAuth 2.0 Client ID):
   - **Application type:** Web application
   - **Authorized redirect URIs:** `http://localhost:5000/api/auth/google/callback`
5. Skopiuj **Client ID** i **Client Secret** do `.env`

#### Ustawienie OpenAI API:

1. Zarejestruj się: https://platform.openai.com/
2. Utwórz API key: https://platform.openai.com/api-keys
3. Skopiuj klucz do `.env`

### 4. Migracja bazy danych

Wygeneruj Prisma Client i uruchom migracje:

```bash
npx prisma generate
npx prisma migrate deploy
```

Opcjonalnie: załaduj dane testowe (seed):

```bash
npx prisma db seed
```

### 5. Uruchomienie backendu

```bash
npm run dev
```

Backend będzie dostępny pod: **http://localhost:5000**

### 6. Konfiguracja frontendu

W nowym terminalu przejdź do folderu frontend:

```bash
cd frontend
npm install
```

Edytuj `vite.config.js` jeśli potrzeba (domyślnie proxy na `http://localhost:5000`):

```js
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
```

### 7. Uruchomienie frontendu

```bash
npm run dev
```

Frontend będzie dostępny pod: **http://localhost:3000**

### 8. Dostęp do Prisma Studio (GUI bazy danych)

W osobnym terminalu:

```bash
cd backend
npx prisma studio
```

Prisma Studio dostępne pod: **http://localhost:5555**

---

## 🔌 API Endpoints

### Autoryzacja

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/auth/google` | Inicjalizacja OAuth Google |
| `GET` | `/api/auth/google/callback` | Callback OAuth Google |
| `GET` | `/api/auth/strava` | Inicjalizacja OAuth Strava |
| `GET` | `/api/auth/strava/callback` | Callback OAuth Strava |
| `GET` | `/api/auth/garmin` | Inicjalizacja OAuth Garmin (501 Not Implemented) |
| `GET` | `/api/auth/me` | Dane zalogowanego użytkownika (wymaga JWT) |
| `POST` | `/api/auth/refresh` | Odświeżenie access tokenu (wymaga refresh token w cookie) |
| `POST` | `/api/auth/logout` | Wylogowanie (usunięcie cookies) |

### Aktywności

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/activities` | Lista aktywności użytkownika (query: `?startDate=...&endDate=...&type=...&source=...`) |
| `POST` | `/api/activities/sync` | Synchronizacja aktywności ze Strava |
| `GET` | `/api/activities/:id` | Szczegóły aktywności |
| `POST` | `/api/activities` | Ręczne dodanie aktywności |
| `PUT` | `/api/activities/:id` | Edycja aktywności |
| `DELETE` | `/api/activities/:id` | Usunięcie aktywności |
| `GET` | `/api/activities/export` | Eksport aktywności do CSV |

### Analityka

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/analytics/distribution` | Rozkład typów aktywności (pie chart) |
| `GET` | `/api/analytics/weekly-stats` | Statystyki tygodniowe (bar chart) |
| `GET` | `/api/analytics/monthly-trends` | Trendy miesięczne (line chart) |
| `GET` | `/api/analytics/intensity-distribution` | Rozkład intensywności (histogram tętna) |
| `GET` | `/api/analytics/progress` | Postępy w czasie (time series) |

### Dane i statystyki

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/data/stats` | Podstawowe statystyki użytkownika (total distance, count, avg pace) |
| `GET` | `/api/data/longest-activity` | Najdłuższy trening (ORDER BY distance DESC LIMIT 1) |
| `GET` | `/api/data/hardest-activity` | Najtrudniejszy trening (złożone zapytanie) |
| `GET` | `/api/data/records` | Rekordy według typów aktywności |
| `GET` | `/api/data/averages` | Średnie wartości per typ aktywności |

### Plany treningowe

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/training-plans` | Lista planów użytkownika |
| `POST` | `/api/training-plans` | Utworzenie nowego planu (ręcznie) |
| `POST` | `/api/training-plans/generate` | Generowanie planu AI (OpenAI GPT-4) |
| `GET` | `/api/training-plans/:id` | Szczegóły planu (z weeks i workouts) |
| `PUT` | `/api/training-plans/:id` | Edycja planu |
| `DELETE` | `/api/training-plans/:id` | Usunięcie planu |
| `POST` | `/api/training-plans/:id/sync/calendar` | Synchronizacja z Google Calendar |
| `POST` | `/api/training-plans/:id/sync/tasks` | Synchronizacja z Google Tasks |
| `PUT` | `/api/training-plans/:id/workouts/:workoutId` | Edycja treningu w planie |
| `DELETE` | `/api/training-plans/:id/workouts/:workoutId` | Usunięcie treningu |

### Cele

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/goals` | Lista celów użytkownika |
| `POST` | `/api/goals` | Utworzenie nowego celu |
| `PUT` | `/api/goals/:id` | Edycja celu |
| `DELETE` | `/api/goals/:id` | Usunięcie celu |

### Osiągnięcia

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/api/achievements` | Lista osiągnięć użytkownika |

---

## 🖼️ Frontend - Komponenty

### Strony (Pages)

#### 1. **HomePage** (`/`)
- Wybór źródła danych (Google/Strava/Garmin)
- Przyciski OAuth z ikonami
- Prezentacja funkcji aplikacji

#### 2. **DashboardPage** (`/dashboard`)
- Podsumowanie statystyk: total distance, liczba aktywności, średnie tempo
- Wykres aktywności z ostatnich 7/30 dni (Recharts line chart)
- Lista ostatnich 10 aktywności (tabela z modal szczegółów)
- Przycisk "Synchronizuj dane"

#### 3. **AnalyticsPage** (`/analytics`)
- **Rozkład typów aktywności** – pie chart (Chart.js)
- **Statystyki tygodniowe** – bar chart (dystans, liczba treningów)
- **Trendy miesięczne** – line chart (dystans, tempo średnie)
- **Rozkład intensywności** – histogram tętna (Recharts)

#### 4. **DataPage** (`/data`)
- **Najdłuższy trening** – karta z szczegółami
- **Najtrudniejszy trening** – karta z metryką (dystans × tempo × przewyższenie)
- **Rekordy według typów** – tabela (max distance, min pace, max elevation per typ)
- **Średnie wartości** – tabela (avg pace, avg HR, avg distance per typ)

#### 5. **TrainingPlanPage** (`/training-plan`)
- Lista planów użytkownika (kafelki)
- Przycisk "Stwórz nowy plan" (modal z formularzem)
- Przycisk "Generuj plan AI" (modal z formularzem AI)
- Filtry: status (ACTIVE/COMPLETED/ARCHIVED), poziom, fokus

#### 6. **TrainingPlanDetailPage** (`/training-plan/:id`)
- **Tryby widoku:** Week (tygodniowy) / List (lista)
- **Widok tygodniowy (WeekView):**
  - Collapse/expand tygodni
  - Drag-and-drop treningów między dniami
  - Przycisk "+" do dodawania treningów
  - Przycisk "🗑️" do usuwania treningów
  - Kafelki treningów z kolorami typu
  - localStorage dla stanu UI (rozwinięte tygodnie)
- **Widok listy:**
  - Tabela treningów (dzień, nazwa, typ, czas, dystans)
  - Klik na trening otwiera modal szczegółów
- **Modal wyboru daty rozpoczęcia:**
  - Input type="date" (domyślnie: najbliższy poniedziałek)
  - Przycisk "Potwierdź synchronizację"
- **Przyciski akcji:**
  - "Synchronizuj z Google Calendar"
  - "Synchronizuj z Google Tasks"
  - "Eksportuj do PDF" (future)

#### 7. **AccountPage** (`/account`)
- Dane użytkownika (email, ID)
- Połączone konta (Google, Strava, Garmin)
- Przycisk "Odłącz konto"
- Przycisk "Usuń konto" (future)

---

### Komponenty (Components)

#### 1. **Layout**
- Navbar z logo i menu nawigacyjnym
- Sidebar z linkami (Dashboard, Analytics, Data, Training Plan, Account)
- Przycisk wylogowania
- Responsywny design (hamburger menu na mobile)

#### 2. **GlobalFilters**
- Filtry globalne (Context API):
  - Zakres dat (date pickers: startDate, endDate)
  - Typ aktywności (dropdown: All/Run/Ride/Swim/...)
  - Źródło (dropdown: All/Strava/Garmin)
- Przycisk "Resetuj filtry"
- Przycisk "Zastosuj" (triggeruje re-fetch danych)

#### 3. **ActivityModal**
- Wyświetla szczegóły aktywności:
  - Nazwa, typ, data
  - Dystans, czas, tempo, przewyższenie
  - Tętno (avg/max)
  - Kalorie
- Mapa trasy (Leaflet.js) – jeśli dostępne współrzędne GPS
- Wykres tętna w czasie (Chart.js) – jeśli dostępne dane stream
- Przycisk "Edytuj" / "Usuń"

#### 4. **SessionModal**
- Wyświetla szczegóły treningu w planie (ReadOnly):
  - Nazwa, typ, data, czas, dystans
  - Struktura bloków (lista z legendą)
  - Notatki
- Przycisk "Edytuj" → otwiera WorkoutModal

#### 5. **WorkoutModal**
- Formularz edycji/tworzenia treningu:
  - Nazwa, typ (dropdown)
  - Toggle "REST/MOBILITY" – ukrywa strukturę bloków
  - Dzień tygodnia (dropdown: pon-ndz)
  - Notatki (textarea)
- **WorkoutBlockEditor** – edytor bloków treningowych
- Przyciski: "Zapisz", "Anuluj"

#### 6. **WorkoutBlockEditor**
- **Wizualizacja bloków** – timeline (oś czasu)
- **DnD bloków:**
  - Drag-and-drop bloków (HTML5 Drag & Drop API)
  - Automatyczne grupowanie interval+recovery (getDragGroup)
  - Drop na kontenerze (getDropIndexFromPointer)
  - Logika "połówek" (wstawienie przed/za blokiem w zależności od clientX)
- **Edycja bloków:**
  - Uchwyt narożny (bottom-right) – zmiana czasu i tempa (diagonal resize)
  - Uchwyt górny (top-center) – zmiana tylko tempa (pace-only resize)
  - Przycisk delete (bottom-right, ikona Trash2)
  - Minimum czasu: 10 min (600s) dla resize
- **Dodawanie bloków:**
  - Przycisk "+" – dropdown wyboru typu (WARMUP/INTERVAL/RECOVERY/COOLDOWN)
  - Auto-insert na końcu timeline
- **ReadOnly mode:**
  - Blokada edycji w podglądzie (SessionModal)
  - Ukrywanie uchwytów i przycisków delete
- **Wizualne parowanie:**
  - Klasy CSS `paired-interval`, `paired-recovery`
  - Negative margin-left: -4px dla efektu połączenia
- **Kompresja powtórzeń:**
  - Wykrywanie powtarzających się par interval+recovery
  - Badge "3x" na pierwszym interwale
  - Wyświetlanie skompresowanej legendy (np. "3x (800m @ 4:00/km + 400m jog)")

#### 7. **WeekView**
- Widok tygodniowy planu:
  - Siatka 7 dni × N tygodni
  - Collapse/expand tygodni (onClick na nagłówku)
  - Drag-and-drop treningów między dniami (onDragStart, onDragOver, onDrop)
  - Kafelki treningów z kolorami typu (CSS variables: --workout-easy, --workout-tempo, ...)
  - Przycisk "+" w każdym dniu (dodawanie treningu)
  - Przycisk "🗑️" na kafelku (usuwanie treningu, z confirm dialogiem)
- **Persist UI state:**
  - Zapis stanu rozwinięcia tygodni w localStorage (klucz: `plan-${planId}-collapsed-weeks`)
  - Automatyczne odtworzenie stanu przy ponownym wejściu

---

### Context API

#### **FilterContext**
- Zarządza globalnymi filtrami (startDate, endDate, type, source)
- Dostarcza funkcje: setFilters, resetFilters
- Konsumowany przez: DashboardPage, AnalyticsPage, DataPage

---

### Axios HTTP Client (`api.js`)

#### Konfiguracja:
- Base URL: `http://localhost:3000` (lub `process.env.VITE_API_URL`)
- Interceptory:
  - **Request interceptor:** dołącza JWT access token z cookie (`Authorization: Bearer ${token}`)
  - **Response interceptor:** obsługa błędów, auto-refresh tokenu przy 401
    - Jeśli 401 → wywołanie `/api/auth/refresh` z refresh tokenem
    - Retry oryginalnego requestu z nowym access tokenem
    - Jeśli refresh fails → redirect do `/`

#### Funkcje:
- `syncToStrava()` – POST `/api/activities/sync`
- `syncToCalendar(planId, startDate)` – POST `/api/training-plans/:id/sync/calendar` (body: `{customStartDate}`)
- `syncToTasks(planId, startDate)` – POST `/api/training-plans/:id/sync/tasks` (body: `{customStartDate}`)
- `generateAIPlan(params)` – POST `/api/training-plans/generate` (body: `{raceDistance, raceDate, level}`)
- ... (CRUD dla aktywności, planów, celów)

---

## 🔐 Bezpieczeństwo

### 1. **Autoryzacja JWT**
- **Access token:** krótki czas życia (15 min), przesyłany w cookie HTTP-only
- **Refresh token:** długi czas życia (7 dni), przesyłany w cookie HTTP-only, zapisany w bazie (User.jwtRefreshToken)
- **Weryfikacja:** middleware `auth.middleware.js` sprawdza access token w każdym protected endpoint
- **Auto-refresh:** frontend automatycznie odświeża access token przy 401 (interceptor Axios)

### 2. **OAuth 2.0**
- **Google/Strava:** authorization code flow
- **Scopes:**
  - Google: `email`, `profile`, `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/tasks`
  - Strava: `read`, `activity:read_all`
- **Tokens:** access token i refresh token zapisane w bazie (encrypted - future)
- **CSRF protection:** state parameter w OAuth flow

### 3. **CORS**
- Whitelist dozwolonych origin: `CLIENT_URL` z `.env`
- Credentials allowed: `credentials: true` (dla cookies)

### 4. **Walidacja danych wejściowych**
- Backend: walidacja parametrów (type, range, format) przed wykonaniem query
- Frontend: walidacja formularzy (required, min/max, pattern)

### 5. **SQL Injection protection**
- Prisma ORM stosuje prepared statements (automatyczna sanityzacja)

### 6. **Szyfrowanie haseł** (future - local auth)
- bcrypt z salt rounds: 10
- Hashing przed zapisem do bazy

### 7. **HTTPS w produkcji**
- Wymóg HTTPS dla produkcyjnego deploymentu
- Secure cookies (flag `secure: true` w produkcji)

### 8. **Rate limiting** (future)
- express-rate-limit dla ochrony przed brute-force
- Różne limity dla authenticated/anonymous users

### 9. **Environment variables**
- Secrets przechowywane w `.env` (NIE commitowane do repo)
- `.gitignore` zawiera `.env`

---

## 🚀 Dalszy rozwój

### Planowane funkcje:

1. **Integracja Garmin Connect API**
   - Wymaga umowy partnerskiej Garmin
   - Synchronizacja aktywności, metryk zdrowotnych (VO2max, Recovery Time)

2. **Eksport planów do PDF**
   - Biblioteka: `jsPDF` lub `pdfmake`
   - Layout: tydzień na stronę, szczegóły bloków

3. **Email notifications**
   - Przypomnienia o nadchodzących treningach
   - Podsumowania tygodniowe (completed workouts, stats)
   - Newsletter z tipami treningowymi

4. **Współdzielenie planów**
   - Publiczne linki do planów (read-only)
   - Fork planu innego użytkownika
   - Social features (komentarze, polubienia)

5. **Mobile app**
   - React Native (kod współdzielony z web)
   - Push notifications (nadchodzące treningi)
   - Offline mode (local storage, sync on reconnect)

6. **Advanced analytics**
   - Predykcje czasu wyścigu (VDOT, Riegel formula)
   - Training load (TSS - Training Stress Score)
   - Fatigue & Fitness (CTL/ATL/TSB)
   - Injury risk prediction (ML model)

7. **Nutrition tracking**
   - Integracja MyFitnessPal API
   - Obliczanie kalorii spalonej vs spożytej
   - Rekomendacje żywieniowe (AI)

8. **Race calendar**
   - Baza danych wyścigów (data, lokalizacja, dystans)
   - Integracja z kalendarzem
   - Rekomendacje wyścigów (na podstawie lokalizacji i poziomu)

9. **Team/Coach features**
   - Konta trenerów
   - Przypisywanie planów do podopiecznych
   - Monitorowanie postępów zespołu
   - Chat trenera z podopiecznym

10. **Tests (unit + integration)**
    - Jest dla backendu (controllers, services)
    - Supertest dla API endpoints
    - React Testing Library dla frontendu

---

## 📝 Licencja

Projekt stworzony na potrzeby pracy inżynierskiej. Wszelkie prawa zastrzeżone.

**Autor:** Michał Mróz  
**Uczelnia:** Polsko-Japońska Akademia Technik Komputerowych (PJATK)  
**Rok:** 2024/2025
