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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState, useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { useUser } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { useTour } from "@/context/TourContext";
import {
  socialAPI,
  badgesAPI,
  challengesAPI,
  type SocialPost,
  type ChallengeData,
} from "@/lib/api";
import { pickImages, pickVideo, takePhoto } from "@/lib/mediaPicker";
import {
  uploadToCloudinary,
  transforms,
  type MediaAttachment,
} from "@/lib/cloudinary";
import MediaViewerModal, { type MediaViewerItem } from "@/components/MediaViewerModal";

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
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null);
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
      <TouchableOpacity
        className="flex-row items-center gap-x-3 mb-3"
        onPress={() => router.push(`/profile/${post.user.id}` as any)}
        activeOpacity={0.7}
      >
        {post.user.avatarUrl ? (
          <Image
            source={{
              uri: post.user.avatarUrl.startsWith("https://res.cloudinary.com/")
                ? transforms.avatarSmall(post.user.avatarUrl)
                : post.user.avatarUrl,
            }}
            style={{ width: 40, height: 40, borderRadius: 20 }}
            recyclingKey={post.user.avatarUrl}
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
      </TouchableOpacity>

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

      {/* Media (images/video) */}
      {post.media && post.media.length > 0 ? (
        post.media.length === 1 ? (
          <TouchableOpacity
            activeOpacity={0.92}
            className="rounded-2xl overflow-hidden mb-3"
            onPress={() => setViewerItem({
              url: post.media![0].url,
              type: post.media![0].type as "IMAGE" | "VIDEO",
              thumbnailUrl: post.media![0].thumbnailUrl,
            })}
          >
            <Image
              source={{
                uri:
                  post.media[0].type === "VIDEO"
                    ? post.media[0].thumbnailUrl || post.media[0].url
                    : transforms.feedImage(post.media[0].url),
              }}
              style={{
                width: "100%",
                height: post.media[0].width && post.media[0].height
                  ? Math.min(
                      350,
                      Math.round(
                        (post.media[0].height / post.media[0].width) *
                          (post.media[0].width > 350 ? 350 : post.media[0].width)
                      )
                    )
                  : 250,
              }}
              contentFit="cover"
              recyclingKey={post.media[0].url}
              transition={200}
            />
            {post.media[0].type === "VIDEO" && (
              <View className="absolute inset-0 items-center justify-center">
                <View className="bg-black/50 rounded-full p-3">
                  <Ionicons name="play" size={28} color="white" />
                </View>
                {post.media[0].duration && (
                  <View className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-0.5">
                    <Text className="text-white text-xs font-bold">
                      {Math.round(post.media[0].duration)}s
                    </Text>
                  </View>
                )}
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-3"
            pagingEnabled={false}
          >
            <View className="flex-row gap-x-2">
              {post.media.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  activeOpacity={0.92}
                  className="rounded-2xl overflow-hidden"
                  onPress={() => setViewerItem({
                    url: m.url,
                    type: m.type as "IMAGE" | "VIDEO",
                    thumbnailUrl: (m as any).thumbnailUrl,
                  })}
                >
                  <Image
                    source={{ uri: transforms.thumbnail(m.url) }}
                    style={{ width: 180, height: 180 }}
                    contentFit="cover"
                    recyclingKey={m.url}
                    transition={200}
                  />
                  {m.type === "VIDEO" && (
                    <View className="absolute inset-0 items-center justify-center">
                      <View className="bg-black/50 rounded-full p-2">
                        <Ionicons name="play" size={18} color="white" />
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )
      ) : post.imageUrls && post.imageUrls.length > 0 ? (
        /* Backwards compat: old posts with imageUrls only */
        <TouchableOpacity
          activeOpacity={0.92}
          className="rounded-2xl overflow-hidden mb-3"
          onPress={() => setViewerItem({ url: post.imageUrls![0], type: "IMAGE" })}
        >
          <Image
            source={{ uri: post.imageUrls[0] }}
            style={{ width: "100%", height: 200 }}
            contentFit="cover"
          />
        </TouchableOpacity>
      ) : null}

      <MediaViewerModal
        visible={viewerItem !== null}
        item={viewerItem}
        onClose={() => setViewerItem(null)}
      />

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
  onSubmit: (data: {
    content: string;
    media?: Array<{
      publicId: string;
      url: string;
      type: "IMAGE" | "VIDEO";
      width?: number;
      height?: number;
      bytes?: number;
      duration?: number;
      thumbnailUrl?: string;
    }>;
  }) => Promise<void>;
}) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

  const canPost = content.trim() || attachments.length > 0;

  const handlePickImages = async () => {
    const maxRemaining = 4 - attachments.filter((a) => a.type === "image").length;
    if (maxRemaining <= 0) {
      Alert.alert("Límite", "Máximo 4 imágenes por post");
      return;
    }
    // Can't mix video and images
    if (attachments.some((a) => a.type === "video")) {
      Alert.alert("Límite", "No puedes mezclar video e imágenes");
      return;
    }
    const images = await pickImages(maxRemaining);
    if (images.length > 0) {
      setAttachments((prev) => [...prev, ...images]);
    }
  };

  const handlePickVideo = async () => {
    if (attachments.length > 0) {
      Alert.alert("Límite", "El video debe ser el único archivo del post");
      return;
    }
    const video = await pickVideo();
    if (video) {
      setAttachments([video]);
    }
  };

  const handleTakePhoto = async () => {
    if (attachments.some((a) => a.type === "video")) {
      Alert.alert("Límite", "No puedes mezclar video e imágenes");
      return;
    }
    if (attachments.length >= 4) {
      Alert.alert("Límite", "Máximo 4 imágenes por post");
      return;
    }
    const photo = await takePhoto();
    if (photo) {
      setAttachments((prev) => [...prev, photo]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);

    try {
      let mediaData: Array<{
        publicId: string;
        url: string;
        type: "IMAGE" | "VIDEO";
        width?: number;
        height?: number;
        bytes?: number;
        duration?: number;
        thumbnailUrl?: string;
      }> | undefined;

      // Upload media to Cloudinary if any
      if (attachments.length > 0) {
        setUploadStatus("Subiendo...");
        mediaData = [];

        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i];
          setUploadStatus(
            attachments.length > 1
              ? `Subiendo ${i + 1}/${attachments.length}...`
              : "Subiendo..."
          );

          const result = await uploadToCloudinary(att, {
            folder: att.type === "video" ? "fithub/videos" : "fithub/posts",
            onProgress: (p) => {
              const base = (i / attachments.length) * 100;
              const slice = (1 / attachments.length) * 100;
              setUploadProgress(Math.round(base + (p.percent / 100) * slice));
            },
          });

          mediaData.push({
            publicId: result.public_id,
            url: result.secure_url,
            type: att.type === "video" ? "VIDEO" : "IMAGE",
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            duration: result.duration,
            thumbnailUrl:
              att.type === "video"
                ? transforms.videoThumbnail(result.secure_url)
                : undefined,
          });
        }
        setUploadStatus("Publicando...");
      }

      await onSubmit({ content: content.trim(), media: mediaData });
      setContent("");
      setAttachments([]);
      setUploadProgress(0);
      setUploadStatus("");
      onClose();
    } catch (err) {
      console.error("Post error:", err);
      Alert.alert("Error", "No se pudo publicar. Intenta de nuevo.");
    } finally {
      setPosting(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  };

  const handleClose = () => {
    if (posting) return;
    setContent("");
    setAttachments([]);
    setUploadProgress(0);
    setUploadStatus("");
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View className="bg-background rounded-t-3xl p-5 pb-10">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white font-bold text-xl">Nuevo post</Text>
                <TouchableOpacity onPress={handleClose} disabled={posting}>
                  <Ionicons name="close" size={24} color="#A0A0B0" />
                </TouchableOpacity>
              </View>

              {/* Text input */}
              <TextInput
                className="bg-background-elevated text-white rounded-2xl px-4 py-4 text-base mb-3"
                value={content}
                onChangeText={setContent}
                placeholder="¿Qué quieres compartir con la comunidad?"
                placeholderTextColor="#6B6B80"
                multiline
                numberOfLines={3}
                style={{ textAlignVertical: "top", minHeight: 80 }}
                editable={!posting}
              />

              {/* Media preview */}
              {attachments.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-3"
                >
                  <View className="flex-row gap-x-2">
                    {attachments.map((att, i) => (
                      <View key={i} className="relative">
                        <Image
                          source={{ uri: att.uri }}
                          style={{
                            width: attachments.length === 1 ? 280 : 140,
                            height: attachments.length === 1 ? 200 : 140,
                            borderRadius: 16,
                          }}
                          contentFit="cover"
                        />
                        {att.type === "video" && (
                          <View className="absolute inset-0 items-center justify-center">
                            <View className="bg-black/50 rounded-full p-2">
                              <Ionicons name="play" size={24} color="white" />
                            </View>
                            {att.duration && (
                              <View className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-0.5">
                                <Text className="text-white text-xs font-bold">
                                  {Math.round(att.duration)}s
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {!posting && (
                          <TouchableOpacity
                            className="absolute -top-1 -right-1 bg-red-500 rounded-full w-6 h-6 items-center justify-center"
                            onPress={() => removeAttachment(i)}
                          >
                            <Ionicons name="close" size={14} color="white" />
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              )}

              {/* Upload progress */}
              {posting && uploadStatus ? (
                <View className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-text-secondary text-xs">{uploadStatus}</Text>
                    {uploadProgress > 0 && (
                      <Text className="text-primary text-xs font-bold">{uploadProgress}%</Text>
                    )}
                  </View>
                  {uploadProgress > 0 && (
                    <View className="bg-background-elevated rounded-full h-2">
                      <View
                        className="bg-primary rounded-full h-2"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </View>
                  )}
                </View>
              ) : null}

              {/* Media action bar */}
              {!posting && (
                <View className="flex-row gap-x-3 mb-4 border-t border-background-elevated pt-3">
                  <TouchableOpacity
                    className="flex-row items-center gap-x-1.5 bg-background-elevated rounded-2xl px-4 py-2.5"
                    onPress={handlePickImages}
                  >
                    <Ionicons name="image-outline" size={18} color="#6C63FF" />
                    <Text className="text-text-secondary text-sm">Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-x-1.5 bg-background-elevated rounded-2xl px-4 py-2.5"
                    onPress={handlePickVideo}
                  >
                    <Ionicons name="videocam-outline" size={18} color="#FF6B35" />
                    <Text className="text-text-secondary text-sm">Video</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className="flex-row items-center gap-x-1.5 bg-background-elevated rounded-2xl px-4 py-2.5"
                    onPress={handleTakePhoto}
                  >
                    <Ionicons name="camera-outline" size={18} color="#00D48A" />
                    <Text className="text-text-secondary text-sm">Cámara</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Post button */}
              <TouchableOpacity
                className={`rounded-2xl py-4 items-center ${canPost ? "bg-primary" : "bg-background-elevated"}`}
                onPress={handlePost}
                disabled={!canPost || posting}
              >
                {posting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className={`font-bold text-base ${canPost ? "text-white" : "text-text-muted"}`}>
                    Publicar
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Create Challenge Modal ──────────────────────────
const CHALLENGE_TYPES = [
  { key: "FREQUENCY", label: "Workouts", icon: "repeat", unit: "sesiones" },
  { key: "VOLUME", label: "Volumen", icon: "barbell", unit: "kg" },
  { key: "PR", label: "PRs", icon: "trophy", unit: "PRs" },
  { key: "DISTANCE", label: "Distancia", icon: "walk", unit: "km" },
  { key: "STREAK", label: "Streak", icon: "flame", unit: "días" },
] as const;

const DURATION_PRESETS = [
  { label: "3 días", days: 3 },
  { label: "1 semana", days: 7 },
  { label: "2 semanas", days: 14 },
  { label: "1 mes", days: 30 },
];

function CreateChallengeModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    type: string;
    mode: "MILESTONE" | "TIMED";
    goal: number;
    unit: string;
    endDate: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [selectedType, setSelectedType] = useState(0);
  const [mode, setMode] = useState<"MILESTONE" | "TIMED">("MILESTONE");
  const [goal, setGoal] = useState("");
  const [selectedDuration, setSelectedDuration] = useState(1);

  const handleSubmit = () => {
    const ct = CHALLENGE_TYPES[selectedType];
    const goalNum = parseFloat(goal);
    if (!title.trim()) {
      Alert.alert("Error", "Escribe un nombre para el challenge");
      return;
    }
    if (!goalNum || goalNum <= 0) {
      Alert.alert("Error", "La meta debe ser mayor a 0");
      return;
    }
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + DURATION_PRESETS[selectedDuration].days);

    onSubmit({
      title: title.trim(),
      type: ct.key,
      mode,
      goal: goalNum,
      unit: ct.unit,
      endDate: endDate.toISOString(),
    });

    // Reset
    setTitle("");
    setGoal("");
    setSelectedType(0);
    setMode("MILESTONE");
    setSelectedDuration(1);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <ScrollView
              bounces={false}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: "85%" }}
            >
              <View className="bg-background rounded-t-3xl p-5 pb-10">
                <View className="flex-row justify-between items-center mb-5">
                  <Text className="text-white font-bold text-xl">Crear Challenge</Text>
                  <TouchableOpacity onPress={onClose}>
                    <Ionicons name="close" size={24} color="#A0A0B0" />
                  </TouchableOpacity>
                </View>

                {/* Nombre */}
                <Text className="text-text-secondary text-sm mb-1">Nombre del reto</Text>
                <TextInput
                  className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-4"
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Ej: Reto de volumen semanal"
                  placeholderTextColor="#6B6B80"
                />

                {/* Tipo */}
                <Text className="text-text-secondary text-sm mb-2">Tipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                  <View className="flex-row gap-x-2">
                    {CHALLENGE_TYPES.map((t, i) => (
                      <TouchableOpacity
                        key={t.key}
                        className={`rounded-2xl px-4 py-2.5 flex-row items-center gap-x-1.5 ${
                          selectedType === i ? "bg-primary" : "bg-background-elevated"
                        }`}
                        onPress={() => setSelectedType(i)}
                      >
                        <Ionicons
                          name={t.icon as any}
                          size={16}
                          color={selectedType === i ? "white" : "#A0A0B0"}
                        />
                        <Text className={`text-sm font-bold ${
                          selectedType === i ? "text-white" : "text-text-secondary"
                        }`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                {/* Modo */}
                <Text className="text-text-secondary text-sm mb-2">Modo</Text>
                <View className="flex-row gap-x-2 mb-4">
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl p-3 ${
                      mode === "MILESTONE" ? "bg-primary/20 border border-primary" : "bg-background-elevated"
                    }`}
                    onPress={() => setMode("MILESTONE")}
                  >
                    <Text className={`font-bold text-sm ${
                      mode === "MILESTONE" ? "text-primary" : "text-text-secondary"
                    }`}>🏁 Carrera</Text>
                    <Text className="text-text-muted text-xs mt-0.5">
                      Primero en llegar gana
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    className={`flex-1 rounded-2xl p-3 ${
                      mode === "TIMED" ? "bg-primary/20 border border-primary" : "bg-background-elevated"
                    }`}
                    onPress={() => setMode("TIMED")}
                  >
                    <Text className={`font-bold text-sm ${
                      mode === "TIMED" ? "text-primary" : "text-text-secondary"
                    }`}>⏱ Competencia</Text>
                    <Text className="text-text-muted text-xs mt-0.5">
                      Mejor puntaje al final gana
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Meta */}
                <Text className="text-text-secondary text-sm mb-1">
                  Meta ({CHALLENGE_TYPES[selectedType].unit})
                </Text>
                <TextInput
                  className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-4"
                  value={goal}
                  onChangeText={setGoal}
                  keyboardType="numeric"
                  placeholder={`Ej: 100 ${CHALLENGE_TYPES[selectedType].unit}`}
                  placeholderTextColor="#6B6B80"
                />

                {/* Duración */}
                <Text className="text-text-secondary text-sm mb-2">Duración</Text>
                <View className="flex-row gap-x-2 mb-5">
                  {DURATION_PRESETS.map((d, i) => (
                    <TouchableOpacity
                      key={d.days}
                      className={`flex-1 rounded-2xl py-2.5 items-center ${
                        selectedDuration === i ? "bg-primary" : "bg-background-elevated"
                      }`}
                      onPress={() => setSelectedDuration(i)}
                    >
                      <Text className={`text-xs font-bold ${
                        selectedDuration === i ? "text-white" : "text-text-secondary"
                      }`}>{d.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  className="bg-primary rounded-2xl py-4 items-center"
                  onPress={handleSubmit}
                >
                  <Text className="text-white font-bold text-base">Crear Challenge</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// SOCIAL SCREEN
// ═══════════════════════════════════════════════════════
export default function SocialScreen() {
  const { user: clerkUser } = useUser();
  const { isActive, step, advanceStep, beginTransition } = useTour();
  const [activeTab, setActiveTab] = useState<"feed" | "discover" | "challenges">("feed");

  // Tour: hide overlay immediately so user sees the tab, then advance after delay
  useFocusEffect(
    useCallback(() => {
      if (isActive && step === 0) {
        beginTransition()
        const t = setTimeout(() => advanceStep(), 3000)
        return () => clearTimeout(t)
      }
    }, [isActive, step, advanceStep, beginTransition])
  );
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [myUserId, setMyUserId] = useState("");
  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [challengeFilter, setChallengeFilter] = useState<"active" | "available" | "mine">("active");

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

  const fetchChallenges = useCallback(async () => {
    try {
      const res = await challengesAPI.getAll(challengeFilter);
      setChallenges(res.data);
    } catch (err) {
      console.error("Challenges error:", err);
    }
  }, [challengeFilter]);

  useEffect(() => {
    if (activeTab === "challenges") {
      fetchChallenges();
    }
  }, [activeTab, fetchChallenges]);

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

  const handleCreatePost = async (data: {
    content: string;
    media?: {
      publicId: string;
      url: string;
      type: "IMAGE" | "VIDEO";
      width?: number;
      height?: number;
      bytes?: number;
      duration?: number;
      thumbnailUrl?: string;
    }[];
  }) => {
    try {
      await socialAPI.createPost({
        content: data.content || undefined,
        media: data.media,
        postType: data.media?.length
          ? data.media.some((m) => m.type === "VIDEO")
            ? "VIDEO"
            : "IMAGE"
          : "TEXT",
      });
      await fetchFeed();
    } catch {
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

  const handleJoinChallenge = async (challengeId: string) => {
    try {
      await challengesAPI.join(challengeId);
      fetchChallenges();
      Alert.alert("¡Unido!", "Te uniste al challenge");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo unir");
    }
  };

  const handleLeaveChallenge = async (challengeId: string) => {
    Alert.alert("Salir del challenge", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salir",
        style: "destructive",
        onPress: async () => {
          try {
            await challengesAPI.leave(challengeId);
            fetchChallenges();
          } catch (err: any) {
            Alert.alert("Error", err?.response?.data?.error || "No se pudo salir");
          }
        },
      },
    ]);
  };

  const handleCreateChallenge = async (data: {
    title: string;
    type: string;
    mode: "MILESTONE" | "TIMED";
    goal: number;
    unit: string;
    endDate: string;
  }) => {
    try {
      await challengesAPI.create({
        ...data,
        startDate: new Date().toISOString(),
        isPublic: true,
      });
      setShowCreateChallenge(false);
      setChallengeFilter("active");
      fetchChallenges();
      Alert.alert("¡Challenge creado!", "Ya puedes competir");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "No se pudo crear");
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
        ) : (
          /* ─── CHALLENGES TAB ─── */
          <>
            {/* Filter pills */}
            <View className="flex-row gap-x-2 mb-4">
              {([
                { key: "active" as const, label: "Mis retos" },
                { key: "available" as const, label: "Disponibles" },
                { key: "mine" as const, label: "Creados" },
              ]).map((f) => (
                <TouchableOpacity
                  key={f.key}
                  className={`flex-1 py-2 rounded-2xl items-center ${
                    challengeFilter === f.key
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-background-card border border-background-elevated"
                  }`}
                  onPress={() => setChallengeFilter(f.key)}
                >
                  <Text className={`text-xs font-bold ${
                    challengeFilter === f.key ? "text-primary" : "text-text-secondary"
                  }`}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Create button */}
            <TouchableOpacity
              className="bg-primary rounded-2xl py-3 items-center mb-4 flex-row justify-center gap-x-2"
              onPress={() => setShowCreateChallenge(true)}
            >
              <Ionicons name="add-circle" size={20} color="white" />
              <Text className="text-white font-bold">Crear Challenge</Text>
            </TouchableOpacity>

            {/* Challenge list */}
            {challenges.length === 0 ? (
              <View className="items-center mt-8">
                <Ionicons name="trophy-outline" size={48} color="#6B6B80" />
                <Text className="text-text-secondary text-sm mt-3">
                  {challengeFilter === "active"
                    ? "No tienes retos activos"
                    : challengeFilter === "available"
                    ? "No hay retos disponibles"
                    : "No has creado retos"}
                </Text>
              </View>
            ) : (
              challenges.map((c) => {
                const pct = c.goal > 0 && c.myProgress
                  ? Math.min(100, Math.round((c.myProgress.currentValue / c.goal) * 100))
                  : 0;
                const msLeft = new Date(c.endDate).getTime() - Date.now();
                const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
                // Hora de cierre en timezone local del dispositivo (igual para todos, distinta hora local)
                const endLocal = new Date(c.endDate).toLocaleString("es", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                });
                const typeIcons: Record<string, string> = {
                  VOLUME: "barbell", FREQUENCY: "repeat", STREAK: "flame",
                  PR: "trophy", DISTANCE: "walk", CUSTOM: "star",
                };

                return (
                  <View key={c.id} className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
                    {/* Header */}
                    <View className="flex-row items-center gap-x-3 mb-2">
                      <View className="bg-primary/20 rounded-2xl p-2.5">
                        <Ionicons
                          name={(typeIcons[c.type] || "star") as any}
                          size={20}
                          color="#6C63FF"
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-bold text-base">{c.title}</Text>
                        <View className="flex-row items-center gap-x-2 mt-0.5">
                          <Text className="text-text-muted text-xs">
                            {c.mode === "MILESTONE" ? "🏁 Carrera" : "⏱ Competencia"}
                          </Text>
                          <Text className="text-text-muted text-xs">·</Text>
                          <Text className="text-text-muted text-xs">
                            {c.participantsCount} participante{c.participantsCount !== 1 ? "s" : ""}
                          </Text>
                          {c.status === "ACTIVE" && (
                            <>
                              <Text className="text-text-muted text-xs">·</Text>
                              <Text className="text-text-muted text-xs">
                                {daysLeft > 0 ? `${daysLeft}d · ` : ""}Termina {endLocal}
                              </Text>
                            </>
                          )}
                        </View>
                      </View>
                      <View className="bg-background-elevated rounded-xl px-2.5 py-1">
                        <Text className="text-primary text-xs font-bold">+{c.xpReward} XP</Text>
                      </View>
                    </View>

                    {/* Goal */}
                    <Text className="text-text-secondary text-sm mb-2">
                      Meta: {c.goal.toLocaleString()} {c.unit}
                    </Text>

                    {/* Progress bar (if joined) */}
                    {c.isJoined && c.myProgress && (
                      <View className="mb-2">
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-text-muted text-xs">
                            {c.myProgress.currentValue.toLocaleString()} / {c.goal.toLocaleString()} {c.unit}
                          </Text>
                          <Text className="text-primary text-xs font-bold">{pct}%</Text>
                        </View>
                        <View className="bg-background-elevated rounded-full h-2">
                          <View
                            className="rounded-full h-2"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct >= 100 ? "#00D48A" : "#6C63FF",
                            }}
                          />
                        </View>
                        {c.myProgress.isWinner && (
                          <View className="flex-row items-center gap-x-1 mt-1">
                            <Text className="text-sm">🏆</Text>
                            <Text className="text-green-400 text-xs font-bold">¡Completado!</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Status badge for completed */}
                    {c.status === "COMPLETED" && !c.isJoined && (
                      <View className="bg-background-elevated rounded-xl px-3 py-1 self-start mb-2">
                        <Text className="text-text-muted text-xs">Finalizado</Text>
                      </View>
                    )}

                    {/* Action buttons */}
                    {c.status === "ACTIVE" && !c.isJoined && (
                      <TouchableOpacity
                        className="bg-primary rounded-2xl py-2.5 items-center mt-1"
                        onPress={() => handleJoinChallenge(c.id)}
                      >
                        <Text className="text-white font-bold text-sm">Unirme</Text>
                      </TouchableOpacity>
                    )}
                    {c.status === "ACTIVE" && c.isJoined && !c.myProgress?.isWinner && (
                      <TouchableOpacity
                        className="py-2 items-center mt-1"
                        onPress={() => handleLeaveChallenge(c.id)}
                      >
                        <Text className="text-red-400 text-xs">Salir del challenge</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })
            )}
          </>
        )}

        <View className="h-8" />
      </ScrollView>

      {/* ─── CREATE POST MODAL ──────────────────── */}
      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onSubmit={handleCreatePost}
      />

      {/* ─── CREATE CHALLENGE MODAL ──────────────── */}
      <CreateChallengeModal
        visible={showCreateChallenge}
        onClose={() => setShowCreateChallenge(false)}
        onSubmit={handleCreateChallenge}
      />
    </SafeAreaView>
  );
}