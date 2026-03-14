import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import {
  calculateMuscleStimulus,
  calculate1RM,
  calculateWorkoutXP,
  ExerciseInWorkout,
} from "../lib/muscleStimulus.js"

const router = Router()

// ─── TIPOS LOCALES ────────────────────────────────────
type WorkoutWithSets = {
  id: string
  userId: string
  startTime: Date
  sets: {
    exerciseId: string
    order: number
    weight: number | null
    reps: number | null
    isPR: boolean
    exercise: {
      muscleActivations: {
        muscleName: string
        activationPct: number
        isPrimary: boolean
      }[]
    }
  }[]
}

// Todas las rutas requieren autenticación
router.use(requireAuth)

// ─── HELPER: obtener userId de Prisma desde clerkId ───
async function getPrismaUserId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  return user?.id ?? null
}

// ─── GET /api/workouts ────────────────────────────────
// Historial de workouts del usuario
router.get("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    if (!userId) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const workouts = await prisma.workout.findMany({
      where: { userId, isCompleted: true },
      include: {
        sets: {
          include: { exercise: true },
        },
      },
      orderBy: { startTime: "desc" },
      take: 20,
    })

    res.json(workouts)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener workouts" })
  }
})

// ─── POST /api/workouts/start ─────────────────────────
// Iniciar un nuevo workout
router.post("/start", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)
    if (!userId) {
      res.status(404).json({ error: "Usuario no encontrado" })
      return
    }

    const { name, templateId } = req.body

    const workout = await prisma.workout.create({
      data: {
        userId,
        templateId: templateId || null,
        name: name || "Workout",
        startTime: new Date(),
        isCompleted: false,
      },
    })

    // Si viene de plantilla, pre-cargar los ejercicios
    if (templateId) {
      await prisma.workoutTemplate.update({
        where: { id: templateId },
        data: { timesUsed: { increment: 1 } },
      })
    }

    res.json(workout)
  } catch (error) {
    res.status(500).json({ error: "Error al iniciar workout" })
  }
})

// ─── POST /api/workouts/:id/sets ──────────────────────
// Agregar un set a un workout activo
router.post("/:id/sets", async (req: Request, res: Response) => {
  try {
    const workoutId = req.params.id as string
    const {
      exerciseId,
      order,
      setNumber,
      weight,
      reps,
      rpe,
      setType,
      restSeconds,
      notes,
      duration,
    } = req.body

    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    // Verificar que el workout pertenece al usuario
    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: userId! },
    })

    if (!workout) {
      res.status(404).json({ error: "Workout no encontrado" })
      return
    }

    // Buscar si es PR
    const existingPR = await prisma.personalRecord.findUnique({
      where: { userId_exerciseId: { userId: userId!, exerciseId } },
    })

    const currentVolume = weight && reps ? weight * reps : 0
    const isPR = !existingPR || currentVolume > (existingPR.volume ?? 0)

    // Crear el set
    const set = await prisma.workoutSet.create({
      data: {
        workoutId,
        exerciseId,
        order,
        setNumber,
        weight,
        reps,
        rpe,
        setType: setType || "NORMAL",
        restSeconds,
        notes,
        duration,
        isCompleted: true,
        isPR,
      },
      include: { exercise: true },
    })

    // Actualizar PR si aplica
    if (isPR && weight && reps) {
      await prisma.personalRecord.upsert({
        where: { userId_exerciseId: { userId: userId!, exerciseId } },
        update: {
          weight,
          reps,
          volume: currentVolume,
          oneRepMax: calculate1RM(weight, reps),
          achievedAt: new Date(),
        },
        create: {
          userId: userId!,
          exerciseId,
          weight,
          reps,
          volume: currentVolume,
          oneRepMax: calculate1RM(weight, reps),
        },
      })
    }

    res.json({ set, isPR })
  } catch (error) {
    res.status(500).json({ error: "Error al guardar set" })
  }
})

