import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

interface StatCardProps {
  icon: IoniconsName;
  label: string;
  value: string;
  unit?: string;
  gradient: [string, string];
  subtitle?: string;
}

export default function StatCard({
  icon,
  label,
  value,
  unit,
  gradient,
  subtitle,
}: StatCardProps) {
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      className="rounded-3xl p-4"
      style={{ flex: 1 }}
    >
      <View className="flex-row items-center justify-between p-3">
        {/* Icono */}
        <View
          style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
          className="rounded-2xl p-2"
        >
          <Ionicons name={icon} size={20} color="white" />
        </View>

        {/* Valor */}
        <View className="items-end">
          <Text className="text-white text-2xl font-bold">
            {value}
            {unit && (
              <Text className="text-white text-sm font-normal">
                {" "}{unit}
              </Text>
            )}
          </Text>
        </View>
      </View>

      {/* Label abajo */}
      <Text className="text-white/80 text-sm font-semibold mt-3 px-3">
        {label}
      </Text>
      {subtitle && (
        <Text className="text-white/50 text-xs mt-0.5 px-3">{subtitle}</Text>
      )}
    </LinearGradient>
  );
}