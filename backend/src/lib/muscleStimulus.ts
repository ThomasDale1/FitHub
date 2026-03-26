// ─── MODELO DE ESTÍMULO MUSCULAR ──────────────────────
//
// Concepto central:
// El orden de los ejercicios afecta cuánto estímulo
// recibe cada músculo. El primer ejercicio de pecho
// activa más fibras que el tercero (fatiga acumulada).
//
// Fórmula base:
// estímulo_efectivo = activación_base * factor_fatiga * factor_orden
//
// Factor fatiga: disminuye con cada set previo del mismo músculo
// Factor orden: el ejercicio #1 = 1.0, #2 = 0.9, #3 = 0.8...

export interface ExerciseInWorkout {
  exerciseId: string
  order: number       // posición en el workout (1-based)
  setsCompleted: number
  muscleActivations: {
    muscleName: string
    activationPct: number
    isPrimary: boolean
  }[]
}

export interface MuscleStimulus {
  muscleName: string
  rawVolume: number       // volumen sin ajustar
  effectiveStimulus: number // 0.0 a 1.0
  setsCount: number
  fatigueLevel: number    // 0.0 a 1.0
}

// Constantes del modelo
const ORDER_DECAY = 0.05      // -5% de estímulo por posición
const FATIGUE_PER_SET = 0.08  // -8% de estímulo por set previo
const MIN_STIMULUS = 0.3      // mínimo 30% aunque haya mucha fatiga

export function calculateMuscleStimulus(
  exercises: ExerciseInWorkout[]
): Record<string, MuscleStimulus> {

  // Mapa de fatiga acumulada por músculo
  const muscleFatigue: Record<string, number> = {}
  const muscleData: Record<string, MuscleStimulus> = {}

  for (const exercise of [...exercises].sort((a, b) => a.order - b.order)) {

    // Factor de orden: ejercicio 1 = 1.0, ejercicio 2 = 0.95, etc.
    const orderFactor = Math.max(0.6, 1.0 - (exercise.order - 1) * ORDER_DECAY)

    for (const activation of exercise.muscleActivations) {
      const muscle = activation.muscleName

      if (!muscleFatigue[muscle]) muscleFatigue[muscle] = 0

      // Factor de fatiga actual para este músculo
      const currentFatigue = muscleFatigue[muscle]
      const fatigueFactor = Math.max(MIN_STIMULUS, 1.0 - currentFatigue)

      // Estímulo efectivo para este ejercicio en este músculo
      const effectiveStimulus =
        activation.activationPct * orderFactor * fatigueFactor

      // Acumular en el mapa de músculos
      if (!muscleData[muscle]) {
        muscleData[muscle] = {
          muscleName: muscle,
          rawVolume: 0,
          effectiveStimulus: 0,
          setsCount: 0,
          fatigueLevel: 0,
        }
      }

      muscleData[muscle].effectiveStimulus += effectiveStimulus
      muscleData[muscle].rawVolume += activation.activationPct * exercise.setsCompleted
      muscleData[muscle].setsCount += exercise.setsCompleted

      // Cada set añade fatiga proporcional a la activación
      muscleFatigue[muscle] +=
        activation.activationPct * exercise.setsCompleted * FATIGUE_PER_SET
    }
  }

  // Calcular nivel de fatiga final por músculo
  for (const muscle of Object.keys(muscleData)) {
    muscleData[muscle].fatigueLevel = Math.min(1.0, muscleFatigue[muscle])
  }

  return muscleData
}

// ─── CALCULAR 1RM ESTIMADO ────────────────────────────
// Fórmula de Epley: 1RM = weight * (1 + reps/30)
export function calculate1RM(weight: number, reps: number): number {
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

// ─── CALCULAR XP POR WORKOUT ──────────────────────────
// Basado en volumen total, sets completados y PRs
export function calculateWorkoutXP(
  totalVolume: number,
  setsCompleted: number,
  newPRs: number,
  durationMinutes: number
): number {
  let xp = 0

  // Base: 1 XP por cada 100kg de volumen
  xp += Math.floor(totalVolume / 100)

  // Bonus por sets completados
  xp += setsCompleted * 2

  // Bonus por PRs
  xp += newPRs * 25

  // Bonus por duración (máximo 30 XP)
  xp += Math.min(30, Math.floor(durationMinutes / 2))

  return xp
}