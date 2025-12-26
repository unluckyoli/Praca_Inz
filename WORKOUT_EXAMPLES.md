# Przykłady użycia Wizualnego Edytora Bloków

## Przykład 1: Trening interwałowy dla początkujących

### Struktura wizualna:
```
┌─────────────┬──────────────────────────────┬─────────┐
│ Rozgrzewka  │      Interwały (8x400m)      │ Cooldown│
│  10 min     │         20 min               │  5 min  │
│  60% ███    │         90% ████████         │  50% ██ │
│ 6:00/km     │        4:20/km + 60s rec     │ 6:30/km │
│  2.0 km     │         3.2 km               │  0.8 km │
└─────────────┴──────────────────────────────┴─────────┘
```

### Parametry bloków:
**Blok 1 - Rozgrzewka:**
- Typ: warmup (zielony)
- Czas: 10 min
- Intensywność: 60%
- Tempo: 6:00/km
- Dystans: 2.0 km

**Blok 2 - Interwały:**
- Typ: intervals (czerwony)
- Czas: 20 min
- Intensywność: 90%
- Tempo: 4:20/km
- Powtórzenia: 8
- Dystans interwału: 400m
- Odpoczynek: 60s

**Blok 3 - Wychłodzenie:**
- Typ: cooldown (indygo)
- Czas: 5 min
- Intensywność: 50%
- Tempo: 6:30/km
- Dystans: 0.8 km

**Podsumowanie:**
- Całkowity czas: 35 min
- Całkowity dystans: 6.0 km

---

## Przykład 2: Długi bieg z tempem

### Struktura wizualna:
```
┌──────────┬────────────────────────────────┬────────────────────────────┬──────────┐
│Rozgrzewka│         Tempo run              │      Easy pace             │ Cooldown │
│ 15 min   │          30 min                │         25 min             │  10 min  │
│ 60% ███  │          85% ████████          │         65% ████           │  50% ██  │
│ 6:00/km  │         4:45/km                │        5:45/km             │ 6:30/km  │
│ 2.5 km   │          6.3 km                │         4.3 km             │  1.5 km  │
└──────────┴────────────────────────────────┴────────────────────────────┴──────────┘
```

### Parametry bloków:
**Blok 1 - Rozgrzewka:**
- Typ: warmup (zielony)
- Czas: 15 min
- Intensywność: 60%
- Tempo: 6:00/km
- Dystans: 2.5 km

**Blok 2 - Tempo run:**
- Typ: tempo (pomarańczowy)
- Czas: 30 min
- Intensywność: 85%
- Tempo: 4:45/km
- Dystans: 6.3 km

**Blok 3 - Easy pace:**
- Typ: main (fioletowy)
- Czas: 25 min
- Intensywność: 65%
- Tempo: 5:45/km
- Dystans: 4.3 km

**Blok 4 - Wychłodzenie:**
- Typ: cooldown (indygo)
- Czas: 10 min
- Intensywność: 50%
- Tempo: 6:30/km
- Dystans: 1.5 km

**Podsumowanie:**
- Całkowity czas: 80 min (1h 20min)
- Całkowity dystans: 14.6 km

---

## Przykład 3: Piramida interwałowa

### Struktura wizualna:
```
┌──────┬─────┬──────┬───────┬──────┬─────┬──────┐
│Warm  │400m │ 800m │ 1200m │ 800m │400m │Cool  │
│10min │3min │ 6min │  9min │ 6min │3min │5min  │
│60%███│90%█ │92%██ │95%███ │92%██ │90%█ │50%██ │
│6:00  │4:20 │4:15  │ 4:10  │4:15  │4:20 │6:30  │
└──────┴─────┴──────┴───────┴──────┴─────┴──────┘
```

### Parametry bloków:
**Blok 1 - Rozgrzewka:**
- Typ: warmup (zielony)
- Czas: 10 min
- Intensywność: 60%
- Tempo: 6:00/km

**Blok 2 - 400m:**
- Typ: intervals (czerwony)
- Czas: 3 min
- Intensywność: 90%
- Tempo: 4:20/km
- Powtórzenia: 2
- Dystans: 400m
- Odpoczynek: 90s

**Blok 3 - 800m:**
- Typ: intervals (czerwony)
- Czas: 6 min
- Intensywność: 92%
- Tempo: 4:15/km
- Powtórzenia: 2
- Dystans: 800m
- Odpoczynek: 90s

**Blok 4 - 1200m:**
- Typ: intervals (czerwony)
- Czas: 9 min
- Intensywność: 95%
- Tempo: 4:10/km
- Powtórzenia: 1
- Dystans: 1200m
- Odpoczynek: 120s

**Blok 5 - 800m:**
- Typ: intervals (czerwony)
- Czas: 6 min
- Intensywność: 92%
- Tempo: 4:15/km
- Powtórzenia: 2
- Dystans: 800m
- Odpoczynek: 90s

**Blok 6 - 400m:**
- Typ: intervals (czerwony)
- Czas: 3 min
- Intensywność: 90%
- Tempo: 4:20/km
- Powtórzenia: 2
- Dystans: 400m
- Odpoczynek: 90s

**Blok 7 - Wychłodzenie:**
- Typ: cooldown (indygo)
- Czas: 5 min
- Intensywność: 50%
- Tempo: 6:30/km

**Podsumowanie:**
- Całkowity czas: 42 min
- Całkowity dystans: ~9 km

