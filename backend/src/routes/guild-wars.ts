// ─────────────────────────────────────────────────────
// backend/src/routes/guild-wars.ts
// Guild Wars — Challenge, Accept, Contribute, Resolve
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

// War type duration mapping
const WAR_DURATIONS: Record<string, number> = {
  TOTAL_WAR: 5,
  IRON_CLASH: 3,
  MARATHON: 7,
  CONSISTENCY: 5,
}

// Ranking proximity for matchmaking: ±20 positions
const RANK_PROXIMITY = 20

// ═══════════════════════════════════════════════════════
//  CHALLENGE ANOTHER GUILD
// ═══════════════════════════════════════════════════════
router.post("/:guildId/challenge", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const challengerGuildId = req.params.guildId as string
    const { defenderGuildId, type } = req.body

    if (!defenderGuildId || !type) {
      res.status(400).json({ error: "defenderGuildId y type son requeridos" }); return
    }

    if (!WAR_DURATIONS[type]) {
      res.status(400).json({ error: "Tipo de guerra inválido" }); return
    }

    // Check requester is FOUNDER/WARDEN of challenger guild
    const membership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: challengerGuildId, userId: user.id } },
    })
    if (!membership || !["FOUNDER", "WARDEN"].includes(membership.role)) {
      res.status(403).json({ error: "Solo Founder/Warden pueden lanzar guerras" }); return
    }

    // Validate both guilds exist
    const [challenger, defender] = await Promise.all([
      prisma.guild.findUnique({
        where: { id: challengerGuildId },
        include: { _count: { select: { members: true } } },
      }),
      prisma.guild.findUnique({
        where: { id: defenderGuildId },
        include: { _count: { select: { members: true } } },
      }),
    ])

    if (!challenger || !defender) {
      res.status(404).json({ error: "Guild no encontrada" }); return
    }

    // Anti-abuse: require >=60% active members in last 7 days
    const weekAgo = new Date()
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)

    const challengerMembers = await prisma.guildMember.findMany({
      where: { guildId: challengerGuildId },
      select: { userId: true },
    })
    const challengerMemberIds = challengerMembers.map((m) => m.userId)

    const activeInWeek = await prisma.workout.groupBy({
      by: ["userId"],
      where: { userId: { in: challengerMemberIds }, isCompleted: true, startTime: { gte: weekAgo } },
    })

    const activePct = challengerMemberIds.length > 0
      ? (activeInWeek.length / challengerMemberIds.length) * 100
      : 0

    if (activePct < 60) {
      res.status(400).json({
        error: `Necesitas >=60% miembros activos para lanzar guerra (tienes ${Math.round(activePct)}%)`,
      }); return
    }

    // Matchmaking: check ranking proximity (if both have ranks)
    if (challenger.nationalRank && defender.nationalRank) {
      if (Math.abs(challenger.nationalRank - defender.nationalRank) > RANK_PROXIMITY) {
        res.status(400).json({
          error: `Solo puedes desafiar guilds ±${RANK_PROXIMITY} posiciones en ranking`,
        }); return
      }
    }

    // Create the war atomically with checks
    const acceptDeadline = new Date()
    acceptDeadline.setUTCHours(acceptDeadline.getUTCHours() + 24)

    let war;
    try {
      war = await prisma.$transaction(async (tx) => {
        // Re-check no active war for challenger
        const activeWar = await tx.guildWar.findFirst({
          where: {
            status: { in: ["ACTIVE", "PENDING"] },
            OR: [{ challengerGuildId }, { defenderGuildId: challengerGuildId }],
          },
        })
        if (activeWar) {
          throw new Error("Ya tienes una guerra activa o pendiente")
        }

        // Re-check defender doesn't have an active war
        const defenderActiveWar = await tx.guildWar.findFirst({
          where: {
            status: { in: ["ACTIVE", "PENDING"] },
            OR: [{ challengerGuildId: defenderGuildId }, { defenderGuildId }],
          },
        })
        if (defenderActiveWar) {
          throw new Error("La guild rival ya está en guerra")
        }

        return await tx.guildWar.create({
          data: {
            type: type as any,
            challengerGuildId,
            defenderGuildId,
            durationDays: WAR_DURATIONS[type],
            acceptDeadline,
            xpReward: 250,
          },
        })
      })
    } catch (error: any) {
      const knownMessages = [
        "Ya tienes una guerra activa o pendiente",
        "La guild rival ya está en guerra",
      ]
      if (typeof error?.message === "string" && knownMessages.includes(error.message)) {
        res.status(400).json({ error: error.message }); return
      }

      console.error("Guild war challenge error:", error)
      res.status(500).json({ error: "Internal server error" }); return
    }

    // Notify defender guild founder/wardens
    const defenderLeaders = await prisma.guildMember.findMany({
      where: { guildId: defenderGuildId, role: { in: ["FOUNDER", "WARDEN"] } },
      select: { userId: true },
    })

    await prisma.notification.createMany({
      data: defenderLeaders.map((l) => ({
        userId: l.userId,
        fromId: user.id,
        type: "guild_war_challenge",
        title: `${challenger.name} [${challenger.tag}] te ha desafiado!`,
        data: { warId: war.id, challengerName: challenger.name, warType: type },
      })),
    })

    res.status(201).json(war)
  } catch (error) {
    console.error("Challenge error:", error)
    res.status(500).json({ error: "Error al lanzar desafío" })
  }
})

