import { prisma } from "./prisma.js";

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
  instructions: string[];
  secondaryMuscles: string[];
  difficulty?: string;
  category?: string;
}

type ExerciseRow = {
  id: string;
  externalId: string | null;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string | null;
  instructions: string[];
  secondaryMuscles: string[];
  difficulty: string | null;
};

// Usa externalId como "id" para mantener compatibilidad con WorkoutSet.externalId existente
function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.externalId ?? row.id,
    name: row.name,
    bodyPart: row.bodyPart,
    target: row.target,
    equipment: row.equipment,
    gifUrl: row.gifUrl ?? "",
    instructions: row.instructions,
    secondaryMuscles: row.secondaryMuscles,
    difficulty: row.difficulty ?? undefined,
  };
}

export const getExercises = async (
  limit = 20,
  offset = 0
): Promise<Exercise[]> => {
  const rows = await prisma.exercise.findMany({
    where: { isActive: true },
    take: limit,
    skip: offset,
    orderBy: { name: "asc" },
  });
  return rows.map(toExercise);
};

export const searchExercises = async (
  name: string,
  limit = 20,
  offset = 0
): Promise<Exercise[]> => {
  const rows = await prisma.exercise.findMany({
    where: {
      isActive: true,
      name: { contains: name, mode: "insensitive" },
    },
    take: limit,
    skip: offset,
    orderBy: { name: "asc" },
  });
  return rows.map(toExercise);
};

// bodyPart vacío ("") = sin filtro de parte del cuerpo
// equipment nulo = sin filtro de equipo
// Ambos activos al mismo tiempo = filtro combinado (AND)
export const getExercisesByBodyPart = async (
  bodyPart: string,
  limit = 20,
  offset = 0,
  equipment?: string | null
): Promise<Exercise[]> => {
  const rows = await prisma.exercise.findMany({
    where: {
      isActive: true,
      ...(bodyPart
        ? { bodyPart: { equals: bodyPart, mode: "insensitive" } }
        : {}),
      ...(equipment
        ? { equipment: { equals: equipment, mode: "insensitive" } }
        : {}),
    },
    take: limit,
    skip: offset,
    orderBy: { name: "asc" },
  });
  return rows.map(toExercise);
};

export const getExercisesByEquipment = async (
  equipment: string,
  limit = 20,
  offset = 0
): Promise<Exercise[]> => {
  const rows = await prisma.exercise.findMany({
    where: {
      isActive: true,
      equipment: { equals: equipment, mode: "insensitive" },
    },
    take: limit,
    skip: offset,
    orderBy: { name: "asc" },
  });
  return rows.map(toExercise);
};

export const getBodyParts = async (): Promise<string[]> => {
  const rows = await prisma.exercise.findMany({
    where: { isActive: true },
    select: { bodyPart: true },
    distinct: ["bodyPart"],
    orderBy: { bodyPart: "asc" },
  });
  return rows.map((r) => r.bodyPart);
};

export const getExerciseById = async (id: string): Promise<Exercise> => {
  const row = await prisma.exercise.findFirst({
    where: {
      isActive: true,
      OR: [{ id }, { externalId: id }],
    },
  });
  if (!row) throw new Error("Exercise not found");
  return toExercise(row);
};

// Proxy de imagen: obtiene la gifUrl almacenada y la descarga para el cliente
export const getExerciseImage = async (
  exerciseId: string
): Promise<{ data: Buffer; contentType: string }> => {
  const row = await prisma.exercise.findFirst({
    where: { OR: [{ id: exerciseId }, { externalId: exerciseId }] },
    select: { gifUrl: true },
  });
  if (!row?.gifUrl) throw new Error("Image not found");
  const resp = await fetch(row.gifUrl);
  if (!resp.ok) throw new Error("Failed to fetch image");
  const data = Buffer.from(await resp.arrayBuffer());
  const contentType = resp.headers.get("content-type") ?? "image/jpeg";
  return { data, contentType };
};
