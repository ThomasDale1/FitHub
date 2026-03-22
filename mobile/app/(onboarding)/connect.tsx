import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { userAPI, socialAPI, UserSuggestionData } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

const HOBBY_LABELS: Record<string, string> = {
  gym: "Gym",
  crossfit: "CrossFit",
  calisthenics: "Calistenia",
  powerlifting: "Powerlifting",
  running: "Running",
  cycling: "Ciclismo",
  swimming: "Natación",
  hiit: "HIIT",
  yoga: "Yoga",
  pilates: "Pilates",
  martial_arts: "Artes marciales",
  boxing: "Boxeo",
  football: "Fútbol",
  basketball: "Basketball",
  tennis: "Tennis",
  climbing: "Escalada",
  hiking: "Hiking",
  surfing: "Surf",
};

const EXP_LABELS: Record<string, string> = {
  beginner: "Principiante",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  expert: "Experto",
};

const PROGRESS_STEP = 6;
const TOTAL_STEPS = 7;

export default function ConnectScreen() {
  const [suggestions, setSuggestions] = useState<UserSuggestionData[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [followingAll, setFollowingAll] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const connectionCount = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const res = await userAPI.getSuggestions();
      setSuggestions(res.data);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.error("Suggestions error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: string) => {
    const next = new Set(following);
    if (next.has(userId)) {
      next.delete(userId);
      try {
        await socialAPI.unfollow(userId);
      } catch (e) {
        console.error("Unfollow error:", e);
      }
    } else {
      next.add(userId);
      try {
        await socialAPI.follow(userId);
      } catch (e) {
        console.error("Follow error:", e);
      }
    }
    setFollowing(next);
  };

  const handleFollowAll = async () => {
    setFollowingAll(true);
    const toFollow = suggestions.filter((s) => !following.has(s.id));
    const next = new Set(following);

    for (const user of toFollow) {
      try {
        await socialAPI.follow(user.id);
        next.add(user.id);
      } catch (e) {
        console.error("Follow error:", e);
      }
    }

    setFollowing(next);
    setFollowingAll(false);
  };

  const handleNext = () => {
    router.push("/(onboarding)/first-challenge" as any);
  };

  const handleSkip = () => {
    router.push("/(onboarding)/first-challenge" as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-muted text-xs">
            {PROGRESS_STEP} de {TOTAL_STEPS}
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={handleSkip}>
              <Text className="text-text-muted text-xs">Saltar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
            </TouchableOpacity>
          </View>
        </View>
        <View className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }}
          />
        </View>
      </View>

      {/* Title */}
      <View className="px-6 mt-4 mb-2">
        <Text className="text-white text-3xl font-bold">
          Personas como tú
        </Text>
        <Text className="text-text-secondary mt-2 text-base">
          Empieza a construir tu comunidad
        </Text>
        {following.size > 0 && (
          <View className="flex-row items-center mt-2 bg-primary/10 px-3 py-1.5 rounded-full self-start">
            <Ionicons name="people" size={14} color="#6C63FF" />
            <Text className="text-primary font-bold text-xs ml-1.5">
              {following.size}{" "}
              {following.size === 1 ? "conexión" : "conexiones"}
            </Text>
          </View>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#6C63FF" />
          <Text className="text-text-muted mt-3">Buscando personas...</Text>
        </View>
      ) : suggestions.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">👥</Text>
          <Text className="text-white text-xl font-bold text-center mb-2">
            ¡Pronto tendrás compañeros!
          </Text>
          <Text className="text-text-secondary text-center text-sm">
            Aún no hay suficientes usuarios para sugerirte, pero a medida que
            crezca la comunidad te conectaremos con personas similares.
          </Text>
        </View>
      ) : (
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <ScrollView
            className="flex-1 px-6"
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((user) => {
              const isFollowing = following.has(user.id);
              return (
                <View
                  key={user.id}
                  className="bg-background-card border border-background-elevated rounded-2xl p-4 mb-3"
                >
                  <View className="flex-row items-center">
                    {/* Avatar */}
                    <View className="w-12 h-12 rounded-full bg-background-elevated items-center justify-center mr-3 overflow-hidden">
                      {user.avatarUrl ? (
                        <Image
                          source={{ uri: user.avatarUrl }}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <Text className="text-xl">
                          {user.name.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    {/* Info */}
                    <View className="flex-1">
                      <Text className="text-white font-bold text-base">
                        {user.name}
                      </Text>
                      <View className="flex-row items-center flex-wrap gap-1 mt-1">
                        {user.sameGym && user.placeName && (
                          <View className="flex-row items-center bg-primary/10 px-2 py-0.5 rounded-full">
                            <Ionicons
                              name="barbell"
                              size={10}
                              color="#6C63FF"
                            />
                            <Text className="text-primary text-xs ml-1 font-medium">
                              {user.placeName}
                            </Text>
                          </View>
                        )}
                        {user.experienceLevel && (
                          <Text className="text-text-muted text-xs">
                            {EXP_LABELS[user.experienceLevel] || user.experienceLevel}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Follow button */}
                    <TouchableOpacity
                      onPress={() => handleFollow(user.id)}
                      className={`px-4 py-2 rounded-xl ${
                        isFollowing
                          ? "bg-background-elevated"
                          : "bg-primary"
                      }`}
                    >
                      <Text
                        className={`font-bold text-xs ${
                          isFollowing ? "text-text-secondary" : "text-white"
                        }`}
                      >
                        {isFollowing ? "Siguiendo" : "Seguir"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Shared hobbies */}
                  {user.sharedHobbies.length > 0 && (
                    <View className="flex-row flex-wrap gap-1.5 mt-3">
                      {user.sharedHobbies.slice(0, 4).map((h) => (
                        <View
                          key={h}
                          className="bg-background px-2.5 py-1 rounded-full"
                        >
                          <Text className="text-text-muted text-xs">
                            {HOBBY_LABELS[h] || h}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Stats */}
                  <View className="flex-row items-center gap-4 mt-2.5">
                    <Text className="text-text-muted text-xs">
                      {user.workoutsCount} workouts
                    </Text>
                    <Text className="text-text-muted text-xs">
                      Nivel {user.level}
                    </Text>
                    {user.streak > 0 && (
                      <Text className="text-text-muted text-xs">
                        🔥 {user.streak} racha
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}

            <View className="h-28" />
          </ScrollView>
        </Animated.View>
      )}

      {/* Bottom */}
      <View className="px-6 pb-6 pt-2 bg-background">
        {suggestions.length > 0 && following.size < suggestions.length && (
          <TouchableOpacity
            onPress={handleFollowAll}
            disabled={followingAll}
            className="flex-row items-center justify-center py-2.5 mb-2"
          >
            {followingAll ? (
              <ActivityIndicator size="small" color="#6C63FF" />
            ) : (
              <>
                <Ionicons name="people" size={16} color="#6C63FF" />
                <Text className="text-primary font-semibold text-sm ml-2">
                  Seguir a todos ({suggestions.length - following.size})
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        <CustomButton title="Continuar" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}
