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
// clientDate: YYYY-MM-DD from the client's local timezone. If omitted, uses UTC server date.
export async function calculateStreak(userId: string, clientDate?: string): Promise<number> {
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

  // Use client's local date if provided; otherwise fall back to UTC server date
  const todayStr = clientDate ?? new Date().toISOString().split("T")[0]
  const today = new Date(todayStr + "T00:00:00.000Z")

  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const yesterdayStr = yesterday.toISOString().split("T")[0]

  if (!workoutDates.has(todayStr) && !workoutDates.has(yesterdayStr)) {
    return 0
  }

  // Start counting from today if it has a workout, otherwise from yesterday
  const checkDate = workoutDates.has(todayStr) ? new Date(today) : new Date(yesterday)

  let streak = 0
  while (workoutDates.has(checkDate.toISOString().split("T")[0])) {
    streak++
    checkDate.setUTCDate(checkDate.getUTCDate() - 1)
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
