// ─────────────────────────────────────────────────────
// mobile/components/profile/StatsTab.tsx
// Expanded stats with 5 categories + charts
// ─────────────────────────────────────────────────────
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import type { ProfileExpandedStats } from "@/lib/api"

// ─── Stat Row ────────────────────────────────────────
function StatRow({ icon, label, value, color = "#A0A0B0" }: {
  icon: keyof typeof Ionicons.glyphMap
  label: string
  value: string | number
  color?: string
}) {
  return (
    <View className="flex-row items-center py-2">
      <Ionicons name={icon} size={16} color={color} />
      <Text className="text-text-secondary text-sm flex-1 ml-3">{label}</Text>
      <Text className="text-white font-bold text-sm">{value}</Text>
    </View>
  )
}

// ─── Stat Section ────────────────────────────────────
function StatSection({ title, icon, color, children }: {
  title: string
  icon: keyof typeof Ionicons.glyphMap
  color: string
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(true)
  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      <TouchableOpacity className="flex-row items-center gap-x-2 mb-2" onPress={() => setExpanded(!expanded)}>
        <View className="rounded-xl p-1.5" style={{ backgroundColor: color + "20" }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text className="text-white font-bold text-base flex-1">{title}</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#6B6B80" />
      </TouchableOpacity>
      {expanded && children}
    </View>
  )
}

// ─── Format helpers ──────────────────────────────────
function fmtVol(v: number) { return v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v} kg` }
function fmtDist(d: number) { return d >= 100 ? `${(d / 100).toFixed(0)} km` : `${d.toFixed(1)} km` }
function fmtTime(min: number) { return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min}m` }

interface StatsTabProps {
  data: ProfileExpandedStats | null
  loading: boolean
}

