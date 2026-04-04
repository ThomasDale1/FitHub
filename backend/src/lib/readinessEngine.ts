// ─── READINESS SCORE ENGINE ───────────────────────────
//
// Score 0-100, componentes:
//   - Sleep      (0-35)  35%
//   - Mood       (0-20)  20%
//   - Stress     (0-15)  15%
//   - Load       (0-20)  20%
//   - Soreness   (0-10)  10%
//
// Zonas:
//   RED    0-39   → descansar
//   YELLOW 40-69  → ligero
//   GREEN  70-100 → intenso OK
//

import type { ReadinessZone } from "../generated/prisma/client.js"

export interface ReadinessInput {
  // Sleep (de SleepLog.sleepScore, o null si no hay)
  sleepScore: number | null        // 0-100

  // Mood (de MoodLog más reciente < 24h)
  mood: number | null              // 1-5
  energy: number | null            // 1-5
  stress: number | null            // 1-5

  // Training load
  weekVolume: number               // totalVolume últimos 7 días
  prevWeekVolume: number           // totalVolume 8-14 días atrás

  // Soreness
  overallSoreness: number | null   // 0-5

  // Horas desde último workout
  hoursSinceLastWorkout: number | null
}

export interface ReadinessResult {
  score: number
  sleepComponent: number       // 0-35
  moodComponent: number        // 0-20
  stressComponent: number      // 0-15
  loadComponent: number        // 0-20
  sorenessComponent: number    // 0-10
  zone: ReadinessZone
  recommendation: string
}

export function calculateReadiness(input: ReadinessInput): ReadinessResult {

  // ─── Sleep Component (0-35) ────────────────────────
  const sleepNorm = input.sleepScore != null ? input.sleepScore / 100 : 0.5
  const sleepComponent = Math.round(sleepNorm * 35)

  // ─── Mood Component (0-20) ─────────────────────────
  const moodVal = input.mood ?? 3
  const energyVal = input.energy ?? 3
  const moodNorm = (moodVal + energyVal) / 10 // 0.2 - 1.0
  const moodComponent = Math.round(moodNorm * 20)

  // ─── Stress Component (0-15) ───────────────────────
  // Invertido: menos estrés = más readiness
  const stressVal = input.stress ?? 3
  const stressNorm = (6 - stressVal) / 5  // stress 1 → 1.0, stress 5 → 0.2
  const stressComponent = Math.round(stressNorm * 15)

  // ─── Load Component (0-20) ─────────────────────────
  // Basado en Acute:Chronic Workload Ratio (ACWR)
  let loadReadiness: number
  if (input.prevWeekVolume === 0 && input.weekVolume === 0) {
    // Sin datos de entrenamiento → neutral
    loadReadiness = 0.7
  } else if (input.prevWeekVolume === 0) {
    // Primera semana → depende del volumen actual
    loadReadiness = input.weekVolume > 5000 ? 0.5 : 0.8
  } else {
    const acwr = input.weekVolume / input.prevWeekVolume
    if (acwr >= 0.8 && acwr <= 1.3) {
      loadReadiness = 1.0
    } else if (acwr < 0.8) {
      loadReadiness = 0.7  // desentrenamiento
    } else if (acwr <= 1.5) {
      loadReadiness = 0.6  // carga alta
    } else {
      loadReadiness = 0.3  // spike peligroso
    }
  }

  // Bonus si descansó > 24h desde último workout
  if (input.hoursSinceLastWorkout != null && input.hoursSinceLastWorkout > 36) {
    loadReadiness = Math.min(1.0, loadReadiness + 0.1)
  }

  const loadComponent = Math.round(loadReadiness * 20)

  // ─── Soreness Component (0-10) ─────────────────────
  const soreness = input.overallSoreness ?? 0
  const sorenessNorm = (5 - soreness) / 5  // 0 pain → 1.0, 5 pain → 0.0
  const sorenessComponent = Math.round(sorenessNorm * 10)

  // ─── Total Score ───────────────────────────────────
  const score = clamp(
    sleepComponent + moodComponent + stressComponent + loadComponent + sorenessComponent,
    0,
    100
  )

  // ─── Zone + Recommendation ─────────────────────────
  let zone: ReadinessZone
  let recommendation: string

  if (score >= 70) {
    zone = "GREEN"
    recommendation = "Buen día para entrenar intenso. Aprovecha para ir a por PRs."
  } else if (score >= 40) {
    zone = "YELLOW"
    recommendation = "Energía moderada. Entrenamiento ligero o moderado recomendado."
  } else {
    zone = "RED"
    recommendation = "Tu cuerpo necesita descanso. Considera yoga, caminata o recovery activa."
  }

  return {
    score,
    sleepComponent,
    moodComponent,
    stressComponent,
    loadComponent,
    sorenessComponent,
    zone,
    recommendation,
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}
