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
import { sendPushToUser } from "./pushNotifications.js"

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

    for (const participation of participations) {
      const challenge = participation.challenge
      let newValue: number | null = null

      switch (challenge.type) {
        case "VOLUME":
          newValue = await calcVolume(ctx.userId, challenge.startDate, now)
          break
        case "FREQUENCY":
          newValue = await calcFrequency(ctx.userId, challenge.startDate, now)
          break
        case "STREAK":
          newValue = await calcStreak(ctx.userId)
          break
        case "PR":
          newValue = await calcPRs(ctx.userId, challenge.startDate, now)
          break
        case "DISTANCE":
          newValue = await calcDistance(ctx.userId, challenge.startDate, now)
          break
        case "CUSTOM":
          continue
      }

      if (newValue === null || newValue === participation.currentValue) continue

      // Actualizar progreso
      await prisma.challengeParticipant.update({
        where: { id: participation.id },
        data: { currentValue: newValue },
      })

      // ─── MILESTONE MODE: el primero que llega al goal gana ───
      if (challenge.mode === "MILESTONE" && newValue >= challenge.goal && !participation.isWinner) {
        await handleMilestoneWin(ctx.userId, participation.id, challenge)
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
      // Nadie llegó al goal a tiempo — cerrar sin ganador
      await prisma.challenge.update({
        where: { id: challenge.id },
        data: { status: "COMPLETED" },
      })

      // Asignar ranks por progreso
      for (let i = 0; i < challenge.participants.length; i++) {
        await prisma.challengeParticipant.update({
          where: { id: challenge.participants[i].id },
          data: { rank: i + 1 },
        })
      }

      // Notificar a todos que el challenge expiró
      for (const p of challenge.participants) {
        await prisma.notification.create({
          data: {
            userId: p.userId,
            type: "challenge_expired",
            title: `⏰ "${challenge.title}" terminó sin ganador`,
            data: { challengeId: challenge.id },
          },
        })
        sendPushToUser(
          p.userId,
          "⏰ Challenge terminado",
          `"${challenge.title}" terminó. Nadie alcanzó la meta.`,
          { type: "challenge_expired", challengeId: challenge.id }
        )
      }
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

// ─── MILESTONE: primer lugar gana ───────────────────

async function handleMilestoneWin(
  userId: string,
  participationId: string,
  challenge: { id: string; title: string; xpReward: number }
) {
  // Marcar como ganador con rank 1
  await prisma.challengeParticipant.update({
    where: { id: participationId },
    data: { isWinner: true, rank: 1 },
  })

  // Dar XP reward al ganador
  await prisma.user.update({
    where: { id: userId },
    data: { xp: { increment: challenge.xpReward } },
  })

  // Cerrar el challenge
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "COMPLETED" },
  })

  // Asignar ranks al resto y dar XP parcial
  const otherParticipants = await prisma.challengeParticipant.findMany({
    where: {
      challengeId: challenge.id,
      userId: { not: userId },
    },
    orderBy: { currentValue: "desc" },
  })

  for (let i = 0; i < otherParticipants.length; i++) {
    const rank = i + 2 // rank 2, 3, 4...
    const partialXP = Math.round(challenge.xpReward * 0.25) // 25% XP por participar
    await prisma.challengeParticipant.update({
      where: { id: otherParticipants[i].id },
      data: { rank },
    })
    await prisma.user.update({
      where: { id: otherParticipants[i].userId },
      data: { xp: { increment: partialXP } },
    })
  }

  // Notificar al ganador
  const winnerTitle = `🏆 ¡Ganaste "${challenge.title}"!`
  const winnerBody = `¡Primer lugar! +${challenge.xpReward} XP`
  await prisma.notification.create({
    data: {
      userId,
      type: "challenge_won",
      title: winnerTitle,
      data: { challengeId: challenge.id, xpReward: challenge.xpReward, rank: 1 },
    },
  })
  sendPushToUser(userId, winnerTitle, winnerBody, {
    type: "challenge_won",
    challengeId: challenge.id,
  })

  // Notificar a los demás que alguien ganó
  const winner = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })
  const partialXP = Math.round(challenge.xpReward * 0.25)

  for (const p of otherParticipants) {
    const loserTitle = `🏁 "${challenge.title}" terminó`
    const loserBody = `${winner?.name || "Alguien"} llegó primero. +${partialXP} XP por participar`
    await prisma.notification.create({
      data: {
        userId: p.userId,
        type: "challenge_ended",
        title: loserTitle,
        data: { challengeId: challenge.id, winnerId: userId, xpReward: partialXP },
      },
    })
    sendPushToUser(p.userId, loserTitle, loserBody, {
      type: "challenge_ended",
      challengeId: challenge.id,
    })
  }
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

  // Asignar ranks y determinar ganador(es)
  const topValue = sorted[0].currentValue

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]
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
        Math.round(challenge.xpReward * 0.1),
        Math.round(challenge.xpReward * progressRatio * 0.5)
      )
    }

    await prisma.challengeParticipant.update({
      where: { id: p.id },
      data: { rank, isWinner },
    })

    if (xpReward > 0) {
      await prisma.user.update({
        where: { id: p.userId },
        data: { xp: { increment: xpReward } },
      })
    }

    // Notificar
    const title = isWinner
      ? `🏆 ¡Ganaste "${challenge.title}"!`
      : `🏁 "${challenge.title}" terminó`
    const body = isWinner
      ? `¡Primer lugar con ${p.currentValue}! +${xpReward} XP`
      : `Quedaste #${rank}. ${xpReward > 0 ? `+${xpReward} XP` : ""}`

    await prisma.notification.create({
      data: {
        userId: p.userId,
        type: isWinner ? "challenge_won" : "challenge_ended",
        title,
        data: {
          challengeId: challenge.id,
          rank,
          xpReward,
          finalValue: p.currentValue,
        },
      },
    })
    sendPushToUser(p.userId, title, body, {
      type: isWinner ? "challenge_won" : "challenge_ended",
      challengeId: challenge.id,
    })
  }

  // Cerrar el challenge
  await prisma.challenge.update({
    where: { id: challenge.id },
    data: { status: "COMPLETED" },
  })
}
