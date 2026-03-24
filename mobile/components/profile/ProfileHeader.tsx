// ─────────────────────────────────────────────────────
// mobile/components/profile/ProfileHeader.tsx
// Enhanced profile header with avatar, info, follow, showcase
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import { useState } from "react"
import { type ProfileComboData, socialAPI } from "@/lib/api"
import { transforms } from "@/lib/cloudinary"
import XPBar from "@/components/XPBar"
import ShowcaseSelector from "@/components/profile/ShowcaseSelector"

const RARITY_COLORS: Record<string, { border: string; text: string }> = {
  COMMON: { border: "#6B7280", text: "#9CA3AF" },
  RARE: { border: "#3B82F6", text: "#60A5FA" },
  EPIC: { border: "#A855F7", text: "#C084FC" },
  LEGENDARY: { border: "#F59E0B", text: "#FBBF24" },
}

const AVATAR_GLOW: Record<string, { borderColor: string; borderWidth: number; shadowColor: string; shadowRadius: number; shadowOpacity: number }> = {
  COMMON:    { borderColor: "#A0A0A0", borderWidth: 2, shadowColor: "#A0A0A0", shadowRadius: 0, shadowOpacity: 0 },
  RARE:      { borderColor: "#3B82F6", borderWidth: 3, shadowColor: "#3B82F6", shadowRadius: 8, shadowOpacity: 0.4 },
  EPIC:      { borderColor: "#8B5CF6", borderWidth: 3, shadowColor: "#8B5CF6", shadowRadius: 12, shadowOpacity: 0.5 },
  LEGENDARY: { borderColor: "#F59E0B", borderWidth: 4, shadowColor: "#F59E0B", shadowRadius: 18, shadowOpacity: 0.7 },
}

interface ProfileHeaderProps {
  data: ProfileComboData
  onEditPress?: () => void
  onAvatarPress?: () => void
  uploadingAvatar?: boolean
  onRefresh?: () => void
}

