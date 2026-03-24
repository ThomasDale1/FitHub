// ─────────────────────────────────────────────────────
// mobile/components/profile/HistoryTab.tsx
// Combined history: Workouts + Nutrition + Steps
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import type { ProfileHistoryItem, NutritionHistoryItem, StepsHistoryItem } from "@/lib/api"

// ─── History Sub-Tab Selector ────────────────────────
type HistoryMode = "workouts" | "nutrition" | "steps"

function HistoryModeSelector({ value, onChange }: { value: HistoryMode; onChange: (v: HistoryMode) => void }) {
  const modes: { key: HistoryMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "workouts", label: "Workouts", icon: "barbell-outline" },
    { key: "nutrition", label: "Nutrición", icon: "nutrition-outline" },
    { key: "steps", label: "Pasos", icon: "walk-outline" },
  ]
  return (
    <View className="flex-row gap-x-2 mb-4">
      {modes.map(m => (
        <TouchableOpacity
          key={m.key}
          className={`flex-1 flex-row items-center justify-center gap-x-1.5 py-2.5 rounded-xl ${value === m.key ? "bg-primary/20 border border-primary/40" : "bg-background-elevated"}`}
          onPress={() => onChange(m.key)}
        >
          <Ionicons name={m.icon} size={14} color={value === m.key ? "#6C63FF" : "#6B6B80"} />
          <Text className={`text-xs font-semibold ${value === m.key ? "text-primary" : "text-text-muted"}`}>
            {m.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Workout Card ────────────────────────────────────
function WorkoutHistoryCard({ workout }: { workout: ProfileHistoryItem }) {
  const date = new Date(workout.date)
  const dateStr = date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
  const timeStr = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text className="text-white font-bold text-base">{workout.name}</Text>
          <Text className="text-text-muted text-xs mt-0.5">{dateStr} · {timeStr}</Text>
        </View>
        {workout.xpEarned > 0 && (
          <View className="bg-primary/20 rounded-xl px-2.5 py-1">
            <Text className="text-primary text-xs font-bold">+{workout.xpEarned} XP</Text>
          </View>
        )}
      </View>
      <View className="flex-row gap-x-4 mb-2">
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="time-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-xs">{workout.duration} min</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="layers-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-xs">{workout.setsCount} sets</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="barbell-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-xs">
            {workout.totalVolume >= 1000 ? `${(workout.totalVolume / 1000).toFixed(1)}t` : `${workout.totalVolume} kg`}
          </Text>
        </View>
        {workout.prsInWorkout > 0 && (
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="trophy" size={14} color="#F59E0B" />
            <Text className="text-yellow-400 text-xs font-bold">{workout.prsInWorkout} PR</Text>
          </View>
        )}
      </View>
      <View className="flex-row flex-wrap gap-x-2 gap-y-1">
        {workout.exercises.slice(0, 4).map((ex, i) => (
          <View key={i} className="bg-background-elevated rounded-lg px-2 py-1">
            <Text className="text-text-secondary text-xs capitalize">{ex}</Text>
          </View>
        ))}
        {workout.exercises.length > 4 && (
          <View className="bg-background-elevated rounded-lg px-2 py-1">
            <Text className="text-text-muted text-xs">+{workout.exercises.length - 4} más</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Nutrition Card ──────────────────────────────────
function NutritionHistoryCard({ log }: { log: NutritionHistoryItem }) {
  const date = new Date(log.date)
  const dateStr = date.toLocaleDateString("es", { day: "numeric", month: "short", weekday: "short" })
  const isOverGoal = log.caloriePercent > 110
  const isUnderGoal = log.caloriePercent < 80

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white font-bold text-sm">{dateStr}</Text>
        <View className={`rounded-xl px-2.5 py-1 ${isOverGoal ? "bg-red-500/20" : isUnderGoal ? "bg-yellow-500/20" : "bg-green-500/20"}`}>
          <Text className={`text-xs font-bold ${isOverGoal ? "text-red-400" : isUnderGoal ? "text-yellow-400" : "text-green-400"}`}>
            {log.caloriePercent}%
          </Text>
        </View>
      </View>

      {/* Calories bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-text-secondary text-xs">{log.calories} kcal</Text>
          <Text className="text-text-muted text-xs">Meta: {log.calorieGoal}</Text>
        </View>
        <View className="h-2 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.min(log.caloriePercent, 100)}%`,
              backgroundColor: isOverGoal ? "#EF4444" : isUnderGoal ? "#F59E0B" : "#10B981",
            }}
          />
        </View>
      </View>

      {/* Macros */}
      <View className="flex-row gap-x-4">
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }} />
          <Text className="text-text-secondary text-xs">P: {log.protein}g</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#3B82F6" }} />
          <Text className="text-text-secondary text-xs">C: {log.carbs}g</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#F59E0B" }} />
          <Text className="text-text-secondary text-xs">G: {log.fat}g</Text>
        </View>
        {log.water > 0 && (
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="water" size={10} color="#06B6D4" />
            <Text className="text-text-secondary text-xs">{log.water}ml</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Steps Card ──────────────────────────────────────
function StepsHistoryCard({ day }: { day: StepsHistoryItem }) {
  const date = new Date(day.date)
  const dateStr = date.toLocaleDateString("es", { day: "numeric", month: "short", weekday: "short" })

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white font-bold text-sm">{dateStr}</Text>
        <View className={`rounded-xl px-2.5 py-1 ${day.goalReached ? "bg-green-500/20" : "bg-background-elevated"}`}>
          {day.goalReached ? (
            <View className="flex-row items-center gap-x-1">
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Text className="text-green-400 text-xs font-bold">Meta</Text>
            </View>
          ) : (
            <Text className="text-text-muted text-xs">{day.goalPercent}%</Text>
          )}
        </View>
      </View>

      {/* Steps bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-green-400 font-bold text-lg">{day.steps.toLocaleString()}</Text>
          <Text className="text-text-muted text-xs self-end">/ {day.goal.toLocaleString()}</Text>
        </View>
        <View className="h-2 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${Math.min(day.goalPercent, 100)}%` }}
          />
        </View>
      </View>

      {/* Details */}
      <View className="flex-row gap-x-4">
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="flame-outline" size={12} color="#F59E0B" />
          <Text className="text-text-secondary text-xs">{day.calories} cal</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="navigate-outline" size={12} color="#6C63FF" />
          <Text className="text-text-secondary text-xs">{day.distance} km</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="time-outline" size={12} color="#10B981" />
          <Text className="text-text-secondary text-xs">{day.activeMinutes} min</Text>
        </View>
        {day.floors > 0 && (
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="arrow-up-outline" size={12} color="#EC4899" />
            <Text className="text-text-secondary text-xs">{day.floors} pisos</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Load More Button ────────────────────────────────
function LoadMoreButton({ loading, onPress }: { loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className="bg-background-card border border-background-elevated rounded-2xl py-3 mt-1 items-center"
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#6C63FF" size="small" />
      ) : (
        <Text className="text-primary text-sm font-semibold">Cargar más</Text>
      )}
    </TouchableOpacity>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN HISTORY TAB
// ═══════════════════════════════════════════════════════
interface HistoryTabProps {
  // Workouts
  workouts: ProfileHistoryItem[]
  workoutsLoading: boolean
  workoutsLoadingMore: boolean
  workoutsTotal: number
  workoutsHasMore: boolean
  onLoadMoreWorkouts: () => void
  // Nutrition
  nutritionLogs: NutritionHistoryItem[]
  nutritionLoading: boolean
  nutritionLoadingMore: boolean
  nutritionTotal: number
  nutritionHasMore: boolean
  onLoadMoreNutrition: () => void
  // Steps
  stepsDays: StepsHistoryItem[]
  stepsLoading: boolean
  stepsLoadingMore: boolean
  stepsTotal: number
  stepsHasMore: boolean
  onLoadMoreSteps: () => void
}

export default function HistoryTab(props: HistoryTabProps) {
  const [mode, setMode] = useState<HistoryMode>("workouts")

  return (
    <View>
      <HistoryModeSelector value={mode} onChange={setMode} />

      {/* Workouts */}
      {mode === "workouts" && (
        <>
          {props.workoutsLoading ? (
            <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
          ) : props.workouts.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="barbell-outline" size={48} color="#4A4A5A" />
              <Text className="text-text-muted text-sm mt-3">Aún no hay entrenamientos</Text>
            </View>
          ) : (
            <>
              <Text className="text-text-secondary text-xs mb-3">
                {props.workoutsTotal} entrenamiento{props.workoutsTotal !== 1 ? "s" : ""} completado{props.workoutsTotal !== 1 ? "s" : ""}
              </Text>
              {props.workouts.map(w => <WorkoutHistoryCard key={w.id} workout={w} />)}
              {props.workoutsHasMore && (
                <LoadMoreButton loading={props.workoutsLoadingMore} onPress={props.onLoadMoreWorkouts} />
              )}
            </>
          )}
        </>
      )}

      {/* Nutrition */}
      {mode === "nutrition" && (
        <>
          {props.nutritionLoading ? (
            <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
          ) : props.nutritionLogs.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="nutrition-outline" size={48} color="#4A4A5A" />
              <Text className="text-text-muted text-sm mt-3">Sin registros de nutrición</Text>
            </View>
          ) : (
            <>
              <Text className="text-text-secondary text-xs mb-3">
                {props.nutritionTotal} día{props.nutritionTotal !== 1 ? "s" : ""} registrado{props.nutritionTotal !== 1 ? "s" : ""}
              </Text>
              {props.nutritionLogs.map(l => <NutritionHistoryCard key={l.id} log={l} />)}
              {props.nutritionHasMore && (
                <LoadMoreButton loading={props.nutritionLoadingMore} onPress={props.onLoadMoreNutrition} />
              )}
            </>
          )}
        </>
      )}

      {/* Steps */}
      {mode === "steps" && (
        <>
          {props.stepsLoading ? (
            <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
          ) : props.stepsDays.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="walk-outline" size={48} color="#4A4A5A" />
              <Text className="text-text-muted text-sm mt-3">Sin registros de pasos</Text>
            </View>
          ) : (
            <>
              <Text className="text-text-secondary text-xs mb-3">
                {props.stepsTotal} día{props.stepsTotal !== 1 ? "s" : ""} registrado{props.stepsTotal !== 1 ? "s" : ""}
              </Text>
              {props.stepsDays.map(d => <StepsHistoryCard key={d.id} day={d} />)}
              {props.stepsHasMore && (
                <LoadMoreButton loading={props.stepsLoadingMore} onPress={props.onLoadMoreSteps} />
              )}
            </>
          )}
        </>
      )}
    </View>
  )
}
