// ─────────────────────────────────────────────────────
// backend/src/routes/guilds.ts
// Guilds — Create, Join, Leave, Members, Stats, Browse
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

const MAX_GUILDS = 3 // 1 forge + 2 secondary
const MAX_WARDENS = 3
const MAX_CAPTAINS = 5

// ═══════════════════════════════════════════════════════
//  CREATE GUILD
// ═══════════════════════════════════════════════════════
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { name, tag, type, motto, description, maxMembers, colorPrimary, colorSecondary, placeId } = req.body

    const VALID_TYPES = ["FORGE", "WAR_PARTY", "OPEN"] as const
    if (!name || !tag || !type) {
      res.status(400).json({ error: "name, tag, y type son requeridos" }); return
    }
    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({ error: "type debe ser FORGE, WAR_PARTY o OPEN" }); return
    }

    // Validate tag: 2-5 uppercase alphanumeric chars
    const cleanTag = tag.toUpperCase().replace(/[^A-Z0-9]/g, "")
    if (cleanTag.length < 2 || cleanTag.length > 5) {
      res.status(400).json({ error: "Tag debe ser 2-5 caracteres alfanuméricos" }); return
    }

    // Check tag uniqueness
    const existingTag = await prisma.guild.findUnique({ where: { tag: cleanTag } })
    if (existingTag) {
      res.status(400).json({ error: "Tag ya está en uso" }); return
    }

    // For FORGE type, check if place already has a guild
    if (type === "FORGE") {
      if (!placeId) {
        res.status(400).json({ error: "placeId es requerido para Forge guilds" }); return
      }
      const existingForge = await prisma.guild.findUnique({ where: { placeId } })
      if (existingForge) {
        res.status(400).json({ error: "Este gym ya tiene una Forge guild" }); return
      }
    }

    const guild = await prisma.$transaction(async (tx) => {
      // Re-check guild limit inside transaction
      const membershipCount = await tx.guildMember.count({ where: { userId: user.id } })
      if (membershipCount >= MAX_GUILDS) {
        throw new Error(`Máximo ${MAX_GUILDS} guilds permitidas`)
      }

      // Re-check tag uniqueness
      const existingTag = await tx.guild.findUnique({ where: { tag: cleanTag } })
      if (existingTag) {
        throw new Error("Tag ya está en uso")
      }

      // Re-check place for FORGE
      if (type === "FORGE") {
        const existingForge = await tx.guild.findUnique({ where: { placeId } })
        if (existingForge) {
          throw new Error("Este gym ya tiene una Forge guild")
        }
      }

      return await tx.guild.create({
        data: {
          name,
          tag: cleanTag,
          type: type as "FORGE" | "WAR_PARTY" | "OPEN",
          motto: motto || null,
          description: description || null,
          maxMembers: type === "WAR_PARTY" ? Math.min(maxMembers || 15, 15) : (maxMembers || 30),
          colorPrimary: colorPrimary || "#6C63FF",
          colorSecondary: colorSecondary || "#1A1A2E",
          placeId: type === "FORGE" ? placeId : null,
          creatorId: user.id,
          members: {
            create: {
              userId: user.id,
              role: "FOUNDER",
              isPrimary: type === "FORGE",
            },
          },
        },
        include: {
          _count: { select: { members: true } },
        },
      })
    }).catch((error) => {
      res.status(400).json({ error: error.message }); return
    })

    if (!guild) return // Error already sent

    res.status(201).json(guild)
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ error: "Tag ya está en uso" }); return
    }
    console.error("Create guild error:", error)
    res.status(500).json({ error: "Error al crear guild" })
  }
})

