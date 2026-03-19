// ─────────────────────────────────────────────────────
// backend/src/routes/badges.ts
// Sprint 4: Badges / Achievements system
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { sendPushToUser } from "../lib/pushNotifications.js"

const router = Router()
router.use(requireAuth)

async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } })
}

// ─── Badge definitions (se insertan con seed) ────────
// Estas son las definiciones; el endpoint /seed las crea
const BADGE_DEFINITIONS = [
  // WORKOUT
  { slug: "first_workout", name: "Primera Sesión", description: "Completa tu primer workout", icon: "🏋️", category: "WORKOUT", requirement: { type: "workouts", value: 1 }, xpReward: 50 },
  { slug: "workouts_10", name: "Dedicado", description: "Completa 10 workouts", icon: "💪", category: "WORKOUT", requirement: { type: "workouts", value: 10 }, xpReward: 100 },
  { slug: "workouts_50", name: "Máquina", description: "Completa 50 workouts", icon: "⚡", category: "WORKOUT", requirement: { type: "workouts", value: 50 }, xpReward: 250 },
  { slug: "workouts_100", name: "Centurión", description: "Completa 100 workouts", icon: "🌟", category: "WORKOUT", requirement: { type: "workouts", value: 100 }, xpReward: 500 },
  { slug: "workouts_365", name: "Leyenda", description: "Completa 365 workouts", icon: "👑", category: "WORKOUT", requirement: { type: "workouts", value: 365 }, xpReward: 1000 },
  { slug: "volume_1000", name: "Una Tonelada", description: "Mueve 1,000 kg de volumen total", icon: "🏗️", category: "WORKOUT", requirement: { type: "volume", value: 1000 }, xpReward: 100 },
  { slug: "volume_10000", name: "Titan", description: "Mueve 10,000 kg de volumen total", icon: "🗿", category: "WORKOUT", requirement: { type: "volume", value: 10000 }, xpReward: 300 },
  { slug: "volume_100000", name: "Hércules", description: "Mueve 100,000 kg de volumen total", icon: "⚔️", category: "WORKOUT", requirement: { type: "volume", value: 100000 }, xpReward: 1000 },

  // STREAK
  { slug: "streak_3", name: "En Racha", description: "Entrena 3 días seguidos", icon: "🔥", category: "STREAK", requirement: { type: "streak", value: 3 }, xpReward: 50 },
  { slug: "streak_7", name: "Semana Perfecta", description: "Entrena 7 días seguidos", icon: "🔥", category: "STREAK", requirement: { type: "streak", value: 7 }, xpReward: 100 },
  { slug: "streak_30", name: "Mes Imparable", description: "Entrena 30 días seguidos", icon: "🔥", category: "STREAK", requirement: { type: "streak", value: 30 }, xpReward: 500 },
  { slug: "streak_100", name: "Inquebrantable", description: "Entrena 100 días seguidos", icon: "💎", category: "STREAK", requirement: { type: "streak", value: 100 }, xpReward: 2000 },

  // SOCIAL
  { slug: "first_post", name: "Voz", description: "Publica tu primer post", icon: "📢", category: "SOCIAL", requirement: { type: "posts", value: 1 }, xpReward: 25 },
  { slug: "posts_10", name: "Influencer", description: "Publica 10 posts", icon: "📱", category: "SOCIAL", requirement: { type: "posts", value: 10 }, xpReward: 100 },
  { slug: "followers_10", name: "Popular", description: "Consigue 10 seguidores", icon: "👥", category: "SOCIAL", requirement: { type: "followers", value: 10 }, xpReward: 100 },
  { slug: "followers_100", name: "Celebridad", description: "Consigue 100 seguidores", icon: "⭐", category: "SOCIAL", requirement: { type: "followers", value: 100 }, xpReward: 500 },

  // PR
  { slug: "first_pr", name: "Récord", description: "Consigue tu primer PR", icon: "🏆", category: "MILESTONE", requirement: { type: "prs", value: 1 }, xpReward: 50 },
  { slug: "prs_10", name: "Rompelímites", description: "Consigue 10 PRs", icon: "🎯", category: "MILESTONE", requirement: { type: "prs", value: 10 }, xpReward: 200 },

  // CHALLENGES
  { slug: "first_challenge", name: "Retador", description: "Completa tu primer challenge", icon: "🤝", category: "CHALLENGE", requirement: { type: "challenges_completed", value: 1 }, xpReward: 75 },
  { slug: "challenge_winner", name: "Campeón", description: "Gana un challenge", icon: "🥇", category: "CHALLENGE", requirement: { type: "challenges_won", value: 1 }, xpReward: 200 },

  // NUTRITION
  { slug: "first_log", name: "Consciente", description: "Registra tu primera comida", icon: "🥗", category: "NUTRITION", requirement: { type: "food_entries", value: 1 }, xpReward: 25 },
  { slug: "logs_7_days", name: "Disciplina", description: "Registra comida 7 días seguidos", icon: "📊", category: "NUTRITION", requirement: { type: "food_log_streak", value: 7 }, xpReward: 150 },

  // LEVELS
  { slug: "level_5", name: "Nivel 5", description: "Alcanza el nivel 5", icon: "🎮", category: "MILESTONE", requirement: { type: "level", value: 5 }, xpReward: 100 },
  { slug: "level_10", name: "Veterano", description: "Alcanza el nivel 10", icon: "🎖️", category: "MILESTONE", requirement: { type: "level", value: 10 }, xpReward: 300 },
  { slug: "level_25", name: "Élite", description: "Alcanza el nivel 25", icon: "💫", category: "MILESTONE", requirement: { type: "level", value: 25 }, xpReward: 1000 },
]

