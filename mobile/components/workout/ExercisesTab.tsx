import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { router } from "expo-router";
import { exerciseAPI, workoutAPI, Exercise } from "@/lib/api";
import { useWorkoutStore } from "@/store/workoutStore";
import ExerciseCard from "./ExerciseCard";
import ExerciseDetailModal from "./ExerciseDetailModal";

// ─── Constantes ───────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────

interface ExercisesTabProps {
  initialBodyPart?: string;
}

// ─── Componente ───────────────────────────────────────

export default function ExercisesTab({ initialBodyPart }: ExercisesTabProps) {
  const { activeWorkout, startWorkout, addExercise } = useWorkoutStore();

  // ── Filtros ─────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>(
    initialBodyPart ?? "chest"
  );
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("alpha");

  // ── Datos de ejercicios ──────────────────────────────
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // ── Metadatos del usuario ────────────────────────────
  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [prsMap, setPrsMap] = useState<Map<string, { weight: number; reps: number }>>(new Map());
  const [frequentIds, setFrequentIds] = useState<string[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // ── Loading states ───────────────────────────────────
  const [loadingParts, setLoadingParts] = useState(true);
  const [loadingFirst, setLoadingFirst] = useState(false);  // carga inicial de página
  const [loadingMore, setLoadingMore] = useState(false);    // carga de página siguiente
  const [searching, setSearching] = useState(false);

  // ── Modal ────────────────────────────────────────────
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  // ── Refs para evitar doble fetch ─────────────────────
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef(false);   // guard contra onEndReached duplicado
  const isSearchMode = searchQuery.length >= 2;

  // ── Carga de metadatos (una sola vez) ─────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const [partsRes, prsRes, frequentRes, recentRes] = await Promise.all([
          exerciseAPI.getBodyParts(),
          workoutAPI.getPRs().catch(() => ({ data: [] })),
          workoutAPI.getFrequentExercises(30).catch(() => ({ data: [] })),
          workoutAPI.getRecentExercises(30).catch(() => ({ data: [] })),
        ]);

        setBodyParts(partsRes.data ?? []);

        const map = new Map<string, { weight: number; reps: number }>();
        for (const pr of (prsRes.data ?? [])) {
          if (pr.externalId && pr.weight && pr.reps) {
            map.set(pr.externalId, { weight: pr.weight, reps: pr.reps });
          }
        }
        setPrsMap(map);

        setFrequentIds(
          (frequentRes.data ?? [])
            .map((e: { externalId: string | null }) => e.externalId)
            .filter(Boolean) as string[]
        );
        setRecentIds(
          (recentRes.data ?? [])
            .map((e: { externalId: string | null }) => e.externalId)
            .filter(Boolean) as string[]
        );
      } catch {
        // graceful
      } finally {
        setLoadingParts(false);
      }
    };
    init();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch primera página por body part ───────────────
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
      // Si devolvió menos de PAGE_SIZE, ya no hay más
      setHasMore(results.length === PAGE_SIZE);
    } catch {
      setExercises([]);
      setHasMore(false);
    } finally {
      setLoadingFirst(false);
    }
  }, []);

  // ── Fetch página siguiente (lazy load) ───────────────
  const fetchNextPage = useCallback(async () => {
    if (fetchingRef.current || !hasMore || isSearchMode) return;
    fetchingRef.current = true;
    setLoadingMore(true);
    try {
      const { data } = await exerciseAPI.getByBodyPart(
        selectedBodyPart,
        PAGE_SIZE,
        offset
      );
      const results = data ?? [];
      if (results.length === 0) {
        setHasMore(false);
      } else {
        setExercises((prev) => {
          // Evitar duplicados por externalId
          const existingIds = new Set(prev.map((e) => e.id));
          const fresh = results.filter((e: Exercise) => !existingIds.has(e.id));
          return [...prev, ...fresh];
        });
        setOffset((prev) => prev + results.length);
        setHasMore(results.length === PAGE_SIZE);
      }
    } catch {
      // no bloquear UX si falla una página
    } finally {
      setLoadingMore(false);
      fetchingRef.current = false;
    }
  }, [hasMore, isSearchMode, selectedBodyPart, offset]);

  // ── Recargar cuando cambia el body part ──────────────
  useEffect(() => {
    if (!isSearchMode) fetchFirstPage(selectedBodyPart);
  }, [selectedBodyPart]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Búsqueda con debounce (devuelve TODOS los resultados) ─
  const handleSearch = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);

      if (!text) {
        // Volver al modo por body part
        fetchFirstPage(selectedBodyPart);
        return;
      }
      if (text.length < 2) return;

      setSearching(true);
      searchTimeout.current = setTimeout(async () => {
        try {
          // Search devuelve todos los coincidentes sin paginación
          const { data } = await exerciseAPI.search(text);
          setExercises(data ?? []);
          setHasMore(false); // search no usa paginación
        } catch {
          setExercises([]);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [selectedBodyPart, fetchFirstPage]
  );

  // ── Filtrado y ordenamiento (client-side) ─────────────
  const displayedExercises = useMemo(() => {
    let list = exercises;

    // Filtro de equipo
    if (selectedEquipment) {
      list = list.filter((e) =>
        e.equipment.toLowerCase().includes(selectedEquipment.toLowerCase())
      );
    }

    // Sort solo en modo búsqueda o cuando hay todos los datos cargados;
    // en modo paginación, el sort puede quedar incompleto — se muestra aviso
    if (sortBy === "alpha") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "frequent") {
      const order = new Map(frequentIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => {
        const ai = order.get(a.id) ?? 9999;
        const bi = order.get(b.id) ?? 9999;
        return ai - bi;
      });
    } else if (sortBy === "recent") {
      const order = new Map(recentIds.map((id, i) => [id, i]));
      list = [...list].sort((a, b) => {
        const ai = order.get(a.id) ?? 9999;
        const bi = order.get(b.id) ?? 9999;
        return ai - bi;
      });
    }

    return list;
  }, [exercises, selectedEquipment, sortBy, frequentIds, recentIds]);

  // ── Acciones ──────────────────────────────────────────
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

  const renderExercise = useCallback(
    ({ item }: { item: Exercise }) => (
      <ExerciseCard
        exercise={item}
        bestSet={prsMap.get(item.id) ?? null}
        showAddButton
        onPress={() => setSelectedExercise(item)}
        onAdd={() => handleAddToWorkout(item)}
      />
    ),
    [prsMap, handleAddToWorkout]
  );

  const keyExtractor = useCallback((item: Exercise) => item.id, []);

  // Footer de la lista: spinner de carga de más
  const ListFooter = useMemo(() => {
    if (!loadingMore) return null;
    return (
      <View style={{ paddingVertical: 20, alignItems: "center" }}>
        <ActivityIndicator color="#6C63FF" />
        <Text style={{ color: "#6B6B80", fontSize: 12, marginTop: 6 }}>
          Cargando más ejercicios...
        </Text>
      </View>
    );
  }, [loadingMore]);

  // ── Render ─────────────────────────────────────────────
  return (
    <View style={{ flex: 1 }}>

      {/* Buscador */}
      <View
        style={{
          marginHorizontal: 20,
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
        {(searching) && <ActivityIndicator size="small" color="#6C63FF" />}
        {searchQuery.length > 0 && !searching && (
          <TouchableOpacity
            onPress={() => handleSearch("")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color="#6B6B80" />
          </TouchableOpacity>
        )}
      </View>

      {/* Equipment filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        style={{ marginBottom: 8, flexGrow: 0 }}
      >
        {EQUIPMENT_FILTERS.map((eq) => (
          <TouchableOpacity
            key={eq.key}
            onPress={() =>
              setSelectedEquipment(selectedEquipment === eq.key ? null : eq.key)
            }
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: selectedEquipment === eq.key ? "#6C63FF" : "#252540",
              backgroundColor: selectedEquipment === eq.key ? "#6C63FF20" : "#1a1a2e",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: "600",
                color: selectedEquipment === eq.key ? "#6C63FF" : "#6B6B80",
              }}
            >
              {eq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Body part filters (solo sin búsqueda activa) */}
      {!isSearchMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
          style={{ marginBottom: 10, flexGrow: 0 }}
        >
          {loadingParts ? (
            <ActivityIndicator color="#6C63FF" />
          ) : (
            bodyParts.map((part) => (
              <TouchableOpacity
                key={part}
                onPress={() => {
                  setSelectedBodyPart(part);
                  setSelectedEquipment(null);
                }}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: selectedBodyPart === part ? "#6C63FF" : "#252540",
                  backgroundColor: selectedBodyPart === part ? "#6C63FF" : "#1a1a2e",
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: selectedBodyPart === part ? "#fff" : "#6B6B80",
                  }}
                >
                  {BODY_PART_LABELS[part] || part}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* Sort row + contador */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: 20,
          marginBottom: 12,
          gap: 8,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#6B6B80", fontSize: 12, fontWeight: "600", flex: 1 }}>
          {displayedExercises.length} ejercicio{displayedExercises.length !== 1 ? "s" : ""}
          {!isSearchMode && hasMore ? "+" : ""}
        </Text>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            onPress={() => setSortBy(opt.key)}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 10,
              backgroundColor: sortBy === opt.key ? "#6C63FF20" : "transparent",
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: sortBy === opt.key ? "700" : "500",
                color: sortBy === opt.key ? "#6C63FF" : "#6B6B80",
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      {loadingFirst ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text style={{ color: "#6B6B80", marginTop: 12 }}>
            Cargando ejercicios...
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayedExercises}
          keyExtractor={keyExtractor}
          renderItem={renderExercise}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          windowSize={5}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            // Solo paginar en modo body part (no en búsqueda)
            if (!isSearchMode) fetchNextPage();
          }}
          ListFooterComponent={ListFooter}
          ListEmptyComponent={
            <View
              style={{
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 60,
                gap: 12,
              }}
            >
              <Ionicons name="barbell-outline" size={48} color="#33334a" />
              <Text style={{ color: "#c0c0d0", fontSize: 16, fontWeight: "600" }}>
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
          }
        />
      )}

      {/* Exercise detail modal */}
      <ExerciseDetailModal
        exercise={selectedExercise}
        visible={!!selectedExercise}
        bestSet={selectedExercise ? (prsMap.get(selectedExercise.id) ?? null) : null}
        showAddButton
        onClose={() => setSelectedExercise(null)}
        onAdd={() => {
          if (selectedExercise) {
            handleAddToWorkout(selectedExercise);
            setSelectedExercise(null);
          }
        }}
      />
    </View>
  );
}
