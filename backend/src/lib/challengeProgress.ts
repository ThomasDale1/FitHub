// ─────────────────────────────────────────────────────
// Challenge Auto-Progress + Auto-Completion
//
// Dos modos de challenge:
// - MILESTONE: carrera — el primero que llega al goal gana,
//   el challenge cierra inmediatamente
// - TIMED: competencia — corre hasta endDate, el mejor
//   puntaje gana al finalizar el tiempo
// ─────────────────────────────────────────────────────
import { prisma } from "./prisma.js"
import type { Prisma } from "../generated/prisma/client.js"
import { sendPushToUser, sendPushToMany } from "./pushNotifications.js"

// XP fractions awarded on challenge completion
const PARTICIPATION_XP_RATIO = 0.25  // 25% XP for non-winners who participated
const MIN_XP_RATIO = 0.1             // 10% XP minimum for any progress in TIMED mode

type ProgressContext = {
  userId: string
  workout?: {
    totalVolume: number
    newPRs: number
    durationMinutes: number
  }
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

    const participations = await prisma.challengeParticipant.findMany({
      where: {
        userId: ctx.userId,
        challenge: {
          status: "ACTIVE",
          startDate: { lte: now },
          endDate: { gte: now },
        },
      },
      include: { challenge: true },
    })

    if (participations.length === 0) return

    // Calculate all progress values concurrently — each is an independent DB query
    const newValues = await Promise.all(
      participations.map(async (participation) => {
        const challenge = participation.challenge
        switch (challenge.type) {
          case "VOLUME":            return calcVolume(ctx.userId, challenge.startDate, now)
          case "FREQUENCY":         return calcFrequency(ctx.userId, challenge.startDate, now)
          case "STREAK":            return calcStreak(ctx.userId)
          case "PR":                return calcPRs(ctx.userId, challenge.startDate, now)
          case "DISTANCE":          return calcDistance(ctx.userId, challenge.startDate, now)
          case "SLEEP_STREAK":      return calcSleepStreak(ctx.userId, challenge.startDate, now)
          case "MOOD_STREAK":       return calcMoodStreak(ctx.userId, challenge.startDate, now)
          case "BREATHING_MINUTES": return calcBreathingMinutes(ctx.userId, challenge.startDate, now)
          case "READINESS_AVG":     return calcReadinessAvg(ctx.userId, challenge.startDate, now)
          case "CUSTOM":            return null
          default:
            console.warn(`Unknown challenge type: ${challenge.type}`)
            return null
        }
      })
    )

    for (let i = 0; i < participations.length; i++) {
      const participation = participations[i]
      const challenge = participation.challenge
      const newValue = newValues[i]

      if (newValue === null || newValue === participation.currentValue) continue

      // Actualizar progreso
      await prisma.challengeParticipant.update({
        where: { id: participation.id },
        data: { currentValue: newValue },
      })

      // ─── MILESTONE MODE: el primero que llega al goal gana ───
      // Usa transacción serializable para evitar que dos usuarios
      // pasen el guard simultáneamente y ambos "ganen".
      if (challenge.mode === "MILESTONE" && newValue >= challenge.goal && !participation.isWinner) {
        await prisma.$transaction(async (tx) => {
          // Re-check dentro de la transacción — si otro request ya ganó, el challenge
          // estará COMPLETED y/o el participante ya tendrá isWinner = true.
          const freshChallenge = await tx.challenge.findUnique({
            where: { id: challenge.id },
            select: { status: true },
          })
          if (freshChallenge?.status !== "ACTIVE") return

          const freshParticipation = await tx.challengeParticipant.findUnique({
            where: { id: participation.id },
            select: { isWinner: true },
          })
          if (freshParticipation?.isWinner) return

          await handleMilestoneWin(tx, ctx.userId, participation.id, challenge)
        }, { isolationLevel: "Serializable" })
      }
      // TIMED mode: no hace nada aquí, se resuelve al expirar
    }
  } catch (error) {
    console.error("Challenge auto-progress error:", error)
  }
}

/**
 * Finaliza challenges TIMED que ya expiraron.
 * Debe llamarse periódicamente (cron o al cargar challenges).
 */
