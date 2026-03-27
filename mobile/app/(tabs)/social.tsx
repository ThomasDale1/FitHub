// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/social.tsx
// Social: Discover, Check Profile & Follow
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useTour } from "@/context/TourContext";
import { socialAPI, badgesAPI } from "@/lib/api";

// ═══════════════════════════════════════════════════════
// SOCIAL SCREEN
// ═══════════════════════════════════════════════════════
export default function SocialScreen() {
  const { isActive, step, advanceStep, beginTransition } = useTour();

  useFocusEffect(
    useCallback(() => {
      if (isActive && step === 0) {
        beginTransition();
        const t = setTimeout(() => advanceStep(), 3000);
        return () => clearTimeout(t);
      }
    }, [isActive, step, advanceStep, beginTransition])
  );

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await socialAPI.discover();
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error("Discover error:", err);
    }
  }, []);

  useEffect(() => {
    fetchDiscover().finally(() => setLoading(false));
  }, [fetchDiscover]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDiscover();
    try { await badgesAPI.check(); } catch {}
    setRefreshing(false);
  }, [fetchDiscover]);

  const handleFollow = async (targetUserId: string) => {
    try {
      await socialAPI.follow(targetUserId);
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ─── HEADER ─────────────────────────────── */}
      <View className="px-5 pt-4 pb-2">
        <Text className="text-white text-2xl font-bold">Comunidad</Text>
      </View>

      {/* ─── CONTENT ────────────────────────────── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
        className="px-5"
      >
        {loading ? (
          <ActivityIndicator color="#6C63FF" size="large" className="mt-20" />
        ) : (
          <>
            <Text className="text-white font-bold text-base mb-3 mt-2">
              Personas sugeridas
            </Text>
            {suggestions.length === 0 ? (
              <View className="items-center mt-10">
                <Text className="text-text-muted text-sm">No hay sugerencias por ahora</Text>
              </View>
            ) : (
              suggestions.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3 flex-row items-center gap-x-3"
                  onPress={() => router.push(`/profile/${user.id}` as any)}
                  activeOpacity={0.7}
                >
                  {user.avatarUrl ? (
                    <Image
                      source={{ uri: user.avatarUrl }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <View className="bg-primary/20 rounded-full w-12 h-12 items-center justify-center">
                      <Text className="text-primary font-bold text-lg">
                        {user.name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <View className="flex-row items-center gap-x-2">
                      <Text className="text-white font-bold text-sm">{user.name}</Text>
                      <View className="bg-primary/20 rounded-full px-2 py-0.5">
                        <Text className="text-primary text-xs">Lv.{user.level}</Text>
                      </View>
                    </View>
                    <Text className="text-text-muted text-xs">@{user.username}</Text>
                    {user.bio && (
                      <Text className="text-text-secondary text-xs mt-1" numberOfLines={1}>
                        {user.bio}
                      </Text>
                    )}
                    <Text className="text-text-muted text-xs mt-1">
                      {user._count?.workouts || 0} workouts · {user.streak} streak
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="bg-primary rounded-2xl px-4 py-2"
                    onPress={() => handleFollow(user.id)}
                  >
                    <Text className="text-white text-xs font-bold">Seguir</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
