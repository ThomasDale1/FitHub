// ─────────────────────────────────────────────────────
// mobile/components/wellness/NutritionAdjustmentCard.tsx
// Readiness → Nutrition Macro Adjustment Card
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { NutritionAdjustment } from "@/lib/api";

interface Props {
  data: NutritionAdjustment;
}

function MacroPill({
  label,
  base,
  adjusted,
  delta,
  unit,
  color,
}: {
  label: string;
  base: number;
  adjusted: number;
  delta: number;
  unit: string;
  color: string;
}) {
  const sign = delta > 0 ? "+" : "";
  return (
    <View className="flex-1 items-center">
      <Text className="text-white font-bold text-sm">
        {adjusted}
        <Text className="text-text-muted text-[10px]">{unit}</Text>
      </Text>
      {delta !== 0 && (
        <Text
          className="text-[10px] font-semibold mt-0.5"
          style={{ color }}
        >
          {sign}{delta}
        </Text>
      )}
      <Text className="text-text-muted text-[10px] mt-0.5">{label}</Text>
    </View>
  );
}

export default function NutritionAdjustmentCard({ data }: Props) {
  const { adjustment } = data;

  const zoneColors: Record<string, string> = {
    "🔴": "#FF6B6B",
    "🟡": "#FFB347",
    "🟢": "#00D48A",
  };
  const color = zoneColors[adjustment.emoji] ?? "#7B68EE";

  return (
    <View
      className="bg-background-card border rounded-3xl p-4"
      style={{ borderColor: `${color}30` }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-x-2 mb-2">
        <View
          className="rounded-2xl p-2"
          style={{ backgroundColor: `${color}20` }}
        >
          <Ionicons name="nutrition-outline" size={20} color={color} />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-sm">
            {adjustment.title}
          </Text>
          <Text className="text-text-muted text-[10px] mt-0.5">
            Ajuste basado en tu readiness
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text className="text-text-secondary text-xs leading-[18px] mb-3">
        {adjustment.description}
      </Text>

      {/* Macro pills */}
      <View className="flex-row bg-background-elevated rounded-2xl py-3 px-2 mb-3">
        <MacroPill
          label="Calorías"
          base={adjustment.calories.base}
          adjusted={adjustment.calories.adjusted}
          delta={adjustment.calories.delta}
          unit="kcal"
          color={adjustment.calories.delta >= 0 ? "#00D48A" : "#FF6B6B"}
        />
        <MacroPill
          label="Proteína"
          base={adjustment.protein.base}
          adjusted={adjustment.protein.adjusted}
          delta={adjustment.protein.delta}
          unit="g"
          color={adjustment.protein.delta >= 0 ? "#00D48A" : "#FFB347"}
        />
        <MacroPill
          label="Carbos"
          base={adjustment.carbs.base}
          adjusted={adjustment.carbs.adjusted}
          delta={adjustment.carbs.delta}
          unit="g"
          color={adjustment.carbs.delta >= 0 ? "#00D48A" : "#FF6B6B"}
        />
        <MacroPill
          label="Grasa"
          base={adjustment.fat.base}
          adjusted={adjustment.fat.adjusted}
          delta={adjustment.fat.delta}
          unit="g"
          color={adjustment.fat.delta >= 0 ? "#00D48A" : "#FFB347"}
        />
      </View>

      {/* Tips */}
      {adjustment.tips.slice(0, 3).map((tip, i) => (
        <View key={i} className="flex-row items-start gap-x-2 mb-1">
          <Ionicons
            name="leaf-outline"
            size={13}
            color={color}
            style={{ marginTop: 1 }}
          />
          <Text className="text-text-secondary text-xs flex-1">{tip}</Text>
        </View>
      ))}

      {/* CTA */}
      <TouchableOpacity
        className="mt-3 self-start px-4 py-2 rounded-full"
        style={{ backgroundColor: `${color}20` }}
        onPress={() => router.push("/(tabs)/nutrition" as any)}
      >
        <Text className="text-xs font-bold" style={{ color }}>
          Ver nutrición →
        </Text>
      </TouchableOpacity>
    </View>
  );
}