// ─── POST /api/workouts/:id/finish ───────────────────
// Finalizar un workout y calcular métricas
router.post("/:id/finish", async (req: Request, res: Response) => {
  try {
    const workoutId = req.params.id as string
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: userId! },
      include: {
        sets: {
          where: { isCompleted: true, setType: { not: "WARMUP" } },
          include: {
            exercise: {
              include: { muscleActivations: true },
            },
          },
        },
      },
    }) as WorkoutWithSets | null

    if (!workout) {
      res.status(404).json({ error: "Workout no encontrado" })
      return
    }

    // Calcular volumen total
    const totalVolume = workout.sets.reduce((sum, set) => {
      return sum + (set.weight ?? 0) * (set.reps ?? 0)
    }, 0)

    // Calcular duración
    const endTime = new Date()
    const durationMinutes = Math.round(
      (endTime.getTime() - workout.startTime.getTime()) / 60000
    )

    // Calcular PRs en este workout
    const newPRs = workout.sets.filter((s) => s.isPR).length

    // Calcular XP
    const xpEarned = calculateWorkoutXP(
      totalVolume,
      workout.sets.length,
      newPRs,
      durationMinutes
    )

    // Calcular estímulo muscular
    const exercisesForStimulus = Object.values(
      workout.sets.reduce(
        (acc, set) => {
          const key = `${set.exerciseId}_${set.order}`
          if (!acc[key]) {
            acc[key] = {
              exerciseId: set.exerciseId,
              order: set.order,
              setsCompleted: 0,
              muscleActivations: set.exercise.muscleActivations.map((ma) => ({
                muscleName: ma.muscleName,
                activationPct: ma.activationPct,
                isPrimary: ma.isPrimary,
              })),
            }
          }
          acc[key].setsCompleted++
          return acc
        },
        {} as Record<string, ExerciseInWorkout>
      )
    )

    const muscleStimulus = calculateMuscleStimulus(exercisesForStimulus)

    // Actualizar workout
    const finishedWorkout = await prisma.workout.update({
      where: { id: workoutId },
      data: {
        endTime,
        duration: durationMinutes,
        totalVolume,
        xpEarned,
        isCompleted: true,
        muscleStimulus: muscleStimulus as any,
      },
    })

    // Actualizar XP del usuario
    await prisma.user.update({
      where: { id: userId! },
      data: {
        xp: { increment: xpEarned },
        lastWorkout: endTime,
        streak: { increment: 1 },
      },
    })

    res.json({
      workout: finishedWorkout,
      xpEarned,
      newPRs,
      muscleStimulus,
      totalVolume,
      durationMinutes,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al finalizar workout" })
  }
})

// ─── GET /api/workouts/templates ─────────────────────
// Obtener plantillas del usuario
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const templates = await prisma.workoutTemplate.findMany({
      where: { userId: userId! },
      include: {
        templateSets: {
          include: { exercise: true },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    })

    res.json(templates)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener plantillas" })
  }
})

// ─── POST /api/workouts/templates ────────────────────
// Crear una plantilla nueva
router.post("/templates", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)
    const { name, description, exercises } = req.body

    const template = await prisma.workoutTemplate.create({
      data: {
        userId: userId!,
        name,
        description,
        templateSets: {
          create: exercises.map(
            (ex: any, index: number) => ({
              exerciseId: ex.exerciseId,
              order: index + 1,
              targetSets: ex.targetSets || 3,
              targetReps: ex.targetReps || 10,
              targetWeight: ex.targetWeight,
              restSeconds: ex.restSeconds || 90,
              notes: ex.notes,
            })
          ),
        },
      },
      include: {
        templateSets: {
          include: { exercise: true },
        },
      },
    })

    res.json(template)
  } catch (error) {
    res.status(500).json({ error: "Error al crear plantilla" })
  }
})

// ─── GET /api/workouts/prs ────────────────────────────
// Récords personales del usuario
router.get("/prs", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const prs = await prisma.personalRecord.findMany({
      where: { userId: userId! },
      include: { exercise: true },
      orderBy: { achievedAt: "desc" },
    })

    res.json(prs)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener PRs" })
  }
})

export default router