// ─────────────────────────────────────────────────────
// mobile/app/guild/[guildId].tsx
// Guild HQ — Pulse, Arena (Stats), Members, History
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { guildsAPI, guildWarsAPI } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Types ───────────────────────────────────────────
interface GuildData {
  id: string;
  name: string;
  tag: string;
  type: string;
  motto: string | null;
  description: string | null;
  colorPrimary: string;
  colorSecondary: string;
  level: number;
  xp: number;
  memberCount: number;
  maxMembers: number;
  nationalRank: number | null;
  isMember: boolean;
  myRole: string | null;
  place: { name: string; address?: string } | null;
  creator: { id: string; name: string; username: string; avatarUrl: string | null } | null;
}

interface WarBanner {
  warId: string;
  type: string;
  opponent: { id: string; name: string; tag: string; color: string };
  myScore: number;
  theirScore: number;
  myPct: number;
  daysLeft: number;
}

interface PulseData {
  activeTodayCount: number;
  totalMembers: number;
  avgStreak: number;
  totalVolume: number;
  totalSteps: number;
  warBanner: WarBanner | null;
}

interface HeatmapCell {
  week: number;
  day: number;
  dayName: string;
  date: string;
  pct: number;
}

interface MVP {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  volume: number;
}

interface ArenaData {
  rhythm: { day: string; count: number; pct: number }[];
  heatmap: HeatmapCell[];
  streakDistribution: Record<string, number>;
  radar: Record<string, number>;
  weeklyVolume: number;
  weeklySteps: number;
  volumeChange: number;
  stepsChange: number;
  mvp: MVP | null;
  stepsToday: number;
  stepsDailyGoal: number;
}

interface MemberData {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  level: number;
  streak: number;
  xp: number;
  workoutsCount: number;
  role: string;
  streakTier: string;
  rank: number;
}

interface Legend {
  title: string;
  subtitle: string;
  criterion: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

interface WarRecord { wins: number; losses: number; winRate: number; total: number }

interface WarHistoryItem {
  id: string;
  type: string;
  opponent: { name: string; tag: string };
  won: boolean;
  xpEarned: number;
  myScore: number;
  theirScore: number;
  endDate: string;
}

interface GrowthPoint { date: string; members: number; milestone?: string }

// ─── Configs ─────────────────────────────────────────
const STREAK_TIERS: Record<string, { icon: string; color: string; label: string }> = {
  INFERNO: { icon: "flame", color: "#F59E0B", label: "Inferno" },
  SURGE: { icon: "flash", color: "#3B82F6", label: "Surge" },
  IRON: { icon: "fitness", color: "#9CA3AF", label: "Iron" },
  SEEDLING: { icon: "leaf", color: "#22C55E", label: "Seedling" },
  FALLEN: { icon: "skull", color: "#6B6B80", label: "Fallen" },
};

const ROLE_COLORS: Record<string, string> = {
  FOUNDER: "#F59E0B",
  WARDEN: "#EF4444",
  CAPTAIN: "#3B82F6",
  MEMBER: "#6B6B80",
  RECRUIT: "#6B6B80",
};

const RADAR_LABELS: Record<string, { label: string; icon: string }> = {
  consistency: { label: "Consistencia", icon: "calendar" },
  strength: { label: "Fuerza", icon: "barbell" },
  endurance: { label: "Resistencia", icon: "walk" },
  activity: { label: "Actividad", icon: "pulse" },
  nutrition: { label: "Nutricion", icon: "restaurant" },
  growth: { label: "Crecimiento", icon: "trending-up" },
};

const LEGEND_ICONS: Record<string, { icon: string; color: string }> = {
  FOUNDER: { icon: "hammer", color: "#F59E0B" },
  BEST_STREAK_100: { icon: "flame", color: "#EF4444" },
  OLDEST_ACTIVE: { icon: "shield", color: "#6C63FF" },
  TOP_STREAK: { icon: "flash", color: "#3B82F6" },
  WAR_HERO: { icon: "trophy", color: "#22C55E" },
};

type Section = "pulse" | "arena" | "members" | "history";

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function GuildHQScreen() {
  const { guildId } = useLocalSearchParams<{ guildId: string }>();
  const [guild, setGuild] = useState<GuildData | null>(null);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [arena, setArena] = useState<ArenaData | null>(null);
  const [members, setMembers] = useState<MemberData[]>([]);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [legends, setLegends] = useState<Legend[]>([]);
  const [warRecord, setWarRecord] = useState<WarRecord | null>(null);
  const [warHistory, setWarHistory] = useState<WarHistoryItem[]>([]);
  const [growthTimeline, setGrowthTimeline] = useState<GrowthPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeSection, setActiveSection] = useState<Section>("pulse");

