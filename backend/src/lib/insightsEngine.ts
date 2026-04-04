// ─────────────────────────────────────────────────────
// backend/src/lib/insightsEngine.ts
// Wellness Insights Engine — Correlations & Patterns
//
// Analyzes 14+ days of wellness data to generate
// personalized, actionable insight cards.
// ─────────────────────────────────────────────────────

export type InsightCategory =
  | "SLEEP_PERFORMANCE"
  | "MOOD_TREND"
  | "RECOVERY"
  | "BREATHING"
  | "CONSISTENCY"
  | "TRAINING_LOAD"

export type InsightPriority = "HIGH" | "MEDIUM" | "LOW"

export interface Insight {
  id: string
  category: InsightCategory
  priority: InsightPriority
  title: string
  body: string
  emoji: string
  color: string
  actionLabel?: string
  actionRoute?: string
}

// ─── Raw data types passed from the API layer ────────
export interface InsightData {
  sleepLogs: { date: Date; durationMinutes: number; sleepScore: number | null; quality: number }[]
  moodLogs: { loggedAt: Date; mood: number; energy: number; stress: number }[]
  workouts: { startTime: Date; totalVolume: number; duration: number | null; name: string }[]
  sorenessLogs: { date: Date; overallSoreness: number }[]
  breathingSessions: { createdAt: Date; durationSec: number; moodBefore: number | null; moodAfter: number | null }[]
  journalEntries: { createdAt: Date }[]
  readinessScores: { date: Date; score: number; zone: string }[]
}

// ─── MAIN: generate insights from raw data ───────────
export function generateInsights(data: InsightData): Insight[] {
  const insights: Insight[] = []

  sleepDurationInsight(data, insights)
  sleepConsistencyInsight(data, insights)
  sleepPerformanceCorrelation(data, insights)
  moodTrendInsight(data, insights)
  stressTrendInsight(data, insights)
  breathingMoodInsight(data, insights)
  sorenessPatternInsight(data, insights)
  trainingLoadInsight(data, insights)
  consistencyInsight(data, insights)
  journalStreakInsight(data, insights)

  // Sort: HIGH first, then MEDIUM, then LOW
  const priorityOrder: Record<InsightPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  return insights.slice(0, 8) // max 8 insights
}

// ─── WEEKLY REPORT ───────────────────────────────────
export interface WeeklyReport {
  period: { start: string; end: string }
  summary: {
    avgReadiness: number
    avgSleep: number      // minutos
    avgMood: number
    avgEnergy: number
    avgStress: number
    totalWorkouts: number
    totalVolume: number
    totalBreathingMin: number
    journalEntries: number
  }
  trends: {
    readiness: "UP" | "DOWN" | "STABLE"
    sleep: "UP" | "DOWN" | "STABLE"
    mood: "UP" | "DOWN" | "STABLE"
    volume: "UP" | "DOWN" | "STABLE"
  }
  topInsight: string
  highlights: string[]
}

