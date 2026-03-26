import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import {
  calculate1RM,
  calculateWorkoutXP,
} from "../lib/muscleStimulus.js"
import { sendPushToUser } from "../lib/pushNotifications.js"
import { updateChallengeProgress } from "../lib/challengeProgress.js"
import { getPrismaUserId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

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

    const { name, templateId, clientDate } = req.body

    // Use noon UTC of client's local date so streak grouping is correct for any timezone.
    // If clientDate not provided, fall back to current server UTC time.
    const startTime = clientDate
      ? new Date(clientDate + "T12:00:00.000Z")
      : new Date()

    const workout = await prisma.workout.create({
      data: {
        userId,
        templateId: templateId || null,
        name: name || "Workout",
        startTime,
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
        achievedAt: workout.startTime, // fecha local del cliente (noon UTC del día local)
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

    // Accept durationMinutes and clientEndHour from client.
    // clientEndHour (0-23): local hour on the device when finishing — used for midnight/early-bird badge.
    const { durationMinutes: clientDuration, clientEndHour, clientDate: clientDateFinish } = req.body
    const endTime = new Date()
    const durationMinutes = (typeof clientDuration === "number" && clientDuration > 0)
      ? clientDuration
      : Math.round((endTime.getTime() - workout.startTime.getTime()) / 60000)

    const newPRs = workout.sets.filter((s) => s.isPR).length

    const xpEarned = calculateWorkoutXP(
      totalVolume,
      workout.sets.length,
      newPRs,
      durationMinutes
    )

    // Atomically mark the workout complete and grant XP in one transaction.
    // A separate user.update after workout.update risks XP being lost if the
    // second write fails (e.g. DB timeout, cold-start retries).
    const [finishedWorkout] = await prisma.$transaction([
      prisma.workout.update({
        where: { id: workoutId },
        data: {
          endTime,
          duration: durationMinutes,
          totalVolume,
          xpEarned,
          isCompleted: true,
        },
      }),
      prisma.user.update({
        where: { id: userId! },
        data: {
          xp: { increment: xpEarned },
          lastWorkout: endTime,
          streak: { increment: 1 },
        },
      }),
    ])
    try {
      const exerciseNames = [...new Set(
        workout.sets.map((s) => s.exerciseName)
      )]

      await prisma.post.create({
        data: {
          userId: userId!,
          content: `Completé ${workout.name} 💪 — ${durationMinutes} min, ${Math.round(totalVolume)} kg de volumen${newPRs > 0 ? `, ${newPRs} nuevo${newPRs > 1 ? "s" : ""} PR 🏆` : ""}`,
          postType: newPRs > 0 ? "PR_SHARE" : "WORKOUT_SHARE",
          workoutId: workoutId,
          workoutData: {
            name: workout.name,
            duration: durationMinutes,
            totalVolume: Math.round(totalVolume),
            xpEarned,
            setsCount: workout.sets.length,
            exercises: exerciseNames.slice(0, 5),
            newPRs,
          },
          isPublic: true,
        },
      })
    } catch (autoShareErr) {
      // No falla el workout si el auto-share falla
      console.error("Auto-share error (non-blocking):", autoShareErr)
    }

    // ─── CHECK BADGES después de cada workout ──────
    // (non-blocking, no falla el workout)
    // The badge system handles milestone checks, notifications, and auto-posts
    try {
      const { checkBadgesForUser } = await import("./badges.js")
      const endHour = typeof clientEndHour === "number" ? clientEndHour : undefined
      const clientDate = typeof clientDateFinish === "string" ? clientDateFinish : undefined
      checkBadgesForUser(userId!, endHour, clientDate).catch((err: any) =>
        console.error("Badge check error (non-blocking):", err)
      )
    } catch (badgeErr) {
      console.error("Badge check import error (non-blocking):", badgeErr)
    }

    // Push notification de workout completado
    const prText = newPRs > 0 ? ` | ${newPRs} PR 🏆` : ""
    sendPushToUser(
      userId!,
      "💪 Workout completado!",
      `${workout.name} — ${durationMinutes} min, +${xpEarned} XP${prText}`,
      { type: "workout_complete", workoutId }
    )

    // ─── AUTO-PROGRESS CHALLENGES ──────────────────
    // Non-blocking: actualiza progreso de challenges activos
    updateChallengeProgress({
      userId: userId!,
      workout: { totalVolume, newPRs, durationMinutes },
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

    // Cap at 100 — no user needs more templates than that loaded at once
    const templates = await prisma.workoutTemplate.findMany({
      where: { userId: userId! },
      include: {
        templateSets: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
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