import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { onboardingAPI } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

const LEVELS = [
  {
    value: "beginner",
    icon: "🌱",
    label: "Principiante",
    description: "Acabo de empezar o quiero retomar",
    time: "0-12 meses",
  },
  {
    value: "intermediate",
    icon: "🌿",
    label: "Intermedio",
    description: "Entreno regularmente, conozco los básicos",
    time: "1-3 años",
  },
  {
    value: "advanced",
    icon: "🌳",
    label: "Avanzado",
    description: "Entreno consistentemente, tengo buena base",
    time: "3-7 años",
  },
  {
    value: "expert",
    icon: "🏔️",
    label: "Experto",
    description: "El gym es mi segunda casa",
    time: "7+ años",
  },
];

const DAYS = [1, 2, 3, 4, 5, 6, 7];

const PROGRESS_STEP = 4;
const TOTAL_STEPS = 7;

export default function ExperienceScreen() {
  const [level, setLevel] = useState<string | null>(null);
  const [trainingDays, setTrainingDays] = useState<number>(4);
  const [loading, setLoading] = useState(false);

  const fadeAnims = useRef(
    LEVELS.map(() => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    LEVELS.map(() => new Animated.Value(30))
  ).current;

  useEffect(() => {
    LEVELS.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(fadeAnims[i], {
          toValue: 1,
          duration: 400,
          delay: 200 + i * 120,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 400,
          delay: 200 + i * 120,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  const handleNext = async () => {
    if (!level) return;
    setLoading(true);
    try {
      await onboardingAPI.saveExperience({
        experienceLevel: level,
        weeklyTrainingDays: trainingDays,
      });
      router.push("/(onboarding)/location" as any);
    } catch (e) {
      console.error("Error saving experience:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-muted text-xs">
            {PROGRESS_STEP} de {TOTAL_STEPS}
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
          </TouchableOpacity>
        </View>
        <View className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }}
          />
        </View>
      </View>

      <View className="flex-1 px-6">
        {/* Title */}
        <View className="mt-4 mb-6">
          <Text className="text-white text-3xl font-bold">
            ¿Cuánto tiempo llevas entrenando?
          </Text>
          <Text className="text-text-secondary mt-2 text-base">
            No hay respuesta incorrecta
          </Text>
        </View>

        {/* Level cards */}
        {LEVELS.map((item, i) => {
          const isSelected = level === item.value;
          return (
            <Animated.View
              key={item.value}
              style={{
                opacity: fadeAnims[i],
                transform: [{ translateY: slideAnims[i] }],
              }}
            >
              <TouchableOpacity
                onPress={() => setLevel(item.value)}
                className={`flex-row items-center p-4 rounded-2xl border mb-3 ${
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-background-elevated bg-background-card"
                }`}
              >
                <Text className="text-3xl mr-4">{item.icon}</Text>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`font-bold text-base ${
                        isSelected ? "text-primary" : "text-white"
                      }`}
                    >
                      {item.label}
                    </Text>
                    <Text className="text-text-muted text-xs">{item.time}</Text>
                  </View>
                  <Text className="text-text-secondary text-sm mt-1">
                    {item.description}
                  </Text>
                </View>
                {isSelected && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color="#6C63FF"
                    style={{ marginLeft: 8 }}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* Training days */}
        {level && (
          <Animated.View className="mt-4">
            <Text className="text-text-secondary text-sm font-medium mb-3">
              ¿Cuántos días a la semana entrenas?
            </Text>
            <View className="flex-row justify-between">
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => setTrainingDays(day)}
                  className={`w-11 h-11 rounded-full items-center justify-center border ${
                    trainingDays === day
                      ? "border-primary bg-primary"
                      : "border-background-elevated bg-background-card"
                  }`}
                >
                  <Text
                    className={`font-bold text-base ${
                      trainingDays === day ? "text-white" : "text-text-secondary"
                    }`}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Bottom */}
      <View className="px-6 pb-6 pt-2 bg-background">
        <CustomButton
          title="Siguiente"
          onPress={handleNext}
          loading={loading}
          disabled={!level}
        />
      </View>
    </SafeAreaView>
  );
}