// ═══════════════════════════════════════════════════════
//  MY GUILDS
// ═══════════════════════════════════════════════════════
router.get("/mine", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const memberships = await prisma.guildMember.findMany({
      where: { userId: user.id },
      include: {
        guild: {
          include: {
            place: { select: { name: true } },
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { isPrimary: "desc" },
    })

    const guilds = memberships.map((m) => ({
      ...m.guild,
      memberCount: m.guild._count.members,
      myRole: m.role,
      isPrimary: m.isPrimary,
      joinedAt: m.joinedAt,
    }))

    res.json({ guilds, count: guilds.length, maxGuilds: MAX_GUILDS })
  } catch (error) {
    console.error("My guilds error:", error)
    res.status(500).json({ error: "Error al obtener mis guilds" })
  }
})

// ═══════════════════════════════════════════════════════
//  BROWSE GUILDS (for discovery)
// ═══════════════════════════════════════════════════════
router.get("/browse/all", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const VALID_TYPES = ["FORGE", "WAR_PARTY", "OPEN"] as const
    const { type, search } = req.query
    const requestedType = Array.isArray(type) ? type[0] : type
    const searchText = Array.isArray(search) ? search[0] : search

    const where: any = {}
    if (requestedType && requestedType !== "all" && VALID_TYPES.includes(requestedType as any)) {
      where.type = requestedType
    }
    if (searchText) {
      where.name = { contains: String(searchText), mode: "insensitive" }
    }

    const guilds = await prisma.guild.findMany({
      where,
      include: {
        place: { select: { name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { level: "desc" },
      take: 30,
    })

    // Check which ones I'm already in
    const myGuildIds = new Set(
      (await prisma.guildMember.findMany({
        where: { userId: user.id },
        select: { guildId: true },
      })).map((m) => m.guildId)
    )

    const result = guilds.map((g) => ({
      id: g.id,
      name: g.name,
      tag: g.tag,
      type: g.type,
      motto: g.motto,
      iconUrl: g.iconUrl,
      colorPrimary: g.colorPrimary,
      level: g.level,
      memberCount: g._count.members,
      maxMembers: g.maxMembers,
      avgStreak: g.avgStreak,
      nationalRank: g.nationalRank,
      placeName: g.place?.name || null,
      isMember: myGuildIds.has(g.id),
    }))

    res.json({ guilds: result })
  } catch (error) {
    console.error("Browse guilds error:", error)
    res.status(500).json({ error: "Error al buscar guilds" })
  }
})

// ═══════════════════════════════════════════════════════
//  GET GUILD BY ID (HQ view)
// ═══════════════════════════════════════════════════════
router.get("/:guildId", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guild = await prisma.guild.findUnique({
      where: { id: req.params.guildId as string },
      include: {
        place: { select: { name: true, address: true } },
        creator: { select: { id: true, name: true, username: true, avatarUrl: true } },
        _count: { select: { members: true } },
      },
    })

    if (!guild) { res.status(404).json({ error: "Guild no encontrada" }); return }

    // Check if I'm a member
    const myMembership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: guild.id, userId: user.id } },
    })

    res.json({
      ...guild,
      memberCount: guild._count.members,
      isMember: !!myMembership,
      myRole: myMembership?.role || null,
      isPrimary: myMembership?.isPrimary || false,
    })
  } catch (error) {
    console.error("Get guild error:", error)
    res.status(500).json({ error: "Error al obtener guild" })
  }
})

// ═══════════════════════════════════════════════════════
//  GUILD MEMBERS (ranked by streak)
// ═══════════════════════════════════════════════════════
router.get("/:guildId/members", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const members = await prisma.guildMember.findMany({
      where: { guildId: req.params.guildId as string },
      include: {
        user: {
          select: {
            id: true, name: true, username: true, avatarUrl: true,
            level: true, streak: true, xp: true,
            _count: { select: { workouts: { where: { isCompleted: true } } } },
          },
        },
      },
    })

    // Sort by streak desc (ranking by streak as designed)
    const ranked = members
      .map((m, _i) => ({
        id: m.user.id,
        name: m.user.name,
        username: m.user.username,
        avatarUrl: m.user.avatarUrl,
        level: m.user.level,
        streak: m.user.streak,
        xp: m.user.xp,
        workoutsCount: m.user._count.workouts,
        role: m.role,
        joinedAt: m.joinedAt,
        // Streak tier
        streakTier: m.user.streak >= 30 ? "INFERNO"
          : m.user.streak >= 14 ? "SURGE"
          : m.user.streak >= 7 ? "IRON"
          : m.user.streak >= 1 ? "SEEDLING"
          : "FALLEN",
      }))
      .sort((a, b) => b.streak - a.streak)
      .map((m, i) => ({ ...m, rank: i + 1 }))

    // Streak distribution
    const distribution = {
      inferno: ranked.filter((m) => m.streakTier === "INFERNO").length,
      surge: ranked.filter((m) => m.streakTier === "SURGE").length,
      iron: ranked.filter((m) => m.streakTier === "IRON").length,
      seedling: ranked.filter((m) => m.streakTier === "SEEDLING").length,
      fallen: ranked.filter((m) => m.streakTier === "FALLEN").length,
    }

    res.json({ members: ranked, distribution, total: ranked.length })
  } catch (error) {
    console.error("Guild members error:", error)
    res.status(500).json({ error: "Error al obtener miembros" })
  }
})

