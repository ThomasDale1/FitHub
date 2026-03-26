// ─────────────────────────────────────────────────────
// backend/src/routes/onboarding.ts
// Onboarding flow — save user profile data step by step
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"

import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

// ═══════════════════════════════════════════════════════
// POST /api/onboarding/personal-info — Step 1
// ═══════════════════════════════════════════════════════
router.post("/personal-info", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { dateOfBirth, gender, weight, height, bodyFat } = req.body

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        gender,
        weight: weight ? parseFloat(weight) : undefined,
        height: height ? parseFloat(height) : undefined,
        bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
        onboardingStep: Math.max(user.onboardingStep, 1),
      },
    })

    res.json({ success: true, onboardingStep: updated.onboardingStep })
  } catch (error) {
    console.error("Onboarding personal-info error:", error)
    res.status(500).json({ error: "Error al guardar datos personales" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/onboarding/goals — Step 2
// ═══════════════════════════════════════════════════════
router.post("/goals", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { goals } = req.body as { goals: Array<{ slug: string; customText?: string }> }

    if (!goals || goals.length === 0) {
      res.status(400).json({ error: "Selecciona al menos un objetivo" }); return
    }

    // Delete existing and recreate
    await prisma.userGoalPreference.deleteMany({ where: { userId: user.id } })
    await prisma.userGoalPreference.createMany({
      data: goals.map((g) => ({
        userId: user.id,
        goalSlug: g.slug,
        customText: g.customText || null,
      })),
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: Math.max(user.onboardingStep, 2) },
    })

    res.json({ success: true, saved: goals.length })
  } catch (error) {
    console.error("Onboarding goals error:", error)
    res.status(500).json({ error: "Error al guardar objetivos" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/onboarding/hobbies — Step 3
// ═══════════════════════════════════════════════════════
router.post("/hobbies", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { hobbies } = req.body as { hobbies: string[] }

    if (!hobbies || hobbies.length === 0) {
      res.status(400).json({ error: "Selecciona al menos una actividad" }); return
    }

    await prisma.userHobby.deleteMany({ where: { userId: user.id } })
    await prisma.userHobby.createMany({
      data: hobbies.map((slug) => ({ userId: user.id, hobbySlug: slug })),
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { onboardingStep: Math.max(user.onboardingStep, 3) },
    })

    res.json({ success: true, saved: hobbies.length })
  } catch (error) {
    console.error("Onboarding hobbies error:", error)
    res.status(500).json({ error: "Error al guardar hobbies" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/onboarding/experience — Step 4
// ═══════════════════════════════════════════════════════
router.post("/experience", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { experienceLevel, weeklyTrainingDays } = req.body

    await prisma.user.update({
      where: { id: user.id },
      data: {
        experienceLevel,
        weeklyTrainingDays: weeklyTrainingDays ? parseInt(weeklyTrainingDays) : undefined,
        onboardingStep: Math.max(user.onboardingStep, 4),
      },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Onboarding experience error:", error)
    res.status(500).json({ error: "Error al guardar experiencia" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/onboarding/complete — Mark onboarding done
// ═══════════════════════════════════════════════════════
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        onboardingCompleted: true,
        onboardingStep: 7,
      },
    })

    // Award 25 XP for completing onboarding
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 25 } },
    })

    res.json({ success: true, xpEarned: 25 })
  } catch (error) {
    console.error("Onboarding complete error:", error)
    res.status(500).json({ error: "Error al completar onboarding" })
  }
})

export default router
