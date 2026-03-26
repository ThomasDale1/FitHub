// ─────────────────────────────────────────────────────
// mobile/context/TourContext.tsx
// Onboarding forced-tour global state
// ─────────────────────────────────────────────────────
import { createContext, useContext, useState } from "react"

export type TourStep = 0 | 1 | 2 // 0=Social, 1=Steps, 2=Workout
export type WorkoutPhase = "tab" | "inScreen"

interface TourContextValue {
  isActive: boolean
  step: TourStep | null
  workoutPhase: WorkoutPhase
  isTransitioning: boolean
  startTour: () => void
  beginTransition: () => void
  advanceStep: () => void
  enterWorkoutScreen: () => void
  completeTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isActive, setIsActive] = useState(false)
  const [step, setStep] = useState<TourStep | null>(null)
  const [workoutPhase, setWorkoutPhase] = useState<WorkoutPhase>("tab")
  const [isTransitioning, setIsTransitioning] = useState(false)

  const startTour = () => {
    setIsActive(true)
    setStep(0)
    setWorkoutPhase("tab")
    setIsTransitioning(false)
  }

  const beginTransition = () => {
    setIsTransitioning(true)
  }

  const advanceStep = () => {
    setIsTransitioning(false)
    setStep(prev => {
      if (prev === null || prev >= 2) return prev
      return (prev + 1) as TourStep
    })
  }

  const enterWorkoutScreen = () => {
    setWorkoutPhase("inScreen")
  }

  const completeTour = () => {
    setIsActive(false)
    setStep(null)
    setWorkoutPhase("tab")
    setIsTransitioning(false)
  }

  return (
    <TourContext.Provider value={{
      isActive,
      step,
      workoutPhase,
      isTransitioning,
      startTour,
      beginTransition,
      advanceStep,
      enterWorkoutScreen,
      completeTour,
    }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error("useTour must be used inside TourProvider")
  return ctx
}
