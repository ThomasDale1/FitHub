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
import Svg, { Circle } from "react-native-svg";
import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useTour } from "@/context/TourContext";
import { AppState, type AppStateStatus } from "react-native";
import { stepsAPI, type WeekDayData } from "@/lib/api";
import { Pedometer } from "expo-sensors";
import { getStepsSinceMidnight } from "@/lib/stepTracker";
import {
  initHealthSteps,
  getStepsSinceMidnight as healthGetSteps,
  isUsingHealthService,
} from "@/lib/healthSteps";
import Constants from "expo-constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RING_SIZE = SCREEN_WIDTH * 0.6;

// ─── Progress Ring (SVG) ─────────────────────────────
function ProgressRing({
  percentage,
  steps,
  goal,
}: {
  percentage: number;
  steps: number;
  goal: number;
}) {
  const strokeWidth = 14;
  const radius = (RING_SIZE - strokeWidth) / 2;
  const cx = RING_SIZE / 2;
  const cy = RING_SIZE / 2;
  const clampedPct = Math.min(100, Math.max(0, percentage));
  const ringColor = clampedPct >= 100 ? "#00D48A" : "#00BFFF";
  const circumference = 2 * Math.PI * radius;
  // Offset: 0% = full dash hidden, 100% = nothing hidden
  const strokeDashoffset = circumference * (1 - clampedPct / 100);

  return (
    <View
      className="items-center justify-center"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
        {/* Background track */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke="#1A2A3A"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — starts at bottom (6 o'clock), fills clockwise */}
        <Circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(90, ${cx}, ${cy})`}
        />
      </Svg>

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

  // Sync input when modal opens so it always shows the current goal
  useEffect(() => {
    if (visible) setGoal(String(currentGoal));
  }, [visible, currentGoal]);

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
  const { isActive, step, advanceStep, beginTransition } = useTour();

  // Tour: hide overlay immediately so user sees the tab, then advance after delay
  useFocusEffect(
    useCallback(() => {
      if (isActive && step === 1) {
        beginTransition()
        const t = setTimeout(() => advanceStep(), 3000)
        return () => clearTimeout(t)
      }
    }, [isActive, step, advanceStep, beginTransition])
  );

  const [todayData, setTodayData] = useState<any>(null);
  const [weekData, setWeekData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [pedometerAvailable, setPedometerAvailable] = useState(false);
  const [liveSteps, setLiveSteps] = useState(0);
  const [stepSource, setStepSource] = useState<"healthkit" | "health_connect" | "pedometer">("pedometer");
  const subscriptionRef = useRef<any>(null);
  const healthPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveStepsRef = useRef(0);

  // Ref para guardar pasos base (antes de iniciar suscripción)
  const initialStepsRef = useRef(0);

  // ─── Health / Pedometer setup ────────────────────────
  useEffect(() => {
    let mounted = true;

    const setup = async () => {
      // 1. Try HealthKit / Health Connect first
      const source = await initHealthSteps();
      if (!mounted) return;
      setStepSource(source);
      const usingHealth = isUsingHealthService();

      if (usingHealth) {
        // Health platform available — read initial steps
        try {
          const result = await healthGetSteps();
          if (!mounted) return;
          console.log(`🦶 [${source}] steps: ${result.steps}`);
          setLiveSteps(result.steps);
          setPedometerAvailable(true);
          if (result.steps > 0) {
            stepsAPI.syncSteps(result.steps).catch(() => {});
          }
        } catch (err) {
          console.log("Error getting health steps:", err);
        }

        if (!mounted) return;
        // HealthKit/Health Connect don't support real-time subscriptions
        // like CMPedometer — poll every 10 seconds for near-real-time updates
        healthPollRef.current = setInterval(async () => {
          try {
            const result = await healthGetSteps();
            if (mounted) setLiveSteps(result.steps);
          } catch {}
        }, 10000);
      } else {
        // Fallback to raw CMPedometer
        const available = await Pedometer.isAvailableAsync();
        if (!mounted) return;
        setPedometerAvailable(available);

        if (available) {
          try {
            const steps = await getStepsSinceMidnight();
            if (!mounted) return;
            console.log(`🦶 Pedometer raw value: ${steps}`);
            initialStepsRef.current = steps;
            setLiveSteps(steps);
            if (steps > 0) {
              stepsAPI.syncSteps(steps).catch(() => {});
            }
          } catch (err) {
            console.log("Error getting step count:", err);
          }

          if (!mounted) return;
          // watchStepCount devuelve pasos ACUMULADOS desde que inició
          // la suscripción, por eso usamos initialSteps + result.steps
          subscriptionRef.current = Pedometer.watchStepCount((result) => {
            if (mounted) setLiveSteps(initialStepsRef.current + result.steps);
          });
        }
      }
    };

    setup();

    return () => {
      mounted = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
      }
      if (healthPollRef.current) {
        clearInterval(healthPollRef.current);
      }
    };
  }, []);

  // ─── Fetch data (solo lectura, sin sync) ───────────
  const fetchData = useCallback(async (isRetry = false) => {
    try {
      const [todayRes, weekRes] = await Promise.all([
        stepsAPI.getToday(),
        stepsAPI.getWeek(),
      ]);
      setTodayData(todayRes.data);
      setWeekData(weekRes.data);
    } catch (err: any) {
      if (err?.response?.status === 401 && !isRetry) {
        // Token not ready yet (sign-in transition) — retry once after delay
        setTimeout(() => fetchData(true), 1500);
        return;
      }
      console.error("Steps fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Refresh steps cuando la app vuelve al foreground ─
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextState: AppStateStatus) => {
        if (nextState === "active" && pedometerAvailable) {
          if (isUsingHealthService()) {
            // Re-read from HealthKit / Health Connect
            try {
              const result = await healthGetSteps();
              setLiveSteps(result.steps);
            } catch {}
          } else {
            // Re-read from CMPedometer
            const steps = await getStepsSinceMidnight();
            if (steps !== liveSteps) {
              initialStepsRef.current = steps;
              setLiveSteps(steps);
              // Re-subscribe watcher to accumulate from new base
              if (subscriptionRef.current) {
                subscriptionRef.current.remove();
              }
              subscriptionRef.current = Pedometer.watchStepCount((result) => {
                setLiveSteps(steps + result.steps);
              });
            }
          }
          // Refresh backend data too
          fetchData();
        }
      }
    );

    return () => subscription.remove();
  }, [pedometerAvailable, liveSteps, fetchData]);

  // Keep ref in sync so the sync interval always reads the latest value
  useEffect(() => {
    liveStepsRef.current = liveSteps;
  }, [liveSteps]);

  // ─── Sync al backend cada 60 segundos ─────────────
  // Usa ref para leer el valor actual sin recrear el interval en cada cambio
  useEffect(() => {
    const syncInterval = setInterval(() => {
      if (liveStepsRef.current > 0) {
        stepsAPI.syncSteps(liveStepsRef.current).catch(() => {});
      }
    }, 60000);
    return () => clearInterval(syncInterval);
  }, []);


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

  // Trust pedometer as source of truth when available (matches Apple Fitness behavior)
  // Only fall back to backend value when pedometer hasn't reported yet
  const displaySteps = liveSteps > 0 ? liveSteps : (todayData?.steps ?? 0);
  const currentGoal = todayData?.goal ?? 8500;
  const pct = Math.min(100, Math.round((displaySteps / currentGoal) * 100));
  // Recalculate stats from displaySteps when pedometer is active,
  // so they stay consistent with the pedometer count (not the backend's stale value)
  const usingPedometer = liveSteps > 0;
  const calories = usingPedometer ? Math.round(displaySteps * 0.04) : (todayData?.calories ?? Math.round(displaySteps * 0.04));
  const distance = usingPedometer ? Math.round((displaySteps * 0.762) / 10) / 100 : (todayData?.distanceKm ?? Math.round((displaySteps * 0.762) / 10) / 100);
  const activeMin = usingPedometer ? Math.round(displaySteps / 100) : (todayData?.activeMinutes ?? Math.round(displaySteps / 100));
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

          {/* ─── Step source status ────────────────────── */}
          {!pedometerAvailable ? (
            <View className="bg-background-card border border-amber-500/20 rounded-2xl p-3 mb-4 flex-row items-center gap-x-2">
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text className="text-text-secondary text-xs flex-1">
                Podómetro no disponible. Los pasos se sincronizarán manualmente.
              </Text>
            </View>
          ) : stepSource !== "pedometer" ? (
            <View className="bg-background-card border border-green-500/20 rounded-2xl p-3 mb-4 flex-row items-center gap-x-2">
              <Ionicons name="heart-circle-outline" size={16} color="#00D48A" />
              <Text className="text-text-secondary text-xs flex-1">
                {stepSource === "healthkit" ? "Apple Health" : "Health Connect"} — mayor precisión
              </Text>
            </View>
          ) : Constants.appOwnership === "expo" ? (
            <View className="bg-background-card border border-blue-500/20 rounded-2xl p-3 mb-4 flex-row items-center gap-x-2">
              <Ionicons name="code-slash-outline" size={16} color="#00BFFF" />
              <Text className="text-text-secondary text-xs flex-1">
                Expo Development — en producción se usará Apple Health / Health Connect
              </Text>
            </View>
          ) : null}

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