// ═══════════════════════════════════════════════════════
// POST /api/badges/seed — Crear badges en la DB
// (llamar una vez al hacer deploy)
// ═══════════════════════════════════════════════════════
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    let created = 0
    for (const badge of BADGE_DEFINITIONS) {
      await prisma.badge.upsert({
        where: { slug: badge.slug },
        update: { name: badge.name, description: badge.description, icon: badge.icon, xpReward: badge.xpReward },
        create: badge as any,
      })
      created++
    }
    res.json({ message: `${created} badges sincronizados` })
  } catch (error) {
    console.error("Badge seed error:", error)
    res.status(500).json({ error: "Error al crear badges" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/badges — Todos los badges + cuáles tengo
// ═══════════════════════════════════════════════════════
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const allBadges = await prisma.badge.findMany({
      orderBy: [{ category: "asc" }, { xpReward: "asc" }],
    })

    const myBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true, earnedAt: true },
    })

    const myBadgeMap = new Map(myBadges.map((b) => [b.badgeId, b.earnedAt]))

    const badgesWithStatus = allBadges.map((badge) => ({
      ...badge,
      earned: myBadgeMap.has(badge.id),
      earnedAt: myBadgeMap.get(badge.id) || null,
    }))

    // Agrupar por categoría
    const grouped: Record<string, typeof badgesWithStatus> = {}
    for (const badge of badgesWithStatus) {
      if (!grouped[badge.category]) grouped[badge.category] = []
      grouped[badge.category].push(badge)
    }

    res.json({
      badges: badgesWithStatus,
      grouped,
      earned: myBadges.length,
      total: allBadges.length,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener badges" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/badges/check — Verificar y otorgar badges
// (llamar después de cada workout, post, etc.)
// ═══════════════════════════════════════════════════════
router.post("/check", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Obtener stats del usuario
    const totalWorkouts = await prisma.workout.count({
      where: { userId: user.id, isCompleted: true },
    })
    const volumeResult = await prisma.workout.aggregate({
      where: { userId: user.id, isCompleted: true },
      _sum: { totalVolume: true },
    })
    const totalVolume = volumeResult._sum.totalVolume || 0
    const totalPRs = await prisma.personalRecord.count({ where: { userId: user.id } })
    const totalPosts = await prisma.post.count({ where: { userId: user.id } })
    const totalFollowers = await prisma.follow.count({ where: { followingId: user.id } })
    const challengesWon = await prisma.challengeParticipant.count({
      where: { userId: user.id, isWinner: true },
    })
    const foodEntries = await prisma.foodEntry.count({
      where: { foodLog: { userId: user.id } },
    })

    // Calcular level
    let level = 1
    let xpForNext = 500
    let xpUsed = 0
    while (user.xp >= xpUsed + xpForNext) {
      xpUsed += xpForNext; level++; xpForNext = Math.floor(xpForNext * 1.4)
    }

    // Mapa de stats
    const statsMap: Record<string, number> = {
      workouts: totalWorkouts,
      volume: totalVolume,
      streak: user.streak,
      posts: totalPosts,
      followers: totalFollowers,
      prs: totalPRs,
      challenges_won: challengesWon,
      food_entries: foodEntries,
      level,
    }

    // Badges que ya tiene
    const existingBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true },
    })
    const existingBadgeIds = new Set(existingBadges.map((b) => b.badgeId))

    // Todos los badges
    const allBadges = await prisma.badge.findMany()

    // Verificar cuáles merece
    const newBadges: string[] = []
    let totalXpEarned = 0

    for (const badge of allBadges) {
      if (existingBadgeIds.has(badge.id)) continue

      const req = badge.requirement as { type: string; value: number }
      const currentVal = statsMap[req.type] || 0

      if (currentVal >= req.value) {
        // Otorgar badge
        await prisma.userBadge.create({
          data: { userId: user.id, badgeId: badge.id },
        })

        // XP reward
        await prisma.user.update({
          where: { id: user.id },
          data: { xp: { increment: badge.xpReward } },
        })

        totalXpEarned += badge.xpReward
        newBadges.push(badge.slug)

        // Notificación in-app + push
        const badgeTitle = `¡Nuevo logro: ${badge.name}! ${badge.icon}`
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "badge",
            title: badgeTitle,
            body: badge.description,
            data: { badgeId: badge.id, slug: badge.slug },
          },
        })
        sendPushToUser(user.id, badgeTitle, badge.description, { type: "badge", badgeId: badge.id })
      }
    }

    res.json({
      newBadges,
      xpEarned: totalXpEarned,
      totalBadges: existingBadges.length + newBadges.length,
    })
  } catch (error) {
    console.error("Badge check error:", error)
    res.status(500).json({ error: "Error al verificar badges" })
  }
})

export default router