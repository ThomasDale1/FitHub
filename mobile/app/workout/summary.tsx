import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { useTour } from "@/context/TourContext";

export default function WorkoutSummaryScreen() {
  const { isActive, completeTour } = useTour();
  const [tourJustCompleted, setTourJustCompleted] = useState(false);

  useEffect(() => {
    if (isActive) {
      setTourJustCompleted(true);
      completeTour();
    }
  }, []);

  const { xpEarned, newPRs, totalVolume, durationMinutes, workoutName } =
    useLocalSearchParams<{
      xpEarned: string;
      newPRs: string;
      totalVolume: string;
      durationMinutes: string;
      workoutName: string;
    }>();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-8 pb-12">

          {/* Tour completado banner */}
          {tourJustCompleted && (
            <View
              className="rounded-3xl p-5 mb-6 items-center"
              style={{ backgroundColor: "#F59E0B15", borderWidth: 1.5, borderColor: "#F59E0B50" }}
            >
              <Text style={{ fontSize: 40, marginBottom: 8 }}>🏅</Text>
              <Text className="text-white font-bold text-xl text-center mb-1">
                ¡Desafío de bienvenida completado!
              </Text>
              <Text className="text-text-secondary text-sm text-center">
                Ganaste el badge "Explorer" + 100 XP extra
              </Text>
            </View>
          )}

          {/* Celebración */}
          <View className="items-center mb-8">
            <Text className="text-6xl mb-4">🎉</Text>
            <Text className="text-white text-3xl font-bold text-center">
              ¡Workout completado!
            </Text>
            <Text className="text-text-secondary text-base mt-2 text-center">
              {workoutName}
            </Text>
          </View>

          {/* XP ganado */}
          <LinearGradient
            colors={["#6C63FF", "#8B85FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="rounded-3xl p-6 mb-4 items-center"
          >
            <Ionicons name="star" size={32} color="white" />
            <Text className="text-white text-4xl font-bold mt-2">
              +{xpEarned} XP
            </Text>
            <Text className="text-white/70 text-sm mt-1">
              XP ganado
            </Text>
          </LinearGradient>

          {/* Stats */}
          <View className="flex-row gap-x-3 mb-4">
            <View className="flex-1 bg-background-card border border-background-elevated rounded-3xl p-4 items-center">
              <Ionicons name="time-outline" size={24} color="#A0A0B0" />
              <Text className="text-white text-2xl font-bold mt-2">
                {durationMinutes}
              </Text>
              <Text className="text-text-secondary text-xs mt-1">
                minutos
              </Text>
            </View>
            <View className="flex-1 bg-background-card border border-background-elevated rounded-3xl p-4 items-center">
              <Ionicons name="barbell-outline" size={24} color="#A0A0B0" />
              <Text className="text-white text-2xl font-bold mt-2">
                {Math.round(parseFloat(totalVolume || "0"))}
              </Text>
              <Text className="text-text-secondary text-xs mt-1">
                kg volumen
              </Text>
            </View>
          </View>

          {/* PRs */}
          {parseInt(newPRs || "0") > 0 && (
            <View className="bg-streak/10 border border-streak/30 rounded-3xl p-4 mb-4 flex-row items-center gap-x-3">
              <Ionicons name="trophy" size={28} color="#FF6B35" />
              <View>
                <Text className="text-white font-bold text-base">
                  ¡{newPRs} nuevo{parseInt(newPRs) > 1 ? "s" : ""} PR!
                </Text>
                <Text className="text-text-secondary text-sm">
                  Rompiste tus récords personales
                </Text>
              </View>
            </View>
          )}

          {/* Botones */}
          <TouchableOpacity
            onPress={() => router.replace("/(tabs)")}
            className="bg-primary rounded-3xl py-4 items-center mt-4"
          >
            <Text className="text-white font-bold text-lg">
              Ver Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.replace("/(tabs)/workout")}
            className="border border-background-elevated rounded-3xl py-4 items-center mt-3"
          >
            <Text className="text-text-secondary font-bold">
              Volver a ejercicios
            </Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}