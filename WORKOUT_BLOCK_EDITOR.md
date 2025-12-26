# Wizualny Edytor Bloków Treningowych

## Przegląd

Nowa funkcjonalność dodana do aplikacji pozwala na wizualne tworzenie i edycję struktury treningów przy użyciu bloków graficznych, podobnie do edytorów audio (np. GarageBand, Audacity).

## Komponenty

### 1. WorkoutBlockEditor.jsx
Główny komponent edytora bloków treningowych.

**Lokalizacja:** `frontend/src/components/WorkoutBlockEditor.jsx`

**Funkcjonalność:**
- Wizualna reprezentacja faz treningu jako kolorowe bloki
- Interaktywna edycja poprzez:
  - **Przeciąganie** - zmiana kolejności bloków (drag & drop)
  - **Rozciąganie w pionie** - zmiana intensywności (wysokość bloku = 30-100%)
  - **Edycja właściwości** - panel po wybraniu bloku
- Automatyczne obliczanie całkowitego czasu treningu
- Typy bloków:
  - Rozgrzewka (warmup) - zielony
  - Interwały (intervals) - czerwony
  - Tempo (tempo) - pomarańczowy
  - Główna część (main) - fioletowy
  - Regeneracja (recovery) - niebieski
  - Wychłodzenie (cooldown) - indygo

**Właściwości bloku:**
```javascript
{
  id: string,           // Unikalny identyfikator
  type: string,         // Typ bloku (warmup, intervals, etc.)
  duration: number,     // Czas w minutach
  intensity: number,    // Intensywność 30-100%
  pace: string,         // Tempo (np. "4:30" = 4:30/km)
  distance: number,     // Dystans w km (opcjonalny)
  repetitions: number,  // Liczba powtórzeń (tylko dla intervals)
  intervalDistance: number, // Dystans interwału w metrach
  recoveryTime: number  // Czas odpoczynku w sekundach
}
```

**Interfejs użytkownika:**
- **Oś czasu** - pozioma reprezentacja bloków
  - Szerokość bloku = procent całkowitego czasu treningu
  - Wysokość bloku = intensywność (30-100%)
  - Kolor bloku = typ treningu
- **Panel właściwości** - szczegóły wybranego bloku
- **Podsumowanie** - całkowity czas i dystans
- **Legenda** - kolory typów bloków

### 2. WorkoutBlockEditor.css
Stylizacja edytora bloków.

**Lokalizacja:** `frontend/src/components/WorkoutBlockEditor.css`

**Kluczowe style:**
- `.blocks-timeline` - kontener bloków z gradientem tła
- `.timeline-block` - pojedynczy blok z animacjami hover
- `.resize-handle` - uchwyt do zmiany intensywności
- `.block-properties` - panel edycji właściwości
- Responsywne dla urządzeń mobilnych

### 3. Integracja z WorkoutModal.jsx

**Zmiany w WorkoutModal:**
1. Import komponentu `WorkoutBlockEditor`
2. Nowy stan:
   ```javascript
   const [useBlockEditor, setUseBlockEditor] = useState(false);
   const [workoutBlocks, setWorkoutBlocks] = useState([]);
   ```
3. Checkbox do włączenia edytora bloków
4. Warunkowe renderowanie edytora
5. Automatyczne obliczanie `targetDuration` z bloków
6. Zapisywanie bloków w polu `intervals` jako JSON

**Struktura JSON zapisywana w bazie:**
```json
{
  "intervals": {
    "blocks": [
      {
        "id": "1",
        "type": "warmup",
        "duration": 10,
        "intensity": 60,
        "pace": "6:00",
        "distance": 2
      },
      {
        "id": "2",
        "type": "intervals",
        "duration": 20,
        "intensity": 90,
        "pace": "4:20",
        "repetitions": 8,
        "intervalDistance": 400,
        "recoveryTime": 60
      },
      {
        "id": "3",
        "type": "cooldown",
        "duration": 5,
        "intensity": 50,
        "pace": "6:30",
        "distance": 1
      }
    ]
  }
}
```

## Instrukcja użytkowania

### Dla użytkownika końcowego:

1. **Otwórz modal edycji/dodawania treningu**
   - Kliknij "Edytuj" przy istniejącym treningu, lub
   - Kliknij "Dodaj trening" w danym tygodniu

2. **Włącz edytor bloków**
   - Zaznacz checkbox "Użyj wizualnego edytora bloków treningowych"

