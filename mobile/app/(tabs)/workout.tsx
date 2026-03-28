import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useWorkoutStore } from "@/store/workoutStore";
import { useTour } from "@/context/TourContext";
import {
  workoutAPI,
  exerciseAPI,
  Exercise,
  LastWorkout,
  RecentExercise,
  WorkoutTemplate,
} from "@/lib/api";

import WorkoutActiveBar from "@/components/workout/WorkoutActiveBar";
import ExerciseCard from "@/components/workout/ExerciseCard";
import ExerciseDetailModal from "@/components/workout/ExerciseDetailModal";
import TemplateCard from "@/components/workout/TemplateCard";
import TemplatePreviewModal from "@/components/workout/TemplatePreviewModal";

// ─── Constantes ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const BODY_PART_LABELS: Record<string, string> = {
  back: "Espalda",
  cardio: "Cardio",
  chest: "Pecho",
  "lower arms": "Antebrazos",
  "lower legs": "Pantorrillas",
  neck: "Cuello",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist: "Abdomen",
};

const EQUIPMENT_FILTERS = [
  { key: "barbell", label: "Barra" },
  { key: "dumbbell", label: "Mancuerna" },
  { key: "machine", label: "Máquina" },
  { key: "cable", label: "Cable" },
  { key: "body weight", label: "Cuerpo" },
  { key: "kettlebell", label: "Kettlebell" },
];

const SORT_OPTIONS = [
  { key: "alpha", label: "A–Z" },
  { key: "frequent", label: "Frecuentes" },
  { key: "recent", label: "Recientes" },
] as const;

type SortOption = "alpha" | "frequent" | "recent";

