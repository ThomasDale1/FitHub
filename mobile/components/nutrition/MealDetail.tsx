// ─────────────────────────────────────────────────────
// MealDetail — Expanded entries for selected meal
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { FoodEntry } from "@/lib/api";
import { MEAL_CONFIG, type MealType } from "./MealCards";

const SOURCE_ICONS: Record<string, string> = {
  SEARCH: "🔍",
  BARCODE: "📊",
  AI_PHOTO: "📷",
  AI_TEXT: "🤖",
  SAVED: "⭐",
  MANUAL: "✏️",
};

interface Props {
  mealType: MealType;
  entries: FoodEntry[];
  onAddFood: () => void;
  onDeleteEntry: (id: string) => void;
  onSaveAsFavorite: (entry: FoodEntry) => void;
}

export default function MealDetail({
  mealType,
  entries,
  onAddFood,
  onDeleteEntry,
  onSaveAsFavorite,
}: Props) {
  const config = MEAL_CONFIG[mealType];
  const totalCals = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-x-2">
          <View className="rounded-xl p-2" style={{ backgroundColor: config.color + "20" }}>
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>
          <View>
            <Text className="text-white font-bold text-base">{config.label}</Text>
            <Text className="text-text-muted text-xs">{totalCals} kcal</Text>
          </View>
        </View>
      </View>

      {/* Entries */}
      {entries.length === 0 ? (
        <TouchableOpacity className="py-6 items-center" onPress={onAddFood}>
          <Ionicons name="add-circle-outline" size={32} color="#3A3A50" />
          <Text className="text-text-muted text-sm mt-2">Agregar alimento</Text>
        </TouchableOpacity>
      ) : (
        <>
          {entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              className={`flex-row justify-between items-center py-3 ${
                idx > 0 ? "border-t border-background-elevated" : ""
              }`}
              onLongPress={() => {
                Alert.alert(entry.name, "¿Qué deseas hacer?", [
                  { text: "Cancelar", style: "cancel" },
                  {
                    text: "⭐ Guardar favorito",
                    onPress: () => onSaveAsFavorite(entry),
                  },
                  {
                    text: "Eliminar",
                    style: "destructive",
                    onPress: () => onDeleteEntry(entry.id),
                  },
                ]);
              }}
            >
              <View className="flex-1 mr-3">
                <View className="flex-row items-center gap-x-1">
                  <Text className="text-white text-sm font-medium capitalize">
                    {entry.name}
                  </Text>
                  <Text className="text-xs">
                    {SOURCE_ICONS[entry.source] || ""}
                  </Text>
                </View>
                <Text className="text-text-muted text-xs mt-0.5">
                  {entry.servingSize} {entry.servingUnit}
                  {entry.brand ? ` · ${entry.brand}` : ""}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-white text-sm font-bold">{entry.calories}</Text>
                <Text className="text-text-muted text-xs">
                  P:{Math.round(entry.protein)} C:{Math.round(entry.carbs)} G:{Math.round(entry.fat)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}

          {/* Add more button */}
          <TouchableOpacity
            className="flex-row items-center justify-center py-3 mt-1 border-t border-background-elevated gap-x-2"
            onPress={onAddFood}
          >
            <Ionicons name="add" size={18} color="#6C63FF" />
            <Text className="text-primary font-semibold text-sm">Agregar alimento</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
