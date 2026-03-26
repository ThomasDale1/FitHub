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
import { useTour } from "@/context/TourContext";

interface Mission {
  id: string;
  label: string;
  description: string;
  xp: number;
  icon: string;
  completed: boolean;
}

const MISSIONS: Mission[] = [
  {
    id: "create_account",
    label: "Crear tu cuenta",
    description: "¡Ya lo hiciste!",
    xp: 10,
    icon: "person-add",
    completed: true,
  },
  {
    id: "complete_profile",
    label: "Completar tu perfil",
    description: "Datos, objetivos y más",
    xp: 15,
    icon: "create",
    completed: true,
  },
  {
    id: "visit_feed",
    label: "Visitar el Feed",
    description: "Ve qué hace la comunidad",
    xp: 10,
    icon: "newspaper",
    completed: false,
  },
  {
    id: "visit_steps",
    label: "Ver tus pasos",
    description: "Conecta tu salud",
    xp: 10,
    icon: "footsteps",
    completed: false,
  },
  {
    id: "log_workout",
    label: "Registrar un workout",
    description: "Tu primera sesión",
    xp: 20,
    icon: "barbell",
    completed: false,
  },
];

const PROGRESS_STEP = 7;
const TOTAL_STEPS = 7;

export default function FirstChallengeScreen() {
  const [loading, setLoading] = useState(false);
  const { startTour } = useTour();

  // Animations
  const fadeAnims = useRef(
    MISSIONS.map(() => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    MISSIONS.map(() => new Animated.Value(20))
  ).current;
  const checkAnims = useRef(
    MISSIONS.filter((m) => m.completed).map(() => new Animated.Value(0))
  ).current;
  const headerFade = useRef(new Animated.Value(0)).current;
  const rewardFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Header fade
    Animated.timing(headerFade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Staggered missions
    MISSIONS.forEach((_, i) => {
      Animated.parallel([
        Animated.timing(fadeAnims[i], {
          toValue: 1,
          duration: 400,
          delay: 300 + i * 150,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 400,
          delay: 300 + i * 150,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Checkmarks for completed missions
    checkAnims.forEach((anim, i) => {
      Animated.spring(anim, {
        toValue: 1,
        friction: 4,
        delay: 800 + i * 200,
        useNativeDriver: true,
      }).start();
    });

    // Reward section
    Animated.timing(rewardFade, {
      toValue: 1,
      duration: 500,
      delay: 1200,
      useNativeDriver: true,
    }).start();
  }, []);

  const completedCount = MISSIONS.filter((m) => m.completed).length;
  const totalXP = MISSIONS.reduce((acc, m) => acc + m.xp, 0);
  const earnedXP = MISSIONS.filter((m) => m.completed).reduce(
    (acc, m) => acc + m.xp,
    0
  );

  const handleStart = async () => {
    setLoading(true);
    try {
      await onboardingAPI.complete();
    } catch (e) {
      console.error("Complete error (non-critical):", e);
      // Non-critical — always start the tour regardless
    }
    startTour();
    router.replace("/(tabs)" as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center mb-2">
          <Text className="text-text-muted text-xs">
            {PROGRESS_STEP} de {TOTAL_STEPS}
          </Text>
        </View>
        <View className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <View className="h-full bg-primary rounded-full" style={{ width: "100%" }} />
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: headerFade }}>
        {/* Title */}
        <View className="px-6 mt-4 mb-6">
          <Text className="text-white text-3xl font-bold">
            Tu primer desafío
          </Text>
          <Text className="text-text-secondary mt-2 text-base">
            Completa estas misiones para ganar tu primer badge
          </Text>
        </View>

        {/* Missions */}
        <View className="px-6">
          {MISSIONS.map((mission, i) => {
            const checkIdx = MISSIONS.slice(0, i).filter(
              (m) => m.completed
            ).length;

            return (
              <Animated.View
                key={mission.id}
                style={{
                  opacity: fadeAnims[i],
                  transform: [{ translateY: slideAnims[i] }],
                }}
              >
                <View
                  className={`flex-row items-center p-4 rounded-2xl border mb-3 ${
                    mission.completed
                      ? "border-success/30 bg-success/5"
                      : "border-background-elevated bg-background-card"
                  }`}
                >
                  {/* Check / Icon */}
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${
                      mission.completed
                        ? "bg-success/20"
                        : "bg-background-elevated"
                    }`}
                  >
                    {mission.completed ? (
                      <Animated.View
                        style={{
                          transform: [
                            {
                              scale:
                                checkIdx < checkAnims.length
                                  ? checkAnims[checkIdx]
                                  : 1,
                            },
                          ],
                        }}
                      >
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color="#00D48A"
                        />
                      </Animated.View>
                    ) : (
                      <Ionicons
                        name={mission.icon as any}
                        size={18}
                        color="#6B6B80"
                      />
                    )}
                  </View>

                  {/* Content */}
                  <View className="flex-1">
                    <Text
                      className={`font-bold text-base ${
                        mission.completed
                          ? "text-success"
                          : "text-white"
                      }`}
                    >
                      {mission.label}
                    </Text>
                    <Text className="text-text-muted text-xs mt-0.5">
                      {mission.description}
                    </Text>
                  </View>

                  {/* XP */}
                  <View
                    className={`px-3 py-1 rounded-full ${
                      mission.completed
                        ? "bg-success/10"
                        : "bg-background-elevated"
                    }`}
                  >
                    <Text
                      className={`font-bold text-xs ${
                        mission.completed
                          ? "text-success"
                          : "text-text-muted"
                      }`}
                    >
                      +{mission.xp} XP
                    </Text>
                  </View>
                </View>
              </Animated.View>
            );
          })}
        </View>

        {/* Progress */}
        <View className="px-6 mt-2">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-text-secondary text-sm">Progreso</Text>
            <Text className="text-white font-bold text-sm">
              {completedCount}/{MISSIONS.length}
            </Text>
          </View>
          <View className="h-2 bg-background-elevated rounded-full overflow-hidden">
            <View
              className="h-full bg-success rounded-full"
              style={{
                width: `${(completedCount / MISSIONS.length) * 100}%`,
              }}
            />
          </View>
        </View>

        {/* Reward */}
        <Animated.View
          style={{ opacity: rewardFade }}
          className="mx-6 mt-6 p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5"
        >
          <View className="flex-row items-center">
            <Text className="text-3xl mr-3">🏅</Text>
            <View className="flex-1">
              <Text className="text-amber-400 font-bold text-sm">
                Recompensa
              </Text>
              <Text className="text-white font-bold text-base">
                Badge "Explorer" + 100 XP
              </Text>
              <Text className="text-text-muted text-xs mt-0.5">
                Completa todas las misiones desde la app
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Bottom */}
      <View className="px-6 pb-6 pt-4 bg-background">
        <CustomButton
          title="Empezar a explorar"
          onPress={handleStart}
          loading={loading}
        />
      </View>
    </SafeAreaView>
  );
}
