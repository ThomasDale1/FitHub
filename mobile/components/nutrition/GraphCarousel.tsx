// ─────────────────────────────────────────────────────
// GraphCarousel — Carrusel horizontal: Calorías, Macros, Micros
// ─────────────────────────────────────────────────────
import { View, Text, ScrollView, useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useState, useRef } from "react";
import DonutRing from "./DonutRing";
import type { FoodLogData } from "@/lib/api";

interface Props {
  foodLog: FoodLogData | null;
}

// ─── Card 1: Calorie Donut ──────────────────────────
function CalorieCard({ foodLog, cardWidth }: Props & { cardWidth: number }) {
  const consumed = foodLog?.totalCalories ?? 0;
  const goal = foodLog?.calorieGoal ?? 2000;
  const remaining = Math.max(0, goal - consumed);
  const pct = goal > 0 ? consumed / goal : 0;
  const exceeded = consumed > goal;

  return (
    <View
      className="bg-background-card border border-background-elevated rounded-3xl p-5 items-center"
      style={{ width: cardWidth }}
    >
      <Text className="text-text-secondary text-sm mb-3">Calorías</Text>
      <DonutRing
        size={150}
        strokeWidth={14}
        progress={Math.max(0, Math.min(pct, 1))}
        color={exceeded ? "#FF6B6B" : "#6C63FF"}
      >
        <Text className="text-white text-3xl font-bold">{remaining}</Text>
        <Text className="text-text-muted text-xs">restantes</Text>
      </DonutRing>
      <Text className="text-text-muted text-xs mt-3">
        {consumed} / {goal} kcal
      </Text>
      {exceeded && (
        <Text className="text-red-400 text-xs mt-1">
          Excediste por {consumed - goal} kcal
        </Text>
      )}
    </View>
  );
}

// ─── Card 2: Macro Rings ────────────────────────────
function MacroCard({ foodLog, cardWidth }: Props & { cardWidth: number }) {
  const macros = [
    {
      label: "Proteína",
      current: foodLog?.totalProtein ?? 0,
      goal: foodLog?.proteinGoal ?? 150,
      color: "#FF6B6B",
      unit: "g",
    },
    {
      label: "Carbos",
      current: foodLog?.totalCarbs ?? 0,
      goal: foodLog?.carbsGoal ?? 250,
      color: "#6C63FF",
      unit: "g",
    },
    {
      label: "Grasa",
      current: foodLog?.totalFat ?? 0,
      goal: foodLog?.fatGoal ?? 65,
      color: "#F59E0B",
      unit: "g",
    },
  ];

  return (
    <View
      className="bg-background-card border border-background-elevated rounded-3xl p-5"
      style={{ width: cardWidth }}
    >
      <Text className="text-text-secondary text-sm mb-4 text-center">Macros</Text>
      <View className="flex-row justify-around">
        {macros.map((m) => {
          const pct = m.goal > 0 ? m.current / m.goal : 0;
          return (
            <View key={m.label} className="items-center">
              <DonutRing size={80} strokeWidth={8} progress={Math.max(0, Math.min(pct, 1))} color={m.color}>
                <Text className="text-white text-sm font-bold">
                  {Math.round(Math.max(0, Math.min(pct, 1)) * 100)}%
                </Text>
              </DonutRing>
              <Text className="text-text-secondary text-xs mt-2">{m.label}</Text>
              <Text className="text-white text-xs font-semibold">
                {Math.round(m.current)}/{m.goal}{m.unit}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Card 3: Micronutrients Bars ────────────────────
function MicroCard({ foodLog, cardWidth }: Props & { cardWidth: number }) {
  const micros = [
    { label: "Fibra", current: foodLog?.totalFiber ?? 0, goal: 25, unit: "g", color: "#34D399" },
    {
      label: "Azúcar",
      current: estimateSugar(foodLog),
      goal: 30,
      unit: "g",
      color: "#F472B6",
      warn: true,
    },
    { label: "Sodio", current: estimateSodium(foodLog), goal: 2300, unit: "mg", color: "#60A5FA", warn: true },
  ];

  return (
    <View
      className="bg-background-card border border-background-elevated rounded-3xl p-5"
      style={{ width: cardWidth }}
    >
      <Text className="text-text-secondary text-sm mb-4 text-center">Micronutrientes</Text>
      {micros.map((m) => {
        const pct = m.goal > 0 ? Math.min(m.current / m.goal, 1) : 0;
        const exceeded = m.current > m.goal;
        return (
          <View key={m.label} className="mb-3">
            <View className="flex-row justify-between items-center mb-1">
              <Text className="text-text-secondary text-xs">{m.label}</Text>
              <View className="flex-row items-center gap-x-1">
                <Text className="text-white text-xs font-bold">
                  {Math.round(m.current)}/{m.goal}{m.unit}
                </Text>
                {exceeded && m.warn && (
                  <Text className="text-yellow-400 text-xs">⚠️</Text>
                )}
              </View>
            </View>
            <View className="bg-background-elevated rounded-full h-2">
              <View
                className="rounded-full h-2"
                style={{
                  width: `${pct * 100}%`,
                  backgroundColor: exceeded && m.warn ? "#FF6B6B" : m.color,
                }}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Estimates from entries (fallback if not tracked at entry level)
function estimateSugar(foodLog: FoodLogData | null): number {
  if (!foodLog?.entries) return 0;
  return foodLog.entries.reduce((sum, e) => sum + (e.sugar ?? 0), 0);
}
function estimateSodium(foodLog: FoodLogData | null): number {
  if (!foodLog?.entries) return 0;
  return foodLog.entries.reduce((sum, e) => sum + (e.sodium ?? 0), 0);
}

// ─── Main Carousel ──────────────────────────────────
export default function GraphCarousel({ foodLog }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(300, width - 40);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (cardWidth + 12));
    setActiveIndex(idx);
  };

  return (
    <View className="mb-4">
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 0, gap: 12 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <CalorieCard foodLog={foodLog} cardWidth={cardWidth} />
        <MacroCard foodLog={foodLog} cardWidth={cardWidth} />
        <MicroCard foodLog={foodLog} cardWidth={cardWidth} />
      </ScrollView>

      {/* Page dots */}
      <View className="flex-row justify-center mt-3 gap-x-2">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="rounded-full"
            style={{
              width: activeIndex === i ? 16 : 6,
              height: 6,
              backgroundColor: activeIndex === i ? "#6C63FF" : "#3A3A50",
            }}
          />
        ))}
      </View>
    </View>
  );
}
