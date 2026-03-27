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

// GET /api/social/discover — Descubrir usuarios
router.get("/discover", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // IDs que ya sigo
    const myFollowing = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    })
    const followingIds = myFollowing.map((f) => f.followingId)

    // Usuarios sugeridos: los más activos que no sigo
    const suggestions = await prisma.user.findMany({
      where: {
        id: { notIn: [user.id, ...followingIds] },
      },
      select: {
        id: true, name: true, username: true, avatarUrl: true,
        xp: true, level: true, streak: true, bio: true,
        _count: { select: { workouts: { where: { isCompleted: true } } } },
      },
      orderBy: { xp: "desc" },
      take: 20,
    })

    res.json({ suggestions })
  } catch (error) {
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
