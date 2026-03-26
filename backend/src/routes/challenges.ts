import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { prisma } from "../lib/prisma.js";
import { sendPushToUser } from "../lib/pushNotifications.js";
import { finalizeExpiredChallenges } from "../lib/challengeProgress.js";
import { getPrismaUserId } from "../lib/userHelpers.js";

const router = Router();

// ─── GET /api/challenges ──────────────────────────────
// ?filter=active | mine | available
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const userId = await getPrismaUserId(clerkId!);
    if (!userId) { res.status(401).json({ error: "No autorizado" }); return; }

    // Finalizar challenges expirados antes de listar
    finalizeExpiredChallenges().catch((err: unknown) =>
      console.error("Finalize expired (non-blocking):", err)
    );

    const { filter = "active" } = req.query;
    const now = new Date();
    let where: any = {};

    if (filter === "active") {
      // Challenges donde el usuario YA participa y siguen activos
      where = {
        status: "ACTIVE",
        endDate: { gte: now },
        participants: { some: { userId } },
      };
    } else if (filter === "mine") {
      // Challenges que el usuario CREÓ (cualquier estado)
      where = { creatorId: userId };
    } else if (filter === "available") {
      // Challenges públicos activos donde el usuario NO participa todavía
      where = {
        isPublic: true,
        status: "ACTIVE",
        endDate: { gte: now },
        participants: { none: { userId } },
      };
    }

    const challenges = await prisma.challenge.findMany({
      where,
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true, level: true },
        },
        // Top 3 participantes para preview en la card
        participants: {
          include: {
            user: { select: { id: true, name: true, username: true, avatarUrl: true } },
          },
          orderBy: { currentValue: "desc" },
          take: 3,
        },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Agregar contexto del usuario a cada challenge
    const enriched = challenges.map((c) => {
      const myParticipation = c.participants.find((p) => p.userId === userId);
      return {
        ...c,
        isJoined: !!myParticipation,
        myProgress: myParticipation
          ? {
              currentValue: myParticipation.currentValue,
              isWinner: myParticipation.isWinner,
              rank: myParticipation.rank,
            }
          : null,
        participantsCount: c._count.participants,
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("GET /challenges error:", error);
    res.status(500).json({ error: "Error al obtener challenges" });
  }
});

// ─── GET /api/challenges/leaderboard/global ───────────
// IMPORTANTE: esta ruta debe ir ANTES de /:id
// porque Express evaluaría "leaderboard" como un :id
router.get("/leaderboard/global", async (req: Request, res: Response) => {
  try {
    const { category = "xp", period = "alltime" } = req.query;
    let users: any[] = [];

    if (category === "xp") {
      const rawUsers = await prisma.user.findMany({
        select: {
          id: true, name: true, username: true,
          avatarUrl: true, xp: true, level: true, streak: true,
        },
        orderBy: { xp: "desc" },
        take: 50,
      });
      users = rawUsers.map((u, i) => ({ ...u, rank: i + 1, value: u.xp, unit: "XP" }));

    } else if (category === "volume") {
      const since =
        period === "weekly"
          ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const volumeData = await prisma.workout.groupBy({
        by: ["userId"],
        where: { isCompleted: true, endTime: { gte: since } },
        _sum: { totalVolume: true },
        orderBy: { _sum: { totalVolume: "desc" } },
        take: 50,
      });

      const userIds = volumeData.map((v) => v.userId);
      const userDetails = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, username: true, avatarUrl: true, level: true, xp: true },
      });

      users = volumeData.map((v, i) => {
        const user = userDetails.find((u) => u.id === v.userId);
        return {
          ...user,
          rank: i + 1,
          value: Math.round(v._sum.totalVolume ?? 0),
          unit: "kg",
        };
      });

    } else if (category === "streak") {
      const rawUsers = await prisma.user.findMany({
        select: {
          id: true, name: true, username: true,
          avatarUrl: true, xp: true, level: true, streak: true,
        },
        where: { streak: { gt: 0 } },
        orderBy: { streak: "desc" },
        take: 50,
      });
      users = rawUsers.map((u, i) => ({ ...u, rank: i + 1, value: u.streak, unit: "días" }));
    }

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener leaderboard" });
  }
});

