// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/profile.tsx
// Sprint 2: Pantalla de Perfil completa
// Diseño: RPG Character Sheet — dark theme, gradients
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useUser, useAuth } from "@clerk/clerk-expo";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useCallback } from "react";
import { router } from "expo-router";
import { useProfile, useUserStats } from "@/hooks/useUserData";
import XPBar from "@/components/XPBar";

// ─── Stat Item Component ─────────────────────────────
function ProfileStat({
  icon,
  label,
  value,
  unit,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="flex-1 bg-background-card border border-background-elevated rounded-2xl p-4 items-center">
      <Ionicons name={icon} size={20} color="#6C63FF" />
      <Text className="text-white text-xl font-bold mt-2">
        {value}
      </Text>
      <Text className="text-text-secondary text-xs mt-1">
        {unit ? `${unit} ` : ""}
        {label}
      </Text>
    </View>
  );
}

// ─── Achievement Badge ───────────────────────────────
function AchievementBadge({
  icon,
  label,
  earned,
}: {
  icon: string;
  label: string;
  earned: boolean;
}) {
  return (
    <View
      className={`items-center p-3 rounded-2xl ${
        earned
          ? "bg-primary/10 border border-primary/30"
          : "bg-background-elevated/50 border border-background-elevated"
      }`}
      style={{ width: 80 }}
    >
      <Text className="text-2xl">{icon}</Text>
      <Text
        className={`text-xs mt-1 text-center ${
          earned ? "text-primary" : "text-text-muted"
        }`}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

// ─── Edit Profile Modal (inline) ─────────────────────
function EditSection({
  profile,
  onSave,
  onCancel,
}: {
  profile: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [weight, setWeight] = useState(
    profile?.weight?.toString() || ""
  );
  const [height, setHeight] = useState(
    profile?.height?.toString() || ""
  );
  const [bodyFat, setBodyFat] = useState(
    profile?.bodyFat?.toString() || ""
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name,
        bio: bio || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      });
    } catch (error) {
      Alert.alert("Error", "No se pudo guardar el perfil");
    }
    setSaving(false);
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-5 mt-4">
      <Text className="text-white font-bold text-lg mb-4">
        Editar perfil
      </Text>

      {/* Nombre */}
      <Text className="text-text-secondary text-sm mb-1">Nombre</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#6B6B80"
        placeholder="Tu nombre"
      />

      {/* Bio */}
      <Text className="text-text-secondary text-sm mb-1">Bio</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={bio}
        onChangeText={setBio}
        placeholderTextColor="#6B6B80"
        placeholder="Cuéntanos sobre ti..."
        multiline
        numberOfLines={3}
        style={{ textAlignVertical: "top", minHeight: 80 }}
      />

      {/* Body Metrics */}
      <Text className="text-white font-bold text-base mt-2 mb-3">
        Métricas corporales
      </Text>

      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">
            Peso (kg)
          </Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholderTextColor="#6B6B80"
            placeholder="75.0"
          />
        </View>
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">
            Altura (cm)
          </Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholderTextColor="#6B6B80"
            placeholder="175"
          />
        </View>
      </View>

      <View className="mt-3">
        <Text className="text-text-secondary text-sm mb-1">
          Grasa corporal (%)
        </Text>
        <TextInput
          className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
          value={bodyFat}
          onChangeText={setBodyFat}
          keyboardType="decimal-pad"
          placeholderTextColor="#6B6B80"
          placeholder="15.0"
        />
      </View>

      {/* Buttons */}
      <View className="flex-row gap-x-3 mt-5">
        <TouchableOpacity
          className="flex-1 bg-background-elevated rounded-2xl py-3 items-center"
          onPress={onCancel}
        >
          <Text className="text-text-secondary font-bold">
            Cancelar
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-primary rounded-2xl py-3 items-center"
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-bold">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// PROFILE SCREEN
// ═══════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { user: clerkUser } = useUser();
  const { signOut } = useAuth();
  const { profile, loading, refetch, updateProfile } = useProfile();
  const { stats, loading: statsLoading, refetch: refetchStats } = useUserStats();
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchStats()]);
    setRefreshing(false);
  }, [refetch, refetchStats]);

  const handleSaveProfile = async (data: any) => {
    await updateProfile(data);
    setEditing(false);
  };

  const handleSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const avatarUrl =
    profile?.avatarUrl ||
    clerkUser?.imageUrl ||
    null;

  // Calcular achievements basados en stats
  const achievements = [
    {
      icon: "🏋️",
      label: "Primera vez",
      earned: (stats?.totalWorkouts ?? 0) >= 1,
    },
    {
      icon: "🔥",
      label: "10 workouts",
      earned: (stats?.totalWorkouts ?? 0) >= 10,
    },
    {
      icon: "💪",
      label: "50 workouts",
      earned: (stats?.totalWorkouts ?? 0) >= 50,
    },
    {
      icon: "🏆",
      label: "Primer PR",
      earned: (stats?.totalPRs ?? 0) >= 1,
    },
    {
      icon: "⚡",
      label: "1 ton vol.",
      earned: (stats?.totalVolume ?? 0) >= 1000,
    },
    {
      icon: "🎯",
      label: "10 PRs",
      earned: (stats?.totalPRs ?? 0) >= 10,
    },
    {
      icon: "🌟",
      label: "100 workouts",
      earned: (stats?.totalWorkouts ?? 0) >= 100,
    },
    {
      icon: "👑",
      label: "Leyenda",
      earned: (stats?.totalWorkouts ?? 0) >= 365,
    },
  ];

  const earnedCount = achievements.filter((a) => a.earned).length;

  // Formatear tiempo total
  const totalHours = stats
    ? Math.floor(stats.totalMinutes / 60)
    : 0;
  const totalMins = stats ? stats.totalMinutes % 60 : 0;

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
            <Text className="text-white text-2xl font-bold">
              Perfil
            </Text>
            <View className="flex-row gap-x-3">
              <TouchableOpacity
                className="bg-background-card border border-background-elevated rounded-2xl p-3"
                onPress={() => setEditing(!editing)}
              >
                <Ionicons
                  name={editing ? "close" : "create-outline"}
                  size={20}
                  color="#A0A0B0"
                />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-background-card border border-background-elevated rounded-2xl p-3"
                onPress={handleSignOut}
              >
                <Ionicons
                  name="log-out-outline"
                  size={20}
                  color="#FF6B6B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── AVATAR + INFO ──────────────────────── */}
          <View className="items-center mb-6">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 3,
                  borderColor: "#6C63FF",
                }}
              />
            ) : (
              <View
                className="bg-primary/20 items-center justify-center"
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  borderWidth: 3,
                  borderColor: "#6C63FF",
                }}
              >
                <Text className="text-primary text-3xl font-bold">
                  {(profile?.name || clerkUser?.firstName || "A")
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}

            <Text className="text-white text-xl font-bold mt-3">
              {profile?.name || clerkUser?.fullName || "Atleta"}
            </Text>
            <Text className="text-text-secondary text-sm">
              @{profile?.username || clerkUser?.username || "usuario"}
            </Text>

            {profile?.bio && (
              <Text className="text-text-secondary text-sm text-center mt-2 px-8">
                {profile.bio}
              </Text>
            )}
          </View>

          {/* ─── LEVEL & XP ─────────────────────────── */}
          <LinearGradient
            colors={["#1E1E3A", "#2A2A4A"]}
            className="rounded-3xl p-5 mb-4"
          >
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center gap-x-2">
                <View className="bg-primary/20 rounded-xl p-2">
                  <Ionicons name="star" size={20} color="#6C63FF" />
                </View>
                <View>
                  <Text className="text-white font-bold text-lg">
                    Nivel {profile?.level ?? 1}
                  </Text>
                  <Text className="text-text-secondary text-xs">
                    {profile?.xp?.toLocaleString() ?? 0} XP total
                  </Text>
                </View>
              </View>
              {(profile?.streak ?? 0) > 0 && (
                <View className="bg-streak/10 border border-streak/30 rounded-2xl px-3 py-2 flex-row items-center gap-x-1">
                  <Text className="text-lg">🔥</Text>
                  <Text className="text-streak font-bold">
                    {profile?.streak ?? 0}
                  </Text>
                </View>
              )}
            </View>

            <XPBar
              currentXP={profile?.currentXP ?? 0}
              maxXP={profile?.maxXP ?? 500}
              level={profile?.level ?? 1}
            />
          </LinearGradient>

          {/* ─── BODY METRICS (si existen) ─────────── */}
          {(profile?.weight || profile?.height) && (
            <View className="flex-row gap-x-3 mb-4">
              {profile?.weight && (
                <ProfileStat
                  icon="scale-outline"
                  label="Peso"
                  value={profile.weight.toFixed(1)}
                  unit="kg"
                />
              )}
              {profile?.height && (
                <ProfileStat
                  icon="resize-outline"
                  label="Altura"
                  value={profile.height.toFixed(0)}
                  unit="cm"
                />
              )}
              {profile?.bodyFat && (
                <ProfileStat
                  icon="water-outline"
                  label="Grasa"
                  value={profile.bodyFat.toFixed(1)}
                  unit="%"
                />
              )}
            </View>
          )}

          {/* ─── EDIT SECTION ──────────────────────── */}
          {editing && (
            <EditSection
              profile={profile}
              onSave={handleSaveProfile}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* ─── LIFETIME STATS ────────────────────── */}
          <Text className="text-white font-bold text-lg mt-4 mb-3">
            Estadísticas totales
          </Text>

          {statsLoading ? (
            <ActivityIndicator
              color="#6C63FF"
              size="large"
              className="py-8"
            />
          ) : (
            <>
              <View className="flex-row gap-x-3 mb-3">
                <ProfileStat
                  icon="barbell-outline"
                  label="Workouts"
                  value={String(stats?.totalWorkouts ?? 0)}
                />
                <ProfileStat
                  icon="trophy-outline"
                  label="PRs"
                  value={String(stats?.totalPRs ?? 0)}
                />
              </View>

              <View className="flex-row gap-x-3 mb-3">
                <ProfileStat
                  icon="fitness-outline"
                  label="Volumen"
                  value={
                    (stats?.totalVolume ?? 0) >= 1000
                      ? `${((stats?.totalVolume ?? 0) / 1000).toFixed(1)}t`
                      : `${stats?.totalVolume ?? 0}`
                  }
                  unit={
                    (stats?.totalVolume ?? 0) >= 1000 ? "" : "kg"
                  }
                />
                <ProfileStat
                  icon="time-outline"
                  label="Tiempo"
                  value={
                    totalHours > 0
                      ? `${totalHours}h ${totalMins}m`
                      : `${totalMins}m`
                  }
                />
              </View>

              {/* Top exercise & longest workout */}
              {(stats?.topExercise || stats?.longestWorkout) && (
                <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
                  {stats?.topExercise && (
                    <View className="flex-row items-center gap-x-3 mb-2">
                      <Ionicons
                        name="heart"
                        size={18}
                        color="#FF6B6B"
                      />
                      <Text className="text-text-secondary text-sm flex-1">
                        Ejercicio favorito
                      </Text>
                      <Text className="text-white font-bold text-sm capitalize">
                        {stats.topExercise.name}
                      </Text>
                    </View>
                  )}
                  {stats?.longestWorkout && (
                    <View className="flex-row items-center gap-x-3">
                      <Ionicons
                        name="medal-outline"
                        size={18}
                        color="#F59E0B"
                      />
                      <Text className="text-text-secondary text-sm flex-1">
                        Workout más largo
                      </Text>
                      <Text className="text-white font-bold text-sm">
                        {stats.longestWorkout.duration} min
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}

          {/* ─── ACHIEVEMENTS ──────────────────────── */}
          <View className="flex-row justify-between items-center mt-4 mb-3">
            <Text className="text-white font-bold text-lg">
              Logros
            </Text>
            <Text className="text-text-secondary text-sm">
              {earnedCount}/{achievements.length}
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10 }}
          >
            {achievements.map((badge, index) => (
              <AchievementBadge
                key={index}
                icon={badge.icon}
                label={badge.label}
                earned={badge.earned}
              />
            ))}
          </ScrollView>

          {/* ─── MEMBER SINCE ──────────────────────── */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mt-6 flex-row items-center gap-x-3">
            <Ionicons
              name="calendar-outline"
              size={20}
              color="#A0A0B0"
            />
            <Text className="text-text-secondary text-sm">
              Miembro desde{" "}
              {stats?.memberSince
                ? new Date(stats.memberSince).toLocaleDateString("es", {
                    year: "numeric",
                    month: "long",
                  })
                : profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("es", {
                    year: "numeric",
                    month: "long",
                  })
                : "—"}
            </Text>
          </View>

          {/* ─── VERSION INFO ──────────────────────── */}
          <Text className="text-text-muted text-xs text-center mt-6">
            Fit Hub v1.1.0 — Sprint 2
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}