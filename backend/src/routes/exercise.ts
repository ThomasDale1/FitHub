import { Router, Request, Response } from "express";
import {
  getExercises,
  searchExercises,
  getExercisesByBodyPart,
  getBodyParts,
  getExerciseById,
} from "../lib/exerciseService.js";

const router = Router();

// ─── Helper para extraer string de query params ────────
// req.query puede ser string | string[] | ParsedQs
// Esta función garantiza que siempre sea string
const getQueryString = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

// GET /api/exercises
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = Number(getQueryString(req.query.limit)) || 20;
    const offset = Number(getQueryString(req.query.offset)) || 0;
    const exercises = await getExercises(limit, offset);
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ejercicios" });
  }
});

// GET /api/exercises/bodyparts
router.get("/bodyparts", async (req: Request, res: Response) => {
  try {
    const bodyParts = await getBodyParts();
    res.json(bodyParts);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener partes del cuerpo" });
  }
});

// GET /api/exercises/bodypart/:bodyPart
router.get("/bodypart/:bodyPart", async (req: Request, res: Response) => {
  try {
    const bodyPart = req.params.bodyPart as string;
    const exercises = await getExercisesByBodyPart(bodyPart);
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener ejercicios" });
  }
});

// GET /api/exercises/search?name=bench
router.get("/search", async (req: Request, res: Response) => {
  try {
    const name = getQueryString(req.query.name);
    if (!name) {
      res.status(400).json({ error: "El parámetro 'name' es requerido" });
      return;
    }
    const exercises = await searchExercises(name);
    res.json(exercises);
  } catch (error) {
    res.status(500).json({ error: "Error al buscar ejercicios" });
  }
});

// GET /api/exercises/:id
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const exercise = await getExerciseById(id);
    res.json(exercise);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el ejercicio" });
  }
});

export default router;