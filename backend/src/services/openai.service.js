import OpenAI from "openai";
import fs from "fs";

const ollamaClient = new OpenAI({
  baseURL: 'http://localhost:11434/v1',
  apiKey: 'ollama', 
});

const MODEL_NAME = 'qwen2.5:7b'; //'qwen2.5-optimized'

class OpenAIService {
  async generateTrainingPlan(userAnalysis, preferences) {
    try {
      const { weeksCount } = preferences;
      
      const WEEKS_PER_BATCH = 3;
      const batches = Math.ceil(weeksCount / WEEKS_PER_BATCH);
      
      console.log(`[Ollama] Generating ${weeksCount} weeks in ${batches} batches of ${WEEKS_PER_BATCH} weeks each...`);
      
      let allWeeks = [];
      let planName = '';
      let planDescription = '';
      
      for (let batch = 0; batch < batches; batch++) {
        const startWeek = batch * WEEKS_PER_BATCH + 1;
        const endWeek = Math.min((batch + 1) * WEEKS_PER_BATCH, weeksCount);
        const weeksInBatch = endWeek - startWeek + 1;
        
        console.log(`[Ollama] Batch ${batch + 1}/${batches}: Generating weeks ${startWeek}-${endWeek}...`);
        
        const batchPreferences = {
          ...preferences,
          weeksCount: weeksInBatch,
          startWeekNumber: startWeek,
          totalWeeksCount: weeksCount
        };
        
        const batchPlan = await this.generateBatch(userAnalysis, batchPreferences);
        
        if (batch === 0) {
          planName = batchPlan.planName;
          planDescription = batchPlan.planDescription;
        }
        
        allWeeks = allWeeks.concat(batchPlan.weeks);
        
        console.log(`[Ollama] Batch ${batch + 1} completed: ${batchPlan.weeks.length} weeks generated`);
      }
      
      return {
        planName,
        planDescription,
        weeks: allWeeks
      };
    } catch (error) {
      console.error("Ollama API error:", error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Ollama is not running. Please start Ollama with: ollama serve\n' +
          'Then make sure you have the model installed: ollama pull qwen2.5'
        );
      }
      
      throw new Error("Failed to generate training plan: " + error.message);
    }
  }

  async generateBatch(userAnalysis, preferences) {
    try {
      const prompt = this.buildPrompt(userAnalysis, preferences);

      console.log('[Ollama] Generating training plan with Qwen2.5...');
      console.log('[Ollama] This may take a moment...');

      const stream = await ollamaClient.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: "system",
            content: `You generate running training plans in pure JSON format. NO markdown, NO text before or after JSON.

CRITICAL RULES:
- Response MUST start with { and end with }
- All text fields maximum 40 characters
- Simple, concrete descriptions
- Valid JSON only
- NO comments, NO explanations
- MANDATORY: EVERY interval field (warmup, main, cooldown) MUST include pace like "2km @ 6:00/km"
- NEVER write just "2km" or "2km easy" - ALWAYS add "@ pace"`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        stream: true, 
      });

      let content = '';

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        content += delta;
      }

      console.log('[Ollama] Response received, parsing JSON...');
      
      console.log('[Ollama] Raw response length:', content.length);
      console.log('[Ollama] ========== FULL RAW RESPONSE START ==========');
      console.log(content);
      console.log('[Ollama] ========== FULL RAW RESPONSE END ==========');
      
      const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        content = codeBlockMatch[1];
        console.log('[Ollama] Extracted from markdown code block');
      }
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      console.log('[Ollama] Extracted JSON preview:', content.substring(0, 300));
      
      let planData;
      try {
        planData = JSON.parse(content);
      } catch (parseError) {
        console.error('[Ollama] JSON parse error:', parseError.message);
        console.error('[Ollama] Problematic content around error:');
        
        if (parseError.message.includes('position')) {
          const match = parseError.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            const start = Math.max(0, pos - 200);
            const end = Math.min(content.length, pos + 200);
            console.error('---CONTEXT START---');
            console.error(content.substring(start, end));
            console.error(' '.repeat(Math.min(200, pos - start)) + '^');
            console.error('---CONTEXT END---');
          }
        }
        
        console.log('[Ollama] ========== ATTEMPTING PARTIAL PARSE ==========');
        
        let partialData = null;
        try {
          const weeksMatch = content.match(/"weeks"\s*:\s*\[([\s\S]*?)(?=\s*\]|\s*$)/);
          if (weeksMatch) {
            const weeksContent = weeksMatch[1];
            const validWeeks = [];
            let currentPos = 0;
            
            while (currentPos < weeksContent.length) {
              const weekStart = weeksContent.indexOf('{', currentPos);
              if (weekStart === -1) break;
              
              let braceCount = 1;
              let weekEnd = weekStart + 1;
              
              while (weekEnd < weeksContent.length && braceCount > 0) {
                if (weeksContent[weekEnd] === '{') braceCount++;
                if (weeksContent[weekEnd] === '}') braceCount--;
                weekEnd++;
              }
              
              if (braceCount === 0) {
                try {
                  const weekJson = weeksContent.substring(weekStart, weekEnd);
                  const week = JSON.parse(weekJson);
                  validWeeks.push(week);
                  console.log(`[Ollama] Extracted week ${week.weekNumber} successfully`);
                } catch (e) {
                  console.log(`[Ollama] Failed to parse week at position ${weekStart}`);
                  break;
                }
              }
              
              currentPos = weekEnd;
            }
            
            if (validWeeks.length > 0) {
              partialData = {
                planName: "Plan treningowy (częściowy)",
                planDescription: "Plan wygenerowany częściowo z powodu błędu parsowania",
                weeks: validWeeks
              };
              console.log(`[Ollama] Extracted ${validWeeks.length} valid weeks from partial data`);
            }
          }
        } catch (partialError) {
          console.error('[Ollama] Partial parse also failed:', partialError.message);
        }
        
        console.log('[Ollama] Attempting to fix JSON...');
        
        let fixedContent = content;
        
        fixedContent = fixedContent.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        
        fixedContent = fixedContent.replace(/: "([^"]*)\n([^"]*?)"/g, (match, p1, p2) => {
          return `: "${p1} ${p2}"`;
        });
        
        fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1');
        
        fixedContent = fixedContent.replace(/}(\s*){/g, '},\n{');
        fixedContent = fixedContent.replace(/}(\s*)\[/g, '},\n[');
        fixedContent = fixedContent.replace(/](\s*){/g, '],\n{');
        
        fixedContent = fixedContent.replace(/'/g, '"');
        
        fixedContent = fixedContent.replace(/\/\/.*$/gm, '');
        fixedContent = fixedContent.replace(/\/\*[\s\S]*?\*\//g, '');
        
        fixedContent = fixedContent.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
        
        fixedContent = fixedContent.replace(/}(\s*)"[a-zA-Z]/g, '},$1"');
        
        fixedContent = fixedContent.replace(/,,+/g, ',');
        
        const openBraces = (fixedContent.match(/{/g) || []).length;
        const closeBraces = (fixedContent.match(/}/g) || []).length;
        const openBrackets = (fixedContent.match(/\[/g) || []).length;
        const closeBrackets = (fixedContent.match(/]/g) || []).length;
        
        if (openBrackets > closeBrackets) {
          fixedContent += ']'.repeat(openBrackets - closeBrackets);
        }
        if (openBraces > closeBraces) {
          fixedContent += '}'.repeat(openBraces - closeBraces);
        }
        
        console.log('[Ollama] Applied', [
          'control chars removal',
          'newline in strings fix',
          'trailing commas removal',
          'missing commas addition',
          'quotes normalization',
          'comments removal',
          'unquoted keys fix',
          'array comma fix',
          'double commas removal',
          `bracket closure (added ${openBrackets - closeBrackets} ], ${openBraces - closeBraces} })`
        ].join(', '));
        
        const debugPath = '/tmp/ollama_invalid_json.txt';
        try {
          fs.writeFileSync(debugPath, `ORIGINAL:\n${content}\n\n\nFIXED:\n${fixedContent}`);
          console.log(`[Ollama] Saved invalid JSON to ${debugPath} for debugging`);
        } catch (e) {
        }
        
        try {
          planData = JSON.parse(fixedContent);
          console.log('[Ollama] Successfully parsed after fixing!');
        } catch (retryError) {
          console.error('[Ollama] Still failed after attempted fix');
          console.error('[Ollama] Retry error:', retryError.message);
          
          if (retryError.message.includes('position')) {
            const match = retryError.message.match(/position (\d+)/);
            if (match) {
              const pos = parseInt(match[1]);
              const start = Math.max(0, pos - 100);
              const end = Math.min(fixedContent.length, pos + 100);
              console.error('---FIXED CONTEXT START---');
              console.error(fixedContent.substring(start, end));
              console.error(' '.repeat(Math.min(100, pos - start)) + '^');
              console.error('---FIXED CONTEXT END---');
            }
          }
          
          if (partialData && partialData.weeks && partialData.weeks.length > 0) {
            console.log('[Ollama] Using partial data with', partialData.weeks.length, 'weeks');
            planData = partialData;
          } else {
            throw new Error('Failed to parse JSON from Ollama response: ' + parseError.message);
          }
        }
      }
      
      console.log('[Ollama] Training plan generated successfully');
      console.log('[Ollama] Plan name:', planData.planName);
      console.log('[Ollama] Weeks count:', planData.weeks?.length);
      
      if (planData.weeks && planData.weeks[0] && planData.weeks[0].workouts && planData.weeks[0].workouts[0]) {
        console.log('[Ollama] Sample workout data:', JSON.stringify(planData.weeks[0].workouts[0], null, 2));
      }
      
      return planData;
    } catch (error) {
      console.error("Ollama API error:", error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Ollama is not running. Please start Ollama with: ollama serve\n' +
          'Then make sure you have the model installed: ollama pull qwen2.5'
        );
      }
      
      throw new Error("Failed to generate training plan: " + error.message);
    }
  }

  buildPrompt(userAnalysis, preferences) {
    const {
      avgWeeklyDistance,
      best5kTime,
      best10kTime,
      bestHalfMarathonTime,
      recentWeeksCount,
      avgPace,
      totalActivities,
    } = userAnalysis;

    const {
      goal,
      targetRaceDate,
      weeksCount,
      sessionsPerWeek,
      trainingDays,
      currentFitnessLevel,
      targetRaceDistance,
      targetRaceTime,
      startWeekNumber = 1,
      totalWeeksCount = weeksCount,
    } = preferences;

    const trainingDaysStr = trainingDays
      .map((day) => {
        const days = [
          "Poniedziałek",
          "Wtorek",
          "Środa",
          "Czwartek",
          "Piątek",
          "Sobota",
          "Niedziela",
        ];
        return days[day - 1];
      })
      .join(", ");

    const progressionGuidance = this.getProgressionGuidance(totalWeeksCount, startWeekNumber, weeksCount);

    const paceGuidance = this.calculateTrainingPaces(avgPace, best5kTime, best10kTime, bestHalfMarathonTime);

    return `
Generate ${weeksCount} weeks (weeks ${startWeekNumber}-${startWeekNumber + weeksCount - 1} of ${totalWeeksCount} total)
Target: ${targetRaceDistance}, Level: ${currentFitnessLevel}
Sessions: ${sessionsPerWeek}/week, Current form: ${avgWeeklyDistance.toFixed(1)}km/week

USER'S CURRENT PERFORMANCE DATA:
${paceGuidance}

${progressionGuidance}

REQUIRED JSON FORMAT:
{
  "planName": "${targetRaceDistance} Training Plan",
  "planDescription": "Max 60 characters",
  "weeks": [{
    "weekNumber": ${startWeekNumber},
    "weekGoal": "Max 40 characters",
    "totalDistance": 35,
    "totalDuration": 210,
    "workouts": [{
      "dayOfWeek": 1,
      "workoutType": "EASY_RUN",
      "name": "Easy 8km",
      "description": "Easy recovery run",
      "targetDistance": 8,
      "targetDuration": 48,
      "targetPace": "6:00/km",
      "intensity": "EASY",
      "intervals": {
        "blocks": [
          {"type":"warmup","duration":10,"pace":"6:15","distance":1.6},
          {"type":"main","duration":30,"pace":"6:00","distance":5.0},
          {"type":"cooldown","duration":8,"pace":"6:15","distance":1.3}
        ]
      }
    },{
      "dayOfWeek": 3,
      "workoutType": "INTERVALS",
      "name": "8x400m",
      "description": "Fast 400m intervals",
      "targetDistance": 9,
      "targetDuration": 50,
      "targetPace": "4:30/km",
      "intensity": "HARD",
      "intervals": {
        "blocks": [
          {"type":"warmup","duration":12,"pace":"6:00","distance":2.0},
          {"type":"intervals","duration":3,"pace":"4:20","distance":0.7},
          {"type":"recovery","duration":1,"pace":"6:30","distance":0.15},
          {"type":"intervals","duration":3,"pace":"4:20","distance":0.7},
          {"type":"recovery","duration":1,"pace":"6:30","distance":0.15},
          {"type":"cooldown","duration":9,"pace":"6:00","distance":1.5}
        ]
      }
    }]
  }]
}

WORKOUT TYPES: EASY_RUN, LONG_RUN, TEMPO_RUN, INTERVALS, REST
INTENSITY LEVELS: EASY, MODERATE, HARD, VERY_HARD
BLOCK TYPES: warmup, intervals, tempo, main, recovery, cooldown

CRITICAL RULES:
- Week numbers: ${startWeekNumber} to ${startWeekNumber + weeksCount - 1}
- Each week must have DIFFERENT distance and intensity
- All descriptions max 40 characters
- EVERY workout MUST have intervals.blocks structure (array of block objects)
- Each block MUST have: type, duration (minutes), pace (format "X:XX"), distance (km)
- Block types: warmup, main, cooldown for easy runs; warmup, intervals, recovery, cooldown for interval training
- For interval workouts: alternate intervals and recovery blocks (e.g., interval → recovery → interval → recovery)
- Duration is in MINUTES (not seconds!)
- Pace format: "4:30" or "6:00" (NOT "4:30/km")
- Distance must match: distance = duration / paceInMinutes (e.g., 10min @ 5:00 pace = 2.0km)
- REST workouts: distance=0, duration=0, pace=null, intervals=null (no blocks)
- Generate ${sessionsPerWeek} workouts per week
- Use training days: ${trainingDaysStr}
- Use ONLY the paces from USER'S CURRENT PERFORMANCE DATA above
- Calculate targetDuration as sum of all block durations
- Calculate targetDistance as sum of all block distances

EXAMPLE BLOCK STRUCTURES:
Easy run: [warmup 10min, main 30min, cooldown 5min]
Intervals: [warmup 15min, intervals 4min, recovery 2min, intervals 4min, recovery 2min, intervals 4min, cooldown 10min]
Tempo: [warmup 15min, tempo 20min, cooldown 10min]

OUTPUT ONLY VALID JSON!
`;
  }

  calculateTrainingPaces(avgPace, best5kTime, best10kTime, bestHalfMarathonTime) {
    const secondsToPace = (totalSeconds, distance) => {
      if (!totalSeconds || !distance) return null;
      const paceSeconds = totalSeconds / distance;
      const minutes = Math.floor(paceSeconds / 60);
      const seconds = Math.round(paceSeconds % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
    };

    const paceToSeconds = (paceStr) => {
      if (!paceStr) return null;
      const match = paceStr.match(/(\d+):(\d+)/);
      if (!match) return null;
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    };

    let guidance = '';
    
    const easyPaceSeconds = avgPace ? paceToSeconds(avgPace) : null;
    const easyPace = avgPace || '6:00/km';
    guidance += `Easy/Recovery pace: ${easyPace} (current average pace)\n`;

    if (best5kTime) {
      const pace5k = secondsToPace(best5kTime, 5);
      guidance += `5K race pace: ${pace5k} (from best 5K: ${this.formatTime(best5kTime)})\n`;
      
      const intervalPaceSeconds = (best5kTime / 5) - 5; 
      const intervalMin = Math.floor(intervalPaceSeconds / 60);
      const intervalSec = Math.round(intervalPaceSeconds % 60);
      guidance += `Interval pace (400m-800m): ${intervalMin}:${intervalSec.toString().padStart(2, '0')}/km (5K pace - 5sec)\n`;
    }

    if (best10kTime) {
      const pace10k = secondsToPace(best10kTime, 10);
      guidance += `10K race pace: ${pace10k} (from best 10K: ${this.formatTime(best10kTime)})\n`;
      guidance += `Tempo/Threshold pace: ${pace10k} (use for 1000m-2000m intervals)\n`;
    }

    if (bestHalfMarathonTime) {
      const paceHM = secondsToPace(bestHalfMarathonTime, 21.0975);
      guidance += `Half-Marathon pace: ${paceHM} (from best HM: ${this.formatTime(bestHalfMarathonTime)})\n`;
      guidance += `Tempo run pace: ${paceHM} (use for tempo runs 8-15km)\n`;
    }

    if (bestHalfMarathonTime) {
      const marathonPaceSeconds = (bestHalfMarathonTime / 21.0975) + 20; 
      const marathonMin = Math.floor(marathonPaceSeconds / 60);
      const marathonSec = Math.round(marathonPaceSeconds % 60);
      guidance += `Marathon pace (estimated): ${marathonMin}:${marathonSec.toString().padStart(2, '0')}/km (HM pace + 20sec)\n`;
    } else if (best10kTime) {
      const marathonPaceSeconds = (best10kTime / 10) + 30; 
      const marathonMin = Math.floor(marathonPaceSeconds / 60);
      const marathonSec = Math.round(marathonPaceSeconds % 60);
      guidance += `Marathon pace (estimated): ${marathonMin}:${marathonSec.toString().padStart(2, '0')}/km (10K pace + 30sec)\n`;
    }

    if (easyPaceSeconds) {
      const easyPlusSeconds = easyPaceSeconds + 10; 
      const easyPlusMin = Math.floor(easyPlusSeconds / 60);
      const easyPlusSec = Math.round(easyPlusSeconds % 60);
      guidance += `Long run pace: ${easyPlusMin}:${easyPlusSec.toString().padStart(2, '0')}/km (easy pace + 10-15sec)\n`;
    }

    guidance += '\nIMPORTANT: Use THESE EXACT PACES in your workouts. Do NOT make up different paces.\n';
    
    return guidance;
  }

  getProgressionGuidance(totalWeeks, startWeek, batchSize) {
    const endWeek = Math.min(startWeek + batchSize - 1, totalWeeks);
    
    let guidance = 'PROGRESSION PLAN (CHALLENGING WORKOUTS):\n';
    
    for (let week = startWeek; week <= endWeek; week++) {
      if (week <= 3) {
        const weeklyKm = 45 + week * 3;
        guidance += `Week ${week}: BASE BUILDING ${weeklyKm}-${weeklyKm + 5}km (65% Easy, 10% Moderate)\n`;
        guidance += `  Intervals: ${week === 1 ? '10x400m @ 5K pace' : week === 2 ? '8x600m @ 5K pace' : '6x800m @ 5K pace'}\n`;
        guidance += `  Tempo run: ${6 + week}km @ half-marathon pace\n`;
        guidance += `  Long run: ${16 + week * 2}km @ easy+10-15sec\n`;
      } else if (week === 4) {
        guidance += `Week ${week}: RECOVERY 35-38km (-20% volume)\n`;
        guidance += `  Intervals: 8x400m @ 5K pace (reduced reps)\n`;
        guidance += `  Tempo: 6km @ half-marathon pace\n`;
        guidance += `  Long run: 14km easy\n`;
      } else if (week <= 8) {
        const weeklyKm = 50 + (week - 4) * 4;
        guidance += `Week ${week}: BUILD PHASE ${weeklyKm}-${weeklyKm + 6}km (55% Easy, 25% Moderate, 20% Hard)\n`;
        if (week === 5) guidance += `  Intervals: 6x1000m @ 10K pace, Tempo: 10km @ half-marathon pace\n`;
        else if (week === 6) guidance += `  Intervals: 5x1200m @ 10K pace, Tempo: 12km @ half-marathon pace\n`;
        else if (week === 7) guidance += `  Intervals: 4x1600m @ 10K pace, Tempo: 13km @ marathon pace\n`;
        else guidance += `  Intervals: 3x2000m @ 10K pace, Tempo: 14km @ marathon pace\n`;
        guidance += `  Long run: ${18 + (week - 4) * 2}km with last 5km @ marathon pace\n`;
      } else if (week === 9) {
        guidance += `Week ${week}: RECOVERY 40-43km (-20% volume)\n`;
        guidance += `  Intervals: 8x600m @ 5K pace (sharp but short)\n`;
        guidance += `  Tempo: 8km @ half-marathon pace\n`;
        guidance += `  Long run: 16km easy\n`;
      } else if (week <= 11) {
        const weeklyKm = 65 + (week - 9) * 5;
        guidance += `Week ${week}: PEAK PHASE ${weeklyKm}-${weeklyKm + 5}km (50% Easy, 30% Hard, 20% Moderate)\n`;
        if (week === 10) guidance += `  Intervals: 4x2000m @ 10K pace, Tempo: 15km @ half-marathon pace\n`;
        else guidance += `  Intervals: 3x3000m @ 10K-15K pace, Tempo: 16km @ marathon pace\n`;
        guidance += `  Long run: ${22 + (week - 10) * 3}km with progressive pace (last 8km @ marathon pace)\n`;
      } else {
        guidance += `Week ${week}: TAPER 35-40km (-45% volume, maintain intensity)\n`;
        guidance += `  Intervals: 8x400m @ 5K pace (sharp, short)\n`;
        guidance += `  Tempo: 6km @ half-marathon pace\n`;
        guidance += `  Long run: 12km easy (fresh legs for race)\n`;
      }
    }
    
    return guidance.trim();
  }

  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  async generateActivityComparisonSummary(firstActivity, secondActivity) {
    try {
      console.log('[Ollama] Generating activity comparison summary...');

      const prompt = `
Jesteś ekspertem sportowym. Przeanalizuj dwie aktywności i podaj ZWIĘZŁE podsumowanie porównawcze.

AKTYWNOŚĆ 1: ${firstActivity.type} - ${(firstActivity.distance / 1000).toFixed(1)}km, ${this.formatTime(firstActivity.duration)}, tempo: ${firstActivity.avgPaceMinPerKm? firstActivity.avgPaceMinPerKm.toFixed(2) + ' min/km': 'brak'}
AKTYWNOŚĆ 2: ${secondActivity.type} - ${(secondActivity.distance / 1000).toFixed(1)}km, ${this.formatTime(secondActivity.duration)}, tempo: ${secondActivity.avgPaceMinPerKm? secondActivity.avgPaceMinPerKm.toFixed(2) + ' min/km': 'brak'}

Dane tempa Aktywność 1: ${firstActivity.pacePerKm && firstActivity.pacePerKm.length > 0 ? firstActivity.pacePerKm.map((p, i) => `${i + 1}km: ${p.toFixed(2)}`).join(', '): 'brak danych per kilometr'}
Dane tempa Aktywność 2: ${secondActivity.pacePerKm && secondActivity.pacePerKm.length > 0 ? secondActivity.pacePerKm.map((p, i) => `${i + 1}km: ${p.toFixed(2)}`).join(', '): 'brak danych per kilometr'}

Pamiętaj, że to co ci podałem to jest tempo na każdy kilometr, nie średnie tempo z całej aktywności.

Strefy tempa A1: ${firstActivity.paceZones ? Object.entries(firstActivity.paceZones.zones).map(([z, d]) => `${z}:${d.percent.toFixed(0)}%`).join(', ') : 'brak'}
Strefy tempa A2: ${secondActivity.paceZones ? Object.entries(secondActivity.paceZones.zones).map(([z, d]) => `${z}:${d.percent.toFixed(0)}%`).join(', ') : 'brak'}

NAPISZ ZWIĘZŁE PODSUMOWANIE (max 400 słów) zawierające:
• Która aktywność była "lepsza" i dlaczego
• Kluczowe różnice w tempie i wysiłku
• Mocne i słabe strony każdej aktywności
• 2-3 konkretne rady na przyszłość, najlepiej nieoczywiste.

Jeśli chcesz zawrzeć informację o tempach to podawaj ją w formacie "X:XX min/km".
NIE POWTARZAJ danych liczbowych już widocznych w interfejsie. Skup się na analizie i wnioskach. Bazuj tylko na prawdziwych dostarczonych danych.
Nie zgaduj i nie dodawaj informacji, których nie ma w danych na przykład o warunkach pogodowych czy trasie. Natomiast możesz nadmienić, że dany wynik mógł być spowodowany pogoda czy temperaturą.
Weź pod uwagę, że aktywności mogą mieć różne dystanse i czasy trwania. Spróbuj je ujednolicić w analizie.
Odpowiedź po polsku, profesjonalna ale przystępna.
`;

      const response = await ollamaClient.chat.completions.create({
        model: MODEL_NAME,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 800,
      });

      const summary = response.choices[0]?.message?.content || "Nie udało się wygenerować podsumowania.";

      console.log('[Ollama] Activity comparison summary generated successfully');
      return summary;

    } catch (error) {
      console.error("Ollama API error for activity comparison:", error);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'Ollama is not running. Please start Ollama with: ollama serve\n' +
          'Then make sure you have the model installed: ollama pull qwen2.5'
        );
      }
      
      throw new Error("Failed to generate activity comparison summary: " + error.message);
    }
  }
}

export const openaiService = new OpenAIService();