export function generateWeeklyReport(
  thisWeek: InsightData,
  prevWeek: InsightData
): WeeklyReport {
  const now = new Date()
  const weekAgo = new Date(now)
  weekAgo.setDate(weekAgo.getDate() - 7)

  // ─── This week averages ────────────────────────────
  const avgReadiness = avg(thisWeek.readinessScores.map((r) => r.score))
  const avgSleep = avg(thisWeek.sleepLogs.map((s) => s.durationMinutes))
  const avgMood = avg(thisWeek.moodLogs.map((m) => m.mood))
  const avgEnergy = avg(thisWeek.moodLogs.map((m) => m.energy))
  const avgStress = avg(thisWeek.moodLogs.map((m) => m.stress))
  const totalWorkouts = thisWeek.workouts.length
  const totalVolume = thisWeek.workouts.reduce((s, w) => s + w.totalVolume, 0)
  const totalBreathingMin = Math.round(
    thisWeek.breathingSessions.reduce((s, b) => s + b.durationSec, 0) / 60
  )
  const journalEntries = thisWeek.journalEntries.length

  // ─── Previous week averages (for trends) ───────────
  const prevAvgReadiness = avg(prevWeek.readinessScores.map((r) => r.score))
  const prevAvgSleep = avg(prevWeek.sleepLogs.map((s) => s.durationMinutes))
  const prevAvgMood = avg(prevWeek.moodLogs.map((m) => m.mood))
  const prevTotalVolume = prevWeek.workouts.reduce((s, w) => s + w.totalVolume, 0)

  // ─── Compute trends ────────────────────────────────
  const trend = (curr: number, prev: number, threshold = 0.05): "UP" | "DOWN" | "STABLE" => {
    if (prev === 0 && curr === 0) return "STABLE"
    if (prev === 0) return "UP"
    const pct = (curr - prev) / prev
    if (pct > threshold) return "UP"
    if (pct < -threshold) return "DOWN"
    return "STABLE"
  }

  const trends = {
    readiness: trend(avgReadiness, prevAvgReadiness),
    sleep: trend(avgSleep, prevAvgSleep),
    mood: trend(avgMood, prevAvgMood, 0.1),
    volume: trend(totalVolume, prevTotalVolume),
  }

  // ─── Top insight ───────────────────────────────────
  let topInsight = "Sigue registrando datos para mejores insights."
  if (avgReadiness >= 70 && trends.readiness !== "DOWN") {
    topInsight = "Semana excelente — tu readiness se mantuvo en zona verde. Sigue así."
  } else if (avgReadiness < 40) {
    topInsight = "Semana dura. Prioriza descanso y sueño esta semana."
  } else if (trends.sleep === "DOWN" && avgSleep < 420) {
    topInsight = "Tu sueño bajó esta semana. Intenta acostarte 30 min antes."
  } else if (trends.mood === "DOWN") {
    topInsight = "Tu ánimo bajó esta semana. Considera journaling o respiración para reset."
  } else if (trends.volume === "UP" && totalVolume > prevTotalVolume * 1.3) {
    topInsight = "Subiste mucho el volumen esta semana (+30%). Vigila la recuperación."
  }

  // ─── Highlights ────────────────────────────────────
  const highlights: string[] = []
  if (totalWorkouts > 0) highlights.push(`${totalWorkouts} entreno${totalWorkouts > 1 ? "s" : ""} completado${totalWorkouts > 1 ? "s" : ""}`)
  if (totalBreathingMin > 0) highlights.push(`${totalBreathingMin} min de respiración`)
  if (journalEntries > 0) highlights.push(`${journalEntries} entrada${journalEntries > 1 ? "s" : ""} de diario`)
  if (avgSleep > 0) {
    const totalMinutes = Math.round(avgSleep)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    highlights.push(`Promedio ${hours}h${String(minutes).padStart(2, "0")} de sueño`)
  }

  return {
    period: {
      start: weekAgo.toISOString().split("T")[0],
      end: now.toISOString().split("T")[0],
    },
    summary: {
      avgReadiness: Math.round(avgReadiness),
      avgSleep: Math.round(avgSleep),
      avgMood: round1(avgMood),
      avgEnergy: round1(avgEnergy),
      avgStress: round1(avgStress),
      totalWorkouts,
      totalVolume: Math.round(totalVolume),
      totalBreathingMin,
      journalEntries,
    },
    trends,
    topInsight,
    highlights,
  }
}

// ═══════════════════════════════════════════════════════
// Individual insight generators
// ═══════════════════════════════════════════════════════

function sleepDurationInsight(data: InsightData, out: Insight[]) {
  if (data.sleepLogs.length < 3) return
  const avgMin = avg(data.sleepLogs.map((s) => s.durationMinutes))
  if (avgMin < 360) {
    out.push({
      id: "sleep_low",
      category: "SLEEP_PERFORMANCE",
      priority: "HIGH",
      title: "Sueño insuficiente",
      body: `Tu promedio es ${fmtHM(avgMin)}. Menos de 6h afecta la recuperación y rendimiento. Intenta acostarte 30 min antes.`,
      emoji: "😴",
      color: "#FF6B6B",
      actionLabel: "Registrar sueño",
      actionRoute: "/wellness/sleep-log",
    })
  } else if (avgMin >= 420 && avgMin <= 540) {
    out.push({
      id: "sleep_good",
      category: "SLEEP_PERFORMANCE",
      priority: "LOW",
      title: "Buen sueño",
      body: `Tu promedio es ${fmtHM(avgMin)}. Estás en el rango óptimo de 7-9h. ¡Sigue así!`,
      emoji: "🌙",
      color: "#00D48A",
    })
  }
}

function sleepConsistencyInsight(data: InsightData, out: Insight[]) {
  if (data.sleepLogs.length < 5) return
  const durations = data.sleepLogs.map((s) => s.durationMinutes)
  const stdDev = standardDeviation(durations)
  if (stdDev > 60) {
    out.push({
      id: "sleep_inconsistent",
      category: "SLEEP_PERFORMANCE",
      priority: "MEDIUM",
      title: "Sueño irregular",
      body: "Tu duración de sueño varía mucho día a día. La consistencia es clave para la calidad. Intenta un horario fijo.",
      emoji: "📊",
      color: "#FFB347",
      actionLabel: "Ver protocolo de sueño",
      actionRoute: "/wellness/recovery",
    })
  }
}

