// ─────────────────────────────────────────────────────
// mobile/components/social/GuildsTab.tsx
// My Guilds + Browse Guilds
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
import { useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { guildsAPI } from "@/lib/api";
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

interface Guild {
  id: string;
  name: string;
  tag: string;
  type: "FORGE" | "WAR_PARTY" | "OPEN";
  motto: string | null;
  iconUrl: string | null;
  colorPrimary: string;
  colorSecondary?: string;
  level: number;
  memberCount: number;
  maxMembers: number;
  avgStreak: number;
  nationalRank: number | null;
  placeName: string | null;
  myRole?: string;
  isPrimary?: boolean;
  isMember?: boolean;
}

const TYPE_CONFIG = {
  FORGE: { icon: "hammer" as const, label: "Forge", color: "#F59E0B" },
  WAR_PARTY: { icon: "shield" as const, label: "War Party", color: "#EF4444" },
  OPEN: { icon: "globe" as const, label: "Open Guild", color: "#6C63FF" },
};

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  FOUNDER: { label: "Founder", color: "#F59E0B" },
  WARDEN: { label: "Warden", color: "#EF4444" },
  CAPTAIN: { label: "Captain", color: "#3B82F6" },
  MEMBER: { label: "Member", color: "#6B6B80" },
  RECRUIT: { label: "Recruit", color: "#6B6B80" },
};

