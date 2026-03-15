import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StreakBadgeProps {
  streak: number;
}

export default function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <View className="flex-row items-center bg-background-card border border-background-elevated rounded-2xl px-4 py-2 gap-x-2">
      <Ionicons name="flame" size={20} color="#FF6B35" />
      <Text className="text-white font-bold text-base">{streak}</Text>
      <Text className="text-text-secondary text-sm">días seguidos</Text>
    </View>
  );
}