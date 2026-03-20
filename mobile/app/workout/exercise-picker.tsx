import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { exerciseAPI, Exercise } from "@/lib/api";
import { useWorkoutStore } from "@/store/workoutStore";

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

export default function ExercisePickerScreen() {
  const { addExercise } = useWorkoutStore();

  const [bodyParts, setBodyParts] = useState<string[]>([]);
  const [selectedBodyPart, setSelectedBodyPart] = useState("chest");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    exerciseAPI.getBodyParts().then(({ data }) => setBodyParts(data));
  }, []);

  useEffect(() => {
    if (!searchQuery) fetchByBodyPart(selectedBodyPart);
  }, [selectedBodyPart]);

  const fetchByBodyPart = async (part: string) => {
    setLoading(true);
    try {
      const { data } = await exerciseAPI.getByBodyPart(part);
      setExercises(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.length < 2) {
      if (text.length === 0) fetchByBodyPart(selectedBodyPart);
      return;
    }
    setLoading(true);
    try {
      const { data } = await exerciseAPI.search(text);
      setExercises(data);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectExercise = (exercise: Exercise) => {
    addExercise({
      externalId: exercise.id,
      exerciseName: exercise.name,
      bodyPart: exercise.bodyPart,
      target: exercise.target,
      equipment: exercise.equipment,
      restSeconds: 90,
    });
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">

      {/* Header */}
      <View className="flex-row items-center px-5 py-4 gap-x-4">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">
          Agregar ejercicio
        </Text>
      </View>

      {/* Buscador */}
      <View className="px-5 mb-3">
        <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4 py-3 gap-x-3">
          <Ionicons name="search-outline" size={20} color="#6B6B80" />
          <TextInput
            className="flex-1 text-white"
            placeholder="Buscar ejercicio..."
            placeholderTextColor="#6B6B80"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={20} color="#6B6B80" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtros */}
      {!searchQuery && (
        <View className="mb-3">
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={bodyParts}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => setSelectedBodyPart(item)}
                className={`px-4 py-2 rounded-2xl border ${
                  selectedBodyPart === item
                    ? "bg-primary border-primary"
                    : "bg-background-card border-background-elevated"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    selectedBodyPart === item
                      ? "text-white"
                      : "text-text-secondary"
                  }`}
                >
                  {BODY_PART_LABELS[item] || item}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Lista */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : (
        <FlatList
          data={exercises}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelectExercise(item)}
              className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3 flex-row gap-x-4 items-center"
            >
              <Image
                source={{ uri: exerciseAPI.getGifUrl(item.id, "180") }}
                style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: "#252540" }}
                contentFit="cover"
                autoplay
                cachePolicy="memory-disk"
              />
              <View className="flex-1">
                <Text className="text-white font-bold capitalize" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-primary text-xs capitalize mt-1">
                  {item.target}
                </Text>
                <Text className="text-text-muted text-xs capitalize">
                  {item.equipment}
                </Text>
              </View>
              <Ionicons name="add-circle" size={28} color="#6C63FF" />
            </TouchableOpacity>
          )}
        />
      )}

    </SafeAreaView>
  );
}