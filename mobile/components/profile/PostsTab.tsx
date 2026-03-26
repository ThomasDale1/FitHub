// ─────────────────────────────────────────────────────
// mobile/components/profile/PostsTab.tsx
// Grid of user's social posts
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator, Dimensions } from "react-native"
import { useState } from "react"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { transforms } from "@/lib/cloudinary"
import type { SocialPost } from "@/lib/api"
import MediaViewerModal, { type MediaViewerItem } from "@/components/MediaViewerModal"

const SCREEN_WIDTH = Dimensions.get("window").width
const GRID_GAP = 4
const GRID_COLS = 3
const TILE_SIZE = (SCREEN_WIDTH - 40 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS

interface PostsTabProps {
  posts: SocialPost[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  onLoadMore: () => void
}

function PostTile({ post, onPress }: { post: SocialPost; onPress: (item: MediaViewerItem) => void }) {
  const firstMedia = post.media?.[0]
  const firstImage = firstMedia?.url || post.imageUrls?.[0]
  const isVideo = firstMedia?.type === "VIDEO"

  const handlePress = () => {
    if (!firstImage) return
    onPress({
      url: firstMedia?.url ?? firstImage,
      type: isVideo ? "VIDEO" : "IMAGE",
      thumbnailUrl: firstMedia?.thumbnailUrl,
    })
  }

  return (
    <View style={{ width: TILE_SIZE, height: TILE_SIZE, marginBottom: GRID_GAP }}>
      {firstImage ? (
        <TouchableOpacity activeOpacity={0.88} className="flex-1 rounded-xl overflow-hidden" onPress={handlePress}>
          <Image
            source={{ uri: firstImage.startsWith("https://res.cloudinary.com/") ? transforms.thumbnail(firstImage) : firstImage }}
            style={{ width: "100%", height: "100%" }}
          />
          {isVideo && (
            <View className="absolute top-1 right-1 bg-black/60 rounded-full p-1">
              <Ionicons name="play" size={10} color="white" />
            </View>
          )}
          <View className="absolute bottom-1 left-1 flex-row items-center gap-x-1">
            {post.reactionsCount > 0 && (
              <View className="bg-black/60 rounded-full px-1.5 py-0.5 flex-row items-center gap-x-0.5">
                <Ionicons name="heart" size={8} color="#FF6B6B" />
                <Text className="text-white" style={{ fontSize: 8 }}>{post.reactionsCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <View className="flex-1 bg-background-card border border-background-elevated rounded-xl p-2 justify-center">
          <Text className="text-text-secondary text-xs" numberOfLines={4}>
            {post.content}
          </Text>
          {post.postType === "WORKOUT" && (
            <Ionicons name="barbell-outline" size={16} color="#6C63FF" style={{ position: "absolute", top: 4, right: 4 }} />
          )}
        </View>
      )}
    </View>
  )
}

export default function PostsTab({ posts, loading, loadingMore, hasMore, onLoadMore }: PostsTabProps) {
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)

  if (loading) {
    return <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
  }

  if (posts.length === 0) {
    return (
      <View className="items-center py-12">
        <Ionicons name="images-outline" size={48} color="#4A4A5A" />
        <Text className="text-text-muted text-sm mt-3">Aún no hay publicaciones</Text>
      </View>
    )
  }

  return (
    <View>
      <View className="flex-row flex-wrap" style={{ gap: GRID_GAP }}>
        {posts.map(post => (
          <PostTile key={post.id} post={post} onPress={setViewerItem} />
        ))}
      </View>
      {hasMore && (
        <TouchableOpacity
          className="bg-background-card border border-background-elevated rounded-2xl py-3 mt-3 items-center"
          onPress={onLoadMore}
          disabled={loadingMore}
        >
          {loadingMore ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : (
            <Text className="text-primary text-sm font-semibold">Cargar más</Text>
          )}
        </TouchableOpacity>
      )}
      <MediaViewerModal
        visible={viewerItem !== null}
        item={viewerItem}
        onClose={() => setViewerItem(null)}
      />
    </View>
  )
}
