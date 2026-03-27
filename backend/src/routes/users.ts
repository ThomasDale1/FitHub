// ─────────────────────────────────────────────────────
// backend/src/routes/users.ts
// Sprint 2: User Profile + Dashboard Stats
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { strictLimiter } from "../middleware/rateLimit.js"
import { getAuth } from "@clerk/express"
import { calculateLevel, calculateStreak, updateBestStreak } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

// ─── Helper ───────────────────────────────────────────
async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({
    where: { clerkId },
    include: {
      featuredBadge: { select: { id: true, slug: true, name: true, icon: true, rarity: true } },
      hobbies: { select: { hobbySlug: true } },
      goalPreferences: { select: { goalSlug: true, customText: true } },
      places: {
        where: { isPrimary: true },
        take: 1,
        include: { place: { select: { id: true, name: true, type: true } } },
      },
    },
  })
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

    const clientDate = req.query.today as string | undefined
    const levelInfo = calculateLevel(user.xp)
    const streak = await calculateStreak(user.id, clientDate)
    updateBestStreak(user.id, streak).catch(() => {})

    res.json({
      ...user,
      level: levelInfo.level,
      currentXP: levelInfo.currentXP,
      maxXP: levelInfo.maxXP,
      streak,
      bestStreak: Math.max(user.bestStreak, streak),
      featuredBadge: user.featuredBadge || null,
      onboardingCompleted: user.onboardingCompleted,
      onboardingStep: user.onboardingStep,
      primaryPlace: user.places[0]?.place || null,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfil" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/check-username/:username — Verificar disponibilidad
// strictLimiter: 10 req/min — previene enumeración masiva de usuarios
// ═══════════════════════════════════════════════════════
router.get("/check-username/:username", strictLimiter, async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const username = (req.params.username as string).toLowerCase().trim()

    if (!username || username.length < 3) {
      res.json({ available: false, reason: "El username debe tener al menos 3 caracteres" }); return
    }
    if (!/^[a-z0-9._]+$/.test(username)) {
      res.json({ available: false, reason: "Solo letras minúsculas, números, puntos y guiones bajos" }); return
    }

    const existing = await prisma.user.findUnique({ where: { username } })

    // If it belongs to the requesting user, it's "available" (they already own it)
    if (existing) {
      const currentUser = await prisma.user.findUnique({ where: { clerkId: clerkId! }, select: { id: true } })
      if (currentUser && existing.id === currentUser.id) {
        res.json({ available: true }); return
      }
      res.json({ available: false, reason: "Este username ya está en uso" }); return
    }

    res.json({ available: true })
  } catch (error) {
    res.status(500).json({ error: "Error al verificar username" })
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
    // avatarUrl viene de Clerk (webhook user.updated) — no se modifica directamente desde la app
    const allowedFields = [
      "name",
      "username",
      "bio",
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

    // Validate username uniqueness if changing
    if (updateData.username) {
      const uname = updateData.username.toLowerCase().trim()
      if (uname.length < 3) {
        res.status(400).json({ error: "El username debe tener al menos 3 caracteres" }); return
      }
      if (!/^[a-z0-9._]+$/.test(uname)) {
        res.status(400).json({ error: "Username solo puede tener letras minúsculas, números, puntos y guiones bajos" }); return
      }
      updateData.username = uname
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
  } catch (error: any) {
    // P2002 = @unique constraint on username violated (concurrent update race)
    if (error?.code === "P2002") {
      res.status(409).json({ error: "Este username ya está en uso" }); return
    }
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

    const clientDate = req.query.today as string | undefined
    const levelInfo = calculateLevel(user.xp)
    const streak = await calculateStreak(user.id, clientDate)

    // Workouts esta semana
    const startOfWeek = new Date()
    startOfWeek.setUTCHours(0, 0, 0, 0)
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay()) // domingo

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

    // Build all 8 week ranges upfront, then aggregate in parallel
    // (one DB roundtrip per week, all concurrent vs the old sequential for-await)
    const weekRanges = Array.from({ length: 8 }, (_, i) => {
      const weekStart = new Date()
      weekStart.setUTCHours(0, 0, 0, 0)
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay() - (7 - i) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
      return { weekStart, weekEnd }
    })

    const weekResults = await Promise.all(
      weekRanges.map(({ weekStart, weekEnd }) =>
        prisma.workout.aggregate({
          where: {
            userId: user.id,
            isCompleted: true,
            startTime: { gte: weekStart, lt: weekEnd },
          },
          _count: true,
          _sum: { totalVolume: true, xpEarned: true },
        })
      )
    )

    const weeks = weekRanges.map(({ weekStart }, i) => ({
      week: weekStart.toLocaleDateString("es", { month: "short", day: "numeric" }),
      workouts: weekResults[i]._count,
      volume: Math.round(weekResults[i]._sum.totalVolume || 0),
      xp: weekResults[i]._sum.xpEarned || 0,
    }))

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

    // Paginated: default 20, max 50 to avoid loading all goals at once
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)
    const page = Math.max(1, parseInt(req.query.page as string) || 1)

    const [goals, total] = await Promise.all([
      prisma.goal.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.goal.count({ where: { userId: user.id } }),
    ])

    res.json({ goals, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener metas" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/users/suggestions — People like you (onboarding)
// Score-based: same gym, shared hobbies, similar age/level
// ═══════════════════════════════════════════════════════
router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkId! },
      include: {
        hobbies: true,
        places: { where: { isPrimary: true }, take: 1 },
      },
    })

    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const myHobbySlugs = user.hobbies.map((h) => h.hobbySlug)
    const myPlaceId = user.places[0]?.placeId || null

    // Get users who are NOT me, with their hobbies and places
    const candidates = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        onboardingCompleted: true,
      },
      select: {
        id: true,
        name: true,
        username: true,
        avatarUrl: true,
        xp: true,
        level: true,
        streak: true,
        bio: true,
        dateOfBirth: true,
        experienceLevel: true,
        hobbies: { select: { hobbySlug: true } },
        places: { where: { isPrimary: true }, select: { placeId: true, place: { select: { name: true } } } },
        _count: { select: { workouts: { where: { isCompleted: true } } } },
      },
      take: 100,
    })

    // Calculate compatibility score
    const myAge = user.dateOfBirth
      ? Math.floor((Date.now() - user.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    const scored = candidates.map((c) => {
      let score = 0

      // Same gym: +40
      if (myPlaceId && c.places.some((p) => p.placeId === myPlaceId)) {
        score += 40
      }

      // Shared hobbies: +20 each
      const theirHobbies = c.hobbies.map((h) => h.hobbySlug)
      const sharedHobbies = myHobbySlugs.filter((s) => theirHobbies.includes(s))
      score += sharedHobbies.length * 20

      // Similar age (±5 years): +10
      if (myAge && c.dateOfBirth) {
        const theirAge = Math.floor((Date.now() - c.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (Math.abs(myAge - theirAge) <= 5) score += 10
      }

      // Same experience level: +10
      if (user.experienceLevel && c.experienceLevel === user.experienceLevel) {
        score += 10
      }

      // Has avatar: +5
      if (c.avatarUrl) score += 5

      return {
        id: c.id,
        name: c.name,
        username: c.username,
        avatarUrl: c.avatarUrl,
        xp: c.xp,
        level: c.level,
        streak: c.streak,
        bio: c.bio,
        experienceLevel: c.experienceLevel,
        workoutsCount: c._count.workouts,
        sharedHobbies,
        placeName: c.places[0]?.place?.name || null,
        sameGym: myPlaceId ? c.places.some((p) => p.placeId === myPlaceId) : false,
        score,
      }
    })

    // Sort by score desc, take top 20
    scored.sort((a, b) => b.score - a.score)
    const suggestions = scored.slice(0, 20).filter((s) => s.score > 0)

    res.json(suggestions)
  } catch (error) {
    console.error("Suggestions error:", error)
    res.status(500).json({ error: "Error al obtener sugerencias" })
  }
})

export default router