// ═══════════════════════════════════════════════════════
//  GUILD STATS (Pulse + Arena + Heatmap + Comparisons)
// ═══════════════════════════════════════════════════════
router.get("/:guildId/stats", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guildId = req.params.guildId as string

    // Get all member IDs
    const memberRows = await prisma.guildMember.findMany({
      where: { guildId },
      select: { userId: true },
    })
    const memberIds = memberRows.map((m) => m.userId)
    if (memberIds.length === 0) {
      res.json({ pulse: null, arena: null }); return
    }

    // Get member data for calculations
    const members = await prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, name: true, username: true, avatarUrl: true, streak: true, level: true, xp: true },
    })

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    const weekAgo = new Date(today)
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7)

    const twoWeeksAgo = new Date(today)
    twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14)

    const fourWeeksAgo = new Date(today)
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28)

    // Parallel queries for stats
    const [
      workoutsToday,
      workoutsThisWeek,
      _workoutsLastWeek,
      workouts4Weeks,
      weeklyVolume,
      lastWeekVolume,
      weeklySteps,
      lastWeekSteps,
      stepsToday,
      foodLogsThisWeek,
      _foodLogs4Weeks,
      activeWar,
    ] = await Promise.all([
      // Active today
      prisma.workout.groupBy({
        by: ["userId"],
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: today } },
      }),
      // Workouts this week
      prisma.workout.findMany({
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: weekAgo } },
        select: { userId: true, startTime: true, totalVolume: true },
      }),
      // Workouts LAST week (for WoW comparison)
      prisma.workout.findMany({
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: twoWeeksAgo, lt: weekAgo } },
        select: { userId: true, totalVolume: true },
      }),
      // Workouts last 4 weeks (for heatmap)
      prisma.workout.findMany({
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: fourWeeksAgo } },
        select: { userId: true, startTime: true },
      }),
      // Volume this week
      prisma.workout.aggregate({
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: weekAgo } },
        _sum: { totalVolume: true },
      }),
      // Volume LAST week
      prisma.workout.aggregate({
        where: { userId: { in: memberIds }, isCompleted: true, startTime: { gte: twoWeeksAgo, lt: weekAgo } },
        _sum: { totalVolume: true },
      }),
      // Steps this week
      prisma.dailySteps.aggregate({
        where: { userId: { in: memberIds }, date: { gte: weekAgo } },
        _sum: { steps: true },
      }),
      // Steps LAST week
      prisma.dailySteps.aggregate({
        where: { userId: { in: memberIds }, date: { gte: twoWeeksAgo, lt: weekAgo } },
        _sum: { steps: true },
      }),
      // Steps TODAY
      prisma.dailySteps.aggregate({
        where: { userId: { in: memberIds }, date: { gte: today } },
        _sum: { steps: true },
      }),
      // Food logs this week
      prisma.foodLog.groupBy({
        by: ["userId"],
        where: { userId: { in: memberIds }, date: { gte: weekAgo } },
      }),
      // Food logs 4 weeks (for heatmap)
      prisma.foodLog.findMany({
        where: { userId: { in: memberIds }, date: { gte: fourWeeksAgo } },
        select: { userId: true, date: true },
      }),
      // Active war
      prisma.guildWar.findFirst({
        where: {
          status: "ACTIVE",
          OR: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
        },
        include: {
          challengerGuild: { select: { id: true, name: true, tag: true, colorPrimary: true } },
          defenderGuild: { select: { id: true, name: true, tag: true, colorPrimary: true } },
        },
      }),
    ])

    const activeTodayCount = workoutsToday.length
    const totalMembers = memberIds.length
    const avgStreak = members.reduce((sum, m) => sum + m.streak, 0) / totalMembers

    // ─── WEEKLY RHYTHM ────────────────────────────
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
    const rhythm: { day: string; count: number; pct: number }[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo)
      d.setUTCDate(d.getUTCDate() + i)
      const dateStr = d.toISOString().split("T")[0]
      const dayUsers = new Set(
        workoutsThisWeek
          .filter((w) => w.startTime.toISOString().split("T")[0] === dateStr)
          .map((w) => w.userId)
      )
      rhythm.push({
        day: dayNames[d.getUTCDay()],
        count: dayUsers.size,
        pct: totalMembers > 0 ? Math.round((dayUsers.size / totalMembers) * 100) : 0,
      })
    }

    // ─── CONSISTENCY HEATMAP (4 weeks × 7 days) ──
    const heatmap: { week: number; day: number; dayName: string; date: string; pct: number }[] = []
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(fourWeeksAgo)
        cellDate.setUTCDate(cellDate.getUTCDate() + w * 7 + d)
        const dateStr = cellDate.toISOString().split("T")[0]
        const activeUsers = new Set(
          workouts4Weeks
            .filter((wo) => wo.startTime.toISOString().split("T")[0] === dateStr)
            .map((wo) => wo.userId)
        )
        heatmap.push({
          week: w,
          day: d,
          dayName: dayNames[cellDate.getUTCDay()],
          date: dateStr,
          pct: totalMembers > 0 ? Math.round((activeUsers.size / totalMembers) * 100) : 0,
        })
      }
    }

    // ─── STREAK DISTRIBUTION ──────────────────────
    const streakDist = {
      inferno: members.filter((m) => m.streak >= 30).length,
      surge: members.filter((m) => m.streak >= 14 && m.streak < 30).length,
      iron: members.filter((m) => m.streak >= 7 && m.streak < 14).length,
      seedling: members.filter((m) => m.streak >= 1 && m.streak < 7).length,
      fallen: members.filter((m) => m.streak === 0).length,
    }

    // ─── VOLUME WEEK-OVER-WEEK ────────────────────
    const volThis = Math.round(weeklyVolume._sum.totalVolume || 0)
    const volLast = Math.round(lastWeekVolume._sum.totalVolume || 0)
    const volChange = volLast > 0 ? Math.round(((volThis - volLast) / volLast) * 100) : 0

    // MVP: member with highest volume this week
    const volumeByUser: Record<string, number> = {}
    workoutsThisWeek.forEach((w) => {
      volumeByUser[w.userId] = (volumeByUser[w.userId] || 0) + (w.totalVolume || 0)
    })
    let mvp: { id: string; name: string; username: string; avatarUrl: string | null; volume: number } | null = null
    const mvpEntry = Object.entries(volumeByUser).sort((a, b) => b[1] - a[1])[0]
    if (mvpEntry) {
      const mvpUser = members.find((m) => m.id === mvpEntry[0])
      if (mvpUser) {
        mvp = { id: mvpUser.id, name: mvpUser.name, username: mvpUser.username, avatarUrl: mvpUser.avatarUrl, volume: Math.round(mvpEntry[1]) }
      }
    }

    // ─── STEPS TODAY + GOAL ───────────────────────
    const stepsTodayTotal = stepsToday._sum.steps || 0
    const stepsWeekTotal = weeklySteps._sum.steps || 0
    const stepsLastWeekTotal = lastWeekSteps._sum.steps || 0
    const stepsChange = stepsLastWeekTotal > 0 ? Math.round(((stepsWeekTotal - stepsLastWeekTotal) / stepsLastWeekTotal) * 100) : 0
    const stepsDailyGoal = totalMembers * 8500 // 8500 per member

    // ─── RADAR ATTRIBUTES (0-100) ─────────────────
    const activeThisWeek = new Set(workoutsThisWeek.map((w) => w.userId)).size
    const nutritionUsers = foodLogsThisWeek.length

    // Growth: XP trend (compare avg xp to level thresholds)
    const avgLevel = members.reduce((sum, m) => sum + m.level, 0) / totalMembers
    const growthScore = Math.min(100, Math.round((avgLevel / 20) * 50 + (activeThisWeek / totalMembers) * 50))

    const radar = {
      consistency: Math.min(100, Math.round(avgStreak / 30 * 100)),
      strength: Math.min(100, Math.round(((volThis) / totalMembers) / 500 * 100)),
      endurance: Math.min(100, Math.round(((stepsWeekTotal) / totalMembers) / 50000 * 100)),
      activity: Math.min(100, Math.round((activeThisWeek / totalMembers) * 100)),
      nutrition: Math.min(100, Math.round((nutritionUsers / totalMembers) * 100)),
      growth: growthScore,
    }

    // ─── ACTIVE WAR INFO ──────────────────────────
    let warBanner = null
    if (activeWar) {
      const isChallenger = activeWar.challengerGuildId === guildId
      const opponent = isChallenger ? activeWar.defenderGuild : activeWar.challengerGuild
      const myScore = isChallenger ? activeWar.challengerScore : activeWar.defenderScore
      const theirScore = isChallenger ? activeWar.defenderScore : activeWar.challengerScore
      const totalScore = myScore + theirScore
      const daysLeft = activeWar.endDate
        ? Math.max(0, Math.ceil((activeWar.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0

      warBanner = {
        warId: activeWar.id,
        type: activeWar.type,
        opponent: { id: opponent.id, name: opponent.name, tag: opponent.tag, color: opponent.colorPrimary },
        myScore: Math.round(myScore * 10) / 10,
        theirScore: Math.round(theirScore * 10) / 10,
        myPct: totalScore > 0 ? Math.round((myScore / totalScore) * 100) : 50,
        daysLeft,
        endDate: activeWar.endDate,
      }
    }

    res.json({
      pulse: {
        activeTodayCount,
        totalMembers,
        avgStreak: Math.round(avgStreak * 10) / 10,
        totalVolume: volThis,
        totalSteps: stepsWeekTotal,
        warBanner,
      },
      arena: {
        rhythm,
        heatmap,
        streakDistribution: streakDist,
        radar,
        weeklyVolume: volThis,
        weeklySteps: stepsWeekTotal,
        volumeChange: volChange,
        stepsChange,
        mvp,
        stepsToday: stepsTodayTotal,
        stepsDailyGoal,
      },
    })
  } catch (error) {
    console.error("Guild stats error:", error)
    res.status(500).json({ error: "Error al obtener stats" })
  }
})

