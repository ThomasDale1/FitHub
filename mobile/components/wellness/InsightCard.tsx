// ─────────────────────────────────────────────────────
// mobile/components/wellness/InsightCard.tsx
// Personalized insight card with optional action
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export interface InsightItem {
  id: string;
  category: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  title: string;
  body: string;
  emoji: string;
  color: string;
  actionLabel?: string;
  actionRoute?: string;
}

interface Props {
  insight: InsightItem;
}

export default function InsightCard({ insight }: Props) {
  const priorityDot =
    insight.priority === "HIGH"
      ? "#FF6B6B"
      : insight.priority === "MEDIUM"
        ? "#FFB347"
        : "#00D48A";

  return (
    <View
      className="bg-background-card border rounded-3xl p-4 mb-3"
      style={{ borderColor: `${insight.color}30` }}
    >
      <View className="flex-row items-start gap-x-3">
        <Text className="text-2xl mt-0.5">{insight.emoji}</Text>
        <View className="flex-1">
          <View className="flex-row items-center gap-x-2 mb-1">
            <View
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: priorityDot }}
            />
            <Text className="text-white font-bold text-sm">
              {insight.title}
            </Text>
          </View>
          <Text className="text-text-secondary text-xs leading-[18px]">
            {insight.body}
          </Text>
          {insight.actionLabel && insight.actionRoute && (
            <TouchableOpacity
              className="mt-2.5 self-start px-3 py-1.5 rounded-full"
              style={{ backgroundColor: `${insight.color}20` }}
              onPress={() => router.push(insight.actionRoute as any)}
            >
              <Text
                className="text-xs font-bold"
                style={{ color: insight.color }}
              >
                {insight.actionLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
