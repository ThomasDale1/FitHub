import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface WorkoutCardProps {
  name: string;
  date: string;
  duration: number;
  xpEarned: number;
  setsCount: number;
  onPress?: () => void;
}

export default function WorkoutCard({
  name,
  date,
  duration,
  xpEarned,
  setsCount,
  onPress,
}: WorkoutCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3"
    >
      {/* Header */}
      <View className="flex-row justify-between items-start">
        <View className="flex-1">
          <Text className="text-white font-bold text-base">{name}</Text>
          <Text className="text-text-muted text-sm mt-1">{date}</Text>
        </View>
        {/* XP Badge */}
        <View className="bg-primary/20 rounded-xl px-3 py-1 flex-row items-center gap-x-1">
          <Ionicons name="star" size={12} color="#6C63FF" />
          <Text className="text-primary text-sm font-bold">
            +{xpEarned} XP
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-x-4 mt-3 pt-3 border-t border-background-elevated">
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="time-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-sm">
            {duration} min
          </Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="barbell-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-sm">
            {setsCount} series
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}