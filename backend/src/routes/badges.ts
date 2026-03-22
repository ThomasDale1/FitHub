// ─────────────────────────────────────────────────────
// backend/src/routes/badges.ts
// Sprint 1 – Feature: Badges / Achievements system
// Gamification: rarity tiers, progress tracking,
// featured badge, secret badges, unlock notifications
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

// ─── Badge definitions ────────────────────────────────
// rarity: COMMON | RARE | EPIC | LEGENDARY
// isSecret: hidden until unlocked
const BADGE_DEFINITIONS = [
  // ═══ WORKOUT ═══════════════════════════════════════
  { slug: "first_workout", name: "First Rep", description: "Completa tu primer workout", icon: "💪", category: "WORKOUT", rarity: "COMMON", requirement: { type: "workouts", value: 1 }, xpReward: 50, sortOrder: 1 },
  { slug: "workouts_10", name: "Getting Serious", description: "Completa 10 workouts", icon: "🏋️", category: "WORKOUT", rarity: "COMMON", requirement: { type: "workouts", value: 10 }, xpReward: 100, sortOrder: 2 },
  { slug: "workouts_25", name: "Quarter Century", description: "Completa 25 workouts", icon: "🔥", category: "WORKOUT", rarity: "RARE", requirement: { type: "workouts", value: 25 }, xpReward: 200, sortOrder: 3 },
  { slug: "workouts_50", name: "Half Century", description: "Completa 50 workouts", icon: "⚡", category: "WORKOUT", rarity: "RARE", requirement: { type: "workouts", value: 50 }, xpReward: 400, sortOrder: 4 },
  { slug: "workouts_100", name: "Centurion", description: "Completa 100 workouts", icon: "🛡️", category: "WORKOUT", rarity: "EPIC", requirement: { type: "workouts", value: 100 }, xpReward: 800, sortOrder: 5 },
  { slug: "workouts_250", name: "Iron Addict", description: "Completa 250 workouts", icon: "⚔️", category: "WORKOUT", rarity: "EPIC", requirement: { type: "workouts", value: 250 }, xpReward: 1500, sortOrder: 6 },
  { slug: "workouts_500", name: "Living Legend", description: "Completa 500 workouts", icon: "👑", category: "WORKOUT", rarity: "LEGENDARY", requirement: { type: "workouts", value: 500 }, xpReward: 3000, sortOrder: 7 },
  { slug: "workouts_1000", name: "Immortal", description: "Completa 1000 workouts", icon: "🌟", category: "WORKOUT", rarity: "LEGENDARY", requirement: { type: "workouts", value: 1000 }, xpReward: 5000, sortOrder: 8 },

  // ═══ VOLUME ════════════════════════════════════════
  { slug: "volume_1000", name: "Ton Lifter", description: "Mueve 1,000 kg de volumen total", icon: "🪨", category: "VOLUME", rarity: "COMMON", requirement: { type: "volume", value: 1000 }, xpReward: 75, sortOrder: 1 },
  { slug: "volume_10000", name: "Steel Crusher", description: "Mueve 10,000 kg de volumen total", icon: "⛓️", category: "VOLUME", rarity: "RARE", requirement: { type: "volume", value: 10000 }, xpReward: 200, sortOrder: 2 },
  { slug: "volume_50000", name: "Mountain Mover", description: "Mueve 50,000 kg de volumen total", icon: "🏔️", category: "VOLUME", rarity: "RARE", requirement: { type: "volume", value: 50000 }, xpReward: 500, sortOrder: 3 },
  { slug: "volume_100000", name: "Titan", description: "Mueve 100,000 kg de volumen total", icon: "🦾", category: "VOLUME", rarity: "EPIC", requirement: { type: "volume", value: 100000 }, xpReward: 1000, sortOrder: 4 },
  { slug: "volume_500000", name: "Demigod", description: "Mueve 500,000 kg de volumen total", icon: "⚡", category: "VOLUME", rarity: "LEGENDARY", requirement: { type: "volume", value: 500000 }, xpReward: 3000, sortOrder: 5 },
  { slug: "volume_1000000", name: "Million Pound Club", description: "Mueve 1,000,000 kg de volumen total", icon: "💎", category: "VOLUME", rarity: "LEGENDARY", requirement: { type: "volume", value: 1000000 }, xpReward: 5000, sortOrder: 6 },

  // ═══ STREAK ════════════════════════════════════════
  { slug: "streak_3", name: "On Fire", description: "Entrena 3 días seguidos", icon: "🔥", category: "STREAK", rarity: "COMMON", requirement: { type: "streak", value: 3 }, xpReward: 50, sortOrder: 1 },
  { slug: "streak_7", name: "Week Warrior", description: "Entrena 7 días seguidos", icon: "📅", category: "STREAK", rarity: "COMMON", requirement: { type: "streak", value: 7 }, xpReward: 100, sortOrder: 2 },
  { slug: "streak_14", name: "Unstoppable", description: "Entrena 14 días seguidos", icon: "💥", category: "STREAK", rarity: "RARE", requirement: { type: "streak", value: 14 }, xpReward: 250, sortOrder: 3 },
  { slug: "streak_30", name: "Iron Will", description: "Entrena 30 días seguidos", icon: "🧠", category: "STREAK", rarity: "RARE", requirement: { type: "streak", value: 30 }, xpReward: 500, sortOrder: 4 },
  { slug: "streak_60", name: "Discipline Machine", description: "Entrena 60 días seguidos", icon: "⚙️", category: "STREAK", rarity: "EPIC", requirement: { type: "streak", value: 60 }, xpReward: 1000, sortOrder: 5 },
  { slug: "streak_100", name: "Centurion Streak", description: "Entrena 100 días seguidos", icon: "🏛️", category: "STREAK", rarity: "EPIC", requirement: { type: "streak", value: 100 }, xpReward: 2000, sortOrder: 6 },
  { slug: "streak_365", name: "Year of Iron", description: "Entrena 365 días seguidos", icon: "🏆", category: "STREAK", rarity: "LEGENDARY", requirement: { type: "streak", value: 365 }, xpReward: 5000, sortOrder: 7 },

  // ═══ STEPS ═════════════════════════════════════════
  { slug: "steps_10k_day", name: "10K Walker", description: "Alcanza 10,000 pasos en un día", icon: "👟", category: "STEPS", rarity: "COMMON", requirement: { type: "max_steps_day", value: 10000 }, xpReward: 50, sortOrder: 1 },
  { slug: "steps_20k_day", name: "Marathon Walker", description: "Alcanza 20,000 pasos en un día", icon: "🚶", category: "STEPS", rarity: "RARE", requirement: { type: "max_steps_day", value: 20000 }, xpReward: 150, sortOrder: 2 },
  { slug: "steps_50k_day", name: "Ultra Walker", description: "Alcanza 50,000 pasos en un día", icon: "🦶", category: "STEPS", rarity: "EPIC", requirement: { type: "max_steps_day", value: 50000 }, xpReward: 500, sortOrder: 3 },
  { slug: "steps_7_streak", name: "Step Streak 7", description: "Cumple tu meta de pasos 7 días seguidos", icon: "📊", category: "STEPS", rarity: "RARE", requirement: { type: "step_goal_streak", value: 7 }, xpReward: 200, sortOrder: 4 },
  { slug: "steps_30_streak", name: "Step Streak 30", description: "Cumple tu meta de pasos 30 días seguidos", icon: "🗓️", category: "STEPS", rarity: "EPIC", requirement: { type: "step_goal_streak", value: 30 }, xpReward: 800, sortOrder: 5 },
  { slug: "steps_total_1m", name: "Million Stepper", description: "Acumula 1,000,000 pasos en total", icon: "🌍", category: "STEPS", rarity: "EPIC", requirement: { type: "total_steps", value: 1000000 }, xpReward: 1000, sortOrder: 6 },
  { slug: "steps_total_10m", name: "Globe Trotter", description: "Acumula 10,000,000 pasos en total", icon: "🌎", category: "STEPS", rarity: "LEGENDARY", requirement: { type: "total_steps", value: 10000000 }, xpReward: 3000, sortOrder: 7 },

  // ═══ SOCIAL ════════════════════════════════════════
  { slug: "first_post", name: "First Words", description: "Publica tu primer post", icon: "💬", category: "SOCIAL", rarity: "COMMON", requirement: { type: "posts", value: 1 }, xpReward: 25, sortOrder: 1 },
  { slug: "posts_10", name: "Content Creator", description: "Publica 10 posts", icon: "📝", category: "SOCIAL", rarity: "COMMON", requirement: { type: "posts", value: 10 }, xpReward: 100, sortOrder: 2 },
  { slug: "posts_50", name: "Influencer", description: "Publica 50 posts", icon: "📣", category: "SOCIAL", rarity: "RARE", requirement: { type: "posts", value: 50 }, xpReward: 300, sortOrder: 3 },
  { slug: "followers_10", name: "Rising Star", description: "Consigue 10 seguidores", icon: "⭐", category: "SOCIAL", rarity: "COMMON", requirement: { type: "followers", value: 10 }, xpReward: 100, sortOrder: 4 },
  { slug: "followers_50", name: "Popular", description: "Consigue 50 seguidores", icon: "🌟", category: "SOCIAL", rarity: "RARE", requirement: { type: "followers", value: 50 }, xpReward: 300, sortOrder: 5 },
  { slug: "followers_100", name: "Celebrity", description: "Consigue 100 seguidores", icon: "👑", category: "SOCIAL", rarity: "EPIC", requirement: { type: "followers", value: 100 }, xpReward: 750, sortOrder: 6 },
  { slug: "followers_500", name: "FitHub Famous", description: "Consigue 500 seguidores", icon: "💫", category: "SOCIAL", rarity: "LEGENDARY", requirement: { type: "followers", value: 500 }, xpReward: 2000, sortOrder: 7 },
  { slug: "reactions_100", name: "Crowd Pleaser", description: "Recibe 100 reacciones en total", icon: "❤️‍🔥", category: "SOCIAL", rarity: "RARE", requirement: { type: "reactions_received", value: 100 }, xpReward: 200, sortOrder: 8 },
  { slug: "reactions_1000", name: "Viral", description: "Recibe 1000 reacciones en total", icon: "🚀", category: "SOCIAL", rarity: "EPIC", requirement: { type: "reactions_received", value: 1000 }, xpReward: 800, sortOrder: 9 },

  // ═══ PR (Personal Records) ═════════════════════════
  { slug: "first_pr", name: "Record Breaker", description: "Consigue tu primer PR", icon: "📈", category: "PR", rarity: "COMMON", requirement: { type: "prs", value: 1 }, xpReward: 50, sortOrder: 1 },
  { slug: "prs_10", name: "PR Machine", description: "Consigue 10 PRs", icon: "💪", category: "PR", rarity: "RARE", requirement: { type: "prs", value: 10 }, xpReward: 200, sortOrder: 2 },
  { slug: "prs_25", name: "Beast Mode", description: "Consigue 25 PRs", icon: "🦁", category: "PR", rarity: "RARE", requirement: { type: "prs", value: 25 }, xpReward: 400, sortOrder: 3 },
  { slug: "prs_50", name: "Limit Breaker", description: "Consigue 50 PRs", icon: "🔓", category: "PR", rarity: "EPIC", requirement: { type: "prs", value: 50 }, xpReward: 800, sortOrder: 4 },
  { slug: "prs_100", name: "Untouchable", description: "Consigue 100 PRs", icon: "💎", category: "PR", rarity: "LEGENDARY", requirement: { type: "prs", value: 100 }, xpReward: 2000, sortOrder: 5 },

  // ═══ CHALLENGE ═════════════════════════════════════
  { slug: "first_challenge", name: "Challenger", description: "Únete a tu primer reto", icon: "🎯", category: "CHALLENGE", rarity: "COMMON", requirement: { type: "challenges_joined", value: 1 }, xpReward: 75, sortOrder: 1 },
  { slug: "challenge_winner", name: "Victor", description: "Gana un reto", icon: "🏅", category: "CHALLENGE", rarity: "RARE", requirement: { type: "challenges_won", value: 1 }, xpReward: 200, sortOrder: 2 },
  { slug: "challenges_won_5", name: "Champion", description: "Gana 5 retos", icon: "🏆", category: "CHALLENGE", rarity: "EPIC", requirement: { type: "challenges_won", value: 5 }, xpReward: 600, sortOrder: 3 },
  { slug: "challenges_won_10", name: "Undefeated", description: "Gana 10 retos", icon: "👊", category: "CHALLENGE", rarity: "EPIC", requirement: { type: "challenges_won", value: 10 }, xpReward: 1000, sortOrder: 4 },
  { slug: "challenges_won_25", name: "Grand Champion", description: "Gana 25 retos", icon: "🥇", category: "CHALLENGE", rarity: "LEGENDARY", requirement: { type: "challenges_won", value: 25 }, xpReward: 2500, sortOrder: 5 },

  // ═══ MILESTONE (Levels / XP) ═══════════════════════
  { slug: "level_5", name: "Apprentice", description: "Alcanza el nivel 5", icon: "🌱", category: "MILESTONE", rarity: "COMMON", requirement: { type: "level", value: 5 }, xpReward: 100, sortOrder: 1 },
  { slug: "level_10", name: "Warrior", description: "Alcanza el nivel 10", icon: "⚔️", category: "MILESTONE", rarity: "RARE", requirement: { type: "level", value: 10 }, xpReward: 300, sortOrder: 2 },
  { slug: "level_25", name: "Master", description: "Alcanza el nivel 25", icon: "🎓", category: "MILESTONE", rarity: "EPIC", requirement: { type: "level", value: 25 }, xpReward: 1000, sortOrder: 3 },
  { slug: "level_50", name: "Grandmaster", description: "Alcanza el nivel 50", icon: "🏰", category: "MILESTONE", rarity: "LEGENDARY", requirement: { type: "level", value: 50 }, xpReward: 3000, sortOrder: 4 },
  { slug: "xp_10000", name: "XP Hoarder", description: "Acumula 10,000 XP", icon: "💰", category: "MILESTONE", rarity: "RARE", requirement: { type: "xp", value: 10000 }, xpReward: 250, sortOrder: 5 },
  { slug: "xp_100000", name: "XP Mogul", description: "Acumula 100,000 XP", icon: "💎", category: "MILESTONE", rarity: "LEGENDARY", requirement: { type: "xp", value: 100000 }, xpReward: 2000, sortOrder: 6 },

  // ═══ NUTRITION ═════════════════════════════════════
  { slug: "first_log", name: "Calorie Counter", description: "Registra tu primera comida", icon: "🍎", category: "NUTRITION", rarity: "COMMON", requirement: { type: "food_entries", value: 1 }, xpReward: 25, sortOrder: 1 },
  { slug: "logs_7_days", name: "Meal Prep Pro", description: "Registra comida 7 días seguidos", icon: "🥗", category: "NUTRITION", rarity: "RARE", requirement: { type: "food_log_streak", value: 7 }, xpReward: 150, sortOrder: 2 },
  { slug: "logs_30_days", name: "Nutrition Master", description: "Registra comida 30 días seguidos", icon: "🏆", category: "NUTRITION", rarity: "EPIC", requirement: { type: "food_log_streak", value: 30 }, xpReward: 500, sortOrder: 3 },
  { slug: "logs_90_days", name: "Diet Champion", description: "Registra comida 90 días seguidos", icon: "👨‍🍳", category: "NUTRITION", rarity: "LEGENDARY", requirement: { type: "food_log_streak", value: 90 }, xpReward: 1500, sortOrder: 4 },

  // ═══ SECRET (hidden until unlocked) ════════════════
  { slug: "midnight_warrior", name: "Midnight Warrior", description: "Completa un workout entre 12am y 4am", icon: "🌙", category: "SECRET", rarity: "RARE", requirement: { type: "midnight_workout", value: 1 }, xpReward: 150, isSecret: true, sortOrder: 1 },
  { slug: "early_bird", name: "Early Bird", description: "Completa un workout antes de las 6am", icon: "🌅", category: "SECRET", rarity: "RARE", requirement: { type: "early_workout", value: 1 }, xpReward: 150, isSecret: true, sortOrder: 2 },
  { slug: "double_day", name: "Double Day", description: "Completa 2 workouts en un mismo día", icon: "✌️", category: "SECRET", rarity: "RARE", requirement: { type: "double_day", value: 1 }, xpReward: 200, isSecret: true, sortOrder: 3 },
  { slug: "perfect_week", name: "Perfect Week", description: "Entrena 7 días en una misma semana", icon: "⭐", category: "SECRET", rarity: "EPIC", requirement: { type: "perfect_week", value: 1 }, xpReward: 500, isSecret: true, sortOrder: 4 },
  { slug: "comeback_kid", name: "Comeback Kid", description: "Retoma después de 14+ días sin entrenar", icon: "🔄", category: "SECRET", rarity: "EPIC", requirement: { type: "comeback", value: 1 }, xpReward: 300, isSecret: true, sortOrder: 5 },
  { slug: "social_butterfly", name: "Social Butterfly", description: "Reacciona a 50 posts diferentes", icon: "🦋", category: "SECRET", rarity: "RARE", requirement: { type: "reactions_given", value: 50 }, xpReward: 150, isSecret: true, sortOrder: 6 },
]

