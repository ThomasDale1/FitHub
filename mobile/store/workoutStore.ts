import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── TIPOS ────────────────────────────────────────────

export interface ActiveSet {
  id: string;          // ID local temporal
  setNumber: number;
  weight: string;      // string para el input
  reps: string;        // string para el input
  rpe?: string;
  setType: SetType;
  isCompleted: boolean;
  isPR?: boolean;
  restSeconds?: number;
  notes?: string;
}

export type SetType =
  | "NORMAL"
  | "WARMUP"
  | "DROPSET"
  | "SUPERSET"
  | "FAILURE"
  | "AMRAP";

export interface ActiveExercise {
  id: string;          // ID local temporal
  externalId: string;  // ID de ExerciseDB
  exerciseName: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl?: string;     // solo en memoria, nunca se guarda
  order: number;
  sets: ActiveSet[];
  restSeconds: number; // tiempo de descanso configurado
}

export interface ActiveWorkout {
  workoutId: string | null;  // ID del backend (null hasta crear)
  name: string;
  startTime: Date;
  exercises: ActiveExercise[];
  isActive: boolean;
}

// ─── ESTADO INICIAL ───────────────────────────────────

const emptyWorkout: ActiveWorkout = {
  workoutId: null,
  name: "Workout",
  startTime: new Date(),
  exercises: [],
  isActive: false,
};

// ─── STORE ────────────────────────────────────────────

interface WorkoutStore {
  activeWorkout: ActiveWorkout;

  // Acciones del workout
  startWorkout: (name: string) => void;
  finishWorkout: () => void;
  cancelWorkout: () => void;
  setWorkoutId: (id: string) => void;
  setWorkoutName: (name: string) => void;

  // Acciones de ejercicios
  addExercise: (exercise: Omit<ActiveExercise, "id" | "order" | "sets">) => void;
  removeExercise: (exerciseId: string) => void;
  reorderExercises: (exercises: ActiveExercise[]) => void;

  // Acciones de sets
  addSet: (exerciseId: string) => void;
  removeSet: (exerciseId: string, setId: string) => void;
  updateSet: (exerciseId: string, setId: string, data: Partial<ActiveSet>) => void;
  completeSet: (exerciseId: string, setId: string) => void;
  updateRestTime: (exerciseId: string, seconds: number) => void;
}

export const useWorkoutStore = create<WorkoutStore>()(
  persist(
    (set, get) => ({
      activeWorkout: emptyWorkout,

      // ─── WORKOUT ────────────────────────────────────
      startWorkout: (name) => {
        set({
          activeWorkout: {
            workoutId: null,
            name,
            startTime: new Date(),
            exercises: [],
            isActive: true,
          },
        });
      },

      finishWorkout: () => {
        set({ activeWorkout: emptyWorkout });
      },

      cancelWorkout: () => {
        set({ activeWorkout: emptyWorkout });
      },

      setWorkoutId: (id) => {
        set((state) => ({
          activeWorkout: { ...state.activeWorkout, workoutId: id },
        }));
      },

      setWorkoutName: (name) => {
        set((state) => ({
          activeWorkout: { ...state.activeWorkout, name },
        }));
      },

      // ─── EJERCICIOS ─────────────────────────────────
      addExercise: (exercise) => {
        const { activeWorkout } = get();
        const newExercise: ActiveExercise = {
          ...exercise,
          id: `ex_${Date.now()}`,
          order: activeWorkout.exercises.length + 1,
          sets: [
            {
              id: `set_${Date.now()}`,
              setNumber: 1,
              weight: "",
              reps: "",
              setType: "NORMAL",
              isCompleted: false,
            },
          ],
        };

        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: [...state.activeWorkout.exercises, newExercise],
          },
        }));
      },

      removeExercise: (exerciseId) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises
              .filter((e) => e.id !== exerciseId)
              .map((e, i) => ({ ...e, order: i + 1 })),
          },
        }));
      },

      reorderExercises: (exercises) => {
        set((state) => ({
          activeWorkout: { ...state.activeWorkout, exercises },
        }));
      },

      // ─── SETS ───────────────────────────────────────
      addSet: (exerciseId) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex;
              const lastSet = ex.sets[ex.sets.length - 1];
              return {
                ...ex,
                sets: [
                  ...ex.sets,
                  {
                    id: `set_${Date.now()}`,
                    setNumber: ex.sets.length + 1,
                    // Pre-llenar con el último peso/reps
                    weight: lastSet?.weight || "",
                    reps: lastSet?.reps || "",
                    setType: "NORMAL" as SetType,
                    isCompleted: false,
                  },
                ],
              };
            }),
          },
        }));
      },

      removeSet: (exerciseId, setId) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex;
              return {
                ...ex,
                sets: ex.sets
                  .filter((s) => s.id !== setId)
                  .map((s, i) => ({ ...s, setNumber: i + 1 })),
              };
            }),
          },
        }));
      },

      updateSet: (exerciseId, setId, data) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex;
              return {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId ? { ...s, ...data } : s
                ),
              };
            }),
          },
        }));
      },

      completeSet: (exerciseId, setId) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((ex) => {
              if (ex.id !== exerciseId) return ex;
              return {
                ...ex,
                sets: ex.sets.map((s) =>
                  s.id === setId
                    ? { ...s, isCompleted: !s.isCompleted }
                    : s
                ),
              };
            }),
          },
        }));
      },

      updateRestTime: (exerciseId, seconds) => {
        set((state) => ({
          activeWorkout: {
            ...state.activeWorkout,
            exercises: state.activeWorkout.exercises.map((ex) =>
              ex.id === exerciseId
                ? { ...ex, restSeconds: seconds }
                : ex
            ),
          },
        }));
      },
    }),
    {
      name: "fithub-active-workout",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);