/**
 * Seed de ejercicios — ExerciseDB dataset (Kaggle)
 *
 * ══════════════════════════════════════════════════════════════
 *  SETUP (una sola vez):
 * ══════════════════════════════════════════════════════════════
 *  1. Copia exercises.json  →  backend/prisma/exercises-data.json
 *  2. Copia gifs_180x180/   →  backend/prisma/gifs/
 *     (la carpeta gifs/ debe contener archivos como 2ORFMoR.gif)
 *  3. Ejecuta: cd backend && npx prisma db seed
 *
 *  Sin la carpeta gifs/ → ejercicios se crean sin imagen.
 *  Sin exercises-data.json → usa free-exercise-db (800+ ejercicios, sin GIFs).
 * ══════════════════════════════════════════════════════════════
 */

import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// El SDK lee CLOUDINARY_URL del .env automáticamente
// Formato: cloudinary://API_KEY:API_SECRET@CLOUD_NAME

// ─── Rutas ────────────────────────────────────────────────────────────────────

const LOCAL_JSON = path.resolve(__dirname, "exercises-data.json");
const LOCAL_GIFS = path.resolve(__dirname, "gifs");
const FREE_DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const FREE_DB_IMG =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

// ─── Tipos ────────────────────────────────────────────────────────────────────

// Formato Kaggle ExerciseDB v2
interface KaggleRow {
  exerciseId: string;
  name: string;
  gifUrl: string;             // nombre de archivo: "2ORFMoR.gif"
  targetMuscles: string[];
  bodyParts: string[];
  equipments: string[];
  secondaryMuscles: string[];
  instructions: string[];
}

// Formato free-exercise-db (yuhonas)
interface FreeRow {
  id: string;
  name: string;
  category: string;
  equipment?: string;
  level?: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images?: string[];
}

// ─── Mapeos free-exercise-db ──────────────────────────────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  abs: "waist", back: "back", biceps: "upper arms", calves: "lower legs",
  cardio: "cardio", chest: "chest", forearms: "lower arms", glutes: "upper legs",
  hamstrings: "upper legs", lats: "back", "lower back": "back",
  "middle back": "back", neck: "neck", quadriceps: "upper legs",
  shoulders: "shoulders", traps: "back", triceps: "upper arms", legs: "upper legs",
};

const EQUIPMENT_MAP: Record<string, string> = {
  barbell: "barbell", dumbbell: "dumbbell", machine: "machine", cable: "cable",
  "body only": "body weight", kettlebells: "kettlebell",
  "resistance band": "resistance band", bands: "band",
  "medicine ball": "medicine ball", "foam roll": "foam roll",
  "e-z curl bar": "ez barbell", "exercise ball": "exercise ball", other: "other",
};

// ─── Subir GIF a Cloudinary ───────────────────────────────────────────────────

const gifCache = new Map<string, string>();

async function uploadGif(exerciseId: string): Promise<string | null> {
  if (gifCache.has(exerciseId)) return gifCache.get(exerciseId)!;

  const gifPath = path.join(LOCAL_GIFS, `${exerciseId}.gif`);
  if (!existsSync(gifPath)) return null;

  try {
    const result = await cloudinary.uploader.upload(gifPath, {
      public_id: `exercises/${exerciseId}`,
      resource_type: "image",
      overwrite: false,
    });
    gifCache.set(exerciseId, result.secure_url);
    return result.secure_url;
  } catch (err: any) {
    // Ya existe en Cloudinary → construir la URL a partir de CLOUDINARY_URL
    if (err?.http_code === 400 || err?.message?.includes("already exists")) {
      // Extrae cloud_name de "cloudinary://key:secret@cloud_name"
      const cloudName = process.env.CLOUDINARY_URL?.split("@")[1] ?? "";
      const url = `https://res.cloudinary.com/${cloudName}/image/upload/exercises/${exerciseId}.gif`;
      gifCache.set(exerciseId, url);
      return url;
    }
    console.error(`  Cloudinary error (${exerciseId}):`, err?.message);
    return null;
  }
}

// ─── Limpiar prefijo "Step:1 " de instrucciones ───────────────────────────────

