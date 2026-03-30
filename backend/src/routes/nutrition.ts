// ─────────────────────────────────────────────────────
// backend/src/routes/nutrition.ts
// Sprint 3A: Nutrition — Food logging, macros, water
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import { getUserByClerkId } from "../lib/userHelpers.js"
import OpenAI from "openai"
import {
  searchOpenFoodFacts,
  searchUSDA,
  lookupBarcode,
  type FoodSearchResult,
} from "../lib/foodSearch.js"

const openaiApiKey = process.env.OPENAI_API_KEY
const aiEnabled = Boolean(openaiApiKey)
if (!aiEnabled) {
  console.error("[nutrition] OPENAI_API_KEY is missing, AI nutrition routes are disabled")
}
const openai = aiEnabled ? new OpenAI({ apiKey: openaiApiKey }) : null

const router = Router()
router.use(requireAuth)

// ─── In-memory cache for popular foods (1h TTL) ─────
let popularCache: { data: any[]; cachedAt: number } | null = null
const POPULAR_CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getPopularCache() {
  if (popularCache && Date.now() - popularCache.cachedAt < POPULAR_CACHE_TTL) {
    return popularCache.data
  }
  return null
}

function setPopularCache(data: any[]) {
  popularCache = { data, cachedAt: Date.now() }
}

// Obtener o crear el food log del día.
// goals se pasa desde el handler para evitar un SELECT redundante
// (el usuario ya fue cargado más arriba en el request).
type UserGoals = { calorieGoal: number | null; proteinGoal: number | null; carbsGoal: number | null; fatGoal: number | null }

