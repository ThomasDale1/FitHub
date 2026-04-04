// ─────────────────────────────────────────────────────
// mobile/app/wellness/weekly-report.tsx
// Weekly Wellness Report — resumen semanal con trends
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { wellnessAPI, type WeeklyReportData } from "@/lib/api";

// ─── Trend arrow component ──────────────────────────
function TrendBadge({ trend }: { trend: "UP" | "DOWN" | "STABLE" }) {
  const config = {
    UP: { icon: "trending-up" as const, color: "#00D48A", label: "Subió" },
    DOWN: { icon: "trending-down" as const, color: "#FF6B6B", label: "Bajó" },
    STABLE: { icon: "remove" as const, color: "#6B6B80", label: "Estable" },
  }
  const c = config[trend]
  return (
    <View className="flex-row items-center gap-x-1">
      <Ionicons name={c.icon} size={14} color={c.color} />
      <Text className="text-[10px] font-semibold" style={{ color: c.color }}>
        {c.label}
      </Text>
    </View>
  );
}

// ─── Stat card ──────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  emoji,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
  trend?: "UP" | "DOWN" | "STABLE";
}) {
  return (
    <View className="flex-1 bg-background-card border border-background-elevated rounded-2xl p-3 items-center">
      <Text className="text-lg mb-1">{emoji}</Text>
      <Text className="text-white font-bold text-base">{value}</Text>
      <Text className="text-text-muted text-[10px] mt-0.5">{label}</Text>
      {sub && (
        <Text className="text-text-muted text-[9px]">{sub}</Text>
      )}
      {trend && (
        <View className="mt-1">
          <TrendBadge trend={trend} />
        </View>
      )}
    </View>
  );
}

