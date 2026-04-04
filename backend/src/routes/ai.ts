// ─────────────────────────────────────────────────────
// backend/src/routes/ai.ts
// Sprint 3B: AI Coach — Chat inteligente con contexto
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"
import OpenAI from "openai"
import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Construir el contexto del usuario para la IA
async function buildUserContext(userId: string, clientDate?: string, clientHour?: number): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      weight: true,
      height: true,
      bodyFat: true,
      xp: true,
      level: true,
      streak: true,
      proteinGoal: true,
      carbsGoal: true,
      fatGoal: true,
    },
  })

  // Últimos 5 workouts
  const recentWorkouts = await prisma.workout.findMany({
    where: { userId, isCompleted: true },
    select: {
      name: true,
      duration: true,
      totalVolume: true,
      xpEarned: true,
      startTime: true,
      sets: {
        select: { exerciseName: true, weight: true, reps: true },
        where: { isCompleted: true },
        take: 20,
      },
    },
    orderBy: { startTime: "desc" },
    take: 5,
  })

  // PRs actuales
  const prs = await prisma.personalRecord.findMany({
    where: { userId },
    select: { exerciseName: true, weight: true, reps: true, oneRepMax: true },
    orderBy: { achievedAt: "desc" },
    take: 10,
  })

  // Stats generales
  const totalWorkouts = await prisma.workout.count({
    where: { userId, isCompleted: true },
  })

  const volumeResult = await prisma.workout.aggregate({
    where: { userId, isCompleted: true },
    _sum: { totalVolume: true },
  })

  // Nutrición de hoy (si existe)
  const todayStr = clientDate ?? new Date().toISOString().split("T")[0]
  const today = new Date(todayStr + "T00:00:00.000Z")
  const todayNutrition = await prisma.foodLog.findUnique({
    where: { userId_date: { userId, date: today } },
    select: {
      totalCalories: true,
      totalProtein: true,
      totalCarbs: true,
      totalFat: true,
      calorieGoal: true,
      waterMl: true,
      waterGoalMl: true,
    },
  })

  // ─── Wellness data ──────────────────────────────────
  const todayStart = new Date(todayStr + "T00:00:00.000Z")
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  const sevenDaysAgo = new Date(todayStart)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const oneDayAgo = new Date(todayStart)
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  const [readinessToday, sleepRecent, moodRecent, sorenessToday, breathingRecent] = await Promise.all([
    prisma.readinessScore.findUnique({
      where: { userId_date: { userId, date: todayStart } },
      select: { score: true, zone: true, recommendation: true, sleepComponent: true, moodComponent: true, stressComponent: true, loadComponent: true, sorenessComponent: true },
    }),
    prisma.sleepLog.findFirst({
      where: { userId, date: { gte: oneDayAgo } },
      orderBy: { date: "desc" },
      select: { durationMinutes: true, sleepScore: true, quality: true },
    }),
    prisma.moodLog.findMany({
      where: { userId, loggedAt: { gte: sevenDaysAgo } },
      orderBy: { loggedAt: "desc" },
      take: 5,
      select: { mood: true, energy: true, stress: true, loggedAt: true },
    }),
    prisma.sorenessLog.findFirst({
      where: { userId, date: { gte: oneDayAgo } },
      orderBy: { date: "desc" },
      select: { overallSoreness: true, muscleData: true },
    }),
    prisma.breathingSession.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      select: { technique: true, durationSec: true },
      take: 10,
    }),
  ])

  // Formatear contexto
  let context = `DATOS DEL USUARIO:\n`
  context += `- Nombre: ${user?.name || "No especificado"}\n`
  if (user?.weight) context += `- Peso: ${user.weight} kg\n`
  if (user?.height) context += `- Altura: ${user.height} cm\n`
  if (user?.bodyFat) context += `- Grasa corporal: ${user.bodyFat}%\n`
  context += `- Nivel: ${user?.level || 1} (${user?.xp || 0} XP)\n`
  context += `- Streak: ${user?.streak || 0} días\n`
  context += `- Total workouts: ${totalWorkouts}\n`
  context += `- Volumen total: ${Math.round(volumeResult._sum.totalVolume || 0)} kg\n\n`

  if (recentWorkouts.length > 0) {
    context += `ÚLTIMOS WORKOUTS:\n`
    for (const w of recentWorkouts) {
      const date = w.startTime.toLocaleDateString("es", { month: "short", day: "numeric" })
      context += `- ${date}: ${w.name} (${w.duration}min, ${Math.round(w.totalVolume)}kg vol)\n`
      const exercises = [...new Set(w.sets.map((s) => s.exerciseName))]
      context += `  Ejercicios: ${exercises.join(", ")}\n`
    }
    context += "\n"
  }

  if (prs.length > 0) {
    context += `RECORDS PERSONALES (top 10):\n`
    for (const pr of prs) {
      context += `- ${pr.exerciseName}: ${pr.weight}kg x ${pr.reps} (1RM est: ${pr.oneRepMax}kg)\n`
    }
    context += "\n"
  }

  const parsedClientDate = clientDate ? new Date(clientDate) : null
  let extractedClientHour: number
  
  // Use explicit clientHour if provided, otherwise derive from ISO datetime string
  if (typeof clientHour === "number" && clientHour >= 0 && clientHour < 24) {
    extractedClientHour = clientHour
  } else if (clientDate && clientDate.includes("T") && !Number.isNaN(new Date(clientDate).getTime())) {
    // ISO datetime string provided
    // Note: getHours() uses server timezone; consider requiring clientHour for accuracy
    extractedClientHour = new Date(clientDate).getHours()
  } else if (parsedClientDate && !Number.isNaN(parsedClientDate.getTime())) {
    // Date-only string - fall back to server time since UTC hours would be 0
    extractedClientHour = new Date().getHours()
  } else {
    // Fallback to server time
    extractedClientHour = new Date().getHours()
  }
  if (todayNutrition) {
    context += `NUTRICIÓN HOY:\n`
    context += `- Calorías: ${todayNutrition.totalCalories}/${todayNutrition.calorieGoal} kcal\n`
    context += `- Proteína: ${todayNutrition.totalProtein}g/${user?.proteinGoal ?? 150}g meta\n`
    context += `- Carbos: ${todayNutrition.totalCarbs}g/${user?.carbsGoal ?? 250}g meta\n`
    context += `- Grasa: ${todayNutrition.totalFat}g/${user?.fatGoal ?? 65}g meta\n`
    context += `- Agua: ${todayNutrition.waterMl}/${todayNutrition.waterGoalMl}ml\n`
    context += `- Hora actual: ${extractedClientHour}:00\n`
  } else {
    context += `NUTRICIÓN HOY: Sin registros aún\n`
    context += `- Hora actual: ${extractedClientHour}:00\n`
  }

  // ─── Wellness / Bienestar ─────────────────────────
  context += "\nBIENESTAR:\n"

  if (readinessToday) {
    const zoneLabel = readinessToday.zone === "GREEN" ? "Verde (buena)" : readinessToday.zone === "YELLOW" ? "Amarilla (moderada)" : "Roja (baja)"
    context += `- Readiness hoy: ${readinessToday.score}/100 (zona ${zoneLabel})\n`
    context += `  Componentes: Sueño ${readinessToday.sleepComponent}/35, Ánimo ${readinessToday.moodComponent}/20, Estrés ${readinessToday.stressComponent}/15, Carga ${readinessToday.loadComponent}/20, Soreness ${readinessToday.sorenessComponent}/10\n`
    if (readinessToday.recommendation) context += `  Recomendación: ${readinessToday.recommendation}\n`
  } else {
    context += `- Readiness hoy: No calculado aún\n`
  }

  if (sleepRecent) {
    const h = Math.floor(sleepRecent.durationMinutes / 60)
    const m = sleepRecent.durationMinutes % 60
    context += `- Sueño anoche: ${h}h${String(m).padStart(2, "0")} (score ${sleepRecent.sleepScore ?? "N/A"}/100, calidad ${sleepRecent.quality}/5)\n`
  } else {
    context += `- Sueño anoche: Sin registro\n`
  }

  if (moodRecent.length > 0) {
    const latest = moodRecent[0]
    context += `- Último mood: ánimo ${latest.mood}/5, energía ${latest.energy}/5, estrés ${latest.stress}/5\n`
    if (moodRecent.length >= 3) {
      const avgMood = (moodRecent.reduce((s, m) => s + m.mood, 0) / moodRecent.length).toFixed(1)
      const avgEnergy = (moodRecent.reduce((s, m) => s + m.energy, 0) / moodRecent.length).toFixed(1)
      context += `  Promedios últimos ${moodRecent.length} registros: ánimo ${avgMood}, energía ${avgEnergy}\n`
    }
  }

  if (sorenessToday) {
    const sorenessLabels = ["Nada", "Mínimo", "Leve", "Moderado", "Alto", "Intenso"]
    context += `- Soreness: ${sorenessLabels[sorenessToday.overallSoreness]} (${sorenessToday.overallSoreness}/5)\n`
    if (sorenessToday.muscleData && typeof sorenessToday.muscleData === "object") {
      const muscles = sorenessToday.muscleData as Record<string, number>
      const sore = Object.entries(muscles).filter(([, v]) => v >= 3).map(([k, v]) => `${k}(${v})`)
      if (sore.length > 0) context += `  Músculos más adoloridos: ${sore.join(", ")}\n`
    }
  }

  if (breathingRecent.length > 0) {
    const totalMin = Math.round(breathingRecent.reduce((s, b) => s + b.durationSec, 0) / 60)
    context += `- Respiración última semana: ${breathingRecent.length} sesiones, ${totalMin} min total\n`
  }

  return context
}

