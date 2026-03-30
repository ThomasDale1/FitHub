// ─────────────────────────────────────────────────────
// HydrationCard — Water tracking con visual de vasos
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface Props {
  waterMl: number;
  waterGoalMl: number;
  onAddWater: () => void;
}

export default function HydrationCard({ waterMl, waterGoalMl, onAddWater }: Props) {
  const pct = waterGoalMl > 0 ? Math.min((waterMl / waterGoalMl) * 100, 100) : 0;
  const glasses = Math.floor(waterMl / 250);
  const goalReached = waterMl >= waterGoalMl;

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAddWater();
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 flex-1">
      <View className="flex-row items-center gap-x-2 mb-2">
        <Ionicons name="water" size={18} color="#3B82F6" />
        <Text className="text-white font-bold text-sm">Agua</Text>
      </View>

      <Text className="text-white text-lg font-bold">
        {waterMl}
        <Text className="text-text-muted text-xs font-normal"> / {waterGoalMl} ml</Text>
      </Text>

      {/* Progress bar */}
      <View className="bg-background-elevated rounded-full h-2.5 mt-2 mb-3">
        <View
          className="rounded-full h-2.5"
          style={{
            width: `${pct}%`,
            backgroundColor: goalReached ? "#34D399" : "#3B82F6",
          }}
        />
      </View>

      {/* Glasses visual */}
      <View className="flex-row flex-wrap gap-1 mb-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <View
            key={i}
            className="rounded"
            style={{
              width: 16,
              height: 20,
              backgroundColor: i < glasses ? "#3B82F6" : "#252540",
            }}
          />
        ))}
      </View>

      {/* Add button */}
      <TouchableOpacity
        className="bg-blue-500/20 rounded-2xl py-2 flex-row items-center justify-center gap-x-1"
        onPress={handleAdd}
      >
        <Ionicons name="add" size={16} color="#3B82F6" />
        <Text className="text-blue-400 font-bold text-sm">+250ml</Text>
      </TouchableOpacity>

      {goalReached && (
        <Text className="text-green-400 text-xs text-center mt-2">✓ Meta cumplida</Text>
      )}
    </View>
  );
}
