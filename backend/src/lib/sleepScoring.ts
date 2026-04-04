// ─── SLEEP SCORE ENGINE ───────────────────────────────
//
// Score 0-100 basado en:
//   - Duración vs meta (35pts)
//   - Calidad subjetiva (30pts)
//   - Consistencia de hora de dormir (20pts)
//   - Continuidad / despertares (15pts)
//

export interface SleepScoreInput {
  durationMinutes: number
  quality: number              // 1-5
  awakenings: number
  goalMinutes?: number         // default 480 (8h)
  // Para consistencia: últimos 7 bedTimes como offset en minutos desde medianoche
  recentBedTimes?: number[]
  currentBedTime?: number      // offset en minutos desde medianoche
}

export interface SleepScoreResult {
  score: number
  durationScore: number      // 0-35
  qualityScore: number       // 0-30
  consistencyScore: number   // 0-20
  continuityScore: number    // 0-15
}

export function calculateSleepScore(input: SleepScoreInput): SleepScoreResult {
  const goal = input.goalMinutes ?? 480

  // ─── Duration Score (0-35) ─────────────────────────
  const ratio = input.durationMinutes / goal
  let durationScore: number
  if (ratio >= 0.875 && ratio <= 1.125) {
    // Sweet spot: 7h-9h para meta de 8h
    durationScore = 35
  } else if (ratio > 1.125) {
    // Oversleep (> 9h): penalización leve
    durationScore = Math.round(Math.max(20, 35 - (ratio - 1.125) * 30))
  } else if (ratio >= 0.75) {
    // 6h-7h: escala lineal
    durationScore = Math.round(35 * (ratio / 0.875))
  } else {
    // < 6h: penalización extra
    durationScore = Math.round(35 * (ratio / 0.875) * 0.8)
  }
  durationScore = clamp(durationScore, 0, 35)

  // ─── Quality Score (0-30) ──────────────────────────
  const qualityScore = Math.round((clamp(input.quality, 1, 5) / 5) * 30)

  // ─── Consistency Score (0-20) ──────────────────────
  let consistencyScore = 15 // default si no hay datos históricos
  if (input.recentBedTimes && input.recentBedTimes.length >= 3 && input.currentBedTime != null) {
    const avg = input.recentBedTimes.reduce((a, b) => a + b, 0) / input.recentBedTimes.length
    // Handle midnight wraparound: circular minimum difference
    const raw = Math.abs(input.currentBedTime - avg)
    const deviation = Math.min(raw, 1440 - raw)
    if (deviation < 30) consistencyScore = 20
    else if (deviation < 60) consistencyScore = 15
    else if (deviation < 90) consistencyScore = 10
    else consistencyScore = 5
  }

  // ─── Continuity Score (0-15) ───────────────────────
  const awakenings = Math.max(0, input.awakenings)
  let continuityScore: number
  if (awakenings === 0) continuityScore = 15
  else if (awakenings === 1) continuityScore = 12
  else if (awakenings === 2) continuityScore = 8
  else continuityScore = Math.max(0, 15 - awakenings * 4)

  const score = clamp(durationScore + qualityScore + consistencyScore + continuityScore, 0, 100)

  return { score, durationScore, qualityScore, consistencyScore, continuityScore }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

// Convierte un DateTime a offset en minutos desde medianoche
export function toMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}