// ═══════════════════════════════════════════════════════
//  ACCEPT / DECLINE WAR
// ═══════════════════════════════════════════════════════
router.post("/wars/:warId/respond", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const warId = req.params.warId as string
    const { accept } = req.body // true or false

    const war = await prisma.guildWar.findUnique({ where: { id: warId } })
    if (!war) { res.status(404).json({ error: "Guerra no encontrada" }); return }
    if (war.status !== "PENDING") {
      res.status(400).json({ error: "Esta guerra ya no está pendiente" }); return
    }

    // Check user is FOUNDER/WARDEN of defender
    const membership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: war.defenderGuildId, userId: user.id } },
    })
    if (!membership || !["FOUNDER", "WARDEN"].includes(membership.role)) {
      res.status(403).json({ error: "Solo Founder/Warden de la guild defensora pueden responder" }); return
    }

    if (!accept) {
      const result = await prisma.guildWar.updateMany({
        where: { id: warId, status: "PENDING", acceptDeadline: { gte: new Date() } },
        data: { status: "DECLINED" },
      })
      if (result.count === 0) {
        res.status(400).json({ error: "No se pudo declinar la guerra (ya no pendiente o expirada)" }); return
      }
      res.json({ success: true, status: "DECLINED" }); return
    }

    // Accept: set start/end dates
    const startDate = new Date()
    const endDate = new Date()
    endDate.setUTCDate(endDate.getUTCDate() + war.durationDays)

    const result = await prisma.guildWar.updateMany({
      where: { id: warId, status: "PENDING", acceptDeadline: { gte: new Date() } },
      data: { status: "ACTIVE", startDate, endDate },
    })
    if (result.count === 0) {
      res.status(400).json({ error: "No se pudo aceptar la guerra (ya no pendiente o expirada)" }); return
    }

    // Notify all members of both guilds
    const allMembers = await prisma.guildMember.findMany({
      where: { guildId: { in: [war.challengerGuildId, war.defenderGuildId] } },
      select: { userId: true },
    })

    const [challengerGuild, defenderGuild] = await Promise.all([
      prisma.guild.findUnique({ where: { id: war.challengerGuildId }, select: { name: true } }),
      prisma.guild.findUnique({ where: { id: war.defenderGuildId }, select: { name: true } }),
    ])

    await prisma.notification.createMany({
      data: allMembers.map((m) => ({
        userId: m.userId,
        type: "guild_war_started",
        title: `Guerra iniciada: ${challengerGuild?.name} vs ${defenderGuild?.name}`,
        data: { warId, type: war.type, durationDays: war.durationDays },
      })),
    })

    res.json({ success: true, status: "ACTIVE", startDate, endDate })
  } catch (error) {
    console.error("War respond error:", error)
    res.status(500).json({ error: "Error al responder al desafío" })
  }
})

