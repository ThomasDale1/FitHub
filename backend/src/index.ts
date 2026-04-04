import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { prisma } from "./lib/prisma.js";
import { clerkAuth } from "./middleware/auth.js";
import { globalLimiter, strictLimiter } from "./middleware/rateLimit.js";
import { errorHandler } from "./middleware/errorHandler.js";
import exercisesRouter from "./routes/exercise.js";
import workoutsRouter from './routes/workouts.js'
import webhooksRouter from './routes/webhooks.js'
import usersRouter from "./routes/users.js"; // ← NUEVO Sprint 2
import nutritionRouter from "./routes/nutrition.js";  // ← NUEVO Sprint 3
import aiRouter from "./routes/ai.js";                // ← NUEVO Sprint 3
import socialRouter from "./routes/social.js";       // ← Sprint 4
import challengesRouter from "./routes/challenges.js"; 
import badgesRouter from "./routes/badges.js";
import stepsRouter from './routes/steps.js'
import pushTokensRouter from './routes/pushTokens.js'
import onboardingRouter from './routes/onboarding.js'
import placesRouter from './routes/places.js'
import profileRouter from './routes/profile.js'
import wellnessRouter from './routes/wellness.js'

const app = express();
const PORT = process.env.PORT || 3000;

// ─── WEBHOOK ROUTE ─────────────────────────────────────
// DEBE ir antes de express.json()
// porque necesita el body en formato raw
app.use(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Convertir raw buffer a objeto para nuestro router
    if (req.body && Buffer.isBuffer(req.body)) {
      req.body = JSON.parse(req.body.toString());
    }
    next();
  },
  webhooksRouter
);

// ─── MIDDLEWARES ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(clerkAuth);
// Rate limiting global sobre todos los endpoints /api/*
// strictLimiter se aplica a rutas sensibles individuales (ej: check-username)
app.use("/api/", globalLimiter);

// ─── RUTAS ────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "🚀 Fit Hub API funcionando correctamente",
    version: "1.0.0",
  });
});

app.get("/health", async (req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      status: "✅ OK",
      database: "✅ Conectado",
      users: userCount,
    });
  } catch (error) {
    res.status(500).json({
      status: "❌ Error",
      database: "❌ Sin conexión",
      error: String(error),
    });
  }
});

// API Routes
app.use("/api/nutrition", nutritionRouter);
app.use("/api/ai", aiRouter); 
app.use("/api/users", usersRouter);
app.use("/api/exercises", exercisesRouter);
app.use('/api/workouts', workoutsRouter)
app.use("/api/social", socialRouter);         
app.use("/api/challenges", challengesRouter); 
app.use("/api/badges", badgesRouter);
app.use("/api/steps", stepsRouter)
app.use("/api/push-token", pushTokensRouter)
app.use("/api/onboarding", onboardingRouter)
app.use("/api/places", placesRouter)
app.use("/api/profile", profileRouter)
app.use("/api/wellness", wellnessRouter)

// ─── MANEJADOR CENTRAL DE ERRORES ─────────────────────
// Debe ir después de todas las rutas para capturar next(error)
app.use(errorHandler);

// ─── INICIAR SERVIDOR ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});