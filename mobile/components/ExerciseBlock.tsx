import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ActiveExercise, ActiveSet } from "@/store/workoutStore";
import SetRow from "./SetRow";
import { exerciseAPI } from "@/lib/api";

interface ExerciseBlockProps {
  exercise: ActiveExercise;
  onAddSet: () => void;
  onRemoveSet: (setId: string) => void;
  onUpdateSet: (setId: string, data: Partial<ActiveSet>) => void;
  onCompleteSet: (setId: string) => void;
  onRemoveExercise: () => void;
  onSetCompleted: (restSeconds: number) => void;
}

export default function ExerciseBlock({
  exercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onCompleteSet,
  onRemoveExercise,
  onSetCompleted,
}: ExerciseBlockProps) {

  const completedSets = exercise.sets.filter((s) => s.isCompleted).length;
  const totalSets = exercise.sets.length;

  const handleCompleteSet = (setId: string) => {
    onCompleteSet(setId);
    // Iniciar timer de descanso
    onSetCompleted(exercise.restSeconds);
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">

      {/* Header del ejercicio */}
      <View className="flex-row items-center gap-x-3 mb-4">
        {/* GIF */}
        <Image
          source={{ uri: exerciseAPI.getGifUrl(exercise.externalId, "180") }}
          style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: "#252540" }}
          contentFit="cover"
          autoplay
          cachePolicy="memory-disk"
        />

        {/* Info */}
        <View className="flex-1">
          <Text className="text-primary font-bold text-base" numberOfLines={1}>
            {exercise.exerciseName}
          </Text>
          <Text className="text-text-muted text-xs capitalize mt-0.5">
            {exercise.target} · {exercise.equipment}
          </Text>
          {/* Progreso de sets */}
          <Text className="text-text-secondary text-xs mt-1">
            {completedSets}/{totalSets} series completadas
          </Text>
        </View>

        {/* Menú */}
        <TouchableOpacity onPress={onRemoveExercise}>
          <Ionicons name="trash-outline" size={18} color="#6B6B80" />
        </TouchableOpacity>
      </View>

      {/* Headers de columnas */}
      <View className="flex-row items-center gap-x-3 mb-2 px-1">
        <View className="w-8" />
        <Text className="text-text-muted text-xs w-5 text-center">SET</Text>
        <Text className="text-text-muted text-xs flex-1 text-center">KG</Text>
        <Text className="text-text-muted text-xs flex-1 text-center">REPS</Text>
        <View className="w-10" />
        <View className="w-4" />
      </View>

      {/* Sets */}
      {exercise.sets.map((set) => (
        <SetRow
          key={set.id}
          set={set}
          onUpdate={(data) => onUpdateSet(set.id, data)}
          onComplete={() => handleCompleteSet(set.id)}
          onRemove={() => onRemoveSet(set.id)}
        />
      ))}

      {/* Botón agregar set */}
      <TouchableOpacity
        onPress={onAddSet}
        className="mt-2 flex-row items-center justify-center py-3 border border-dashed border-background-elevated rounded-2xl gap-x-2"
      >
        <Ionicons name="add" size={16} color="#6B6B80" />
        <Text className="text-text-muted text-sm">Agregar serie</Text>
      </TouchableOpacity>

    </View>
  );
}