// ═══════════════════════════════════════════════════════
//  GUILD HISTORY (Hall of Legends + War Record + Growth)
// ═══════════════════════════════════════════════════════
router.get("/:guildId/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guildId = req.params.guildId as string

    // Get all members with join dates
    const memberRows = await prisma.guildMember.findMany({
      where: { guildId },
      include: {
        user: { select: { id: true, name: true, username: true, avatarUrl: true, streak: true, bestStreak: true } },
      },
      orderBy: { joinedAt: "asc" },
    })

    if (memberRows.length === 0) {
      res.json({ legends: [], warHistory: [], growthTimeline: [] }); return
    }

    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      select: { creatorId: true, createdAt: true },
    })

    // ─── HALL OF LEGENDS ──────────────────────────
    const legends: { title: string; subtitle: string; criterion: string; userId: string; name: string; username: string; avatarUrl: string | null }[] = []

    // Iron Founder
    const founder = memberRows.find((m) => m.role === "FOUNDER")
    if (founder) {
      legends.push({
        title: "Iron Founder",
        subtitle: "Creó esta guild",
        criterion: "FOUNDER",
        userId: founder.user.id,
        name: founder.user.name,
        username: founder.user.username,
        avatarUrl: founder.user.avatarUrl,
      })
    }

    // 100-Day Inferno — first member to reach bestStreak >= 100
    const inferno100 = memberRows
      .filter((m) => m.user.bestStreak >= 100)
      .sort((a, b) => b.user.bestStreak - a.user.bestStreak)[0]
    if (inferno100) {
      legends.push({
        title: "100-Day Inferno",
        subtitle: `Racha de ${inferno100.user.bestStreak} días`,
        criterion: "BEST_STREAK_100",
        userId: inferno100.user.id,
        name: inferno100.user.name,
        username: inferno100.user.username,
        avatarUrl: inferno100.user.avatarUrl,
      })
    }

    // The Pillar — oldest active member (longest membership)
    const pillar = memberRows[0] // Already sorted by joinedAt asc
    if (pillar && pillar.user.streak > 0) {
      legends.push({
        title: "The Pillar",
        subtitle: "Miembro más antiguo activo",
        criterion: "OLDEST_ACTIVE",
        userId: pillar.user.id,
        name: pillar.user.name,
        username: pillar.user.username,
        avatarUrl: pillar.user.avatarUrl,
      })
    }

    // Top Streak — highest current streak in guild
    const topStreak = [...memberRows].sort((a, b) => b.user.streak - a.user.streak)[0]
    if (topStreak && topStreak.user.streak >= 14) {
      legends.push({
        title: "Streak King",
        subtitle: `Racha actual: ${topStreak.user.streak} días`,
        criterion: "TOP_STREAK",
        userId: topStreak.user.id,
        name: topStreak.user.name,
        username: topStreak.user.username,
        avatarUrl: topStreak.user.avatarUrl,
      })
    }

    // ─── WAR HISTORY ──────────────────────────────
    const wars = await prisma.guildWar.findMany({
      where: {
        status: "COMPLETED",
        OR: [{ challengerGuildId: guildId }, { defenderGuildId: guildId }],
      },
      include: {
        challengerGuild: { select: { id: true, name: true, tag: true } },
        defenderGuild: { select: { id: true, name: true, tag: true } },
      },
      orderBy: { endDate: "desc" },
      take: 20,
    })

    const warHistory = wars.map((w) => {
      const isChallenger = w.challengerGuildId === guildId
      const opponent = isChallenger ? w.defenderGuild : w.challengerGuild
      const won = w.winnerGuildId === guildId

      return {
        id: w.id,
        type: w.type,
        opponent: { name: opponent.name, tag: opponent.tag },
        won,
        xpEarned: won ? w.xpReward : Math.round(w.xpReward * 0.1),
        myScore: Math.round((isChallenger ? w.challengerScore : w.defenderScore) * 10) / 10,
        theirScore: Math.round((isChallenger ? w.defenderScore : w.challengerScore) * 10) / 10,
        endDate: w.endDate,
      }
    })

    const wins = warHistory.filter((w) => w.won).length
    const losses = warHistory.filter((w) => !w.won).length
    const winRate = warHistory.length > 0 ? Math.round((wins / warHistory.length) * 100) : 0

    // ─── War Hero legend — MVP of 3+ won wars
    const mvpCounts: Record<string, number> = {}
    for (const w of wars) {
      if (w.winnerGuildId === guildId && w.mvpUserId) {
        mvpCounts[w.mvpUserId] = (mvpCounts[w.mvpUserId] || 0) + 1
      }
    }
    const warHeroEntry = Object.entries(mvpCounts).filter(([_, c]) => c >= 3).sort((a, b) => b[1] - a[1])[0]
    if (warHeroEntry) {
      const heroMember = memberRows.find((m) => m.user.id === warHeroEntry[0])
      if (heroMember) {
        legends.push({
          title: "War Hero",
          subtitle: `MVP de ${warHeroEntry[1]} guerras ganadas`,
          criterion: "WAR_HERO",
          userId: heroMember.user.id,
          name: heroMember.user.name,
          username: heroMember.user.username,
          avatarUrl: heroMember.user.avatarUrl,
        })
      }
    }

    const milestones = new Set([5, 10, 20, 30, 50, 100]) // 1 is handled by guild creation
    const timeline: Array<{ date: string; members: number; milestone?: string }> = []
    let count = 1
    for (const m of memberRows) {
      count++
      const dateStr = m.joinedAt.toISOString().split("T")[0]
      if (milestones.has(count)) {
        timeline.push({ date: dateStr, members: count, milestone: `${count} miembros` })
      }
    }
    // Always include guild creation
    if (guild) {
      timeline.unshift({ date: guild.createdAt.toISOString().split("T")[0], members: 1, milestone: "Guild creada" })
    }
    // Include current state
    timeline.push({ date: new Date().toISOString().split("T")[0], members: memberRows.length })

    res.json({
      legends,
      warRecord: { wins, losses, winRate, total: warHistory.length },
      warHistory,
      growthTimeline: timeline,
    })
  } catch (error) {
    console.error("Guild history error:", error)
    res.status(500).json({ error: "Error al obtener historial" })
  }
})

