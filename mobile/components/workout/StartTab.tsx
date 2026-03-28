import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { workoutAPI, exerciseAPI, LastWorkout, RecentExercise, Exercise } from "@/lib/api";
import { useWorkoutStore } from "@/store/workoutStore";
import ExerciseDetailModal from "./ExerciseDetailModal";

// ─── Grupos musculares para el quick grid ─────────────
const MUSCLE_GROUPS = [
  { key: "chest", label: "Pecho", icon: "body-outline" },
  { key: "back", label: "Espalda", icon: "accessibility-outline" },
  { key: "upper legs", label: "Piernas", icon: "walk-outline" },
  { key: "shoulders", label: "Hombros", icon: "person-outline" },
  { key: "upper arms", label: "Brazos", icon: "barbell-outline" },
  { key: "waist", label: "Abdomen", icon: "ellipse-outline" },
];

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Hace menos de 1 hora";
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 7)} semanas`;
}

interface StartTabProps {
  onStartEmpty: () => void;
  onStartWithTemplate: (templateId: string, name: string) => void;
  onNavigateToTab: (tab: "templates" | "exercises", filter?: string) => void;
}

export default function StartTab({
  onStartEmpty,
  onStartWithTemplate,
  onNavigateToTab,
}: StartTabProps) {
  const { activeWorkout, startWorkout, addExercise } = useWorkoutStore();

  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [recentExercises, setRecentExercises] = useState<RecentExercise[]>([]);
  const [prsMap, setPrsMap] = useState<Map<string, { weight: number; reps: number }>>(new Map());
  const [loading, setLoading] = useState(true);

  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lastRes, recentRes, prsRes] = await Promise.all([
        workoutAPI.getLast().catch(() => ({ data: null })),
        workoutAPI.getRecentExercises(6).catch(() => ({ data: [] })),
        workoutAPI.getPRs().catch(() => ({ data: [] })),
      ]);

      setLastWorkout(lastRes.data);
      setRecentExercises(recentRes.data ?? []);

      const map = new Map<string, { weight: number; reps: number }>();
      for (const pr of (prsRes.data ?? [])) {
        if (pr.externalId && pr.weight && pr.reps) {
          map.set(pr.externalId, { weight: pr.weight, reps: pr.reps });
        }
      }
      setPrsMap(map);
    } catch {
      // Graceful: show what we have
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRepeatLastWorkout = () => {
    if (!lastWorkout) return;
    startWorkout(lastWorkout.name);
    for (const ex of lastWorkout.exercises) {
      addExercise({
        externalId: ex.externalId ?? "",
        exerciseName: ex.exerciseName,
        bodyPart: "",
        target: "",
        equipment: "",
        restSeconds: 90,
      });
    }
    router.push("/workout/active");
  };

  const handleOpenExerciseDetail = async (externalId: string | null, exerciseName: string) => {
    if (!externalId) return;
    setLoadingDetail(true);
    try {
      const { data } = await exerciseAPI.getById(externalId);
      setDetailExercise(data);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddRecentToWorkout = (ex: RecentExercise) => {
    if (!activeWorkout.isActive) startWorkout("Workout");
    addExercise({
      externalId: ex.externalId ?? "",
      exerciseName: ex.exerciseName,
      bodyPart: "",
      target: "",
      equipment: "",
      restSeconds: 90,
    });
    router.push("/workout/active");
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 24 }}
    >
      {/* ── Botón principal de inicio ─────────────────── */}
      <TouchableOpacity
        onPress={onStartEmpty}
        activeOpacity={0.85}
        style={{
          backgroundColor: "#6C63FF",
          borderRadius: 20,
          paddingVertical: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
          Iniciar entrenamiento
        </Text>
      </TouchableOpacity>

      {/* ── Último workout ────────────────────────────── */}
      {!loading && lastWorkout && (
        <View>
          <Text
            style={{
              color: "#6B6B80",
              fontSize: 12,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 10,
            }}
          >
            Último entrenamiento
          </Text>
          <TouchableOpacity
            onPress={handleRepeatLastWorkout}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#1a1a2e",
              borderWidth: 1,
              borderColor: "#252540",
              borderRadius: 20,
              padding: 16,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}
                  numberOfLines={1}
                >
                  {lastWorkout.name}
                </Text>
                <Text style={{ color: "#6B6B80", fontSize: 12, marginTop: 2 }}>
                  {timeAgo(lastWorkout.endTime)}
                  {lastWorkout.duration
                    ? ` · ${formatDuration(lastWorkout.duration)}`
                    : ""}
                  {lastWorkout.exercises.length > 0
                    ? ` · ${lastWorkout.exercises.length} ejercicios`
                    : ""}
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: "#6C63FF15",
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <Ionicons name="refresh" size={14} color="#6C63FF" />
                <Text
                  style={{ color: "#6C63FF", fontWeight: "700", fontSize: 13 }}
                >
                  Repetir
                </Text>
              </View>
            </View>

            {/* Ejercicios del último workout */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {lastWorkout.exercises.slice(0, 4).map((ex, idx) => (
                <View
                  key={idx}
                  style={{
                    backgroundColor: "#252540",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text
                    style={{
                      color: "#8888a0",
                      fontSize: 11,
                      textTransform: "capitalize",
                    }}
                  >
                    {ex.exerciseName}
                  </Text>
                </View>
              ))}
              {lastWorkout.exercises.length > 4 && (
                <View
                  style={{
                    backgroundColor: "#252540",
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}
                >
                  <Text style={{ color: "#6C63FF", fontSize: 11 }}>
                    +{lastWorkout.exercises.length - 4} más
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Quick start por grupo muscular ────────────── */}
      <View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              color: "#6B6B80",
              fontSize: 12,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Entrenar por grupo
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {MUSCLE_GROUPS.map((group) => (
            <TouchableOpacity
              key={group.key}
              onPress={() => onNavigateToTab("exercises", group.key)}
              activeOpacity={0.75}
              style={{
                width: "31%",
                backgroundColor: "#1a1a2e",
                borderWidth: 1,
                borderColor: "#252540",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons name={group.icon as any} size={22} color="#6C63FF" />
              <Text style={{ color: "#c0c0d0", fontSize: 12, fontWeight: "600" }}>
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Ejercicios recientes ──────────────────────── */}
      {!loading && recentExercises.length > 0 && (
        <View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text
              style={{
                color: "#6B6B80",
                fontSize: 12,
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: 0.8,
              }}
            >
              Usados recientemente
            </Text>
            <TouchableOpacity
              onPress={() => onNavigateToTab("exercises")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ color: "#6C63FF", fontSize: 13, fontWeight: "600" }}>
                Ver todos
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ gap: 8 }}>
            {recentExercises.map((ex) => {
              const pr = ex.externalId ? prsMap.get(ex.externalId) : undefined;
              return (
                <TouchableOpacity
                  key={ex.externalId ?? ex.exerciseName}
                  onPress={() =>
                    handleOpenExerciseDetail(ex.externalId, ex.exerciseName)
                  }
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: "#1a1a2e",
                    borderWidth: 1,
                    borderColor: "#252540",
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "600",
                        fontSize: 14,
                        textTransform: "capitalize",
                      }}
                      numberOfLines={1}
                    >
                      {ex.exerciseName}
                    </Text>
                    {pr && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          marginTop: 3,
                        }}
                      >
                        <Ionicons name="trophy-outline" size={11} color="#F59E0B" />
                        <Text style={{ color: "#F59E0B", fontSize: 11 }}>
                          {pr.weight}kg × {pr.reps}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Agregar directo */}
                  <TouchableOpacity
                    onPress={() => handleAddRecentToWorkout(ex)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      backgroundColor: "#6C63FF20",
                      borderRadius: 10,
                      padding: 8,
                    }}
                  >
                    <Ionicons name="add" size={18} color="#6C63FF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Loading inicial */}
      {loading && (
        <View style={{ alignItems: "center", paddingVertical: 20 }}>
          <ActivityIndicator color="#6C63FF" />
        </View>
      )}

      {/* ── Acceso a plantillas ───────────────────────── */}
      <TouchableOpacity
        onPress={() => onNavigateToTab("templates")}
        activeOpacity={0.8}
        style={{
          backgroundColor: "#1a1a2e",
          borderWidth: 1,
          borderColor: "#252540",
          borderRadius: 20,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: "#6C63FF20",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="copy-outline" size={22} color="#6C63FF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
            Mis plantillas
          </Text>
          <Text style={{ color: "#6B6B80", fontSize: 12, marginTop: 2 }}>
            Rutinas guardadas para iniciar rápido
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#44444f" />
      </TouchableOpacity>

      {/* Detail modal */}
      {loadingDetail && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#00000050",
          }}
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      )}

      <ExerciseDetailModal
        exercise={detailExercise}
        visible={!!detailExercise}
        bestSet={
          detailExercise?.id ? prsMap.get(detailExercise.id) ?? null : null
        }
        showAddButton
        onClose={() => setDetailExercise(null)}
        onAdd={() => {
          if (detailExercise) {
            if (!activeWorkout.isActive) startWorkout("Workout");
            addExercise({
              externalId: detailExercise.id,
              exerciseName: detailExercise.name,
              bodyPart: detailExercise.bodyPart,
              target: detailExercise.target,
              equipment: detailExercise.equipment,
              restSeconds: 90,
            });
            setDetailExercise(null);
            router.push("/workout/active");
          }
        }}
      />
    </ScrollView>
  );
}