// ═══════════════════════════════════════════════════════
//  GET WAR DETAILS (with contributions)
// ═══════════════════════════════════════════════════════
router.get("/wars/:warId", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const warId = req.params.warId as string

    const war = await prisma.guildWar.findUnique({
      where: { id: warId },
      include: {
        challengerGuild: {
          select: { id: true, name: true, tag: true, colorPrimary: true, _count: { select: { members: true } } },
        },
        defenderGuild: {
          select: { id: true, name: true, tag: true, colorPrimary: true, _count: { select: { members: true } } },
        },
        contributions: {
          orderBy: { totalWP: "desc" },
          take: 50,
        },
      },
    })

    if (!war) { res.status(404).json({ error: "Guerra no encontrada" }); return }

    // Aggregate contributions per guild
    const challengerContribs = war.contributions.filter((c) => c.guildId === war.challengerGuildId)
    const defenderContribs = war.contributions.filter((c) => c.guildId === war.defenderGuildId)

    // Top contributors
    const topContributorIds = [...new Set(war.contributions.map((c) => c.userId))].slice(0, 10)
    const topUsers = topContributorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: topContributorIds } },
          select: { id: true, name: true, username: true, avatarUrl: true },
        })
      : []

    // Aggregate WP per user
    const userWP: Record<string, number> = {}
    war.contributions.forEach((c) => {
      userWP[c.userId] = (userWP[c.userId] || 0) + c.totalWP
    })

    const leaderboard = Object.entries(userWP)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, wp], i) => {
        const u = topUsers.find((tu) => tu.id === userId)
        const guildId = war.contributions.find((c) => c.userId === userId)?.guildId
        return {
          rank: i + 1,
          userId,
          name: u?.name || "Unknown",
          username: u?.username || "",
          avatarUrl: u?.avatarUrl || null,
          guildId,
          totalWP: wp,
        }
      })

    const daysLeft = war.endDate
      ? Math.max(0, Math.ceil((war.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0

    res.json({
      id: war.id,
      type: war.type,
      status: war.status,
      challenger: {
        ...war.challengerGuild,
        memberCount: war.challengerGuild._count.members,
        score: Math.round(war.challengerScore * 10) / 10,
        activeContributors: new Set(challengerContribs.map((c) => c.userId)).size,
      },
      defender: {
        ...war.defenderGuild,
        memberCount: war.defenderGuild._count.members,
        score: Math.round(war.defenderScore * 10) / 10,
        activeContributors: new Set(defenderContribs.map((c) => c.userId)).size,
      },
      winnerGuildId: war.winnerGuildId,
      mvpUserId: war.mvpUserId,
      durationDays: war.durationDays,
      daysLeft,
      startDate: war.startDate,
      endDate: war.endDate,
      leaderboard,
    })
  } catch (error) {
    console.error("War details error:", error)
    res.status(500).json({ error: "Error al obtener detalles de guerra" })
  }
})

