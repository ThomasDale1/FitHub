import { Request, Response, NextFunction } from "express";
import { Prisma } from "../generated/prisma/client.js";

// ─── MANEJADOR CENTRAL DE ERRORES ─────────────────────
// Registrar como ÚLTIMO middleware en index.ts (después de todas las rutas).
// Discrimina errores de Prisma para respuestas HTTP semánticamente correctas,
// evitando try/catch duplicado en cada ruta para errores de DB comunes.
//
// Uso en rutas: en el catch, llamar next(error) en lugar de res.status(500)
// para que este handler centralice la respuesta.
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // ── Violación de unique constraint: username/email duplicados, etc.
    if (err.code === "P2002") {
      const field =
        (err.meta?.target as string[] | undefined)?.[0] ?? "campo";
      res.status(409).json({ error: `El ${field} ya está en uso.` });
      return;
    }

    // ── Registro no encontrado al hacer update/delete por ID
    if (err.code === "P2025") {
      res.status(404).json({ error: "Recurso no encontrado." });
      return;
    }
  }

  // ── Error inesperado: loggear con contexto para facilitar debugging
  console.error("[ERROR]", {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
    // Stack trace solo fuera de producción para no exponer internals
    ...(process.env.NODE_ENV !== "production" && {
      stack: err instanceof Error ? err.stack : undefined,
    }),
  });

  res.status(500).json({
    error: "Error interno del servidor.",
    // Detalles solo fuera de producción para facilitar debugging local
    ...(process.env.NODE_ENV !== "production" && {
      details: err instanceof Error ? err.message : String(err),
    }),
  });
};
