// ─────────────────────────────────────────────────────
// backend/src/routes/steps.ts
// Step Counter — sync, historial, metas, streaks
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { updateChallengeProgress } from "../lib/challengeProgress.js"

const router = Router()
router.use(requireAuth)

async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } })
}

function estimateCalories(steps: number, weightKg?: number | null): number {
  const factor = weightKg ? weightKg * 0.00057 : 0.04
  return Math.round(steps * factor)
}

function estimateDistance(steps: number, heightCm?: number | null): number {
  const strideM = heightCm ? (heightCm * 0.415) / 100 : 0.762
  return Math.round((steps * strideM) / 10) / 100
}

function estimateActiveMinutes(steps: number): number {
  return Math.round(steps / 100)
}

// ═══════════════════════════════════════════════════════
// POST /api/steps/sync — Sincronizar pasos del dispositivo
// ═══════════════════════════════════════════════════════
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { steps, date, hourlySteps } = req.body

    if (steps === undefined || steps < 0) {
      res.status(400).json({ error: "steps es requerido y debe ser >= 0" })
      return
    }

    // ─── ANTI-CHEAT VALIDACIONES ─────────────────
    // 1. Máximo 300,000 pasos/día (récord mundial ~50,000)
    if (steps > 300000) {
      res.status(400).json({ error: "Valor de pasos sospechoso" })
      return
    }

    // 2. Si hay hourlySteps, validar consistencia
    if (hourlySteps && Array.isArray(hourlySteps)) {
      const hourlyTotal = hourlySteps.reduce((a: number, b: number) => a + b, 0)
      // Tolerancia del 10% entre total reportado y suma horaria
      if (Math.abs(hourlyTotal - steps) > steps * 0.1 && steps > 100) {
        res.status(400).json({ error: "Datos horarios inconsistentes" })
        return
      }
      // 3. Ninguna hora puede tener más de 10,000 pasos (corredor élite ~8,000/hora)
      const maxHourly = Math.max(...hourlySteps)
      if (maxHourly > 10000) {
        res.status(400).json({ error: "Pasos por hora sospechosos" })
        return
      }
    }

    // 4. Comparar con el registro anterior del mismo día
    const targetDate = date
      ? new Date(date + "T00:00:00.000Z")
      : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")

    const existing = await prisma.dailySteps.findUnique({
      where: { userId_date: { userId: user.id, date: targetDate } },
    })

    // Allow pedometer recalibration (Apple Fitness adjusts steps down when
    // it detects false positives like car vibrations). Block large drops
    // (>50% decrease) as potential manipulation, but accept small corrections.
    let finalSteps = steps
    if (existing && existing.steps > 0) {
      const dropPercent = (existing.steps - steps) / existing.steps
      if (steps < existing.steps && dropPercent > 0.5 && steps > 500) {
        // Large suspicious drop — keep existing value
        finalSteps = existing.steps
      }
      // Otherwise trust the device (even if it went down slightly)
    }
    const calories = estimateCalories(finalSteps, user.weight)
    const distanceKm = estimateDistance(finalSteps, user.height)
    const activeMinutes = estimateActiveMinutes(finalSteps)

    const dailySteps = await prisma.dailySteps.upsert({
      where: {
        userId_date: { userId: user.id, date: targetDate },
      },
      update: {
        steps: finalSteps,
        calories,
        distanceKm,
        activeMinutes,
        hourlySteps: hourlySteps || undefined,
      },
      create: {
        userId: user.id,
        date: targetDate,
        steps: finalSteps,
        goal: existing?.goal ?? 8500,
        calories,
        distanceKm,
        activeMinutes,
        hourlySteps: hourlySteps || null,
      },
    })

    // XP: 1 XP por cada 1000 pasos (máximo 10 XP/día por pasos)
    const stepXP = Math.min(10, Math.floor(finalSteps / 1000))
    if (stepXP > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: stepXP } },
      })
    }

    // ─── AUTO-PROGRESS CHALLENGES (DISTANCE) ──────
    // Non-blocking: actualiza challenges de tipo DISTANCE
    updateChallengeProgress({
      userId: user.id,
      steps: { totalDistanceKm: distanceKm },
    })

    res.json({
      ...dailySteps,
      xpEarned: stepXP,
      goalReached: finalSteps >= dailySteps.goal,
      goalPercentage: Math.min(100, Math.round((finalSteps / dailySteps.goal) * 100)),
    })
  } catch (error) {
    console.error("Steps sync error:", error)
    res.status(500).json({ error: "Error al sincronizar pasos" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/steps/today — Pasos de hoy
// ═══════════════════════════════════════════════════════
router.get("/today", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const clientDate = req.query.today as string | undefined
    const todayStr = clientDate || new Date().toISOString().split("T")[0]
    const today = new Date(todayStr + "T00:00:00.000Z")

    let dailySteps = await prisma.dailySteps.findUnique({
      where: { userId_date: { userId: user.id, date: today } },
    })

    if (!dailySteps) {
      dailySteps = await prisma.dailySteps.create({
        data: { userId: user.id, date: today, steps: 0, goal: 8500 },
      })
    }

    res.json({
      ...dailySteps,
      goalPercentage: Math.min(100, Math.round((dailySteps.steps / dailySteps.goal) * 100)),
      goalReached: dailySteps.steps >= dailySteps.goal,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener pasos" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/steps/week — Últimos 7 días
// ═══════════════════════════════════════════════════════
router.get("/week", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Usar la fecha local del cliente (o fallback a UTC)
    const clientDate = req.query.today as string | undefined
    const dayLabels = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"]

    // Determinar "hoy" desde la perspectiva del cliente
    const todayStr = clientDate || new Date().toISOString().split("T")[0]
    const todayParts = todayStr.split("-").map(Number) // [YYYY, MM, DD]

    const days: any[] = []

    for (let i = 6; i >= 0; i--) {
      // Crear fecha usando componentes para evitar problemas de timezone
      const d = new Date(todayParts[0], todayParts[1] - 1, todayParts[2] - i)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      const targetDate = new Date(dateStr + "T00:00:00.000Z")

      const record = await prisma.dailySteps.findUnique({
        where: { userId_date: { userId: user.id, date: targetDate } },
      })

      days.push({
        date: dateStr,
        dayLabel: dayLabels[d.getDay()],
        steps: record?.steps ?? 0,
        goal: record?.goal ?? 8500,
        calories: record?.calories ?? 0,
        distanceKm: record?.distanceKm ?? 0,
        activeMinutes: record?.activeMinutes ?? 0,
        goalReached: (record?.steps ?? 0) >= (record?.goal ?? 8500),
        isToday: i === 0,
      })
    }

    const weekTotal = days.reduce(
      (acc, d) => ({
        steps: acc.steps + d.steps,
        calories: acc.calories + d.calories,
        distanceKm: Math.round((acc.distanceKm + d.distanceKm) * 100) / 100,
        activeMinutes: acc.activeMinutes + d.activeMinutes,
        daysGoalReached: acc.daysGoalReached + (d.goalReached ? 1 : 0),
      }),
      { steps: 0, calories: 0, distanceKm: 0, activeMinutes: 0, daysGoalReached: 0 }
    )

    const avgSteps = Math.round(weekTotal.steps / 7)

    res.json({ days, weekTotal, avgSteps })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener semana" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/steps/month — Mes (calendario + totales)
// ═══════════════════════════════════════════════════════
router.get("/month", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const year = parseInt(req.query.year as string) || new Date().getFullYear()
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1

    const startDate = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`)
    const endDate = new Date(year, month, 0)
    endDate.setHours(23, 59, 59, 999)

    const records = await prisma.dailySteps.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: "asc" },
    })

    const monthTotal = records.reduce(
      (acc, r) => ({
        steps: acc.steps + r.steps,
        calories: acc.calories + r.calories,
        distanceKm: Math.round((acc.distanceKm + r.distanceKm) * 100) / 100,
        activeMinutes: acc.activeMinutes + r.activeMinutes,
        daysLogged: acc.daysLogged + 1,
        daysGoalReached: acc.daysGoalReached + (r.steps >= r.goal ? 1 : 0),
      }),
      { steps: 0, calories: 0, distanceKm: 0, activeMinutes: 0, daysLogged: 0, daysGoalReached: 0 }
    )

    // Step streak (días consecutivos alcanzando meta) — sin límite de días
    const allStepDays = await prisma.dailySteps.findMany({
      where: { userId: user.id },
      select: { date: true, steps: true, goal: true },
      orderBy: { date: "desc" },
    })

    const dayMap = new Map(
      allStepDays.map((s) => [s.date.toISOString().split("T")[0], s])
    )

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split("T")[0]
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split("T")[0]

    const todayRec = dayMap.get(todayStr)
    const yestRec = dayMap.get(yesterdayStr)

    let startFrom: Date | null = null
    if (todayRec && todayRec.steps >= todayRec.goal) {
      startFrom = new Date(today)
    } else if (yestRec && yestRec.steps >= yestRec.goal) {
      startFrom = new Date(yesterday)
    }

    let stepStreak = 0
    if (startFrom) {
      const iter = new Date(startFrom)
      while (true) {
        const rec = dayMap.get(iter.toISOString().split("T")[0])
        if (!rec || rec.steps < rec.goal) break
        stepStreak++
        iter.setDate(iter.getDate() - 1)
      }
    }

    res.json({
      days: records.map((r) => ({
        date: r.date.toISOString().split("T")[0],
        day: new Date(r.date).getDate(),
        steps: r.steps,
        goal: r.goal,
        goalReached: r.steps >= r.goal,
      })),
      monthTotal,
      stepStreak,
      year,
      month,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener mes" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/steps/goal — Cambiar meta diaria
// ═══════════════════════════════════════════════════════
router.put("/goal", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { goal } = req.body

    if (!goal || goal < 1000 || goal > 100000) {
      res.status(400).json({ error: "Meta debe estar entre 1,000 y 100,000" })
      return
    }

    const today = new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")

    await prisma.dailySteps.upsert({
      where: { userId_date: { userId: user.id, date: today } },
      update: { goal },
      create: { userId: user.id, date: today, steps: 0, goal },
    })

    res.json({ goal, message: "Meta actualizada" })
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar meta" })
  }
})

export default router