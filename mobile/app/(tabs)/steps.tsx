// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/steps.tsx
// Step Counter — inspirado en StepsApp pero superior
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import { stepsAPI, type WeekDayData } from "@/lib/api";
import { Pedometer } from "expo-sensors";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = SCREEN_WIDTH * 0.6;

// ─── Progress Ring (SVG-like con View) ───────────────
function ProgressRing({
  percentage,
  steps,
  goal,
}: {
  percentage: number;
  steps: number;
  goal: number;
}) {
  const clampedPct = Math.min(100, percentage);
  // Simular ring con bordes
  const ringColor = clampedPct >= 100 ? "#00D48A" : "#00BFFF";

  return (
    <View className="items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
      {/* Outer ring background */}
      <View
        className="absolute rounded-full"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderWidth: 12,
          borderColor: "#1A2A3A",
        }}
      />
      {/* Progress ring */}
      <View
        className="absolute rounded-full"
        style={{
          width: RING_SIZE,
          height: RING_SIZE,
          borderWidth: 12,
          borderColor: ringColor,
          borderTopColor: clampedPct < 25 ? "#1A2A3A" : ringColor,
          borderRightColor: clampedPct < 50 ? "#1A2A3A" : ringColor,
          borderBottomColor: clampedPct < 75 ? "#1A2A3A" : ringColor,
          borderLeftColor: clampedPct < 100 ? "#1A2A3A" : ringColor,
          transform: [{ rotate: "-90deg" }],
          opacity: clampedPct > 0 ? 1 : 0,
        }}
      />
      {/* Glow effect when goal reached */}
      {clampedPct >= 100 && (
        <View
          className="absolute rounded-full"
          style={{
            width: RING_SIZE + 8,
            height: RING_SIZE + 8,
            borderWidth: 2,
            borderColor: "#00D48A40",
          }}
        />
      )}
      {/* Center content */}
      <View className="items-center">
        <Ionicons name="footsteps" size={24} color="#00BFFF" />
        <Text className="text-white font-bold mt-1" style={{ fontSize: 48 }}>
          {steps.toLocaleString()}
        </Text>
        <Text className="text-text-secondary text-sm">Hoy</Text>
        <Text className="text-text-muted text-xs">
          OBJETIVO {goal.toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

// ─── Stat Circle ─────────────────────────────────────
function StatCircle({
  icon,
  value,
  label,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View className="items-center flex-1">
      <View
        className="rounded-full p-3 mb-1"
        style={{ borderWidth: 2, borderColor: color + "40" }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-white font-bold text-sm">{value}</Text>
      <Text className="text-text-muted text-xs">{label}</Text>
    </View>
  );
}

// ─── Week Bar Chart ──────────────────────────────────
function WeekChart({ days, maxSteps }: { days: WeekDayData[]; maxSteps: number }) {
  const maxVal = Math.max(maxSteps, 1)

  return (
    <View className="flex-row items-end justify-between px-2" style={{ height: 120 }}>
      {days.map((day, idx) => {
        const barHeight = Math.max(4, (day.steps / maxVal) * 100)
        const isToday = day.isToday

        return (
          <View key={idx} className="items-center flex-1 mx-0.5">
            {/* Step count label on tallest bars */}
            {day.steps > 0 && (
              <Text className="text-text-muted text-center mb-1" style={{ fontSize: 8 }}>
                {day.steps > 999
                  ? `${(day.steps / 1000).toFixed(1)}k`
                  : day.steps}
              </Text>
            )}
            {/* Bar */}
            <View
              className="w-full rounded-t-lg"
              style={{
                height: barHeight,
                backgroundColor: day.goalReached
                  ? "#00D48A"
                  : isToday
                  ? "#00BFFF"
                  : "#00BFFF60",
                minWidth: 20,
              }}
            />
            {/* Goal line indicator */}
            {day.goalReached && (
              <View className="absolute" style={{ bottom: (day.goal / maxVal) * 100 }}>
                <Ionicons name="checkmark-circle" size={12} color="#00D48A" />
              </View>
            )}
            {/* Day label */}
            <Text
              className={`text-xs mt-1 ${
                isToday ? "text-white font-bold" : "text-text-muted"
              }`}
            >
              {day.dayLabel}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Goal Edit Modal ─────────────────────────────────
function GoalModal({
  visible,
  currentGoal,
  onClose,
  onSave,
}: {
  visible: boolean;
  currentGoal: number;
  onClose: () => void;
  onSave: (goal: number) => void;
}) {
  const [goal, setGoal] = useState(String(currentGoal));
  const presets = [5000, 7500, 8500, 10000, 12000, 15000];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-background rounded-t-3xl p-5 pb-10">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-white font-bold text-xl">Meta de pasos</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* Presets */}
          <View className="flex-row flex-wrap gap-2 mb-4">
            {presets.map((p) => (
              <TouchableOpacity
                key={p}
                className={`rounded-2xl px-4 py-2 ${
                  parseInt(goal) === p
                    ? "bg-primary"
                    : "bg-background-elevated"
                }`}
                onPress={() => setGoal(String(p))}
              >
                <Text
                  className={`font-bold text-sm ${
                    parseInt(goal) === p ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {p.toLocaleString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom input */}
          <Text className="text-text-secondary text-sm mb-1">O escribe tu meta:</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-lg text-center mb-4"
            value={goal}
            onChangeText={setGoal}
            keyboardType="number-pad"
            placeholderTextColor="#6B6B80"
          />

          <TouchableOpacity
            className="bg-primary rounded-2xl py-4 items-center"
            onPress={() => {
              const val = parseInt(goal);
              if (val >= 1000 && val <= 100000) {
                onSave(val);
                onClose();
              } else {
                Alert.alert("Error", "La meta debe ser entre 1,000 y 100,000");
              }
            }}
          >
            <Text className="text-white font-bold text-base">Guardar meta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// STEPS SCREEN
// ═══════════════════════════════════════════════════════
export default function StepsScreen() {
  const [todayData, setTodayData] = useState<any>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [pedometerAvailable, setPedometerAvailable] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const subscriptionRef = useRef<any>(null);

  // ─── Pedometer setup ───────────────────────────────
  useEffect(() => {
    const setupPedometer = async () => {
      const available = await Pedometer.isAvailableAsync();
      setPedometerAvailable(available);

      if (available) {
        // Obtener pasos desde medianoche
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);

        try {
          const result = await Pedometer.getStepCountAsync(midnight, new Date());
          setLiveSteps(result.steps);
        } catch (err) {
          console.log("Error getting step count:", err);
        }

        // Suscribirse a updates en tiempo real
        subscriptionRef.current = Pedometer.watchStepCount((result) => {
          setLiveSteps((prev) => prev + result.steps);
        });
      }
    };

    setupPedometer();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
    };
  }, []);

  // ─── Sync live steps al backend cada 60 segundos ──
  useEffect(() => {
    if (liveSteps <= 0) return;

    const syncInterval = setInterval(async () => {
      try {
        await stepsAPI.syncSteps(liveSteps);
      } catch {}
    }, 60000); // cada 60 segundos

    return () => clearInterval(syncInterval);
  }, [liveSteps]);

  // ─── Fetch data ────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      // Sync current steps first
      if (liveSteps > 0) {
        await stepsAPI.syncSteps(liveSteps);
      }

      const [todayRes, weekRes] = await Promise.all([
        stepsAPI.getToday(),
        stepsAPI.getWeek(),
      ]);
      setTodayData(todayRes.data);
      setWeekData(weekRes.data);
    } catch (err) {
      console.error("Steps fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [liveSteps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleGoalSave = async (goal: number) => {
    try {
      await stepsAPI.updateGoal(goal);
      await fetchData();
    } catch {
      Alert.alert("Error", "No se pudo actualizar la meta");
    }
  };

  // Use live steps if higher than backend
  const displaySteps = Math.max(liveSteps, todayData?.steps ?? 0);
  const currentGoal = todayData?.goal ?? 8500;
  const pct = Math.min(100, Math.round((displaySteps / currentGoal) * 100));
  const calories = todayData?.calories ?? Math.round(displaySteps * 0.04);
  const distance = todayData?.distanceKm ?? Math.round((displaySteps * 0.762) / 10) / 100;
  const activeMin = todayData?.activeMinutes ?? Math.round(displaySteps / 100);
  const activeHours = Math.floor(activeMin / 60);
  const activeRemainder = activeMin % 60;

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#00BFFF" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00BFFF" />
        }
      >
        <View className="px-5 pt-4 pb-8">
          {/* ─── HEADER ─────────────────────────────── */}
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-white text-2xl font-bold">Pasos</Text>
              <Text className="text-text-secondary text-sm">
                {new Date().toLocaleDateString("es", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
            </View>
            <TouchableOpacity
              className="bg-background-card border border-background-elevated rounded-2xl p-3"
              onPress={() => setShowGoalModal(true)}
            >
              <Ionicons name="flag-outline" size={20} color="#00BFFF" />
            </TouchableOpacity>
          </View>

          {/* ─── Pedometer status ────────────────────── */}
          {!pedometerAvailable && (
            <View className="bg-background-card border border-amber-500/20 rounded-2xl p-3 mb-4 flex-row items-center gap-x-2">
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text className="text-text-secondary text-xs flex-1">
                Podómetro no disponible. Los pasos se sincronizarán manualmente.
              </Text>
            </View>
          )}

          {/* ─── PROGRESS RING ──────────────────────── */}
          <View className="items-center mb-6">
            <ProgressRing
              percentage={pct}
              steps={displaySteps}
              goal={currentGoal}
            />

            {/* Goal reached celebration */}
            {pct >= 100 && (
              <View className="bg-green-500/10 border border-green-500/30 rounded-2xl px-4 py-2 mt-3 flex-row items-center gap-x-2">
                <Text className="text-lg">🎉</Text>
                <Text className="text-green-400 font-bold text-sm">
                  ¡Meta alcanzada!
                </Text>
              </View>
            )}
          </View>

          {/* ─── STATS ROW ──────────────────────────── */}
          <View className="flex-row mb-6">
            <StatCircle
              icon="flame-outline"
              value={`${calories}`}
              label="kcal"
              color="#FF6B35"
            />
            <StatCircle
              icon="navigate-outline"
              value={`${distance}`}
              label="km"
              color="#00BFFF"
            />
            <StatCircle
              icon="time-outline"
              value={activeHours > 0 ? `${activeHours}:${String(activeRemainder).padStart(2, "0")}` : `${activeMin}m`}
              label={activeHours > 0 ? "horas" : "min"}
              color="#6C63FF"
            />
          </View>

          {/* ─── WEEK CHART ─────────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-bold text-base">Esta semana</Text>
              {weekData?.avgSteps > 0 && (
                <Text className="text-text-secondary text-xs">
                  Promedio: {weekData.avgSteps.toLocaleString()}
                </Text>
              )}
            </View>

            {weekData?.days && (
              <WeekChart
                days={weekData.days}
                maxSteps={Math.max(...weekData.days.map((d: any) => d.steps), currentGoal)}
              />
            )}

            {/* Goal line label */}
            <View className="flex-row items-center gap-x-2 mt-3">
              <View className="h-px flex-1 bg-dashed" style={{ borderTopWidth: 1, borderColor: "#00BFFF40", borderStyle: "dashed" }} />
              <Text className="text-text-muted text-xs">
                Meta: {currentGoal.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* ─── WEEK TOTALS ────────────────────────── */}
          {weekData?.weekTotal && (
            <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
              <Text className="text-white font-bold text-base mb-3">
                Resumen semanal
              </Text>
              <View className="flex-row justify-between">
                <View className="items-center flex-1">
                  <Text className="text-white font-bold text-lg">
                    {weekData.weekTotal.steps.toLocaleString()}
                  </Text>
                  <Text className="text-text-muted text-xs">pasos</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-white font-bold text-lg">
                    {Math.round(weekData.weekTotal.calories).toLocaleString()}
                  </Text>
                  <Text className="text-text-muted text-xs">kcal</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-white font-bold text-lg">
                    {weekData.weekTotal.distanceKm}
                  </Text>
                  <Text className="text-text-muted text-xs">km</Text>
                </View>
                <View className="items-center flex-1">
                  <Text className="text-white font-bold text-lg">
                    {weekData.weekTotal.daysGoalReached}/7
                  </Text>
                  <Text className="text-text-muted text-xs">metas</Text>
                </View>
              </View>
            </View>
          )}

          {/* ─── STREAK ─────────────────────────────── */}
          <View className="bg-background-card border border-primary/20 rounded-3xl p-4 mb-4 flex-row items-center gap-x-4">
            <View className="bg-primary/20 rounded-2xl p-3">
              <Ionicons name="footsteps" size={24} color="#00BFFF" />
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-base">
                Step Streak
              </Text>
              <Text className="text-text-secondary text-sm">
                Días consecutivos alcanzando la meta
              </Text>
            </View>
            <View className="bg-background-elevated rounded-2xl px-4 py-2">
              <Text className="text-white font-bold text-xl">
                {weekData?.weekTotal?.daysGoalReached ?? 0}
              </Text>
            </View>
          </View>

          {/* ─── XP INFO ────────────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4">
            <Text className="text-white font-bold text-base mb-2">XP por pasos</Text>
            <Text className="text-text-secondary text-sm">
              Ganas 1 XP por cada 1,000 pasos (máximo 10 XP/día).
              Hoy has ganado{" "}
              <Text className="text-primary font-bold">
                +{Math.min(10, Math.floor(displaySteps / 1000))} XP
              </Text>
              {" "}por caminar.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ─── GOAL MODAL ─────────────────────────────── */}
      <GoalModal
        visible={showGoalModal}
        currentGoal={currentGoal}
        onClose={() => setShowGoalModal(false)}
        onSave={handleGoalSave}
      />
    </SafeAreaView>
  );
}