// ═══════════════════════════════════════════════════════
//  MY WAR CONTRIBUTION TODAY (auto-calculated)
//  Called by client daily to sync contributions
// ═══════════════════════════════════════════════════════
router.post("/wars/:warId/sync", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const warId = req.params.warId as string
    const war = await prisma.guildWar.findUnique({ where: { id: warId } })
    if (!war || war.status !== "ACTIVE") {
      res.status(400).json({ error: "Guerra no activa" }); return
    }

    // Which guild is the user in?
    const membership = await prisma.guildMember.findFirst({
      where: {
        userId: user.id,
        guildId: { in: [war.challengerGuildId, war.defenderGuildId] },
      },
    })
    if (!membership) {
      res.status(400).json({ error: "No eres miembro de ninguna guild en esta guerra" }); return
    }

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Calculate today's War Points
    const [todayWorkouts, todayFoodLogs, todaySteps, todayPRs] = await Promise.all([
      prisma.workout.count({
        where: { userId: user.id, isCompleted: true, startTime: { gte: today }, duration: { gte: 20 } },
      }),
      prisma.foodLog.count({
        where: { userId: user.id, date: { gte: today } },
      }),
      prisma.dailySteps.findFirst({
        where: { userId: user.id, date: { gte: today } },
        select: { steps: true },
      }),
      prisma.personalRecord.count({
        where: { userId: user.id, achievedAt: { gte: today } },
      }),
    ])

    const workoutWP = Math.min(todayWorkouts, 3) * 10 // max 3 workouts/day count
    const nutritionWP = todayFoodLogs > 0 ? 5 : 0
    const stepsWP = (todaySteps?.steps || 0) >= 8000 ? 5 : 0
    const streakWP = user.streak > 0 ? 3 : 0
    const prWP = todayPRs * 15
    const totalWP = workoutWP + nutritionWP + stepsWP + streakWP + prWP

    // Upsert contribution for today
    await prisma.guildWarContribution.upsert({
      where: { warId_userId_date: { warId, userId: user.id, date: today } },
      create: {
        warId,
        userId: user.id,
        guildId: membership.guildId,
        date: today,
        workoutWP, nutritionWP, stepsWP, streakWP, prWP, totalWP,
      },
      update: { workoutWP, nutritionWP, stepsWP, streakWP, prWP, totalWP },
    })

    // Recalculate guild scores (normalized per active member)
    const allContribs = await prisma.guildWarContribution.groupBy({
      by: ["guildId"],
      where: { warId },
      _sum: { totalWP: true },
    })

    const activeByGuild = await prisma.guildWarContribution.groupBy({
      by: ["guildId", "userId"],
      where: { warId },
    })

    const activeCountByGuild: Record<string, number> = {}
    activeByGuild.forEach((r) => {
      activeCountByGuild[r.guildId] = (activeCountByGuild[r.guildId] || 0) + 1
    })

    const updateData: Record<string, number> = {}
    for (const gc of allContribs) {
      const active = activeCountByGuild[gc.guildId] || 1
      const normalizedScore = (gc._sum.totalWP || 0) / active
      const isChallenger = gc.guildId === war.challengerGuildId

      if (isChallenger) {
        updateData.challengerScore = normalizedScore
        updateData.challengerActive = active
      } else {
        updateData.defenderScore = normalizedScore
        updateData.defenderActive = active
      }
    }

    await prisma.guildWar.update({
      where: { id: warId },
      data: updateData,
    })

    res.json({
      today: { workoutWP, nutritionWP, stepsWP, streakWP, prWP, totalWP },
      synced: true,
    })
  } catch (error) {
    console.error("War sync error:", error)
    res.status(500).json({ error: "Error al sincronizar guerra" })
  }
})

