// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/nutrition.tsx
// Nutrition Tab — Full redesign with search, graphs, calendar
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback, useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { nutritionAPI, type FoodLogData, type FoodEntry, type NutritionStats } from "@/lib/api";

// ─── Components ──────────────────────────────────────
import WeekCalendar from "@/components/nutrition/WeekCalendar";
import GraphCarousel from "@/components/nutrition/GraphCarousel";
import HydrationCard from "@/components/nutrition/HydrationCard";
import FastingCard from "@/components/nutrition/FastingCard";
import MealCards, { type MealType } from "@/components/nutrition/MealCards";
import MealDetail from "@/components/nutrition/MealDetail";
import AddFoodModal from "@/components/nutrition/AddFoodModal";
import BarcodeScanner from "@/components/nutrition/BarcodeScanner";
import AiInsightCard from "@/components/nutrition/AiInsightCard";

// ─── Helpers ─────────────────────────────────────────
function formatDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

function isSameDay(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}

// ═══════════════════════════════════════════════════════
// NUTRITION SCREEN
// ═══════════════════════════════════════════════════════
export default function NutritionScreen() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [foodLog, setFoodLog] = useState<FoodLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeMeal, setActiveMeal] = useState<MealType>("BREAKFAST");
  const [datesWithEntries, setDatesWithEntries] = useState<Set<string>>(new Set());
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [nutritionStats, setNutritionStats] = useState<NutritionStats | null>(null);
  const prevMacrosRef = useRef<{ cal: number; prot: number; carbs: number; fat: number }>({ cal: 0, prot: 0, carbs: 0, fat: 0 });

  // ─── Data fetching ──────────────────────────────────
  const fetchData = useCallback(
    async (date: Date, isRetry = false) => {
      try {
        const dateStr = formatDateKey(date);
        const isToday = isSameDay(date, new Date());

        const response = isToday
          ? await nutritionAPI.getToday()
          : await nutritionAPI.getByDate(dateStr);

        setFoodLog(response.data);

        // Sync prevMacros ref for macro completion detection
        const d = response.data;
        prevMacrosRef.current = {
          cal: d.totalCalories ?? 0,
          prot: d.totalProtein ?? 0,
          carbs: d.totalCarbs ?? 0,
          fat: d.totalFat ?? 0,
        };

        // Track dates that have entries for the calendar dots
        if (response.data.entries && response.data.entries.length > 0) {
          setDatesWithEntries((prev) => {
            const next = new Set(prev);
            next.add(dateStr);
            return next;
          });
        }
      } catch (err: any) {
        if (err?.response?.status === 401 && !isRetry) {
          setTimeout(() => fetchData(date, true), 1500);
          return;
        }
        console.error("Nutrition fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Load week history for calendar dots
  const fetchWeekHistory = useCallback(async () => {
    try {
      const res = await nutritionAPI.getHistory();
      const history = res.data?.history || [];
      const dates = new Set<string>();
      for (const log of history) {
        if (log.totalCalories > 0) {
          const d = new Date(log.date);
          dates.add(formatDateKey(d));
        }
      }
      setDatesWithEntries(dates);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData(selectedDate);
    fetchWeekHistory();
    // Fetch nutrition stats (streak, consistency)
    nutritionAPI.getStats()
      .then((r) => setNutritionStats(r.data))
      .catch(() => {});
    // Auto-select meal based on time of day
    const hour = new Date().getHours();
    if (hour < 11) setActiveMeal("BREAKFAST");
    else if (hour < 15) setActiveMeal("LUNCH");
    else if (hour < 20) setActiveMeal("DINNER");
    else setActiveMeal("SNACK");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on mount
  }, []);

  // When selected date changes, fetch that day's data
  const handleSelectDate = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      setLoading(true);
      fetchData(date);
    },
    [fetchData],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(selectedDate);
    await fetchWeekHistory();
    setRefreshing(false);
  }, [fetchData, fetchWeekHistory, selectedDate]);

  // ─── Handlers ───────────────────────────────────────
  const handleAddFood = (mealType: MealType) => {
    setActiveMeal(mealType);
    setModalVisible(true);
  };

  const handleSaveFood = async (data: any) => {
    try {
      // Include date for non-today entries
      const dateStr = formatDateKey(selectedDate);
      await nutritionAPI.addEntry({ ...data, date: dateStr });
      setModalVisible(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await fetchData(selectedDate);

      // Check for macro completion celebrations (only for today)
      if (isToday && foodLog) {
        const prev = prevMacrosRef.current;
        const calGoal = foodLog.calorieGoal ?? 2000;
        const protGoal = foodLog.proteinGoal ?? 150;
        const newCal = (foodLog.totalCalories ?? 0) + (data.calories ?? 0);
        const newProt = (foodLog.totalProtein ?? 0) + (data.protein ?? 0);
        const newCarb = (foodLog.totalCarbs ?? 0) + (data.carbs ?? 0);
        const newFat = (foodLog.totalFat ?? 0) + (data.fat ?? 0);

        // Celebrate when a macro crosses 100% for the first time
        if (prev.prot < protGoal && newProt >= protGoal) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("🎯 Meta de proteína", "¡Llegaste a tu meta de proteína hoy!");
        } else if (prev.cal < calGoal && newCal >= calGoal) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("🎯 Meta de calorías", "¡Llegaste a tu meta de calorías!");
        }

        prevMacrosRef.current = { cal: newCal, prot: newProt, carbs: newCarb, fat: newFat };
      }
    } catch (err) {
      Alert.alert("Error", "No se pudo agregar el alimento");
    }
  };

  const handleDeleteEntry = async (id: string) => {
    // Optimistic: remove entry from local state immediately
    const prevLog = foodLog;
    if (foodLog) {
      const entry = foodLog.entries.find((e) => e.id === id);
      if (entry) {
        const updated = {
          ...foodLog,
          entries: foodLog.entries.filter((e) => e.id !== id),
          totalCalories: foodLog.totalCalories - entry.calories,
          totalProtein: foodLog.totalProtein - entry.protein,
          totalCarbs: foodLog.totalCarbs - entry.carbs,
          totalFat: foodLog.totalFat - entry.fat,
          totalFiber: foodLog.totalFiber - entry.fiber,
          meals: {
            BREAKFAST: foodLog.meals.BREAKFAST.filter((e) => e.id !== id),
            LUNCH: foodLog.meals.LUNCH.filter((e) => e.id !== id),
            DINNER: foodLog.meals.DINNER.filter((e) => e.id !== id),
            SNACK: foodLog.meals.SNACK.filter((e) => e.id !== id),
          },
        };
        setFoodLog(updated);
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await nutritionAPI.deleteEntry(id);
      // Fetch fresh data to ensure consistency
      fetchData(selectedDate);
    } catch (err) {
      // Revert on failure
      setFoodLog(prevLog);
      Alert.alert("Error", "No se pudo eliminar");
    }
  };

  const handleAddWater = async () => {
    // Optimistic: increment water locally
    const prevLog = foodLog;
    if (foodLog) {
      setFoodLog({ ...foodLog, waterMl: foodLog.waterMl + 250 });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await nutritionAPI.addWater(250);
    } catch (err) {
      // Revert on failure
      setFoodLog(prevLog);
      Alert.alert("Error", "No se pudo registrar agua");
    }
  };

  const handleSaveAsFavorite = async (entry: FoodEntry) => {
    try {
      await nutritionAPI.saveFavorite({
        name: entry.name,
        brand: entry.brand || undefined,
        servingSize: entry.servingSize,
        servingUnit: entry.servingUnit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
      });
      Alert.alert("Guardado", `${entry.name} agregado a favoritos`);
    } catch {
      Alert.alert("Error", "No se pudo guardar");
    }
  };

  // ─── Derived data ───────────────────────────────────
  const meals: Record<MealType, FoodEntry[]> = {
    BREAKFAST: foodLog?.meals?.BREAKFAST ?? [],
    LUNCH: foodLog?.meals?.LUNCH ?? [],
    DINNER: foodLog?.meals?.DINNER ?? [],
    SNACK: foodLog?.meals?.SNACK ?? [],
  };

  const hasEntries = (foodLog?.entries?.length ?? 0) > 0;
  const isToday = isSameDay(selectedDate, new Date());

  // ─── Loading state ──────────────────────────────────
  if (loading && !foodLog) {
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
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-white text-2xl font-bold">Nutrición</Text>
              <Text className="text-text-secondary text-sm">
                {formatDisplayDate(selectedDate)}
              </Text>
            </View>
            <View className="flex-row items-center gap-x-2">
              {nutritionStats && nutritionStats.streak > 0 && (
                <View className="bg-amber-500/15 rounded-2xl px-3 py-2 flex-row items-center gap-x-1">
                  <Text className="text-sm">🔥</Text>
                  <Text className="text-amber-400 text-sm font-bold">{nutritionStats.streak}</Text>
                </View>
              )}
              {!isToday && (
                <TouchableOpacity
                  className="bg-primary/20 rounded-2xl px-3 py-2"
                  onPress={() => handleSelectDate(new Date())}
                >
                  <Text className="text-primary text-sm font-bold">Hoy</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ─── WEEK CALENDAR ──────────────────────── */}
          <WeekCalendar
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            datesWithEntries={datesWithEntries}
          />

          {/* ─── GRAPH CAROUSEL ─────────────────────── */}
          <GraphCarousel foodLog={foodLog} />

          {/* ─── HYDRATION + FASTING ────────────────── */}
          <View className="flex-row gap-x-3 mb-4">
            <HydrationCard
              waterMl={foodLog?.waterMl ?? 0}
              waterGoalMl={foodLog?.waterGoalMl ?? 2500}
              onAddWater={handleAddWater}
            />
            <FastingCard />
          </View>

          {/* ─── MEAL CARDS ─────────────────────────── */}
          <Text className="text-white font-bold text-lg mb-2">Comidas</Text>
          <MealCards
            meals={meals}
            calorieGoal={foodLog?.calorieGoal ?? 2000}
            activeMeal={activeMeal}
            onSelectMeal={setActiveMeal}
          />

          {/* ─── MEAL DETAIL ────────────────────────── */}
          <MealDetail
            mealType={activeMeal}
            entries={meals[activeMeal]}
            onAddFood={() => handleAddFood(activeMeal)}
            onDeleteEntry={handleDeleteEntry}
            onSaveAsFavorite={handleSaveAsFavorite}
          />

          {/* ─── AI INSIGHT ─────────────────────────── */}
          {isToday && <AiInsightCard hasEntries={hasEntries} />}
        </View>
      </ScrollView>

      {/* ─── ADD FOOD MODAL ─────────────────────────── */}
      <AddFoodModal
        visible={modalVisible}
        mealType={activeMeal}
        foodLog={foodLog}
        onClose={() => setModalVisible(false)}
        onSave={handleSaveFood}
        onOpenBarcode={() => {
          setModalVisible(false);
          setBarcodeVisible(true);
        }}
      />

      {/* ─── BARCODE SCANNER ───────────────────────── */}
      <BarcodeScanner
        visible={barcodeVisible}
        onClose={() => setBarcodeVisible(false)}
        onFoodFound={(food) => {
          setBarcodeVisible(false);
          // Re-open the modal with the scanned food selected
          // We'll save the food directly for simplicity
          handleSaveFood({
            mealType: activeMeal,
            name: food.name,
            brand: food.brand || undefined,
            barcode: food.barcode || undefined,
            servingSize: food.servingSize,
            servingUnit: food.servingUnit,
            calories: food.calories,
            protein: food.protein,
            carbs: food.carbs,
            fat: food.fat,
            fiber: food.fiber,
            sugar: food.sugar,
            sodium: food.sodium,
            source: "BARCODE",
          });
        }}
      />
    </SafeAreaView>
  );
}