const SYSTEM_PROMPT = `Eres el AI Coach de Fit Hub, una app de fitness. Tu personalidad:
- Eres motivador pero realista, como un entrenador personal experto
- Hablas en español, de forma directa y amigable
- Usas emojis ocasionalmente para dar energía (💪🔥🎯)
- Basas tus consejos en los DATOS REALES del usuario que te proporciono
- Si detectas plateaus (mismo peso en un ejercicio por semanas), lo mencionas
- Sugieres deloads cuando el volumen es muy alto por muchas semanas
- Recomiendas ejercicios específicos basándote en lo que ya hace el usuario
- Para nutrición, das consejos prácticos basados en sus macros actuales
- Nunca inventas datos — si no tienes info suficiente, lo dices
- Mantienes las respuestas concisas (máximo 200 palabras a menos que pidan detalle)
- Si el usuario pregunta algo médico serio, recomiendas consultar un profesional

IMPORTANTE: Tienes acceso al historial de entrenamiento, PRs, nutrición Y bienestar del usuario (readiness, sueño, ánimo, estrés, soreness, respiración).
Úsalos para dar consejos personalizados y específicos.
- Si el readiness está en zona ROJA, recomienda descanso o recovery activa
- Si el sueño es < 6h, sugiérelo como prioridad
- Si el estrés es alto (4-5), recomienda respiración o journaling
- Relaciona el bienestar con el entrenamiento: "dormiste poco → baja la intensidad hoy"`

