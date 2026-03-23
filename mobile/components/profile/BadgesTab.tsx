// ─────────────────────────────────────────────────────
// mobile/components/profile/BadgesTab.tsx
// Full badge grid with categories
// ─────────────────────────────────────────────────────
import { View, Text, ActivityIndicator, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState } from "react"
import { router } from "expo-router"
import type { ProfileBadgesResponse } from "@/lib/api"

const RARITY_COLORS: Record<string, { border: string; text: string; bg: string }> = {
  COMMON: { border: "#6B7280", text: "#9CA3AF", bg: "#6B728015" },
  RARE: { border: "#3B82F6", text: "#60A5FA", bg: "#3B82F615" },
  EPIC: { border: "#A855F7", text: "#C084FC", bg: "#A855F715" },
  LEGENDARY: { border: "#F59E0B", text: "#FBBF24", bg: "#F59E0B15" },
}

interface BadgesTabProps {
  data: ProfileBadgesResponse | null
  loading: boolean
  isOwnProfile: boolean
}

export default function BadgesTab({ data, loading, isOwnProfile }: BadgesTabProps) {
  const [filter, setFilter] = useState<"all" | "earned" | "locked">("all")

  if (loading || !data) {
    return <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
  }

  const filteredBadges = data.badges.filter(b => {
    if (filter === "earned") return b.earned
    if (filter === "locked") return !b.earned
    return true
  })

  // Group by category
  const grouped: Record<string, typeof filteredBadges> = {}
  filteredBadges.forEach(b => {
    if (!grouped[b.category]) grouped[b.category] = []
    grouped[b.category].push(b)
  })

  return (
    <View>
      {/* Progress bar */}
      <View className="bg-background-card border border-background-elevated rounded-2xl p-4 mb-3">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-white font-bold">
            {data.earned}/{data.total} badges
          </Text>
          <Text className="text-primary text-sm font-bold">
            {data.total > 0 ? Math.round((data.earned / data.total) * 100) : 0}%
          </Text>
        </View>
        <View className="h-3 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${data.total > 0 ? (data.earned / data.total) * 100 : 0}%` }}
          />
        </View>
      </View>

      {/* Filter */}
      <View className="flex-row gap-x-2 mb-4">
        {(["all", "earned", "locked"] as const).map(f => (
          <TouchableOpacity
            key={f}
            className={`rounded-xl px-3 py-2 ${filter === f ? "bg-primary/20 border border-primary/40" : "bg-background-card border border-background-elevated"}`}
            onPress={() => setFilter(f)}
          >
            <Text className={`text-xs font-semibold ${filter === f ? "text-primary" : "text-text-muted"}`}>
              {f === "all" ? "Todos" : f === "earned" ? "Obtenidos" : "Bloqueados"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Badge grid by category */}
      {Object.entries(grouped).map(([category, badges]) => (
        <View key={category} className="mb-4">
          <Text className="text-text-secondary text-sm font-bold mb-2 capitalize">{category}</Text>
          <View className="flex-row flex-wrap gap-3">
            {badges.map(b => {
              const r = RARITY_COLORS[b.rarity] || RARITY_COLORS.COMMON
              return (
                <View
                  key={b.id}
                  className="items-center p-3 rounded-2xl"
                  style={{
                    width: 80,
                    backgroundColor: b.earned ? r.bg : "#252540",
                    borderWidth: 1,
                    borderColor: b.earned ? r.border + "50" : "#252540",
                    opacity: b.earned ? 1 : 0.5,
                  }}
                >
                  <Text className="text-2xl">{b.icon}</Text>
                  <Text
                    className="text-xs mt-1 text-center"
                    style={{ color: b.earned ? r.text : "#4A4A5A" }}
                    numberOfLines={2}
                  >
                    {b.name}
                  </Text>
                  {b.earnedAt && (
                    <Text className="text-text-muted mt-0.5" style={{ fontSize: 8 }}>
                      {new Date(b.earnedAt).toLocaleDateString("es", { month: "short", day: "numeric" })}
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
        </View>
      ))}

      {/* Link to full badges page for own profile */}
      {isOwnProfile && (
        <TouchableOpacity
          className="bg-primary/10 border border-primary/30 rounded-2xl py-3 mt-2 items-center flex-row justify-center gap-x-2"
          onPress={() => router.push("/badges" as any)}
        >
          <Ionicons name="trophy-outline" size={18} color="#6C63FF" />
          <Text className="text-primary font-bold text-sm">Ver progreso detallado</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
