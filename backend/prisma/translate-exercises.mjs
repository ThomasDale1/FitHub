/**
 * Traduce exercises-data.json al español.
 * - Tipos (level, mechanic, category, equipment, muscles, bodyParts): diccionario
 * - Nombres e instrucciones: OpenAI gpt-4o-mini en batches de 15
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "dotenv";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../.env") });

const JSON_PATH = path.join(__dirname, "exercises-data.json");
const OUTPUT_PATH = path.join(__dirname, "exercises-data.json");
const CHECKPOINT_PATH = path.join(__dirname, ".translate-checkpoint.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Diccionarios de tipos ──────────────────────────────────────────────────────

const LEVEL_ES = {
  beginner: "principiante",
  intermediate: "intermedio",
  advanced: "avanzado",
  expert: "experto",
};

const MECHANIC_ES = {
  compound: "compuesto",
  isolation: "aislamiento",
};

const CATEGORY_ES = {
  strength: "fuerza",
  stretching: "estiramiento",
  cardio: "cardio",
  plyometrics: "pliometría",
  powerlifting: "powerlifting",
  "olympic weightlifting": "levantamiento olímpico",
  strongman: "strongman",
};

const EQUIPMENT_ES = {
  barbell: "barra",
  dumbbell: "mancuerna",
  "body only": "peso corporal",
  "body weight": "peso corporal",
  cable: "cable",
  machine: "máquina",
  "leverage machine": "máquina de palanca",
  "smith machine": "máquina Smith",
  kettlebells: "pesa rusa",
  kettlebell: "pesa rusa",
  "ez barbell": "barra EZ",
  "resistance band": "banda de resistencia",
  bands: "bandas",
  band: "banda",
  assisted: "asistido",
  weighted: "con peso adicional",
  "exercise ball": "pelota de ejercicio",
  "medicine ball": "balón medicinal",
  "foam roll": "rodillo de espuma",
  "sled machine": "máquina de trineo",
  other: "otro",
};

const BODY_PART_ES = {
  "upper legs": "piernas (cuádriceps/isquios)",
  "lower legs": "piernas (gemelos/tibial)",
  "upper arms": "brazos (bíceps/tríceps)",
  "lower arms": "antebrazos",
  chest: "pecho",
  back: "espalda",
  shoulders: "hombros",
  waist: "abdomen/cintura",
  neck: "cuello",
  cardio: "cardio",
  other: "otro",
};

const MUSCLE_ES = {
  abdominals: "abdominales",
  abs: "abdominales",
  obliques: "oblicuos",
  hamstrings: "isquiotibiales",
  calves: "pantorrillas",
  biceps: "bíceps",
  triceps: "tríceps",
  glutes: "glúteos",
  quadriceps: "cuádriceps",
  chest: "pecho",
  pectorals: "pectorales",
  lats: "dorsales",
  back: "espalda",
  "middle back": "espalda media",
  "lower back": "espalda baja",
  "upper back": "espalda alta",
  traps: "trapecios",
  trapezius: "trapecio",
  forearms: "antebrazos",
  shoulders: "hombros",
  neck: "cuello",
  "hip flexors": "flexores de cadera",
  adductors: "aductores",
  abductors: "abductores",
  brachialis: "braquial anterior",
  "spinal erectors": "erectores de la columna",
  rhomboids: "romboides",
  "serratus anterior": "serrato anterior",
  "rear deltoids": "deltoides posteriores",
  deltoids: "deltoides",
  delts: "deltoides",
  spine: "columna vertebral",
};

function translateArr(arr, map) {
  return (arr ?? []).map((v) => map[v?.toLowerCase()] ?? v);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const exercises = JSON.parse(readFileSync(JSON_PATH, "utf-8"));

  // Load checkpoint (resumable if interrupted)
  let checkpoint = {};
  if (existsSync(CHECKPOINT_PATH)) {
    checkpoint = JSON.parse(readFileSync(CHECKPOINT_PATH, "utf-8"));
    console.log(`Checkpoint found: ${Object.keys(checkpoint).length} exercises already translated.`);
  }

  // Split into batches of 15
  const BATCH_SIZE = 15;
  const batches = [];
  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    batches.push(exercises.slice(i, i + BATCH_SIZE));
  }

  console.log(`Translating ${exercises.length} exercises in ${batches.length} batches...`);

  let done = 0;
  for (const batch of batches) {
    // Skip if all already in checkpoint
    const uncached = batch.filter((e) => !checkpoint[e.id]);
    if (uncached.length === 0) {
      done += batch.length;
      continue;
    }

    try {
      const translations = await translateBatch(uncached);
      Object.assign(checkpoint, translations);
      writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
      done += batch.length;
      process.stdout.write(`  ${done}/${exercises.length} translated...\r`);
    } catch (err) {
      console.error(`\nError in batch (ids: ${uncached.map((e) => e.id).join(", ")}):`, err.message);
      // Save checkpoint and continue with next batch
      writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint, null, 2));
    }

    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nAll batches processed. Assembling final file...`);

  // Apply translations to all exercises
  const translated = exercises.map((ex) => {
    const t = checkpoint[ex.id];

    return {
      id: ex.id,
      name: t?.name ?? ex.name,
      level: LEVEL_ES[ex.level] ?? ex.level,
      mechanic: ex.mechanic !== null ? (MECHANIC_ES[ex.mechanic] ?? ex.mechanic) : null,
      category: CATEGORY_ES[ex.category] ?? ex.category,
      equipment: EQUIPMENT_ES[ex.equipment] ?? ex.equipment,
      targetedMuscles: translateArr(ex.targetedMuscles, MUSCLE_ES),
      bodyParts: translateArr(ex.bodyParts, BODY_PART_ES),
      secondaryMuscles: translateArr(ex.secondaryMuscles, MUSCLE_ES),
      instructions: t?.instructions ?? ex.instructions,
      gif: ex.gif ?? null,
    };
  });

  writeFileSync(OUTPUT_PATH, JSON.stringify(translated, null, 2), "utf-8");

  // Clean up checkpoint
  try { require("fs").unlinkSync(CHECKPOINT_PATH); } catch {}

  // Stats
  const missing = translated.filter((e) => !checkpoint[e.id]);
  console.log(`✓ Done. ${translated.length} exercises written.`);
  if (missing.length > 0) {
    console.log(`  ⚠ ${missing.length} exercises kept in English (API errors).`);
  }

  // Sample verification
  console.log("\n--- Sample ---");
  console.log(JSON.stringify(translated[0], null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
