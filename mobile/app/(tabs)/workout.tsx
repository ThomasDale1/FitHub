import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { exerciseAPI, Exercise } from "@/lib/api";
import { useWorkoutStore } from "@/store/workoutStore";
import { Image } from "expo-image";

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

export default function WorkoutScreen() {
  const { activeWorkout, startWorkout } = useWorkoutStore();

  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState<string>("chest");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingParts, setLoadingParts] = useState(true);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const fetchBodyParts = async () => {
      try {
        const { data } = await exerciseAPI.getBodyParts();
        setBodyParts(data);
      } catch (err) {
        console.error("Error cargando partes del cuerpo:", err);
      } finally {
        setLoadingParts(false);
      }
    };
    fetchBodyParts();
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      fetchExercisesByPart(selectedBodyPart);
    }
  }, [selectedBodyPart]);

  const fetchExercisesByPart = async (bodyPart: string) => {
    setLoadingExercises(true);
    try {
      const { data } = await exerciseAPI.getByBodyPart(bodyPart);
      setExercises(data);
    } catch (err) {
      console.error("Error cargando ejercicios:", err);
    } finally {
      setLoadingExercises(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      if (text.length === 0) {
        fetchExercisesByPart(selectedBodyPart);
      }
      return;
    }
    setSearching(true);
    try {
      const { data } = await exerciseAPI.search(text);
      setExercises(data);
    } catch (err) {
      console.error("Error buscando:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleStartWorkout = () => {
    startWorkout("Workout");
    router.push("/workout/active");
  };

  const renderExerciseCard = ({ item }: { item: Exercise }) => (
    <TouchableOpacity className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3 flex-row gap-x-4">
      {/* Imagen del ejercicio */}
      <Image
        source={{ uri: exerciseAPI.getGifUrl(item.id, "180") }}
        style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: "#252540" }}
        contentFit="cover"
        autoplay
        cachePolicy="memory-disk"
      />

      {/* Info */}
      <View className="flex-1 justify-center">
        <Text
          className="text-white font-bold text-sm capitalize"
          numberOfLines={2}
        >
          {item.name}
        </Text>

        <View className="flex-row items-center gap-x-1 mt-1">
          <Ionicons name="body-outline" size={12} color="#6C63FF" />
          <Text className="text-primary text-xs capitalize">
            {item.target}
          </Text>
        </View>

        <View className="flex-row items-center gap-x-1 mt-1">
          <Ionicons name="barbell-outline" size={12} color="#A0A0B0" />
          <Text className="text-text-muted text-xs capitalize">
            {item.equipment}
          </Text>
        </View>

        <View className="bg-background-elevated rounded-xl px-2 py-0.5 self-start mt-2">
          <Text className="text-text-secondary text-xs capitalize">
            {BODY_PART_LABELS[item.bodyPart] || item.bodyPart}
          </Text>
        </View>
      </View>

      {/* Botón agregar → inicia workout y va al picker */}
      <TouchableOpacity
        className="justify-center"
        onPress={() => {
          if (!activeWorkout.isActive) startWorkout("Workout");
          router.push("/workout/active");
        }}
      >
        <View className="bg-primary/20 rounded-xl p-2">
          <Ionicons name="add" size={20} color="#6C63FF" />
        </View>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">

      {/* ─── HEADER ─────────────────────────────── */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold mb-1">
          Workout
        </Text>
        <Text className="text-text-secondary text-sm">
          1,300+ ejercicios con animaciones
        </Text>
      </View>

      {/* ─── BOTÓN INICIAR / CONTINUAR WORKOUT ──── */}
      {activeWorkout.isActive ? (
        <TouchableOpacity
          onPress={() => router.push("/workout/active")}
          className="mx-5 mb-4 bg-success rounded-3xl py-4 flex-row items-center justify-center gap-x-2"
        >
          <View className="w-2 h-2 bg-white rounded-full" />
          <Text className="text-white font-bold text-base">
            Continuar workout activo
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={handleStartWorkout}
          className="mx-5 mb-4 bg-primary rounded-3xl py-4 flex-row items-center justify-center gap-x-2"
        >
          <Ionicons name="add-circle" size={22} color="white" />
          <Text className="text-white font-bold text-base">
            Iniciar workout
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── BUSCADOR ───────────────────────────── */}
      <View className="px-5 mb-4">
        <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4 py-3 gap-x-3">
          <Ionicons name="search-outline" size={20} color="#6B6B80" />
          <TextInput
            className="flex-1 text-white text-base"
            placeholder="Buscar ejercicio..."
            placeholderTextColor="#6B6B80"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searching && <ActivityIndicator size="small" color="#6C63FF" />}
          {searchQuery.length > 0 && !searching && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color="#6B6B80" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ─── FILTROS POR PARTE DEL CUERPO ───────── */}
      {!searchQuery && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-4"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
        >
          {loadingParts ? (
            <ActivityIndicator color="#6C63FF" />
          ) : (
            bodyParts.map((part) => (
              <TouchableOpacity
                key={part}
                onPress={() => setSelectedBodyPart(part)}
                className={`px-4 py-2 rounded-2xl border ${
                  selectedBodyPart === part
                    ? "bg-primary border-primary"
                    : "bg-background-card border-background-elevated"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedBodyPart === part
                      ? "text-white"
                      : "text-text-secondary"
                  }`}
                >
                  {BODY_PART_LABELS[part] || part}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {/* ─── LISTA DE EJERCICIOS ─────────────────── */}
      {loadingExercises ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text className="text-text-secondary mt-3">
            Cargando ejercicios...
          </Text>
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          renderItem={renderExerciseCard}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Ionicons name="barbell-outline" size={48} color="#6B6B80" />
              <Text className="text-text-secondary mt-4 text-center">
                No se encontraron ejercicios
              </Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}