export default function WeeklyReportScreen() {
  const [report, setReport] = useState<WeeklyReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const fetchReport = useCallback(async () => {
    try {
      setError(false);
      const res = await wellnessAPI.getWeeklyReport();
      setReport(res.data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchReport();
    }, [fetchReport])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchReport();
  }, [fetchReport]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00Z");
    return d.toLocaleDateString("es", { day: "numeric", month: "short" });
  };

  const fmtHM = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h${String(m).padStart(2, "0")}`;
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
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
          {/* Header */}
          <View className="flex-row items-center gap-x-3 mb-5">
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-background-card border border-background-elevated rounded-2xl p-2.5"
            >
              <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">
                Reporte Semanal
              </Text>
              {report && (
                <Text className="text-text-muted text-xs">
                  {formatDate(report.period.start)} — {formatDate(report.period.end)}
                </Text>
              )}
            </View>
            <View className="bg-[#7B68EE20] rounded-2xl p-2.5">
              <Ionicons name="analytics-outline" size={20} color="#7B68EE" />
            </View>
          </View>

          {/* Loading */}
          {loading && (
            <ActivityIndicator color="#7B68EE" size="large" className="py-20" />
          )}

          {/* Error */}
          {error && !report && (
            <TouchableOpacity
              className="bg-background-card border border-[#FF6B6B30] rounded-2xl p-4 flex-row items-center gap-x-2"
              onPress={() => {
                setLoading(true);
                setError(false);
                fetchReport();
              }}
            >
              <Ionicons name="cloud-offline-outline" size={18} color="#FF6B6B" />
              <Text className="text-text-secondary text-sm flex-1">
                No se pudo cargar el reporte
              </Text>
              <Text className="text-sm font-bold" style={{ color: "#7B68EE" }}>
                Reintentar
              </Text>
            </TouchableOpacity>
          )}

          {report && (
            <>
              {/* ─── Top Insight ───────────────────────── */}
              <View className="bg-background-card border border-[#7B68EE30] rounded-3xl p-4 mb-5">
                <View className="flex-row items-center gap-x-2 mb-2">
                  <Ionicons name="sparkles" size={16} color="#7B68EE" />
                  <Text className="text-white font-bold text-sm">
                    Insight de la semana
                  </Text>
                </View>
                <Text className="text-text-secondary text-sm leading-5">
                  {report.topInsight}
                </Text>
              </View>

              {/* ─── Key Stats Grid ───────────────────── */}
              <Text className="text-white font-bold text-base mb-3">
                Resumen
              </Text>

              {/* Row 1: Readiness + Sleep */}
              <View className="flex-row gap-x-2 mb-2">
                <StatCard
                  emoji="🎯"
                  label="Readiness"
                  value={`${report.summary.avgReadiness}`}
                  sub="promedio"
                  trend={report.trends.readiness}
                />
                <StatCard
                  emoji="😴"
                  label="Sueño"
                  value={report.summary.avgSleep > 0 ? fmtHM(report.summary.avgSleep) : "—"}
                  sub="promedio"
                  trend={report.trends.sleep}
                />
              </View>

              {/* Row 2: Mood + Workouts */}
              <View className="flex-row gap-x-2 mb-2">
                <StatCard
                  emoji="😊"
                  label="Ánimo"
                  value={report.summary.avgMood > 0 ? `${report.summary.avgMood}/5` : "—"}
                  trend={report.trends.mood}
                />
                <StatCard
                  emoji="🏋️"
                  label="Entrenos"
                  value={`${report.summary.totalWorkouts}`}
                  sub={report.summary.totalVolume > 0 ? `${Math.round(report.summary.totalVolume / 1000)}t vol` : undefined}
                  trend={report.trends.volume}
                />
              </View>

              {/* Row 3: Energy + Stress + Breathing */}
              <View className="flex-row gap-x-2 mb-5">
                <StatCard
                  emoji="⚡"
                  label="Energía"
                  value={report.summary.avgEnergy > 0 ? `${report.summary.avgEnergy}/5` : "—"}
                />
                <StatCard
                  emoji="🧘"
                  label="Estrés"
                  value={report.summary.avgStress > 0 ? `${report.summary.avgStress}/5` : "—"}
                />
                <StatCard
                  emoji="🫁"
                  label="Respiración"
                  value={`${report.summary.totalBreathingMin}m`}
                />
              </View>

              {/* ─── Trends Detail ────────────────────── */}
              <Text className="text-white font-bold text-base mb-3">
                Tendencias vs semana anterior
              </Text>
              <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-5">
                {(
                  [
                    { key: "readiness", label: "Readiness", emoji: "🎯" },
                    { key: "sleep", label: "Sueño", emoji: "😴" },
                    { key: "mood", label: "Ánimo", emoji: "😊" },
                    { key: "volume", label: "Volumen", emoji: "🏋️" },
                  ] as const
                ).map((item, idx) => (
                  <View
                    key={item.key}
                    className={`flex-row items-center justify-between py-2.5 ${idx < 3 ? "border-b border-background-elevated" : ""}`}
                  >
                    <View className="flex-row items-center gap-x-2">
                      <Text className="text-sm">{item.emoji}</Text>
                      <Text className="text-white text-sm">{item.label}</Text>
                    </View>
                    <TrendBadge trend={report.trends[item.key]} />
                  </View>
                ))}
              </View>

              {/* ─── Highlights ────────────────────────── */}
              {report.highlights.length > 0 && (
                <>
                  <Text className="text-white font-bold text-base mb-3">
                    Highlights
                  </Text>
                  <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-5">
                    {report.highlights.map((h, idx) => (
                      <View
                        key={idx}
                        className="flex-row items-center gap-x-2 py-1.5"
                      >
                        <View
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: "#7B68EE" }}
                        />
                        <Text className="text-text-secondary text-sm">
                          {h}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* ─── Quick Actions ─────────────────────── */}
              <View className="flex-row gap-x-3">
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-3 items-center"
                  onPress={() => router.push("/wellness/journal" as any)}
                >
                  <Text className="text-sm mb-0.5">📓</Text>
                  <Text className="text-white font-bold text-[11px]">
                    Escribir diario
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-3 items-center"
                  onPress={() => router.push("/wellness/breathing" as any)}
                >
                  <Text className="text-sm mb-0.5">🫁</Text>
                  <Text className="text-white font-bold text-[11px]">
                    Respirar
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-background-card border border-background-elevated rounded-2xl py-3 items-center"
                  onPress={() => router.push("/wellness/recovery" as any)}
                >
                  <Text className="text-sm mb-0.5">🔄</Text>
                  <Text className="text-white font-bold text-[11px]">
                    Recovery
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
