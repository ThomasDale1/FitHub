// ─────────────────────────────────────────────────────
// backend/src/routes/users.ts
// Sprint 2: User Profile + Dashboard Stats
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { isValidCloudinaryUrl, deleteCloudinaryResource } from "../lib/cloudinary.js"

const router = Router()
router.use(requireAuth)

// ─── Helper ───────────────────────────────────────────
async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    include: {
      featuredBadge: { select: { id: true, slug: true, name: true, icon: true, rarity: true } },
    },
  })
}

// ─── XP → Level calculation ──────────────────────────
// Cada nivel necesita más XP que el anterior
// Level 1: 0-499, Level 2: 500-1199, Level 3: 1200-2099...
function calculateLevel(xp: number): { level: number; currentXP: number; maxXP: number } {
  let level = 1
  let xpForNextLevel = 500
  let totalXpUsed = 0

  while (xp >= totalXpUsed + xpForNextLevel) {
    totalXpUsed += xpForNextLevel
    level++
    xpForNextLevel = Math.floor(xpForNextLevel * 1.4) // cada nivel es 40% más difícil
  }

  return {
    level,
    currentXP: xp - totalXpUsed,
    maxXP: xpForNextLevel,
  }
}

// ─── Streak calculation ──────────────────────────────
// Calcula el streak real basado en workouts completados
async function calculateStreak(userId: string): Promise<number> {
  const workouts = await prisma.workout.findMany({
    where: { userId, isCompleted: true },
    select: { startTime: true },
    orderBy: { startTime: "desc" },
    take: 90, // últimos 90 workouts máximo
  })

  if (workouts.length === 0) return 0

  // Agrupar por fecha (solo date, sin hora)
  const workoutDates = new Set(
    workouts.map((w) => w.startTime.toISOString().split("T")[0])
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  const checkDate = new Date(today)

  // Verificar si hoy o ayer tiene workout (para dar gracia de 1 día)
  const todayStr = checkDate.toISOString().split("T")[0]
  checkDate.setDate(checkDate.getDate() - 1)
  const yesterdayStr = checkDate.toISOString().split("T")[0]

  if (!workoutDates.has(todayStr) && !workoutDates.has(yesterdayStr)) {
    return 0
  }

  // Si hoy no tiene workout, empezar desde ayer
  if (!workoutDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate()) // ya está en ayer
  } else {
    checkDate.setTime(today.getTime()) // empezar desde hoy
  }

  // Contar días consecutivos
  while (workoutDates.has(checkDate.toISOString().split("T")[0])) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return streak
}