function sleepPerformanceCorrelation(data: InsightData, out: Insight[]) {
  if (data.sleepLogs.length < 5 || data.workouts.length < 3) return

  // For each workout, find the sleep from the night before
  const pairs: { sleepMin: number; volume: number }[] = []
  for (const w of data.workouts) {
    const wDate = w.startTime.toISOString().split("T")[0]
    const prevDay = new Date(w.startTime)
    prevDay.setDate(prevDay.getDate() - 1)
    const prevStr = prevDay.toISOString().split("T")[0]

    const sleep = data.sleepLogs.find(
      (s) => s.date.toISOString().split("T")[0] === wDate || s.date.toISOString().split("T")[0] === prevStr
    )
    if (sleep) pairs.push({ sleepMin: sleep.durationMinutes, volume: w.totalVolume })
  }

  if (pairs.length < 3) return
  const corr = pearsonCorrelation(
    pairs.map((p) => p.sleepMin),
    pairs.map((p) => p.volume)
  )

  if (corr > 0.4) {
    out.push({
      id: "sleep_perf_positive",
      category: "SLEEP_PERFORMANCE",
      priority: "MEDIUM",
      title: "Sueño impulsa tu rendimiento",
      body: "Tus entrenamientos son significativamente mejores después de noches con más sueño. Priorízalo antes de días de entreno intenso.",
      emoji: "💪",
      color: "#7B68EE",
    })
  }
}

function moodTrendInsight(data: InsightData, out: Insight[]) {
  if (data.moodLogs.length < 5) return
  const sorted = [...data.moodLogs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())
  const recent = sorted.slice(-5)
  const earlier = sorted.slice(0, Math.min(5, sorted.length - 5))
  if (earlier.length < 2) return

  const recentAvg = avg(recent.map((m) => m.mood))
  const earlierAvg = avg(earlier.map((m) => m.mood))

  if (recentAvg < earlierAvg - 0.5) {
    out.push({
      id: "mood_declining",
      category: "MOOD_TREND",
      priority: "HIGH",
      title: "Ánimo en descenso",
      body: "Tu estado de ánimo ha bajado últimamente. Considera un día de descanso, journaling o hablar con alguien.",
      emoji: "💭",
      color: "#FFB347",
      actionLabel: "Escribir diario",
      actionRoute: "/wellness/journal",
    })
  } else if (recentAvg > earlierAvg + 0.5) {
    out.push({
      id: "mood_improving",
      category: "MOOD_TREND",
      priority: "LOW",
      title: "Ánimo mejorando",
      body: "Tu estado de ánimo ha mejorado notablemente. ¡Lo que estás haciendo funciona!",
      emoji: "🌟",
      color: "#00D48A",
    })
  }
}

function stressTrendInsight(data: InsightData, out: Insight[]) {
  if (data.moodLogs.length < 5) return
  // Sort by timestamp ascending to get most recent last
  const sorted = [...data.moodLogs].sort((a, b) => a.loggedAt.getTime() - b.loggedAt.getTime())
  const recentStress = avg(sorted.slice(-5).map((m) => m.stress))
  if (recentStress >= 4) {
    out.push({
      id: "stress_high",
      category: "MOOD_TREND",
      priority: "HIGH",
      title: "Estrés elevado",
      body: "Tu estrés reciente está alto. Intenta una sesión de respiración o reducir la intensidad del entreno.",
      emoji: "🧘",
      color: "#FF6B6B",
      actionLabel: "Respirar",
      actionRoute: "/wellness/breathing",
    })
  }
}

function breathingMoodInsight(data: InsightData, out: Insight[]) {
  const sessionsWithMood = data.breathingSessions.filter(
    (b) => b.moodBefore != null && b.moodAfter != null
  )
  if (sessionsWithMood.length < 3) return

  const improvements = sessionsWithMood.filter((b) => b.moodAfter! > b.moodBefore!)
  const pct = improvements.length / sessionsWithMood.length

  if (pct >= 0.6) {
    out.push({
      id: "breathing_helps",
      category: "BREATHING",
      priority: "LOW",
      title: "La respiración te funciona",
      body: `En ${Math.round(pct * 100)}% de tus sesiones tu ánimo mejoró después de respirar. Es una herramienta que te beneficia.`,
      emoji: "🫁",
      color: "#00D48A",
    })
  }
}

function sorenessPatternInsight(data: InsightData, out: Insight[]) {
  if (data.sorenessLogs.length < 3) return
  const recentAvg = avg(data.sorenessLogs.slice(-3).map((s) => s.overallSoreness))

  if (recentAvg >= 3.5) {
    out.push({
      id: "soreness_high",
      category: "RECOVERY",
      priority: "HIGH",
      title: "Soreness persistente",
      body: "Tu dolor muscular ha sido alto últimamente. Incluye foam rolling, estiramientos o un día extra de descanso.",
      emoji: "🔥",
      color: "#FF6B6B",
      actionLabel: "Protocolos de recovery",
      actionRoute: "/wellness/recovery",
    })
  }
}