function GuildCard({ guild, showRole, onJoin, onPress, joiningId }: { 
  guild: Guild; 
  showRole?: boolean;
  onJoin?: (guildId: string) => void;
  onPress?: () => void;
  joiningId?: string | null;
}) {
  const typeConf = TYPE_CONFIG[guild.type];
  const roleConf = guild.myRole ? ROLE_LABELS[guild.myRole] : null;

  return (
    <TouchableOpacity
      className="bg-background-card border border-background-elevated rounded-2xl p-4 mb-3"
      style={{ borderLeftColor: guild.colorPrimary, borderLeftWidth: 3 }}
      onPress={onPress || (() => router.push(`/guild/${guild.id}` as any))}
      activeOpacity={0.7}
    >
      {/* Header Row */}
      <View className="flex-row items-center mb-2">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: withOpacity(guild.colorPrimary, 0.125) }}
        >
          <Ionicons name={typeConf.icon} size={20} color={guild.colorPrimary} />
        </View>
        <View className="ml-3 flex-1">
          <View className="flex-row items-center gap-x-2">
            <Text className="text-white font-bold text-sm">{guild.name}</Text>
            <View className="bg-white/10 rounded px-1.5 py-0.5">
              <Text className="text-text-muted text-[10px] font-bold">[{guild.tag}]</Text>
            </View>
          </View>
          <View className="flex-row items-center mt-0.5">
            <Ionicons name={typeConf.icon} size={10} color={typeConf.color} />
            <Text className="text-text-muted text-[10px] ml-1">{typeConf.label}</Text>
            {guild.placeName && (
              <Text className="text-text-muted text-[10px] ml-2">
                {guild.placeName}
              </Text>
            )}
          </View>
        </View>

        {/* Role badge or join button */}
        {showRole && roleConf ? (
          <View className="bg-white/5 rounded-lg px-2 py-1">
            <Text style={{ color: roleConf.color }} className="text-[10px] font-bold">
              {roleConf.label}
            </Text>
          </View>
        ) : guild.isMember === false ? (
          <TouchableOpacity
            onPress={() => onJoin?.(guild.id)}
            disabled={joiningId === guild.id}
            className="bg-primary/20 rounded-lg px-2 py-1"
          >
            {joiningId === guild.id ? (
              <ActivityIndicator size="small" color="#6C63FF" />
            ) : (
              <Text className="text-primary text-[10px] font-bold">Unirse</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Motto */}
      {guild.motto && (
        <Text className="text-text-secondary text-xs italic mb-2" numberOfLines={1}>
          "{guild.motto}"
        </Text>
      )}

      {/* Stats Row */}
      <View className="flex-row items-center gap-x-4">
        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={12} color="#6B6B80" />
          <Text className="text-text-muted text-[11px] ml-1">
            {guild.memberCount}/{guild.maxMembers}
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-amber-400 text-[11px]">
            Lv.{guild.level}
          </Text>
        </View>
        {guild.avgStreak > 0 && (
          <View className="flex-row items-center">
            <Text className="text-orange-400 text-[11px]">
              {Math.round(guild.avgStreak)}d racha
            </Text>
          </View>
        )}
        {guild.nationalRank && (
          <View className="flex-row items-center">
            <Ionicons name="trophy-outline" size={11} color="#6B6B80" />
            <Text className="text-text-muted text-[11px] ml-1">
              #{guild.nationalRank}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function GuildsTab() {
  const [myGuilds, setMyGuilds] = useState<Guild[]>([]);
  const [browseGuilds, setBrowseGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [maxGuilds, setMaxGuilds] = useState(3);
  const [browseFilter, setBrowseFilter] = useState<"all" | "FORGE" | "OPEN">("all");

  const fetchData = useCallback(async () => {
    setFetchError(null);
    setLoading(true);
    try {
      const [mineRes, browseRes] = await Promise.all([
        guildsAPI.getMine(),
        guildsAPI.browse({ type: browseFilter !== "all" ? browseFilter : undefined }),
      ]);
      setMyGuilds(mineRes.data.guilds || []);
      setMaxGuilds(mineRes.data.maxGuilds || 3);
      setBrowseGuilds(browseRes.data.guilds || []);
    } catch (err: any) {
      console.error("Guilds fetch error:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Error al cargar guilds";
      setFetchError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [browseFilter]);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleJoin = async (guildId: string) => {
    if (joiningId) return; // Prevent multiple joins
    setJoiningId(guildId);
    try {
      await guildsAPI.join(guildId);
      await fetchData();
    } catch (err: any) {
      console.error("Join error:", err?.response?.data?.error || err);
      const errorMessage = err?.response?.data?.error || "Error al unirse a la guild";
      Alert.alert("Error", errorMessage);
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  if (fetchError) {
    return (
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-red-400 text-center mb-4">{fetchError}</Text>
        <TouchableOpacity
          onPress={fetchData}
          className="bg-primary px-4 py-2 rounded-lg"
        >
          <Text className="text-white font-bold">Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
      }
      className="flex-1 px-5"
    >
      {/* ─── MY GUILDS ──────────────────────── */}
      <View className="flex-row items-center justify-between mb-3 mt-2">
        <View className="flex-row items-center">
          <Ionicons name="shield-checkmark" size={16} color="#6C63FF" />
          <Text className="text-white font-bold text-sm ml-2">Mis Guilds</Text>
          <Text className="text-text-muted text-xs ml-2">
            {myGuilds.length}/{maxGuilds}
          </Text>
        </View>
        {myGuilds.length < maxGuilds && (
          <TouchableOpacity
            className="bg-primary/20 rounded-xl px-3 py-1.5"
            onPress={() => router.push("/guild/create" as any)}
          >
            <Text className="text-primary text-xs font-bold">+ Crear</Text>
          </TouchableOpacity>
        )}
      </View>

      {myGuilds.length === 0 ? (
        <TouchableOpacity
          className="bg-background-card border border-dashed border-primary/30 rounded-2xl p-6 mb-4 items-center"
          onPress={() => router.push("/guild/create" as any)}
        >
          <Ionicons name="add-circle-outline" size={32} color="#6C63FF" />
          <Text className="text-white font-bold text-sm mt-2">Crea tu primera Guild</Text>
          <Text className="text-text-muted text-xs mt-1 text-center">
            Crea una Forge con tu gym o una War Party con amigos
          </Text>
        </TouchableOpacity>
      ) : (
        myGuilds.map((g) => <GuildCard key={g.id} guild={g} showRole joiningId={joiningId} />)
      )}

      {/* ─── BROWSE GUILDS ──────────────────── */}
      <View className="flex-row items-center mt-4 mb-3">
        <Ionicons name="compass-outline" size={16} color="#6C63FF" />
        <Text className="text-white font-bold text-sm ml-2">Explorar Guilds</Text>
      </View>

      {/* Filter Pills */}
      <View className="flex-row gap-x-2 mb-3">
        {([
          { key: "all", label: "Todas" },
          { key: "FORGE", label: "Forge" },
          { key: "OPEN", label: "Abiertas" },
        ] as const).map((f) => (
          <TouchableOpacity
            key={f.key}
            className={`rounded-xl px-3 py-1.5 ${
              browseFilter === f.key ? "bg-primary" : "bg-background-card"
            }`}
            onPress={() => setBrowseFilter(f.key)}
          >
            <Text
              className={`text-xs font-bold ${
                browseFilter === f.key ? "text-white" : "text-text-muted"
              }`}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(() => {
        const filteredBrowse = browseGuilds.filter((g) => !myGuilds.some((mg) => mg.id === g.id));
        if (filteredBrowse.length === 0) {
          return (
            <View className="items-center mt-6">
              <Text className="text-text-muted text-xs">No se encontraron guilds</Text>
            </View>
          );
        }
        return filteredBrowse.map((g) => (
          <GuildCard 
            key={g.id} 
            guild={{ ...g, isMember: false }} 
            onJoin={handleJoin}
            joiningId={joiningId}
          />
        ));
      })()}

      <View className="h-8" />
    </ScrollView>
  );
}