  const fetchAll = useCallback(async (retry = false) => {
    if (!guildId) return;
    setError(null);
    if (retry) setIsRetrying(true);
    try {
      const [guildRes, statsRes, membersRes, historyRes] = await Promise.all([
        guildsAPI.getById(guildId),
        guildsAPI.getStats(guildId),
        guildsAPI.getMembers(guildId),
        guildsAPI.getHistory(guildId),
      ]);
      setGuild(guildRes.data);
      setPulse(statsRes.data.pulse);
      setArena(statsRes.data.arena);
      setMembers(membersRes.data.members || []);
      setDistribution(membersRes.data.distribution || {});
      setLegends(historyRes.data.legends || []);
      setWarRecord(historyRes.data.warRecord || null);
      setWarHistory(historyRes.data.warHistory || []);
      setGrowthTimeline(historyRes.data.growthTimeline || []);
    } catch (err: any) {
      console.error("GuildHQ fetch error:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Error al cargar la guild";
      setError(errorMessage);
    } finally {
      if (retry) setIsRetrying(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
  }, [fetchAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchAll();
    } finally {
      setRefreshing(false);
    }
  }, [fetchAll]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-5">
        <Text className="text-red-400 text-center mb-4">{error}</Text>
        <TouchableOpacity
          onPress={async () => {
            await fetchAll(true)
          }}
          disabled={isRetrying}
          className={`bg-primary px-4 py-2 rounded-lg ${isRetrying ? "opacity-60" : ""}`}
          accessibilityLabel="Reintentar"
          accessibilityHint="Cargando, por favor espere"
          accessibilityState={{ busy: isRetrying }}
        >
          {isRetrying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text className="text-white font-bold">Reintentar</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!guild) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-text-muted">Guild no encontrada</Text>
      </SafeAreaView>
    );
  }

  const orbPct = pulse ? (pulse.activeTodayCount / Math.max(pulse.totalMembers, 1)) * 100 : 0;
  const orbColor = orbPct >= 80 ? "#EF4444" : orbPct >= 50 ? "#F59E0B" : orbPct >= 10 ? "#3B82F6" : "#6B6B80";
  const clampedPct = pulse?.warBanner ? Math.min(100, Math.max(0, pulse.warBanner.myPct)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ─── NAV BAR ────────────────────────────── */}
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View className="flex-1">
          <View className="flex-row items-center gap-x-2">
            <Text className="text-white font-bold text-lg">{guild.name}</Text>
            <View className="bg-white/10 rounded px-1.5 py-0.5">
              <Text className="text-text-muted text-[10px] font-bold">[{guild.tag}]</Text>
            </View>
          </View>
          {guild.motto && (
            <Text className="text-text-muted text-xs italic mt-1" numberOfLines={1}>
              {`"${guild.motto}"`}
            </Text>
          )}
        </View>
        {guild.myRole && ["FOUNDER", "WARDEN"].includes(guild.myRole) && (
          <TouchableOpacity className="p-1" onPress={() => router.push(`/guild/settings/${guild.id}` as any)}>
            <Ionicons name="settings-outline" size={20} color="#6B6B80" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── SECTION SWITCHER (4 tabs) ─────────── */}
      <View className="flex-row mx-5 mb-3 bg-background-card rounded-xl p-1">
        {(["pulse", "arena", "members", "history"] as const).map((s) => {
          const labels: Record<Section, string> = { pulse: "Pulso", arena: "Arena", members: "Miembros", history: "Legado" };
          const icons: Record<Section, string> = { pulse: "pulse", arena: "stats-chart", members: "people", history: "trophy" };
          return (
            <TouchableOpacity
              key={s}
              className={`flex-1 rounded-lg py-1.5 items-center ${activeSection === s ? "bg-primary" : ""}`}
              onPress={() => setActiveSection(s)}
            >
              <Ionicons name={icons[s] as any} size={12} color={activeSection === s ? "#FFFFFF" : "#6B6B80"} />
              <Text className={`text-[9px] font-bold mt-0.5 ${activeSection === s ? "text-white" : "text-text-muted"}`}>
                {labels[s]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─── CONTENT ────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
        className="flex-1 px-5"
      >
        {/* ═══════ PULSE ═══════ */}
        {activeSection === "pulse" && pulse && (
          <View>
            {/* Activity Orb */}
            <View className="items-center py-6">
              <View
                className="w-36 h-36 rounded-full items-center justify-center"
                style={{
                  backgroundColor: orbColor + "15",
                  borderWidth: 3,
                  borderColor: orbColor,
                  shadowColor: orbColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 20,
                  elevation: 10,
                }}
              >
                <Text className="text-white text-3xl font-bold">
                  {pulse.activeTodayCount}
                </Text>
                <Text className="text-text-muted text-[10px]">
                  de {pulse.totalMembers} activos
                </Text>
              </View>
              <Text className="text-text-muted text-xs mt-3">
                {Math.round(orbPct)}% de la guild activa hoy
              </Text>
            </View>

            {/* War Banner (if active war) */}
            {pulse.warBanner && (
              <TouchableOpacity
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4"
                onPress={() => router.push(`/guild/war/${pulse.warBanner!.warId}` as any)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center mb-2">
                  <Ionicons name="flash" size={16} color="#EF4444" />
                  <Text className="text-red-400 font-bold text-sm ml-1">GUERRA ACTIVA</Text>
                  <Text className="text-red-300 text-[10px] ml-auto">
                    {pulse.warBanner.daysLeft}d restantes
                  </Text>
                </View>
                <View className="h-3 bg-background-elevated rounded-full overflow-hidden flex-row">
                  <View
                    className="h-full rounded-l-full"
                    style={{
                      width: `${clampedPct}%`,
                      backgroundColor: guild.colorPrimary,
                    }}
                  />
                  <View
                    className="h-full rounded-r-full"
                    style={{
                      width: `${100 - clampedPct}%`,
                      backgroundColor: pulse.warBanner.opponent.color,
                    }}
                  />
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-text-muted text-[10px]">{pulse.warBanner.myScore} WP</Text>
                  <Text className="text-white text-[10px] font-bold">{pulse.warBanner.myPct}%</Text>
                  <Text className="text-text-muted text-[10px]">{pulse.warBanner.theirScore} WP</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Quick Stats Grid */}
            <View className="flex-row flex-wrap gap-3 mb-4">
              <StatPill icon="flame" color="#F59E0B" label="Racha Prom." value={`${pulse.avgStreak}d`} />
              <StatPill
                icon="trophy"
                color="#6C63FF"
                label="Rank Nacional"
                value={guild.nationalRank ? `#${guild.nationalRank}` : "—"}
              />
              <StatPill icon="barbell" color="#EF4444" label="Vol. Semanal" value={formatVolume(pulse.totalVolume)} />
              <StatPill icon="footsteps" color="#22C55E" label="Pasos Sem." value={formatSteps(pulse.totalSteps)} />
            </View>

            {/* Guild Info */}
            <View className="bg-background-card rounded-2xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white font-bold text-sm">Info</Text>
                <Text className="text-amber-400 text-xs font-bold">Lv.{guild.level}</Text>
              </View>
              {guild.place && (
                <View className="flex-row items-center mb-1">
                  <Ionicons name="location-outline" size={12} color="#6B6B80" />
                  <Text className="text-text-secondary text-xs ml-1">{guild.place.name}</Text>
                </View>
              )}
              <View className="flex-row items-center mb-1">
                <Ionicons name="people-outline" size={12} color="#6B6B80" />
                <Text className="text-text-secondary text-xs ml-1">
                  {guild.memberCount}/{guild.maxMembers} miembros
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={12} color="#6B6B80" />
                <Text className="text-text-secondary text-xs ml-1">
                  Fundada por @{guild.creator?.username ?? "desconocido"}
                </Text>
              </View>
            </View>

            {/* Challenge CTA (if Founder/Warden and no active war) */}
            {guild.isMember && guild.myRole && ["FOUNDER", "WARDEN"].includes(guild.myRole) && !pulse.warBanner && (
              <TouchableOpacity
                className="bg-red-500/10 border border-red-500/30 rounded-2xl py-3 items-center mb-4"
                onPress={() => router.push(`/guild/war/challenge?guildId=${guild.id}` as any)}
              >
                <View className="flex-row items-center">
                  <Ionicons name="flash" size={16} color="#EF4444" />
                  <Text className="text-red-400 font-bold text-sm ml-1">Lanzar Guerra</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ═══════ ARENA (Stats) ═══════ */}
        {activeSection === "arena" && arena && (
          <View>
            {/* Weekly Rhythm (Activity Wave) */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <Text className="text-white font-bold text-sm mb-3">Ritmo Semanal</Text>
              <View className="flex-row justify-between items-end" style={{ height: 80 }}>
                {arena.rhythm.map((day, i) => (
                  <View key={i} className="items-center flex-1">
                    <View
                      className="rounded-t-md"
                      style={{
                        width: 20,
                        height: Math.max(4, (day.pct / 100) * 60),
                        backgroundColor: day.pct >= 80 ? "#22C55E" : day.pct >= 50 ? "#F59E0B" : day.pct >= 10 ? "#3B82F6" : "#374151",
                        opacity: day.pct > 0 ? 1 : 0.3,
                      }}
                    />
                    <Text className="text-text-muted text-[9px] mt-1">{day.day}</Text>
                    <Text className="text-text-muted text-[8px]">{day.pct}%</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Consistency Heatmap (GitHub-style) */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <Text className="text-white font-bold text-sm mb-3">Mapa de Consistencia</Text>
              <View className="flex-row justify-between mb-1">
                {["Sem 1", "Sem 2", "Sem 3", "Sem 4"].map((w, i) => (
                  <Text key={i} className="text-text-muted text-[8px] flex-1 text-center">{w}</Text>
                ))}
              </View>
              {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => (
                <View key={dayIdx} className="flex-row items-center mb-1">
                  <Text className="text-text-muted text-[8px] w-6">
                    {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"][dayIdx]}
                  </Text>
                  {[0, 1, 2, 3].map((weekIdx) => {
                    const cell = arena.heatmap?.find((h) => h.week === weekIdx && h.day === dayIdx);
                    const pct = cell?.pct || 0;
                    const bgColor = pct >= 70 ? "#22C55E" : pct >= 40 ? "#F59E0B" : pct > 0 ? "#374151" : "#1F2937";
                    return (
                      <View
                        key={weekIdx}
                        className="flex-1 mx-0.5 rounded-sm items-center justify-center"
                        style={{ height: 18, backgroundColor: bgColor }}
                      >
                        {pct > 0 && (
                          <Text className="text-white text-[7px] font-bold">{pct}%</Text>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
              <View className="flex-row items-center justify-end mt-2 gap-x-2">
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#1F2937" }} />
                  <Text className="text-text-muted text-[8px]">0%</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#374151" }} />
                  <Text className="text-text-muted text-[8px]">&lt;40%</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#F59E0B" }} />
                  <Text className="text-text-muted text-[8px]">40-70%</Text>
                </View>
                <View className="flex-row items-center">
                  <View className="w-2.5 h-2.5 rounded-sm mr-1" style={{ backgroundColor: "#22C55E" }} />
                  <Text className="text-text-muted text-[8px]">&gt;70%</Text>
                </View>
              </View>
            </View>

            {/* Streak Distribution (RPG Tiers) */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <Text className="text-white font-bold text-sm mb-3">Rangos de Racha</Text>
              {Object.entries(STREAK_TIERS).map(([key, tier]) => {
                const count = distribution[key.toLowerCase()] || arena.streakDistribution[key.toLowerCase()] || 0;
                const total = members.length || pulse?.totalMembers || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <View key={key} className="flex-row items-center mb-2">
                    <Ionicons name={tier.icon as any} size={14} color={tier.color} />
                    <Text className="text-white text-xs ml-2 w-16">{tier.label}</Text>
                    <View className="flex-1 h-3 bg-background-elevated rounded-full mx-2 overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: tier.color }}
                      />
                    </View>
                    <Text className="text-text-muted text-[10px] w-8 text-right">{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Guild Radar (DNA) */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <Text className="text-white font-bold text-sm mb-3">DNA de la Guild</Text>
              {Object.entries(RADAR_LABELS).map(([key, conf]) => {
                const value = arena.radar[key] || 0;
                const barColor = value >= 70 ? "#22C55E" : value >= 40 ? "#F59E0B" : "#6C63FF";
                return (
                  <View key={key} className="flex-row items-center mb-2.5">
                    <Ionicons name={conf.icon as any} size={14} color={barColor} />
                    <Text className="text-text-secondary text-xs ml-2 w-24">{conf.label}</Text>
                    <View className="flex-1 h-2.5 bg-background-elevated rounded-full mx-2 overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${value}%`, backgroundColor: barColor }}
                      />
                    </View>
                    <Text className="text-white text-[10px] font-bold w-8 text-right">{value}</Text>
                  </View>
                );
              })}
            </View>

            {/* Volume + Steps with WoW comparison */}
            <View className="flex-row gap-3 mb-3">
              <View className="flex-1 bg-background-card rounded-2xl p-4">
                <Ionicons name="barbell-outline" size={18} color="#EF4444" />
                <Text className="text-white font-bold text-lg mt-1">
                  {formatVolume(arena.weeklyVolume)}
                </Text>
                <Text className="text-text-muted text-[10px]">Vol. esta semana</Text>
                {arena.volumeChange !== 0 && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons
                      name={arena.volumeChange > 0 ? "arrow-up" : "arrow-down"}
                      size={10}
                      color={arena.volumeChange > 0 ? "#22C55E" : "#EF4444"}
                    />
                    <Text
                      className="text-[10px] ml-0.5 font-bold"
                      style={{ color: arena.volumeChange > 0 ? "#22C55E" : "#EF4444" }}
                    >
                      {Math.abs(arena.volumeChange)}% vs semana pasada
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-1 bg-background-card rounded-2xl p-4">
                <Ionicons name="footsteps-outline" size={18} color="#22C55E" />
                <Text className="text-white font-bold text-lg mt-1">
                  {formatSteps(arena.weeklySteps)}
                </Text>
                <Text className="text-text-muted text-[10px]">Pasos esta semana</Text>
                {arena.stepsChange !== 0 && (
                  <View className="flex-row items-center mt-1">
                    <Ionicons
                      name={arena.stepsChange > 0 ? "arrow-up" : "arrow-down"}
                      size={10}
                      color={arena.stepsChange > 0 ? "#22C55E" : "#EF4444"}
                    />
                    <Text
                      className="text-[10px] ml-0.5 font-bold"
                      style={{ color: arena.stepsChange > 0 ? "#22C55E" : "#EF4444" }}
                    >
                      {Math.abs(arena.stepsChange)}% vs semana pasada
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Steps Odometer */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-white font-bold text-sm">Pasos Hoy (Guild)</Text>
                <Text className="text-text-muted text-[10px]">
                  Meta: {formatSteps(arena.stepsDailyGoal)}
                </Text>
              </View>
              <Text className="text-white font-bold text-2xl mb-2">{formatSteps(arena.stepsToday)}</Text>
              <View className="h-3 bg-background-elevated rounded-full overflow-hidden">
                <View
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${Math.min(100, Math.round((arena.stepsToday / Math.max(arena.stepsDailyGoal, 1)) * 100))}%` }}
                />
              </View>
              <Text className="text-text-muted text-[10px] mt-1">
                {Math.round((arena.stepsToday / Math.max(arena.stepsDailyGoal, 1)) * 100)}% de la meta diaria
              </Text>
            </View>

            {/* MVP of the Week */}
            {arena.mvp && (
              <View className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 mb-3">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text className="text-amber-400 font-bold text-sm ml-1">MVP de la Semana</Text>
                </View>
                <TouchableOpacity
                  className="flex-row items-center"
                  onPress={() => router.push(`/profile/${arena.mvp!.id}` as any)}
                >
                  {arena.mvp.avatarUrl ? (
                    <Image source={{ uri: arena.mvp.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                  ) : (
                    <View className="bg-amber-500/20 rounded-full w-8 h-8 items-center justify-center">
                      <Text className="text-amber-400 font-bold text-sm">{arena.mvp.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View className="ml-2">
                    <Text className="text-white font-bold text-xs">{arena.mvp.name}</Text>
                    <Text className="text-text-muted text-[10px]">{formatVolume(arena.mvp.volume)} esta semana</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ═══════ MEMBERS ═══════ */}
        {activeSection === "members" && (
          <View>
            {/* Streak Distribution Quick */}
            <View className="flex-row gap-2 mb-3 flex-wrap">
              {Object.entries(STREAK_TIERS).map(([key, tier]) => {
                const count = distribution[key.toLowerCase()] || 0;
                return (
                  <View key={key} className="flex-row items-center bg-background-card rounded-lg px-2 py-1">
                    <Ionicons name={tier.icon as any} size={10} color={tier.color} />
                    <Text className="text-text-muted text-[10px] ml-1">{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Member List (ranked by streak) */}
            {members.map((m) => {
              const tier = STREAK_TIERS[m.streakTier] || STREAK_TIERS.FALLEN;
              const roleColor = ROLE_COLORS[m.role] || "#6B6B80";

              return (
                <TouchableOpacity
                  key={m.id}
                  className="bg-background-card border border-background-elevated rounded-2xl p-3 mb-2 flex-row items-center"
                  onPress={() => router.push(`/profile/${m.id}` as any)}
                  activeOpacity={0.7}
                >
                  {/* Rank */}
                  <View className="w-7 items-center">
                    {m.rank <= 3 ? (
                      <Ionicons
                        name={m.rank === 1 ? "medal" : "medal-outline"}
                        size={14}
                        color={m.rank === 1 ? "#F59E0B" : m.rank === 2 ? "#C0C0C0" : "#CD7F32"}
                      />
                    ) : (
                      <Text className="text-text-muted text-xs font-bold">#{m.rank}</Text>
                    )}
                  </View>

                  {/* Avatar */}
                  {m.avatarUrl ? (
                    <Image source={{ uri: m.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                  ) : (
                    <View className="bg-primary/20 rounded-full w-9 h-9 items-center justify-center">
                      <Text className="text-primary font-bold text-sm">{m.name.charAt(0)}</Text>
                    </View>
                  )}

                  {/* Info */}
                  <View className="ml-2 flex-1">
                    <View className="flex-row items-center gap-x-1">
                      <Text className="text-white font-bold text-xs">{m.name}</Text>
                      {m.role !== "MEMBER" && m.role !== "RECRUIT" && (
                        <Text style={{ color: roleColor }} className="text-[9px] font-bold">
                          {m.role}
                        </Text>
                      )}
                    </View>
                    <Text className="text-text-muted text-[10px]">
                      Lv.{m.level} · {m.workoutsCount} workouts
                    </Text>
                  </View>

                  {/* Streak + Tier */}
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <Ionicons name={tier.icon as any} size={12} color={tier.color} />
                      <Text style={{ color: tier.color }} className="text-xs font-bold ml-1">
                        {m.streak}d
                      </Text>
                    </View>
                    <Text style={{ color: tier.color }} className="text-[9px]">
                      {tier.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ═══════ HISTORY (Legacy) ═══════ */}
        {activeSection === "history" && (
          <View>
            {/* Hall of Legends */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <View className="flex-row items-center mb-3">
                <Ionicons name="star" size={16} color="#F59E0B" />
                <Text className="text-white font-bold text-sm ml-2">Hall of Legends</Text>
              </View>
              {legends.length === 0 ? (
                <Text className="text-text-muted text-xs text-center py-4">
                  Aún no hay leyendas. Sigue adelante.
                </Text>
              ) : (
                legends.map((legend, i) => {
                  const lConf = LEGEND_ICONS[legend.criterion] || { icon: "star", color: "#F59E0B" };
                  return (
                    <TouchableOpacity
                      key={i}
                      className="flex-row items-center mb-3"
                      onPress={() => router.push(`/profile/${legend.userId}` as any)}
                    >
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: lConf.color + "20", borderWidth: 1, borderColor: lConf.color + "40" }}
                      >
                        <Ionicons name={lConf.icon as any} size={18} color={lConf.color} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-white font-bold text-xs">{legend.title}</Text>
                        <Text className="text-text-muted text-[10px]">{legend.subtitle}</Text>
                      </View>
                      <View className="flex-row items-center">
                        {legend.avatarUrl ? (
                          <Image source={{ uri: legend.avatarUrl }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                        ) : (
                          <View className="bg-primary/20 rounded-full w-6 h-6 items-center justify-center">
                            <Text className="text-primary text-[10px] font-bold">{legend.name.charAt(0)}</Text>
                          </View>
                        )}
                        <Text className="text-text-secondary text-[10px] ml-1">@{legend.username}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* War Record */}
            <View className="bg-background-card rounded-2xl p-4 mb-3">
              <View className="flex-row items-center mb-3">
                <Ionicons name="flash" size={16} color="#EF4444" />
                <Text className="text-white font-bold text-sm ml-2">Historial de Guerras</Text>
              </View>
              {warRecord && warRecord.total > 0 ? (
                <>
                  {/* Record summary */}
                  <View className="flex-row items-center justify-around mb-4">
                    <View className="items-center">
                      <Text className="text-green-400 font-bold text-2xl">{warRecord.wins}</Text>
                      <Text className="text-text-muted text-[10px]">Victorias</Text>
                    </View>
                    <Text className="text-text-muted text-lg">-</Text>
                    <View className="items-center">
                      <Text className="text-red-400 font-bold text-2xl">{warRecord.losses}</Text>
                      <Text className="text-text-muted text-[10px]">Derrotas</Text>
                    </View>
                    <View className="items-center">
                      <Text className="text-white font-bold text-lg">{warRecord.winRate}%</Text>
                      <Text className="text-text-muted text-[10px]">Winrate</Text>
                    </View>
                  </View>

                  {/* War list */}
                  {warHistory.slice(0, 10).map((w) => (
                    <View
                      key={w.id}
                      className="flex-row items-center py-2 border-b border-background-elevated"
                    >
                      <Ionicons
                        name={w.won ? "checkmark-circle" : "close-circle"}
                        size={16}
                        color={w.won ? "#22C55E" : "#EF4444"}
                      />
                      <View className="ml-2 flex-1">
                        <Text className="text-white text-xs">
                          vs {w.opponent.name} [{w.opponent.tag}]
                        </Text>
                        <Text className="text-text-muted text-[10px]">
                          {w.myScore} - {w.theirScore} · {w.type.replace("_", " ")}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-xs font-bold ${w.won ? "text-green-400" : "text-red-400"}`}>
                          {w.won ? "VICTORIA" : "DERROTA"}
                        </Text>
                        <Text className="text-text-muted text-[10px]">+{w.xpEarned} XP</Text>
                      </View>
                    </View>
                  ))}
                </>
              ) : (
                <Text className="text-text-muted text-xs text-center py-4">
                  No hay guerras completadas aún
                </Text>
              )}
            </View>

            {/* Growth Timeline */}
            <View className="bg-background-card rounded-2xl p-4 mb-4">
              <View className="flex-row items-center mb-3">
                <Ionicons name="trending-up" size={16} color="#6C63FF" />
                <Text className="text-white font-bold text-sm ml-2">Crecimiento</Text>
              </View>
              {growthTimeline.map((point, i) => (
                <View key={i} className="flex-row items-center mb-2">
                  <View className="w-2 h-2 rounded-full bg-primary mr-2" />
                  <View className="flex-1 border-l border-primary/20 pl-3 pb-2">
                    <Text className="text-white text-xs">
                      {point.milestone || `${point.members} miembros`}
                    </Text>
                    <Text className="text-text-muted text-[10px]">{point.date}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Helper Components ───────────────────────────────
function StatPill({ icon, color, label, value }: { icon: string; color: string; label: string; value: string }) {
  return (
    <View className="bg-background-card rounded-xl p-3 flex-1" style={{ minWidth: (SCREEN_WIDTH - 56) / 2 }}>
      <Ionicons name={icon as any} size={16} color={color} />
      <Text className="text-white font-bold text-base mt-1">{value}</Text>
      <Text className="text-text-muted text-[10px]">{label}</Text>
    </View>
  );
}

function formatVolume(kg: number): string {
  if (kg >= 1000000) return `${(kg / 1000000).toFixed(1)}M kg`;
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}K kg`;
  return `${Math.round(kg)} kg`;
}

function formatSteps(steps: number): string {
  if (steps >= 1000000) return `${(steps / 1000000).toFixed(1)}M`;
  if (steps >= 1000) return `${(steps / 1000).toFixed(1)}K`;
  return `${steps}`;
}
