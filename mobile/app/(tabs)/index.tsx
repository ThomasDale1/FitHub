// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/index.tsx
// Dashboard con datos reales + quick access Nutrición/Pasos
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import StatCard from "@/components/StatCard";
import StreakBadge from "@/components/StreakBadge";
import XPBar from "@/components/XPBar";
import WorkoutCard from "@/components/WorkoutCard";
import { useDashboard } from "@/hooks/useUserData";
import { socialAPI, userAPI, wellnessAPI } from "@/lib/api";

// Fallback para cuando el backend no responde
const FALLBACK_DATA = {
  user: {
    name: "Atleta",
    avatarUrl: null,
    xp: 0,
    level: 1,
    currentXP: 0,
    maxXP: 500,
    streak: 0,
  },
  weekStats: {
    workouts: 0,
    calories: 0,
    volume: 0,
    minutes: 0,
  },
  recentWorkouts: [],
  activeGoals: [],
};

export default function DashboardScreen() {
  const { user: clerkUser } = useUser();
  const { data, loading, error, refetch } = useDashboard();
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readiness, setReadiness] = useState<{ score: number; zone: "RED" | "YELLOW" | "GREEN" } | null>(null);

  // Check onboarding status — redirect if not completed
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const res = await userAPI.getProfile();
        if (res.data && !res.data.onboardingCompleted) {
          const step = res.data.onboardingStep || 0;
          const screens = [
            "personal-info", "goals", "hobbies", "experience",
            "location", "connect", "first-challenge",
          ];
          const target = screens[Math.min(step, screens.length - 1)];
          router.replace(`/(onboarding)/${target}` as any);
        }
      } catch {}
    };
    checkOnboarding();
  }, []);

  // Fetch unread notifications + readiness
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await socialAPI.getNotifications();
        setUnreadCount(res.data.unreadCount || 0);
      } catch {}
    };
    const fetchReadiness = async () => {
      try {
        const res = await wellnessAPI.getReadiness();
        const d = res.data?.data;
        if (d) setReadiness({ score: d.score, zone: d.zone });
      } catch {}
    };
    fetchUnread();
    fetchReadiness();
  }, []);

  // Usar datos reales o fallback
  const dashData = data || FALLBACK_DATA;

  const firstName =
    data?.user.name?.split(" ")[0] ||
    clerkUser?.firstName ||
    clerkUser?.emailAddresses[0]?.emailAddress?.split("@")[0] ||
    "Atleta";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Fetch dashboard data
    await refetch();
    // Also fetch readiness and notifications
    try {
      const notifRes = await socialAPI.getNotifications();
      setUnreadCount(notifRes.data.unreadCount || 0);
    } catch {}
    try {
      const readinessRes = await wellnessAPI.getReadiness();
      const d = readinessRes.data?.data;
      if (d) setReadiness({ score: d.score, zone: d.zone });
    } catch {}
    setRefreshing(false);
  }, [refetch]);

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
              onPress={() => router.push("/notifications")}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color="#A0A0B0"
              />
              {unreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-white text-xs font-bold">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── LOADING STATE ──────────────────────── */}
          {loading && !data && (
            <ActivityIndicator
              color="#6C63FF"
              size="large"
              className="py-12"
            />
          )}

          {/* ─── ERROR BANNER (sutil) ───────────────── */}
          {error && !data && (
            <TouchableOpacity
              className="bg-background-card border border-streak/20 rounded-2xl p-3 mb-4 flex-row items-center gap-x-2"
              onPress={refetch}
            >
              <Ionicons
                name="cloud-offline-outline"
                size={18}
                color="#FF6B35"
              />
              <Text className="text-text-secondary text-sm flex-1">
                Sin conexión al servidor
              </Text>
              <Text className="text-primary text-sm font-bold">
                Reintentar
              </Text>
            </TouchableOpacity>
          )}

          {/* ─── STREAK ─────────────────────────────── */}
          <StreakBadge streak={dashData.user.streak} />

          {/* ─── XP BAR ─────────────────────────────── */}
          <View className="mt-4">
            <XPBar
              currentXP={dashData.user.currentXP}
              maxXP={dashData.user.maxXP}
              level={dashData.user.level}
            />
          </View>

          {/* ─── READINESS MINI WIDGET ────────────────── */}
          {readiness && (
            <TouchableOpacity
              className="mt-4 bg-background-card border border-background-elevated rounded-3xl p-4 flex-row items-center gap-x-4"
              onPress={() => router.push("/(tabs)/wellness" as any)}
            >
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    readiness.zone === "GREEN"
                      ? "#00D48A20"
                      : readiness.zone === "YELLOW"
                        ? "#F5C84220"
                        : "#FF6B6B20",
                  borderWidth: 2.5,
                  borderColor:
                    readiness.zone === "GREEN"
                      ? "#00D48A"
                      : readiness.zone === "YELLOW"
                        ? "#F5C842"
                        : "#FF6B6B",
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "800",
                    color:
                      readiness.zone === "GREEN"
                        ? "#00D48A"
                        : readiness.zone === "YELLOW"
                          ? "#F5C842"
                          : "#FF6B6B",
                  }}
                >
                  {readiness.score}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-sm">Readiness</Text>
                <Text className="text-text-muted text-xs mt-0.5">
                  {readiness.zone === "GREEN"
                    ? "Listo para entrenar intenso"
                    : readiness.zone === "YELLOW"
                      ? "Energía moderada hoy"
                      : "Tu cuerpo pide descanso"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B6B80" />
            </TouchableOpacity>
          )}

          {/* ─── STATS GRID ─────────────────────────── */}
          <Text className="text-white font-bold text-lg mt-6 mb-3">
            Esta semana
          </Text>

          {/* Fila 1 */}
          <View className="flex-row gap-x-3 mb-3">
            <StatCard
              icon="barbell"
              label="Workouts"
              value={String(dashData.weekStats.workouts)}
              unit="esta semana"
              subtitle="Meta: 5"
              gradient={["#6C63FF", "#9B8FFF"]}
            />
            <StatCard
              icon="flame"
              label="Calorías"
              value={dashData.weekStats.calories.toLocaleString()}
              unit="kcal"
              subtitle="Estimado"
              gradient={["#FF6B35", "#FF9A6C"]}
            />
          </View>

          {/* Fila 2 */}
          <View className="flex-row gap-x-3">
            <StatCard
              icon="fitness"
              label="Volumen"
              value={
                dashData.weekStats.volume >= 1000
                  ? `${(dashData.weekStats.volume / 1000).toFixed(1)}t`
                  : String(dashData.weekStats.volume)
              }
              unit={dashData.weekStats.volume >= 1000 ? "" : "kg"}
              subtitle="Total semanal"
              gradient={["#00D48A", "#00B876"]}
            />
            <StatCard
              icon="star"
              label="XP Total"
              value={dashData.user.xp.toLocaleString()}
              unit="xp"
              subtitle={`Nivel ${dashData.user.level}`}
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

          {/* ─── QUICK ACCESS ───────────────────────── */}
          <View className="flex-row gap-x-3 mt-3">
            <TouchableOpacity
              className="flex-1 bg-background-card border border-background-elevated rounded-3xl py-3 flex-row items-center justify-center gap-x-2"
              onPress={() => router.push("/(tabs)/nutrition")}
            >
              <Ionicons name="nutrition" size={18} color="#00D48A" />
              <Text className="text-white font-bold text-sm">Nutrición</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-background-card border border-background-elevated rounded-3xl py-3 flex-row items-center justify-center gap-x-2"
              onPress={() => router.push("/(tabs)/steps")}
            >
              <Ionicons name="footsteps" size={18} color="#00BFFF" />
              <Text className="text-white font-bold text-sm">Pasos</Text>
            </TouchableOpacity>
          </View>

          {/* ─── WORKOUTS RECIENTES ──────────────────── */}
          <View className="flex-row justify-between items-center mt-6 mb-3">
            <Text className="text-white font-bold text-lg">
              Workouts recientes
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/workout")}
            >
              <Text className="text-primary text-sm font-bold">
                Ver todos
              </Text>
            </TouchableOpacity>
          </View>

          {dashData.recentWorkouts.length === 0 ? (
            <View className="bg-background-card border border-background-elevated rounded-3xl p-6 items-center">
              <Text className="text-4xl mb-2">🏋️</Text>
              <Text className="text-text-secondary text-sm text-center">
                Aún no tienes workouts registrados.{"\n"}
                ¡Empieza tu primer entrenamiento!
              </Text>
            </View>
          ) : (
            dashData.recentWorkouts.map((workout) => (
              <WorkoutCard
                key={workout.id}
                name={workout.name}
                date={workout.date}
                duration={workout.duration}
                xpEarned={workout.xpEarned}
                setsCount={workout.setsCount}
              />
            ))
          )}

          {/* ─── ACTIVE GOALS ───────────────────────── */}
          {dashData.activeGoals.length > 0 && (
            <>
              <Text className="text-white font-bold text-lg mt-6 mb-3">
                Metas activas
              </Text>
              {dashData.activeGoals.map((goal) => {
                const progress =
                  goal.targetValue && goal.currentValue
                    ? Math.min(
                        (goal.currentValue / goal.targetValue) * 100,
                        100
                      )
                    : 0;
                return (
                  <View
                    key={goal.id}
                    className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-2"
                  >
                    <View className="flex-row justify-between items-center mb-2">
                      <Text className="text-white font-bold text-sm">
                        {goal.title}
                      </Text>
                      <Text className="text-primary text-xs font-bold">
                        {Math.round(progress)}%
                      </Text>
                    </View>
                    {/* Progress bar */}
                    <View className="bg-background-elevated rounded-full h-2">
                      <View
                        className="bg-primary rounded-full h-2"
                        style={{ width: `${progress}%` }}
                      />
                    </View>
                    {goal.targetValue && (
                      <Text className="text-text-muted text-xs mt-1">
                        {goal.currentValue ?? 0} / {goal.targetValue}{" "}
                        {goal.unit}
                      </Text>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* ─── AI COACH BANNER ─────────────────────── */}
          <TouchableOpacity
            className="bg-background-card border border-primary/30 rounded-3xl p-4 mt-4 flex-row items-center gap-x-4"
            onPress={() => router.push("/ai/coach")}
          >
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
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#6B6B80"
            />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}