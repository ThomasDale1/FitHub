// ─────────────────────────────────────────────────────
// backend/src/routes/social.ts
// Social — Follows, Discover, Notifications
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { sendPushToUser } from "../lib/pushNotifications.js"
import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

// ═══════════════════════════════════════════════════════
//  FOLLOWS
// ═══════════════════════════════════════════════════════

// POST /api/social/follow — Seguir a un usuario
router.post("/follow", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { targetUserId } = req.body
    if (!targetUserId || targetUserId === user.id) {
      res.status(400).json({ error: "No puedes seguirte a ti mismo" }); return
    }

    // Verificar que el target existe
    const target = await prisma.user.findUnique({ where: { id: targetUserId } })
    if (!target) { res.status(404).json({ error: "Usuario target no encontrado" }); return }

    // Crear follow (silencia duplicados)
    await prisma.follow.create({
      data: { followerId: user.id, followingId: targetUserId },
    }).catch(() => {
      // Ya existe, ignorar
    })

    // Notificación in-app + push
    const followTitle = `${user.name} te empezó a seguir`
    await prisma.notification.create({
      data: {
        userId: targetUserId,
        fromId: user.id,
        type: "follow",
        title: followTitle,
        data: { followerId: user.id },
      },
    })
    sendPushToUser(targetUserId, "Nuevo seguidor", followTitle, { type: "follow", userId: user.id })

    // XP por interacción social
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 3 } },
    })

    res.json({ success: true, xpEarned: 3 })
  } catch (error) {
    res.status(500).json({ error: "Error al seguir usuario" })
  }
})

// DELETE /api/social/follow/:userId — Dejar de seguir
router.delete("/follow/:userId", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const targetUserId = req.params.userId as string

    await prisma.follow.deleteMany({
      where: { followerId: user.id, followingId: targetUserId },
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Error al dejar de seguir" })
  }
})