// ═══════════════════════════════════════════════════════
//  JOIN GUILD
// ═══════════════════════════════════════════════════════
router.post("/:guildId/join", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guild = await prisma.guild.findUnique({
      where: { id: req.params.guildId as string },
      include: { _count: { select: { members: true } } },
    })

    if (!guild) { res.status(404).json({ error: "Guild no encontrada" }); return }

    // Check capacity
    if (guild._count.members >= guild.maxMembers) {
      res.status(400).json({ error: "Guild llena" }); return
    }

    // Check user guild limit
    const myGuildCount = await prisma.guildMember.count({ where: { userId: user.id } })
    if (myGuildCount >= MAX_GUILDS) {
      res.status(400).json({ error: `Ya estás en ${MAX_GUILDS} guilds (máximo)` }); return
    }

    // Check not already a member
    const existing = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: guild.id, userId: user.id } },
    })
    if (existing) {
      res.status(400).json({ error: "Ya eres miembro de esta guild" }); return
    }

    // WAR_PARTY requires invite (handled separately), OPEN and FORGE allow join
    if (guild.type === "WAR_PARTY") {
      res.status(400).json({ error: "War Party es solo por invitación" }); return
    }

    const member = await prisma.guildMember.create({
      data: {
        guildId: guild.id,
        userId: user.id,
        role: "RECRUIT",
        isPrimary: guild.type === "FORGE",
      },
    })

    res.status(201).json({ success: true, role: member.role })
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ error: "Ya eres miembro" }); return
    }
    console.error("Join guild error:", error)
    res.status(500).json({ error: "Error al unirse a la guild" })
  }
})