// ─── Level calculation (same as users.ts) ─────────────
function calculateLevel(xp: number): number {
  let level = 1
  let xpForNext = 500
  let totalUsed = 0
  while (xp >= totalUsed + xpForNext) {
    totalUsed += xpForNext
    level++
    xpForNext = Math.floor(xpForNext * 1.4)
  }
  return level
}

// ─── Calculate step goal streak ───────────────────────
async function calcStepGoalStreak(userId: string): Promise<number> {
  const days = await prisma.dailySteps.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 365,
    select: { date: true, steps: true, goal: true },
  })
  let streak = 0
  for (const day of days) {
    if (day.steps >= day.goal) streak++
    else break
  }
  return streak
}

// ─── Calculate food log streak ────────────────────────
async function calcFoodLogStreak(userId: string): Promise<number> {
  const logs = await prisma.foodLog.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    take: 365,
    select: { date: true },
  })
  if (logs.length === 0) return 0

  let streak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let i = 0; i < logs.length; i++) {
    const expected = new Date(today)
    expected.setDate(expected.getDate() - i)
    const logDate = new Date(logs[i].date)
    logDate.setHours(0, 0, 0, 0)

    if (logDate.getTime() === expected.getTime()) {
      streak++
    } else {
      break
    }
  }
  return streak
}

