// ─────────────────────────────────────────────────────
// mobile/app/badges/index.tsx
// Badges / Achievements Screen
// Grid layout with category filters, progress bars,
// rarity tiers, detail modal, and featured badge
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { badgesAPI, BadgeData, BadgesResponse } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BADGE_SIZE = (SCREEN_WIDTH - 40 - 24) / 3; // 3 columns, 40px padding, 12px*2 gap

// ─── Rarity colors ───────────────────────────────────
const RARITY_COLORS = {
  COMMON: { border: "#6B7280", bg: "#6B728020", text: "#9CA3AF", label: "Comun" },
  RARE: { border: "#3B82F6", bg: "#3B82F620", text: "#60A5FA", label: "Raro" },
  EPIC: { border: "#A855F7", bg: "#A855F720", text: "#C084FC", label: "Epico" },
  LEGENDARY: { border: "#F59E0B", bg: "#F59E0B20", text: "#FBBF24", label: "Legendario" },
};

// ─── Category config ─────────────────────────────────
const CATEGORIES = [
  { key: "ALL", label: "Todos", icon: "grid-outline" as const },
  { key: "WORKOUT", label: "Workout", icon: "barbell-outline" as const },
  { key: "VOLUME", label: "Volumen", icon: "fitness-outline" as const },
  { key: "STREAK", label: "Streak", icon: "flame-outline" as const },
  { key: "STEPS", label: "Pasos", icon: "footsteps-outline" as const },
  { key: "SOCIAL", label: "Social", icon: "people-outline" as const },
  { key: "PR", label: "PRs", icon: "trophy-outline" as const },
  { key: "CHALLENGE", label: "Retos", icon: "flag-outline" as const },
  { key: "MILESTONE", label: "Niveles", icon: "star-outline" as const },
  { key: "NUTRITION", label: "Nutricion", icon: "nutrition-outline" as const },
  { key: "SECRET", label: "Secretos", icon: "lock-closed-outline" as const },
];

