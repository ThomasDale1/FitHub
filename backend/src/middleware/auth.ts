import { clerkMiddleware, getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

// ─── Extensión de tipos de Express ───────────────────
// Permite acceder a req.clerkId en handlers de ruta
// sin necesidad de volver a llamar getAuth(req).
// Escala: un solo punto de cambio si Clerk cambia su API.
declare global {
  namespace Express {
    interface Request {
      clerkId?: string;
    }
  }
}

// Instanciado una sola vez como singleton para todo el servidor
export const clerkAuth = clerkMiddleware();

// ─── REQUIRE AUTH ─────────────────────────────────────
// Rechaza requests sin sesión activa (401).
// Adjunta req.clerkId para que los handlers no repitan getAuth(req).
export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({
      error: "No autorizado. Debes iniciar sesión.",
    });
    return;
  }

  req.clerkId = userId; // Cacheado en el request para reuso en handlers
  next();
};

// ─── OPTIONAL AUTH ────────────────────────────────────
// Para rutas públicas que se enriquecen si hay sesión activa.
// Nunca rechaza el request — simplemente adjunta clerkId si existe.
// Usar en: perfil público, feed de descubrimiento, listado de ejercicios.
export const optionalAuth = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const { userId } = getAuth(req);
  if (userId) req.clerkId = userId;
  next();
};

// ─── REQUIRE ADMIN ────────────────────────────────────
// Verifica que el Clerk ID del usuario esté en ADMIN_CLERK_IDS.
// Variable de entorno: ADMIN_CLERK_IDS="id1,id2,id3" (comma-separated).
// Escala sin cambios de schema: solo agregar IDs al .env en producción.
const ADMIN_IDS = new Set(
  (process.env.ADMIN_CLERK_IDS ?? "").split(",").filter(Boolean)
);

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({ error: "No autorizado. Debes iniciar sesión." });
    return;
  }

  if (!ADMIN_IDS.has(userId)) {
    res.status(403).json({ error: "Acceso restringido a administradores." });
    return;
  }

  req.clerkId = userId;
  next();
};
