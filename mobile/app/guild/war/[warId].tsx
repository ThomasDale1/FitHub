// ─────────────────────────────────────────────────────
// mobile/app/guild/war/[warId].tsx
// War Detail — Live scoreboard, contributions, leaderboard
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
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useLocalSearchParams, router } from "expo-router";
import { guildWarsAPI } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";

const withOpacity = (hex: string, opacity: number): string => {
  // Normalize hex to 6 digits
  let normalized = hex.replace('#', '');
  if (normalized.length === 3) {
    normalized = normalized.split('').map(c => c + c).join('');
  }
  if (normalized.length !== 6) {
    return hex; // fallback
  }
  const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
  return `#${normalized}${alpha}`;
};

interface GuildInfo {
  id: string;
  name: string;
  tag: string;
  colorPrimary: string;
  memberCount: number;
  score: number;
  activeContributors: number;
}

interface LeaderEntry {
  rank: number;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  guildId: string;
  totalWP: number;
}

interface WarDetail {
  id: string;
  type: string;
  status: string;
  challenger: GuildInfo;
  defender: GuildInfo;
  winnerGuildId: string | null;
  mvpUserId: string | null;
  durationDays: number;
  daysLeft: number;
  startDate: string | null;
  endDate: string | null;
  leaderboard: LeaderEntry[];
}

const WAR_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  TOTAL_WAR: { label: "Total War", icon: "flash", color: "#EF4444" },
  IRON_CLASH: { label: "Iron Clash", icon: "barbell", color: "#F59E0B" },
  MARATHON: { label: "Marathon", icon: "walk", color: "#22C55E" },
  CONSISTENCY: { label: "Consistency", icon: "calendar", color: "#6C63FF" },
};

