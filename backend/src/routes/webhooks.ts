import { Router, Request, Response } from "express";
import { Webhook } from "svix";
import { prisma } from "../lib/prisma.js";

const router = Router();

// ⚠️ IMPORTANTE: Esta ruta NO usa el middleware
// de autenticación de Clerk porque es Clerk
// quien nos llama a nosotros, no un usuario.

router.post(
  "/clerk",
  // Express necesita el body RAW (sin parsear)
  // para que svix pueda verificar la firma
  async (req: Request, res: Response) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

    if (!webhookSecret) {
      res.status(500).json({ error: "Webhook secret no configurado" });
      return;
    }

    // Obtener los headers que Clerk envía
    const svixId = req.headers["svix-id"] as string;
    const svixTimestamp = req.headers["svix-timestamp"] as string;
    const svixSignature = req.headers["svix-signature"] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).json({ error: "Headers de Svix faltantes" });
      return;
    }

    // Verificar que el webhook viene realmente de Clerk
    const wh = new Webhook(webhookSecret);
    let payload: any;

    try {
      payload = wh.verify(JSON.stringify(req.body), {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch (err) {
      // Si la verificación falla, rechazamos
      res.status(400).json({ error: "Webhook inválido" });
      return;
    }

    // Procesar el evento
    const { type, data } = payload;

    switch (type) {

      // ─── USUARIO CREADO ────────────────────────
      // Se dispara cuando alguien se registra
      // por cualquier método: email, Google, etc.
      case "user.created": {
        const email =
          data.email_addresses?.[0]?.email_address ?? "";
        const firstName = data.first_name ?? "";
        const lastName = data.last_name ?? "";
        const meta = data.unsafe_metadata ?? {};
        const avatarUrl = data.image_url ?? null;
        const clerkId = data.id;

        // Username from sign-up form, fallback to email prefix + random suffix.
        // Sanitize both fields with length limits so a malicious client
        // sending huge unsafeMetadata values cannot bloat the DB.
        const rawName = typeof meta.displayName === "string" ? meta.displayName : "";
        const safeName = rawName.trim().slice(0, 100) ||
          `${firstName} ${lastName}`.trim() ||
          email.split("@")[0] ||
          "Usuario";

        let username = typeof meta.username === "string"
          ? meta.username.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30)
          : "";
        if (!username || username.length < 3) {
          username = email.split("@")[0].slice(0, 26) + "_" + Date.now().toString().slice(-4);
        }

        // Ensure uniqueness — if taken, append random suffix.
        // upsert below also has @unique on username; catching P2002 there
        // would be cleaner, but a pre-check keeps the error message readable.
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
          username = username.slice(0, 26) + "_" + Date.now().toString().slice(-4);
        }

        await prisma.user.upsert({
          where: { clerkId },
          update: { email, name: safeName, avatarUrl },
          create: {
            clerkId,
            email,
            name: safeName,
            avatarUrl,
            username,
          },
        });

        console.log(`✅ Usuario creado en DB: ${email} (@${username})`);
        break;
      }

      // ─── USUARIO ACTUALIZADO ───────────────────
      // Se dispara cuando cambia nombre, foto, etc.
      case "user.updated": {
        const clerkId = data.id;
        const email =
          data.email_addresses?.[0]?.email_address ?? "";
        const avatarUrl = data.image_url ?? null;

        // Only update email and avatar from Clerk — name is managed by our app
        await prisma.user.update({
          where: { clerkId },
          data: { email, avatarUrl },
        });

        console.log(`✅ Usuario actualizado en DB: ${email}`);
        break;
      }

      // ─── USUARIO ELIMINADO ─────────────────────
      // Se dispara cuando alguien borra su cuenta
      case "user.deleted": {
        const clerkId = data.id;

        await prisma.user.delete({
          where: { clerkId },
        });

        console.log(`✅ Usuario eliminado de DB: ${clerkId}`);
        break;
      }

      default:
        // Ignoramos eventos que no nos interesan
        break;
    }

    // Siempre responder 200 a Clerk
    // Si no respondemos 200, Clerk reintenta el webhook
    res.status(200).json({ received: true });
  }
);

export default router;