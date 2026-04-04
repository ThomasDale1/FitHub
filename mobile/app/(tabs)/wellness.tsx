// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/wellness.tsx
// Wellness Dashboard — Readiness, Mood, Sleep, Quick Actions
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import {
  wellnessAPI,
  type WellnessDashboard,
  type TrainingSuggestion,
  type NutritionAdjustment,
} from "@/lib/api";
import type { InsightItem } from "@/components/wellness/InsightCard";
import ReadinessRing from "@/components/wellness/ReadinessRing";
import MoodCheckCard from "@/components/wellness/MoodCheckCard";
import SleepCard from "@/components/wellness/SleepCard";
import InsightCard from "@/components/wellness/InsightCard";
import TrainingSuggestionCard from "@/components/wellness/TrainingSuggestionCard";
import NutritionAdjustmentCard from "@/components/wellness/NutritionAdjustmentCard";

// ─── Mini stat pill ─────────────────────────────────
function MiniStat({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View
      className="flex-1 bg-background-card border border-background-elevated rounded-2xl px-3 py-2.5 items-center"
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text className="text-white font-bold text-sm mt-1">{value}</Text>
      <Text className="text-text-muted text-[10px] mt-0.5">{label}</Text>
    </View>
  );
}

export default function WellnessScreen() {
  const [data, setData] = useState<WellnessDashboard | null>(null);
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [trainingSuggestion, setTrainingSuggestion] = useState<TrainingSuggestion | null>(null);
  const [nutritionAdj, setNutritionAdj] = useState<NutritionAdjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      setError(false);
      const [dashRes, insightsRes, trainingRes, nutritionRes] = await Promise.all([
        wellnessAPI.getDashboard(),
        wellnessAPI.getInsights().catch(() => ({ data: { data: [] } })),
        wellnessAPI.getTrainingSuggestion().catch(() => null),
        wellnessAPI.getNutritionAdjustment().catch(() => null),
      ]);
      setData(dashRes.data.data);
      setInsights(Array.isArray(insightsRes.data.data) ? insightsRes.data.data : []);
      if (trainingRes) setTrainingSuggestion(trainingRes.data.data);
      if (nutritionRes) setNutritionAdj(nutritionRes.data.data);
    } catch (err) {
      console.error("Error fetching wellness dashboard:", err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboard();
  }, [fetchDashboard]);

  const handleMoodSubmit = async (moodData: {
    mood: number;
    energy: number;
    stress: number;
    note?: string;
  }) => {
    try {
      await wellnessAPI.logMood(moodData);
      // Refresh para obtener readiness recalculado
      await fetchDashboard();
    } catch (error) {
      console.error("Error logging mood:", error);
      // Show error to user
      Alert.alert("Error", "No se pudo registrar el ánimo. Intenta de nuevo.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#7B68EE"
          />
        }
      >
        <View className="px-5 pt-4 pb-8">
          {/* ─── HEADER ─────────────────────────────── */}
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-white text-2xl font-bold">Bienestar</Text>
            <TouchableOpacity
              className="bg-background-card border border-background-elevated rounded-2xl p-2.5"
              onPress={() => {
                // TODO: wellness settings
              }}
            >
              <Ionicons name="settings-outline" size={20} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* ─── LOADING ────────────────────────────── */}
          {loading && !data && (
            <ActivityIndicator
              color="#7B68EE"
              size="large"
              className="py-20"
            />
          )}

          {/* ─── ERROR ──────────────────────────────── */}
          {error && !data && (
            <TouchableOpacity
              className="bg-background-card border border-[#FF6B6B30] rounded-2xl p-4 mb-4 flex-row items-center gap-x-2"
              onPress={fetchDashboard}
            >
              <Ionicons name="cloud-offline-outline" size={18} color="#FF6B6B" />
              <Text className="text-text-secondary text-sm flex-1">
                No se pudo cargar el bienestar
              </Text>
              <Text className="text-sm font-bold" style={{ color: "#7B68EE" }}>
                Reintentar
              </Text>
            </TouchableOpacity>
          )}

          {data && (
            <>
              {/* ─── READINESS RING ───────────────────── */}
              <ReadinessRing
                score={data.readiness.score}
                zone={data.readiness.zone}
                recommendation={data.readiness.recommendation}
              />

              {/* ─── MINI STATS ROW ──────────────────── */}
              <View className="flex-row gap-x-2 mt-2 mb-5">
                <MiniStat
                  icon="moon-outline"
                  label="Sueño"
                  value={
                    data.sleep
                      ? `${Math.floor(data.sleep.duration / 60)}h${String(data.sleep.duration % 60).padStart(2, "0")}`
                      : "—"
                  }
                  color="#5B4FCF"
                />
                <MiniStat
                  icon="happy-outline"
                  label="Ánimo"
                  value={data.mood ? `${data.mood.mood}/5` : "—"}
                  color="#FFB347"
                />
                <MiniStat
                  icon="flash-outline"
                  label="Energía"
                  value={data.mood ? `${data.mood.energy}/5` : "—"}
                  color="#00D48A"
                />
                <MiniStat
                  icon="pulse-outline"
                  label="Estrés"
                  value={data.mood ? `${data.mood.stress}/5` : "—"}
                  color="#FF6B6B"
                />
              </View>

              {/* ─── MOOD CHECK ──────────────────────── */}
              <View className="mb-4">
                <MoodCheckCard
                  currentMood={data.mood}
                  onSubmit={handleMoodSubmit}
                />
              </View>

              {/* ─── SLEEP ───────────────────────────── */}
              <View className="mb-4">
                <SleepCard
                  todaySleep={data.sleep}
                  history={data.sleepHistory}
                  onLogSleep={() => router.push("/wellness/sleep-log" as any)}
                />
              </View>

              {/* ─── TRAINING SUGGESTION ────────────────── */}
              {trainingSuggestion && (
                <View className="mb-4">
                  <Text className="text-white font-bold text-base mb-3">
                    Sugerencia de entreno
                  </Text>
                  <TrainingSuggestionCard data={trainingSuggestion} />
                </View>
              )}

              {/* ─── NUTRITION ADJUSTMENT ────────────────── */}
              {nutritionAdj && (
                <View className="mb-4">
                  <Text className="text-white font-bold text-base mb-3">
                    Ajuste nutricional
                  </Text>
                  <NutritionAdjustmentCard data={nutritionAdj} />
                </View>
              )}

              {/* ─── QUICK ACTIONS ────────────────────── */}
              <Text className="text-white font-bold text-base mb-3">
                Acciones rápidas
              </Text>
              <View className="flex-row gap-x-3 mb-4">
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-4 items-center"
                  onPress={() => router.push("/wellness/breathing" as any)}
                >
                  <Text className="text-2xl mb-1">🫁</Text>
                  <Text className="text-white font-bold text-xs">Respirar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-4 items-center"
                  onPress={() => router.push("/wellness/journal" as any)}
                >
                  <Text className="text-2xl mb-1">📓</Text>
                  <Text className="text-white font-bold text-xs">Diario</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-4 items-center"
                  onPress={() => router.push("/wellness/recovery" as any)}
                >
                  <Text className="text-2xl mb-1">🔄</Text>
                  <Text className="text-white font-bold text-xs">Recovery</Text>
                </TouchableOpacity>
              </View>

              {/* ─── INSIGHTS ─────────────────────────── */}
              {insights.length > 0 ? (
                <View className="mb-4">
                  <View className="flex-row items-center justify-between mb-3">
                    <Text className="text-white font-bold text-base">
                      Insights
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        router.push("/wellness/weekly-report" as any)
                      }
                    >
                      <Text
                        className="text-xs font-bold"
                        style={{ color: "#7B68EE" }}
                      >
                        Reporte semanal →
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {insights.slice(0, 4).map((insight) => (
                    <InsightCard key={insight.id} insight={insight} />
                  ))}
                </View>
              ) : (
                <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
                  <View className="flex-row items-center gap-x-3 mb-2">
                    <View className="bg-[#7B68EE20] rounded-2xl p-2.5">
                      <Ionicons
                        name="analytics-outline"
                        size={20}
                        color="#7B68EE"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-bold text-sm">
                        Insights personalizados
                      </Text>
                      <Text className="text-text-muted text-xs mt-0.5">
                        Sigue loggeando para desbloquear correlaciones
                      </Text>
                    </View>
                  </View>
                  <View className="bg-background-elevated rounded-full h-2 mt-2">
                    <View
                      className="rounded-full h-2"
                      style={{
                        backgroundColor: "#7B68EE",
                        width: `${Math.min(100, ((data.sleepHistory.length + (data.mood ? 1 : 0)) / 14) * 100)}%`,
                      }}
                    />
                  </View>
                  <Text className="text-text-muted text-[10px] mt-1.5">
                    {Math.max(0, 14 - (data.sleepHistory.length + (data.mood ? 1 : 0)))} días más para
                    tus primeros insights
                  </Text>
                </View>
              )}

              {/* ─── JOURNAL STREAK ───────────────────── */}
              {data.streaks.journaling > 0 && (
                <View className="bg-background-card border border-background-elevated rounded-2xl p-4 flex-row items-center gap-x-3">
                  <Text className="text-2xl">📓</Text>
                  <View>
                    <Text className="text-white font-bold text-sm">
                      Diario: {data.streaks.journaling} días seguidos 🔥
                    </Text>
                    <Text className="text-text-muted text-xs">
                      Sigue escribiendo para mejores insights del AI Coach
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
