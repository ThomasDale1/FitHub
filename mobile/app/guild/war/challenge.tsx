// ─────────────────────────────────────────────────────
// mobile/app/guild/war/challenge.tsx
// Launch a Guild War — select rival + war type
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect, useCallback } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { guildsAPI, guildWarsAPI } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";

type WarType = "TOTAL_WAR" | "IRON_CLASH" | "MARATHON" | "CONSISTENCY";

interface Rival {
  id: string;
  name: string;
  tag: string;
  type: string;
  colorPrimary: string;
  level: number;
  memberCount: number;
  nationalRank: number | null;
  avgStreak: number;
}

const WAR_TYPES: { key: WarType; icon: string; label: string; desc: string; days: number; color: string }[] = [
  {
    key: "TOTAL_WAR",
    icon: "flash",
    label: "Total War",
    desc: "Workouts + pasos + nutricion. La guerra completa.",
    days: 5,
    color: "#EF4444",
  },
  {
    key: "IRON_CLASH",
    icon: "barbell",
    label: "Iron Clash",
    desc: "Volumen total levantado (kg).",
    days: 3,
    color: "#F59E0B",
  },
  {
    key: "MARATHON",
    icon: "walk",
    label: "Marathon",
    desc: "Pasos colectivos. Camina para ganar.",
    days: 7,
    color: "#22C55E",
  },
  {
    key: "CONSISTENCY",
    icon: "calendar",
    label: "Consistency Battle",
    desc: "% de miembros que mantienen racha.",
    days: 5,
    color: "#6C63FF",
  },
];

export default function ChallengeScreen() {
  const { guildId } = useLocalSearchParams<{ guildId: string }>();
  const [rivals, setRivals] = useState<Rival[]>([]);
  const [loading, setLoading] = useState(true);
  const [rivalsError, setRivalsError] = useState<string | null>(null);
  const [selectedRival, setSelectedRival] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<WarType>("TOTAL_WAR");
  const [submitting, setSubmitting] = useState(false);

  const fetchRivals = useCallback(async () => {
    if (!guildId) return;
    setRivalsError(null);
    setLoading(true);
    try {
      const res = await guildsAPI.getRivals(guildId);
      setRivals(res.data.rivals || []);
    } catch (err: any) {
      console.error("Failed to fetch rivals:", err);
      const errorMessage = err?.response?.data?.error || err?.message || "Error al cargar rivales";
      setRivalsError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    fetchRivals();
  }, [fetchRivals]);

  const handleChallenge = async () => {
    if (!selectedRival || !guildId) return;

    setSubmitting(true);
    try {
      const res = await guildWarsAPI.challenge(guildId, {
        defenderGuildId: selectedRival,
        type: selectedType,
      });
      Alert.alert(
        "Desafio Enviado!",
        "La guild rival tiene 24h para aceptar.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Error al lanzar desafio";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Ionicons name="flash" size={20} color="#EF4444" />
        <Text className="text-white text-xl font-bold ml-2">Lanzar Guerra</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6C63FF" size="large" />
        </View>
      ) : rivalsError ? (
        <View className="flex-1 items-center justify-center px-5">
          <Text className="text-red-400 text-center mb-4">{rivalsError}</Text>
          <TouchableOpacity
            onPress={fetchRivals}
            className="bg-primary px-4 py-2 rounded-lg"
          >
            <Text className="text-white font-bold">Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* ─── WAR TYPE ──────────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Tipo de Batalla</Text>
        {WAR_TYPES.map((wt) => (
          <TouchableOpacity
            key={wt.key}
            className={`flex-row items-center p-3 rounded-xl mb-2 border ${
              selectedType === wt.key ? "border-red-500 bg-red-500/10" : "border-background-elevated bg-background-card"
            }`}
            onPress={() => setSelectedType(wt.key)}
          >
            <View
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{ backgroundColor: wt.color + "20" }}
            >
              <Ionicons name={wt.icon as any} size={20} color={wt.color} />
            </View>
            <View className="ml-3 flex-1">
              <View className="flex-row items-center">
                <Text className="text-white font-bold text-sm">{wt.label}</Text>
                <Text className="text-text-muted text-[10px] ml-2">{wt.days} dias</Text>
              </View>
              <Text className="text-text-muted text-[10px]">{wt.desc}</Text>
            </View>
            {selectedType === wt.key && (
              <Ionicons name="checkmark-circle" size={20} color="#EF4444" />
            )}
          </TouchableOpacity>
        ))}

        {/* ─── SELECT RIVAL ──────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-4">Elige Rival</Text>

        {loading ? (
          <View className="py-10 items-center">
            <ActivityIndicator color="#6C63FF" size="large" />
          </View>
        ) : rivals.length === 0 ? (
          <View className="bg-background-card rounded-2xl p-6 items-center mb-4">
            <Ionicons name="alert-circle-outline" size={32} color="#6B6B80" />
            <Text className="text-text-muted text-xs text-center mt-2">
              No hay rivales disponibles. Guilds en tu rango pueden estar en guerra o no tener ranking.
            </Text>
          </View>
        ) : (
          rivals.map((rival) => (
            <TouchableOpacity
              key={rival.id}
              className={`bg-background-card border rounded-2xl p-4 mb-2 ${
                selectedRival === rival.id ? "border-red-500" : "border-background-elevated"
              }`}
              onPress={() => setSelectedRival(rival.id)}
            >
              <View className="flex-row items-center">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: rival.colorPrimary + "20" }}
                >
                  <Ionicons name="shield" size={20} color={rival.colorPrimary} />
                </View>
                <View className="ml-3 flex-1">
                  <View className="flex-row items-center gap-x-2">
                    <Text className="text-white font-bold text-sm">{rival.name}</Text>
                    <View className="bg-white/10 rounded px-1.5 py-0.5">
                      <Text className="text-text-muted text-[10px] font-bold">[{rival.tag}]</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-x-3 mt-0.5">
                    <Text className="text-amber-400 text-[10px]">Lv.{rival.level}</Text>
                    <Text className="text-text-muted text-[10px]">{rival.memberCount} miembros</Text>
                    {rival.nationalRank != null && (
                      <Text className="text-text-muted text-[10px]">#{rival.nationalRank}</Text>
                    )}
                  </View>
                </View>
                {selectedRival === rival.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#EF4444" />
                )}
              </View>
            </TouchableOpacity>
          ))
        )}

        {/* ─── CHALLENGE BUTTON ──────────────────── */}
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mt-4 mb-8 ${
            !selectedRival || submitting ? "bg-red-500/30" : "bg-red-500"
          }`}
          onPress={handleChallenge}
          disabled={!selectedRival || submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <View className="flex-row items-center">
              <Ionicons name="flash" size={18} color="#FFFFFF" />
              <Text className="text-white font-bold text-sm ml-2">Lanzar Desafio</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
      )}
    </SafeAreaView>
  );
}
