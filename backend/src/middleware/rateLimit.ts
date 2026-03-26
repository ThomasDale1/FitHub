import rateLimit from "express-rate-limit";

// ─── GLOBAL LIMITER ───────────────────────────────────
// Límite base para toda la API.
// 100 req / 15 min por IP — protege contra scraping y DDoS básico.
// Aplicado en index.ts sobre /api/*
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true, // Retorna headers RateLimit-* estándar (RFC 6585)
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
});

// ─── STRICT LIMITER ───────────────────────────────────
// Para endpoints sensibles: check-username, intentos de auth.
// 10 req / 1 min — previene brute force y enumeración de usuarios.
// Aplicar directamente en la ruta: router.get("/check-username", strictLimiter, handler)
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Demasiados intentos. Espera un momento antes de continuar.",
  },
});

// ─── API LIMITER ──────────────────────────────────────
// Para rutas de alta frecuencia: feed, búsqueda, social.
// 300 req / 15 min — más generoso que el global para funciones core.
// Usar en routers específicos que necesiten límite más permisivo.
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas solicitudes. Intenta de nuevo en 15 minutos." },
});
