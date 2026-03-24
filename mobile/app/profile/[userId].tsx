// ─────────────────────────────────────────────────────
// mobile/app/profile/[userId].tsx
// Public profile view for any user
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useState, useCallback } from "react"
import { router, useLocalSearchParams } from "expo-router"
import {
  useProfileCombo,
  useProfileStats,
  useProfilePosts,
  useProfileHistory,
  useProfileBadges,
  useNutritionHistory,
  useStepsHistory,
} from "@/hooks/useProfile"

import ProfileHeader from "@/components/profile/ProfileHeader"
import ProfileTabBar, { type ProfileTab } from "@/components/profile/ProfileTabBar"
import PostsTab from "@/components/profile/PostsTab"
import StatsTab from "@/components/profile/StatsTab"
import ChartsTab from "@/components/profile/ChartsTab"
import HistoryTab from "@/components/profile/HistoryTab"
import BadgesTab from "@/components/profile/BadgesTab"

export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()

  const { data: combo, loading: comboLoading, refetch: refetchCombo } = useProfileCombo(userId)
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useProfileStats(userId)
  const { posts, loading: postsLoading, loadingMore: postsLoadingMore, hasMore: postsHasMore, refetch: refetchPosts, fetchMore: fetchMorePosts } = useProfilePosts(userId)
  const { workouts, loading: historyLoading, loadingMore: historyLoadingMore, total: historyTotal, hasMore: historyHasMore, refetch: refetchHistory, fetchMore: fetchMoreHistory } = useProfileHistory(userId)
  const { logs: nutritionLogs, loading: nutritionLoading, loadingMore: nutritionLoadingMore, total: nutritionTotal, hasMore: nutritionHasMore, refetch: refetchNutrition, fetchMore: fetchMoreNutrition } = useNutritionHistory(userId)
  const { days: stepsDays, loading: stepsLoading, loadingMore: stepsLoadingMore, total: stepsTotal, hasMore: stepsHasMore, refetch: refetchSteps, fetchMore: fetchMoreSteps } = useStepsHistory(userId)
  const { data: badgesData, loading: badgesLoading, refetch: refetchBadges } = useProfileBadges(userId)

  const [activeTab, setActiveTab] = useState<ProfileTab>("posts")
  const [refreshing, setRefreshing] = useState(false)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.all([
      refetchCombo(), refetchStats(), refetchPosts(), refetchHistory(), refetchNutrition(), refetchSteps(), refetchBadges(),
    ])
    setRefreshing(false)
  }, [refetchCombo, refetchStats, refetchPosts, refetchHistory, refetchNutrition, refetchSteps, refetchBadges])

  if (comboLoading && !combo) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#6C63FF" size="large" />
      </SafeAreaView>
    )
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
          {/* Back button */}
          <TouchableOpacity
            className="flex-row items-center gap-x-2 mb-4"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
            <Text className="text-white text-lg font-bold">
              {combo?.name || "Perfil"}
            </Text>
          </TouchableOpacity>

          {/* Profile header */}
          {combo && <ProfileHeader data={combo} />}

          {/* Tab bar */}
          <ProfileTabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab content */}
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
              isOwnProfile={combo?.isOwnProfile || false}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
