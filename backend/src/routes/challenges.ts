// ─────────────────────────────────────────────────────
// backend/src/routes/challenges.ts
// Sprint 4: Challenges + Leaderboards
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"

const router = Router()
router.use(requireAuth)

async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } })
}

// ═══════════════════════════════════════════════════════
//  CHALLENGES
// ═══════════════════════════════════════════════════════

// POST /api/challenges — Crear challenge
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const {
      title, description, type, targetValue, targetUnit,
      exerciseName, externalId, startDate, endDate,
      maxParticipants, isPublic, xpReward,
    } = req.body

    if (!title || !type || !startDate || !endDate) {
      res.status(400).json({ error: "title, type, startDate y endDate son requeridos" }); return
    }

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: user.id,
        title,
        description: description || null,
        type,
        targetValue: targetValue || null,
        targetUnit: targetUnit || null,
        exerciseName: exerciseName || null,
        externalId: externalId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        maxParticipants: maxParticipants || null,
        isPublic: isPublic !== false,
        xpReward: xpReward || 100,
        status: new Date(startDate) <= new Date() ? "ACTIVE" : "PENDING",
      },
    })

    // El creador se une automáticamente
    await prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId: user.id },
    })

    // XP por crear challenge
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 15 } },
    })

    res.json({ challenge, xpEarned: 15 })
  } catch (error) {
    console.error("Create challenge error:", error)
    res.status(500).json({ error: "Error al crear challenge" })
  }
})

// GET /api/challenges — Listar challenges
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const filter = req.query.filter as string // "active", "mine", "available"

    let where: any = { isPublic: true }

    if (filter === "mine") {
      where = {
        OR: [
          { creatorId: user.id },
          { participants: { some: { userId: user.id } } },
        ],
      }
    } else if (filter === "active") {
      where = { ...where, status: "ACTIVE" }
    } else if (filter === "available") {
      where = {
        ...where,
        status: { in: ["PENDING", "ACTIVE"] },
        participants: { none: { userId: user.id } },
      }
    }

    const challenges = await prisma.challenge.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        _count: { select: { participants: true } },
        participants: {
          where: { userId: user.id },
          select: { currentValue: true, isWinner: true, rank: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    })

    const formatted = challenges.map((c) => ({
      ...c,
      participantsCount: c._count.participants,
      myProgress: c.participants[0] || null,
      isJoined: c.participants.length > 0,
      participants: undefined,
      _count: undefined,
    }))

    res.json({ challenges: formatted })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener challenges" })
  }
})

// POST /api/challenges/:id/join — Unirse a challenge
router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const challengeId = req.params.id as string

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: { _count: { select: { participants: true } } },
    })

    if (!challenge) { res.status(404).json({ error: "Challenge no encontrado" }); return }
    if (challenge.status === "COMPLETED" || challenge.status === "CANCELLED") {
      res.status(400).json({ error: "Este challenge ya terminó" }); return
    }
    if (challenge.maxParticipants && challenge._count.participants >= challenge.maxParticipants) {
      res.status(400).json({ error: "Challenge lleno" }); return
    }

    await prisma.challengeParticipant.create({
      data: { challengeId, userId: user.id },
    }).catch(() => {
      // Ya está unido
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Error al unirse al challenge" })
  }
})

// GET /api/challenges/:id — Detalle + leaderboard del challenge
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const challengeId = req.params.id as string

    const challenge = await prisma.challenge.findUnique({
      where: { id: challengeId },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true, level: true },
            },
          },
          orderBy: { currentValue: "desc" },
        },
      },
    })

    if (!challenge) { res.status(404).json({ error: "Challenge no encontrado" }); return }

    // Leaderboard con ranking
    const leaderboard = challenge.participants.map((p, idx) => ({
      rank: idx + 1,
      userId: p.user.id,
      name: p.user.name,
      username: p.user.username,
      avatarUrl: p.user.avatarUrl,
      level: p.user.level,
      currentValue: p.currentValue,
      isWinner: p.isWinner,
      isMe: p.user.id === user.id,
    }))

    res.json({
      challenge: {
        id: challenge.id,
        title: challenge.title,
        description: challenge.description,
        type: challenge.type,
        status: challenge.status,
        targetValue: challenge.targetValue,
        targetUnit: challenge.targetUnit,
        exerciseName: challenge.exerciseName,
        startDate: challenge.startDate,
        endDate: challenge.endDate,
        xpReward: challenge.xpReward,
        creator: challenge.creator,
        participantsCount: challenge.participants.length,
      },
      leaderboard,
      isJoined: leaderboard.some((p) => p.isMe),
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener challenge" })
  }
})

// ═══════════════════════════════════════════════════════
//  GLOBAL LEADERBOARDS
// ═══════════════════════════════════════════════════════

// GET /api/challenges/leaderboard/global
router.get("/leaderboard/global", async (req: Request, res: Response) => {
  try {
    const period = req.query.period as string // "week", "month", "alltime"

    let dateFilter: Date | undefined
    if (period === "week") {
      dateFilter = new Date()
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (period === "month") {
      dateFilter = new Date()
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    }

    // Leaderboard por XP
    const xpLeaderboard = await prisma.user.findMany({
      select: {
        id: true, name: true, username: true, avatarUrl: true,
        xp: true, level: true, streak: true,
      },
      orderBy: { xp: "desc" },
      take: 50,
    })

    // Leaderboard por volumen (si hay filtro de fecha)
    let volumeLeaderboard: any[] = []
    if (dateFilter) {
      const volumeData = await prisma.workout.groupBy({
        by: ["userId"],
        where: {
          isCompleted: true,
          startTime: { gte: dateFilter },
        },
        _sum: { totalVolume: true },
        _count: true,
        orderBy: { _sum: { totalVolume: "desc" } },
        take: 50,
      })

      // Enriquecer con datos del usuario
      const userIds = volumeData.map((v) => v.userId)
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true, avatarUrl: true, level: true },
      })
      const userMap = new Map(users.map((u) => [u.id, u]))

      volumeLeaderboard = volumeData.map((v, idx) => ({
        rank: idx + 1,
        ...userMap.get(v.userId),
        totalVolume: Math.round(v._sum.totalVolume || 0),
        workoutCount: v._count,
      }))
    }

    // Leaderboard por streaks
    const streakLeaderboard = await prisma.user.findMany({
      where: { streak: { gt: 0 } },
      select: {
        id: true, name: true, username: true, avatarUrl: true,
        streak: true, level: true,
      },
      orderBy: { streak: "desc" },
      take: 20,
    })

    res.json({
      xp: xpLeaderboard.map((u, i) => ({ rank: i + 1, ...u })),
      volume: volumeLeaderboard,
      streak: streakLeaderboard.map((u, i) => ({ rank: i + 1, ...u })),
    })
  } catch (error) {
    console.error("Leaderboard error:", error)
    res.status(500).json({ error: "Error al obtener leaderboard" })
  }
})

export default router