function cleanInstructions(instructions: string[]): string[] {
  return instructions.map((s) => s.replace(/^Step:\d+\s+/, ""));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const hasLocalJson = existsSync(LOCAL_JSON);
  const hasGifs = existsSync(LOCAL_GIFS);

  // ── Ruta A: dataset Kaggle ────────────────────────────────────────────────
  if (hasLocalJson) {
    const exercises: KaggleRow[] = JSON.parse(readFileSync(LOCAL_JSON, "utf-8"));
    console.log(`Kaggle ExerciseDB: ${exercises.length} ejercicios encontrados.`);

    if (hasGifs) {
      console.log(`Carpeta gifs/ encontrada → subiendo a Cloudinary...`);
      console.log(`(Si ya fueron subidos antes, se omiten automáticamente)\n`);
    } else {
      console.log(`Carpeta gifs/ no encontrada → ejercicios sin imagen.\n`);
    }

    let upserted = 0;
    let errors = 0;

    for (const e of exercises) {
      const exerciseId = e.exerciseId;
      const gifFileName = e.gifUrl; // "2ORFMoR.gif"
      const gifId = gifFileName.replace(".gif", "");

      // Subir GIF a Cloudinary si la carpeta existe
      const gifUrl = hasGifs ? await uploadGif(gifId) : null;

      try {
        await prisma.exercise.upsert({
          where: { externalId: exerciseId },
          update: {
            name: e.name,
            bodyPart: e.bodyParts[0] ?? "other",
            target: e.targetMuscles[0] ?? "other",
            equipment: e.equipments[0] ?? "other",
            gifUrl,
            instructions: cleanInstructions(e.instructions ?? []),
            secondaryMuscles: e.secondaryMuscles ?? [],
            isActive: true,
          },
          create: {
            externalId: exerciseId,
            name: e.name,
            bodyPart: e.bodyParts[0] ?? "other",
            target: e.targetMuscles[0] ?? "other",
            equipment: e.equipments[0] ?? "other",
            gifUrl,
            instructions: cleanInstructions(e.instructions ?? []),
            secondaryMuscles: e.secondaryMuscles ?? [],
            isActive: true,
          },
        });
        upserted++;
        if (upserted % 50 === 0) process.stdout.write(`  ${upserted}/${exercises.length}...\n`);
      } catch (err) {
        console.error(`  Error en ${exerciseId} (${e.name}):`, err);
        errors++;
      }
    }

    console.log(`\n✓ ${upserted} ejercicios insertados${hasGifs ? " con GIFs en Cloudinary" : ""}, ${errors} errores.`);

  } else {
    // ── Ruta B: free-exercise-db ──────────────────────────────────────────
    console.log("No se encontró exercises-data.json → usando free-exercise-db...\n");

    const resp = await fetch(FREE_DB_URL);
    if (!resp.ok) throw new Error(`Error al descargar dataset: ${resp.status}`);
    const exercises: FreeRow[] = await resp.json();
    console.log(`free-exercise-db: ${exercises.length} ejercicios. Insertando...\n`);

    let upserted = 0;
    let errors = 0;

    for (const e of exercises) {
      const bodyPart = CATEGORY_MAP[e.category?.toLowerCase()] ?? e.category?.toLowerCase() ?? "other";
      const equipment = EQUIPMENT_MAP[e.equipment?.toLowerCase() ?? ""] ?? e.equipment?.toLowerCase() ?? "other";
      const target = e.primaryMuscles[0] ?? e.category ?? "other";
      const gifUrl = e.images?.length
        ? `${FREE_DB_IMG}/${e.id}/${e.images[0]}`
        : null;

      try {
        await prisma.exercise.upsert({
          where: { externalId: e.id },
          update: {
            name: e.name, bodyPart, target, equipment, gifUrl,
            instructions: e.instructions ?? [],
            secondaryMuscles: e.secondaryMuscles ?? [],
            difficulty: e.level ?? null,
            isActive: true,
          },
          create: {
            externalId: e.id,
            name: e.name, bodyPart, target, equipment, gifUrl,
            instructions: e.instructions ?? [],
            secondaryMuscles: e.secondaryMuscles ?? [],
            difficulty: e.level ?? null,
            isActive: true,
          },
        });
        upserted++;
      } catch (err) {
        console.error(`  Error en ${e.id} (${e.name}):`, err);
        errors++;
      }
    }

    console.log(`\n✓ ${upserted} ejercicios insertados, ${errors} errores.`);
    console.log("Para GIFs: copia exercises.json + gifs_180x180/ y vuelve a correr el seed.");
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
