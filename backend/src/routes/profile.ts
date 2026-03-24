// ─────────────────────────────────────────────────────
// backend/src/routes/profile.ts
// Enhanced Public Profile — combo, stats, charts,
// comparison, showcase, weight log, history
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { calculateLevel, calculateStreak, updateBestStreak } from "../lib/userHelpers.js"
import { Prisma } from "../generated/prisma/client.js"

const router = Router()
router.use(requireAuth)

// ─── Resolve authenticated user ─────────────────────
async function getAuthUser(req: Request) {
  const { userId: clerkId } = getAuth(req)
  if (!clerkId) return null
  return prisma.user.findUnique({ where: { clerkId } })
}

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/combo
// Combined profile data — single request
// ═══════════════════════════════════════════════════════
router.get("/:userId/combo", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req)
    const targetId = req.params.userId as string

    const user = await prisma.user.findUnique({ where: { id: targetId } })
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const isOwnProfile = authUser?.id === user.id

    const [
      featuredBadge,
      primaryPlaceRel,
      goalPref,
      showcase,
      followersCount,
      followingCount,
      isFollowing,
      streak,
      badgesEarned,
    ] = await Promise.all([
      user.featuredBadgeId
        ? prisma.badge.findUnique({
            where: { id: user.featuredBadgeId },
            select: { id: true, slug: true, name: true, icon: true, rarity: true, description: true },
          })
        : Promise.resolve(null),
      prisma.userPlace.findFirst({
        where: { userId: user.id, isPrimary: true },
        include: { place: { select: { id: true, name: true, type: true } } },
      }),
      prisma.userGoalPreference.findFirst({ where: { userId: user.id }, select: { goalSlug: true } }),
      prisma.profileShowcase.findUnique({ where: { userId: user.id }, select: { badgeIds: true } }),
      prisma.follow.count({ where: { followingId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
      authUser && !isOwnProfile
        ? prisma.follow.findUnique({
            where: { followerId_followingId: { followerId: authUser.id, followingId: user.id } },
          }).then(Boolean)
        : Promise.resolve(false),
      calculateStreak(user.id),
      prisma.userBadge.count({ where: { userId: user.id } }),
    ])

    const showcaseBadges = showcase?.badgeIds?.length
      ? await prisma.badge.findMany({
          where: { id: { in: showcase.badgeIds } },
          select: { id: true, slug: true, name: true, icon: true, rarity: true },
        })
      : []

    updateBestStreak(user.id, streak).catch(() => {})
    const levelInfo = calculateLevel(user.xp)

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      experienceLevel: user.experienceLevel,
      createdAt: user.createdAt,
      xp: user.xp,
      level: levelInfo.level,
      currentXP: levelInfo.currentXP,
      maxXP: levelInfo.maxXP,
      streak,
      bestStreak: Math.max(user.bestStreak, streak),
      weight: isOwnProfile ? user.weight : null,
      height: isOwnProfile ? user.height : null,
      bodyFat: isOwnProfile ? user.bodyFat : null,
      initialWeight: isOwnProfile ? user.initialWeight : null,
      initialBodyFat: isOwnProfile ? user.initialBodyFat : null,
      followersCount,
      followingCount,
      isFollowing,
      isOwnProfile,
      badgesEarned,
      featuredBadge: featuredBadge || null,
      showcaseBadges,
      primaryPlace: primaryPlaceRel?.place || null,
      primaryGoal: goalPref?.goalSlug || null,
    })
  } catch (error) {
    console.error("Profile combo error:", error)
    res.status(500).json({ error: "Error al obtener perfil" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/stats
// Expanded statistics — all categories
// ═══════════════════════════════════════════════════════
router.get("/:userId/stats", async (req: Request, res: Response) => {
  try {
    const targetId = req.params.userId as string
    const user = await prisma.user.findUnique({ where: { id: targetId } })
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const [
      totalWorkouts,
      volumeAgg,
      durationAgg,
      totalPRs,
      longestWorkout,
      stepsAgg,
      nutritionAgg,
      foodLogCount,
      totalPosts,
      reactionsReceived,
      challengesCompleted,
      challengesWon,
      badgesEarned,
      totalBadges,
    ] = await Promise.all([
      prisma.workout.count({ where: { userId: targetId, isCompleted: true } }),
      prisma.workout.aggregate({ where: { userId: targetId, isCompleted: true }, _sum: { totalVolume: true } }),
      prisma.workout.aggregate({ where: { userId: targetId, isCompleted: true }, _sum: { duration: true }, _avg: { duration: true } }),
      prisma.personalRecord.count({ where: { userId: targetId } }),
      prisma.workout.findFirst({ where: { userId: targetId, isCompleted: true }, orderBy: { duration: "desc" }, select: { duration: true, name: true } }),
      prisma.dailySteps.aggregate({ where: { userId: targetId }, _sum: { steps: true, distanceKm: true }, _avg: { steps: true, activeMinutes: true }, _max: { steps: true } }),
      prisma.foodLog.aggregate({ where: { userId: targetId }, _avg: { totalCalories: true, totalProtein: true, totalCarbs: true, totalFat: true, waterMl: true } }),
      prisma.foodLog.count({ where: { userId: targetId } }),
      prisma.post.count({ where: { userId: targetId } }),
      prisma.reaction.count({ where: { post: { userId: targetId } } }),
      prisma.challengeParticipant.count({ where: { userId: targetId, challenge: { status: "COMPLETED" } } }),
      prisma.challengeParticipant.count({ where: { userId: targetId, isWinner: true } }),
      prisma.userBadge.count({ where: { userId: targetId } }),
      prisma.badge.count(),
    ])

    // Top exercise
    const topExercise = await prisma.workoutSet.groupBy({
      by: ["exerciseName"],
      where: { workout: { userId: targetId, isCompleted: true }, isCompleted: true },
      _count: { exerciseName: true },
      orderBy: { _count: { exerciseName: "desc" } },
      take: 1,
    })

    // Weekly average
    const firstWorkout = await prisma.workout.findFirst({
      where: { userId: targetId, isCompleted: true },
      orderBy: { startTime: "asc" },
      select: { startTime: true },
    })
    const weeksSinceFirst = firstWorkout
      ? Math.max(1, Math.ceil((Date.now() - firstWorkout.startTime.getTime()) / (7 * 24 * 60 * 60 * 1000)))
      : 1

    // Monthly consistency
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const workoutDaysLast30 = await prisma.workout.findMany({
      where: { userId: targetId, isCompleted: true, startTime: { gte: thirtyDaysAgo } },
      select: { startTime: true },
    })
    const uniqueDays = new Set(workoutDaysLast30.map(w => w.startTime.toISOString().split("T")[0]))

    const streak = await calculateStreak(targetId)
    const levelInfo = calculateLevel(user.xp)

    // Step goal days via raw query
    const stepGoalDays = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count FROM daily_steps WHERE "userId" = ${targetId} AND steps >= goal
    `.catch(() => [{ count: BigInt(0) }])
    const stepGoalDaysCount = Number(stepGoalDays[0]?.count || 0)
    const totalStepDays = await prisma.dailySteps.count({ where: { userId: targetId } }) || 1

    // Strength PRs (big 3 + overhead press + row)
    const [benchPR, squatPR, deadliftPR, ohpPR, rowPR] = await Promise.all([
      prisma.personalRecord.findFirst({ where: { userId: targetId, exerciseName: { contains: "bench press", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true, achievedAt: true } }),
      prisma.personalRecord.findFirst({ where: { userId: targetId, exerciseName: { contains: "squat", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true, achievedAt: true } }),
      prisma.personalRecord.findFirst({ where: { userId: targetId, exerciseName: { contains: "deadlift", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true, achievedAt: true } }),
      prisma.personalRecord.findFirst({ where: { userId: targetId, exerciseName: { contains: "overhead press", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true, achievedAt: true } }),
      prisma.personalRecord.findFirst({ where: { userId: targetId, exerciseName: { contains: "row", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true, achievedAt: true } }),
    ])

    // Estimated 1RM total (bench + squat + deadlift)
    const estimatedTotal = (benchPR?.weight || 0) + (squatPR?.weight || 0) + (deadliftPR?.weight || 0)

    // Weight log history for body progress
    const weightLogs = await prisma.weightLog.findMany({
      where: { userId: targetId },
      select: { weight: true, bodyFat: true, loggedAt: true },
      orderBy: { loggedAt: "desc" },
      take: 5,
    })

    res.json({
      training: {
        totalWorkouts,
        weeklyAvg: Math.round((totalWorkouts / weeksSinceFirst) * 10) / 10,
        monthlyConsistency: Math.round((uniqueDays.size / 30) * 100),
        totalVolume: Math.round(volumeAgg._sum?.totalVolume || 0),
        totalMinutes: durationAgg._sum?.duration || 0,
        avgDuration: Math.round(durationAgg._avg?.duration || 0),
        longestWorkout: longestWorkout ? { duration: longestWorkout.duration, name: longestWorkout.name } : null,
        topExercise: topExercise.length > 0
          ? { name: topExercise[0].exerciseName, count: topExercise[0]._count.exerciseName }
          : null,
        totalPRs,
      },
      activity: {
        totalSteps: stepsAgg._sum?.steps || 0,
        avgDailySteps: Math.round(stepsAgg._avg?.steps || 0),
        totalDistance: Math.round((stepsAgg._sum?.distanceKm || 0) * 10) / 10,
        dailyRecord: stepsAgg._max?.steps || 0,
        avgActiveMinutes: Math.round(stepsAgg._avg?.activeMinutes || 0),
        goalDaysPercent: totalStepDays > 0 ? Math.round((stepGoalDaysCount / totalStepDays) * 100) : 0,
      },
      nutrition: {
        avgCalories: Math.round(nutritionAgg._avg?.totalCalories || 0),
        avgProtein: Math.round(nutritionAgg._avg?.totalProtein || 0),
        avgCarbs: Math.round(nutritionAgg._avg?.totalCarbs || 0),
        avgFat: Math.round(nutritionAgg._avg?.totalFat || 0),
        avgWater: Math.round(nutritionAgg._avg?.waterMl || 0),
        daysLogged: foodLogCount,
      },
      strength: {
        benchPR: benchPR?.weight || 0,
        benchDate: benchPR?.achievedAt || null,
        squatPR: squatPR?.weight || 0,
        squatDate: squatPR?.achievedAt || null,
        deadliftPR: deadliftPR?.weight || 0,
        deadliftDate: deadliftPR?.achievedAt || null,
        ohpPR: ohpPR?.weight || 0,
        ohpDate: ohpPR?.achievedAt || null,
        rowPR: rowPR?.weight || 0,
        rowDate: rowPR?.achievedAt || null,
        estimatedTotal,
      },
      body: {
        currentWeight: user.weight,
        initialWeight: user.initialWeight,
        weightChange: user.weight && user.initialWeight ? Math.round((user.weight - user.initialWeight) * 10) / 10 : null,
        currentBF: user.bodyFat,
        initialBF: user.initialBodyFat,
        bfChange: user.bodyFat && user.initialBodyFat ? Math.round((user.bodyFat - user.initialBodyFat) * 10) / 10 : null,
        height: user.height,
        bmi: user.weight && user.height ? Math.round((user.weight / ((user.height / 100) ** 2)) * 10) / 10 : null,
        recentWeightLogs: weightLogs.map(l => ({ weight: l.weight, bodyFat: l.bodyFat, date: l.loggedAt })),
      },
      gamification: {
        level: levelInfo.level,
        xp: user.xp,
        currentXP: levelInfo.currentXP,
        maxXP: levelInfo.maxXP,
        streak,
        bestStreak: Math.max(user.bestStreak, streak),
        badgesEarned,
        badgesTotal: totalBadges,
        totalPosts,
        reactionsReceived,
        challengesCompleted,
        challengesWon,
      },
      memberSince: user.createdAt,
    })
  } catch (error) {
    console.error("Profile stats error:", error)
    res.status(500).json({ error: "Error al obtener estadísticas" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/charts/:type
// ?period=3m|6m|1y
// ═══════════════════════════════════════════════════════
router.get("/:userId/charts/:type", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string
    const type = req.params.type as string
    const period = (req.query.period as string) || "3m"

    const monthsMap: Record<string, number> = { "1m": 1, "3m": 3, "6m": 6, "1y": 12, "all": 120 }
    const months = monthsMap[period] || 3
    const since = new Date()
    since.setMonth(since.getMonth() - months)

    switch (type) {
      case "heatmap": {
        const workouts = await prisma.workout.findMany({
          where: { userId, isCompleted: true, startTime: { gte: since } },
          select: { startTime: true, duration: true, totalVolume: true },
        })
        const dayMap: Record<string, { count: number; volume: number; duration: number }> = {}
        workouts.forEach(w => {
          const day = w.startTime.toISOString().split("T")[0]
          if (!dayMap[day]) dayMap[day] = { count: 0, volume: 0, duration: 0 }
          dayMap[day].count++
          dayMap[day].volume += w.totalVolume
          dayMap[day].duration += w.duration || 0
        })
        res.json({ type: "heatmap", data: dayMap }); return
      }

      case "volume": {
        const weeks = Math.ceil(months * 4.3)
        const data: Array<{ value: number; label: string }> = []
        for (let i = weeks - 1; i >= 0; i--) {
          const weekStart = new Date()
          weekStart.setHours(0, 0, 0, 0)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
          const weekEnd = new Date(weekStart)
          weekEnd.setDate(weekEnd.getDate() + 7)
          const agg = await prisma.workout.aggregate({
            where: { userId, isCompleted: true, startTime: { gte: weekStart, lt: weekEnd } },
            _sum: { totalVolume: true },
          })
          data.push({ value: Math.round(agg._sum?.totalVolume || 0), label: `S${weeks - i}` })
        }
        res.json({ type: "bar", data }); return
      }

      case "strength": {
        const prs = await prisma.personalRecord.findMany({
          where: { userId },
          select: { exerciseName: true, weight: true, achievedAt: true },
          orderBy: { achievedAt: "asc" },
        })
        const grouped: Record<string, Array<{ value: number; date: string }>> = {}
        prs.forEach(pr => {
          if (!pr.weight) return
          if (!grouped[pr.exerciseName]) grouped[pr.exerciseName] = []
          grouped[pr.exerciseName].push({ value: pr.weight, date: pr.achievedAt.toISOString().split("T")[0] })
        })
        res.json({ type: "line", data: grouped }); return
      }

      case "muscle": {
        const workouts = await prisma.workout.findMany({
          where: { userId, isCompleted: true, startTime: { gte: since }, muscleStimulus: { not: Prisma.DbNull } },
          select: { muscleStimulus: true },
        })
        const muscles: Record<string, number> = {}
        workouts.forEach(w => {
          const ms = w.muscleStimulus as Record<string, number> | null
          if (!ms) return
          Object.entries(ms).forEach(([muscle, val]) => {
            muscles[muscle] = (muscles[muscle] || 0) + val
          })
        })
        const total = Object.values(muscles).reduce((a, b) => a + b, 0) || 1
        const data = Object.entries(muscles)
          .map(([name, value]) => ({ name, value: Math.round((value / total) * 100) }))
          .sort((a, b) => b.value - a.value)
        res.json({ type: "pie", data }); return
      }

      case "steps": {
        const steps = await prisma.dailySteps.findMany({
          where: { userId, date: { gte: since } },
          select: { date: true, steps: true, goal: true },
          orderBy: { date: "asc" },
        })
        const data = steps.map(s => ({
          value: s.steps,
          label: s.date.toLocaleDateString("es", { month: "short", day: "numeric" }),
          goal: s.goal,
        }))
        res.json({ type: "line", data }); return
      }

      case "weight": {
        const logs = await prisma.weightLog.findMany({
          where: { userId, loggedAt: { gte: since } },
          select: { weight: true, bodyFat: true, loggedAt: true },
          orderBy: { loggedAt: "asc" },
        })
        const data = logs.map(l => ({
          value: l.weight,
          bodyFat: l.bodyFat,
          label: l.loggedAt.toLocaleDateString("es", { month: "short", day: "numeric" }),
        }))
        res.json({ type: "line", data }); return
      }

      case "xp": {
        const workouts = await prisma.workout.findMany({
          where: { userId, isCompleted: true, startTime: { gte: since } },
          select: { xpEarned: true, startTime: true },
          orderBy: { startTime: "asc" },
        })
        let cumulative = 0
        const data = workouts.map(w => {
          cumulative += w.xpEarned
          return { value: cumulative, label: w.startTime.toLocaleDateString("es", { month: "short", day: "numeric" }) }
        })
        res.json({ type: "area", data }); return
      }

      case "macros": {
        const logs = await prisma.foodLog.findMany({
          where: { userId, date: { gte: since } },
          select: { totalCalories: true, totalProtein: true, totalCarbs: true, totalFat: true },
        })
        const count = logs.length || 1
        const avg = {
          protein: Math.round(logs.reduce((s, l) => s + l.totalProtein, 0) / count),
          carbs: Math.round(logs.reduce((s, l) => s + l.totalCarbs, 0) / count),
          fat: Math.round(logs.reduce((s, l) => s + l.totalFat, 0) / count),
          calories: Math.round(logs.reduce((s, l) => s + l.totalCalories, 0) / count),
        }
        const totalCal = (avg.protein * 4) + (avg.carbs * 4) + (avg.fat * 9) || 1
        res.json({
          type: "macros",
          data: {
            protein: { grams: avg.protein, percent: Math.round((avg.protein * 4 / totalCal) * 100) },
            carbs: { grams: avg.carbs, percent: Math.round((avg.carbs * 4 / totalCal) * 100) },
            fat: { grams: avg.fat, percent: Math.round((avg.fat * 9 / totalCal) * 100) },
            avgCalories: avg.calories,
          },
        }); return
      }

      default:
        res.status(400).json({ error: "Tipo de gráfico no válido" })
    }
  } catch (error) {
    console.error("Charts error:", error)
    res.status(500).json({ error: "Error al obtener datos de gráfico" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/posts?cursor=X&limit=12
// ═══════════════════════════════════════════════════════
router.get("/:userId/posts", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string
    const cursor = req.query.cursor as string | undefined
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 30)

    const authUser = await getAuthUser(req)
    const isOwn = authUser?.id === userId

    const posts = await prisma.post.findMany({
      where: { userId, ...(isOwn ? {} : { isPublic: true }) },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true, level: true } },
        media: { select: { id: true, url: true, type: true, width: true, height: true, duration: true, thumbnailUrl: true } },
        _count: { select: { comments: true, reactions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = posts.length > limit
    const items = hasMore ? posts.slice(0, limit) : posts
    const nextCursor = hasMore ? items[items.length - 1].id : null

    res.json({ posts: items, nextCursor, hasMore })
  } catch (error) {
    console.error("Profile posts error:", error)
    res.status(500).json({ error: "Error al obtener posts" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/history?page=1&limit=20
// ═══════════════════════════════════════════════════════
router.get("/:userId/history", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

    const [workouts, total] = await Promise.all([
      prisma.workout.findMany({
        where: { userId, isCompleted: true },
        include: {
          sets: {
            select: { exerciseName: true, isPR: true },
            where: { isCompleted: true },
          },
        },
        orderBy: { startTime: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workout.count({ where: { userId, isCompleted: true } }),
    ])

    const items = workouts.map(w => {
      const exercises = [...new Set(w.sets.map(s => s.exerciseName))]
      const prs = w.sets.filter(s => s.isPR).length
      return {
        id: w.id,
        name: w.name,
        date: w.startTime,
        duration: w.duration,
        totalVolume: Math.round(w.totalVolume),
        xpEarned: w.xpEarned,
        exercises,
        prsInWorkout: prs,
        setsCount: w.sets.length,
      }
    })

    res.json({ workouts: items, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("Profile history error:", error)
    res.status(500).json({ error: "Error al obtener historial" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/nutrition-history?page=1&limit=20
// ═══════════════════════════════════════════════════════
router.get("/:userId/nutrition-history", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

    const [logs, total] = await Promise.all([
      prisma.foodLog.findMany({
        where: { userId },
        select: {
          id: true, date: true, totalCalories: true, totalProtein: true,
          totalCarbs: true, totalFat: true, totalFiber: true, waterMl: true,
          calorieGoal: true, proteinGoal: true, carbsGoal: true, fatGoal: true,
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.foodLog.count({ where: { userId } }),
    ])

    const items = logs.map(l => ({
      id: l.id,
      date: l.date,
      calories: l.totalCalories,
      protein: l.totalProtein,
      carbs: l.totalCarbs,
      fat: l.totalFat,
      fiber: l.totalFiber,
      water: l.waterMl,
      calorieGoal: l.calorieGoal,
      caloriePercent: l.calorieGoal > 0 ? Math.round((l.totalCalories / l.calorieGoal) * 100) : 0,
    }))

    res.json({ logs: items, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("Nutrition history error:", error)
    res.status(500).json({ error: "Error al obtener historial de nutrición" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/steps-history?page=1&limit=20
// ═══════════════════════════════════════════════════════
router.get("/:userId/steps-history", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50)

    const [days, total] = await Promise.all([
      prisma.dailySteps.findMany({
        where: { userId },
        select: {
          id: true, date: true, steps: true, goal: true,
          calories: true, distanceKm: true, activeMinutes: true, floors: true,
        },
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dailySteps.count({ where: { userId } }),
    ])

    const items = days.map(d => ({
      id: d.id,
      date: d.date,
      steps: d.steps,
      goal: d.goal,
      goalReached: d.steps >= d.goal,
      calories: d.calories,
      distance: Math.round(d.distanceKm * 10) / 10,
      activeMinutes: d.activeMinutes,
      floors: d.floors,
      goalPercent: d.goal > 0 ? Math.round((d.steps / d.goal) * 100) : 0,
    }))

    res.json({ days: items, total, page, totalPages: Math.ceil(total / limit) })
  } catch (error) {
    console.error("Steps history error:", error)
    res.status(500).json({ error: "Error al obtener historial de pasos" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/badges
// ═══════════════════════════════════════════════════════
router.get("/:userId/badges", async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId as string

    const [allBadges, earnedBadges] = await Promise.all([
      prisma.badge.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true } }),
    ])

    const earnedMap = new Map(earnedBadges.map(e => [e.badgeId, e.earnedAt]))

    const badges = allBadges
      .filter(b => !b.isSecret || earnedMap.has(b.id))
      .map(b => ({
        id: b.id, slug: b.slug, name: b.name, description: b.description,
        icon: b.icon, category: b.category, rarity: b.rarity, xpReward: b.xpReward,
        earned: earnedMap.has(b.id), earnedAt: earnedMap.get(b.id) || null,
      }))

    res.json({ badges, earned: earnedBadges.length, total: allBadges.filter(b => !b.isSecret).length })
  } catch (error) {
    console.error("Profile badges error:", error)
    res.status(500).json({ error: "Error al obtener badges" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/profile/:userId/compare
// ═══════════════════════════════════════════════════════
router.get("/:userId/compare", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) { res.status(401).json({ error: "No autenticado" }); return }

    const targetId = req.params.userId as string
    if (authUser.id === targetId) { res.status(400).json({ error: "No puedes compararte contigo mismo" }); return }

    const target = await prisma.user.findUnique({ where: { id: targetId } })
    if (!target) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    async function getUserCompareStats(uid: string, u: { name: string; username: string; avatarUrl: string | null; xp: number }) {
      const [totalWorkouts, volumeAgg, totalPRs, stepsAgg, badgesEarned, streak] = await Promise.all([
        prisma.workout.count({ where: { userId: uid, isCompleted: true } }),
        prisma.workout.aggregate({ where: { userId: uid, isCompleted: true }, _sum: { totalVolume: true } }),
        prisma.personalRecord.count({ where: { userId: uid } }),
        prisma.dailySteps.aggregate({ where: { userId: uid }, _avg: { steps: true } }),
        prisma.userBadge.count({ where: { userId: uid } }),
        calculateStreak(uid),
      ])

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const workoutDays = await prisma.workout.findMany({
        where: { userId: uid, isCompleted: true, startTime: { gte: thirtyDaysAgo } },
        select: { startTime: true },
      })
      const uniqueDays = new Set(workoutDays.map(w => w.startTime.toISOString().split("T")[0]))

      const [benchPR, squatPR, deadliftPR] = await Promise.all([
        prisma.personalRecord.findFirst({ where: { userId: uid, exerciseName: { contains: "bench press", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true } }),
        prisma.personalRecord.findFirst({ where: { userId: uid, exerciseName: { contains: "squat", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true } }),
        prisma.personalRecord.findFirst({ where: { userId: uid, exerciseName: { contains: "deadlift", mode: "insensitive" } }, orderBy: { weight: "desc" }, select: { weight: true } }),
      ])

      return {
        name: u.name, username: u.username, avatarUrl: u.avatarUrl,
        level: calculateLevel(u.xp).level, xp: u.xp, streak, totalWorkouts,
        totalVolume: Math.round(volumeAgg._sum?.totalVolume || 0),
        monthlyConsistency: Math.round((uniqueDays.size / 30) * 100),
        totalPRs, avgDailySteps: Math.round(stepsAgg._avg?.steps || 0), badgesEarned,
        benchPR: benchPR?.weight || 0, squatPR: squatPR?.weight || 0, deadliftPR: deadliftPR?.weight || 0,
      }
    }

    const [myStats, theirStats] = await Promise.all([
      getUserCompareStats(authUser.id, authUser),
      getUserCompareStats(targetId, target),
    ])

    const metrics = [
      { key: "benchPR", label: "Bench Press PR" }, { key: "squatPR", label: "Squat PR" },
      { key: "deadliftPR", label: "Deadlift PR" }, { key: "totalWorkouts", label: "Total Workouts" },
      { key: "monthlyConsistency", label: "Consistencia" }, { key: "totalVolume", label: "Volumen Total" },
      { key: "avgDailySteps", label: "Pasos/Día" }, { key: "xp", label: "XP Total" },
      { key: "streak", label: "Streak" }, { key: "badgesEarned", label: "Badges" },
      { key: "totalPRs", label: "Total PRs" },
    ] as const

    let myWins = 0, theirWins = 0
    const comparison = metrics.map(m => {
      const myVal = (myStats as any)[m.key] as number
      const theirVal = (theirStats as any)[m.key] as number
      const winner = myVal > theirVal ? "me" : theirVal > myVal ? "them" : "tie"
      if (winner === "me") myWins++
      if (winner === "them") theirWins++
      return { key: m.key, label: m.label, myValue: myVal, theirValue: theirVal, winner }
    })

    res.json({
      me: myStats, them: theirStats, comparison,
      score: { me: myWins, them: theirWins, ties: metrics.length - myWins - theirWins },
    })
  } catch (error) {
    console.error("Compare error:", error)
    res.status(500).json({ error: "Error al comparar" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/profile/weight-log
// ═══════════════════════════════════════════════════════
router.post("/weight-log", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) { res.status(401).json({ error: "No autenticado" }); return }

    const { weight, bodyFat, note } = req.body
    if (!weight || weight <= 0) { res.status(400).json({ error: "Peso requerido" }); return }

    const log = await prisma.weightLog.create({ data: { userId: authUser.id, weight, bodyFat, note } })

    const updateData: Record<string, any> = { weight }
    if (bodyFat !== undefined) updateData.bodyFat = bodyFat
    if (!authUser.initialWeight) updateData.initialWeight = weight
    if (bodyFat && !authUser.initialBodyFat) updateData.initialBodyFat = bodyFat
    await prisma.user.update({ where: { id: authUser.id }, data: updateData })

    res.json(log)
  } catch (error) {
    console.error("Weight log error:", error)
    res.status(500).json({ error: "Error al registrar peso" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/profile/showcase
// ═══════════════════════════════════════════════════════
router.put("/showcase", async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req)
    if (!authUser) { res.status(401).json({ error: "No autenticado" }); return }

    const { badgeIds } = req.body
    if (!Array.isArray(badgeIds) || badgeIds.length > 4) {
      res.status(400).json({ error: "Máximo 4 badges" }); return
    }

    const showcase = await prisma.profileShowcase.upsert({
      where: { userId: authUser.id },
      create: { userId: authUser.id, badgeIds },
      update: { badgeIds },
    })

    res.json(showcase)
  } catch (error) {
    console.error("Showcase error:", error)
    res.status(500).json({ error: "Error al actualizar showcase" })
  }
})

export default router
