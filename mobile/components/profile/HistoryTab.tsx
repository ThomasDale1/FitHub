// ─────────────────────────────────────────────────────
// mobile/components/profile/HistoryTab.tsx
// Paginated workout history list
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import type { ProfileHistoryItem } from "@/lib/api"

function WorkoutHistoryCard({ workout }: { workout: ProfileHistoryItem }) {
  const date = new Date(workout.date)
  const dateStr = date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
  const timeStr = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      {/* Header */}
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

      {/* Quick stats */}
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
            {workout.totalVolume >= 1000
              ? `${(workout.totalVolume / 1000).toFixed(1)}t`
              : `${workout.totalVolume} kg`}
          </Text>
        </View>
        {workout.prsInWorkout > 0 && (
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="trophy" size={14} color="#F59E0B" />
            <Text className="text-yellow-400 text-xs font-bold">{workout.prsInWorkout} PR</Text>
          </View>
        )}
      </View>

      {/* Exercises */}
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

interface HistoryTabProps {
  workouts: ProfileHistoryItem[]
  loading: boolean
  loadingMore: boolean
  total: number
  hasMore: boolean
  onLoadMore: () => void
}

export default function HistoryTab({ workouts, loading, loadingMore, total, hasMore, onLoadMore }: HistoryTabProps) {
  if (loading) {
    return <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
  }

  if (workouts.length === 0) {
    return (
      <View className="items-center py-12">
        <Ionicons name="barbell-outline" size={48} color="#4A4A5A" />
        <Text className="text-text-muted text-sm mt-3">Aún no hay entrenamientos</Text>
      </View>
    )
  }

  return (
    <View>
      <Text className="text-text-secondary text-xs mb-3">
        {total} entrenamiento{total !== 1 ? "s" : ""} completado{total !== 1 ? "s" : ""}
      </Text>

      {workouts.map(w => (
        <WorkoutHistoryCard key={w.id} workout={w} />
      ))}

      {hasMore && (
        <TouchableOpacity
          className="bg-background-card border border-background-elevated rounded-2xl py-3 mt-1 items-center"
          onPress={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : (
            <Text className="text-primary text-sm font-semibold">Cargar más</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  )
}
