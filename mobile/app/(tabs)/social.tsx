// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/social.tsx
// Sprint 4: Social Feed completo
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useUser } from "@clerk/clerk-expo";
import { router } from "expo-router";
import {
  socialAPI,
  badgesAPI,
  type SocialPost,
} from "@/lib/api";

// ─── Reaction Emojis ─────────────────────────────────
const REACTIONS: Record<string, { emoji: string; label: string }> = {
  FIRE: { emoji: "🔥", label: "Fuego" },
  MUSCLE: { emoji: "💪", label: "Fuerza" },
  CLAP: { emoji: "👏", label: "Aplauso" },
  TROPHY: { emoji: "🏆", label: "Trofeo" },
  TARGET: { emoji: "🎯", label: "Meta" },
};

// ─── Post Type Labels ─────────────────────────────────
const POST_TYPE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  WORKOUT_SHARE: { icon: "barbell", label: "Workout completado", color: "#6C63FF" },
  PR_SHARE: { icon: "trophy", label: "Nuevo PR", color: "#F59E0B" },
  MILESTONE: { icon: "star", label: "Logro desbloqueado", color: "#00D48A" },
  CHALLENGE_SHARE: { icon: "flag", label: "Challenge", color: "#FF6B35" },
};

// ─── Post Card Component ─────────────────────────────
function PostCard({
  post,
  onReact,
  onComment,
  myUserId,
}: {
  post: SocialPost;
  onReact: (postId: string, type: string) => void;
  onComment: (postId: string) => void;
  myUserId: string;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const typeInfo = POST_TYPE_LABELS[post.postType];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "ahora";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString("es", { month: "short", day: "numeric" });
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center gap-x-3 mb-3">
        {post.user.avatarUrl ? (
          <Image
            source={{ uri: post.user.avatarUrl }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
          />
        ) : (
          <View className="bg-primary/20 rounded-full w-10 h-10 items-center justify-center">
            <Text className="text-primary font-bold">
              {post.user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <View className="flex-row items-center gap-x-2">
            <Text className="text-white font-bold text-sm">
              {post.user.name}
            </Text>
            <View className="bg-primary/20 rounded-full px-2 py-0.5">
              <Text className="text-primary text-xs font-bold">
                Lv.{post.user.level}
              </Text>
            </View>
          </View>
          <Text className="text-text-muted text-xs">
            @{post.user.username} · {timeAgo(post.createdAt)}
          </Text>
        </View>
      </View>

      {/* Post type badge */}
      {typeInfo && (
        <View
          className="rounded-2xl px-3 py-2 mb-3 flex-row items-center gap-x-2 self-start"
          style={{ backgroundColor: typeInfo.color + "15" }}
        >
          <Ionicons name={typeInfo.icon as any} size={14} color={typeInfo.color} />
          <Text className="text-xs font-bold" style={{ color: typeInfo.color }}>
            {typeInfo.label}
          </Text>
        </View>
      )}

      {/* Content */}
      {post.content && (
        <Text className="text-white text-sm mb-3 leading-5">
          {post.content}
        </Text>
      )}

      {/* Workout data */}
      {post.workoutData && (
        <View className="bg-background-elevated rounded-2xl p-3 mb-3">
          <Text className="text-white font-bold text-sm mb-1">
            {post.workoutData.name}
          </Text>
          <View className="flex-row gap-x-4">
            {post.workoutData.duration ? (
              <Text className="text-text-secondary text-xs">
                ⏱ {post.workoutData.duration} min
              </Text>
            ) : null}
            {post.workoutData.totalVolume ? (
              <Text className="text-text-secondary text-xs">
                🏋️ {Math.round(post.workoutData.totalVolume)} kg
              </Text>
            ) : null}
            {post.workoutData.xpEarned ? (
              <Text className="text-text-secondary text-xs">
                ⭐ +{post.workoutData.xpEarned} XP
              </Text>
            ) : null}
          </View>
        </View>
      )}

      {/* Images */}
      {post.imageUrls && post.imageUrls.length > 0 && (
        <View className="rounded-2xl overflow-hidden mb-3">
          <Image
            source={{ uri: post.imageUrls[0] }}
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
        </View>
      )}

      {/* Action bar */}
      <View className="flex-row items-center justify-between pt-2 border-t border-background-elevated">
        {/* Reaction button */}
        <TouchableOpacity
          className="flex-row items-center gap-x-1"
          onPress={() => {
            if (post.myReaction) {
              onReact(post.id, post.myReaction); // toggle off
            } else {
              setShowReactions(!showReactions);
            }
          }}
          onLongPress={() => setShowReactions(!showReactions)}
        >
          <Text className="text-lg">
            {post.myReaction ? REACTIONS[post.myReaction]?.emoji : "🤍"}
          </Text>
          <Text className={`text-sm ${post.myReaction ? "text-primary font-bold" : "text-text-secondary"}`}>
            {post.reactionsCount > 0 ? post.reactionsCount : ""}
          </Text>
        </TouchableOpacity>

        {/* Comment button */}
        <TouchableOpacity
          className="flex-row items-center gap-x-1"
          onPress={() => onComment(post.id)}
        >
          <Ionicons name="chatbubble-outline" size={18} color="#6B6B80" />
          <Text className="text-text-secondary text-sm">
            {post._count.comments > 0 ? post._count.comments : ""}
          </Text>
        </TouchableOpacity>

        {/* Share placeholder */}
        <TouchableOpacity>
          <Ionicons name="share-outline" size={18} color="#6B6B80" />
        </TouchableOpacity>
      </View>

      {/* Reaction picker */}
      {showReactions && (
        <View className="flex-row gap-x-2 mt-2 bg-background-elevated rounded-2xl p-2 self-start">
          {Object.entries(REACTIONS).map(([key, { emoji }]) => (
            <TouchableOpacity
              key={key}
              className={`rounded-full p-2 ${post.myReaction === key ? "bg-primary/20" : ""}`}
              onPress={() => {
                onReact(post.id, key);
                setShowReactions(false);
              }}
            >
              <Text className="text-xl">{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Create Post Modal ───────────────────────────────
function CreatePostModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (content: string) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    await onSubmit(content.trim());
    setContent("");
    setPosting(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-background rounded-t-3xl p-5 pb-10">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-white font-bold text-xl">Nuevo post</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-4 text-base mb-4"
            value={content}
            onChangeText={setContent}
            placeholder="¿Qué quieres compartir con la comunidad?"
            placeholderTextColor="#6B6B80"
            multiline
            numberOfLines={4}
            style={{ textAlignVertical: "top", minHeight: 120 }}
            autoFocus
          />

          <TouchableOpacity
            className={`rounded-2xl py-4 items-center ${content.trim() ? "bg-primary" : "bg-background-elevated"}`}
            onPress={handlePost}
            disabled={!content.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className={`font-bold text-base ${content.trim() ? "text-white" : "text-text-muted"}`}>
                Publicar
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// SOCIAL SCREEN
// ═══════════════════════════════════════════════════════
export default function SocialScreen() {
  const { user: clerkUser } = useUser();
  const [activeTab, setActiveTab] = useState<"feed" | "discover" | "challenges">("feed");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [myUserId, setMyUserId] = useState("");

  const fetchFeed = useCallback(async () => {
    try {
      const res = await socialAPI.getFeed();
      setPosts(res.data.posts);
    } catch (err) {
      console.error("Feed error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDiscover = useCallback(async () => {
    try {
      const res = await socialAPI.discover();
      setSuggestions(res.data.suggestions);
    } catch (err) {
      console.error("Discover error:", err);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    fetchDiscover();
    // Get my userId
    import("@/lib/api").then(async (m) => {
      try {
        const res = await m.userAPI.getProfile();
        setMyUserId(res.data.id);
      } catch {}
    });
  }, [fetchFeed, fetchDiscover]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFeed();
    await fetchDiscover();
    try {
      await badgesAPI.check();
    } catch {}
    setRefreshing(false);
  }, [fetchFeed, fetchDiscover]);

  const handleReact = async (postId: string, type: string) => {
    try {
      const res = await socialAPI.react(postId, type);
      // Update local state
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const action = res.data.action;
          return {
            ...p,
            myReaction: action === "removed" ? null : res.data.type,
            reactionsCount:
              action === "added"
                ? p.reactionsCount + 1
                : action === "removed"
                ? Math.max(0, p.reactionsCount - 1)
                : p.reactionsCount,
          };
        })
      );
    } catch (err) {
      console.error("React error:", err);
    }
  };

  const handleCreatePost = async (content: string) => {
    try {
      await socialAPI.createPost({ content, postType: "TEXT" });
      await fetchFeed();
    } catch (err) {
      Alert.alert("Error", "No se pudo publicar");
    }
  };

  const handleFollow = async (targetUserId: string) => {
    try {
      await socialAPI.follow(targetUserId);
      setSuggestions((prev) => prev.filter((s) => s.id !== targetUserId));
    } catch (err) {
      console.error("Follow error:", err);
    }
  };

  // ─── Tabs ──────────────────────────────────────────
  const tabs = [
    { key: "feed" as const, label: "Feed", icon: "newspaper-outline" as const },
    { key: "discover" as const, label: "Descubrir", icon: "compass-outline" as const },
    { key: "challenges" as const, label: "Retos", icon: "trophy-outline" as const },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ─── HEADER ─────────────────────────────── */}
      <View className="px-5 pt-4 pb-2 flex-row justify-between items-center">
        <Text className="text-white text-2xl font-bold">Comunidad</Text>
        <View className="flex-row gap-x-2">
          <TouchableOpacity
            className="bg-primary rounded-2xl p-3"
            onPress={() => setShowCreatePost(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── TAB BAR ────────────────────────────── */}
      <View className="flex-row px-5 gap-x-2 mb-3">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 flex-row items-center justify-center gap-x-1 py-2.5 rounded-2xl ${
              activeTab === tab.key
                ? "bg-primary/20 border border-primary/30"
                : "bg-background-card border border-background-elevated"
            }`}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? "#6C63FF" : "#6B6B80"}
            />
            <Text
              className={`text-xs font-bold ${
                activeTab === tab.key ? "text-primary" : "text-text-secondary"
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
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
        ) : activeTab === "feed" ? (
          /* ─── FEED TAB ─── */
          posts.length === 0 ? (
            <View className="items-center mt-16 px-8">
              <Text className="text-4xl mb-3">📱</Text>
              <Text className="text-white font-bold text-lg text-center mb-2">
                Tu feed está vacío
              </Text>
              <Text className="text-text-secondary text-sm text-center mb-4">
                Sigue a otros atletas para ver su actividad, o publica algo tú.
              </Text>
              <TouchableOpacity
                className="bg-primary rounded-2xl px-6 py-3"
                onPress={() => setActiveTab("discover")}
              >
                <Text className="text-white font-bold">Descubrir personas</Text>
              </TouchableOpacity>
            </View>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onReact={handleReact}
                onComment={(postId) => {
                  // TODO: navegar a pantalla de comentarios
                  Alert.alert("Comentarios", "Próximamente: pantalla de comentarios")
                }}
                myUserId={myUserId}
              />
            ))
          )
        ) : activeTab === "discover" ? (
          /* ─── DISCOVER TAB ─── */
          <>
            <Text className="text-white font-bold text-base mb-3">
              Personas sugeridas
            </Text>
            {suggestions.length === 0 ? (
              <View className="items-center mt-10">
                <Text className="text-text-muted text-sm">No hay sugerencias por ahora</Text>
              </View>
            ) : (
              suggestions.map((user) => (
                <View
                  key={user.id}
                  className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3 flex-row items-center gap-x-3"
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
                </View>
              ))
            )}
          </>
        ) : (
          /* ─── CHALLENGES TAB ─── */
          <View className="items-center mt-10">
            <View className="bg-primary/10 rounded-3xl p-6 mb-4">
              <Ionicons name="trophy" size={40} color="#6C63FF" />
            </View>
            <Text className="text-white font-bold text-xl text-center mb-2">
              Retos y Competencias
            </Text>
            <Text className="text-text-secondary text-sm text-center mb-4 px-4">
              Crea challenges contra amigos, únete a retos globales y sube en los rankings.
            </Text>
            <TouchableOpacity
              className="bg-primary rounded-2xl px-6 py-3 mb-3"
              onPress={() => {
                Alert.alert("Próximamente", "La pantalla de challenges se construirá en la siguiente fase.")
              }}
            >
              <Text className="text-white font-bold">Ver Challenges</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-background-card border border-primary/30 rounded-2xl px-6 py-3"
              onPress={() => {
                Alert.alert("Próximamente", "Crear challenge se habilitará en la siguiente fase.")
              }}
            >
              <Text className="text-primary font-bold">Crear Challenge</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* ─── CREATE POST MODAL ──────────────────── */}
      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={handleCreatePost}
      />
    </SafeAreaView>
  );
}