// ═══════════════════════════════════════════════════════
//  LEAVE GUILD
// ═══════════════════════════════════════════════════════
router.delete("/:guildId/leave", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const membership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: req.params.guildId as string, userId: user.id } },
    })

    if (!membership) {
      res.status(400).json({ error: "No eres miembro de esta guild" }); return
    }

    if (membership.role === "FOUNDER") {
      res.status(400).json({ error: "El Founder no puede abandonar. Transfiere el liderazgo primero." }); return
    }

    await prisma.guildMember.delete({
      where: { id: membership.id },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Leave guild error:", error)
    res.status(500).json({ error: "Error al dejar la guild" })
  }
})

// ═══════════════════════════════════════════════════════
//  INVITE TO WAR PARTY
// ═══════════════════════════════════════════════════════
router.post("/:guildId/invite", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { targetUserId } = req.body
    if (!targetUserId) { res.status(400).json({ error: "targetUserId requerido" }); return }

    const guild = await prisma.guild.findUnique({
      where: { id: req.params.guildId as string },
      include: { _count: { select: { members: true } } },
    })
    if (!guild) { res.status(404).json({ error: "Guild no encontrada" }); return }

    // Only FOUNDER/WARDEN/CAPTAIN can invite
    const myMembership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId: guild.id, userId: user.id } },
    })
    if (!myMembership || !["FOUNDER", "WARDEN", "CAPTAIN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Sin permisos para invitar" }); return
    }

    // Check capacity
    // Check target's guild limit
    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!targetUser) {
      res.status(404).json({ error: "Usuario objetivo no encontrado" }); return
    }
    const targetGuildCount = await prisma.guildMember.count({ where: { userId: targetUserId } })
    if (targetGuildCount >= MAX_GUILDS) {
      res.status(400).json({ error: "El usuario ya está en el máximo de guilds" }); return
    }

    // Create membership directly for invites
    const member = await prisma.guildMember.create({
      data: {
        guildId: guild.id,
        userId: targetUserId,
        role: "RECRUIT",
      },
    })

    // Send notification
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        fromId: user.id,
        type: "guild_invite",
        title: `${user.name} te invitó a ${guild.name}`,
        data: { guildId: guild.id, guildName: guild.name },
      },
    })

    res.status(201).json({ success: true, memberId: member.id })
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ error: "Usuario ya es miembro" }); return
    }
    console.error("Invite error:", error)
    res.status(500).json({ error: "Error al invitar" })
  }
})

