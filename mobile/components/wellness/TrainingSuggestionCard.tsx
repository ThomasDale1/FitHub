// ─────────────────────────────────────────────────────
// mobile/components/wellness/TrainingSuggestionCard.tsx
// Readiness → Workout Intensity Suggestion Card
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { TrainingSuggestion } from "@/lib/api";

const INTENSITY_COLORS: Record<string, string> = {
  REST: "#FF6B6B",
  LIGHT: "#FFB347",
  MODERATE: "#FFD93D",
  HIGH: "#00D48A",
  MAX: "#7B68EE",
};

const INTENSITY_LABELS: Record<string, string> = {
  REST: "Descanso",
  LIGHT: "Ligero",
  MODERATE: "Moderado",
  HIGH: "Intenso",
  MAX: "Máximo",
};

interface Props {
  data: TrainingSuggestion;
}

export default function TrainingSuggestionCard({ data }: Props) {
  const { suggestion } = data;
  const color = INTENSITY_COLORS[suggestion.intensity] ?? "#7B68EE";

  return (
    <View
      className="bg-background-card border rounded-3xl p-4"
      style={{ borderColor: `${color}30` }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-x-2 mb-2">
        <Text className="text-2xl">{suggestion.emoji}</Text>
        <View className="flex-1">
          <Text className="text-white font-bold text-sm">
            {suggestion.title}
          </Text>
          <View className="flex-row items-center gap-x-2 mt-0.5">
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}25` }}
            >
              <Text
                className="text-[10px] font-bold"
                style={{ color }}
              >
                {INTENSITY_LABELS[suggestion.intensity] || "Unknown"}
              </Text>
            </View>
            {suggestion.suggestedDuration > 0 && (
              <Text className="text-text-muted text-[10px]">
                ~{suggestion.suggestedDuration} min
              </Text>
            )}
            {suggestion.suggestedRPE?.max && suggestion.suggestedRPE.max > 0 && (
              <Text className="text-text-muted text-[10px]">
                RPE {suggestion.suggestedRPE.min}-{suggestion.suggestedRPE.max}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Description */}
      <Text className="text-text-secondary text-xs leading-[18px] mb-2">
        {suggestion.description}
      </Text>

      {/* Recommendations */}
      {suggestion.recommendations.slice(0, 3).map((rec, i) => (
        <View key={i} className="flex-row items-start gap-x-2 mb-1">
          <Ionicons
            name="checkmark-circle"
            size={14}
            color={color}
            style={{ marginTop: 1 }}
          />
          <Text className="text-text-secondary text-xs flex-1">{rec}</Text>
        </View>
      ))}

      {/* Avoid muscles */}
      {(suggestion.avoidMuscles?.length ?? 0) > 0 && (
        <View className="flex-row items-center gap-x-1.5 mt-2 bg-[#FF6B6B10] rounded-xl px-3 py-2">
          <Ionicons name="warning-outline" size={14} color="#FF6B6B" />
          <Text className="text-[11px] text-[#FF6B6B] flex-1">
            Evitar: {suggestion.avoidMuscles?.join(", ") ?? ""}
          </Text>
        </View>
      )}

      {/* CTA */}
      {suggestion.intensity !== "REST" && (
        <TouchableOpacity
          className="mt-3 self-start px-4 py-2 rounded-full"
          style={{ backgroundColor: `${color}20` }}
          onPress={() => router.push("/(tabs)/workout" as any)}
        >
          <Text className="text-xs font-bold" style={{ color }}>
            Ir a entrenar →
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
