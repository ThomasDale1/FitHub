// ─────────────────────────────────────────────────────
// MealCards — Horizontal scrollable meal type cards
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { FoodEntry } from "@/lib/api";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export const MEAL_CONFIG = {
  BREAKFAST: { label: "Desayuno", icon: "sunny-outline" as const, color: "#F59E0B", pct: 0.25 },
  LUNCH: { label: "Almuerzo", icon: "restaurant-outline" as const, color: "#00D48A", pct: 0.35 },
  DINNER: { label: "Cena", icon: "moon-outline" as const, color: "#6C63FF", pct: 0.30 },
  SNACK: { label: "Snack", icon: "cafe-outline" as const, color: "#FF6B35", pct: 0.10 },
} as const;

interface Props {
  meals: Record<MealType, FoodEntry[]>;
  calorieGoal: number;
  activeMeal: MealType;
  onSelectMeal: (meal: MealType) => void;
}

export default function MealCards({ meals, calorieGoal, activeMeal, onSelectMeal }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
      className="mb-3"
    >
      {(Object.keys(MEAL_CONFIG) as MealType[]).map((mealType) => {
        const config = MEAL_CONFIG[mealType];
        const entries = meals[mealType] || [];
        const totalCals = entries.reduce((sum, e) => sum + e.calories, 0);
        const mealGoal = Math.round(calorieGoal * config.pct);
        const pct = mealGoal > 0 ? Math.min((totalCals / mealGoal) * 100, 100) : 0;
        const isActive = activeMeal === mealType;

        return (
          <TouchableOpacity
            key={mealType}
            onPress={() => onSelectMeal(mealType)}
            className={`rounded-2xl p-3 ${isActive ? "border-2" : "border border-background-elevated"}`}
            style={{
              width: 100,
              backgroundColor: isActive ? config.color + "15" : "#1A1A2E",
              borderColor: isActive ? config.color : undefined,
            }}
          >
            <View
              className="rounded-xl p-2 self-start mb-2"
              style={{ backgroundColor: config.color + "25" }}
            >
              <Ionicons name={config.icon} size={18} color={config.color} />
            </View>
            <Text className="text-white font-semibold text-xs mb-0.5">
              {config.label}
            </Text>
            <Text className="text-white font-bold text-sm">
              {totalCals > 0 ? `${totalCals}` : "--"}
              <Text className="text-text-muted text-xs font-normal"> kcal</Text>
            </Text>

            {/* Mini progress bar */}
            <View className="bg-background-elevated rounded-full h-1.5 mt-2">
              <View
                className="rounded-full h-1.5"
                style={{ width: `${pct}%`, backgroundColor: config.color }}
              />
            </View>

            {entries.length > 0 && (
              <Text className="text-text-muted text-xs mt-1">
                {entries.length} item{entries.length > 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