// ═══════════════════════════════════════════════════════
//  PROMOTE / DEMOTE MEMBER
// ═══════════════════════════════════════════════════════
router.put("/:guildId/members/:memberId/role", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { role } = req.body
    if (!role || !["WARDEN", "CAPTAIN", "MEMBER", "RECRUIT"].includes(role)) {
      res.status(400).json({ error: "Rol inválido" }); return
    }

    const guildId = req.params.guildId as string

    // Check requester permissions
    const myMembership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: user.id } },
    })
    if (!myMembership) { res.status(403).json({ error: "No eres miembro" }); return }

    const targetMember = await prisma.guildMember.findUnique({
      where: { id: req.params.memberId as string },
    })
    if (!targetMember || targetMember.guildId !== guildId) {
      res.status(404).json({ error: "Miembro no encontrado en esta guild" }); return
    }
    if (targetMember.role === "FOUNDER") {
      res.status(400).json({ error: "No se puede cambiar el rol del Founder" }); return
    }
    if (role === "FOUNDER") {
      res.status(403).json({ error: "No se puede asignar el rol de Founder" }); return
    }

    // Only FOUNDER can promote to WARDEN, FOUNDER/WARDEN can promote to CAPTAIN
    if (role === "WARDEN" && myMembership.role !== "FOUNDER") {
      res.status(403).json({ error: "Solo el Founder puede promover a Warden" }); return
    }
    if (role === "CAPTAIN" && !["FOUNDER", "WARDEN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Solo Founder/Warden pueden promover a Captain" }); return
    }

    const roleHierarchy: Record<string, number> = { FOUNDER: 4, WARDEN: 3, CAPTAIN: 2, MEMBER: 1, RECRUIT: 0 }
    const myPrivilege = roleHierarchy[myMembership.role]
    const targetPrivilege = roleHierarchy[targetMember.role]
    const newPrivilege = roleHierarchy[role]

    if (newPrivilege < targetPrivilege && myPrivilege <= targetPrivilege) {
      res.status(403).json({ error: "No tienes permisos para degradar a este miembro" }); return
    }

    if ((role === "WARDEN" || targetMember.role === "WARDEN") && myMembership.role !== "FOUNDER") {
      res.status(403).json({ error: "Solo el Founder puede cambiar roles de Warden" }); return
    }

    if (role === "CAPTAIN" && targetMember.role !== "CAPTAIN") {
      const captainCount = await prisma.guildMember.count({ where: { guildId, role: "CAPTAIN" } })
      if (captainCount >= MAX_CAPTAINS) {
        res.status(400).json({ error: `Máximo ${MAX_CAPTAINS} Captains` }); return
      }
    }

    const updated = await prisma.guildMember.update({
      where: { id: targetMember.id },
      data: { role: role as any, promotedAt: new Date() },
    })

    res.json({ success: true, role: updated.role })
  } catch (error) {
    console.error("Promote error:", error)
    res.status(500).json({ error: "Error al cambiar rol" })
  }
})

// ═══════════════════════════════════════════════════════
//  UPDATE GUILD (Founder/Warden only)
// ═══════════════════════════════════════════════════════
router.put("/:guildId", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const guildId = req.params.guildId as string

    const myMembership = await prisma.guildMember.findUnique({
      where: { guildId_userId: { guildId, userId: user.id } },
    })
    if (!myMembership || !["FOUNDER", "WARDEN"].includes(myMembership.role)) {
      res.status(403).json({ error: "Sin permisos para editar" }); return
    }

    const { motto, description, colorPrimary, colorSecondary, iconUrl } = req.body

    const updated = await prisma.guild.update({
      where: { id: guildId },
      data: {
        ...(motto !== undefined && { motto }),
        ...(description !== undefined && { description }),
        ...(colorPrimary !== undefined && { colorPrimary }),
        ...(colorSecondary !== undefined && { colorSecondary }),
        ...(iconUrl !== undefined && { iconUrl }),
      },
    })

    res.json(updated)
  } catch (error) {
    console.error("Update guild error:", error)
    res.status(500).json({ error: "Error al actualizar guild" })
  }
})

export default router
