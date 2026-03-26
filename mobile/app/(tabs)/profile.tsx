// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/profile.tsx
// Enhanced Public Profile — tabbed layout
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { useUser, useAuth } from "@clerk/clerk-expo"
import { Ionicons } from "@expo/vector-icons"
import { useState, useCallback } from "react"
import { router } from "expo-router"
import { useProfile } from "@/hooks/useUserData"
import { useProfileCombo, useProfileStats, useProfilePosts, useProfileHistory, useProfileBadges, useNutritionHistory, useStepsHistory } from "@/hooks/useProfile"
import { badgesAPI, userAPI } from "@/lib/api"
import { pickAvatar } from "@/lib/mediaPicker"
import { uploadToCloudinary } from "@/lib/cloudinary"

import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileTabBar, { type ProfileTab } from "@/components/profile/ProfileTabBar"
import PostsTab from "@/components/profile/PostsTab"
import StatsTab from "@/components/profile/StatsTab"
import HistoryTab from "@/components/profile/HistoryTab"
import ChartsTab from "@/components/profile/ChartsTab"
import BadgesTab from "@/components/profile/BadgesTab"
import EditProfileSection from "@/components/profile/EditProfileSection"

// ═══════════════════════════════════════════════════════
// PROFILE SCREEN
// ═══════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { user: clerkUser } = useUser()
  const { signOut } = useAuth()
  const { profile, refetch: refetchOldProfile, updateProfile } = useProfile()

  // Get own user ID from old profile hook, then use enhanced profile
  const userId = profile?.id || null

  const { data: combo, loading: comboLoading, refetch: refetchCombo } = useProfileCombo(userId)
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useProfileStats(userId)
  const { posts, loading: postsLoading, loadingMore: postsLoadingMore, hasMore: postsHasMore, refetch: refetchPosts, fetchMore: fetchMorePosts } = useProfilePosts(userId)
  const { workouts, loading: historyLoading, loadingMore: historyLoadingMore, total: historyTotal, hasMore: historyHasMore, refetch: refetchHistory, fetchMore: fetchMoreHistory } = useProfileHistory(userId)
  const { logs: nutritionLogs, loading: nutritionLoading, loadingMore: nutritionLoadingMore, total: nutritionTotal, hasMore: nutritionHasMore, refetch: refetchNutrition, fetchMore: fetchMoreNutrition } = useNutritionHistory(userId)
  const { days: stepsDays, loading: stepsLoading, loadingMore: stepsLoadingMore, total: stepsTotal, hasMore: stepsHasMore, refetch: refetchSteps, fetchMore: fetchMoreSteps } = useStepsHistory(userId)
  const { data: badgesData, loading: badgesLoading, refetch: refetchBadges } = useProfileBadges(userId)

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts")
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      refetchOldProfile(),
      refetchCombo(),
      refetchStats(),
      refetchPosts(),
      refetchHistory(),
      refetchNutrition(),
      refetchSteps(),
      refetchBadges(),
      badgesAPI.check().catch(() => {}),
    ])
    setRefreshing(false)
  }, [refetchOldProfile, refetchCombo, refetchStats, refetchPosts, refetchHistory, refetchNutrition, refetchSteps, refetchBadges])

  const handleChangeAvatar = async () => {
    const image = await pickAvatar()
    if (!image) return

    setUploadingAvatar(true)
    try {
      const result = await uploadToCloudinary(image, { folder: "fithub/avatars" })
      await updateProfile({ avatarUrl: result.secure_url, avatarPublicId: result.public_id })
      refetchCombo()
    } catch {
      Alert.alert("Error", "No se pudo subir la foto de perfil")
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveProfile = async (data: any) => {
    setEditing(false)
    refetchCombo()
    refetchStats()
  }

  const handleSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await signOut()
          router.replace("/(auth)/sign-in")
        },
      },
    ])
  }

  // Loading state
  if (comboLoading && !combo) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
        <Text className="text-text-secondary mt-3">Cargando perfil...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
        >
          <View className="px-5 pt-4 pb-8">
            {/* ─── TOP BAR ─────────────────────────────── */}
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-2xl font-bold">Perfil</Text>
              <View className="flex-row gap-x-3">
                <TouchableOpacity
                  className="bg-background-card border border-background-elevated rounded-2xl p-3"
                  onPress={() => setEditing(!editing)}
                >
                  <Ionicons name={editing ? "close" : "create-outline"} size={20} color="#A0A0B0" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-background-card border border-background-elevated rounded-2xl p-3"
                  onPress={() => router.push("/settings" as any)}
                >
                  <Ionicons name="settings-outline" size={20} color="#A0A0B0" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="bg-background-card border border-background-elevated rounded-2xl p-3"
                  onPress={handleSignOut}
                >
                  <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ─── PROFILE HEADER ─────────────────────── */}
            {combo && (
              <ProfileHeader
                data={combo}
                onEditPress={() => setEditing(!editing)}
                onAvatarPress={handleChangeAvatar}
                uploadingAvatar={uploadingAvatar}
                onRefresh={onRefresh}
              />
            )}

            {/* ─── EDIT SECTION ────────────────────────── */}
            {editing && combo && (
              <EditProfileSection
                profile={{
                  name: combo.name,
                  username: combo.username,
                  bio: combo.bio,
                  weight: combo.weight,
                  height: combo.height,
                  bodyFat: combo.bodyFat,
                }}
                onSave={handleSaveProfile}
                onCancel={() => setEditing(false)}
              />
            )}

            {/* ─── TAB BAR ─────────────────────────────── */}
            <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {/* ─── TAB CONTENT ─────────────────────────── */}
            {activeTab === "posts" && (
              <PostsTab
                posts={posts}
                loading={postsLoading}
                loadingMore={postsLoadingMore}
                hasMore={postsHasMore}
                onLoadMore={fetchMorePosts}
              />
            )}

            {activeTab === "stats" && (
              <StatsTab data={stats} loading={statsLoading} />
            )}

            {activeTab === "charts" && userId && (
              <ChartsTab userId={userId} />
            )}

            {activeTab === "history" && (
              <HistoryTab
                workouts={workouts}
                workoutsLoading={historyLoading}
                workoutsLoadingMore={historyLoadingMore}
                workoutsTotal={historyTotal}
                workoutsHasMore={historyHasMore}
                onLoadMoreWorkouts={fetchMoreHistory}
                nutritionLogs={nutritionLogs}
                nutritionLoading={nutritionLoading}
                nutritionLoadingMore={nutritionLoadingMore}
                nutritionTotal={nutritionTotal}
                nutritionHasMore={nutritionHasMore}
                onLoadMoreNutrition={fetchMoreNutrition}
                stepsDays={stepsDays}
                stepsLoading={stepsLoading}
                stepsLoadingMore={stepsLoadingMore}
                stepsTotal={stepsTotal}
                stepsHasMore={stepsHasMore}
                onLoadMoreSteps={fetchMoreSteps}
              />
            )}

            {activeTab === "badges" && (
              <BadgesTab
                data={badgesData}
                loading={badgesLoading}
                isOwnProfile={true}
              />
            )}

            {/* ─── DEV: Seed badges ────────────────────── */}
            <TouchableOpacity
              onPress={() =>
                badgesAPI.seed()
                  .then(() => Alert.alert("✅ Done", "Badges seeded in DB!"))
                  .catch((e) => Alert.alert("Error", e?.message))
              }
              className="mt-6 mx-8 py-2 rounded-xl border border-background-elevated items-center"
            >
              <Text className="text-text-muted text-xs">🛠 Seed badges (DEV)</Text>
            </TouchableOpacity>

            {/* ─── VERSION INFO ────────────────────────── */}
            <Text className="text-text-muted text-xs text-center mt-4">
              Fit Hub v1.3.0 — Enhanced Profile
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
