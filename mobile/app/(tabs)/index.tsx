import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { router } from "expo-router";
import StatCard from "@/components/StatCard";
import StreakBadge from "@/components/StreakBadge";
import XPBar from "@/components/XPBar";
import WorkoutCard from "@/components/WorkoutCard";

// Datos de ejemplo por ahora
// Los reemplazaremos con datos reales del backend
const MOCK_DATA = {
  streak: 7,
  xp: 340,
  level: 3,
  maxXP: 500,
  steps: 8420,
  calories: 2150,
  workoutsThisWeek: 4,
  recentWorkouts: [
    {
      id: "1",
      name: "Pecho y Tríceps",
      date: "Hoy",
      duration: 65,
      xpEarned: 80,
      setsCount: 18,
    },
    {
      id: "2",
      name: "Espalda y Bíceps",
      date: "Ayer",
      duration: 55,
      xpEarned: 70,
      setsCount: 15,
    },
    {
      id: "3",
      name: "Piernas",
      date: "Hace 2 días",
      duration: 70,
      xpEarned: 90,
      setsCount: 20,
    },
  ],
};

export default function DashboardScreen() {
  const { user } = useUser();
  const [refreshing, setRefreshing] = useState(false);

  const firstName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split("@")[0] || "Atleta";

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // Aquí llamaremos al backend cuando lo conectemos
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6C63FF"
          />
        }
      >
        <View className="px-5 pt-4 pb-8">

          {/* ─── HEADER ─────────────────────────────── */}
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-text-secondary text-sm">
                {getGreeting()},
              </Text>
              <Text className="text-white text-2xl font-bold">
                {firstName} 👋
              </Text>
            </View>
            <TouchableOpacity
              className="bg-background-card border border-background-elevated rounded-2xl p-3"
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Ionicons name="notifications-outline" size={22} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* ─── STREAK ─────────────────────────────── */}
          <StreakBadge streak={MOCK_DATA.streak} />

          {/* ─── XP BAR ─────────────────────────────── */}
          <View className="mt-4">
            <XPBar
              currentXP={MOCK_DATA.xp}
              maxXP={MOCK_DATA.maxXP}
              level={MOCK_DATA.level}
            />
          </View>

          {/* ─── STATS GRID ─────────────────────────── */}
          <Text className="text-white font-bold text-lg mt-6 mb-3">
            Hoy
          </Text>

          {/* Fila 1 — ancho completo */}
          <View className="flex-row gap-x-3 mb-3">
            <StatCard
              icon="footsteps"
              label="Pasos"
              value={MOCK_DATA.steps.toLocaleString()}
              subtitle="Meta: 10,000"
              gradient={["#6C63FF", "#9B8FFF"]}
            />
            <StatCard
              icon="flame"
              label="Calorías"
              value={MOCK_DATA.calories.toLocaleString()}
              unit="kcal"
              subtitle="Meta: 2,500"
              gradient={["#FF6B35", "#FF9A6C"]}
            />
          </View>

          {/* Fila 2 — ancho completo */}
          <View className="flex-row gap-x-3">
            <StatCard
              icon="barbell"
              label="Workouts"
              value={String(MOCK_DATA.workoutsThisWeek)}
              unit="esta semana"
              subtitle="Meta: 5"
              gradient={["#00D48A", "#00B876"]}
            />
            <StatCard
              icon="star"
              label="XP Total"
              value={String(MOCK_DATA.xp)}
              unit="xp"
              subtitle={`Nivel ${MOCK_DATA.level}`}
              gradient={["#F59E0B", "#EF8C00"]}
            />
          </View>

          {/* ─── BOTÓN REGISTRAR WORKOUT ────────────── */}
          <TouchableOpacity
            className="bg-primary rounded-3xl py-4 flex-row items-center justify-center gap-x-2 mt-6"
            onPress={() => router.push("/(tabs)/workout")}
          >
            <Ionicons name="add-circle" size={22} color="white" />
            <Text className="text-white font-bold text-base">
              Registrar workout
            </Text>
          </TouchableOpacity>

          {/* ─── WORKOUTS RECIENTES ──────────────────── */}
          <View className="flex-row justify-between items-center mt-6 mb-3">
            <Text className="text-white font-bold text-lg">
              Workouts recientes
            </Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/workout")}>
              <Text className="text-primary text-sm font-bold">
                Ver todos
              </Text>
            </TouchableOpacity>
          </View>

          {MOCK_DATA.recentWorkouts.map((workout) => (
            <WorkoutCard
              key={workout.id}
              name={workout.name}
              date={workout.date}
              duration={workout.duration}
              xpEarned={workout.xpEarned}
              setsCount={workout.setsCount}
            />
          ))}

          {/* ─── AI COACH BANNER ─────────────────────── */}
          <TouchableOpacity className="bg-background-card border border-primary/30 rounded-3xl p-4 mt-3 flex-row items-center gap-x-4">
            <View className="bg-primary/20 rounded-2xl p-3">
              <Ionicons name="sparkles" size={24} color="#6C63FF" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">
                AI Coach
              </Text>
              <Text className="text-text-secondary text-sm mt-1">
                Pregúntale a tu coach personalizado
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#6B6B80" />
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}