export default function StatsTab({ data, loading }: StatsTabProps) {
  if (loading || !data) {
    return <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
  }

  const t = data.training
  const a = data.activity
  const n = data.nutrition
  const b = data.body
  const g = data.gamification

  return (
    <View>
      {/* Training */}
      <StatSection title="Entrenamiento" icon="barbell-outline" color="#6C63FF">
        <StatRow icon="fitness-outline" label="Total Workouts" value={t.totalWorkouts} color="#6C63FF" />
        <StatRow icon="trending-up-outline" label="Promedio Semanal" value={t.weeklyAvg} color="#6C63FF" />
        <StatRow icon="pie-chart-outline" label="Consistencia (30d)" value={`${t.monthlyConsistency}%`} color="#6C63FF" />
        <StatRow icon="layers-outline" label="Volumen Total" value={fmtVol(t.totalVolume)} color="#6C63FF" />
        <StatRow icon="time-outline" label="Tiempo Total" value={fmtTime(t.totalMinutes)} color="#6C63FF" />
        <StatRow icon="timer-outline" label="Duración Promedio" value={`${t.avgDuration} min`} color="#6C63FF" />
        <StatRow icon="trophy-outline" label="Total PRs" value={t.totalPRs} color="#6C63FF" />
        {t.topExercise && (
          <StatRow icon="heart" label="Ejercicio Favorito" value={t.topExercise.name} color="#FF6B6B" />
        )}
        {t.longestWorkout && (
          <StatRow icon="medal-outline" label="Workout Más Largo" value={`${t.longestWorkout.duration} min`} color="#F59E0B" />
        )}
      </StatSection>

      {/* Strength PRs */}
      {(t.totalPRs > 0 || data.strength.estimatedTotal > 0) && (
        <StatSection title="Fuerza (PRs)" icon="trophy-outline" color="#F59E0B">
          {data.strength.benchPR > 0 && (
            <StatRow icon="fitness-outline" label="Bench Press PR" value={`${data.strength.benchPR} kg`} color="#F59E0B" />
          )}
          {data.strength.squatPR > 0 && (
            <StatRow icon="fitness-outline" label="Squat PR" value={`${data.strength.squatPR} kg`} color="#F59E0B" />
          )}
          {data.strength.deadliftPR > 0 && (
            <StatRow icon="fitness-outline" label="Deadlift PR" value={`${data.strength.deadliftPR} kg`} color="#F59E0B" />
          )}
          {data.strength.ohpPR > 0 && (
            <StatRow icon="fitness-outline" label="Overhead Press PR" value={`${data.strength.ohpPR} kg`} color="#F59E0B" />
          )}
          {data.strength.rowPR > 0 && (
            <StatRow icon="fitness-outline" label="Row PR" value={`${data.strength.rowPR} kg`} color="#F59E0B" />
          )}
          {data.strength.estimatedTotal > 0 && (
            <View className="mt-2 pt-2 border-t border-background-elevated">
              <StatRow icon="podium-outline" label="Total Estimado (B+S+D)" value={`${data.strength.estimatedTotal} kg`} color="#8B5CF6" />
            </View>
          )}
        </StatSection>
      )}

      {/* Activity */}
      <StatSection title="Actividad" icon="walk-outline" color="#10B981">
        <StatRow icon="footsteps-outline" label="Pasos Totales" value={a.totalSteps.toLocaleString()} color="#10B981" />
        <StatRow icon="trending-up-outline" label="Promedio Diario" value={a.avgDailySteps.toLocaleString()} color="#10B981" />
        <StatRow icon="navigate-outline" label="Distancia Total" value={fmtDist(a.totalDistance)} color="#10B981" />
        <StatRow icon="flash-outline" label="Récord Diario" value={a.dailyRecord.toLocaleString()} color="#10B981" />
        <StatRow icon="body-outline" label="Min. Activos/Día" value={`${a.avgActiveMinutes} min`} color="#10B981" />
        <StatRow icon="checkmark-circle-outline" label="Días Meta Cumplida" value={`${a.goalDaysPercent}%`} color="#10B981" />
      </StatSection>

      {/* Nutrition */}
      <StatSection title="Nutrición" icon="nutrition-outline" color="#F59E0B">
        <StatRow icon="flame-outline" label="Cal. Promedio" value={`${n.avgCalories} kcal`} color="#F59E0B" />
        <StatRow icon="egg-outline" label="Proteína Prom." value={`${n.avgProtein}g`} color="#EF4444" />
        <StatRow icon="leaf-outline" label="Carbos Prom." value={`${n.avgCarbs}g`} color="#3B82F6" />
        <StatRow icon="water-outline" label="Grasa Prom." value={`${n.avgFat}g`} color="#F59E0B" />
        <StatRow icon="water" label="Agua Prom." value={`${n.avgWater} ml`} color="#06B6D4" />
        <StatRow icon="calendar-outline" label="Días Registrados" value={n.daysLogged} color="#F59E0B" />
      </StatSection>

      {/* Body */}
      {(b.currentWeight || b.height) && (
        <StatSection title="Cuerpo" icon="body-outline" color="#EC4899">
          {b.currentWeight && <StatRow icon="scale-outline" label="Peso Actual" value={`${b.currentWeight} kg`} color="#EC4899" />}
          {b.weightChange !== null && (
            <StatRow
              icon={b.weightChange <= 0 ? "trending-down-outline" : "trending-up-outline"}
              label="Cambio de Peso"
              value={`${b.weightChange > 0 ? "+" : ""}${b.weightChange} kg`}
              color={b.weightChange <= 0 ? "#10B981" : "#EF4444"}
            />
          )}
          {b.currentBF && <StatRow icon="water-outline" label="Grasa Corporal" value={`${b.currentBF}%`} color="#EC4899" />}
          {b.bfChange !== null && (
            <StatRow
              icon={b.bfChange <= 0 ? "trending-down-outline" : "trending-up-outline"}
              label="Cambio BF"
              value={`${b.bfChange > 0 ? "+" : ""}${b.bfChange}%`}
              color={b.bfChange <= 0 ? "#10B981" : "#EF4444"}
            />
          )}
          {b.height && <StatRow icon="resize-outline" label="Altura" value={`${b.height} cm`} color="#EC4899" />}
          {b.bmi && <StatRow icon="analytics-outline" label="IMC" value={b.bmi} color="#EC4899" />}
          {b.recentWeightLogs && b.recentWeightLogs.length > 0 && (
            <View className="mt-2 pt-2 border-t border-background-elevated">
              <Text className="text-text-muted text-xs mb-2">Últimos registros</Text>
              {b.recentWeightLogs.map((log, i) => (
                <View key={i} className="flex-row items-center py-1">
                  <Text className="text-text-muted text-xs w-20">
                    {new Date(log.date).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </Text>
                  <Text className="text-white text-xs font-bold flex-1">{log.weight} kg</Text>
                  {log.bodyFat !== null && (
                    <Text className="text-text-secondary text-xs">{log.bodyFat}% BF</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </StatSection>
      )}

      {/* Gamification */}
      <StatSection title="Gamificación" icon="game-controller-outline" color="#8B5CF6">
        <StatRow icon="star" label="Nivel" value={g.level} color="#8B5CF6" />
        <StatRow icon="flash" label="XP Total" value={g.xp.toLocaleString()} color="#8B5CF6" />
        <StatRow icon="flame-outline" label="Racha Actual" value={g.streak} color="#F59E0B" />
        <StatRow icon="ribbon-outline" label="Mejor Racha" value={g.bestStreak} color="#F59E0B" />
        <StatRow icon="trophy" label="Badges" value={`${g.badgesEarned}/${g.badgesTotal}`} color="#8B5CF6" />
        <StatRow icon="chatbubble-outline" label="Posts" value={g.totalPosts} color="#8B5CF6" />
        <StatRow icon="heart" label="Reacciones Recibidas" value={g.reactionsReceived} color="#FF6B6B" />
        <StatRow icon="flag" label="Retos Completados" value={g.challengesCompleted} color="#8B5CF6" />
        <StatRow icon="medal" label="Retos Ganados" value={g.challengesWon} color="#F59E0B" />
      </StatSection>

      {/* Member since */}
      <View className="bg-background-card border border-background-elevated rounded-3xl p-4 flex-row items-center gap-x-3">
        <Ionicons name="calendar-outline" size={20} color="#A0A0B0" />
        <Text className="text-text-secondary text-sm">
          Miembro desde{" "}
          {new Date(data.memberSince).toLocaleDateString("es", { year: "numeric", month: "long" })}
        </Text>
      </View>
    </View>
  )
}
