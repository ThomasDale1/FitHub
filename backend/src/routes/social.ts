// ─────────────────────────────────────────────────────
// backend/src/routes/social.ts
// Sprint 4: Social — Feed, Posts, Follows, Reactions
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { sendPushToUser } from "../lib/pushNotifications.js"
import { isValidCloudinaryUrl, deleteCloudinaryResource } from "../lib/cloudinary.js"

const router = Router()
router.use(requireAuth)

// ─── Helper ───────────────────────────────────────────
async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } })
}

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

    // Crear follow (upsert para evitar duplicados)
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

    const profile = await prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true, name: true, username: true, avatarUrl: true,
        bio: true, xp: true, level: true, streak: true,
        createdAt: true,
        _count: {
          select: {
            workouts: { where: { isCompleted: true } },
            posts: true,
            followers: true,
            following: true,
          },
        },
      },
    })

    if (!profile) { res.status(404).json({ error: "Perfil no encontrado" }); return }

    // ¿Lo sigo?
    const isFollowing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: me.id, followingId: targetId } },
    })

    // Posts recientes
    const posts = await prisma.post.findMany({
      where: { userId: targetId, isPublic: true },
      include: {
        media: {
          select: { id: true, url: true, type: true, width: true, height: true, duration: true, thumbnailUrl: true },
        },
        _count: { select: { reactions: true, comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })

    res.json({
      profile: {
        ...profile,
        followersCount: profile._count.followers,
        followingCount: profile._count.following,
        workoutsCount: profile._count.workouts,
        postsCount: profile._count.posts,
      },
      isFollowing: !!isFollowing,
      posts,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener perfil" })
  }
})

// ═══════════════════════════════════════════════════════
//  POSTS
// ═══════════════════════════════════════════════════════

// POST /api/social/posts — Crear post (con soporte de media)
router.post("/posts", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { content, imageUrls, postType, workoutId, workoutData, media } = req.body

    // Validate media if provided
    if (media && Array.isArray(media)) {
      if (media.length > 4) {
        res.status(400).json({ error: "Máximo 4 archivos por post" }); return
      }
      const videoCount = media.filter((m: any) => m.type === "VIDEO").length
      if (videoCount > 1) {
        res.status(400).json({ error: "Máximo 1 video por post" }); return
      }
      for (const m of media) {
        if (!isValidCloudinaryUrl(m.url)) {
          res.status(400).json({ error: "URL de media inválida" }); return
        }
      }
    }

    // Determine postType automatically from media
    let resolvedPostType = postType || "TEXT"
    if (media?.length && resolvedPostType === "TEXT") {
      const hasVideo = media.some((m: any) => m.type === "VIDEO")
      resolvedPostType = hasVideo ? "VIDEO" : "IMAGE"
    }

    // Build imageUrls from media for backwards compatibility
    const resolvedImageUrls = media?.length
      ? media.filter((m: any) => m.type === "IMAGE").map((m: any) => m.url)
      : (imageUrls || [])

    const post = await prisma.post.create({
      data: {
        userId: user.id,
        content: content || null,
        imageUrls: resolvedImageUrls,
        postType: resolvedPostType,
        workoutId: workoutId || null,
        workoutData: workoutData || null,
        // Create Media records
        ...(media?.length ? {
          media: {
            createMany: {
              data: media.map((m: any) => ({
                userId: user.id,
                publicId: m.publicId,
                url: m.url,
                type: m.type,
                width: m.width || null,
                height: m.height || null,
                bytes: m.bytes || null,
                duration: m.duration || null,
                thumbnailUrl: m.thumbnailUrl || null,
              })),
            },
          },
        } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true, level: true },
        },
        media: {
          select: { id: true, url: true, type: true, width: true, height: true, duration: true, thumbnailUrl: true },
        },
        _count: { select: { reactions: true, comments: true } },
      },
    })

    // XP por postear
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 10 } },
    })

    res.json({ post, xpEarned: 10 })
  } catch (error) {
    console.error("Error creating post:", error)
    res.status(500).json({ error: "Error al crear post" })
  }
})

// GET /api/social/feed — Feed del usuario
router.get("/feed", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // IDs que sigo + yo mismo
    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      select: { followingId: true },
    })
    const feedUserIds = [user.id, ...following.map((f) => f.followingId)]

    const cursor = req.query.cursor as string | undefined
    const take = 15

    const posts = await prisma.post.findMany({
      where: {
        userId: { in: feedUserIds },
        isPublic: true,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true, level: true },
        },
        reactions: {
          select: { id: true, userId: true, type: true },
        },
        media: {
          select: { id: true, url: true, type: true, width: true, height: true, duration: true, thumbnailUrl: true },
        },
        _count: { select: { comments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: take + 1, // pedir 1 extra para saber si hay más
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = posts.length > take
    if (hasMore) posts.pop()

    // Agregar info de mi reacción a cada post
    const postsWithMyReaction = posts.map((post) => {
      const myReaction = post.reactions.find((r) => r.userId === user.id)
      return {
        ...post,
        reactionsCount: post.reactions.length,
        myReaction: myReaction?.type || null,
        reactions: undefined, // no enviar todas las reactions
      }
    })

    res.json({
      posts: postsWithMyReaction,
      nextCursor: hasMore ? posts[posts.length - 1].id : null,
    })
  } catch (error) {
    console.error("Feed error:", error)
    res.status(500).json({ error: "Error al obtener feed" })
  }
})

