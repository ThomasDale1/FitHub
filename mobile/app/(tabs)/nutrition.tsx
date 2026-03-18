// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/nutrition.tsx
// Sprint 3A: Pantalla de Nutrición completa
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { nutritionAPI, type FoodLogData, type FoodEntry } from "@/lib/api";

// ─── Constantes ───────────────────────────────────────
const MEAL_CONFIG = {
  BREAKFAST: { label: "Desayuno", icon: "sunny-outline" as const, color: "#F59E0B" },
  LUNCH: { label: "Almuerzo", icon: "restaurant-outline" as const, color: "#00D48A" },
  DINNER: { label: "Cena", icon: "moon-outline" as const, color: "#6C63FF" },
  SNACK: { label: "Snack", icon: "cafe-outline" as const, color: "#FF6B35" },
} as const;

type MealType = keyof typeof MEAL_CONFIG;

// ─── Macro Progress Bar ──────────────────────────────
function MacroBar({
  label,
  current,
  goal,
  color,
  unit,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  unit: string;
}) {
  const pct = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1">
        <Text className="text-text-secondary text-xs">{label}</Text>
        <Text className="text-white text-xs font-bold">
          {Math.round(current)}/{goal}{unit}
        </Text>
      </View>
      <View className="bg-background-elevated rounded-full h-2">
        <View
          className="rounded-full h-2"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </View>
    </View>
  );
}

