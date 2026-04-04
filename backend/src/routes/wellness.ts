// ─────────────────────────────────────────────────────
// backend/src/routes/wellness.ts
// Wellness System — Mood, Sleep, Readiness, Journal,
// Breathing, Soreness, Dashboard
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { getUserByClerkId } from "../lib/userHelpers.js"
import { calculateSleepScore, toMinutesSinceMidnight } from "../lib/sleepScoring.js"
import { calculateReadiness } from "../lib/readinessEngine.js"
import { generateInsights, generateWeeklyReport, type InsightData } from "../lib/insightsEngine.js"
import { sendPushToUser } from "../lib/pushNotifications.js"

const router = Router()
router.use(requireAuth)

// Helper: fecha de hoy como Date (UTC midnight)
function todayDate(): Date {
  return new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")
}

// Helper: fecha N días atrás
function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z")
}

// ═══════════════════════════════════════════════════════
// ─── MOOD ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// POST /api/wellness/mood — crear mood log
router.post("/mood", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { mood, energy, stress, note, context, workoutId } = req.body

    if (!mood || !energy || !stress) {
      res.status(400).json({ error: "mood, energy y stress son requeridos (1-5)" })
      return
    }
    if (mood < 1 || mood > 5 || energy < 1 || energy > 5 || stress < 1 || stress > 5) {
      res.status(400).json({ error: "Valores deben estar entre 1 y 5" })
      return
    }

    const moodLog = await prisma.moodLog.create({
      data: {
        userId: user.id,
        mood,
        energy,
        stress,
        note: note || null,
        context: context || "STANDALONE",
        workoutId: workoutId || null,
      },
    })

    // Invalidar readiness de hoy (se recalculará)
    await prisma.readinessScore.deleteMany({
      where: { userId: user.id, date: todayDate() },
    })

    res.json({ data: moodLog })
  } catch (err) {
    console.error("Error creating mood log:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/mood/today — mood logs de hoy
router.get("/mood/today", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const startOfDay = todayDate()
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const logs = await prisma.moodLog.findMany({
      where: {
        userId: user.id,
        loggedAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { loggedAt: "desc" },
    })

    res.json({ data: logs })
  } catch (err) {
    console.error("Error fetching mood today:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/mood/history — últimos 30 días
router.get("/mood/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const logs = await prisma.moodLog.findMany({
      where: {
        userId: user.id,
        loggedAt: { gte: daysAgo(30) },
      },
      orderBy: { loggedAt: "desc" },
    })

    res.json({ data: logs })
  } catch (err) {
    console.error("Error fetching mood history:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── SLEEP ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// POST /api/wellness/sleep — crear sleep log
router.post("/sleep", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { date, bedTime, wakeTime, quality, awakenings, notes } = req.body

    if (!bedTime || !wakeTime) {
      res.status(400).json({ error: "bedTime y wakeTime son requeridos" })
      return
    }

    const bedDate = new Date(bedTime)
    const wakeDate = new Date(wakeTime)
    
    // Validate dates
    if (isNaN(bedDate.getTime()) || isNaN(wakeDate.getTime())) {
      res.status(400).json({ error: "Fecha de sueño inválida" })
      return
    }
    
    const durationMinutes = Math.round((wakeDate.getTime() - bedDate.getTime()) / 60000)

    if (durationMinutes < 0 || durationMinutes > 1440) {
      res.status(400).json({ error: "Duración de sueño inválida" })
      return
    }

    // Fecha de la noche: usar date proporcionado o inferir del bedTime
    const sleepDate = date
      ? new Date(date + "T00:00:00.000Z")
      : new Date(bedDate.toISOString().split("T")[0] + "T00:00:00.000Z")

    // Calcular sleep score
    // Obtener bedTimes recientes para consistencia
    const recentLogs = await prisma.sleepLog.findMany({
      where: {
        userId: user.id,
        date: { gte: daysAgo(7), lt: sleepDate },
      },
      orderBy: { date: "desc" },
      take: 7,
    })

    const recentBedTimes = recentLogs.map((l) => toMinutesSinceMidnight(l.bedTime))
    const currentBedTime = toMinutesSinceMidnight(bedDate)

    const scoreResult = calculateSleepScore({
      durationMinutes,
      quality: quality ?? 3,
      awakenings: awakenings ?? 0,
      recentBedTimes: recentBedTimes.length >= 3 ? recentBedTimes : undefined,
      currentBedTime: recentBedTimes.length >= 3 ? currentBedTime : undefined,
    })

    const sleepLog = await prisma.sleepLog.upsert({
      where: { userId_date: { userId: user.id, date: sleepDate } },
      update: {
        bedTime: bedDate,
        wakeTime: wakeDate,
        durationMinutes,
        quality: quality ?? 3,
        awakenings: awakenings ?? 0,
        sleepScore: scoreResult.score,
        notes: notes || null,
      },
      create: {
        userId: user.id,
        date: sleepDate,
        bedTime: bedDate,
        wakeTime: wakeDate,
        durationMinutes,
        quality: quality ?? 3,
        awakenings: awakenings ?? 0,
        sleepScore: scoreResult.score,
        notes: notes || null,
      },
    })

    // Invalidar readiness de hoy
    await prisma.readinessScore.deleteMany({
      where: { userId: user.id, date: todayDate() },
    })

    res.json({ data: { ...sleepLog, scoreBreakdown: scoreResult } })
  } catch (err) {
    console.error("Error creating sleep log:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/sleep/today — sleep log de anoche
router.get("/sleep/today", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // "Anoche" = hoy o ayer (buscar el más reciente)
    const log = await prisma.sleepLog.findFirst({
      where: {
        userId: user.id,
        date: { gte: daysAgo(1) },
      },
      orderBy: { date: "desc" },
    })

    res.json({ data: log })
  } catch (err) {
    console.error("Error fetching today sleep:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/sleep/history — últimos 30 días
router.get("/sleep/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const days = parseInt(req.query.days as string) || 30

    const logs = await prisma.sleepLog.findMany({
      where: {
        userId: user.id,
        date: { gte: daysAgo(days) },
      },
      orderBy: { date: "asc" },
    })

    res.json({ data: logs })
  } catch (err) {
    console.error("Error fetching sleep history:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── READINESS ────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/wellness/readiness — readiness score de hoy (calcula si no existe)
router.get("/readiness", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const today = todayDate()

    // Buscar cache
    const existing = await prisma.readinessScore.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    })
    if (existing) {
      res.json({ data: existing })
      return
    }

    // Calcular desde datos
    const result = await computeReadinessForUser(user.id, today)

    // Guardar en DB usando upsert para evitar race condition
    const saved = await prisma.readinessScore.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: result,
      create: {
        userId: user.id,
        date: today,
        ...result,
      },
    })

    res.json({ data: saved })
  } catch (err) {
    console.error("Error computing readiness:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/readiness/history — últimos 14 días
router.get("/readiness/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const scores = await prisma.readinessScore.findMany({
      where: {
        userId: user.id,
        date: { gte: daysAgo(14) },
      },
      orderBy: { date: "asc" },
    })

    res.json({ data: scores })
  } catch (err) {
    console.error("Error fetching readiness history:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── DASHBOARD (composición) ──────────────────────────
// ═══════════════════════════════════════════════════════

// GET /api/wellness/dashboard — todo lo que necesita la Wellness Tab
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    console.log("[dashboard] Starting dashboard request")
    const { userId: clerkId } = getAuth(req)
    console.log("[dashboard] Clerk ID:", clerkId)
    const user = await getUserByClerkId(clerkId!)
    console.log("[dashboard] User found:", user?.id)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const today = todayDate()
    const startOfDay = today
    const endOfDay = new Date(today)
    endOfDay.setDate(endOfDay.getDate() + 1)

    console.log("[dashboard] Fetching data...")
    // Fetch en paralelo
    const [
      readinessExisting,
      sleepToday,
      moodToday,
      sleepHistory,
      journalStreak,
    ] = await Promise.all([
      prisma.readinessScore.findUnique({
        where: { userId_date: { userId: user.id, date: today } },
      }),
      prisma.sleepLog.findFirst({
        where: { userId: user.id, date: { gte: daysAgo(1) } },
        orderBy: { date: "desc" },
      }),
      prisma.moodLog.findFirst({
        where: { userId: user.id, loggedAt: { gte: startOfDay, lt: endOfDay } },
        orderBy: { loggedAt: "desc" },
      }),
      prisma.sleepLog.findMany({
        where: { userId: user.id, date: { gte: daysAgo(7) } },
        orderBy: { date: "asc" },
      }),
      // Journal streak: días consecutivos con al menos 1 entry
      prisma.journalEntry.findMany({
        where: { userId: user.id, createdAt: { gte: daysAgo(60) } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ])

    console.log("[dashboard] Data fetched, calculating readiness...")
    // Calcular readiness si no existe
    let readiness = readinessExisting
    if (!readiness) {
      console.log("[dashboard] Computing readiness for user:", user.id)
      const result = await computeReadinessForUser(user.id, today)
      console.log("[dashboard] Readiness computed:", result)
      readiness = await prisma.readinessScore.create({
        data: { userId: user.id, date: today, ...result },
      })
      console.log("[dashboard] Readiness saved")
    }

    console.log("[dashboard] Calculating journal streak...")
    // Calcular journal streak
    const journalDays = new Set(
      journalStreak.map((j) => j.createdAt.toISOString().split("T")[0])
    )
    let jStreak = 0
    for (let i = 0; i < 60; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split("T")[0]
      if (journalDays.has(key)) jStreak++
      else if (i > 0) break // permitir que hoy no tenga aún
    }

    console.log("[dashboard] Sending response...")
    res.json({
      data: {
        readiness: {
          score: readiness.score,
          zone: readiness.zone,
          recommendation: readiness.recommendation,
          components: {
            sleep: readiness.sleepComponent,
            mood: readiness.moodComponent,
            stress: readiness.stressComponent,
            load: readiness.loadComponent,
            soreness: readiness.sorenessComponent,
          },
        },
        sleep: sleepToday
          ? {
              score: sleepToday.sleepScore,
              duration: sleepToday.durationMinutes,
              bedTime: sleepToday.bedTime,
              wakeTime: sleepToday.wakeTime,
              quality: sleepToday.quality,
            }
          : null,
        mood: moodToday
          ? {
              mood: moodToday.mood,
              energy: moodToday.energy,
              stress: moodToday.stress,
              loggedAt: moodToday.loggedAt,
            }
          : null,
        sleepHistory: sleepHistory.map((s) => ({
          date: s.date,
          duration: s.durationMinutes,
          score: s.sleepScore,
          quality: s.quality,
        })),
        streaks: {
          journaling: jStreak,
        },
      },
    })
    console.log("[dashboard] Response sent successfully")
  } catch (err) {
    console.error("Error fetching wellness dashboard:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── BREATHING ────────────────────────────────────────
// ═══════════════════════════════════════════════════════

const VALID_TECHNIQUES = ["BOX_4_4_4_4", "RELAXING_4_7_8", "WIM_HOF", "COHERENT_5_5", "ENERGIZING_4_2"]

// POST /api/wellness/breathing — registrar sesión
router.post("/breathing", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { technique, durationSec, targetSec, completed, moodBefore, moodAfter } = req.body

    if (!technique || !VALID_TECHNIQUES.includes(technique)) {
      res.status(400).json({ error: "Técnica inválida" })
      return
    }
    if (!durationSec || durationSec < 1) {
      res.status(400).json({ error: "durationSec requerido" })
      return
    }

    const session = await prisma.breathingSession.create({
      data: {
        userId: user.id,
        technique,
        durationSec,
        targetSec: targetSec ?? durationSec,
        completed: completed ?? true,
        moodBefore: moodBefore ?? null,
        moodAfter: moodAfter ?? null,
      },
    })

    res.json({ data: session })
  } catch (err) {
    console.error("Error creating breathing session:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/breathing/history — últimas sesiones
router.get("/breathing/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const days = parseInt(req.query.days as string) || 30

    const sessions = await prisma.breathingSession.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: daysAgo(days) },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    // Stats rápidas
    const totalSessions = sessions.length
    const totalMinutes = Math.round(sessions.reduce((s, b) => s + b.durationSec, 0) / 60)

    res.json({ data: { sessions, stats: { totalSessions, totalMinutes } } })
  } catch (err) {
    console.error("Error fetching breathing history:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── JOURNAL ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// POST /api/wellness/journal — crear entrada
router.post("/journal", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { content, type, mood, tags } = req.body

    if (!content || content.trim().length === 0) {
      res.status(400).json({ error: "El contenido no puede estar vacío" })
      return
    }

    const validTypes = ["FREE", "GRATITUDE", "REFLECTION", "PRE_WORKOUT"]
    const journalType = validTypes.includes(type) ? type : "FREE"

    const entry = await prisma.journalEntry.create({
      data: {
        userId: user.id,
        content: content.trim(),
        type: journalType,
        mood: mood ?? null,
        tags: Array.isArray(tags) ? tags : [],
      },
    })

    res.json({ data: entry })
  } catch (err) {
    console.error("Error creating journal entry:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/journal — entradas recientes
router.get("/journal", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const days = parseInt(req.query.days as string) || 30
    const limit = parseInt(req.query.limit as string) || 20

    const entries = await prisma.journalEntry.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: daysAgo(days) },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })

    res.json({ data: entries })
  } catch (err) {
    console.error("Error fetching journal entries:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// DELETE /api/wellness/journal/:id — eliminar entrada
router.delete("/journal/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const entryId = req.params.id as string
    const entry = await prisma.journalEntry.findUnique({ where: { id: entryId } })
    if (!entry || entry.userId !== user.id) {
      res.status(404).json({ error: "Entrada no encontrada" })
      return
    }

    await prisma.journalEntry.delete({ where: { id: entryId } })
    res.json({ success: true })
  } catch (err) {
    console.error("Error deleting journal entry:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── SORENESS / DOMS ─────────────────────────────────
// ═══════════════════════════════════════════════════════

// POST /api/wellness/soreness — registrar soreness del día
router.post("/soreness", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { muscleData, overallSoreness, notes } = req.body

    if (overallSoreness === undefined || overallSoreness < 0 || overallSoreness > 5) {
      res.status(400).json({ error: "overallSoreness debe ser 0-5" })
      return
    }

    const today = todayDate()

    const log = await prisma.sorenessLog.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: {
        muscleData: muscleData ?? {},
        overallSoreness,
        notes: notes || null,
      },
      create: {
        userId: user.id,
        date: today,
        muscleData: muscleData ?? {},
        overallSoreness,
        notes: notes || null,
      },
    })

    // Invalidar readiness de hoy
    await prisma.readinessScore.deleteMany({
      where: { userId: user.id, date: today },
    })

    res.json({ data: log })
  } catch (err) {
    console.error("Error creating soreness log:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/soreness/today — soreness de hoy
router.get("/soreness/today", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const log = await prisma.sorenessLog.findFirst({
      where: { userId: user.id, date: { gte: daysAgo(1) } },
      orderBy: { date: "desc" },
    })

    res.json({ data: log })
  } catch (err) {
    console.error("Error fetching soreness today:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/soreness/history — historial
router.get("/soreness/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const days = parseInt(req.query.days as string) || 14

    const logs = await prisma.sorenessLog.findMany({
      where: { userId: user.id, date: { gte: daysAgo(days) } },
      orderBy: { date: "desc" },
    })

    res.json({ data: logs })
  } catch (err) {
    console.error("Error fetching soreness history:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── INSIGHTS ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════

// Helper: fetch all wellness data for a user within a date range
async function fetchInsightData(userId: string, from: Date, to: Date): Promise<InsightData> {
  const [sleepLogs, moodLogs, workouts, sorenessLogs, breathingSessions, journalEntries, readinessScores] =
    await Promise.all([
      prisma.sleepLog.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
        select: { date: true, durationMinutes: true, sleepScore: true, quality: true },
      }),
      prisma.moodLog.findMany({
        where: { userId, loggedAt: { gte: from, lte: to } },
        orderBy: { loggedAt: "asc" },
        select: { loggedAt: true, mood: true, energy: true, stress: true },
      }),
      prisma.workout.findMany({
        where: { userId, isCompleted: true, startTime: { gte: from, lte: to } },
        orderBy: { startTime: "asc" },
        select: { startTime: true, totalVolume: true, duration: true, name: true },
      }),
      prisma.sorenessLog.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: "desc" },
        select: { date: true, overallSoreness: true },
      }),
      prisma.breathingSession.findMany({
        where: { userId, createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, durationSec: true, moodBefore: true, moodAfter: true },
      }),
      prisma.journalEntry.findMany({
        where: { userId, createdAt: { gte: from, lte: to } },
        select: { createdAt: true },
      }),
      prisma.readinessScore.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
        select: { date: true, score: true, zone: true },
      }),
    ])

  return { sleepLogs, moodLogs, workouts, sorenessLogs, breathingSessions, journalEntries, readinessScores }
}

// GET /api/wellness/insights — personalized insights
router.get("/insights", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const data = await fetchInsightData(user.id, daysAgo(21), new Date())
    const insights = generateInsights(data)

    res.json({ data: insights })
  } catch (err) {
    console.error("Error generating insights:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// GET /api/wellness/weekly-report — weekly wellness summary
router.get("/weekly-report", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const now = new Date()
    const weekAgo = daysAgo(7)
    const twoWeeksAgo = daysAgo(14)

    const [thisWeekData, prevWeekData] = await Promise.all([
      fetchInsightData(user.id, weekAgo, now),
      fetchInsightData(user.id, twoWeeksAgo, weekAgo),
    ])

    const report = generateWeeklyReport(thisWeekData, prevWeekData)

    res.json({ data: report })
  } catch (err) {
    console.error("Error generating weekly report:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── WELLNESS PUSH NOTIFICATIONS ──────────────────────
// ═══════════════════════════════════════════════════════

// POST /api/wellness/send-reminders — trigger wellness reminders (called by cron or manually)
router.post("/send-reminders", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const today = todayDate()
    const endOfDay = new Date(today)
    endOfDay.setDate(endOfDay.getDate() + 1)

    // Check what's missing today
    const [hasMood, hasSleep, hasSoreness] = await Promise.all([
      prisma.moodLog.findFirst({
        where: { userId: user.id, loggedAt: { gte: today, lt: endOfDay } },
      }),
      prisma.sleepLog.findFirst({
        where: { userId: user.id, date: { gte: daysAgo(1) } },
      }),
      prisma.sorenessLog.findFirst({
        where: { userId: user.id, date: today },
      }),
    ])

    const sent: string[] = []

    if (!hasMood) {
      await sendPushToUser(
        user.id,
        "¿Cómo te sientes hoy? 🌤️",
        "Registra tu ánimo y energía para mejorar tus insights de bienestar.",
        { route: "/wellness" }
      )
      sent.push("mood")
    }

    if (!hasSleep) {
      await sendPushToUser(
        user.id,
        "¿Cómo dormiste anoche? 😴",
        "Registra tu sueño para calcular tu readiness de hoy.",
        { route: "/wellness/sleep-log" }
      )
      sent.push("sleep")
    }

    if (!hasSoreness) {
      await sendPushToUser(
        user.id,
        "¿Cómo está tu cuerpo? 💪",
        "Registra tu soreness para personalizar tus recomendaciones de recovery.",
        { route: "/wellness/recovery" }
      )
      sent.push("soreness")
    }

    // Weekly report notification (on Sundays or Mondays)
    const dayOfWeek = todayDate().getUTCDay()
    if (dayOfWeek === 1) { // Monday
      await sendPushToUser(
        user.id,
        "Tu reporte semanal está listo 📊",
        "Revisa cómo fue tu semana de bienestar y descubre correlaciones.",
        { route: "/wellness/weekly-report" }
      )
      sent.push("weekly_report")
    }

    // Readiness alert (if RED zone)
    const readiness = await prisma.readinessScore.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    })
    if (readiness && readiness.zone === "RED") {
      await sendPushToUser(
        user.id,
        "Readiness en zona roja 🔴",
        `Score: ${readiness.score}/100. Tu cuerpo necesita descanso hoy. Considera recovery activa.`,
        { route: "/wellness" }
      )
      sent.push("readiness_red")
    }

    res.json({ data: { sent } })
  } catch (err) {
    console.error("Error sending wellness reminders:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── TRAINING SUGGESTION (readiness → intensity) ──────
// ═══════════════════════════════════════════════════════

// GET /api/wellness/training-suggestion — workout intensity + focus based on readiness
router.get("/training-suggestion", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const today = todayDate()

    // Get or compute readiness
    let readiness = await prisma.readinessScore.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    })
    if (!readiness) {
      const result = await computeReadinessForUser(user.id, today)
      readiness = await prisma.readinessScore.create({
        data: { userId: user.id, date: today, ...result },
      })
    }

    // Get soreness for muscle avoidance
    const soreness = await prisma.sorenessLog.findFirst({
      where: { userId: user.id, date: { gte: daysAgo(1) } },
      orderBy: { date: "desc" },
    })

    const soreMuscles: string[] = []
    if (soreness?.muscleData && typeof soreness.muscleData === "object") {
      const data = soreness.muscleData as Record<string, unknown>
      for (const [muscle, levelVal] of Object.entries(data)) {
        // Runtime-safe check: only add if value is a number
        const level = typeof levelVal === "number" ? levelVal : 0
        if (level >= 3) soreMuscles.push(muscle)
      }
    }

    // Build suggestion based on zone + components
    const zone = readiness.zone
    const score = readiness.score
    const sleepLow = readiness.sleepComponent < 18 // < 50% of 35
    const stressHigh = readiness.stressComponent < 8 // < 50% of 15 (inverted scale)
    const loadHigh = readiness.loadComponent < 10 // < 50% of 20

    type Suggestion = {
      intensity: "REST" | "LIGHT" | "MODERATE" | "HIGH" | "MAX"
      emoji: string
      title: string
      description: string
      recommendations: string[]
      avoidMuscles: string[]
      suggestedDuration: number // minutes
      suggestedRPE: { min: number; max: number }
    }

    let suggestion: Suggestion

    if (zone === "RED") {
      suggestion = {
        intensity: score < 25 ? "REST" : "LIGHT",
        emoji: score < 25 ? "🛌" : "🚶",
        title: score < 25 ? "Día de descanso total" : "Recovery activa",
        description: score < 25
          ? "Tu cuerpo necesita recuperarse. Prioriza sueño, hidratación y nutrición."
          : "Muévete suave: caminata, yoga o movilidad. Nada intenso hoy.",
        recommendations: [
          ...(sleepLow ? ["Prioriza dormir 8+ horas esta noche"] : []),
          ...(stressHigh ? ["Prueba una sesión de respiración para bajar el estrés"] : []),
          ...(loadHigh ? ["Has acumulado mucho volumen — tu cuerpo necesita recuperar"] : []),
          score < 25 ? "Foam rolling y estiramientos suaves" : "Caminata de 20-30 min o yoga",
          "Hidratación: al menos 2.5L de agua hoy",
        ],
        avoidMuscles: soreMuscles,
        suggestedDuration: score < 25 ? 0 : 30,
        suggestedRPE: score < 25 ? { min: 0, max: 0 } : { min: 3, max: 5 },
      }
    } else if (zone === "YELLOW") {
      const isLower = score < 55
      suggestion = {
        intensity: isLower ? "LIGHT" : "MODERATE",
        emoji: isLower ? "🧘" : "💪",
        title: isLower ? "Entreno ligero" : "Entreno moderado",
        description: isLower
          ? "Baja el volumen y la intensidad. Técnica > peso."
          : "Puedes entrenar bien pero no es día de PRs. Controla la intensidad.",
        recommendations: [
          ...(sleepLow ? ["No compenses mal sueño con cafeína extra — entrena ligero"] : []),
          ...(stressHigh ? ["Incluye 5 min de respiración post-entreno"] : []),
          ...(soreMuscles.length > 0 ? [`Evita trabajar: ${soreMuscles.join(", ")}`] : []),
          isLower ? "Reduce el peso un 20-30% de lo habitual" : "Mantén el peso habitual, no subas",
          isLower ? "3 sets en vez de 4-5" : "Puedes hacer tu volumen normal",
        ],
        avoidMuscles: soreMuscles,
        suggestedDuration: isLower ? 40 : 60,
        suggestedRPE: isLower ? { min: 5, max: 6 } : { min: 6, max: 7 },
      }
    } else {
      // GREEN
      suggestion = {
        intensity: score >= 85 ? "MAX" : "HIGH",
        emoji: score >= 85 ? "🔥" : "⚡",
        title: score >= 85 ? "Día para romper PRs" : "Entreno intenso",
        description: score >= 85
          ? "Estás en tu mejor momento. Aprovecha para ir a por nuevos récords."
          : "Gran día para entrenar fuerte. Puedes subir peso o volumen.",
        recommendations: [
          score >= 85 ? "Intenta superar un PR en tu ejercicio principal" : "Puedes subir el peso un 5-10%",
          "Aprovecha para meter más volumen si te sientes bien",
          ...(soreMuscles.length > 0 ? [`Cuidado con: ${soreMuscles.join(", ")} (aún con soreness)`] : []),
          "No olvides calentar bien antes de ir pesado",
        ],
        avoidMuscles: soreMuscles.filter((m) => {
          const level = (soreness?.muscleData as Record<string, number>)?.[m] ?? 0
          return level >= 4 // Only avoid severely sore muscles in GREEN
        }),
        suggestedDuration: 75,
        suggestedRPE: score >= 85 ? { min: 8, max: 10 } : { min: 7, max: 9 },
      }
    }

    res.json({
      data: {
        readiness: { score, zone },
        suggestion,
      },
    })
  } catch (err) {
    console.error("Error generating training suggestion:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── NUTRITION ADJUSTMENT (readiness → nutrition) ─────
// ═══════════════════════════════════════════════════════

// GET /api/wellness/nutrition-adjustment — calorie/macro adjustments based on readiness
router.get("/nutrition-adjustment", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const today = todayDate()

    // Get or compute readiness
    let readiness = await prisma.readinessScore.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    })
    if (!readiness) {
      const result = await computeReadinessForUser(user.id, today)
      readiness = await prisma.readinessScore.create({
        data: { userId: user.id, date: today, ...result },
      })
    }

    // User's base goals
    const baseCalories = user.calorieGoal ?? 2000
    const baseProtein = user.proteinGoal ?? 120
    const baseCarbs = user.carbsGoal ?? 250
    const baseFat = user.fatGoal ?? 65

    const zone = readiness.zone
    const score = readiness.score
    const sleepLow = readiness.sleepComponent < 18

    type NutritionAdj = {
      emoji: string
      title: string
      description: string
      calories: { base: number; adjusted: number; delta: number }
      protein: { base: number; adjusted: number; delta: number }
      carbs: { base: number; adjusted: number; delta: number }
      fat: { base: number; adjusted: number; delta: number }
      tips: string[]
    }

    let adj: NutritionAdj

    if (zone === "RED") {
      // Recovery day: slight surplus, more protein for repair, moderate carbs
      const calAdj = Math.round(baseCalories * 0.95) // Slight deficit (not training)
      const protAdj = Math.round(baseProtein * 1.1) // +10% protein for recovery
      const carbAdj = Math.round(baseCarbs * 0.85) // Less carbs (not training)
      const fatAdj = Math.round(baseFat * 1.05) // Slight fat increase (hormone support)

      adj = {
        emoji: "🔴",
        title: "Día de recovery",
        description: "Prioriza proteína para reparación muscular. Menos carbohidratos ya que no entrenas intenso.",
        calories: { base: baseCalories, adjusted: calAdj, delta: calAdj - baseCalories },
        protein: { base: baseProtein, adjusted: protAdj, delta: protAdj - baseProtein },
        carbs: { base: baseCarbs, adjusted: carbAdj, delta: carbAdj - baseCarbs },
        fat: { base: baseFat, adjusted: fatAdj, delta: fatAdj - baseFat },
        tips: [
          "Prioriza alimentos antiinflamatorios: pescado, verduras, frutas",
          ...(sleepLow ? ["Evita cafeína después de las 2pm para mejorar tu sueño"] : []),
          "Incluye alimentos ricos en magnesio: nueces, espinacas, chocolate negro",
          "Hidrátate bien: mínimo 2.5L de agua",
        ],
      }
    } else if (zone === "YELLOW") {
      // Moderate day: normal calories, balanced macros
      const calAdj = baseCalories // No change
      const protAdj = Math.round(baseProtein * 1.05) // Slight protein bump
      const carbAdj = Math.round(baseCarbs * 0.95) // Slight carb reduction
      const fatAdj = baseFat

      adj = {
        emoji: "🟡",
        title: "Ajuste moderado",
        description: "Mantén tu ingesta normal con ligero énfasis en proteína.",
        calories: { base: baseCalories, adjusted: calAdj, delta: 0 },
        protein: { base: baseProtein, adjusted: protAdj, delta: protAdj - baseProtein },
        carbs: { base: baseCarbs, adjusted: carbAdj, delta: carbAdj - baseCarbs },
        fat: { base: baseFat, adjusted: fatAdj, delta: 0 },
        tips: [
          "Come normal — tu cuerpo no necesita ajustes grandes hoy",
          ...(sleepLow ? ["Un snack con triptófano antes de dormir: plátano, leche, pavo"] : []),
          "Distribuye la proteína en 4-5 comidas para mejor absorción",
        ],
      }
    } else {
      // GREEN: training day — more carbs for fuel, maintained protein
      const calAdj = Math.round(baseCalories * 1.1) // +10% surplus for training
      const protAdj = baseProtein // Keep protein steady
      const carbAdj = Math.round(baseCarbs * 1.15) // +15% carbs for fuel
      const fatAdj = Math.round(baseFat * 1.05) // Slight fat increase

      adj = {
        emoji: "🟢",
        title: "Día de entreno intenso",
        description: "Más carbohidratos para combustible y recuperación. Aprovecha el surplus calórico.",
        calories: { base: baseCalories, adjusted: calAdj, delta: calAdj - baseCalories },
        protein: { base: baseProtein, adjusted: protAdj, delta: 0 },
        carbs: { base: baseCarbs, adjusted: carbAdj, delta: carbAdj - baseCarbs },
        fat: { base: baseFat, adjusted: fatAdj, delta: fatAdj - baseFat },
        tips: [
          "Come carbohidratos complejos 2h antes del entreno: arroz, avena, pasta",
          "Post-entreno: proteína + carbohidratos rápidos dentro de 1h",
          score >= 85 ? "Día ideal para un refeed o comida libre" : "Puedes permitirte un poco más de carbohidratos hoy",
        ],
      }
    }

    res.json({
      data: {
        readiness: { score, zone },
        adjustment: adj,
      },
    })
  } catch (err) {
    console.error("Error generating nutrition adjustment:", err)
    res.status(500).json({ error: "Error interno" })
  }
})

// ═══════════════════════════════════════════════════════
// ─── HELPER: Compute Readiness ────────────────────────
// ═══════════════════════════════════════════════════════

async function computeReadinessForUser(userId: string, date: Date) {
  const startOfDay = date
  const endOfDay = new Date(date)
  endOfDay.setDate(endOfDay.getDate() + 1)

  const [sleepLog, moodLog, sorenessLog, weekWorkouts, prevWeekWorkouts, lastWorkout] =
    await Promise.all([
      // Sleep de anoche
      prisma.sleepLog.findFirst({
        where: { userId, date: { gte: daysAgo(1), lte: date } },
        orderBy: { date: "desc" },
      }),
      // Mood más reciente (< 24h)
      prisma.moodLog.findFirst({
        where: { userId, loggedAt: { gte: daysAgo(1) } },
        orderBy: { loggedAt: "desc" },
      }),
      // Soreness de hoy
      prisma.sorenessLog.findFirst({
        where: { userId, date: { gte: daysAgo(1), lte: date } },
        orderBy: { date: "desc" },
      }),
      // Volume últimos 7 días
      prisma.workout.findMany({
        where: { userId, isCompleted: true, startTime: { gte: daysAgo(7) } },
        select: { totalVolume: true },
      }),
      // Volume 8-14 días atrás
      prisma.workout.findMany({
        where: {
          userId,
          isCompleted: true,
          startTime: { gte: daysAgo(14), lt: daysAgo(7) },
        },
        select: { totalVolume: true },
      }),
      // Último workout
      prisma.workout.findFirst({
        where: { userId, isCompleted: true },
        orderBy: { startTime: "desc" },
        select: { startTime: true },
      }),
    ])

  const weekVolume = weekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0)
  const prevWeekVolume = prevWeekWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0)

  const hoursSinceLastWorkout = lastWorkout
    ? (Date.now() - lastWorkout.startTime.getTime()) / (1000 * 60 * 60)
    : null

  const result = calculateReadiness({
    sleepScore: sleepLog?.sleepScore ?? null,
    mood: moodLog?.mood ?? null,
    energy: moodLog?.energy ?? null,
    stress: moodLog?.stress ?? null,
    weekVolume,
    prevWeekVolume,
    hoursSinceLastWorkout,
    overallSoreness: sorenessLog?.overallSoreness ?? null,
  })

  return result
}

export default router