// ═══════════════════════════════════════════════════════
// GET /api/users/me — Perfil del usuario
// ═══════════════════════════════════════════════════════
router.get("/me", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const levelInfo = calculateLevel(user.xp)
    const streak = await calculateStreak(user.id)

    res.json({
      ...user,
      level: levelInfo.level,
      currentXP: levelInfo.currentXP,
      maxXP: levelInfo.maxXP,
      streak,
      featuredBadge: user.featuredBadge || null,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfil" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/users/me — Actualizar perfil
// ═══════════════════════════════════════════════════════
router.put("/me", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    // Solo permitir actualizar campos seguros
    const allowedFields = [
      "name",
      "username",
      "bio",
      "avatarUrl",
      "avatarPublicId",
      "weight",
      "height",
      "bodyFat",
    ] as const

    const updateData: Record<string, any> = {}
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field]
      }
    }

    // Validate avatar URL if provided
    if (updateData.avatarUrl && !isValidCloudinaryUrl(updateData.avatarUrl)) {
      res.status(400).json({ error: "URL de avatar inválida" }); return
    }

    // Delete old avatar from Cloudinary if replacing
    if (updateData.avatarPublicId && user.avatarPublicId && user.avatarPublicId !== updateData.avatarPublicId) {
      deleteCloudinaryResource(user.avatarPublicId).catch(() => {})
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    })

    const levelInfo = calculateLevel(updatedUser.xp)

    res.json({
      ...updatedUser,
      level: levelInfo.level,
      currentXP: levelInfo.currentXP,
      maxXP: levelInfo.maxXP,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar perfil" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/stats — Stats del usuario para perfil
// ═══════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    // Total workouts completados
    const totalWorkouts = await prisma.workout.count({
      where: { userId: user.id, isCompleted: true },
    })

    // Total volumen (kg) acumulado
    const volumeResult = await prisma.workout.aggregate({
      where: { userId: user.id, isCompleted: true },
      _sum: { totalVolume: true },
    })

    // Total tiempo entrenando (minutos)
    const durationResult = await prisma.workout.aggregate({
      where: { userId: user.id, isCompleted: true },
      _sum: { duration: true },
    })

    // Total PRs
    const totalPRs = await prisma.personalRecord.count({
      where: { userId: user.id },
    })

    // Workout más largo
    const longestWorkout = await prisma.workout.findFirst({
      where: { userId: user.id, isCompleted: true },
      orderBy: { duration: "desc" },
      select: { duration: true, name: true },
    })

    // Ejercicio más frecuente
    const topExercise = await prisma.workoutSet.groupBy({
      by: ["exerciseName"],
      where: {
        workout: { userId: user.id, isCompleted: true },
        isCompleted: true,
      },
      _count: { exerciseName: true },
      orderBy: { _count: { exerciseName: "desc" } },
      take: 1,
    })

    // Member since
    const memberSince = user.createdAt

    res.json({
      totalWorkouts,
      totalVolume: Math.round(volumeResult._sum.totalVolume || 0),
      totalMinutes: durationResult._sum.duration || 0,
      totalPRs,
      longestWorkout: longestWorkout
        ? { duration: longestWorkout.duration, name: longestWorkout.name }
        : null,
      topExercise: topExercise.length > 0
        ? {
            name: topExercise[0].exerciseName,
            count: topExercise[0]._count.exerciseName,
          }
        : null,
      memberSince,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener estadísticas" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/dashboard — Stats para dashboard home
// ═══════════════════════════════════════════════════════
router.get("/dashboard", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const levelInfo = calculateLevel(user.xp)
    const streak = await calculateStreak(user.id)

    // Workouts esta semana
    const startOfWeek = new Date()
    startOfWeek.setHours(0, 0, 0, 0)
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()) // domingo

    const workoutsThisWeek = await prisma.workout.count({
      where: {
        userId: user.id,
        isCompleted: true,
        startTime: { gte: startOfWeek },
      },
    })

    // Calorías quemadas esta semana (estimación: 7 cal/min de workout)
    const weekWorkouts = await prisma.workout.aggregate({
      where: {
        userId: user.id,
        isCompleted: true,
        startTime: { gte: startOfWeek },
      },
      _sum: { duration: true, totalVolume: true },
    })

    const caloriesEstimate = Math.round(
      (weekWorkouts._sum.duration || 0) * 7
    )

    // Volumen esta semana
    const weeklyVolume = Math.round(weekWorkouts._sum.totalVolume || 0)

    // Workouts recientes (últimos 5)
    const recentWorkouts = await prisma.workout.findMany({
      where: { userId: user.id, isCompleted: true },
      select: {
        id: true,
        name: true,
        startTime: true,
        duration: true,
        xpEarned: true,
        totalVolume: true,
        _count: { select: { sets: { where: { isCompleted: true } } } },
      },
      orderBy: { startTime: "desc" },
      take: 5,
    })

    // Formatear workouts recientes
    const formattedWorkouts = recentWorkouts.map((w) => {
      const now = new Date()
      const diff = now.getTime() - w.startTime.getTime()
      const days = Math.floor(diff / (1000 * 60 * 60 * 24))

      let dateLabel: string
      if (days === 0) dateLabel = "Hoy"
      else if (days === 1) dateLabel = "Ayer"
      else if (days < 7) dateLabel = `Hace ${days} días`
      else dateLabel = w.startTime.toLocaleDateString("es")

      return {
        id: w.id,
        name: w.name,
        date: dateLabel,
        duration: w.duration || 0,
        xpEarned: w.xpEarned,
        setsCount: w._count.sets,
      }
    })

    // Goals activos
    const activeGoals = await prisma.goal.findMany({
      where: { userId: user.id, isCompleted: false },
      take: 3,
      orderBy: { createdAt: "desc" },
    })

    res.json({
      user: {
        name: user.name,
        avatarUrl: user.avatarUrl,
        xp: user.xp,
        level: levelInfo.level,
        currentXP: levelInfo.currentXP,
        maxXP: levelInfo.maxXP,
        streak,
        featuredBadge: user.featuredBadge || null,
      },
      weekStats: {
        workouts: workoutsThisWeek,
        calories: caloriesEstimate,
        volume: weeklyVolume,
        minutes: weekWorkouts._sum.duration || 0,
      },
      recentWorkouts: formattedWorkouts,
      activeGoals,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener dashboard" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/progress — Progreso semanal (últimas 8 semanas)
// ═══════════════════════════════════════════════════════
router.get("/progress", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const weeks: Array<{
      week: string
      workouts: number
      volume: number
      xp: number
    }> = []

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date()
      weekStart.setHours(0, 0, 0, 0)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)

      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)

      const weekData = await prisma.workout.aggregate({
        where: {
          userId: user.id,
          isCompleted: true,
          startTime: { gte: weekStart, lt: weekEnd },
        },
        _count: true,
        _sum: { totalVolume: true, xpEarned: true },
      })

      weeks.push({
        week: weekStart.toLocaleDateString("es", {
          month: "short",
          day: "numeric",
        }),
        workouts: weekData._count,
        volume: Math.round(weekData._sum.totalVolume || 0),
        xp: weekData._sum.xpEarned || 0,
      })
    }

    res.json({ weeks })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener progreso" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/users/goals — Crear una meta
// ═══════════════════════════════════════════════════════
router.post("/goals", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const { title, description, targetValue, unit } = req.body

    const goal = await prisma.goal.create({
      data: {
        userId: user.id,
        title,
        description,
        targetValue,
        unit,
        currentValue: 0,
      },
    })

    res.json(goal)
  } catch (error) {
    res.status(500).json({ error: "Error al crear meta" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/goals — Obtener metas del usuario
// ═══════════════════════════════════════════════════════
router.get("/goals", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const goals = await prisma.goal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    res.json(goals)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener metas" })
  }
})

export default router