// ─── Check secret badge conditions ────────────────────
async function calcSecretStats(userId: string) {
  // Get actual workout times for special checks
  const recentWorkouts = await prisma.workout.findMany({
    where: { userId, isCompleted: true, endTime: { not: null } },
    select: { startTime: true, endTime: true },
    orderBy: { startTime: "desc" },
    take: 500,
  })

  let hasMidnightWorkout = false
  let hasEarlyBirdWorkout = false
  let hasDoubleDay = false
  let hasPerfectWeek = false
  let hasComeback = false

  // Check midnight (12am-4am) and early bird (before 6am)
  for (const w of recentWorkouts) {
    if (w.endTime) {
      const hour = w.endTime.getHours()
      if (hour >= 0 && hour < 4) hasMidnightWorkout = true
      if (hour < 6) hasEarlyBirdWorkout = true
    }
  }

  // Check double day — two workouts same calendar day
  const dayMap = new Map<string, number>()
  for (const w of recentWorkouts) {
    const day = w.startTime.toISOString().split("T")[0]
    dayMap.set(day, (dayMap.get(day) || 0) + 1)
    if ((dayMap.get(day) || 0) >= 2) hasDoubleDay = true
  }

  // Check perfect week — 7 unique days in one Mon-Sun week
  const weekMap = new Map<string, Set<string>>()
  for (const w of recentWorkouts) {
    const d = new Date(w.startTime)
    // Get monday of that week
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const weekKey = monday.toISOString().split("T")[0]
    if (!weekMap.has(weekKey)) weekMap.set(weekKey, new Set())
    weekMap.get(weekKey)!.add(d.toISOString().split("T")[0])
  }
  for (const [, days] of weekMap) {
    if (days.size >= 7) hasPerfectWeek = true
  }

  // Check comeback — workout after 14+ day gap
  if (recentWorkouts.length >= 2) {
    for (let i = 0; i < recentWorkouts.length - 1; i++) {
      const diff = recentWorkouts[i].startTime.getTime() - recentWorkouts[i + 1].startTime.getTime()
      const daysDiff = diff / (1000 * 60 * 60 * 24)
      if (daysDiff >= 14) { hasComeback = true; break }
    }
  }

  // Reactions given (unique posts reacted to)
  const reactionsGiven = await prisma.reaction.count({
    where: { userId },
  })

  return {
    midnight_workout: hasMidnightWorkout ? 1 : 0,
    early_workout: hasEarlyBirdWorkout ? 1 : 0,
    double_day: hasDoubleDay ? 1 : 0,
    perfect_week: hasPerfectWeek ? 1 : 0,
    comeback: hasComeback ? 1 : 0,
    reactions_given: reactionsGiven,
  }
}

