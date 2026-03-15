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
        const name =
          `${firstName} ${lastName}`.trim() ||
          email.split("@")[0] ||
          "Usuario";
        const avatarUrl = data.image_url ?? null;
        const clerkId = data.id;

        await prisma.user.upsert({
          where: { clerkId },
          update: { email, name, avatarUrl },
          create: {
            clerkId,
            email,
            name,
            avatarUrl,
            username:
              email.split("@")[0] +
              "_" +
              Date.now().toString().slice(-4),
          },
        });

        console.log(`✅ Usuario creado en DB: ${email}`);
        break;
      }

      // ─── USUARIO ACTUALIZADO ───────────────────
      // Se dispara cuando cambia nombre, foto, etc.
      case "user.updated": {
        const clerkId = data.id;
        const email =
          data.email_addresses?.[0]?.email_address ?? "";
        const firstName = data.first_name ?? "";
        const lastName = data.last_name ?? "";
        const name =
          `${firstName} ${lastName}`.trim() ||
          email.split("@")[0];
        const avatarUrl = data.image_url ?? null;

        await prisma.user.update({
          where: { clerkId },
          data: { email, name, avatarUrl },
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