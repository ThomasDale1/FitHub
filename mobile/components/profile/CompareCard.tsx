// ─────────────────────────────────────────────────────
// mobile/components/profile/CompareCard.tsx
// Side-by-side stat comparison component
// ─────────────────────────────────────────────────────
import { View, Text } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import type { CompareResponse, CompareMetric } from "@/lib/api"

function CompareMetricRow({ metric }: { metric: CompareMetric }) {
  const myColor = metric.winner === "me" ? "#10B981" : "#A0A0B0"
  const theirColor = metric.winner === "them" ? "#10B981" : "#A0A0B0"
  const myBold = metric.winner === "me"
  const theirBold = metric.winner === "them"

  return (
    <View className="flex-row items-center py-3 border-b border-background-elevated">
      <Text
        className="text-sm w-20 text-right"
        style={{ color: myColor, fontWeight: myBold ? "700" : "400" }}
      >
        {metric.myValue.toLocaleString()}
      </Text>
      <View className="flex-1 items-center px-2">
        <Text className="text-text-secondary text-xs text-center">{metric.label}</Text>
        {metric.winner !== "tie" && (
          <View className="mt-0.5">
            <Text style={{ fontSize: 8, color: metric.winner === "me" ? "#10B981" : "#EF4444" }}>
              {metric.winner === "me" ? "◀" : "▶"}
            </Text>
          </View>
        )}
      </View>
      <Text
        className="text-sm w-20"
        style={{ color: theirColor, fontWeight: theirBold ? "700" : "400" }}
      >
        {metric.theirValue.toLocaleString()}
      </Text>
    </View>
  )
}

function UserAvatar({ name, avatarUrl, level }: { name: string; avatarUrl: string | null; level: number }) {
  return (
    <View className="items-center">
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          style={{ width: 50, height: 50, borderRadius: 25 }}
        />
      ) : (
        <View
          className="bg-primary/20 items-center justify-center"
          style={{ width: 50, height: 50, borderRadius: 25 }}
        >
          <Text className="text-primary text-lg font-bold">{name.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text className="text-white text-xs font-bold mt-1" numberOfLines={1}>{name}</Text>
      <Text className="text-text-muted" style={{ fontSize: 10 }}>Nivel {level}</Text>
    </View>
  )
}

interface CompareCardProps {
  data: CompareResponse
}

export default function CompareCard({ data }: CompareCardProps) {
  return (
    <View>
      {/* Score header */}
      <View className="bg-background-card border border-background-elevated rounded-3xl p-5 mb-4">
        <View className="flex-row justify-between items-center">
          <UserAvatar name={data.me.name} avatarUrl={data.me.avatarUrl} level={data.me.level} />

          <View className="items-center">
            <Text className="text-text-muted text-xs mb-1">SCORE</Text>
            <View className="flex-row items-center gap-x-3">
              <Text className="text-3xl font-bold" style={{ color: data.score.me > data.score.them ? "#10B981" : "#A0A0B0" }}>
                {data.score.me}
              </Text>
              <Text className="text-text-muted text-lg">-</Text>
              <Text className="text-3xl font-bold" style={{ color: data.score.them > data.score.me ? "#10B981" : "#A0A0B0" }}>
                {data.score.them}
              </Text>
            </View>
            {data.score.ties > 0 && (
              <Text className="text-text-muted text-xs mt-0.5">{data.score.ties} empate{data.score.ties > 1 ? "s" : ""}</Text>
            )}
          </View>

          <UserAvatar name={data.them.name} avatarUrl={data.them.avatarUrl} level={data.them.level} />
        </View>
      </View>

      {/* Metrics */}
      <View className="bg-background-card border border-background-elevated rounded-3xl p-4">
        <Text className="text-white font-bold text-center mb-3">Comparación Detallada</Text>
        {data.comparison.map(m => (
          <CompareMetricRow key={m.key} metric={m} />
        ))}
      </View>
    </View>
  )
}
