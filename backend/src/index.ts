import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { prisma } from "./lib/prisma.js";
import { clerkAuth } from "./middleware/auth.js";
import exercisesRouter from "./routes/exercise.js";
import workoutsRouter from './routes/workouts.js'

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARES ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(clerkAuth);

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
app.use("/api/exercises", exercisesRouter);
app.use('/api/workouts', workoutsRouter)

// ─── INICIAR SERVIDOR ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});