router.post("/wars/:warId/resolve", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Verify user is admin or system (if called by cron, use ADMIN_CLERK_IDS env var)
    const adminClerkIds = (process.env.ADMIN_CLERK_IDS ?? "").split(",").filter(Boolean)
    if (!adminClerkIds.includes(clerkId!)) {
      res.status(403).json({ error: "No autorizado para resolver guerras" }); return
    }

    const warId = req.params.warId as string
    const war = await prisma.guildWar.findUnique({ where: { id: warId } })
    if (!war || war.status !== "ACTIVE") {
      res.status(400).json({ error: "Guerra no activa" }); return
    }

    // Check if war should end
    if (war.endDate && war.endDate > new Date()) {
      res.status(400).json({ error: "La guerra aún no ha terminado" }); return
    }

    // Determine winner
    const winnerGuildId = war.challengerScore > war.defenderScore
      ? war.challengerGuildId
      : war.defenderScore > war.challengerScore
        ? war.defenderGuildId
        : null // Tie

    let mvpUserId: string | null = null
    if (winnerGuildId) {
      const topContributor = await prisma.guildWarContribution.groupBy({
        by: ["userId"],
        where: { warId, guildId: winnerGuildId },
        _sum: { totalWP: true },
        orderBy: { _sum: { totalWP: "desc" } },
        take: 1,
      })
      mvpUserId = topContributor[0]?._sum.totalWP ? topContributor[0].userId : null
    }

    const allContributors = await prisma.guildWarContribution.findMany({
      where: { warId },
      select: { userId: true, guildId: true },
    })

    await prisma.$transaction(async (tx) => {
      for (const c of allContributors) {
        const isWinner = c.guildId === winnerGuildId
        let xpGain = isWinner ? 50 : 25
        if (c.userId === mvpUserId) xpGain += 100

        await tx.user.update({
          where: { id: c.userId },
          data: { xp: { increment: xpGain } },
        })
      }

      if (winnerGuildId) {
        await tx.guild.update({
          where: { id: winnerGuildId },
          data: { xp: { increment: war.xpReward } },
        })
      }

      await tx.guildWar.update({
        where: { id: warId },
        data: {
          status: "COMPLETED",
          winnerGuildId,
          mvpUserId,
        },
      })
    })

    // Notify all members
    const [challengerGuild, defenderGuild] = await Promise.all([
      prisma.guild.findUnique({ where: { id: war.challengerGuildId }, select: { name: true } }),
      prisma.guild.findUnique({ where: { id: war.defenderGuildId }, select: { name: true } }),
    ])

    const winnerName = winnerGuildId === war.challengerGuildId ? challengerGuild?.name : defenderGuild?.name
    const allMembers = await prisma.guildMember.findMany({
      where: { guildId: { in: [war.challengerGuildId, war.defenderGuildId] } },
      select: { userId: true, guildId: true },
    })

    await prisma.notification.createMany({
      data: allMembers.map((m) => ({
        userId: m.userId,
        type: "guild_war_ended",
        title: winnerGuildId
          ? `${winnerName} ganó la guerra!`
          : "La guerra terminó en empate!",
        data: {
          warId,
          won: m.guildId === winnerGuildId,
          xpEarned: m.guildId === winnerGuildId
            ? (m.userId === mvpUserId ? 150 : 50)
            : 25,
        },
      })),
    })

    res.json({
      status: "COMPLETED",
      winnerGuildId,
      mvpUserId,
      challengerScore: war.challengerScore,
      defenderScore: war.defenderScore,
    })
  } catch (error) {
    console.error("War resolve error:", error)
    res.status(500).json({ error: "Error al resolver guerra" })
  }
})

// ═══════════════════════════════════════════════════════
//  BROWSE AVAILABLE GUILDS TO CHALLENGE
// ═══════════════════════════════════════════════════════
router.get("/:guildId/rivals", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guildId = req.params.guildId as string

    const myGuild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { nationalRank: true, level: true },
    })
    if (!myGuild) { res.status(404).json({ error: "Guild no encontrada" }); return }

    // Find guilds not currently in a war
    const activeWarGuildIds = (await prisma.guildWar.findMany({
      where: { status: { in: ["ACTIVE", "PENDING"] } },
      select: { challengerGuildId: true, defenderGuildId: true },
    })).flatMap((w) => [w.challengerGuildId, w.defenderGuildId])

    const rivals = await prisma.guild.findMany({
      where: {
        id: { notIn: [...activeWarGuildIds, guildId] },
        ...(myGuild.nationalRank ? {
          nationalRank: {
            gte: myGuild.nationalRank - RANK_PROXIMITY,
            lte: myGuild.nationalRank + RANK_PROXIMITY,
          },
        } : {}),
      },
      include: { _count: { select: { members: true } } },
      orderBy: { level: "desc" },
      take: 20,
    })

    res.json({
      rivals: rivals.map((r) => ({
        id: r.id,
        name: r.name,
        tag: r.tag,
        type: r.type,
        colorPrimary: r.colorPrimary,
        level: r.level,
        memberCount: r._count.members,
        nationalRank: r.nationalRank,
        avgStreak: r.avgStreak,
      })),
    })
  } catch (error) {
    console.error("Rivals error:", error)
    res.status(500).json({ error: "Error al buscar rivales" })
  }
})

export default router