export default function WarDetailScreen() {
  const { warId } = useLocalSearchParams<{ warId: string }>();
  const [war, setWar] = useState<WarDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [warError, setWarError] = useState<string | null>(null);

  const fetchWar = useCallback(async () => {
    if (!warId) return;
    setWarError(null);
    try {
      const res = await guildWarsAPI.getDetails(warId);
      setWar(res.data);
    } catch (err: any) {
      console.error("War detail error:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Error al cargar la guerra";
      setWarError(errorMessage);
    }
  }, [warId]);

  useEffect(() => {
    fetchWar().finally(() => setLoading(false));
  }, [fetchWar]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWar();
    setRefreshing(false);
  }, [fetchWar]);

  const handleSync = async () => {
    if (!warId) return;
    setSyncing(true);
    try {
      await guildWarsAPI.syncContribution(warId);
      await fetchWar();
    } catch (err: any) {
      console.error("Sync error:", err?.response?.data?.error || err);
      const errorMessage = err?.response?.data?.error || "Error al sincronizar contribuciones";
      Alert.alert("Error", errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  if (warError) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center px-5">
        <Text className="text-red-400 text-center mb-4">{warError}</Text>
        <TouchableOpacity
          onPress={fetchWar}
          className="bg-primary px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!war) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-text-muted">Guerra no encontrada</Text>
      </SafeAreaView>
    );
  }

  const typeConf = WAR_TYPE_LABELS[war.type] || WAR_TYPE_LABELS.TOTAL_WAR;
  const totalScore = war.challenger.score + war.defender.score;
  const challengerPct = totalScore > 0 ? Math.round((war.challenger.score / totalScore) * 100) : 50;
  const defenderPct = 100 - challengerPct;
  const isCompleted = war.status === "COMPLETED";

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Ionicons name={typeConf.icon as any} size={18} color={typeConf.color} />
        <Text className="text-white text-lg font-bold ml-2">{typeConf.label}</Text>
        {!isCompleted && (
          <View className="ml-auto bg-red-500/20 rounded-lg px-2 py-1">
            <Text className="text-red-400 text-[10px] font-bold">
              {war.daysLeft}d restantes
            </Text>
          </View>
        )}
        {isCompleted && (
          <View className="ml-auto bg-green-500/20 rounded-lg px-2 py-1">
            <Text className="text-green-400 text-[10px] font-bold">COMPLETADA</Text>
          </View>
        )}
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
      >
        {/* ─── SCOREBOARD ──────────────────────────── */}
        <View className="bg-background-card rounded-2xl p-5 mb-4 mt-2">
          {/* Guild names row */}
          <View className="flex-row items-center justify-between mb-4">
            <View className="items-center flex-1">
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center mb-1"
                style={{ backgroundColor: withOpacity(war.challenger.colorPrimary, 0.125) }}
              >
                <Ionicons name="shield" size={28} color={war.challenger.colorPrimary} />
              </View>
              <Text className="text-white font-bold text-xs">{war.challenger.name}</Text>
              <Text className="text-text-muted text-[10px]">[{war.challenger.tag}]</Text>
            </View>

            <View className="items-center px-4">
              <Text className="text-text-muted text-[10px] mb-1">VS</Text>
              <View className="flex-row items-baseline">
                <Text className="text-white font-bold text-2xl">{war.challenger.score}</Text>
                <Text className="text-text-muted text-lg mx-1">:</Text>
                <Text className="text-white font-bold text-2xl">{war.defender.score}</Text>
              </View>
            </View>

            <View className="items-center flex-1">
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center mb-1"
                style={{ backgroundColor: withOpacity(war.defender.colorPrimary, 0.125) }}
              >
                <Ionicons name="shield" size={28} color={war.defender.colorPrimary} />
              </View>
              <Text className="text-white font-bold text-xs">{war.defender.name}</Text>
              <Text className="text-text-muted text-[10px]">[{war.defender.tag}]</Text>
            </View>
          </View>

          {/* Score bar */}
          <View className="h-4 bg-background-elevated rounded-full overflow-hidden flex-row mb-2">
            <View
              className="h-full rounded-l-full"
              style={{ width: `${challengerPct}%`, backgroundColor: war.challenger.colorPrimary }}
            />
            <View
              className="h-full rounded-r-full"
              style={{ width: `${defenderPct}%`, backgroundColor: war.defender.colorPrimary }}
            />
          </View>

          <View className="flex-row justify-between">
            <Text className="text-text-muted text-[10px]">
              {war.challenger.activeContributors} activos
            </Text>
            <Text className="text-text-muted text-[10px]">
              {war.defender.activeContributors} activos
            </Text>
          </View>

          {/* Winner banner */}
          {isCompleted && war.winnerGuildId && (
            <View className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mt-3 items-center">
              <Ionicons name="trophy" size={20} color="#F59E0B" />
              <Text className="text-amber-400 font-bold text-sm mt-1">
                {war.winnerGuildId === war.challenger.id ? war.challenger.name : war.defender.name} ¡ganó!
              </Text>
            </View>
          )}
        </View>

        {/* ─── SYNC BUTTON (active wars only) ──── */}
        {war.status === "ACTIVE" && (
          <TouchableOpacity
            className={`rounded-2xl py-3 items-center mb-4 ${syncing ? "bg-primary/50" : "bg-primary"}`}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View className="flex-row items-center">
                <Ionicons name="sync" size={16} color="#FFFFFF" />
                <Text className="text-white font-bold text-sm ml-2">Sincronizar mi contribucion</Text>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* ─── WAR POINTS BREAKDOWN ────────────── */}
        <View className="bg-background-card rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold text-sm mb-3">Como ganar War Points</Text>
          {[
            { label: "Completar workout (min 20min)", wp: 10, icon: "barbell" },
            { label: "Registrar nutricion", wp: 5, icon: "restaurant" },
            { label: "8,000+ pasos", wp: 5, icon: "footsteps" },
            { label: "Mantener racha", wp: 3, icon: "flame" },
            { label: "PR personal", wp: 15, icon: "trophy" },
          ].map((item, i) => (
            <View key={i} className="flex-row items-center mb-2">
              <Ionicons name={item.icon as any} size={12} color="#6C63FF" />
              <Text className="text-text-secondary text-xs ml-2 flex-1">{item.label}</Text>
              <Text className="text-primary font-bold text-xs">+{item.wp} WP</Text>
            </View>
          ))}
        </View>

        {/* ─── LEADERBOARD ─────────────────────── */}
        <View className="bg-background-card rounded-2xl p-4 mb-4">
          <Text className="text-white font-bold text-sm mb-3">Tabla de Lideres</Text>
          {war.leaderboard.length === 0 ? (
            <Text className="text-text-muted text-xs text-center py-4">
              Aún no hay contribuciones
            </Text>
          ) : (
            war.leaderboard.map((entry) => {
              const isChallenger = entry.guildId === war.challenger.id;
              const guildColor = isChallenger ? war.challenger.colorPrimary : war.defender.colorPrimary;

              return (
                <TouchableOpacity
                  key={entry.userId}
                  className="flex-row items-center py-2 border-b border-background-elevated"
                  onPress={() => router.push(`/profile/${entry.userId}` as any)}
                >
                  <Text className={`text-xs font-bold w-6 ${entry.rank <= 3 ? "text-amber-400" : "text-text-muted"}`}>
                    #{entry.rank}
                  </Text>
                  {entry.avatarUrl ? (
                    <Image source={{ uri: entry.avatarUrl }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                  ) : (
                    <View className="bg-primary/20 rounded-full w-7 h-7 items-center justify-center">
                      <Text className="text-primary text-[10px] font-bold">{entry.name.charAt(0)}</Text>
                    </View>
                  )}
                  <View className="ml-2 flex-1">
                    <Text className="text-white text-xs font-bold">{entry.name}</Text>
                  </View>
                  <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: guildColor }} />
                  <Text className="text-primary font-bold text-sm">{entry.totalWP}</Text>
                  <Text className="text-text-muted text-[10px] ml-0.5">WP</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
