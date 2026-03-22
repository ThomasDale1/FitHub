import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { onboardingAPI } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

interface HobbyItem {
  slug: string;
  emoji: string;
  label: string;
}

const HOBBY_GROUPS: { title: string; hobbies: HobbyItem[] }[] = [
  {
    title: "Fuerza",
    hobbies: [
      { slug: "gym", emoji: "🏋️", label: "Gym / Pesas" },
      { slug: "crossfit", emoji: "🔥", label: "CrossFit" },
      { slug: "calisthenics", emoji: "🤸", label: "Calistenia" },
      { slug: "powerlifting", emoji: "💪", label: "Powerlifting" },
    ],
  },
  {
    title: "Cardio",
    hobbies: [
      { slug: "running", emoji: "🏃", label: "Running" },
      { slug: "cycling", emoji: "🚴", label: "Ciclismo" },
      { slug: "swimming", emoji: "🏊", label: "Natación" },
      { slug: "hiit", emoji: "⚡", label: "HIIT" },
    ],
  },
  {
    title: "Flexibilidad",
    hobbies: [
      { slug: "yoga", emoji: "🧘", label: "Yoga" },
      { slug: "pilates", emoji: "🩰", label: "Pilates" },
    ],
  },
  {
    title: "Combate",
    hobbies: [
      { slug: "martial_arts", emoji: "🥋", label: "Artes marciales" },
      { slug: "boxing", emoji: "🥊", label: "Boxeo" },
    ],
  },
  {
    title: "Deportes",
    hobbies: [
      { slug: "football", emoji: "⚽", label: "Fútbol" },
      { slug: "basketball", emoji: "🏀", label: "Basketball" },
      { slug: "tennis", emoji: "🎾", label: "Tennis" },
    ],
  },
  {
    title: "Outdoor",
    hobbies: [
      { slug: "climbing", emoji: "🧗", label: "Escalada" },
      { slug: "hiking", emoji: "🥾", label: "Hiking" },
      { slug: "surfing", emoji: "🏄", label: "Surf" },
    ],
  },
];

const PROGRESS_STEP = 3;
const TOTAL_STEPS = 7;

export default function HobbiesScreen() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Staggered entry animation
  const chipAnims = useRef<Animated.Value[]>([]).current;
  const allHobbies = HOBBY_GROUPS.flatMap((g) => g.hobbies);

  useEffect(() => {
    // Initialize animations
    while (chipAnims.length < allHobbies.length) {
      chipAnims.push(new Animated.Value(0));
    }

    const animations = chipAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        delay: i * 40,
        useNativeDriver: true,
      })
    );
    Animated.stagger(40, animations).start();
  }, []);

  const toggleHobby = (slug: string) => {
    const next = new Set(selected);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    setSelected(next);
  };

  const handleNext = async () => {
    if (selected.size === 0) return;
    setLoading(true);
    try {
      await onboardingAPI.saveHobbies(Array.from(selected));
      router.push("/(onboarding)/experience" as any);
    } catch (e) {
      console.error("Error saving hobbies:", e);
    } finally {
      setLoading(false);
    }
  };

  let chipIndex = 0;

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

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View className="mt-4 mb-6">
          <Text className="text-white text-3xl font-bold">
            ¿Qué actividades te gustan?
          </Text>
          <Text className="text-text-secondary mt-2 text-base">
            Te conectaremos con personas que comparten tus intereses
          </Text>
        </View>

        {/* Hobby groups */}
        {HOBBY_GROUPS.map((group) => (
          <View key={group.title} className="mb-5">
            <Text className="text-text-muted text-xs font-semibold uppercase tracking-wider mb-3">
              {group.title}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {group.hobbies.map((hobby) => {
                const currentIdx = chipIndex++;
                const isSelected = selected.has(hobby.slug);
                const animValue =
                  currentIdx < chipAnims.length
                    ? chipAnims[currentIdx]
                    : new Animated.Value(1);

                return (
                  <Animated.View
                    key={hobby.slug}
                    style={{
                      opacity: animValue,
                      transform: [
                        {
                          scale: animValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => toggleHobby(hobby.slug)}
                      className={`flex-row items-center px-4 py-2.5 rounded-full border ${
                        isSelected
                          ? "border-primary bg-primary/15"
                          : "border-background-elevated bg-background-card"
                      }`}
                    >
                      <Text className="text-base mr-2">{hobby.emoji}</Text>
                      <Text
                        className={`font-medium text-sm ${
                          isSelected ? "text-primary" : "text-text-secondary"
                        }`}
                      >
                        {hobby.label}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        ))}

        <View className="h-24" />
      </ScrollView>

      {/* Bottom */}
      <View className="px-6 pb-6 pt-2 bg-background">
        {selected.size > 0 && (
          <Text className="text-text-muted text-xs text-center mb-2">
            {selected.size}{" "}
            {selected.size === 1 ? "actividad seleccionada" : "actividades seleccionadas"}
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