// GET /api/social/followers — Mis seguidores
router.get("/followers", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const followers = await prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: { id: true, name: true, username: true, avatarUrl: true, xp: true, level: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({
      followers: followers.map((f) => f.follower),
      count: followers.length,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener seguidores" })
  }
})

// GET /api/social/following — A quienes sigo
router.get("/following", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: { id: true, name: true, username: true, avatarUrl: true, xp: true, level: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    res.json({
      following: following.map((f) => f.following),
      count: following.length,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener siguiendo" })
  }
})

// GET /api/social/discover — Smart discover with match reasons & sections
router.get("/discover", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await prisma.user.findUnique({
      where: { clerkId: clerkId! },
      include: {
        hobbies: true,
        places: { where: { isPrimary: true }, take: 1 },
        following: { select: { followingId: true } },
      },
    })
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const followingIds = user.following.map((f) => f.followingId)
    const myHobbySlugs = user.hobbies.map((h) => h.hobbySlug)
    const myPlaceId = user.places[0]?.placeId || null
    const myAge = user.dateOfBirth
      ? Math.floor((Date.now() - user.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null

    // Fetch candidates with all data needed for scoring
    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: [user.id, ...followingIds] },
        onboardingCompleted: true,
      },
      select: {
        id: true, name: true, username: true, avatarUrl: true,
        xp: true, level: true, streak: true, bio: true,
        experienceLevel: true, dateOfBirth: true,
        hobbies: { select: { hobbySlug: true } },
        places: { where: { isPrimary: true }, select: { placeId: true, place: { select: { name: true } } } },
        _count: { select: { workouts: { where: { isCompleted: true } }, followers: true } },
      },
      take: 150,
      orderBy: { updatedAt: "desc" }, // or xp, createdAt, etc.
    })

    // Mutual friends: people who follow ME that also follow the candidate
    const myFollowerIds = (await prisma.follow.findMany({
      where: { followingId: user.id },
      select: { followerId: true },
    })).map((f) => f.followerId)

    const mutualMap = new Map<string, number>()
    if (myFollowerIds.length > 0) {
      const mutuals = await prisma.follow.groupBy({
        by: ["followingId"],
        where: {
          followerId: { in: myFollowerIds },
          followingId: { in: candidates.map((c) => c.id) },
        },
        _count: true,
      })
      for (const m of mutuals) {
        mutualMap.set(m.followingId, m._count)
      }
    }

    // Score & build matchReasons for each candidate
    const scored = candidates.map((c) => {
      let score = 0
      const matchReasons: string[] = []

      // Same gym: +40
      const matchingPlace = myPlaceId ? c.places.find((p) => p.placeId === myPlaceId) : null
      const placeName = matchingPlace?.place?.name || c.places[0]?.place?.name || null

      if (matchingPlace) {
        score += 40
        if (placeName) {
          matchReasons.push(`Entrenan en ${placeName}`)
        }
      }

      // Mutual connections: +30
      const mutualCount = mutualMap.get(c.id) || 0
      if (mutualCount > 0) {
        score += Math.min(mutualCount * 10, 30)
        matchReasons.push(`${mutualCount} ${mutualCount === 1 ? "amigo" : "amigos"} en común`)
      }

      // Shared hobbies: +20 each
      const theirHobbies = c.hobbies.map((h) => h.hobbySlug)
      const shared = myHobbySlugs.filter((s) => theirHobbies.includes(s))
      if (shared.length > 0) {
        score += shared.length * 20
        const hobbyLabels: Record<string, string> = {
          gym: "Gym", running: "Running", yoga: "Yoga", crossfit: "CrossFit",
          swimming: "Natación", cycling: "Ciclismo", calisthenics: "Calistenia",
          martial_arts: "Artes marciales", hiking: "Senderismo",
        }
        const names = shared.slice(0, 2).map((s) => hobbyLabels[s] || s)
        matchReasons.push(`También hace ${names.join(" y ")}`)
      }

      // Similar streak (±5): +15
      if (user.streak > 0 && c.streak > 0 && Math.abs(user.streak - c.streak) <= 5) {
        score += 15
        matchReasons.push(`Racha similar: ${c.streak} días`)
      }

      // Similar level (±2): +10
      if (Math.abs(user.level - c.level) <= 2) {
        score += 10
        matchReasons.push(`Nivel ${c.level}`)
      }

      // Similar age (±5 years): +10
      if (myAge && c.dateOfBirth) {
        const theirAge = Math.floor((Date.now() - c.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        if (Math.abs(myAge - theirAge) <= 5) {
          score += 10
          matchReasons.push("Edad similar")
        }
      }

      // Same experience level: +10
      if (user.experienceLevel && c.experienceLevel === user.experienceLevel) {
        score += 10
      }

      // Has avatar: +5
      if (c.avatarUrl) score += 5

      return {
        id: c.id,
        name: c.name,
        username: c.username,
        avatarUrl: c.avatarUrl,
        xp: c.xp,
        level: c.level,
        streak: c.streak,
        bio: c.bio,
        experienceLevel: c.experienceLevel,
        workoutsCount: c._count.workouts,
        followersCount: c._count.followers,
        placeName,
        sameGym: myPlaceId ? c.places.some((p) => p.placeId === myPlaceId) : false,
        matchReasons: matchReasons.slice(0, 3),
        score,
        mutualCount,
      }
    }).filter((s) => s.score > 0)

    scored.sort((a, b) => b.score - a.score)

    // Categorize into sections
    const sameGym = scored.filter((s) => s.sameGym).slice(0, 10)
    const sameGymIds = new Set(sameGym.map((s) => s.id))

    const yourLevel = scored
      .filter((s) => !sameGymIds.has(s.id) && Math.abs(s.level - user.level) <= 2)
      .slice(0, 10)
    const yourLevelIds = new Set(yourLevel.map((s) => s.id))

    const usedIds = new Set([...sameGymIds, ...yourLevelIds])
    const forYou = scored.filter((s) => !usedIds.has(s.id)).slice(0, 10)

    res.json({
      sections: [
        ...(sameGym.length > 0 ? [{ key: "sameGym", title: "Entrenan en tu gym", data: sameGym }] : []),
        ...(yourLevel.length > 0 ? [{ key: "yourLevel", title: "Tu nivel", data: yourLevel }] : []),
        ...(forYou.length > 0 ? [{ key: "forYou", title: "Para ti", data: forYou }] : []),
      ],
      // Flat list for backwards compat
      suggestions: scored.slice(0, 20),
    })
  } catch (error) {
    console.error("Discover error:", error)
    res.status(500).json({ error: "Error al descubrir usuarios" })
  }
})

// GET /api/social/profile/:userId — Perfil de otro usuario
router.get("/profile/:userId", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const me = await getUserByClerkId(clerkId!)
    if (!me) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const targetId = req.params.userId as string

    const [profile, isFollowing] = await Promise.all([
      prisma.user.findUnique({
        where: { id: targetId },
        select: {
          id: true, name: true, username: true, avatarUrl: true,
          bio: true, xp: true, level: true, streak: true,
          createdAt: true,
          _count: {
            select: {
              workouts: { where: { isCompleted: true } },
              followers: true,
              following: true,
            },
          },
        },
      }),
      prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: me.id, followingId: targetId } },
      }),
    ])

    if (!profile) { res.status(404).json({ error: "Perfil no encontrado" }); return }

    res.json({
      profile: {
        ...profile,
        followersCount: profile._count.followers,
        followingCount: profile._count.following,
        workoutsCount: profile._count.workouts,
      },
      isFollowing: !!isFollowing,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfil" })
  }
})

// ═══════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════

// GET /api/social/notifications
router.get("/notifications", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ])

    res.json({ notifications, unreadCount })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener notificaciones" })
  }
})

// PUT /api/social/notifications/read — Marcar todas como leídas
router.put("/notifications/read", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: { isRead: true },
    })

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar notificaciones" })
  }
})

export default router