3. **Dodaj bloki treningu**
   - Kliknij przycisk "+" po prawej stronie osi czasu
   - Nowy blok pojawi się na końcu

4. **Edytuj blok**
   - **Kliknij** na blok aby go wybrać
   - W panelu właściwości zmień:
     - Typ (warmup, intervals, tempo, etc.)
     - Czas trwania w minutach
     - Intensywność (30-100%)
     - Tempo (min/km)
     - Dystans (km)
     - Dla interwałów: powtórzenia, dystans, odpoczynek

5. **Zmień intensywność wizualnie**
   - **Najedź** na blok
   - Pojawi się uchwyt (↕️) u góry bloku
   - **Przeciągnij** uchwyt w górę (wyższa intensywność) lub w dół (niższa)

6. **Zmień kolejność bloków**
   - **Przeciągnij** blok na nową pozycję (drag & drop)

7. **Usuń blok**
   - **Najedź** na blok
   - Kliknij przycisk 🗑️ w prawym górnym rogu

8. **Sprawdź podsumowanie**
   - U góry edytora widoczny jest:
     - Całkowity czas treningu (suma bloków)
     - Całkowity dystans (suma bloków)

9. **Zapisz trening**
   - Kliknij "Zapisz zmiany" lub "Dodaj trening"
   - Struktura bloków zostanie zapisana w bazie danych

## Przykładowe scenariusze

### Scenariusz 1: Trening interwałowy
```
1. Rozgrzewka - 10 min @ 6:00/km (60% intensywność)
2. Interwały - 20 min @ 4:20/km (90% intensywność)
   - 8 x 400m
   - Odpoczynek: 60s
3. Wychłodzenie - 5 min @ 6:30/km (50% intensywność)

Całkowity czas: 35 min
Całkowity dystans: 8.7 km
```

### Scenariusz 2: Bieg tempo
```
1. Rozgrzewka - 15 min @ 6:00/km (60% intensywność)
2. Tempo - 30 min @ 4:45/km (85% intensywność)
3. Wychłodzenie - 10 min @ 6:30/km (50% intensywność)

Całkowity czas: 55 min
Całkowity dystans: 11.3 km
```

## Zalety wizualnego edytora

1. **Intuicyjność** - wizualna reprezentacja struktury treningu
2. **Szybkość** - szybsze tworzenie złożonych treningów niż wypełnianie formularzy
3. **Przejrzystość** - łatwe zrozumienie proporcji faz treningu
4. **Interaktywność** - natychmiastowa informacja zwrotna
5. **Elastyczność** - łatwa modyfikacja struktury (dodawanie, usuwanie, zmiana kolejności)

## Kompatybilność z bazą danych

Edytor bloków korzysta z istniejącego pola `intervals` (JSON) w modelu `PlanWorkout`:

```prisma
model PlanWorkout {
  id              String    @id @default(uuid())
  // ... inne pola
  intervals       Json?     // Tutaj zapisywana jest struktura bloków
  targetDuration  Int?      // Automatycznie obliczane z bloków
}
```

## Responsywność

Edytor jest w pełni responsywny:
- **Desktop** - pełna funkcjonalność, wszystkie kontrolki widoczne
- **Tablet** - zoptymalizowany layout, panel właściwości pod blokami
- **Mobile** - uproszczony widok, bloki przewijane poziomo

## Przyszłe rozszerzenia (opcjonalne)

1. **Szablony treningów** - gotowe struktury do szybkiego użycia
2. **Import/Export** - zapisywanie i udostępnianie struktur
3. **Podgląd wykresu** - wizualizacja intensywności w czasie
4. **Integracja z Strava** - porównanie planu z rzeczywistym treningiem
5. **AI sugestie** - automatyczne dopasowanie bloków do celów
6. **Kopia bloków** - duplikowanie podobnych faz

## Wsparcie techniczne

W razie problemów sprawdź:
1. Czy checkbox "Użyj wizualnego edytora bloków" jest zaznaczony
2. Czy wszystkie wymagane pola formularza są wypełnione
3. Konsolę przeglądarki (F12) w poszukiwaniu błędów JavaScript
4. Czy bloki mają ustawione wartości duration > 0

## Podsumowanie

Wizualny edytor bloków treningowych znacznie usprawnia proces tworzenia i edycji złożonych planów treningowych. Zamiast ręcznie wpisywać strukturę treningu w pola tekstowe, użytkownik może wizualnie "narysować" trening, dostosowując proporcje poszczególnych faz przez prostą interakcję myszą.
