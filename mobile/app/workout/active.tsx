import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useWorkoutStore } from "@/store/workoutStore";
import { api } from "@/lib/api";
import ExerciseBlock from "@/components/ExerciseBlock";
import RestTimer from "@/components/RestTimer";

export default function ActiveWorkoutScreen() {
  const { activeWorkout, finishWorkout, cancelWorkout,
    addSet, removeSet, updateSet, completeSet,
    removeExercise, setWorkoutId, setWorkoutName } = useWorkoutStore();

  // Timer de descanso
  const [showTimer, setShowTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(90);

  // Duración del workout
  const [duration, setDuration] = useState(0);

  // Contador de tiempo
  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(activeWorkout.startTime).getTime();
      const now = Date.now();
      setDuration(Math.floor((now - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Crear workout en el backend al montar
  useEffect(() => {
    if (!activeWorkout.workoutId && activeWorkout.isActive) {
      createWorkoutInBackend();
    }
  }, []);

  const createWorkoutInBackend = async () => {
    try {
      const { data } = await api.post(
        "/api/workouts/start",
        { name: activeWorkout.name }
      );
      setWorkoutId(data.id);
    } catch (err) {
      console.error("Error creando workout:", err);
    }
  };

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleFinishWorkout = () => {
    const completedSets = activeWorkout.exercises.flatMap((e) =>
      e.sets.filter((s) => s.isCompleted)
    );

    if (completedSets.length === 0) {
      Alert.alert(
        "Sin sets completados",
        "Completa al menos un set antes de finalizar.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Finalizar workout",
      `Completaste ${completedSets.length} sets. ¿Terminar?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          onPress: async () => {
            await saveAndFinish();
          },
        },
      ]
    );
  };

  const saveAndFinish = async () => {
    try {
      // Guardar todos los sets completados en el backend
      for (const exercise of activeWorkout.exercises) {
        for (const set of exercise.sets.filter((s) => s.isCompleted)) {
          await api.post(
            `/api/workouts/${activeWorkout.workoutId}/sets`,
            {
              externalId: exercise.externalId,
              exerciseName: exercise.exerciseName,
              order: exercise.order,
              setNumber: set.setNumber,
              weight: parseFloat(set.weight) || null,
              reps: parseInt(set.reps) || null,
              rpe: set.rpe ? parseFloat(set.rpe) : null,
              setType: set.setType,
              restSeconds: set.restSeconds,
              notes: set.notes,
            }
          );
        }
      }

      // Finalizar workout
      const { data } = await api.post(
        `/api/workouts/${activeWorkout.workoutId}/finish`,
        {}
      );

      finishWorkout();

      // Ir al resumen
      router.replace({
        pathname: "/workout/summary",
        params: {
          xpEarned: data.xpEarned,
          newPRs: data.newPRs,
          totalVolume: data.totalVolume,
          durationMinutes: data.durationMinutes,
          workoutName: activeWorkout.name,
        },
      });
    } catch (err) {
      console.error("Error finalizando workout:", err);
      Alert.alert("Error", "No se pudo guardar el workout.");
    }
  };

  const handleCancelWorkout = () => {
    Alert.alert(
      "Cancelar workout",
      "¿Seguro? Perderás todo el progreso.",
      [
        { text: "Continuar entrenando", style: "cancel" },
        {
          text: "Cancelar workout",
          style: "destructive",
          onPress: () => {
            cancelWorkout();
            router.back();
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (!activeWorkout.isActive) {
      router.back();
    }
  }, [activeWorkout.isActive]);

  if (!activeWorkout.isActive) {
    return null;
  }

  const totalCompletedSets = activeWorkout.exercises.flatMap(
    (e) => e.sets.filter((s) => s.isCompleted)
  ).length;

  return (
    <SafeAreaView className="flex-1 bg-background">

      {/* ─── HEADER ─────────────────────────────────── */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-background-elevated">

        {/* Cancelar */}
        <TouchableOpacity onPress={handleCancelWorkout}>
          <Ionicons name="close" size={24} color="#6B6B80" />
        </TouchableOpacity>

        {/* Nombre + duración */}
        <View className="items-center">
          <Text className="text-white font-bold text-base">
            {activeWorkout.name}
          </Text>
          <Text className="text-success text-sm font-bold">
            {formatDuration(duration)}
          </Text>
        </View>

        {/* Finalizar */}
        <TouchableOpacity
          onPress={handleFinishWorkout}
          className="bg-primary rounded-2xl px-4 py-2"
        >
          <Text className="text-white font-bold text-sm">Finalizar</Text>
        </TouchableOpacity>

      </View>

      {/* ─── STATS RÁPIDAS ──────────────────────────── */}
      <View className="flex-row px-5 py-3 gap-x-4">
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="barbell-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-sm">
            {activeWorkout.exercises.length} ejercicios
          </Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <Ionicons name="checkmark-circle-outline" size={14} color="#A0A0B0" />
          <Text className="text-text-secondary text-sm">
            {totalCompletedSets} series
          </Text>
        </View>
      </View>

      {/* ─── TIMER DE DESCANSO ──────────────────────── */}
      {showTimer && (
        <RestTimer
          seconds={timerSeconds}
          onComplete={() => setShowTimer(false)}
          onDismiss={() => setShowTimer(false)}
        />
      )}

      {/* ─── LISTA DE EJERCICIOS ────────────────────── */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View className="pt-4 pb-8">

          {activeWorkout.exercises.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons name="barbell-outline" size={48} color="#6B6B80" />
              <Text className="text-text-secondary text-base mt-4 text-center">
                Agrega ejercicios para empezar
              </Text>
            </View>
          ) : (
            activeWorkout.exercises.map((exercise) => (
              <ExerciseBlock
                key={exercise.id}
                exercise={exercise}
                onAddSet={() => addSet(exercise.id)}
                onRemoveSet={(setId) => removeSet(exercise.id, setId)}
                onUpdateSet={(setId, data) => updateSet(exercise.id, setId, data)}
                onCompleteSet={(setId) => completeSet(exercise.id, setId)}
                onRemoveExercise={() => removeExercise(exercise.id)}
                onSetCompleted={(restSecs) => {
                  setTimerSeconds(restSecs);
                  setShowTimer(true);
                }}
              />
            ))
          )}

          {/* Botón agregar ejercicio */}
          <TouchableOpacity
            onPress={() => router.push("/workout/exercise-picker")}
            className="flex-row items-center justify-center py-4 border border-dashed border-primary/40 rounded-3xl gap-x-2 mb-4"
          >
            <Ionicons name="add-circle-outline" size={22} color="#6C63FF" />
            <Text className="text-primary font-bold text-base">
              Agregar ejercicio
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>

    </SafeAreaView>
  );
}