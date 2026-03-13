import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARES ───────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── RUTAS ────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Fit Hub API funcionando correctamente',
    version: '1.0.0',
  });
});

// Ruta de prueba para verificar la base de datos
app.get("/health", async (req, res) => {
  try {
    // Intentamos contar los usuarios en la DB
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

// ─── INICIAR SERVIDOR ─────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});