async function getOrCreateFoodLog(userId: string, goals: UserGoals, date?: string) {
  const targetDate = date
    ? new Date(date + "T00:00:00.000Z")
    : new Date(new Date().toISOString().split("T")[0] + "T00:00:00.000Z")

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
        calorieGoal: goals.calorieGoal ?? 2000,
        proteinGoal: goals.proteinGoal ?? 150,
        carbsGoal: goals.carbsGoal ?? 250,
        fatGoal: goals.fatGoal ?? 65,
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
    const foodLog = await getOrCreateFoodLog(user.id, user, clientDate)

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
    const foodLog = await getOrCreateFoodLog(user.id, user, dateStr)

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

    const foodLog = await getOrCreateFoodLog(user.id, user, date)

    // foodEntry.create and user XP grant in one transaction so they
    // both succeed or both fail — prevents entry-without-XP inconsistencies
    await prisma.$transaction([
      prisma.foodEntry.create({
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
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { xp: { increment: 5 } },
      }),
    ])

    // Recalcular totales (outside the transaction — non-critical aggregate)
    const updatedLog = await recalculateTotals(foodLog.id)

    // Background: auto-save to SavedFood with timesUsed++ (flywheel effect)
    if (name && calories > 0) {
      setImmediate(async () => {
        try {
          await prisma.savedFood.upsert({
            where: { userId_name: { userId: user.id, name } },
            update: { timesUsed: { increment: 1 } },
            create: {
              userId: user.id,
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
              isFavorite: false,
            },
          })
        } catch { /* best-effort background save */ }
      })
    }

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

    const foodLog = await getOrCreateFoodLog(user.id, user, date)

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

    // Cap at 100 — realistic upper bound for a personal food library
    const saved = await prisma.savedFood.findMany({
      where: { userId: user.id },
      orderBy: [{ isFavorite: "desc" }, { timesUsed: "desc" }],
      take: 100,
    })

    res.json(saved)
  } catch (error) {
    res.status(500).json({ error: "Error al obtener alimentos guardados" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/search — Buscar alimentos (SavedFood → OFF → USDA)
// ═══════════════════════════════════════════════════════
router.get("/search", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const query = (req.query.q as string || "").trim()
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = 20

    if (query.length < 2) {
      res.status(400).json({ error: "La búsqueda requiere al menos 2 caracteres" })
      return
    }

    // 1) Search user's SavedFood first (only on page 1)
    const savedFoods = page === 1 ? await prisma.savedFood.findMany({
      where: {
        userId: user.id,
        name: { contains: query, mode: "insensitive" },
      },
      orderBy: [{ isFavorite: "desc" }, { timesUsed: "desc" }],
      take: 5,
    }) : []

    const savedResults: FoodSearchResult[] = savedFoods.map((sf) => ({
      id: `saved:${sf.id}`,
      name: sf.name,
      brand: sf.brand,
      barcode: sf.barcode,
      source: "SAVED" as const,
      imageUrl: null,
      servingSize: sf.servingSize,
      servingUnit: sf.servingUnit,
      calories: sf.calories,
      protein: sf.protein,
      carbs: sf.carbs,
      fat: sf.fat,
      fiber: sf.fiber,
      sugar: 0,
      sodium: 0,
    }))

    // 2) Check FoodCache (global popular foods)
    const cacheOffset = page === 1 ? 0 : (page - 1) * 10
    const cachedFoods = await prisma.foodCache.findMany({
      where: { name: { contains: query, mode: "insensitive" } },
      take: 10,
      skip: cacheOffset,
      orderBy: { searchHits: "desc" },
    })

    const cachedResults: FoodSearchResult[] = cachedFoods.map((c) => ({
      id: `cache:${c.id}`,
      name: c.name,
      brand: c.brand,
      barcode: c.barcode,
      source: c.source as "OPEN_FOOD_FACTS" | "USDA",
      imageUrl: c.imageUrl,
      servingSize: c.servingSize,
      servingUnit: c.servingUnit,
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      fiber: c.fiber,
      sugar: c.sugar,
      sodium: c.sodium,
    }))

    // 3) If local results are sufficient, skip external APIs
    const localResults = [...savedResults, ...cachedResults]
    let offResults: FoodSearchResult[] = []
    let usdaResults: FoodSearchResult[] = []

    const externalOffset = (page - 1) * 15
    if (localResults.length < 15) {
      ;[offResults, usdaResults] = await Promise.all([
        searchOpenFoodFacts(query, 15, externalOffset),
        searchUSDA(query, 10, externalOffset),
      ])
    }

    // 4) Merge: saved first, then cached, then OFF, then USDA (deduplicate)
    const seen = new Set<string>()
    const results: FoodSearchResult[] = []

    for (const r of [...savedResults, ...cachedResults, ...offResults, ...usdaResults]) {
      const key = r.name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        results.push(r)
      }
      if (results.length >= pageSize) break
    }

    // 5) Cache new external results in background (don't block response)
    const newExternals = [...offResults, ...usdaResults]
    if (newExternals.length > 0) {
      setImmediate(async () => {
        for (const r of newExternals) {
          try {
            if (r.barcode) {
              await prisma.foodCache.upsert({
                where: { barcode: r.barcode },
                create: {
                  barcode: r.barcode,
                  name: r.name,
                  brand: r.brand,
                  source: r.source,
                  sourceId: r.id.replace(/^(off:|usda:)/, ""),
                  servingSize: r.servingSize,
                  servingUnit: r.servingUnit,
                  calories: r.calories,
                  protein: r.protein,
                  carbs: r.carbs,
                  fat: r.fat,
                  fiber: r.fiber,
                  sugar: r.sugar,
                  sodium: r.sodium,
                  imageUrl: r.imageUrl,
                },
                update: { searchHits: { increment: 1 } },
              })
            } else {
              // For items without barcode, create if not already cached
              const existing = await prisma.foodCache.findFirst({
                where: { name: r.name, source: r.source },
              })
              if (existing) {
                await prisma.foodCache.update({
                  where: { id: existing.id },
                  data: { searchHits: { increment: 1 } },
                })
              } else {
                await prisma.foodCache.create({
                  data: {
                    name: r.name,
                    brand: r.brand,
                    source: r.source,
                    sourceId: r.id.replace(/^(off:|usda:)/, ""),
                    servingSize: r.servingSize,
                    servingUnit: r.servingUnit,
                    calories: r.calories,
                    protein: r.protein,
                    carbs: r.carbs,
                    fat: r.fat,
                    fiber: r.fiber,
                    sugar: r.sugar,
                    sodium: r.sodium,
                    imageUrl: r.imageUrl,
                  },
                })
              }
            }
          } catch { /* background caching is best-effort */ }
        }
      })
    }

    const hasMore = results.length >= pageSize && page < 3 // max 3 pages
    res.json({ results, page, hasMore })
  } catch (error) {
    console.error("Error nutrition/search:", error)
    res.status(500).json({ error: "Error al buscar alimentos" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/barcode/:code — Lookup por código de barras
// ═══════════════════════════════════════════════════════
router.get("/barcode/:code", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const code = (req.params.code as string).trim()
    if (!/^\d{8,13}$/.test(code)) {
      res.status(400).json({ error: "Código de barras inválido (8-13 dígitos)" })
      return
    }

    // 1) Check if user already has this barcode saved
    const saved = await prisma.savedFood.findFirst({
      where: { userId: user.id, barcode: code },
    })

    if (saved) {
      const result: FoodSearchResult = {
        id: `saved:${saved.id}`,
        name: saved.name,
        brand: saved.brand,
        barcode: saved.barcode,
        source: "SAVED",
        imageUrl: null,
        servingSize: saved.servingSize,
        servingUnit: saved.servingUnit,
        calories: saved.calories,
        protein: saved.protein,
        carbs: saved.carbs,
        fat: saved.fat,
        fiber: saved.fiber,
        sugar: 0,
        sodium: 0,
      }
      res.json({ found: true, food: result })
      return
    }

    // 2) Lookup in Open Food Facts
    const result = await lookupBarcode(code)

    if (!result) {
      res.json({ found: false, code })
      return
    }

    res.json({ found: true, food: result })
  } catch (error) {
    console.error("Error nutrition/barcode:", error)
    res.status(500).json({ error: "Error al buscar por código de barras" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/recent — Alimentos recientes del usuario
// ═══════════════════════════════════════════════════════
router.get("/recent", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Get the last 20 unique food entries by name
    const entries = await prisma.foodEntry.findMany({
      where: {
        foodLog: { userId: user.id },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // fetch more to deduplicate
      select: {
        name: true,
        brand: true,
        barcode: true,
        servingSize: true,
        servingUnit: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        sugar: true,
        sodium: true,
        source: true,
      },
    })

    // Deduplicate by name (keep first = most recent)
    const seen = new Set<string>()
    const recent: typeof entries = []

    for (const e of entries) {
      const key = e.name.toLowerCase().trim()
      if (!seen.has(key)) {
        seen.add(key)
        recent.push(e)
      }
      if (recent.length >= 20) break
    }

    res.json({ recent })
  } catch (error) {
    console.error("Error nutrition/recent:", error)
    res.status(500).json({ error: "Error al obtener alimentos recientes" })
  }
})

// ═══════════════════════════════════════════════════════
// PUT /api/nutrition/entry/:id — Editar alimento existente
// ═══════════════════════════════════════════════════════
router.put("/entry/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const entryId = req.params.id as string
    const entry = await prisma.foodEntry.findUnique({
      where: { id: entryId },
      include: { foodLog: { select: { userId: true, id: true } } },
    })

    if (!entry || entry.foodLog.userId !== user.id) {
      res.status(404).json({ error: "Entrada no encontrada" })
      return
    }

    const { name, brand, servingSize, servingUnit, calories, protein, carbs, fat, fiber, sugar, sodium } = req.body

    await prisma.foodEntry.update({
      where: { id: entryId },
      data: {
        ...(name !== undefined && { name }),
        ...(brand !== undefined && { brand }),
        ...(servingSize !== undefined && { servingSize }),
        ...(servingUnit !== undefined && { servingUnit }),
        ...(calories !== undefined && { calories }),
        ...(protein !== undefined && { protein }),
        ...(carbs !== undefined && { carbs }),
        ...(fat !== undefined && { fat }),
        ...(fiber !== undefined && { fiber }),
        ...(sugar !== undefined && { sugar }),
        ...(sodium !== undefined && { sodium }),
      },
    })

    const updatedLog = await recalculateTotals(entry.foodLog.id)
    res.json({ foodLog: updatedLog })
  } catch (error) {
    console.error("Error updating food entry:", error)
    res.status(500).json({ error: "Error al editar alimento" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/ai/parse — AI texto → alimentos
// ═══════════════════════════════════════════════════════
router.post("/ai/parse", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { text, mealType } = req.body
    if (!text || typeof text !== "string" || text.trim().length < 3) {
      res.status(400).json({ error: "Describe lo que comiste (mínimo 3 caracteres)" })
      return
    }

    if (!openai) {
      res.status(503).json({ error: "AI no disponible. Configura OPENAI_API_KEY." })
      return
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Eres un nutriólogo experto. El usuario describe lo que comió.
Responde SOLO con un JSON array de alimentos con sus macros estimados.
Usa porciones estándar de México/LATAM.

Formato exacto:
[
  {
    "name": "Huevo revuelto",
    "servingSize": 2,
    "servingUnit": "unidades",
    "calories": 180,
    "protein": 12,
    "carbs": 1,
    "fat": 14,
    "fiber": 0,
    "sugar": 0,
    "sodium": 300,
    "confidence": 0.85
  }
]

- Si no estás seguro de un alimento, pon confidence < 0.7
- Redondea a enteros excepto macros (1 decimal)
- Usa kcal, gramos, mg para sodio
- Responde ÚNICAMENTE con el JSON array, sin texto adicional`,
        },
        { role: "user", content: text.trim() },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content || "[]"
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      res.status(422).json({ error: "No se pudo analizar la respuesta de IA" })
      return
    }

    let items: Array<{
      name: string
      servingSize: number
      servingUnit: string
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber: number
      sugar: number
      sodium: number
      confidence: number
    }>

    try {
      items = JSON.parse(jsonMatch[0])
    } catch (parseError: any) {
      console.error("AI parse JSON error:", parseError, "raw:", jsonMatch[0])
      res.status(422).json({ error: "Respuesta de IA malformada" })
      return
    }

    // Validate each item has required fields
    const validated = items.filter(
      (item) =>
        item.name &&
        typeof item.calories === "number" &&
        typeof item.protein === "number" &&
        typeof item.carbs === "number" &&
        typeof item.fat === "number"
    ).map((item) => ({
      name: item.name,
      servingSize: item.servingSize || 1,
      servingUnit: item.servingUnit || "porción",
      calories: Math.round(item.calories),
      protein: Math.round((item.protein || 0) * 10) / 10,
      carbs: Math.round((item.carbs || 0) * 10) / 10,
      fat: Math.round((item.fat || 0) * 10) / 10,
      fiber: Math.round((item.fiber || 0) * 10) / 10,
      sugar: Math.round((item.sugar || 0) * 10) / 10,
      sodium: Math.round(item.sodium || 0),
      confidence: item.confidence ?? 0.7,
      source: "AI_TEXT" as const,
    }))

    if (validated.length === 0) {
      res.status(422).json({ error: "No se identificaron alimentos" })
      return
    }

    const totalCalories = validated.reduce((s, i) => s + i.calories, 0)
    const totalProtein = validated.reduce((s, i) => s + i.protein, 0)

    res.json({
      items: validated,
      totalCalories,
      totalProtein: Math.round(totalProtein * 10) / 10,
      mealType: mealType || "SNACK",
    })
  } catch (error: any) {
    console.error("AI parse error:", error)
    if (error?.status === 429) {
      res.status(429).json({ error: "Demasiadas solicitudes. Espera un momento." })
      return
    }
    res.status(500).json({ error: "Error al analizar con IA" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/ai/photo — AI foto → alimentos
// ═══════════════════════════════════════════════════════
router.post("/ai/photo", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { imageUrl, mealType } = req.body
    if (!imageUrl || typeof imageUrl !== "string") {
      res.status(400).json({ error: "imageUrl es requerida" })
      return
    }

    if (!openai) {
      res.status(503).json({ error: "AI no disponible. Configura OPENAI_API_KEY." })
      return
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Analiza esta foto de comida. Identifica cada alimento visible y estima sus macros.
Usa porciones estándar de México/LATAM.
Responde SOLO con un JSON array con este formato exacto:
[
  {
    "name": "Nombre del alimento",
    "servingSize": 1,
    "servingUnit": "porción",
    "calories": 200,
    "protein": 10,
    "carbs": 20,
    "fat": 8,
    "fiber": 2,
    "sugar": 3,
    "sodium": 150,
    "confidence": 0.75
  }
]
- Si no estás seguro de un alimento, pon confidence < 0.7
- Redondea a enteros excepto macros (1 decimal)
- Responde ÚNICAMENTE con el JSON array`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            { type: "text", text: "¿Qué alimentos ves y cuáles son sus macros estimados?" },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    })

    const raw = completion.choices[0]?.message?.content || "[]"
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      res.status(422).json({ error: "No se pudo analizar la imagen" })
      return
    }

    let items: Array<{
      name: string
      servingSize: number
      servingUnit: string
      calories: number
      protein: number
      carbs: number
      fat: number
      fiber: number
      sugar: number
      sodium: number
      confidence: number
    }>

    try {
      items = JSON.parse(jsonMatch[0])
    } catch (parseError: any) {
      console.error("AI photo parse JSON error:", parseError, "raw:", jsonMatch[0])
      res.status(422).json({ error: "Respuesta de IA malformada" })
      return
    }

    const validated = items.filter(
      (item) =>
        item.name &&
        typeof item.calories === "number" &&
        typeof item.protein === "number"
    ).map((item) => ({
      name: item.name,
      servingSize: item.servingSize || 1,
      servingUnit: item.servingUnit || "porción",
      calories: Math.round(item.calories),
      protein: Math.round((item.protein || 0) * 10) / 10,
      carbs: Math.round((item.carbs || 0) * 10) / 10,
      fat: Math.round((item.fat || 0) * 10) / 10,
      fiber: Math.round((item.fiber || 0) * 10) / 10,
      sugar: Math.round((item.sugar || 0) * 10) / 10,
      sodium: Math.round(item.sodium || 0),
      confidence: item.confidence ?? 0.6,
      source: "AI_PHOTO" as const,
    }))

    if (validated.length === 0) {
      res.status(422).json({ error: "No se identificaron alimentos en la imagen" })
      return
    }

    res.json({
      items: validated,
      totalCalories: validated.reduce((s, i) => s + i.calories, 0),
      totalProtein: Math.round(validated.reduce((s, i) => s + i.protein, 0) * 10) / 10,
      mealType: mealType || "SNACK",
      imageUrl,
    })
  } catch (error: any) {
    console.error("AI photo error:", error)
    if (error?.status === 429) {
      res.status(429).json({ error: "Demasiadas solicitudes. Espera un momento." })
      return
    }
    res.status(500).json({ error: "Error al analizar foto" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/popular — Top alimentos más buscados
// ═══════════════════════════════════════════════════════
router.get("/popular", async (req: Request, res: Response) => {
  try {
    // Check in-memory cache first (1h TTL)
    const memoryCached = getPopularCache()
    if (memoryCached) {
      res.json({ results: memoryCached })
      return
    }

    const cached = await prisma.foodCache.findMany({
      orderBy: { searchHits: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        brand: true,
        barcode: true,
        source: true,
        imageUrl: true,
        servingSize: true,
        servingUnit: true,
        calories: true,
        protein: true,
        carbs: true,
        fat: true,
        fiber: true,
        sugar: true,
        sodium: true,
      },
    })

    const results: FoodSearchResult[] = cached.map((c) => ({
      id: `cache:${c.id}`,
      name: c.name,
      brand: c.brand,
      barcode: c.barcode,
      source: c.source as "OPEN_FOOD_FACTS" | "USDA",
      imageUrl: c.imageUrl,
      servingSize: c.servingSize,
      servingUnit: c.servingUnit,
      calories: c.calories,
      protein: c.protein,
      carbs: c.carbs,
      fat: c.fat,
      fiber: c.fiber,
      sugar: c.sugar,
      sodium: c.sodium,
    }))

    setPopularCache(results)
    res.json({ results })
  } catch (error) {
    console.error("Error nutrition/popular:", error)
    res.status(500).json({ error: "Error al obtener alimentos populares" })
  }
})

// ═══════════════════════════════════════════════════════
// DELETE /api/nutrition/saved/:id — Eliminar alimento guardado
// ═══════════════════════════════════════════════════════
router.delete("/saved/:id", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const savedId = req.params.id as string
    const saved = await prisma.savedFood.findUnique({ where: { id: savedId } })
    if (!saved || saved.userId !== user.id) {
      res.status(404).json({ error: "Alimento guardado no encontrado" })
      return
    }

    await prisma.savedFood.delete({ where: { id: savedId } })
    res.json({ message: "Eliminado" })
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar alimento guardado" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/nutrition/saved/:id/favorite — Toggle favorito
// ═══════════════════════════════════════════════════════
router.post("/saved/:id/favorite", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const savedId = req.params.id as string
    const saved = await prisma.savedFood.findUnique({ where: { id: savedId } })
    if (!saved || saved.userId !== user.id) {
      res.status(404).json({ error: "Alimento guardado no encontrado" })
      return
    }

    const updated = await prisma.savedFood.update({
      where: { id: savedId },
      data: { isFavorite: !saved.isFavorite },
    })

    res.json(updated)
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar favorito" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/nutrition/stats — Streak, consistency, perfect days
// ═══════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    // Get all food logs with entries count for the last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
    thirtyDaysAgo.setUTCHours(0, 0, 0, 0)

    const logs = await prisma.foodLog.findMany({
      where: {
        userId: user.id,
        date: { gte: thirtyDaysAgo },
      },
      select: {
        date: true,
        totalCalories: true,
        totalProtein: true,
        totalCarbs: true,
        totalFat: true,
        calorieGoal: true,
        proteinGoal: true,
        carbsGoal: true,
        fatGoal: true,
        _count: { select: { entries: true } },
      },
      orderBy: { date: "desc" },
    })

    // Streak: consecutive days with >= 3 entries (counting backwards from today)
    let streak = 0
    const todayStr = new Date().toISOString().split("T")[0]
    const logsByDate = new Map<string, typeof logs[0]>()
    for (const log of logs) {
      logsByDate.set(log.date.toISOString().split("T")[0], log)
    }

    const checkDate = new Date()
    for (let i = 0; i < 30; i++) {
      const dateStr = checkDate.toISOString().split("T")[0]
      const log = logsByDate.get(dateStr)
      if (log && log._count.entries >= 3) {
        streak++
      } else if (i === 0) {
        // Today might not have 3 entries yet — check if at least 1
        if (log && log._count.entries >= 1) {
          streak++ // Count today as partial
        } else {
          break
        }
      } else {
        break
      }
      checkDate.setUTCDate(checkDate.getUTCDate() - 1)
    }

    // Consistency: % of last 30 days with at least 1 entry
    const daysWithEntries = logs.filter((l) => l._count.entries >= 1).length
    const consistencyScore = Math.round((daysWithEntries / 30) * 100)

    // Perfect days: macros within ±10% of goal
    let perfectDays = 0
    for (const log of logs) {
      if (log._count.entries < 3) continue
      const calPct = log.calorieGoal > 0 ? log.totalCalories / log.calorieGoal : 0
      const protPct = log.proteinGoal > 0 ? log.totalProtein / log.proteinGoal : 0
      const carbPct = log.carbsGoal > 0 ? log.totalCarbs / log.carbsGoal : 0
      const fatPct = log.fatGoal > 0 ? log.totalFat / log.fatGoal : 0

      const withinRange = (v: number) => v >= 0.9 && v <= 1.1
      if (withinRange(calPct) && withinRange(protPct) && withinRange(carbPct) && withinRange(fatPct)) {
        perfectDays++
      }
    }

    // Today's progress toward "perfect day"
    const todayLog = logsByDate.get(todayStr)
    let todayPerfect = false
    if (todayLog && todayLog._count.entries >= 3) {
      const withinRange = (v: number) => v >= 0.9 && v <= 1.1
      const cP = todayLog.calorieGoal > 0 ? todayLog.totalCalories / todayLog.calorieGoal : 0
      const pP = todayLog.proteinGoal > 0 ? todayLog.totalProtein / todayLog.proteinGoal : 0
      const cbP = todayLog.carbsGoal > 0 ? todayLog.totalCarbs / todayLog.carbsGoal : 0
      const fP = todayLog.fatGoal > 0 ? todayLog.totalFat / todayLog.fatGoal : 0
      todayPerfect = withinRange(cP) && withinRange(pP) && withinRange(cbP) && withinRange(fP)
    }

    res.json({
      streak,
      consistencyScore,
      perfectDays,
      todayPerfect,
      daysTracked: daysWithEntries,
    })
  } catch (error) {
    console.error("Error nutrition/stats:", error)
    res.status(500).json({ error: "Error al obtener estadísticas" })
  }
})

export default router