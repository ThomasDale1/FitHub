import { View, Text } from "react-native";

interface XPBarProps {
  currentXP: number;
  maxXP: number;
  level: number;
}

export default function XPBar({ currentXP, maxXP, level }: XPBarProps) {
  const progress = Math.min((currentXP / maxXP) * 100, 100);

  return (
    <View className="bg-background-card rounded-3xl p-4 border border-background-elevated">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-x-2">
          <View className="bg-primary rounded-xl px-3 py-1">
            <Text className="text-white font-bold text-sm">
              Nivel {level}
            </Text>
          </View>
          <Text className="text-text-secondary text-sm">
            {currentXP} / {maxXP} XP
          </Text>
        </View>
        <Text className="text-text-secondary text-sm">
          {Math.round(progress)}%
        </Text>
      </View>

      {/* Barra de progreso */}
      <View className="h-3 bg-background-elevated rounded-full overflow-hidden">
        <View
          className="h-full bg-primary rounded-full"
          style={{ width: `${progress}%` }}
        />
      </View>

      {/* XP faltante */}
      <Text className="text-text-muted text-xs mt-2">
        {maxXP - currentXP} XP para el siguiente nivel
      </Text>
    </View>
  );
}