// ─── Gather all stats for badge check ─────────────────
async function gatherStats(userId: string, userXp: number, userStreak: number) {
  const [
    workoutCount,
    volumeResult,
    prCount,
    postCount,
    followerCount,
    challengesJoined,
    challengesWon,
    foodEntries,
    maxStepsDay,
    totalStepsResult,
    reactionsReceived,
    stepGoalStreak,
    foodLogStreak,
    secretStats,
  ] = await Promise.all([
    prisma.workout.count({ where: { userId, isCompleted: true } }),
    prisma.workout.aggregate({ where: { userId, isCompleted: true }, _sum: { totalVolume: true } }),
    prisma.personalRecord.count({ where: { userId } }),
    prisma.post.count({ where: { userId } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.challengeParticipant.count({ where: { userId } }),
    prisma.challengeParticipant.count({ where: { userId, isWinner: true } }),
    prisma.foodEntry.count({ where: { foodLog: { userId } } }),
    prisma.dailySteps.findFirst({ where: { userId }, orderBy: { steps: "desc" }, select: { steps: true } }),
    prisma.dailySteps.aggregate({ where: { userId }, _sum: { steps: true } }),
    prisma.reaction.count({ where: { post: { userId } } }),
    calcStepGoalStreak(userId),
    calcFoodLogStreak(userId),
    calcSecretStats(userId),
  ])

  const level = calculateLevel(userXp)

  return {
    workouts: workoutCount,
    volume: volumeResult._sum.totalVolume || 0,
    streak: userStreak,
    posts: postCount,
    followers: followerCount,
    prs: prCount,
    challenges_joined: challengesJoined,
    challenges_won: challengesWon,
    food_entries: foodEntries,
    level,
    xp: userXp,
    max_steps_day: maxStepsDay?.steps || 0,
    total_steps: totalStepsResult._sum.steps || 0,
    step_goal_streak: stepGoalStreak,
    food_log_streak: foodLogStreak,
    reactions_received: reactionsReceived,
    ...secretStats,
  }
}

// ═══════════════════════════════════════════════════════
// POST /api/badges/seed — Crear/actualizar badges en DB
// ═══════════════════════════════════════════════════════
router.post("/seed", async (_req: Request, res: Response) => {
  try {
    let created = 0
    for (const badge of BADGE_DEFINITIONS) {
      await prisma.badge.upsert({
        where: { slug: badge.slug },
        update: {
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category as any,
          rarity: badge.rarity as any,
          xpReward: badge.xpReward,
          isSecret: (badge as any).isSecret || false,
          sortOrder: badge.sortOrder,
          requirement: badge.requirement,
        },
        create: {
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          category: badge.category as any,
          rarity: badge.rarity as any,
          requirement: badge.requirement,
          xpReward: badge.xpReward,
          isSecret: (badge as any).isSecret || false,
          sortOrder: badge.sortOrder,
        },
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
// GET /api/badges — Todos los badges + progreso + stats
// ═══════════════════════════════════════════════════════
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Fetch badges and user badges
    const [allBadges, myBadges, stats] = await Promise.all([
      prisma.badge.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
      prisma.userBadge.findMany({
        where: { userId: user.id },
        select: { badgeId: true, earnedAt: true, isSeen: true },
      }),
      gatherStats(user.id, user.xp, user.streak),
    ])

    const myBadgeMap = new Map(myBadges.map((b) => [b.badgeId, b]))

    // Build badges with progress
    const badgesWithProgress = allBadges.map((badge) => {
      const userBadge = myBadgeMap.get(badge.id)
      const req = badge.requirement as { type: string; value: number }
      const currentVal = (stats as any)[req.type] || 0

      // Secret badges: hide details if not earned
      if (badge.isSecret && !userBadge) {
        return {
          id: badge.id,
          slug: badge.slug,
          name: "???",
          description: "Completa una acción secreta para descubrir este logro",
          icon: "❓",
          category: badge.category,
          rarity: "COMMON" as const,
          xpReward: badge.xpReward,
          isSecret: true,
          earned: false,
          earnedAt: null,
          isSeen: false,
          progress: null,
        }
      }

      return {
        id: badge.id,
        slug: badge.slug,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        rarity: badge.rarity,
        xpReward: badge.xpReward,
        isSecret: badge.isSecret,
        earned: !!userBadge,
        earnedAt: userBadge?.earnedAt || null,
        isSeen: userBadge?.isSeen || false,
        progress: {
          current: Math.min(currentVal, req.value),
          target: req.value,
          percentage: Math.min(100, Math.round((currentVal / req.value) * 100)),
        },
      }
    })

    // Group by category
    const grouped: Record<string, typeof badgesWithProgress> = {}
    for (const badge of badgesWithProgress) {
      const cat = badge.category
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(badge)
    }

    // Stats
    const earned = myBadges.length
    const total = allBadges.length
    const byRarity: Record<string, { total: number; earned: number }> = {}
    for (const badge of allBadges) {
      if (!byRarity[badge.rarity]) byRarity[badge.rarity] = { total: 0, earned: 0 }
      byRarity[badge.rarity].total++
      if (myBadgeMap.has(badge.id)) byRarity[badge.rarity].earned++
    }

    // Near completion (>40% progress, not earned, not secret-hidden)
    const nearCompletion = badgesWithProgress
      .filter((b) => !b.earned && b.progress && b.progress.percentage >= 40)
      .sort((a, b) => (b.progress?.percentage || 0) - (a.progress?.percentage || 0))
      .slice(0, 5)

    // Unseen badges (for unlock animation)
    const unseen = badgesWithProgress.filter((b) => b.earned && !b.isSeen)

    // Featured badge
    let featuredBadge = null
    if (user.featuredBadgeId) {
      const fb = allBadges.find((b) => b.id === user.featuredBadgeId)
      if (fb) {
        featuredBadge = {
          id: fb.id,
          slug: fb.slug,
          name: fb.name,
          icon: fb.icon,
          rarity: fb.rarity,
        }
      }
    }

    res.json({
      badges: badgesWithProgress,
      grouped,
      stats: { total, earned, percentage: Math.round((earned / total) * 100), byRarity },
      nearCompletion,
      unseen,
      featuredBadge,
    })
  } catch (error) {
    console.error("Get badges error:", error)
    res.status(500).json({ error: "Error al obtener badges" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/badges/check — Verificar y otorgar badges
// ═══════════════════════════════════════════════════════
router.post("/check", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const stats = await gatherStats(user.id, user.xp, user.streak)

    // Badges the user already has
    const existingBadges = await prisma.userBadge.findMany({
      where: { userId: user.id },
      select: { badgeId: true },
    })
    const existingIds = new Set(existingBadges.map((b) => b.badgeId))

    // All badge definitions
    const allBadges = await prisma.badge.findMany()

    const newBadges: Array<{
      slug: string; name: string; description: string
      icon: string; rarity: string; xpReward: number; isSecret: boolean
    }> = []
    let totalXpEarned = 0

    for (const badge of allBadges) {
      if (existingIds.has(badge.id)) continue

      const req = badge.requirement as { type: string; value: number }
      const currentVal = (stats as any)[req.type] || 0

      if (currentVal >= req.value) {
        // Award badge
        await prisma.userBadge.create({
          data: { userId: user.id, badgeId: badge.id, isSeen: false },
        })

        // XP reward
        await prisma.user.update({
          where: { id: user.id },
          data: { xp: { increment: badge.xpReward } },
        })

        totalXpEarned += badge.xpReward
        newBadges.push({
          slug: badge.slug,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          rarity: badge.rarity,
          xpReward: badge.xpReward,
          isSecret: badge.isSecret,
        })

        // Notification + push
        const title = `🏆 ¡Nuevo logro: ${badge.name}! ${badge.icon}`
        const body = `${badge.description} (+${badge.xpReward} XP)`
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "badge",
            title,
            body,
            data: { badgeId: badge.id, slug: badge.slug, rarity: badge.rarity },
          },
        })
        sendPushToUser(user.id, title, body, {
          type: "badge",
          badgeId: badge.id,
          slug: badge.slug,
        })

        // Auto-post for EPIC and LEGENDARY badges
        if (badge.rarity === "EPIC" || badge.rarity === "LEGENDARY") {
          try {
            await prisma.post.create({
              data: {
                userId: user.id,
                content: `🏆 Desbloqueé el logro "${badge.name}" ${badge.icon} — ${badge.rarity === "LEGENDARY" ? "LEGENDARIO" : "ÉPICO"}!`,
                postType: "MILESTONE",
                isPublic: true,
              },
            })
          } catch { /* non-blocking */ }
        }
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

// ═══════════════════════════════════════════════════════
// PUT /api/badges/:slug/seen — Marcar badge como visto
// ═══════════════════════════════════════════════════════
router.put("/:slug/seen", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const slug = req.params.slug as string
    const badge = await prisma.badge.findUnique({ where: { slug } })
    if (!badge) { res.status(404).json({ error: "Badge no encontrado" }); return }

    await prisma.userBadge.updateMany({
      where: { userId: user.id, badgeId: badge.id },
      data: { isSeen: true },
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Error al marcar badge como visto" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/badges/featured — Seleccionar badge destacado
// ═══════════════════════════════════════════════════════
router.put("/featured", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { badgeSlug } = req.body

    // Allow clearing featured badge
    if (!badgeSlug) {
      await prisma.user.update({
        where: { id: user.id },
        data: { featuredBadgeId: null },
      })
      res.json({ success: true, featuredBadge: null })
      return
    }

    // Verify badge exists and user has earned it
    const badge = await prisma.badge.findUnique({ where: { slug: badgeSlug } })
    if (!badge) { res.status(404).json({ error: "Badge no encontrado" }); return }

    const userBadge = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId: user.id, badgeId: badge.id } },
    })
    if (!userBadge) {
      res.status(403).json({ error: "No has desbloqueado este badge" })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { featuredBadgeId: badge.id },
    })

    res.json({
      success: true,
      featuredBadge: {
        id: badge.id,
        slug: badge.slug,
        name: badge.name,
        icon: badge.icon,
        rarity: badge.rarity,
      },
    })
  } catch (error) {
    res.status(500).json({ error: "Error al seleccionar badge destacado" })
  }
})

// ═══════════════════════════════════════════════════════
// Exported helper for internal use (e.g., after workout)
// ═══════════════════════════════════════════════════════
export async function checkBadgesForUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { newBadges: [], xpEarned: 0 }

  const stats = await gatherStats(userId, user.xp, user.streak)

  const existingBadges = await prisma.userBadge.findMany({
    where: { userId },
    select: { badgeId: true },
  })
  const existingIds = new Set(existingBadges.map((b) => b.badgeId))

  const allBadges = await prisma.badge.findMany()
  const newBadges: Array<{ slug: string; name: string; rarity: string; xpReward: number }> = []
  let totalXpEarned = 0

  for (const badge of allBadges) {
    if (existingIds.has(badge.id)) continue

    const req = badge.requirement as { type: string; value: number }
    const currentVal = (stats as any)[req.type] || 0

    if (currentVal >= req.value) {
      await prisma.userBadge.create({
        data: { userId, badgeId: badge.id, isSeen: false },
      })
      await prisma.user.update({
        where: { id: userId },
        data: { xp: { increment: badge.xpReward } },
      })
      totalXpEarned += badge.xpReward
      newBadges.push({ slug: badge.slug, name: badge.name, rarity: badge.rarity, xpReward: badge.xpReward })

      const title = `🏆 ¡Nuevo logro: ${badge.name}! ${badge.icon}`
      const body = `${badge.description} (+${badge.xpReward} XP)`
      await prisma.notification.create({
        data: { userId, type: "badge", title, body, data: { badgeId: badge.id, slug: badge.slug, rarity: badge.rarity } },
      })
      sendPushToUser(userId, title, body, { type: "badge", badgeId: badge.id, slug: badge.slug })

      if (badge.rarity === "EPIC" || badge.rarity === "LEGENDARY") {
        try {
          await prisma.post.create({
            data: {
              userId,
              content: `🏆 Desbloqueé el logro "${badge.name}" ${badge.icon} — ${badge.rarity === "LEGENDARY" ? "LEGENDARIO" : "ÉPICO"}!`,
              postType: "MILESTONE",
              isPublic: true,
            },
          })
        } catch { /* non-blocking */ }
      }
    }
  }

  return { newBadges, xpEarned: totalXpEarned }
}

export default router