---

## Przykład 4: Fartlek (szwedzkie interwały)

### Struktura wizualna:
```
┌────────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┬────────┐
│Warmup  │Fast │Easy │Fast │Easy │Fast │Easy │Fast │Cooldown│
│10 min  │4min │3min │5min │3min │3min │2min │2min │ 8 min  │
│60% ███ │85%█ │55%█ │90%█ │55%█ │88%█ │55%█ │92%█ │ 50% ██ │
│6:00/km │4:30 │6:00 │4:20 │6:00 │4:25 │6:00 │4:15 │ 6:30   │
└────────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┴────────┘
```

### Opis:
Fartlek to rodzaj treningu, gdzie szybkie odcinki przeplatane są z łatwymi. W edytorze bloków można to łatwo zobrazować przez naprzemienny układ wysokich (fast) i niskich (easy) bloków.

**Podsumowanie:**
- Całkowity czas: 40 min
- Tryb: Zmienne tempo (speed play)
- Całkowity dystans: ~7.5 km

---

## Przykład 5: Recovery run (bieg regeneracyjny)

### Struktura wizualna:
```
┌──────────────────────────────────────────────────────┐
│              Easy recovery run                        │
│                   30 min                              │
│                  50% ██                               │
│                 6:30/km                               │
│                  4.6 km                               │
└──────────────────────────────────────────────────────┘
```

### Parametry:
**Blok 1 - Recovery:**
- Typ: recovery (niebieski)
- Czas: 30 min
- Intensywność: 50%
- Tempo: 6:30/km
- Dystans: 4.6 km

**Podsumowanie:**
- Całkowity czas: 30 min
- Całkowity dystans: 4.6 km
- Cel: Aktywna regeneracja

---

## Przykład 6: Trening wzgórzowy (Hill repeats)

### Struktura wizualna:
```
┌──────────┬──────────────────────────────────────┬──────────┐
│ Warmup   │    Hill repeats (8x uphill)          │ Cooldown │
│ 15 min   │           24 min                     │  10 min  │
│ 60% ███  │           95% ████████               │  50% ██  │
│ 6:00/km  │          Uphill effort               │ 6:30/km  │
│ 2.5 km   │           ~3 km                      │  1.5 km  │
└──────────┴──────────────────────────────────────┴──────────┘
```

### Parametry bloków:
**Blok 1 - Rozgrzewka:**
- Typ: warmup (zielony)
- Czas: 15 min
- Intensywność: 60%
- Tempo: 6:00/km
- Dystans: 2.5 km

**Blok 2 - Hill repeats:**
- Typ: intervals (czerwony - można użyć typu HILL_REPEATS)
- Czas: 24 min
- Intensywność: 95%
- Tempo: Variable (uphill effort)
- Powtórzenia: 8
- Dystans interwału: 200m (uphill)
- Odpoczynek: 120s (downhill jog)

**Blok 3 - Wychłodzenie:**
- Typ: cooldown (indygo)
- Czas: 10 min
- Intensywność: 50%
- Tempo: 6:30/km
- Dystans: 1.5 km

**Podsumowanie:**
- Całkowity czas: 49 min
- Całkowity dystans: ~7 km
- Cel: Siła i moc

---

## Jak czytać wizualizacje:

### Symbole wysokości (intensywność):
- `██` = 30-40% - Bardzo lekkie
- `███` = 50-60% - Lekkie
- `████` = 65-75% - Umiarkowane
- `█████` = 76-85% - Mocne
- `██████` = 86-95% - Bardzo mocne
- `███████` = 96-100% - Maksymalne

### Kolory bloków (w aplikacji):
- 🟢 **Zielony** - Rozgrzewka (warmup)
- 🔴 **Czerwony** - Interwały (intervals)
- 🟠 **Pomarańczowy** - Tempo (tempo run)
- 🟣 **Fioletowy** - Główna część (main)
- 🔵 **Niebieski** - Regeneracja (recovery)
- 🟣 **Indygo** - Wychłodzenie (cooldown)

---

## Tips & Tricks:

1. **Szybkie kopiowanie bloków**: Zaznacz blok → Ctrl+C → Ctrl+V (przyszła funkcjonalność)
2. **Precyzyjne tempo**: Użyj formatu "4:30" dla tempa 4:30/km
3. **Auto-dystans**: Jeśli podasz tempo i czas, dystans oblicza się automatycznie
4. **Intensywność wizualna**: Przeciągnij uchwyt ↕️ aby szybko zmienić intensywność
5. **Kolejność bloków**: Przeciągnij bloki aby zmienić kolejność faz treningu

---

## Export do JSON (przykład):

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
        "distance": 2.0
      },
      {
        "id": "2",
        "type": "intervals",
        "duration": 20,
        "intensity": 90,
        "pace": "4:20",
        "repetitions": 8,
        "intervalDistance": 400,
        "recoveryTime": 60,
        "distance": 3.2
      },
      {
        "id": "3",
        "type": "cooldown",
        "duration": 5,
        "intensity": 50,
        "pace": "6:30",
        "distance": 0.8
      }
    ]
  },
  "totalDuration": 35,
  "totalDistance": 6.0
}
```

Ta struktura jest zapisywana w polu `intervals` modelu `PlanWorkout` i może być później użyta do wyświetlenia struktury treningu lub porównania z rzeczywistym treningiem ze Stravy.
