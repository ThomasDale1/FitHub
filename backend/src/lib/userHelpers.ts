// ─────────────────────────────────────────────────────
// backend/src/lib/userHelpers.ts
// Shared helpers: level calculation, streak, formatting
// ─────────────────────────────────────────────────────
import { prisma } from "./prisma.js"

// ─── XP → Level calculation ──────────────────────────
export function calculateLevel(xp: number): { level: number; currentXP: number; maxXP: number } {
  let level = 1
  let xpForNextLevel = 500
  let totalXpUsed = 0

  while (xp >= totalXpUsed + xpForNextLevel) {
    totalXpUsed += xpForNextLevel
    level++
    xpForNextLevel = Math.floor(xpForNextLevel * 1.4)
  }

  return {
    level,
    currentXP: xp - totalXpUsed,
    maxXP: xpForNextLevel,
  }
}

// ─── Streak calculation ──────────────────────────────
export async function calculateStreak(userId: string): Promise<number> {
  const workouts = await prisma.workout.findMany({
    where: { userId, isCompleted: true },
    select: { startTime: true },
    orderBy: { startTime: "desc" },
    take: 90,
  })

  if (workouts.length === 0) return 0

  const workoutDates = new Set(
    workouts.map((w) => w.startTime.toISOString().split("T")[0])
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let streak = 0
  const checkDate = new Date(today)

  const todayStr = checkDate.toISOString().split("T")[0]
  checkDate.setDate(checkDate.getDate() - 1)
  const yesterdayStr = checkDate.toISOString().split("T")[0]

  if (!workoutDates.has(todayStr) && !workoutDates.has(yesterdayStr)) {
    return 0
  }

  if (!workoutDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate())
  } else {
    checkDate.setTime(today.getTime())
  }

  while (workoutDates.has(checkDate.toISOString().split("T")[0])) {
    streak++
    checkDate.setDate(checkDate.getDate() - 1)
  }

  return streak
}

// ─── Update bestStreak if current is higher ──────────
export async function updateBestStreak(userId: string, currentStreak: number) {
  await prisma.user.updateMany({
    where: { id: userId, bestStreak: { lt: currentStreak } },
    data: { bestStreak: currentStreak },
  })
}