// ─── Meal Section ────────────────────────────────────
function MealSection({
  mealType,
  entries,
  onAdd,
  onDelete,
}: {
  mealType: MealType;
  entries: FoodEntry[];
  onAdd: (mealType: MealType) => void;
  onDelete: (id: string) => void;
}) {
  const config = MEAL_CONFIG[mealType];
  const totalCals = entries.reduce((sum, e) => sum + e.calories, 0);

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-x-2">
          <View
            className="rounded-xl p-2"
            style={{ backgroundColor: config.color + "20" }}
          >
            <Ionicons name={config.icon} size={18} color={config.color} />
          </View>
          <Text className="text-white font-bold text-base">
            {config.label}
          </Text>
        </View>
        <View className="flex-row items-center gap-x-3">
          <Text className="text-text-secondary text-sm">
            {totalCals} kcal
          </Text>
          <TouchableOpacity
            className="bg-primary/20 rounded-xl p-2"
            onPress={() => onAdd(mealType)}
          >
            <Ionicons name="add" size={18} color="#6C63FF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Entries */}
      {entries.length === 0 ? (
        <TouchableOpacity
          className="py-3 items-center"
          onPress={() => onAdd(mealType)}
        >
          <Text className="text-text-muted text-sm">
            Toca + para agregar alimentos
          </Text>
        </TouchableOpacity>
      ) : (
        entries.map((entry) => (
          <TouchableOpacity
            key={entry.id}
            className="flex-row justify-between items-center py-2 border-t border-background-elevated"
            onLongPress={() => {
              Alert.alert("Eliminar", `¿Eliminar ${entry.name}?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => onDelete(entry.id) },
              ]);
            }}
          >
            <View className="flex-1">
              <Text className="text-white text-sm capitalize">{entry.name}</Text>
              <Text className="text-text-muted text-xs">
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
        ))
      )}
    </View>
  );
}

// ─── Add Food Modal ──────────────────────────────────
function AddFoodModal({
  visible,
  mealType,
  onClose,
  onSave,
}: {
  visible: boolean;
  mealType: MealType;
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [servingSize, setServingSize] = useState("1");
  const [servingUnit, setServingUnit] = useState("porción");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !calories.trim()) {
      Alert.alert("Error", "Nombre y calorías son requeridos");
      return;
    }
    setSaving(true);
    await onSave({
      mealType,
      name: name.trim(),
      calories: parseInt(calories),
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      servingSize: parseFloat(servingSize) || 1,
      servingUnit: servingUnit || "porción",
      source: "MANUAL",
    });
    setSaving(false);
    // Reset
    setName(""); setCalories(""); setProtein("");
    setCarbs(""); setFat(""); setServingSize("1"); setServingUnit("porción");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-background rounded-t-3xl p-5 pb-10">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-white font-bold text-xl">
              Agregar a {MEAL_CONFIG[mealType].label}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* Nombre */}
          <Text className="text-text-secondary text-sm mb-1">Alimento</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
            value={name}
            onChangeText={setName}
            placeholder="Ej: Pechuga de pollo"
            placeholderTextColor="#6B6B80"
            autoFocus
          />

          {/* Porción */}
          <View className="flex-row gap-x-3 mb-3">
            <View className="flex-1">
              <Text className="text-text-secondary text-sm mb-1">Cantidad</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
                value={servingSize}
                onChangeText={setServingSize}
                keyboardType="decimal-pad"
                placeholderTextColor="#6B6B80"
              />
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-sm mb-1">Unidad</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
                value={servingUnit}
                onChangeText={setServingUnit}
                placeholder="g, ml, unidad..."
                placeholderTextColor="#6B6B80"
              />
            </View>
          </View>

          {/* Macros */}
          <Text className="text-white font-bold text-base mb-2">Macros</Text>
          <View className="flex-row gap-x-2 mb-4">
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-1 text-center">Kcal *</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
                value={calories}
                onChangeText={setCalories}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#6B6B80"
              />
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-1 text-center">Prot (g)</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
                value={protein}
                onChangeText={setProtein}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#6B6B80"
              />
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-1 text-center">Carbs (g)</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
                value={carbs}
                onChangeText={setCarbs}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#6B6B80"
              />
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-xs mb-1 text-center">Grasa (g)</Text>
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
                value={fat}
                onChangeText={setFat}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#6B6B80"
              />
            </View>
          </View>

          {/* Botón */}
          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center"
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-bold text-base">
                Agregar alimento
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// NUTRITION SCREEN
// ═══════════════════════════════════════════════════════
export default function NutritionScreen() {
  const [foodLog, setFoodLog] = useState<FoodLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("BREAKFAST");

  const fetchData = useCallback(async () => {
    try {
      const response = await nutritionAPI.getToday();
      setFoodLog(response.data);
    } catch (err) {
      console.error("Nutrition fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleAddFood = (mealType: MealType) => {
    setActiveMeal(mealType);
    setModalVisible(true);
  };

  const handleSaveFood = async (data: any) => {
    try {
      await nutritionAPI.addEntry(data);
      setModalVisible(false);
      await fetchData(); // Refresh
    } catch (err) {
      Alert.alert("Error", "No se pudo agregar el alimento");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    try {
      await nutritionAPI.deleteEntry(id);
      await fetchData();
    } catch (err) {
      Alert.alert("Error", "No se pudo eliminar");
    }
  };

  const handleAddWater = async () => {
    try {
      await nutritionAPI.addWater(250); // 250ml = 1 vaso
      await fetchData();
    } catch (err) {
      Alert.alert("Error", "No se pudo registrar agua");
    }
  };

  // Calcular datos
  const caloriesLeft = (foodLog?.calorieGoal ?? 2000) - (foodLog?.totalCalories ?? 0);
  const caloriePct = foodLog
    ? Math.min((foodLog.totalCalories / foodLog.calorieGoal) * 100, 100)
    : 0;
  const waterPct = foodLog
    ? Math.min((foodLog.waterMl / foodLog.waterGoalMl) * 100, 100)
    : 0;
  const waterGlasses = foodLog ? Math.floor(foodLog.waterMl / 250) : 0;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        <View className="px-5 pt-4 pb-8">
          {/* ─── HEADER ─────────────────────────────── */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-white text-2xl font-bold">Nutrición</Text>
              <Text className="text-text-secondary text-sm">
                {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
            </View>
            <TouchableOpacity className="bg-background-card border border-background-elevated rounded-2xl p-3">
              <Ionicons name="calendar-outline" size={20} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* ─── CALORIE RING ───────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-5 mb-4 items-center">
            <View className="items-center mb-4">
              <Text className="text-text-secondary text-sm">Calorías restantes</Text>
              <Text className="text-white text-4xl font-bold mt-1">
                {Math.max(0, caloriesLeft)}
              </Text>
              <Text className="text-text-muted text-xs mt-1">
                {foodLog?.totalCalories ?? 0} / {foodLog?.calorieGoal ?? 2000} kcal
              </Text>
            </View>

            {/* Progress bar grande */}
            <View className="w-full bg-background-elevated rounded-full h-4">
              <View
                className="rounded-full h-4"
                style={{
                  width: `${caloriePct}%`,
                  backgroundColor: caloriePct > 100 ? "#FF6B6B" : "#6C63FF",
                }}
              />
            </View>
            {caloriePct > 100 && (
              <Text className="text-red-400 text-xs mt-2">
                ⚠️ Excediste tu meta por {Math.abs(caloriesLeft)} kcal
              </Text>
            )}
          </View>

          {/* ─── MACROS ─────────────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
            <Text className="text-white font-bold text-base mb-3">Macros</Text>
            <MacroBar
              label="Proteína"
              current={foodLog?.totalProtein ?? 0}
              goal={foodLog?.proteinGoal ?? 150}
              color="#FF6B6B"
              unit="g"
            />
            <MacroBar
              label="Carbohidratos"
              current={foodLog?.totalCarbs ?? 0}
              goal={foodLog?.carbsGoal ?? 250}
              color="#6C63FF"
              unit="g"
            />
            <MacroBar
              label="Grasa"
              current={foodLog?.totalFat ?? 0}
              goal={foodLog?.fatGoal ?? 65}
              color="#F59E0B"
              unit="g"
            />
          </View>

          {/* ─── WATER ──────────────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-x-2">
                <Ionicons name="water" size={20} color="#3B82F6" />
                <Text className="text-white font-bold text-base">Agua</Text>
              </View>
              <Text className="text-text-secondary text-sm">
                {foodLog?.waterMl ?? 0} / {foodLog?.waterGoalMl ?? 2500} ml
              </Text>
            </View>

            {/* Progress */}
            <View className="bg-background-elevated rounded-full h-3 mb-3">
              <View
                className="rounded-full h-3"
                style={{ width: `${waterPct}%`, backgroundColor: "#3B82F6" }}
              />
            </View>

            {/* Water glasses visual */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row gap-x-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <View
                    key={i}
                    className="rounded-lg"
                    style={{
                      width: 20,
                      height: 24,
                      backgroundColor: i < waterGlasses ? "#3B82F6" : "#252540",
                    }}
                  />
                ))}
              </View>
              <TouchableOpacity
                className="bg-blue-500/20 rounded-2xl px-4 py-2 flex-row items-center gap-x-1"
                onPress={handleAddWater}
              >
                <Ionicons name="add" size={16} color="#3B82F6" />
                <Text className="text-blue-400 font-bold text-sm">250ml</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── MEALS ──────────────────────────────── */}
          <Text className="text-white font-bold text-lg mb-3">Comidas</Text>

          {(Object.keys(MEAL_CONFIG) as MealType[]).map((mealType) => (
            <MealSection
              key={mealType}
              mealType={mealType}
              entries={foodLog?.meals?.[mealType] ?? []}
              onAdd={handleAddFood}
              onDelete={handleDeleteEntry}
            />
          ))}
        </View>
      </ScrollView>

      {/* ─── ADD FOOD MODAL ─────────────────────────── */}
      <AddFoodModal
        visible={modalVisible}
        mealType={activeMeal}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveFood}
      />
    </SafeAreaView>
  );
}