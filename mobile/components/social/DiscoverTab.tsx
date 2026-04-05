// ─────────────────────────────────────────────────────
// mobile/components/social/DiscoverTab.tsx
// Smart Discover with categorized sections + match reasons
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { router } from "expo-router";
import { socialAPI, badgesAPI } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";

interface DiscoverUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streak: number;
  bio: string | null;
  experienceLevel: string | null;
  workoutsCount: number;
  followersCount: number;
  placeName: string | null;
  sameGym: boolean;
  matchReasons: string[];
  score: number;
  mutualCount: number;
  isFollowing?: boolean;
}

interface DiscoverSection {
  key: string;
  title: string;
  data: DiscoverUser[];
}

const SECTION_ICONS: Record<string, string> = {
  sameGym: "location",
  yourLevel: "flash",
  forYou: "sparkles",
};

export default function DiscoverTab() {
  const [sections, setSections] = useState<DiscoverSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  const normalizeUsers = (users: DiscoverUser[]) =>
    users.map((user) => ({ ...user, isFollowing: user.isFollowing ?? false }));

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await socialAPI.discover();
      const data = res.data;
      let allUsers: DiscoverUser[] = [];

      if (data.sections) {
        const sectionsWithFollow = data.sections.map((section: DiscoverSection) => ({
          ...section,
          data: normalizeUsers(section.data),
        }));
        setSections(sectionsWithFollow);
        sectionsWithFollow.forEach((section: DiscoverSection) => allUsers.push(...section.data));
      } else if (data.suggestions) {
        const suggestions = normalizeUsers(data.suggestions);
        setSections([{ key: "forYou", title: "Para ti", data: suggestions }]);
        allUsers = suggestions;
      }

      const alreadyFollowed = allUsers.filter((u) => u.isFollowing).map((u) => u.id);
      setFollowedIds(new Set(alreadyFollowed));
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
    try {
      await badgesAPI.check();
    } catch (err) {
      console.error("Badges check failed", err);
    }
    setRefreshing(false);
  }, [fetchDiscover]);

  const handleFollow = async (targetUserId: string) => {
    try {
      await socialAPI.follow(targetUserId);
      setFollowedIds((prev) => new Set(prev).add(targetUserId));
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  const renderUserCard = (user: DiscoverUser) => {
    const isFollowed = followedIds.has(user.id);

    return (
      <TouchableOpacity
        key={user.id}
        className="bg-background-card border border-background-elevated rounded-2xl p-4 mr-3"
        style={{ width: 200 }}
        onPress={() => router.push(`/profile/${user.id}` as any)}
        activeOpacity={0.8}
      >
        <View className="flex-row items-center mb-3">
          {user.avatarUrl ? (
            <Image
              source={{ uri: user.avatarUrl }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
            />
          ) : (
            <View className="bg-primary/20 rounded-full w-11 h-11 items-center justify-center">
              <Text className="text-primary font-bold text-base">
                {user.name.charAt(0) || user.username.charAt(0) || "?"}
              </Text>
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="text-white font-bold text-sm" numberOfLines={1}>
              {user.name}
            </Text>
            <Text className="text-text-muted text-[10px]">@{user.username}</Text>
          </View>
        </View>

        <View className="mb-3">
          <Text className="text-text-muted text-[10px] mb-1">{user.placeName || "Sin gimnasio"}</Text>
          <View className="flex-row flex-wrap gap-2">
            <View className="bg-background-elevated rounded-full px-2 py-1">
              <Text className="text-text-muted text-[10px]">Lv.{user.level}</Text>
            </View>
            {user.streak > 0 && (
              <View className="bg-background-elevated rounded-full px-2 py-1">
                <Text className="text-text-muted text-[10px]">{user.streak}d</Text>
              </View>
            )}
            <View className="bg-background-elevated rounded-full px-2 py-1">
              <Text className="text-text-muted text-[10px]">{user.mutualCount} mutual</Text>
            </View>
          </View>
        </View>

        {user.matchReasons.length > 0 && (
          <View className="mb-3">
            {user.matchReasons.slice(0, 2).map((reason, index) => (
              <View key={index} className="flex-row items-center mb-1">
                <View className="w-1 h-1 rounded-full bg-primary mr-2" />
                <Text className="text-text-secondary text-[11px]" numberOfLines={1}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          className={`rounded-xl py-2 items-center ${isFollowed ? "bg-background-elevated" : "bg-primary"}`}
          onPress={() => !isFollowed && handleFollow(user.id)}
          disabled={isFollowed}
        >
          <Text className={`text-xs font-bold ${isFollowed ? "text-text-muted" : "text-white"}`}>
            {isFollowed ? "Siguiendo" : "Seguir"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
      }
      className="flex-1"
    >
      {sections.length === 0 ? (
        <View className="items-center mt-20 px-5">
          <Ionicons name="search-outline" size={48} color="#6B6B80" />
          <Text className="text-text-muted text-sm mt-3 text-center">
            No hay sugerencias por ahora.{"\n"}Completa tu perfil para mejores matches.
          </Text>
        </View>
      ) : (
        sections.map((section) => (
          <View key={section.key} className="mb-5">
            <View className="flex-row items-center justify-between px-4 mb-3">
              <Text className="text-white font-bold text-sm">{section.title}</Text>
              <Text className="text-text-muted text-[10px]">
                {section.data.filter((user) => !followedIds.has(user.id)).length} nuevos
              </Text>
            </View>
            <FlatList
              data={section.data.filter((user) => !followedIds.has(user.id))}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => renderUserCard(item)}
            />
          </View>
        ))
      )}

      <View className="h-8" />
    </ScrollView>
  );
}
