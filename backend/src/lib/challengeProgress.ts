// ─────────────────────────────────────────────────────
// Challenge Auto-Progress
// Actualiza automáticamente el progreso de los challenges
// cuando un usuario completa un workout o sincroniza pasos
// ─────────────────────────────────────────────────────
import { prisma } from "./prisma.js"
import { sendPushToUser } from "./pushNotifications.js"

type ProgressContext = {
  userId: string
  // Datos del workout (si viene de workout finish)
  workout?: {
    totalVolume: number
    newPRs: number
    durationMinutes: number
  }
  // Viene de steps sync
  steps?: {
    totalDistanceKm: number
  }
}

/**
 * Actualiza el progreso de todos los challenges activos del usuario.
 * Se llama después de workout finish y steps sync.
 */
export async function updateChallengeProgress(ctx: ProgressContext) {
  try {
    const now = new Date()

    // Obtener todos los challenges activos donde el usuario participa
    const participations = await prisma.challengeParticipant.findMany({
      where: {
        userId: ctx.userId,
        challenge: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      include: {
        challenge: true,
      },
    })

    if (participations.length === 0) return

    for (const participation of participations) {
      const challenge = participation.challenge
      let newValue: number | null = null

      switch (challenge.type) {
        case "VOLUME":
          // Sumar totalVolume de todos los workouts del usuario durante el challenge
          newValue = await calcVolume(ctx.userId, challenge.startDate, now)
          break

        case "FREQUENCY":
          // Contar workouts completados durante el challenge
          newValue = await calcFrequency(ctx.userId, challenge.startDate, now)
          break

        case "STREAK":
          // Streak actual del usuario
          newValue = await calcStreak(ctx.userId)
          break

        case "PR":
          // Contar PRs logrados durante el challenge
          newValue = await calcPRs(ctx.userId, challenge.startDate, now)
          break

        case "DISTANCE":
          // Sumar distancia de steps durante el challenge
          newValue = await calcDistance(ctx.userId, challenge.startDate, now)
          break

        case "CUSTOM":
          // Custom no se auto-actualiza
          continue
      }

      if (newValue === null || newValue === participation.currentValue) continue

      // Actualizar progreso
      await prisma.challengeParticipant.update({
        where: { id: participation.id },
        data: { currentValue: newValue },
      })

      // ¿Completó el challenge?
      if (newValue >= challenge.goal && !participation.isWinner) {
        await handleChallengeCompletion(ctx.userId, participation.id, challenge)
      }
    }
  } catch (error) {
    // Non-blocking — no debe fallar el workout/steps
    console.error("Challenge auto-progress error:", error)
  }
}

// ─── Cálculos por tipo ──────────────────────────────

async function calcVolume(userId: string, since: Date, until: Date): Promise<number> {
  const result = await prisma.workout.aggregate({
    where: {
      userId,
      isCompleted: true,
      endTime: { gte: since, lte: until },
    },
    _sum: { totalVolume: true },
  })
  return Math.round(result._sum.totalVolume ?? 0)
}

async function calcFrequency(userId: string, since: Date, until: Date): Promise<number> {
  return prisma.workout.count({
    where: {
      userId,
      isCompleted: true,
      endTime: { gte: since, lte: until },
    },
  })
}

async function calcStreak(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { streak: true },
  })
  return user?.streak ?? 0
}

async function calcPRs(userId: string, since: Date, until: Date): Promise<number> {
  return prisma.personalRecord.count({
    where: {
      userId,
      achievedAt: { gte: since, lte: until },
    },
  })
}

async function calcDistance(userId: string, since: Date, until: Date): Promise<number> {
  const result = await prisma.dailySteps.aggregate({
    where: {
      userId,
      date: { gte: since, lte: until },
    },
    _sum: { distanceKm: true },
  })
  return Math.round((result._sum.distanceKm ?? 0) * 100) / 100
}

// ─── Completar challenge ────────────────────────────

async function handleChallengeCompletion(
  userId: string,
  participationId: string,
  challenge: { id: string; title: string; xpReward: number }
) {
  // Marcar como ganador
  await prisma.challengeParticipant.update({
    where: { id: participationId },
    data: { isWinner: true },
  })

  // Dar XP reward
  await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: challenge.xpReward } },
  })

  // Crear notificación
  const title = `🏆 ¡Completaste "${challenge.title}"!`
  const body = `+${challenge.xpReward} XP ganados`

  await prisma.notification.create({
    data: {
      userId,
      type: "challenge_complete",
      title,
      data: { challengeId: challenge.id, xpReward: challenge.xpReward },
    },
  })

  // Push notification
  sendPushToUser(userId, title, body, {
    type: "challenge_complete",
    challengeId: challenge.id,
  })

  // Verificar si todos completaron → marcar challenge como COMPLETED
  const totalParticipants = await prisma.challengeParticipant.count({
    where: { challengeId: challenge.id },
  })
  const totalWinners = await prisma.challengeParticipant.count({
    where: { challengeId: challenge.id, isWinner: true },
  })

  if (totalWinners === totalParticipants) {
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: "COMPLETED" },
    })
  }
}