export default function ProfileHeader({ data, onEditPress, onAvatarPress, uploadingAvatar, onRefresh }: ProfileHeaderProps) {
  const [followLoading, setFollowLoading] = useState(false)
  const [isFollowing, setIsFollowing] = useState(data.isFollowing)
  const [followersCount, setFollowersCount] = useState(data.followersCount)
  const [showcaseVisible, setShowcaseVisible] = useState(false)
  const [showcaseBadges, setShowcaseBadges] = useState(data.showcaseBadges)

  const handleFollow = async () => {
    setFollowLoading(true)
    try {
      if (isFollowing) {
        await socialAPI.unfollow(data.id)
        setIsFollowing(false)
        setFollowersCount(c => c - 1)
      } else {
        await socialAPI.follow(data.id)
        setIsFollowing(true)
        setFollowersCount(c => c + 1)
      }
    } catch {
      Alert.alert("Error", "No se pudo completar la acción")
    } finally {
      setFollowLoading(false)
    }
  }

  const avatarUrl = data.avatarUrl
  const rarity = data.featuredBadge ? RARITY_COLORS[data.featuredBadge.rarity] || RARITY_COLORS.COMMON : null
  const glow = data.featuredBadge ? AVATAR_GLOW[data.featuredBadge.rarity] || AVATAR_GLOW.COMMON : AVATAR_GLOW.COMMON

  return (
    <View>
      {/* Avatar + Info */}
      <View className="items-center mb-4">
        <TouchableOpacity
          onPress={data.isOwnProfile ? onAvatarPress : undefined}
          disabled={!data.isOwnProfile || uploadingAvatar}
          activeOpacity={0.7}
        >
          <View
            style={{
              shadowColor: glow.shadowColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: glow.shadowOpacity,
              shadowRadius: glow.shadowRadius,
              elevation: glow.shadowRadius > 0 ? glow.shadowRadius : 0,
            }}
          >
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl.startsWith("https://res.cloudinary.com/") ? transforms.avatarLarge(avatarUrl) : avatarUrl }}
                style={{ width: 100, height: 100, borderRadius: 50, borderWidth: glow.borderWidth, borderColor: glow.borderColor }}
              />
            ) : (
              <View
                className="bg-primary/20 items-center justify-center"
                style={{ width: 100, height: 100, borderRadius: 50, borderWidth: glow.borderWidth, borderColor: glow.borderColor }}
              >
                <Text className="text-primary text-3xl font-bold">
                  {(data.name || "A").charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            {data.isOwnProfile && (
              <View
                className="absolute bottom-0 right-0 bg-primary rounded-full items-center justify-center"
                style={{ width: 30, height: 30, borderWidth: 2, borderColor: "#0D0D1B" }}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Ionicons name="camera" size={14} color="white" />
                )}
              </View>
            )}
          </View>
        </TouchableOpacity>

        {/* Name + Username */}
        <Text className="text-white text-xl font-bold mt-3">{data.name}</Text>
        <View className="flex-row items-center gap-x-2 mt-0.5">
          <Text className="text-text-secondary text-sm">@{data.username}</Text>
          {data.featuredBadge && rarity && (
            <View
              className="flex-row items-center rounded-full px-2 py-0.5"
              style={{ backgroundColor: rarity.border + "20", borderWidth: 1, borderColor: rarity.border + "50" }}
            >
              <Text style={{ fontSize: 12 }}>{data.featuredBadge.icon}</Text>
              <Text className="ml-1 font-semibold" style={{ fontSize: 10, color: rarity.text }}>
                {data.featuredBadge.name}
              </Text>
            </View>
          )}
        </View>

        {data.bio && (
          <Text className="text-text-secondary text-sm text-center mt-2 px-8">{data.bio}</Text>
        )}

        {/* Place + Goal */}
        <View className="flex-row items-center gap-x-3 mt-2">
          {data.primaryPlace && (
            <View className="flex-row items-center gap-x-1">
              <Ionicons name="location-outline" size={12} color="#A0A0B0" />
              <Text className="text-text-secondary text-xs">{data.primaryPlace.name}</Text>
            </View>
          )}
          {data.experienceLevel && (
            <View className="flex-row items-center gap-x-1">
              <Ionicons name="fitness-outline" size={12} color="#A0A0B0" />
              <Text className="text-text-secondary text-xs capitalize">{data.experienceLevel.toLowerCase()}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Follow stats + button */}
      <View className="flex-row items-center justify-center gap-x-6 mb-4">
        <View className="items-center">
          <Text className="text-white font-bold text-lg">{followersCount}</Text>
          <Text className="text-text-secondary text-xs">Seguidores</Text>
        </View>
        <View className="items-center">
          <Text className="text-white font-bold text-lg">{data.followingCount}</Text>
          <Text className="text-text-secondary text-xs">Siguiendo</Text>
        </View>
        <View className="items-center">
          <Text className="text-white font-bold text-lg">{data.badgesEarned}</Text>
          <Text className="text-text-secondary text-xs">Badges</Text>
        </View>
      </View>

      {/* Action buttons for other user profiles */}
      {!data.isOwnProfile && (
        <View className="flex-row gap-x-3 mb-4 px-4">
          <TouchableOpacity
            className={`flex-1 rounded-2xl py-3 items-center ${isFollowing ? "bg-background-card border border-primary" : "bg-primary"}`}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className={`font-bold ${isFollowing ? "text-primary" : "text-white"}`}>
                {isFollowing ? "Siguiendo" : "Seguir"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-background-card border border-background-elevated rounded-2xl py-3 px-5 items-center"
            onPress={() => router.push(`/profile/compare?userId=${data.id}` as any)}
          >
            <Ionicons name="git-compare-outline" size={20} color="#6C63FF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Showcase badges */}
      {showcaseBadges.length > 0 ? (
        <TouchableOpacity
          className="flex-row justify-center gap-x-3 mb-4"
          onPress={data.isOwnProfile ? () => setShowcaseVisible(true) : undefined}
          disabled={!data.isOwnProfile}
          activeOpacity={data.isOwnProfile ? 0.7 : 1}
        >
          {showcaseBadges.map(b => {
            const r = RARITY_COLORS[b.rarity] || RARITY_COLORS.COMMON
            return (
              <View
                key={b.id}
                className="items-center px-3 py-2 rounded-2xl"
                style={{ backgroundColor: r.border + "15", borderWidth: 1, borderColor: r.border + "40" }}
              >
                <Text style={{ fontSize: 20 }}>{b.icon}</Text>
                <Text className="text-xs mt-0.5 font-semibold" style={{ color: r.text }}>{b.name}</Text>
              </View>
            )
          })}
          {data.isOwnProfile && (
            <View className="items-center justify-center px-2">
              <Ionicons name="pencil-outline" size={14} color="#6B6B80" />
            </View>
          )}
        </TouchableOpacity>
      ) : data.isOwnProfile ? (
        <TouchableOpacity
          className="flex-row items-center justify-center gap-x-2 mb-4 py-3 rounded-2xl border border-dashed border-background-elevated"
          onPress={() => setShowcaseVisible(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
          <Text className="text-primary text-sm font-semibold">Agregar Showcase Badges</Text>
        </TouchableOpacity>
      ) : null}

      {/* Showcase selector modal */}
      {data.isOwnProfile && (
        <ShowcaseSelector
          visible={showcaseVisible}
          currentBadgeIds={showcaseBadges.map(b => b.id)}
          onClose={() => setShowcaseVisible(false)}
          onSave={() => {
            onRefresh?.()
          }}
        />
      )}

      {/* Level & XP */}
      <LinearGradient colors={["#1E1E3A", "#2A2A4A"]} className="rounded-3xl p-5 mb-4">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center gap-x-2">
            <View className="bg-primary/20 rounded-xl p-2">
              <Ionicons name="star" size={20} color="#6C63FF" />
            </View>
            <View>
              <Text className="text-white font-bold text-lg">Nivel {data.level}</Text>
              <Text className="text-text-secondary text-xs">{data.xp.toLocaleString()} XP total</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-x-2">
            {data.streak > 0 && (
              <View className="bg-streak/10 border border-streak/30 rounded-2xl px-3 py-2 flex-row items-center gap-x-1">
                <Text className="text-lg">🔥</Text>
                <Text className="text-streak font-bold">{data.streak}</Text>
              </View>
            )}
            {data.bestStreak > data.streak && (
              <Text className="text-text-muted text-xs">Best: {data.bestStreak}</Text>
            )}
          </View>
        </View>
        <XPBar currentXP={data.currentXP} maxXP={data.maxXP} level={data.level} />
      </LinearGradient>
    </View>
  )
}
