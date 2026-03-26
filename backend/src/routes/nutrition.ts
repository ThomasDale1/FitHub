// ─────────────────────────────────────────────────────
// backend/src/routes/nutrition.ts
// Sprint 3A: Nutrition — Food logging, macros, water
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"

const router = Router()
router.use(requireAuth)

// ─── Helper ───────────────────────────────────────────
async function getUserByClerkId(clerkId: string) {
  return prisma.user.findUnique({ where: { clerkId } })
}

// Obtener o crear el food log del día
async function getOrCreateFoodLog(userId: string, date?: string) {
  const targetDate = date
    ? new Date(date + "T00:00:00.000Z")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")

  // Buscar el log del usuario para obtener sus metas
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calorieGoal: true, proteinGoal: true, carbsGoal: true, fatGoal: true },
  })

  let foodLog = await prisma.foodLog.findUnique({
    where: { userId_date: { userId, date: targetDate } },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
    },
  })

  if (!foodLog) {
    foodLog = await prisma.foodLog.create({
      data: {
        userId,
        date: targetDate,
        calorieGoal: user?.calorieGoal ?? 2000,
        proteinGoal: user?.proteinGoal ?? 150,
        carbsGoal: user?.carbsGoal ?? 250,
        fatGoal: user?.fatGoal ?? 65,
      },
      include: {
        entries: { orderBy: { createdAt: "asc" } },
      },
    })
  }

  return foodLog
}

// Recalcular totales del food log
async function recalculateTotals(foodLogId: string) {
  const entries = await prisma.foodEntry.findMany({
    where: { foodLogId },
  })

  const totals = entries.reduce(
    (acc, entry) => ({
      totalCalories: acc.totalCalories + entry.calories,
      totalProtein: acc.totalProtein + entry.protein,
      totalCarbs: acc.totalCarbs + entry.carbs,
      totalFat: acc.totalFat + entry.fat,
      totalFiber: acc.totalFiber + entry.fiber,
    }),
    { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0, totalFiber: 0 }
  )

  return prisma.foodLog.update({
    where: { id: foodLogId },
    data: totals,
    include: { entries: { orderBy: { createdAt: "asc" } } },
  })
}

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/today — Log de hoy
// ═══════════════════════════════════════════════════════
router.get("/today", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const clientDate = req.query.today as string | undefined
    const foodLog = await getOrCreateFoodLog(user.id, clientDate)

    // Agrupar entries por mealType
    const meals = {
      BREAKFAST: foodLog.entries.filter((e) => e.mealType === "BREAKFAST"),
      LUNCH: foodLog.entries.filter((e) => e.mealType === "LUNCH"),
      DINNER: foodLog.entries.filter((e) => e.mealType === "DINNER"),
      SNACK: foodLog.entries.filter((e) => e.mealType === "SNACK"),
    }

    res.json({
      ...foodLog,
      meals,
      macroPercentages: {
        protein: foodLog.totalCalories > 0
          ? Math.round((foodLog.totalProtein * 4 / foodLog.totalCalories) * 100)
          : 0,
        carbs: foodLog.totalCalories > 0
          ? Math.round((foodLog.totalCarbs * 4 / foodLog.totalCalories) * 100)
          : 0,
        fat: foodLog.totalCalories > 0
          ? Math.round((foodLog.totalFat * 9 / foodLog.totalCalories) * 100)
          : 0,
      },
    })
  } catch (error) {
    console.error("Error nutrition/today:", error)
    res.status(500).json({ error: "Error al obtener nutrición" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/date/:date — Log de un día específico
// ═══════════════════════════════════════════════════════
router.get("/date/:date", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const dateStr = req.params.date as string // formato: YYYY-MM-DD
    const foodLog = await getOrCreateFoodLog(user.id, dateStr)

    const meals = {
      BREAKFAST: foodLog.entries.filter((e) => e.mealType === "BREAKFAST"),
      LUNCH: foodLog.entries.filter((e) => e.mealType === "LUNCH"),
      DINNER: foodLog.entries.filter((e) => e.mealType === "DINNER"),
      SNACK: foodLog.entries.filter((e) => e.mealType === "SNACK"),
    }

    res.json({ ...foodLog, meals })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener nutrición" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/entry — Agregar un alimento
// ═══════════════════════════════════════════════════════
router.post("/entry", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const {
      date,       // YYYY-MM-DD (opcional, default hoy)
      mealType,   // BREAKFAST | LUNCH | DINNER | SNACK
      name,
      brand,
      barcode,
      servingSize,
      servingUnit,
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      source,     // MANUAL | BARCODE | AI_PHOTO | SEARCH | SAVED
      aiConfidence,
      imageUrl,
    } = req.body

    if (!name || !mealType || calories === undefined) {
      res.status(400).json({ error: "name, mealType y calories son requeridos" })
      return
    }

    const foodLog = await getOrCreateFoodLog(user.id, date)

    await prisma.foodEntry.create({
      data: {
        foodLogId: foodLog.id,
        mealType,
        name,
        brand: brand || null,
        barcode: barcode || null,
        servingSize: servingSize || 1,
        servingUnit: servingUnit || "porción",
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        sugar: sugar || 0,
        sodium: sodium || 0,
        source: source || "MANUAL",
        aiConfidence: aiConfidence || null,
        imageUrl: imageUrl || null,
      },
    })

    // Recalcular totales
    const updatedLog = await recalculateTotals(foodLog.id)

    // XP por registrar comida (5 XP por entrada)
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 5 } },
    })

    res.json({ foodLog: updatedLog, xpEarned: 5 })
  } catch (error) {
    console.error("Error creating food entry:", error)
    res.status(500).json({ error: "Error al agregar alimento" })
  }
})