// ─── Badge Card ──────────────────────────────────────
function BadgeCard({
  badge,
  onPress,
}: {
  badge: BadgeData;
  onPress: () => void;
}) {
  const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON;
  const isLocked = !badge.earned && (!badge.progress || badge.progress.percentage < 10);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ width: BADGE_SIZE, marginBottom: 12 }}
    >
      <View
        className="items-center rounded-2xl p-3"
        style={{
          backgroundColor: badge.earned ? rarity.bg : "#1A1A2E",
          borderWidth: 1.5,
          borderColor: badge.earned ? rarity.border : "#252540",
          opacity: isLocked ? 0.5 : 1,
        }}
      >
        {/* Icon */}
        <Text style={{ fontSize: 32 }}>{badge.icon}</Text>

        {/* Name */}
        <Text
          className="text-xs text-center mt-1 font-semibold"
          style={{ color: badge.earned ? rarity.text : "#6B6B80" }}
          numberOfLines={1}
        >
          {badge.name}
        </Text>

        {/* Progress or checkmark */}
        {badge.earned ? (
          <View className="flex-row items-center mt-1">
            <Ionicons name="checkmark-circle" size={14} color={rarity.border} />
          </View>
        ) : badge.progress ? (
          <View className="w-full mt-2">
            <View
              className="h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "#252540" }}
            >
              <View
                className="h-full rounded-full"
                style={{
                  width: `${badge.progress.percentage}%`,
                  backgroundColor: rarity.border,
                }}
              />
            </View>
            <Text className="text-text-muted text-center mt-0.5" style={{ fontSize: 9 }}>
              {badge.progress.percentage}%
            </Text>
          </View>
        ) : (
          <View className="mt-1">
            <Ionicons name="lock-closed" size={12} color="#4A4A5A" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Near Completion Card ────────────────────────────
function NearCompletionCard({ badge, onPress }: { badge: BadgeData; onPress: () => void }) {
  const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="mr-3"
      style={{ width: 200 }}
    >
      <View
        className="rounded-2xl p-3"
        style={{
          backgroundColor: rarity.bg,
          borderWidth: 1,
          borderColor: rarity.border + "40",
        }}
      >
        <View className="flex-row items-center gap-x-2 mb-2">
          <Text style={{ fontSize: 24 }}>{badge.icon}</Text>
          <View className="flex-1">
            <Text className="text-white font-bold text-sm" numberOfLines={1}>
              {badge.name}
            </Text>
            <Text className="text-text-secondary" style={{ fontSize: 10 }}>
              {badge.progress?.current}/{badge.progress?.target}
            </Text>
          </View>
        </View>
        <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#252540" }}>
          <View
            className="h-full rounded-full"
            style={{
              width: `${badge.progress?.percentage || 0}%`,
              backgroundColor: rarity.border,
            }}
          />
        </View>
        <Text className="text-right mt-1" style={{ fontSize: 10, color: rarity.text }}>
          {badge.progress?.percentage}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Badge Detail Modal ──────────────────────────────
function BadgeDetailModal({
  badge,
  visible,
  onClose,
  onSetFeatured,
  isFeatured,
}: {
  badge: BadgeData | null;
  visible: boolean;
  onClose: () => void;
  onSetFeatured: (slug: string | null) => void;
  isFeatured: boolean;
}) {
  if (!badge) return null;
  const rarity = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: "rgba(0,0,0,0.8)" }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          className="rounded-3xl p-6 mx-6"
          style={{
            backgroundColor: "#1A1A2E",
            borderWidth: 2,
            borderColor: rarity.border,
            width: SCREEN_WIDTH - 48,
          }}
        >
          {/* Close button */}
          <TouchableOpacity
            onPress={onClose}
            className="absolute top-4 right-4 z-10"
          >
            <Ionicons name="close" size={24} color="#6B6B80" />
          </TouchableOpacity>

          {/* Badge icon */}
          <View className="items-center mb-4">
            <View
              className="rounded-full items-center justify-center mb-3"
              style={{
                width: 80,
                height: 80,
                backgroundColor: rarity.bg,
                borderWidth: 2,
                borderColor: rarity.border,
              }}
            >
              <Text style={{ fontSize: 40 }}>{badge.icon}</Text>
            </View>

            <Text className="text-white text-xl font-bold text-center">
              {badge.name}
            </Text>

            {/* Rarity badge */}
            <View
              className="rounded-full px-3 py-1 mt-2"
              style={{ backgroundColor: rarity.bg, borderWidth: 1, borderColor: rarity.border }}
            >
              <Text style={{ color: rarity.text, fontSize: 11, fontWeight: "700" }}>
                {rarity.label.toUpperCase()}
              </Text>
            </View>
          </View>

          {/* Description */}
          <Text className="text-text-secondary text-center text-sm mb-4">
            {badge.description}
          </Text>

          {/* Progress */}
          {badge.progress && (
            <View className="mb-4">
              <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#252540" }}>
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${badge.progress.percentage}%`,
                    backgroundColor: rarity.border,
                  }}
                />
              </View>
              <View className="flex-row justify-between mt-1">
                <Text className="text-text-secondary text-xs">
                  {badge.progress.current} / {badge.progress.target}
                </Text>
                <Text style={{ color: rarity.text, fontSize: 12, fontWeight: "600" }}>
                  {badge.progress.percentage}%
                </Text>
              </View>
              {!badge.earned && badge.progress.percentage > 0 && (
                <Text className="text-text-muted text-xs text-center mt-2">
                  {badge.progress.target - badge.progress.current} mas para desbloquear
                </Text>
              )}
            </View>
          )}

          {/* XP Reward */}
          <View
            className="flex-row items-center justify-center gap-x-2 py-2 rounded-xl mb-4"
            style={{ backgroundColor: "#252540" }}
          >
            <Ionicons name="star" size={16} color="#F59E0B" />
            <Text className="text-white font-bold">+{badge.xpReward} XP</Text>
          </View>

          {/* Earned info */}
          {badge.earned && badge.earnedAt && (
            <Text className="text-text-muted text-xs text-center mb-4">
              Desbloqueado el{" "}
              {new Date(badge.earnedAt).toLocaleDateString("es", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Text>
          )}

          {/* Set as featured */}
          {badge.earned && (
            <TouchableOpacity
              className="rounded-2xl py-3 items-center"
              style={{
                backgroundColor: isFeatured ? "#252540" : rarity.bg,
                borderWidth: 1,
                borderColor: isFeatured ? "#6B6B80" : rarity.border,
              }}
              onPress={() => onSetFeatured(isFeatured ? null : badge.slug)}
            >
              <View className="flex-row items-center gap-x-2">
                <Ionicons
                  name={isFeatured ? "close-circle-outline" : "star-outline"}
                  size={18}
                  color={isFeatured ? "#6B6B80" : rarity.text}
                />
                <Text
                  style={{ color: isFeatured ? "#6B6B80" : rarity.text, fontWeight: "700" }}
                >
                  {isFeatured ? "Quitar de perfil" : "Destacar en perfil"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// BADGES SCREEN
// ═══════════════════════════════════════════════════════
export default function BadgesScreen() {
  const [data, setData] = useState<BadgesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedBadge, setSelectedBadge] = useState<BadgeData | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await badgesAPI.getAll();
      setData(res.data);
    } catch (err) {
      console.error("Error fetching badges:", err);
    }
  }, []);

  useEffect(() => {
    fetchBadges().finally(() => setLoading(false));
  }, [fetchBadges]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBadges();
    setRefreshing(false);
  }, [fetchBadges]);

  const handleBadgePress = (badge: BadgeData) => {
    setSelectedBadge(badge);
    setModalVisible(true);
  };

  const handleSetFeatured = async (slug: string | null) => {
    try {
      await badgesAPI.setFeatured(slug);
      await fetchBadges();
      setModalVisible(false);
    } catch (err) {
      console.error("Error setting featured badge:", err);
    }
  };

  // Filter badges by category
  const filteredBadges =
    selectedCategory === "ALL"
      ? data?.badges || []
      : (data?.grouped[selectedCategory] || []);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        <View className="px-5 pt-4 pb-8">
          {/* ─── HEADER ──────────────────────────────── */}
          <View className="flex-row items-center mb-5">
            <TouchableOpacity onPress={() => router.back()} className="mr-3">
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-2xl font-bold">Logros</Text>
            </View>
            <View className="bg-primary/20 rounded-full px-3 py-1">
              <Text className="text-primary font-bold text-sm">
                {data?.stats.earned || 0}/{data?.stats.total || 0}
              </Text>
            </View>
          </View>

          {/* ─── GLOBAL PROGRESS ─────────────────────── */}
          <LinearGradient
            colors={["#1E1E3A", "#2A2A4A"]}
            className="rounded-3xl p-4 mb-5"
          >
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-white font-bold text-base">Progreso total</Text>
              <Text className="text-primary font-bold">{data?.stats.percentage || 0}%</Text>
            </View>
            <View className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#252540" }}>
              <LinearGradient
                colors={["#6C63FF", "#A855F7"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="h-full rounded-full"
                style={{ width: `${data?.stats.percentage || 0}%` }}
              />
            </View>

            {/* Rarity breakdown */}
            <View className="flex-row mt-3 gap-x-2">
              {(["COMMON", "RARE", "EPIC", "LEGENDARY"] as const).map((r) => {
                const info = data?.stats.byRarity[r];
                const color = RARITY_COLORS[r];
                return (
                  <View key={r} className="flex-1 items-center">
                    <Text style={{ color: color.text, fontSize: 11, fontWeight: "700" }}>
                      {info?.earned || 0}/{info?.total || 0}
                    </Text>
                    <Text className="text-text-muted" style={{ fontSize: 9 }}>
                      {color.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </LinearGradient>

          {/* ─── NEAR COMPLETION ──────────────────────── */}
          {data?.nearCompletion && data.nearCompletion.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center gap-x-2 mb-3">
                <Ionicons name="flame" size={18} color="#FF6B6B" />
                <Text className="text-white font-bold text-base">Cerca de desbloquear</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {data.nearCompletion.map((badge) => (
                  <NearCompletionCard
                    key={badge.id}
                    badge={badge}
                    onPress={() => handleBadgePress(badge)}
                  />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ─── CATEGORY FILTERS ────────────────────── */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
            contentContainerStyle={{ gap: 8 }}
          >
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.key;
              const count =
                cat.key === "ALL"
                  ? data?.badges.length || 0
                  : (data?.grouped[cat.key]?.length || 0);

              if (cat.key !== "ALL" && count === 0) return null;

              return (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setSelectedCategory(cat.key)}
                  className="flex-row items-center gap-x-1 rounded-full px-3 py-2"
                  style={{
                    backgroundColor: isActive ? "#6C63FF" : "#1A1A2E",
                    borderWidth: 1,
                    borderColor: isActive ? "#6C63FF" : "#252540",
                  }}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isActive ? "white" : "#6B6B80"}
                  />
                  <Text
                    style={{
                      color: isActive ? "white" : "#6B6B80",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* ─── BADGES GRID ─────────────────────────── */}
          <View className="flex-row flex-wrap" style={{ gap: 12 }}>
            {filteredBadges.map((badge) => (
              <BadgeCard
                key={badge.id}
                badge={badge}
                onPress={() => handleBadgePress(badge)}
              />
            ))}
          </View>

          {filteredBadges.length === 0 && (
            <View className="items-center py-12">
              <Ionicons name="trophy-outline" size={48} color="#252540" />
              <Text className="text-text-muted mt-3">
                No hay badges en esta categoria
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── BADGE DETAIL MODAL ────────────────────── */}
      <BadgeDetailModal
        badge={selectedBadge}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSetFeatured={handleSetFeatured}
        isFeatured={
          !!data?.featuredBadge &&
          !!selectedBadge &&
          data.featuredBadge.slug === selectedBadge.slug
        }
      />
    </SafeAreaView>
  );
}
