import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { onboardingAPI } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

const BASIC_GOALS = [
  { slug: "lose_fat", icon: "🔥", label: "Perder grasa", hint: "El 80% logra resultados en el primer mes" },
  { slug: "gain_muscle", icon: "💪", label: "Ganar músculo", hint: "Construye el físico que siempre quisiste" },
  { slug: "improve_health", icon: "❤️", label: "Mejorar salud", hint: "Más energía, mejor sueño, mejor vida" },
  { slug: "increase_strength", icon: "🏋️", label: "Aumentar fuerza", hint: "Rompe tus récords personales" },
  { slug: "improve_endurance", icon: "🫁", label: "Mejorar resistencia", hint: "Corre más lejos, entrena más duro" },
  { slug: "maintenance", icon: "⚖️", label: "Mantenimiento", hint: "Mantén tu progreso y estilo de vida" },
  { slug: "flexibility", icon: "🧘", label: "Flexibilidad", hint: "Muévete mejor, sin dolor" },
  { slug: "mental_health", icon: "🧠", label: "Salud mental", hint: "El ejercicio es el mejor antidepresivo" },
];

const ADVANCED_GOALS = [
  { slug: "bench_3plates", icon: "🏋️", label: "Bench 3 platos (140kg)", hint: "Solo el 1% lo logra" },
  { slug: "squat_4plates", icon: "🦵", label: "Squat 4 platos (180kg)", hint: "El rey de los ejercicios" },
  { slug: "deadlift_5plates", icon: "💀", label: "Deadlift 5 platos (220kg)", hint: "Fuerza bruta" },
  { slug: "marathon", icon: "🏃", label: "Correr un maratón", hint: "42.195 km de gloria" },
  { slug: "bodybuilding", icon: "🏆", label: "Competir en bodybuilding", hint: "Sube al escenario" },
  { slug: "muscle_up", icon: "🤸", label: "Primer muscle-up", hint: "Calistenia avanzada" },
  { slug: "sub10_bf", icon: "📐", label: "Sub-10% body fat", hint: "Definición extrema" },
  { slug: "10k_steps", icon: "👣", label: "10,000 pasos diarios", hint: "El hábito que cambia todo" },
];

const PROGRESS_STEP = 2;
const TOTAL_STEPS = 7;

export default function GoalsScreen() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customGoal, setCustomGoal] = useState("");
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const advancedAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const toggleGoal = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  };

  const toggleAdvanced = () => {
    const next = !showAdvanced;
    setShowAdvanced(next);
    Animated.spring(advancedAnim, {
      toValue: next ? 1 : 0,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const handleNext = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      const goals = Array.from(selected).map((slug) => ({
        slug,
        customText: slug === "custom" ? customGoal : undefined,
      }));
      await onboardingAPI.saveGoals(goals);
      router.push("/(onboarding)/hobbies" as any);
    } catch (e) {
      console.error("Error saving goals:", e);
    } finally {
      setLoading(false);
    }
  };

  const GoalCard = ({
    slug,
    icon,
    label,
    hint,
  }: {
    slug: string;
    icon: string;
    label: string;
    hint: string;
  }) => {
    const isSelected = selected.has(slug);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const onPress = () => {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.03, duration: 100, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      toggleGoal(slug);
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }], width: "48%" }}>
        <TouchableOpacity
          onPress={onPress}
          className={`p-4 rounded-2xl border mb-3 ${
            isSelected
              ? "border-primary bg-primary/10"
              : "border-background-elevated bg-background-card"
          }`}
          style={{ minHeight: 100 }}
        >
          {isSelected && (
            <View className="absolute top-2 right-2">
              <Ionicons name="checkmark-circle" size={18} color="#6C63FF" />
            </View>
          )}
          <Text className="text-2xl mb-2">{icon}</Text>
          <Text
            className={`font-bold text-sm mb-1 ${
              isSelected ? "text-primary" : "text-white"
            }`}
          >
            {label}
          </Text>
          <Text className="text-text-muted text-xs" numberOfLines={2}>
            {hint}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    );
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

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Title */}
          <View className="mt-4 mb-6">
            <Text className="text-white text-3xl font-bold">
              ¿Qué quieres lograr?
            </Text>
            <Text className="text-text-secondary mt-2 text-base">
              Selecciona todos los que apliquen
            </Text>
          </View>

          {/* Basic Goals Grid */}
          <View className="flex-row flex-wrap justify-between">
            {BASIC_GOALS.map((goal) => (
              <GoalCard key={goal.slug} {...goal} />
            ))}
          </View>

          {/* Advanced toggle */}
          <TouchableOpacity
            onPress={toggleAdvanced}
            className="flex-row items-center justify-center py-4 mt-2 mb-2"
          >
            <Text className="text-primary font-semibold text-sm mr-2">
              {showAdvanced
                ? "Ocultar metas específicas"
                : "Tengo metas más específicas"}
            </Text>
            <Ionicons
              name={showAdvanced ? "chevron-up" : "chevron-down"}
              size={16}
              color="#6C63FF"
            />
          </TouchableOpacity>

          {/* Advanced Goals */}
          {showAdvanced && (
            <View>
              <View className="flex-row flex-wrap justify-between">
                {ADVANCED_GOALS.map((goal) => (
                  <GoalCard key={goal.slug} {...goal} />
                ))}
              </View>

              {/* Custom goal */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={() => {
                    if (!selected.has("custom")) toggleGoal("custom");
                  }}
                  className={`p-4 rounded-2xl border ${
                    selected.has("custom")
                      ? "border-primary bg-primary/10"
                      : "border-background-elevated bg-background-card"
                  }`}
                >
                  <Text className="text-lg mb-2">✏️</Text>
                  <Text className="text-white font-bold text-sm mb-2">
                    Meta personalizada
                  </Text>
                  <TextInput
                    value={customGoal}
                    onChangeText={(text) => {
                      setCustomGoal(text);
                      if (!selected.has("custom")) toggleGoal("custom");
                    }}
                    placeholder="Escribe tu meta..."
                    placeholderTextColor="#6B6B80"
                    className="text-white text-sm bg-background border border-background-elevated rounded-xl px-3 py-2"
                    maxLength={100}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View className="h-24" />
        </ScrollView>
      </Animated.View>

      {/* Bottom */}
      <View className="px-6 pb-6 pt-2 bg-background">
        {selected.size > 0 && (
          <Text className="text-text-muted text-xs text-center mb-2">
            {selected.size} {selected.size === 1 ? "objetivo seleccionado" : "objetivos seleccionados"}
          </Text>
        )}
        <CustomButton
          title="Siguiente"
          onPress={handleNext}
          loading={loading}
          disabled={selected.size === 0}
        />
      </View>
    </SafeAreaView>
  );
}
