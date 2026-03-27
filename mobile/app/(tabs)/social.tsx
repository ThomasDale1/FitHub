// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/social.tsx
// Social: Discover, Check Profile & Follow + Challenges
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useTour } from "@/context/TourContext";
import {
  socialAPI,
  badgesAPI,
  challengesAPI,
  type ChallengeData,
} from "@/lib/api";

// ─── Create Challenge Modal ──────────────────────────
const CHALLENGE_TYPES = [
  { key: "FREQUENCY", label: "Workouts", icon: "repeat", unit: "sesiones" },
  { key: "VOLUME", label: "Volumen", icon: "barbell", unit: "kg" },
  { key: "PR", label: "PRs", icon: "trophy", unit: "PRs" },
  { key: "DISTANCE", label: "Distancia", icon: "walk", unit: "km" },
  { key: "STREAK", label: "Streak", icon: "flame", unit: "días" },
] as const;

const DURATION_PRESETS = [
  { label: "3 días", days: 3 },
  { label: "1 semana", days: 7 },
  { label: "2 semanas", days: 14 },
  { label: "1 mes", days: 30 },
];

function CreateChallengeModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    type: string;
    mode: "MILESTONE" | "TIMED";
    goal: number;
    unit: string;
    endDate: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState(0);
  const [mode, setMode] = useState<"MILESTONE" | "TIMED">("MILESTONE");
  const [goal, setGoal] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(1);

  const handleSubmit = () => {
    const ct = CHALLENGE_TYPES[selectedType];
    const goalNum = parseFloat(goal);
    if (!title.trim()) {
      Alert.alert("Error", "Escribe un nombre para el challenge");
      return;
    }
    if (!goalNum || goalNum <= 0) {
      Alert.alert("Error", "La meta debe ser mayor a 0");
      return;
    }
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DURATION_PRESETS[selectedDuration].days);

    onSubmit({
      title: title.trim(),
      type: ct.key,
      mode,
      goal: goalNum,
      unit: ct.unit,
      endDate: endDate.toISOString(),
    });

    setTitle("");
    setGoal("");
    setSelectedType(0);
    setMode("MILESTONE");
    setSelectedDuration(1);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: "85%" }}
            >
              <View className="bg-background rounded-t-3xl p-5 pb-10">
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-white font-bold text-xl">Crear Challenge</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={24} color="#A0A0B0" />
                  </TouchableOpacity>
                </View>

                {/* Nombre */}
                <Text className="text-text-secondary text-sm mb-1">Nombre del reto</Text>
                <TextInput
                  className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-4"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ej: Reto de volumen semanal"
                  placeholderTextColor="#6B6B80"
                />

                {/* Tipo */}
                <Text className="text-text-secondary text-sm mb-2">Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <View className="flex-row gap-x-2">
                    {CHALLENGE_TYPES.map((t, i) => (
                      <TouchableOpacity
                        key={t.key}
                        className={`rounded-2xl px-4 py-2.5 flex-row items-center gap-x-1.5 ${
                          selectedType === i ? "bg-primary" : "bg-background-elevated"
                        }`}
                        onPress={() => setSelectedType(i)}
                      >
                        <Ionicons
                          name={t.icon as any}
                          size={16}
                          color={selectedType === i ? "white" : "#A0A0B0"}
                        />
                        <Text className={`text-sm font-bold ${
                          selectedType === i ? "text-white" : "text-text-secondary"
                        }`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Modo */}
                <Text className="text-text-secondary text-sm mb-2">Modo</Text>
                <View className="flex-row gap-x-2 mb-4">
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl p-3 ${
                      mode === "MILESTONE" ? "bg-primary/20 border border-primary" : "bg-background-elevated"
                    }`}
                    onPress={() => setMode("MILESTONE")}
                  >
                    <Text className={`font-bold text-sm ${
                      mode === "MILESTONE" ? "text-primary" : "text-text-secondary"
                    }`}>🏁 Carrera</Text>
                    <Text className="text-text-muted text-xs mt-0.5">
                      Primero en llegar gana
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl p-3 ${
                      mode === "TIMED" ? "bg-primary/20 border border-primary" : "bg-background-elevated"
                    }`}
                    onPress={() => setMode("TIMED")}
                  >
                    <Text className={`font-bold text-sm ${
                      mode === "TIMED" ? "text-primary" : "text-text-secondary"
                    }`}>⏱ Competencia</Text>
                    <Text className="text-text-muted text-xs mt-0.5">
                      Mejor puntaje al final gana
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Meta */}
                <Text className="text-text-secondary text-sm mb-1">
                  Meta ({CHALLENGE_TYPES[selectedType].unit})
                </Text>
                <TextInput
                  className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-4"
                  value={goal}
                  onChangeText={setGoal}
                  keyboardType="numeric"
                  placeholder={`Ej: 100 ${CHALLENGE_TYPES[selectedType].unit}`}
                  placeholderTextColor="#6B6B80"
                />

                {/* Duración */}
                <Text className="text-text-secondary text-sm mb-2">Duración</Text>
                <View className="flex-row gap-x-2 mb-5">
                  {DURATION_PRESETS.map((d, i) => (
                    <TouchableOpacity
                      key={d.days}
                      className={`flex-1 rounded-2xl py-2.5 items-center ${
                        selectedDuration === i ? "bg-primary" : "bg-background-elevated"
                      }`}
                      onPress={() => setSelectedDuration(i)}
                    >
                      <Text className={`text-xs font-bold ${
                        selectedDuration === i ? "text-white" : "text-text-secondary"
                      }`}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  className="bg-primary rounded-2xl py-4 items-center"
                  onPress={handleSubmit}
                >
                  <Text className="text-white font-bold text-base">Crear Challenge</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// SOCIAL SCREEN
// ═══════════════════════════════════════════════════════
export default function SocialScreen() {
  const { isActive, step, advanceStep, beginTransition } = useTour();
  const [activeTab, setActiveTab] = useState<"discover" | "challenges">("discover");

  useFocusEffect(
    useCallback(() => {
      if (isActive && step === 0) {
        beginTransition();
        const t = setTimeout(() => advanceStep(), 3000);
        return () => clearTimeout(t);
      }
    }, [isActive, step, advanceStep, beginTransition])
  );

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [challengeFilter, setChallengeFilter] = useState<"active" | "available" | "mine">("active");

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await socialAPI.discover();
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error("Discover error:", err);
    }
  }, []);

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await challengesAPI.getAll(challengeFilter);
      setChallenges(res.data);
    } catch (err) {
      console.error("Challenges error:", err);
    }
  }, [challengeFilter]);

  useEffect(() => {
    if (activeTab === "challenges") {
      fetchChallenges();
    }
  }, [activeTab, fetchChallenges]);

  useEffect(() => {
    fetchDiscover().finally(() => setLoading(false));
  }, [fetchDiscover]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDiscover();
    if (activeTab === "challenges") await fetchChallenges();
    try { await badgesAPI.check(); } catch {}
    setRefreshing(false);
  }, [fetchDiscover, fetchChallenges, activeTab]);

  const handleFollow = async (targetUserId: string) => {
    try {
      await socialAPI.follow(targetUserId);
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await challengesAPI.join(challengeId);
      fetchChallenges();
      Alert.alert("¡Unido!", "Te uniste al challenge");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo unir");
    }
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    Alert.alert("Salir del challenge", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await challengesAPI.leave(challengeId);
            fetchChallenges();
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.error || "No se pudo salir");
          }
        },
      },
    ]);
  };

  const handleCreateChallenge = async (data: {
    title: string;
    type: string;
    mode: "MILESTONE" | "TIMED";
    goal: number;
    unit: string;
    endDate: string;
  }) => {
    try {
      await challengesAPI.create({
        ...data,
        startDate: new Date().toISOString(),
        isPublic: true,
      });
      setShowCreateChallenge(false);
      setChallengeFilter("active");
      fetchChallenges();
      Alert.alert("¡Challenge creado!", "Ya puedes competir");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo crear");
    }
  };

  const tabs = [
    { key: "discover" as const, label: "Descubrir", icon: "compass-outline" as const },
    { key: "challenges" as const, label: "Retos", icon: "trophy-outline" as const },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ─── HEADER ─────────────────────────────── */}
      <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-white text-2xl font-bold">Comunidad</Text>
        {activeTab === "challenges" && (
          <TouchableOpacity
            className="bg-primary rounded-2xl p-3"
            onPress={() => setShowCreateChallenge(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── TAB BAR ────────────────────────────── */}
      <View className="flex-row px-5 gap-x-2 mb-3">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 flex-row items-center justify-center gap-x-1 py-2.5 rounded-2xl ${
              activeTab === tab.key
                ? "bg-primary/20 border border-primary/30"
                : "bg-background-card border border-background-elevated"
            }`}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? "#6C63FF" : "#6B6B80"}
            />
            <Text
              className={`text-xs font-bold ${
                activeTab === tab.key ? "text-primary" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── CONTENT ────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
        className="px-5"
      >
        {loading ? (
          <ActivityIndicator color="#6C63FF" size="large" className="mt-20" />
        ) : activeTab === "discover" ? (
          /* ─── DISCOVER TAB ─── */
          <>
            <Text className="text-white font-bold text-base mb-3">
              Personas sugeridas
            </Text>
            {suggestions.length === 0 ? (
              <View className="items-center mt-10">
                <Text className="text-text-muted text-sm">No hay sugerencias por ahora</Text>
              </View>
            ) : (
              suggestions.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3 flex-row items-center gap-x-3"
                  onPress={() => router.push(`/profile/${user.id}` as any)}
                  activeOpacity={0.7}
                >
                  {user.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <View className="bg-primary/20 rounded-full w-12 h-12 items-center justify-center">
                      <Text className="text-primary font-bold text-lg">
                        {user.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <View className="flex-row items-center gap-x-2">
                      <Text className="text-white font-bold text-sm">{user.name}</Text>
                      <View className="bg-primary/20 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs">Lv.{user.level}</Text>
                      </View>
                    </View>
                    <Text className="text-text-muted text-xs">@{user.username}</Text>
                    {user.bio && (
                      <Text className="text-text-secondary text-xs mt-1" numberOfLines={1}>
                        {user.bio}
                      </Text>
                    )}
                    <Text className="text-text-muted text-xs mt-1">
                      {user._count?.workouts || 0} workouts · {user.streak} streak
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="bg-primary rounded-2xl px-4 py-2"
                    onPress={() => handleFollow(user.id)}
                  >
                    <Text className="text-white text-xs font-bold">Seguir</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </>
        ) : (
          /* ─── CHALLENGES TAB ─── */
          <>
            {/* Filter pills */}
            <View className="flex-row gap-x-2 mb-4">
              {([
                { key: "active" as const, label: "Mis retos" },
                { key: "available" as const, label: "Disponibles" },
                { key: "mine" as const, label: "Creados" },
              ]).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  className={`flex-1 py-2 rounded-2xl items-center ${
                    challengeFilter === f.key
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-background-card border border-background-elevated"
                  }`}
                  onPress={() => setChallengeFilter(f.key)}
                >
                  <Text className={`text-xs font-bold ${
                    challengeFilter === f.key ? "text-primary" : "text-text-secondary"
                  }`}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Challenge list */}
            {challenges.length === 0 ? (
              <View className="items-center mt-8">
                <Ionicons name="trophy-outline" size={48} color="#6B6B80" />
                <Text className="text-text-secondary text-sm mt-3">
                  {challengeFilter === "active"
                    ? "No tienes retos activos"
                    : challengeFilter === "available"
                    ? "No hay retos disponibles"
                    : "No has creado retos"}
                </Text>
              </View>
            ) : (
              challenges.map((c) => {
                const pct = c.goal > 0 && c.myProgress
                  ? Math.min(100, Math.round((c.myProgress.currentValue / c.goal) * 100))
                  : 0;
                const msLeft = new Date(c.endDate).getTime() - Date.now();
                const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
                const endLocal = new Date(c.endDate).toLocaleString("es", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                });
                const typeIcons: Record<string, string> = {
                  VOLUME: "barbell", FREQUENCY: "repeat", STREAK: "flame",
                  PR: "trophy", DISTANCE: "walk", CUSTOM: "star",
                };

                return (
                  <View key={c.id} className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
                    {/* Header */}
                    <View className="flex-row items-center gap-x-3 mb-2">
                      <View className="bg-primary/20 rounded-2xl p-2.5">
                        <Ionicons
                          name={(typeIcons[c.type] || "star") as any}
                          size={20}
                          color="#6C63FF"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-bold text-base">{c.title}</Text>
                        <View className="flex-row items-center gap-x-2 mt-0.5">
                          <Text className="text-text-muted text-xs">
                            {c.mode === "MILESTONE" ? "🏁 Carrera" : "⏱ Competencia"}
                          </Text>
                          <Text className="text-text-muted text-xs">·</Text>
                          <Text className="text-text-muted text-xs">
                            {c.participantsCount} participante{c.participantsCount !== 1 ? "s" : ""}
                          </Text>
                          {c.status === "ACTIVE" && (
                            <>
                              <Text className="text-text-muted text-xs">·</Text>
                              <Text className="text-text-muted text-xs">
                                {daysLeft > 0 ? `${daysLeft}d · ` : ""}Termina {endLocal}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View className="bg-background-elevated rounded-xl px-2.5 py-1">
                        <Text className="text-primary text-xs font-bold">+{c.xpReward} XP</Text>
                      </View>
                    </View>

                    {/* Goal */}
                    <Text className="text-text-secondary text-sm mb-2">
                      Meta: {c.goal.toLocaleString()} {c.unit}
                    </Text>

                    {/* Progress bar (if joined) */}
                    {c.isJoined && c.myProgress && (
                      <View className="mb-2">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-text-muted text-xs">
                            {c.myProgress.currentValue.toLocaleString()} / {c.goal.toLocaleString()} {c.unit}
                          </Text>
                          <Text className="text-primary text-xs font-bold">{pct}%</Text>
                        </View>
                        <View className="bg-background-elevated rounded-full h-2">
                          <View
                            className="rounded-full h-2"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? "#00D48A" : "#6C63FF",
                            }}
                          />
                        </View>
                        {c.myProgress.isWinner && (
                          <View className="flex-row items-center gap-x-1 mt-1">
                            <Text className="text-sm">🏆</Text>
                            <Text className="text-green-400 text-xs font-bold">¡Completado!</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Status badge for completed */}
                    {c.status === "COMPLETED" && !c.isJoined && (
                      <View className="bg-background-elevated rounded-xl px-3 py-1 self-start mb-2">
                        <Text className="text-text-muted text-xs">Finalizado</Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    {c.status === "ACTIVE" && !c.isJoined && (
                      <TouchableOpacity
                        className="bg-primary rounded-2xl py-2.5 items-center mt-1"
                        onPress={() => handleJoinChallenge(c.id)}
                      >
                        <Text className="text-white font-bold text-sm">Unirme</Text>
                      </TouchableOpacity>
                    )}
                    {c.status === "ACTIVE" && c.isJoined && !c.myProgress?.isWinner && (
                      <TouchableOpacity
                        className="py-2 items-center mt-1"
                        onPress={() => handleLeaveChallenge(c.id)}
                      >
                        <Text className="text-red-400 text-xs">Salir del challenge</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* ─── CREATE CHALLENGE MODAL ──────────────── */}
      <CreateChallengeModal
        visible={showCreateChallenge}
        onClose={() => setShowCreateChallenge(false)}
        onSubmit={handleCreateChallenge}
      />
    </SafeAreaView>
  );
}
