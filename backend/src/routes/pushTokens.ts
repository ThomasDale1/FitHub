// ─────────────────────────────────────────────────────
// backend/src/routes/pushTokens.ts
// Push Token registration endpoints
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getAuth } from "@clerk/express";
import { sendPushToUser } from "../lib/pushNotifications.js";
import { getUserByClerkId } from "../lib/userHelpers.js";

const router = Router();
router.use(requireAuth);

// POST /api/push-token — Register push token
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await getUserByClerkId(clerkId!);
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }

    const { token, platform } = req.body;

    if (!token) {
      res.status(400).json({ error: "Token es requerido" }); return;
    }

    // Upsert: if token exists for another user, reassign it
    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: user.id, platform: platform || null },
      create: { userId: user.id, token, platform: platform || null },
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Push token register error:", error);
    res.status(500).json({ error: "Error al registrar push token" });
  }
});

// DELETE /api/push-token — Unregister push token
router.delete("/", async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: "Token es requerido" }); return;
    }

    await prisma.pushToken.deleteMany({ where: { token } });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar push token" });
  }
});

// POST /api/push-token/test — Send a test push to yourself
router.post("/test", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req);
    const user = await getUserByClerkId(clerkId!);
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }

    // Check if user has tokens
    const tokens = await prisma.pushToken.findMany({
      where: { userId: user.id },
      select: { token: true, platform: true },
    });
    console.log(`🔔 [Test Push] User ${user.id} has ${tokens.length} token(s):`, tokens);

    await sendPushToUser(
      user.id,
      "🏋️ Test Notification",
      "Si ves esto, las push notifications funcionan!",
      { type: "system" }
    );

    res.json({ success: true, tokensFound: tokens.length });
  } catch (error) {
    console.error("Test push error:", error);
    res.status(500).json({ error: "Error al enviar test push" });
  }
});

export default router;