export async function finalizeExpiredChallenges() {
  try {
    const now = new Date()

    // Buscar challenges TIMED activos cuyo endDate ya pasó
    const expiredChallenges = await prisma.challenge.findMany({
      where: {
        status: "ACTIVE",
        mode: "TIMED",
        endDate: { lt: now },
      },
      include: {
        participants: {
          orderBy: { currentValue: "desc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    })

    for (const challenge of expiredChallenges) {
      await resolveTimedChallenge(challenge)
    }

    // También cerrar MILESTONE expirados sin ganador
    const expiredMilestones = await prisma.challenge.findMany({
      where: {
        status: "ACTIVE",
        mode: "MILESTONE",
        endDate: { lt: now },
      },
      include: {
        participants: {
          orderBy: { currentValue: "desc" },
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    })

    for (const challenge of expiredMilestones) {
      // Nadie llegó al goal a tiempo — cerrar sin ganador, asignar ranks y notificar en paralelo
      await Promise.all([
        prisma.challenge.update({
          where: { id: challenge.id },
          data: { status: "COMPLETED" },
        }),
        ...challenge.participants.map((p, i) =>
          prisma.challengeParticipant.update({
            where: { id: p.id },
            data: { rank: i + 1 },
          })
        ),
        prisma.notification.createMany({
          data: challenge.participants.map((p) => ({
            userId: p.userId,
            type: "challenge_expired",
            title: `⏰ "${challenge.title}" terminó sin ganador`,
            data: { challengeId: challenge.id },
          })),
        }),
        sendPushToMany(
          challenge.participants.map((p) => p.userId),
          "⏰ Challenge terminado",
          `"${challenge.title}" terminó. Nadie alcanzó la meta.`,
          { type: "challenge_expired", challengeId: challenge.id }
        ),
      ])
    }

    return {
      timedResolved: expiredChallenges.length,
      milestoneExpired: expiredMilestones.length,
    }
  } catch (error) {
    console.error("Finalize expired challenges error:", error)
    return { timedResolved: 0, milestoneExpired: 0 }
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

// ─── Wellness challenge calculators ─────────────────

async function calcSleepStreak(userId: string, since: Date, until: Date): Promise<number> {
  const logs = await prisma.sleepLog.findMany({
    where: { userId, date: { gte: since, lte: until } },
    orderBy: { date: "asc" },
    select: { date: true },
  })
  if (logs.length === 0) return 0

  let maxStreak = 1, current = 1
  for (let i = 1; i < logs.length; i++) {
    const prev = new Date(logs[i - 1].date)
    const curr = new Date(logs[i].date)
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (Math.round(diff) === 1) { current++; maxStreak = Math.max(maxStreak, current) }
    else current = 1
  }
  return maxStreak
}

async function calcMoodStreak(userId: string, since: Date, until: Date): Promise<number> {
  const logs = await prisma.moodLog.findMany({
    where: { userId, loggedAt: { gte: since, lte: until } },
    orderBy: { loggedAt: "asc" },
    select: { loggedAt: true },
  })
  if (logs.length === 0) return 0

  // Group by date, then calculate consecutive days
  const dates = [...new Set(logs.map((l) => l.loggedAt.toISOString().split("T")[0]))].sort()
  let maxStreak = 1, current = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z")
    const curr = new Date(dates[i] + "T00:00:00Z")
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    if (diff === 1) { current++; maxStreak = Math.max(maxStreak, current) }
    else current = 1
  }
  return maxStreak
}

async function calcBreathingMinutes(userId: string, since: Date, until: Date): Promise<number> {
  const result = await prisma.breathingSession.aggregate({
    where: { userId, createdAt: { gte: since, lte: until } },
    _sum: { durationSec: true },
  })
  return Math.round((result._sum.durationSec ?? 0) / 60)
}

async function calcReadinessAvg(userId: string, since: Date, until: Date): Promise<number> {
  const result = await prisma.readinessScore.aggregate({
    where: { userId, date: { gte: since, lte: until } },
    _avg: { score: true },
  })
  return Math.round(result._avg.score ?? 0)
}

// ─── MILESTONE: primer lugar gana ───────────────────

async function handleMilestoneWin(
  tx: Prisma.TransactionClient,
  userId: string,
  participationId: string,
  challenge: { id: string; title: string; xpReward: number }
) {
  const partialXP = Math.round(challenge.xpReward * PARTICIPATION_XP_RATIO)

  // Fetch winner name and update winner state concurrently to avoid a serial stall
  const [winner] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { name: true } }),
    tx.challengeParticipant.update({
      where: { id: participationId },
      data: { isWinner: true, rank: 1 },
    }),
    tx.user.update({
      where: { id: userId },
      data: { xp: { increment: challenge.xpReward } },
    }),
    tx.challenge.update({
      where: { id: challenge.id },
      data: { status: "COMPLETED" },
    }),
  ])

  const otherParticipants: Array<{ id: string; userId: string }> = await tx.challengeParticipant.findMany({
    where: {
      challengeId: challenge.id,
      userId: { not: userId },
    },
    orderBy: { currentValue: "desc" },
  })

  const winnerTitle = `🏆 ¡Ganaste "${challenge.title}"!`
  const winnerBody = `¡Primer lugar! +${challenge.xpReward} XP`
  const loserTitle = `🏁 "${challenge.title}" terminó`
  const loserBody = `${winner?.name || "Alguien"} llegó primero. +${partialXP} XP por participar`

  // Dar XP parcial a todos los demás, notificar al ganador y a todos los demás en paralelo
  const tasks: Promise<unknown>[] = [
    // Asignar ranks a no-ganadores y dar XP parcial
    ...otherParticipants.map((p, i) =>
      tx.challengeParticipant.update({ where: { id: p.id }, data: { rank: i + 2 } })
    ),
    ...otherParticipants.map((p) =>
      tx.user.update({ where: { id: p.userId }, data: { xp: { increment: partialXP } } })
    ),
    // Notificar al ganador
    tx.notification.create({
      data: {
        userId,
        type: "challenge_won",
        title: winnerTitle,
        data: { challengeId: challenge.id, xpReward: challenge.xpReward, rank: 1 },
      },
    }),
    sendPushToUser(userId, winnerTitle, winnerBody, {
      type: "challenge_won",
      challengeId: challenge.id,
    }),
  ]

  if (otherParticipants.length > 0) {
    // Notificar a los demás que alguien ganó (batch)
    tasks.push(
      tx.notification.createMany({
        data: otherParticipants.map((p) => ({
          userId: p.userId,
          type: "challenge_ended",
          title: loserTitle,
          data: { challengeId: challenge.id, winnerId: userId, xpReward: partialXP },
        })),
      }),
      sendPushToMany(
        otherParticipants.map((p) => p.userId),
        loserTitle,
        loserBody,
        { type: "challenge_ended", challengeId: challenge.id }
      )
    )
  }

  await Promise.all(tasks)
}

// ─── TIMED: mejor puntaje gana al expirar ───────────

async function resolveTimedChallenge(challenge: {
  id: string
  title: string
  xpReward: number
  goal: number
  participants: Array<{
    id: string
    userId: string
    currentValue: number
    user: { id: string; name: string | null }
  }>
}) {
  if (challenge.participants.length === 0) {
    await prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: "COMPLETED" },
    })
    return
  }

  // Participantes ya vienen ordenados por currentValue desc
  const sorted = challenge.participants
  const topValue = sorted[0].currentValue

  // Calcular rank, isWinner y XP para cada participante (sin DB calls)
  const results = sorted.map((p, i) => {
    const rank = i + 1
    const isWinner = p.currentValue === topValue && topValue > 0

    // XP: ganador = 100%, otros según posición
    let xpReward = 0
    if (isWinner) {
      xpReward = challenge.xpReward
    } else if (p.currentValue > 0) {
      // XP proporcional al progreso (mínimo 10% por participar)
      const progressRatio = Math.min(p.currentValue / challenge.goal, 1)
      xpReward = Math.max(
        Math.round(challenge.xpReward * MIN_XP_RATIO),
        Math.round(challenge.xpReward * progressRatio * 0.5)
      )
    }

    const title = isWinner
      ? `🏆 ¡Ganaste "${challenge.title}"!`
      : `🏁 "${challenge.title}" terminó`
    const body = isWinner
      ? `¡Primer lugar con ${p.currentValue}! +${xpReward} XP`
      : `Quedaste #${rank}. ${xpReward > 0 ? `+${xpReward} XP` : ""}`

    return { p, rank, isWinner, xpReward, title, body }
  })

  // Ejecutar todas las escrituras, notificaciones y pushes en paralelo
  await Promise.all([
    // Actualizar participantes
    ...results.map(({ p, rank, isWinner }) =>
      prisma.challengeParticipant.update({ where: { id: p.id }, data: { rank, isWinner } })
    ),
    // Dar XP a quienes corresponde
    ...results
      .filter(({ xpReward }) => xpReward > 0)
      .map(({ p, xpReward }) =>
        prisma.user.update({ where: { id: p.userId }, data: { xp: { increment: xpReward } } })
      ),
    // Crear notificaciones en lote
    prisma.notification.createMany({
      data: results.map(({ p, rank, isWinner, xpReward, title }) => ({
        userId: p.userId,
        type: isWinner ? "challenge_won" : "challenge_ended",
        title,
        data: { challengeId: challenge.id, rank, xpReward, finalValue: p.currentValue },
      })),
    }),
    // Cerrar el challenge
    prisma.challenge.update({
      where: { id: challenge.id },
      data: { status: "COMPLETED" },
    }),
    // Push notifications en paralelo (mensajes distintos por rank, no se puede batch en uno)
    ...results.map(({ p, title, body, isWinner }) =>
      sendPushToUser(p.userId, title, body, {
        type: isWinner ? "challenge_won" : "challenge_ended",
        challengeId: challenge.id,
      })
    ),
  ])
}