function trainingLoadInsight(data: InsightData, out: Insight[]) {
  if (data.workouts.length < 2) return
  const now = Date.now()
  const weekMs = 7 * 24 * 60 * 60 * 1000
  const thisWeekVol = data.workouts
    .filter((w) => now - w.startTime.getTime() < weekMs)
    .reduce((s, w) => s + w.totalVolume, 0)
  const prevWeekVol = data.workouts
    .filter((w) => {
      const diff = now - w.startTime.getTime()
      return diff >= weekMs && diff < weekMs * 2
    })
    .reduce((s, w) => s + w.totalVolume, 0)

  if (prevWeekVol > 0) {
    const ratio = thisWeekVol / prevWeekVol
    if (ratio > 1.5) {
      out.push({
        id: "load_spike",
        category: "TRAINING_LOAD",
        priority: "HIGH",
        title: "Spike de volumen",
        body: `Tu volumen esta semana subió ${Math.round((ratio - 1) * 100)}% vs la anterior. Subidas >50% aumentan riesgo de lesión. Considera moderar.`,
        emoji: "⚠️",
        color: "#FF6B6B",
      })
    } else if (ratio < 0.5 && thisWeekVol > 0) {
      out.push({
        id: "load_drop",
        category: "TRAINING_LOAD",
        priority: "MEDIUM",
        title: "Volumen bajo",
        body: "Tu volumen bajó significativamente esta semana. Si es un deload planificado, perfecto. Si no, intenta mantener consistencia.",
        emoji: "📉",
        color: "#FFB347",
      })
    }
  }
}

function consistencyInsight(data: InsightData, out: Insight[]) {
  // Check how many days in the last 14 had any wellness activity
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 13) // 14-day inclusive range (today - 13 days)
  const cutoffTime = cutoff.getTime()

  const days14 = new Set<string>()
  for (const s of data.sleepLogs) {
    if (new Date(s.date).getTime() >= cutoffTime) {
      days14.add(s.date.toISOString().split("T")[0])
    }
  }
  for (const m of data.moodLogs) {
    if (m.loggedAt.getTime() >= cutoffTime) {
      days14.add(m.loggedAt.toISOString().split("T")[0])
    }
  }
  for (const j of data.journalEntries) {
    if (j.createdAt.getTime() >= cutoffTime) {
      days14.add(j.createdAt.toISOString().split("T")[0])
    }
  }
  for (const b of data.breathingSessions) {
    if (b.createdAt.getTime() >= cutoffTime) {
      days14.add(b.createdAt.toISOString().split("T")[0])
    }
  }

  const activeDays = days14.size

  if (activeDays >= 12) {
    out.push({
      id: "consistency_great",
      category: "CONSISTENCY",
      priority: "LOW",
      title: "Consistencia excelente",
      body: `Registraste bienestar ${activeDays} de los últimos 14 días. La consistencia es lo que desbloquea insights más precisos.`,
      emoji: "🔥",
      color: "#00D48A",
    })
  } else if (activeDays <= 3 && activeDays > 0) {
    out.push({
      id: "consistency_low",
      category: "CONSISTENCY",
      priority: "MEDIUM",
      title: "Más datos = mejores insights",
      body: "Solo tienes registros de pocos días. Intenta loggear sueño y ánimo diario para desbloquear correlaciones.",
      emoji: "📊",
      color: "#FFB347",
    })
  }
}

function journalStreakInsight(data: InsightData, out: Insight[]) {
  if (data.journalEntries.length === 0) return
  
  // Filter to the recent date range (last 14 days) for consistency
  const now = new Date()
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - 13) // 14-day inclusive range
  const cutoffTime = cutoff.getTime()
  
  const recentEntries = data.journalEntries.filter((j) => j.createdAt.getTime() >= cutoffTime)
  const days = new Set(recentEntries.map((j) => j.createdAt.toISOString().split("T")[0]))
  
  if (days.size >= 7) {
    out.push({
      id: "journal_consistent",
      category: "CONSISTENCY",
      priority: "LOW",
      title: "Journaling consistente",
      body: "Escribir regularmente mejora la autoconciencia y reduce estrés. Sigue así.",
      emoji: "📓",
      color: "#7B68EE",
    })
  }
}

// ═══════════════════════════════════════════════════════
// Math helpers
// ═══════════════════════════════════════════════════════

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function standardDeviation(nums: number[]): number {
  if (nums.length < 2) return 0
  const mean = avg(nums)
  const squaredDiffs = nums.map((n) => (n - mean) ** 2)
  return Math.sqrt(avg(squaredDiffs))
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0

  const xSlice = x.slice(0, n)
  const ySlice = y.slice(0, n)
  const xMean = avg(xSlice)
  const yMean = avg(ySlice)

  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - xMean
    const dy = ySlice[i] - yMean
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }

  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : num / den
}

function fmtHM(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}h${String(m).padStart(2, "0")}`
}