// ─── GET /api/challenges/:id ──────────────────────────
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const userId = await getPrismaUserId(clerkId!);
    if (!userId) { res.status(401).json({ error: "No autorizado" }); return; }

    const id = req.params.id as string;

    const challenge = await prisma.challenge.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, name: true, username: true, avatarUrl: true, level: true },
        },
        participants: {
          include: {
            user: {
              select: { id: true, name: true, username: true, avatarUrl: true, level: true, xp: true },
            },
          },
          orderBy: { currentValue: "desc" },
        },
        _count: { select: { participants: true } },
      },
    });

    if (!challenge) {
      res.status(404).json({ error: "Challenge no encontrado" });
      return;
    }

    // Calcular rank y porcentaje de cada participante
    const leaderboard = challenge.participants.map((p, index) => ({
      ...p,
      rank: index + 1,
      percentage:
        challenge.goal > 0
          ? Math.min(100, Math.round((p.currentValue / challenge.goal) * 100))
          : 0,
    }));

    const myParticipation = challenge.participants.find((p) => p.userId === userId);
    const myRank = myParticipation
      ? leaderboard.findIndex((p) => p.userId === userId) + 1
      : null;

    res.json({
      ...challenge,
      participants: leaderboard,
      isJoined: !!myParticipation,
      myProgress: myParticipation
        ? {
            currentValue: myParticipation.currentValue,
            isWinner: myParticipation.isWinner,
            rank: myRank,
          }
        : null,
      participantsCount: challenge._count.participants,
    });
  } catch (error) {
    res.status(500).json({ error: "Error al obtener challenge" });
  }
});

// ─── POST /api/challenges ─────────────────────────────
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const userId = await getPrismaUserId(clerkId!);
    if (!userId) { res.status(401).json({ error: "No autorizado" }); return; }

    const { title, description, type, mode, goal, unit, startDate, endDate, isPublic, maxParticipants, xpReward } = req.body;

    if (!title || !type || goal == null || !startDate || !endDate || !unit) {
      res.status(400).json({ error: "Faltan campos requeridos: title, type, goal, unit, startDate, endDate" });
      return;
    }

    const challenge = await prisma.challenge.create({
      data: {
        creatorId: userId,
        title,
        description: description || null,
        type,
        mode: mode || "MILESTONE",
        status: "ACTIVE",
        goal: Number(goal),
        unit,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isPublic: isPublic ?? true,
        maxParticipants: maxParticipants ? Number(maxParticipants) : null,
        xpReward: xpReward ? Number(xpReward) : 100,
      },
    });

    // El creador se une automáticamente
    await prisma.challengeParticipant.create({
      data: { challengeId: challenge.id, userId },
    });

    // +15 XP por crear un challenge
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 15 } },
    });

    res.status(201).json(challenge);
  } catch (error) {
    console.error("POST /challenges error:", error);
    res.status(500).json({ error: "Error al crear challenge" });
  }
});

// ─── POST /api/challenges/:id/join ────────────────────
router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const userId = await getPrismaUserId(clerkId!);
    if (!userId) { res.status(401).json({ error: "No autorizado" }); return; }

    const id = req.params.id as string;

    const challenge = await prisma.challenge.findUnique({ where: { id } });

    if (!challenge) { res.status(404).json({ error: "Challenge no encontrado" }); return; }
    if (challenge.status !== "ACTIVE") { res.status(400).json({ error: "El challenge no está activo" }); return; }
    if (challenge.endDate < new Date()) { res.status(400).json({ error: "El challenge ya terminó" }); return; }

    // Enforce maxParticipants atomically inside a serializable transaction.
    // A plain count-then-create has a TOCTOU race: two concurrent joins can
    // both read count < max, both create, and the limit gets exceeded.
    let participation;
    try {
      participation = await prisma.$transaction(async (tx) => {
        if (challenge.maxParticipants) {
          const currentCount = await tx.challengeParticipant.count({ where: { challengeId: id } });
          if (currentCount >= challenge.maxParticipants) {
            throw Object.assign(new Error("Challenge lleno"), { isFull: true });
          }
        }
        return tx.challengeParticipant.create({ data: { challengeId: id, userId } });
      }, { isolationLevel: "Serializable" });
    } catch (txErr: any) {
      // P2002 = @@unique([challengeId, userId]) — same user joining twice
      if (txErr?.code === "P2002") {
        res.status(400).json({ error: "Ya estás participando en este challenge" }); return;
      }
      if (txErr?.isFull) {
        res.status(400).json({ error: "El challenge está lleno" }); return;
      }
      throw txErr;
    }

    // Notify challenge creator that someone joined
    if (challenge.creatorId !== userId) {
      const joiner = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
      const joinTitle = `${joiner?.name || "Alguien"} se unió a tu reto "${challenge.title}"`;
      await prisma.notification.create({
        data: {
          userId: challenge.creatorId,
          fromId: userId,
          type: "challenge_invite",
          title: joinTitle,
          data: { challengeId: id },
        },
      });
      sendPushToUser(challenge.creatorId, "Nuevo participante", joinTitle, { type: "challenge_join", challengeId: id });
    }

    res.status(201).json(participation);
  } catch (error: any) {
    res.status(500).json({ error: "Error al unirse al challenge" });
  }
});

// ─── POST /api/challenges/:id/leave ───────────────────
router.post("/:id/leave", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const userId = await getPrismaUserId(clerkId!);
    if (!userId) { res.status(401).json({ error: "No autorizado" }); return; }

    const id = req.params.id as string;

    await prisma.challengeParticipant.delete({
      where: {
        // Prisma genera este nombre compuesto del @@unique
        challengeId_userId: { challengeId: id, userId },
      },
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al salir del challenge" });
  }
});

export default router;