// ═══════════════════════════════════════════════════════
// DELETE /api/nutrition/entry/:id — Eliminar un alimento
// ═══════════════════════════════════════════════════════
router.delete("/entry/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const entryId = req.params.id as string

    // Verificar que la entry pertenece al usuario
    const entry = await prisma.foodEntry.findUnique({
      where: { id: entryId },
      include: { foodLog: { select: { userId: true, id: true } } },
    })

    if (!entry || entry.foodLog.userId !== user.id) {
      res.status(404).json({ error: "Entrada no encontrada" })
      return
    }

    await prisma.foodEntry.delete({ where: { id: entryId } })

    const updatedLog = await recalculateTotals(entry.foodLog.id)

    res.json({ foodLog: updatedLog })
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar alimento" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/water — Agregar agua
// ═══════════════════════════════════════════════════════
router.post("/water", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { amount, date } = req.body // amount en ml

    if (!amount || amount <= 0) {
      res.status(400).json({ error: "amount debe ser mayor a 0" })
      return
    }

    const foodLog = await getOrCreateFoodLog(user.id, date)

    const updatedLog = await prisma.foodLog.update({
      where: { id: foodLog.id },
      data: { waterMl: { increment: amount } },
    })

    res.json({
      waterMl: updatedLog.waterMl,
      waterGoalMl: updatedLog.waterGoalMl,
      percentage: Math.round((updatedLog.waterMl / updatedLog.waterGoalMl) * 100),
    })
  } catch (error) {
    res.status(500).json({ error: "Error al registrar agua" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/nutrition/goals — Actualizar metas de nutrición
// ═══════════════════════════════════════════════════════
router.put("/goals", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { calorieGoal, proteinGoal, carbsGoal, fatGoal } = req.body

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        calorieGoal: calorieGoal ?? user.calorieGoal,
        proteinGoal: proteinGoal ?? user.proteinGoal,
        carbsGoal: carbsGoal ?? user.carbsGoal,
        fatGoal: fatGoal ?? user.fatGoal,
      },
    })

    res.json({
      calorieGoal: updatedUser.calorieGoal,
      proteinGoal: updatedUser.proteinGoal,
      carbsGoal: updatedUser.carbsGoal,
      fatGoal: updatedUser.fatGoal,
    })
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar metas" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/history — Últimos 7 días
// ═══════════════════════════════════════════════════════
router.get("/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7)
    sevenDaysAgo.setUTCHours(0, 0, 0, 0)

    const logs = await prisma.foodLog.findMany({
      where: {
        userId: user.id,
        date: { gte: sevenDaysAgo },
      },
      select: {
        date: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        calorieGoal: true,
        waterMl: true,
        waterGoalMl: true,
      },
      orderBy: { date: "asc" },
    })

    res.json({ history: logs })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/saved — Guardar alimento favorito
// ═══════════════════════════════════════════════════════
router.post("/saved", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { name, brand, servingSize, servingUnit, calories, protein, carbs, fat, fiber } = req.body

    const saved = await prisma.savedFood.create({
      data: {
        userId: user.id,
        name,
        brand: brand || null,
        servingSize: servingSize || 1,
        servingUnit: servingUnit || "porción",
        calories,
        protein: protein || 0,
        carbs: carbs || 0,
        fat: fat || 0,
        fiber: fiber || 0,
        isFavorite: true,
      },
    })

    res.json(saved)
  } catch (error) {
    res.status(500).json({ error: "Error al guardar alimento" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/saved — Listar alimentos guardados
// ═══════════════════════════════════════════════════════
router.get("/saved", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const saved = await prisma.savedFood.findMany({
      where: { userId: user.id },
      orderBy: [{ isFavorite: "desc" }, { timesUsed: "desc" }],
    })

    res.json(saved)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener alimentos guardados" })
  }
})

export default router