// DELETE /api/social/posts/:id — Borrar post + cleanup media
router.delete("/posts/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const postId = req.params.id as string

    // Fetch post with its media for Cloudinary cleanup
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        userId: true,
        media: { select: { publicId: true, type: true } },
      },
    })

    if (!post) { res.status(404).json({ error: "Post no encontrado" }); return }
    if (post.userId !== user.id) { res.status(403).json({ error: "No autorizado" }); return }

    const mediaToDelete = post.media

    // Delete post (cascades to media records in DB)
    await prisma.post.delete({ where: { id: postId } })

    // Cleanup media from Cloudinary (fire and forget)
    for (const m of mediaToDelete) {
      deleteCloudinaryResource(m.publicId, m.type === "VIDEO" ? "video" : "image").catch(() => {})
    }

    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: "Error al borrar post" })
  }
})

// ═══════════════════════════════════════════════════════
//  REACTIONS
// ═══════════════════════════════════════════════════════

// POST /api/social/react — Reaccionar a un post
router.post("/react", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { postId, type } = req.body // type: FIRE, MUSCLE, CLAP, TROPHY, TARGET

    if (!postId || !type) {
      res.status(400).json({ error: "postId y type son requeridos" }); return
    }

    // Check si ya reaccionó
    const existing = await prisma.reaction.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
    })

    if (existing) {
      if (existing.type === type) {
        // Mismo tipo: quitar reacción
        await prisma.reaction.delete({ where: { id: existing.id } })
        res.json({ action: "removed", type: null })
        return
      } else {
        // Diferente tipo: actualizar
        await prisma.reaction.update({
          where: { id: existing.id },
          data: { type },
        })
        res.json({ action: "updated", type })
        return
      }
    }

    // Nueva reacción
    await prisma.reaction.create({
      data: { postId, userId: user.id, type },
    })

    // Notificar al autor del post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== user.id) {
      const reactionEmojis: Record<string, string> = {
        FIRE: "🔥", MUSCLE: "💪", CLAP: "👏", TROPHY: "🏆", TARGET: "🎯",
      }
      const reactionTitle = `${user.name} reaccionó ${reactionEmojis[type] || ""} a tu post`
      await prisma.notification.create({
        data: {
          userId: post.userId,
          fromId: user.id,
          type: "reaction",
          title: reactionTitle,
          data: { postId },
        },
      })
      sendPushToUser(post.userId, "Nueva reacción", reactionTitle, { type: "reaction", postId })
    }

    // XP
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 2 } },
    })

    res.json({ action: "added", type, xpEarned: 2 })
  } catch (error) {
    res.status(500).json({ error: "Error al reaccionar" })
  }
})

// ═══════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════

// POST /api/social/comments — Comentar en un post
router.post("/comments", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { postId, content, parentId } = req.body

    if (!postId || !content?.trim()) {
      res.status(400).json({ error: "postId y content son requeridos" }); return
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        userId: user.id,
        content: content.trim(),
        parentId: parentId || null,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    })

    // Notificar al autor
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    })

    if (post && post.userId !== user.id) {
      const commentTitle = `${user.name} comentó en tu post`
      await prisma.notification.create({
        data: {
          userId: post.userId,
          fromId: user.id,
          type: "comment",
          title: commentTitle,
          body: content.trim().substring(0, 100),
          data: { postId, commentId: comment.id },
        },
      })
      sendPushToUser(post.userId, "Nuevo comentario", commentTitle, { type: "comment", postId })
    }

    // XP
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 3 } },
    })

    res.json({ comment, xpEarned: 3 })
  } catch (error) {
    res.status(500).json({ error: "Error al comentar" })
  }
})

// GET /api/social/comments/:postId — Obtener comments de un post
router.get("/comments/:postId", async (req: Request, res: Response) => {
  try {
    const postId = req.params.postId as string

    const comments = await prisma.comment.findMany({
      where: { postId, parentId: null }, // solo top-level
      include: {
        user: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        replies: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    res.json({ comments })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener comentarios" })
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

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    })

    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    })

    res.json({ notifications, unreadCount })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener notificaciones" })
  }
})

// PUT /api/social/notifications/read — Marcar como leídas
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