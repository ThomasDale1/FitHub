import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import {
  calculate1RM,
  calculateWorkoutXP,
} from "../lib/muscleStimulus.js"

const router = Router()
router.use(requireAuth)

async function getPrismaUserId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  })
  return user?.id ?? null
}

// ─── GET /api/workouts ────────────────────────────────
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
      include: { sets: true },
      orderBy: { startTime: "desc" },
      take: 20,
    })

    res.json(workouts)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener workouts" })
  }
})

// ─── POST /api/workouts/start ─────────────────────────
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
router.post("/:id/sets", async (req: Request, res: Response) => {
  try {
    const workoutId = req.params.id as string
    const {
      externalId,      // ID de ExerciseDB (si es de la API)
      exerciseName,    // nombre del ejercicio (siempre requerido)
      customExerciseId,// si es ejercicio custom del usuario
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

    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: userId! },
    })

    if (!workout) {
      res.status(404).json({ error: "Workout no encontrado" })
      return
    }

    // Verificar si es PR
    // Buscamos por externalId o customExerciseId
    const existingPR = externalId
      ? await prisma.personalRecord.findUnique({
          where: { userId_externalId: { userId: userId!, externalId } },
        })
      : customExerciseId
      ? await prisma.personalRecord.findUnique({
          where: {
            userId_customExerciseId: {
              userId: userId!,
              customExerciseId,
            },
          },
        })
      : null

    const currentVolume = weight && reps ? weight * reps : 0
    const isPR = !existingPR || currentVolume > (existingPR.volume ?? 0)

    // Crear el set
    // Solo guardamos externalId + exerciseName, NUNCA datos completos
    const set = await prisma.workoutSet.create({
      data: {
        workoutId,
        externalId: externalId || null,
        exerciseName,
        customExerciseId: customExerciseId || null,
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
    })

    // Actualizar PR si aplica
    if (isPR && weight && reps) {
      const prData = {
        weight,
        reps,
        volume: currentVolume,
        oneRepMax: calculate1RM(weight, reps),
        exerciseName,
        achievedAt: new Date(),
      }

      if (externalId) {
        await prisma.personalRecord.upsert({
          where: {
            userId_externalId: { userId: userId!, externalId },
          },
          update: prData,
          create: { userId: userId!, externalId, ...prData },
        })
      } else if (customExerciseId) {
        await prisma.personalRecord.upsert({
          where: {
            userId_customExerciseId: {
              userId: userId!,
              customExerciseId,
            },
          },
          update: prData,
          create: {
            userId: userId!,
            customExerciseId,
            ...prData,
          },
        })
      }
    }

    res.json({ set, isPR })
  } catch (error) {
    res.status(500).json({ error: "Error al guardar set" })
  }
})

// ─── POST /api/workouts/:id/finish ───────────────────
router.post("/:id/finish", async (req: Request, res: Response) => {
  try {
    const workoutId = req.params.id as string
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const workout = await prisma.workout.findFirst({
      where: { id: workoutId, userId: userId! },
      include: {
        sets: {
          where: {
            isCompleted: true,
            setType: { not: "WARMUP" },
          },
        },
      },
    })

    if (!workout) {
      res.status(404).json({ error: "Workout no encontrado" })
      return
    }

    const totalVolume = workout.sets.reduce((sum, set) => {
      return sum + (set.weight ?? 0) * (set.reps ?? 0)
    }, 0)

    const endTime = new Date()
    const durationMinutes = Math.round(
      (endTime.getTime() - workout.startTime.getTime()) / 60000
    )

    const newPRs = workout.sets.filter((s) => s.isPR).length

    const xpEarned = calculateWorkoutXP(
      totalVolume,
      workout.sets.length,
      newPRs,
      durationMinutes
    )

    const finishedWorkout = await prisma.workout.update({
      where: { id: workoutId },
      data: {
        endTime,
        duration: durationMinutes,
        totalVolume,
        xpEarned,
        isCompleted: true,
      },
    })

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
      totalVolume,
      durationMinutes,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al finalizar workout" })
  }
})

// ─── GET /api/workouts/templates ─────────────────────
router.get("/templates", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const templates = await prisma.workoutTemplate.findMany({
      where: { userId: userId! },
      include: {
        templateSets: {
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
          create: exercises.map((ex: any, index: number) => ({
            externalId: ex.externalId || null,
            exerciseName: ex.exerciseName,
            customExerciseId: ex.customExerciseId || null,
            order: index + 1,
            targetSets: ex.targetSets || 3,
            targetReps: ex.targetReps || 10,
            targetWeight: ex.targetWeight,
            restSeconds: ex.restSeconds || 90,
            notes: ex.notes,
          })),
        },
      },
      include: { templateSets: true },
    })

    res.json(template)
  } catch (error) {
    res.status(500).json({ error: "Error al crear plantilla" })
  }
})

// ─── GET /api/workouts/prs ────────────────────────────
router.get("/prs", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const userId = await getPrismaUserId(clerkId!)

    const prs = await prisma.personalRecord.findMany({
      where: { userId: userId! },
      orderBy: { achievedAt: "desc" },
    })

    res.json(prs)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener PRs" })
  }
})

export default router