// ═══════════════════════════════════════════════════════
// POST /api/ai/chat — Enviar mensaje al AI Coach
// ═══════════════════════════════════════════════════════
router.post("/chat", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { message, clientDate, clientHour } = req.body

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message es requerido" })
      return
    }

    // Guardar mensaje del usuario
    await prisma.aiChatMessage.create({
      data: { userId: user.id, role: "user", content: message },
    })

    // Obtener historial reciente (últimos 20 mensajes)
    const chatHistory = await prisma.aiChatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { role: true, content: true },
    })

    // Invertir para orden cronológico
    chatHistory.reverse()

    // Construir contexto del usuario
    const userContext = await buildUserContext(
      user.id,
      typeof clientDate === "string" ? clientDate : undefined,
      typeof clientHour === "number" ? clientHour : undefined
    )

    // Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${SYSTEM_PROMPT}\n\n${userContext}`,
        },
        ...chatHistory.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0]?.message?.content || "Lo siento, no pude generar una respuesta."

    // Guardar respuesta de la IA
    await prisma.aiChatMessage.create({
      data: { userId: user.id, role: "assistant", content: aiResponse },
    })

    // XP por usar el coach (2 XP por interacción)
    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 2 } },
    })

    res.json({
      message: aiResponse,
      xpEarned: 2,
    })
  } catch (error: any) {
    console.error("AI Chat error:", error)

    // Si es error de OpenAI, dar feedback específico
    if (error?.status === 429) {
      res.status(429).json({ error: "Demasiadas solicitudes. Espera un momento." })
      return
    }
    if (error?.status === 401) {
      res.status(500).json({ error: "Error de configuración del AI Coach." })
      return
    }

    res.status(500).json({ error: "Error al procesar mensaje" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/ai/history — Historial del chat
// ═══════════════════════════════════════════════════════
router.get("/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const messages = await prisma.aiChatMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    res.json({ messages })
  } catch (error) {
    res.status(500).json({ error: "Error al obtener historial" })
  }
})

// ═══════════════════════════════════════════════════════
// DELETE /api/ai/history — Borrar historial del chat
// ═══════════════════════════════════════════════════════
router.delete("/history", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    await prisma.aiChatMessage.deleteMany({
      where: { userId: user.id },
    })

    res.json({ message: "Historial borrado" })
  } catch (error) {
    res.status(500).json({ error: "Error al borrar historial" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/ai/quick — Respuestas rápidas predefinidas
// ═══════════════════════════════════════════════════════
router.post("/quick", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { type, clientDate: quickClientDate } = req.body // "workout_suggestion" | "nutrition_tip" | "motivation" | "recovery"

    const prompts: Record<string, string> = {
      workout_suggestion: "Basándote en mis últimos workouts, ¿qué debería entrenar hoy? Dame un plan concreto con ejercicios, series y repeticiones.",
      nutrition_tip: "Analiza mi nutrición de hoy con los datos que tienes. Da UN consejo breve (max 2 frases) y accionable. Si me falta proteína, sugiere alimentos específicos con gramos. Si ya excedí calorías, sé empático. Si es temprano y no he loggeado nada, motiva. Responde en español casual.",
      motivation: "Dame motivación basada en mi progreso real. ¿Qué he logrado y cuál es mi siguiente meta?",
      recovery: "Basándote en mis workouts recientes, ¿necesito un día de descanso? ¿Algún grupo muscular que deba descansar?",
    }

    const message = prompts[type]
    if (!message) {
      res.status(400).json({ error: "Tipo no válido. Opciones: workout_suggestion, nutrition_tip, motivation, recovery" })
      return
    }

    // Reusar la lógica de chat
    req.body.message = message
    // Forward al handler de chat (llamamos directamente la lógica)
    await prisma.aiChatMessage.create({
      data: { userId: user.id, role: "user", content: message },
    })

    const userContext = await buildUserContext(user.id)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${userContext}` },
        { role: "user", content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
    })

    const aiResponse = completion.choices[0]?.message?.content || "No pude generar una respuesta."

    await prisma.aiChatMessage.create({
      data: { userId: user.id, role: "assistant", content: aiResponse },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { xp: { increment: 2 } },
    })

    res.json({ message: aiResponse, xpEarned: 2, type })
  } catch (error) {
    console.error("AI Quick error:", error)
    res.status(500).json({ error: "Error al procesar solicitud" })
  }
})

export default router