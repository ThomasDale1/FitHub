import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useWorkoutStore } from "@/store/workoutStore";
import { useEffect, useState } from "react";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function WorkoutActiveBar() {
  const { activeWorkout } = useWorkoutStore();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeWorkout.isActive) return;
    const update = () => {
      const start = new Date(activeWorkout.startTime).getTime();
      setElapsed(Math.floor((Date.now() - start) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout.isActive, activeWorkout.startTime]);

  if (!activeWorkout.isActive) return null;

  const completedSets = activeWorkout.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
  const totalExercises = activeWorkout.exercises.length;

  return (
    <TouchableOpacity
      onPress={() => router.push("/workout/active")}
      activeOpacity={0.85}
      style={{
        marginHorizontal: 20,
        marginBottom: 12,
        backgroundColor: "#16a34a",
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* Indicador pulsante */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: "#fff",
        }}
      />

      {/* Info */}
      <View style={{ flex: 1 }}>
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>
          Workout activo · {formatDuration(elapsed)}
        </Text>
        <Text style={{ color: "#bbf7d0", fontSize: 12, marginTop: 1 }}>
          {totalExercises > 0
            ? `${totalExercises} ejercicio${totalExercises !== 1 ? "s" : ""} · ${completedSets} sets completados`
            : "Sin ejercicios aún"}
        </Text>
      </View>

      {/* Acción */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          backgroundColor: "#ffffff25",
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 5,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
          Continuar
        </Text>
        <Ionicons name="chevron-forward" size={14} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}