const MUSCLE_GROUPS = [
  { key: "chest", label: "Pecho", icon: "body-outline" },
  { key: "back", label: "Espalda", icon: "accessibility-outline" },
  { key: "upper legs", label: "Piernas", icon: "walk-outline" },
  { key: "shoulders", label: "Hombros", icon: "person-outline" },
  { key: "upper arms", label: "Brazos", icon: "barbell-outline" },
  { key: "waist", label: "Abdomen", icon: "ellipse-outline" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return "Hace menos de 1 hora";
  if (diffHours < 24) return `Hace ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return `Hace ${Math.floor(diffDays / 7)} semanas`;
}

function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function WorkoutScreen() {
  const { activeWorkout, startWorkout, addExercise } = useWorkoutStore();
  const { isActive: isTourActive, step, workoutPhase, enterWorkoutScreen } = useTour();

  // ── Start section ──────────────────────────────────────────────────────────
  const [lastWorkout, setLastWorkout] = useState<LastWorkout | null>(null);
  const [recentExercises, setRecentExercises] = useState<RecentExercise[]>([]);
  const [prsMap, setPrsMap] = useState<Map<string, { weight: number; reps: number }>>(new Map());
  const [loadingStart, setLoadingStart] = useState(true);

  // ── Templates ──────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // ── Exercises ──────────────────────────────────────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [selectedBodyPart, setSelectedBodyPart] = useState("chest");
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("alpha");
  const [activeDropdown, setActiveDropdown] = useState<"bodypart" | "equipment" | "sort" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [frequentIds, setFrequentIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [loadingParts, setLoadingParts] = useState(true);
  const [loadingFirst, setLoadingFirst] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searching, setSearching] = useState(false);

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [modalExercise, setModalExercise] = useState<Exercise | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);
  const isSearchMode = searchQuery.length >= 2;

  // ── Tour ───────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (isTourActive && step === 2 && workoutPhase === "tab") enterWorkoutScreen();
    }, [isTourActive, step, workoutPhase])
  );

  // ── Carga inicial (start section + metadatos de ejercicios) ────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [lastRes, recentRes, prsRes, partsRes, frequentRes, recentIdsRes] =
          await Promise.all([
            workoutAPI.getLast().catch(() => ({ data: null })),
            workoutAPI.getRecentExercises(6).catch(() => ({ data: [] })),
            workoutAPI.getPRs().catch(() => ({ data: [] })),
            exerciseAPI.getBodyParts().catch(() => ({ data: [] })),
            workoutAPI.getFrequentExercises(30).catch(() => ({ data: [] })),
            workoutAPI.getRecentExercises(30).catch(() => ({ data: [] })),
          ]);

        setLastWorkout(lastRes.data);
        setRecentExercises(recentRes.data ?? []);

        const map = new Map<string, { weight: number; reps: number }>();
        for (const pr of prsRes.data ?? []) {
          if (pr.externalId && pr.weight && pr.reps) {
            map.set(pr.externalId, { weight: pr.weight, reps: pr.reps });
          }
        }
        setPrsMap(map);
        setBodyParts(partsRes.data ?? []);
        setFrequentIds(
          (frequentRes.data ?? [])
            .map((e: { externalId: string | null }) => e.externalId)
            .filter(Boolean) as string[]
        );
        setRecentIds(
          (recentIdsRes.data ?? [])
            .map((e: { externalId: string | null }) => e.externalId)
            .filter(Boolean) as string[]
        );
      } catch {
        // graceful
      } finally {
        setLoadingStart(false);
        setLoadingParts(false);
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Plantillas: recargar en cada foco ─────────────────────────────────────
  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const { data } = await workoutAPI.getTemplates();
      setTemplates(data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadTemplates(); }, [loadTemplates]));

  // ── Ejercicios: primera página ─────────────────────────────────────────────
  const fetchFirstPage = useCallback(async (bodyPart: string) => {
    setLoadingFirst(true);
    setExercises([]);
    setOffset(0);
    setHasMore(true);
    fetchingRef.current = false;
    try {
      const { data } = await exerciseAPI.getByBodyPart(bodyPart, PAGE_SIZE, 0);
      const results = data ?? [];
      setExercises(results);
      setOffset(results.length);
      setHasMore(results.length === PAGE_SIZE);
    } catch {
      setExercises([]);
      setHasMore(false);
    } finally {
      setLoadingFirst(false);
    }
  }, []);

  useEffect(() => {
    if (!isSearchMode) fetchFirstPage(selectedBodyPart);
  }, [selectedBodyPart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ejercicios: páginas siguientes (lazy load) ─────────────────────────────
  const fetchNextPage = useCallback(async () => {
    if (fetchingRef.current || !hasMore || isSearchMode) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const { data } = await exerciseAPI.getByBodyPart(selectedBodyPart, PAGE_SIZE, offset);
      const results = data ?? [];
      if (results.length === 0) {
        setHasMore(false);
      } else {
        setExercises((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          return [...prev, ...results.filter((e: Exercise) => !existingIds.has(e.id))];
        });
        setOffset((prev) => prev + results.length);
        setHasMore(results.length === PAGE_SIZE);
      }
    } catch {
      // no bloquear UX
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, isSearchMode, selectedBodyPart, offset]);

  // ── Búsqueda con debounce ──────────────────────────────────────────────────
  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!text) {
        fetchFirstPage(selectedBodyPart);
        return;
      }
      if (text.length < 2) return;
      setSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          const { data } = await exerciseAPI.search(text);
          setExercises(data ?? []);
          setHasMore(false);
        } catch {
          setExercises([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [selectedBodyPart, fetchFirstPage]
  );

  // ── Ejercicios filtrados y ordenados ───────────────────────────────────────
  const displayedExercises = useMemo(() => {
    let list = exercises;
    if (selectedEquipment) {
      list = list.filter((e) =>
        e.equipment.toLowerCase().includes(selectedEquipment.toLowerCase())
      );
    }
    if (sortBy === "alpha") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "frequent") {
      const order = new Map(frequentIds.map((id, i) => [id, i]));
      list = [...list].sort(
        (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)
      );
    } else if (sortBy === "recent") {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      list = [...list].sort(
        (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999)
      );
    }
    return list;
  }, [exercises, selectedEquipment, sortBy, frequentIds, recentIds]);

  // ── Acciones: workout ──────────────────────────────────────────────────────
  const handleStartEmpty = useCallback(() => {
    if (activeWorkout.isActive) {
      Alert.alert("Workout en curso", "Ya tienes un workout activo.", [
        { text: "Cancelar", style: "cancel" },
        { text: "Continuar activo", onPress: () => router.push("/workout/active") },
      ]);
      return;
    }
    startWorkout("Workout");
    router.push("/workout/active");
  }, [activeWorkout.isActive, startWorkout]);

  const handleStartWithTemplate = useCallback(
    async (templateId: string, name: string) => {
      if (activeWorkout.isActive) {
        Alert.alert("Workout en curso", "Ya tienes un workout activo.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar activo", onPress: () => router.push("/workout/active") },
        ]);
        return;
      }
      try {
        const { data: workout } = await workoutAPI.start(name, templateId);
        startWorkout(name);
        useWorkoutStore.getState().setWorkoutId(workout.id);
        const { data: tmps } = await workoutAPI.getTemplates();
        const template = tmps.find((t: WorkoutTemplate) => t.id === templateId);
        if (template) {
          const seen = new Set<string>();
          for (const ts of template.templateSets.sort(
            (a: { order: number }, b: { order: number }) => a.order - b.order
          )) {
            if (!seen.has(ts.exerciseName)) {
              seen.add(ts.exerciseName);
              addExercise({
                externalId: ts.externalId ?? "",
                exerciseName: ts.exerciseName,
                bodyPart: "",
                target: "",
                equipment: "",
                restSeconds: ts.restSeconds,
              });
            }
          }
        }
        router.push("/workout/active");
      } catch {
        Alert.alert("Error", "No se pudo iniciar el workout. Intenta de nuevo.");
      }
    },
    [activeWorkout.isActive, startWorkout, addExercise]
  );

  const handleRepeatLastWorkout = useCallback(() => {
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
  }, [lastWorkout, startWorkout, addExercise]);

  // ── Acciones: ejercicios ───────────────────────────────────────────────────
  const handleAddToWorkout = useCallback(
    (exercise: Exercise) => {
      if (activeWorkout.isActive) {
        addExercise({
          externalId: exercise.id,
          exerciseName: exercise.name,
          bodyPart: exercise.bodyPart,
          target: exercise.target,
          equipment: exercise.equipment,
          restSeconds: 90,
        });
        router.push("/workout/active");
      } else {
        Alert.alert(
          "Sin workout activo",
          "¿Quieres iniciar un workout con este ejercicio?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Iniciar",
              onPress: () => {
                startWorkout("Workout");
                addExercise({
                  externalId: exercise.id,
                  exerciseName: exercise.name,
                  bodyPart: exercise.bodyPart,
                  target: exercise.target,
                  equipment: exercise.equipment,
                  restSeconds: 90,
                });
                router.push("/workout/active");
              },
            },
          ]
        );
      }
    },
    [activeWorkout.isActive, addExercise, startWorkout]
  );

  const handleOpenExerciseDetail = useCallback(async (externalId: string | null) => {
    if (!externalId) return;
    setLoadingDetail(true);
    try {
      const { data } = await exerciseAPI.getById(externalId);
      setModalExercise(data);
    } catch {
      // ignore
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ── Acciones: plantillas ───────────────────────────────────────────────────
  const handleUseTemplate = useCallback(
    (template: WorkoutTemplate) => {
      if (activeWorkout.isActive) {
        Alert.alert("Workout en curso", "Ya tienes un workout activo.", [
          { text: "Cancelar", style: "cancel" },
          { text: "Continuar activo", onPress: () => router.push("/workout/active") },
        ]);
        return;
      }
      handleStartWithTemplate(template.id, template.name);
    },
    [activeWorkout.isActive, handleStartWithTemplate]
  );

  const handleDeleteTemplate = useCallback(async (template: WorkoutTemplate) => {
    try {
      await workoutAPI.deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch {
      Alert.alert("Error", "No se pudo eliminar la plantilla.");
    }
  }, []);

  // ── Render de cada exercise card ───────────────────────────────────────────
  const renderExercise = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseCard
        exercise={item}
        bestSet={prsMap.get(item.id) ?? null}
        showAddButton
        onPress={() => setModalExercise(item)}
        onAdd={() => handleAddToWorkout(item)}
      />
    ),
    [prsMap, handleAddToWorkout]
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // ── Header del FlatList (todo lo que va encima de los ejercicios) ──────────
  const renderHeader = () => (
    <View>

      {/* Banner tour */}
      {isTourActive && step === 2 && workoutPhase === "inScreen" && (
        <View
          style={{
            marginBottom: 12,
            borderRadius: 16,
            overflow: "hidden",
            borderWidth: 1.5,
            borderColor: "#F59E0B50",
            backgroundColor: "#F59E0B08",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            <Text style={{ fontSize: 22 }}>🏋️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
                ¡Última misión!
              </Text>
              <Text style={{ color: "#8888a0", fontSize: 12, marginTop: 2 }}>
                Toca "Iniciar entrenamiento" y completa tu primera sesión
              </Text>
            </View>
            <View
              style={{
                backgroundColor: "#F59E0B20",
                borderRadius: 10,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "700" }}>
                3/3
              </Text>
            </View>
          </View>
          <View style={{ height: 3, backgroundColor: "#F59E0B" }} />
        </View>
      )}

      {/* Banner workout activo */}
      <WorkoutActiveBar />

      {/* ── Botón iniciar entrenamiento ─────────────────────────────────── */}
      <TouchableOpacity
        onPress={handleStartEmpty}
        activeOpacity={0.85}
        style={{
          backgroundColor: "#6C63FF",
          borderRadius: 20,
          paddingVertical: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          marginBottom: 24,
        }}
      >
        <Ionicons name="add-circle" size={24} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 17 }}>
          Iniciar entrenamiento
        </Text>
      </TouchableOpacity>

      {/* ── Último entrenamiento ────────────────────────────────────────── */}
      {!loadingStart && lastWorkout && (
        <View style={{ marginBottom: 24 }}>
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
                <Text style={{ color: "#6C63FF", fontWeight: "700", fontSize: 13 }}>
                  Repetir
                </Text>
              </View>
            </View>
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

      {/* ── Quick start por grupo muscular ─────────────────────────────── */}
      <View style={{ marginBottom: 24 }}>
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
          Entrenar por grupo
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {MUSCLE_GROUPS.map((group) => (
            <TouchableOpacity
              key={group.key}
              onPress={() => {
                setSelectedBodyPart(group.key);
                setSearchQuery("");
              }}
              activeOpacity={0.75}
              style={{
                width: "31%",
                backgroundColor:
                  selectedBodyPart === group.key ? "#6C63FF20" : "#1a1a2e",
                borderWidth: 1,
                borderColor:
                  selectedBodyPart === group.key ? "#6C63FF" : "#252540",
                borderRadius: 16,
                paddingVertical: 14,
                alignItems: "center",
                gap: 6,
              }}
            >
              <Ionicons
                name={group.icon as any}
                size={22}
                color="#6C63FF"
              />
              <Text
                style={{
                  color:
                    selectedBodyPart === group.key ? "#6C63FF" : "#c0c0d0",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {group.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Ejercicios recientes ─────────────────────────────────────────── */}
      {!loadingStart && recentExercises.length > 0 && (
        <View style={{ marginBottom: 24 }}>
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
            Usados recientemente
          </Text>
          <View style={{ gap: 8 }}>
            {recentExercises.map((ex) => {
              const pr = ex.externalId ? prsMap.get(ex.externalId) : undefined;
              return (
                <TouchableOpacity
                  key={ex.externalId ?? ex.exerciseName}
                  onPress={() => handleOpenExerciseDetail(ex.externalId)}
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
                        <Ionicons
                          name="trophy-outline"
                          size={11}
                          color="#F59E0B"
                        />
                        <Text style={{ color: "#F59E0B", fontSize: 11 }}>
                          {pr.weight}kg × {pr.reps}
                        </Text>
                      </View>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
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
                    }}
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

      {/* ── Plantillas ──────────────────────────────────────────────────── */}
      <View style={{ marginBottom: 24 }}>
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
            Plantillas
          </Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Crear plantilla",
                'Completa un entrenamiento y al finalizar elige "Guardar como plantilla".',
                [
                  { text: "Entendido" },
                  {
                    text: "Iniciar workout",
                    onPress: () => router.push("/workout/active"),
                  },
                ]
              )
            }
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#6C63FF" />
          </TouchableOpacity>
        </View>

        {loadingTemplates ? (
          <ActivityIndicator color="#6C63FF" />
        ) : templates.length === 0 ? (
          <View
            style={{
              backgroundColor: "#1a1a2e",
              borderWidth: 1,
              borderColor: "#252540",
              borderRadius: 16,
              padding: 20,
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="copy-outline" size={32} color="#33334a" />
            <Text
              style={{ color: "#6B6B80", fontSize: 13, textAlign: "center" }}
            >
              Aún no tienes plantillas. Completa un workout y guárdalo como
              plantilla.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          >
            {templates.map((template) => (
              <View key={template.id} style={{ width: 260 }}>
                <TemplateCard
                  template={template}
                  onUse={() => handleUseTemplate(template)}
                  onPreview={() => {
                    setSelectedTemplate(template);
                    setPreviewVisible(true);
                  }}
                  onDelete={() => handleDeleteTemplate(template)}
                />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* ── Separador: sección ejercicios ───────────────────────────────── */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}
      >
        <View style={{ flex: 1, height: 1, backgroundColor: "#252540" }} />
        <Text
          style={{
            color: "#6B6B80",
            fontSize: 12,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Ejercicios
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: "#252540" }} />
      </View>

      {/* Buscador */}
      <View
        style={{
          marginBottom: 10,
          backgroundColor: "#1a1a2e",
          borderWidth: 1,
          borderColor: "#252540",
          borderRadius: 16,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 14,
          paddingVertical: 10,
          gap: 10,
        }}
      >
        <Ionicons name="search-outline" size={18} color="#6B6B80" />
        <TextInput
          style={{ flex: 1, color: "#fff", fontSize: 15 }}
          placeholder="Buscar ejercicio..."
          placeholderTextColor="#6B6B80"
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator size="small" color="#6C63FF" />}
        {searchQuery.length > 0 && !searching && (
          <TouchableOpacity
            onPress={() => handleSearch("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#6B6B80" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Fila de botones dropdown ─────────────────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>

        {/* Grupo muscular (oculto en modo búsqueda) */}
        {!isSearchMode && (
          <TouchableOpacity
            onPress={() =>
              setActiveDropdown(activeDropdown === "bodypart" ? null : "bodypart")
            }
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor:
                activeDropdown === "bodypart"
                  ? "#6C63FF25"
                  : selectedBodyPart !== "chest"
                  ? "#6C63FF15"
                  : "#1a1a2e",
              borderWidth: 1,
              borderColor:
                activeDropdown === "bodypart" || selectedBodyPart !== "chest"
                  ? "#6C63FF"
                  : "#252540",
              borderRadius: 12,
              paddingHorizontal: 10,
              paddingVertical: 9,
            }}
          >
            <Text
              style={{
                flex: 1,
                color:
                  activeDropdown === "bodypart" || selectedBodyPart !== "chest"
                    ? "#6C63FF"
                    : "#8888a0",
                fontSize: 12,
                fontWeight: "600",
              }}
              numberOfLines={1}
            >
              {BODY_PART_LABELS[selectedBodyPart] || selectedBodyPart}
            </Text>
            <Ionicons
              name={activeDropdown === "bodypart" ? "chevron-up" : "chevron-down"}
              size={13}
              color={
                activeDropdown === "bodypart" || selectedBodyPart !== "chest"
                  ? "#6C63FF"
                  : "#6B6B80"
              }
            />
          </TouchableOpacity>
        )}

        {/* Equipo */}
        <TouchableOpacity
          onPress={() =>
            setActiveDropdown(activeDropdown === "equipment" ? null : "equipment")
          }
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor:
              activeDropdown === "equipment"
                ? "#6C63FF25"
                : selectedEquipment
                ? "#6C63FF15"
                : "#1a1a2e",
            borderWidth: 1,
            borderColor:
              activeDropdown === "equipment" || selectedEquipment
                ? "#6C63FF"
                : "#252540",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              flex: 1,
              color:
                activeDropdown === "equipment" || selectedEquipment
                  ? "#6C63FF"
                  : "#8888a0",
              fontSize: 12,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {selectedEquipment
              ? EQUIPMENT_FILTERS.find((e) => e.key === selectedEquipment)?.label ?? "Equipo"
              : "Equipo"}
          </Text>
          <Ionicons
            name={activeDropdown === "equipment" ? "chevron-up" : "chevron-down"}
            size={13}
            color={
              activeDropdown === "equipment" || selectedEquipment
                ? "#6C63FF"
                : "#6B6B80"
            }
          />
        </TouchableOpacity>

        {/* Orden */}
        <TouchableOpacity
          onPress={() =>
            setActiveDropdown(activeDropdown === "sort" ? null : "sort")
          }
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            backgroundColor:
              activeDropdown === "sort"
                ? "#6C63FF25"
                : sortBy !== "alpha"
                ? "#6C63FF15"
                : "#1a1a2e",
            borderWidth: 1,
            borderColor:
              activeDropdown === "sort" || sortBy !== "alpha"
                ? "#6C63FF"
                : "#252540",
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              flex: 1,
              color:
                activeDropdown === "sort" || sortBy !== "alpha"
                  ? "#6C63FF"
                  : "#8888a0",
              fontSize: 12,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? "A–Z"}
          </Text>
          <Ionicons
            name={activeDropdown === "sort" ? "chevron-up" : "chevron-down"}
            size={13}
            color={
              activeDropdown === "sort" || sortBy !== "alpha"
                ? "#6C63FF"
                : "#6B6B80"
            }
          />
        </TouchableOpacity>
      </View>

      {/* Contador */}
      <Text
        style={{
          color: "#6B6B80",
          fontSize: 12,
          fontWeight: "600",
          marginBottom: 10,
        }}
      >
        {displayedExercises.length} ejercicio
        {displayedExercises.length !== 1 ? "s" : ""}
        {!isSearchMode && hasMore ? "+" : ""}
      </Text>

      {/* ── Panel de dropdown ────────────────────────────────────────────── */}

      {/* Dropdown: Grupo muscular */}
      {activeDropdown === "bodypart" && !isSearchMode && (
        <View
          style={{
            backgroundColor: "#141428",
            borderWidth: 1,
            borderColor: "#252540",
            borderRadius: 16,
            padding: 8,
            marginBottom: 10,
          }}
        >
          {loadingParts ? (
            <ActivityIndicator color="#6C63FF" style={{ padding: 12 }} />
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
              {bodyParts.map((part) => (
                <TouchableOpacity
                  key={part}
                  onPress={() => {
                    setSelectedBodyPart(part);
                    setSelectedEquipment(null);
                    setActiveDropdown(null);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor:
                      selectedBodyPart === part ? "#6C63FF" : "#1a1a2e",
                    borderWidth: 1,
                    borderColor:
                      selectedBodyPart === part ? "#6C63FF" : "#252540",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {selectedBodyPart === part && (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  )}
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: selectedBodyPart === part ? "700" : "500",
                      color: selectedBodyPart === part ? "#fff" : "#8888a0",
                    }}
                  >
                    {BODY_PART_LABELS[part] || part}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Dropdown: Equipo */}
      {activeDropdown === "equipment" && (
        <View
          style={{
            backgroundColor: "#141428",
            borderWidth: 1,
            borderColor: "#252540",
            borderRadius: 16,
            padding: 8,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {/* Opción "Todos" */}
            <TouchableOpacity
              onPress={() => {
                setSelectedEquipment(null);
                setActiveDropdown(null);
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: !selectedEquipment ? "#6C63FF" : "#1a1a2e",
                borderWidth: 1,
                borderColor: !selectedEquipment ? "#6C63FF" : "#252540",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              {!selectedEquipment && (
                <Ionicons name="checkmark" size={12} color="#fff" />
              )}
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: !selectedEquipment ? "700" : "500",
                  color: !selectedEquipment ? "#fff" : "#8888a0",
                }}
              >
                Todos
              </Text>
            </TouchableOpacity>

            {EQUIPMENT_FILTERS.map((eq) => (
              <TouchableOpacity
                key={eq.key}
                onPress={() => {
                  setSelectedEquipment(eq.key);
                  setActiveDropdown(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor:
                    selectedEquipment === eq.key ? "#6C63FF" : "#1a1a2e",
                  borderWidth: 1,
                  borderColor:
                    selectedEquipment === eq.key ? "#6C63FF" : "#252540",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {selectedEquipment === eq.key && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: selectedEquipment === eq.key ? "700" : "500",
                    color: selectedEquipment === eq.key ? "#fff" : "#8888a0",
                  }}
                >
                  {eq.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Dropdown: Orden */}
      {activeDropdown === "sort" && (
        <View
          style={{
            backgroundColor: "#141428",
            borderWidth: 1,
            borderColor: "#252540",
            borderRadius: 16,
            padding: 8,
            marginBottom: 10,
          }}
        >
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                onPress={() => {
                  setSortBy(opt.key);
                  setActiveDropdown(null);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor:
                    sortBy === opt.key ? "#6C63FF" : "#1a1a2e",
                  borderWidth: 1,
                  borderColor:
                    sortBy === opt.key ? "#6C63FF" : "#252540",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {sortBy === opt.key && (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                )}
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: sortBy === opt.key ? "700" : "500",
                    color: sortBy === opt.key ? "#fff" : "#8888a0",
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0d0d1a" }}>

      {/* Título fijo */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 12,
        }}
      >
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>
          Workout
        </Text>
        <Text style={{ color: "#6B6B80", fontSize: 13, marginTop: 2 }}>
          1,300+ ejercicios · templates · progreso
        </Text>
      </View>

      {/* Lista principal — todo scrollable en un solo FlatList */}
      <FlatList
        data={loadingFirst ? [] : displayedExercises}
        keyExtractor={keyExtractor}
        renderItem={renderExercise}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!isSearchMode) fetchNextPage();
        }}
        ListFooterComponent={
          loadingFirst ? (
            <View
              style={{
                paddingVertical: 40,
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color="#6C63FF" />
              <Text style={{ color: "#6B6B80", marginTop: 12 }}>
                Cargando ejercicios...
              </Text>
            </View>
          ) : loadingMore ? (
            <View
              style={{
                paddingVertical: 20,
                alignItems: "center",
              }}
            >
              <ActivityIndicator color="#6C63FF" />
              <Text
                style={{ color: "#6B6B80", fontSize: 12, marginTop: 6 }}
              >
                Cargando más ejercicios...
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loadingFirst ? (
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 60,
                gap: 12,
              }}
            >
              <Ionicons name="barbell-outline" size={48} color="#33334a" />
              <Text
                style={{
                  color: "#c0c0d0",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                {isSearchMode
                  ? `Sin resultados para "${searchQuery}"`
                  : "Sin ejercicios con estos filtros"}
              </Text>
              {selectedEquipment && (
                <TouchableOpacity
                  onPress={() => setSelectedEquipment(null)}
                  style={{
                    backgroundColor: "#6C63FF20",
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: "#6C63FF", fontWeight: "600" }}>
                    Quitar filtro de equipo
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />

      {/* Overlay de carga del detalle */}
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
            backgroundColor: "#00000060",
          }}
          pointerEvents="none"
        >
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      )}

      {/* Modal de detalle de ejercicio */}
      <ExerciseDetailModal
        exercise={modalExercise}
        visible={!!modalExercise}
        bestSet={modalExercise ? (prsMap.get(modalExercise.id) ?? null) : null}
        showAddButton
        onClose={() => setModalExercise(null)}
        onAdd={() => {
          if (modalExercise) {
            handleAddToWorkout(modalExercise);
            setModalExercise(null);
          }
        }}
      />

      {/* Modal de preview de plantilla */}
      <TemplatePreviewModal
        template={selectedTemplate}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onUse={() => {
          if (selectedTemplate) handleUseTemplate(selectedTemplate);
        }}
      />

    </SafeAreaView>
  );
}
