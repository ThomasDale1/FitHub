// ─────────────────────────────────────────────────────
// mobile/components/MediaViewerModal.tsx
// Full-screen photo/video viewer modal
// ─────────────────────────────────────────────────────
import { Modal, View, TouchableOpacity, Dimensions } from "react-native"
import { Image } from "expo-image"
import { Ionicons } from "@expo/vector-icons"
import { VideoView, useVideoPlayer } from "expo-video"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window")

export interface MediaViewerItem {
  url: string
  type: "IMAGE" | "VIDEO"
  thumbnailUrl?: string | null
}

interface MediaViewerModalProps {
  visible: boolean
  item: MediaViewerItem | null
  onClose: () => void
}

function VideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play()
  })
  return (
    <VideoView
      player={player}
      style={{ width: SCREEN_W, height: SCREEN_H * 0.72 }}
      contentFit="contain"
      nativeControls
    />
  )
}

export default function MediaViewerModal({ visible, item, onClose }: MediaViewerModalProps) {
  const insets = useSafeAreaInsets()

  if (!item) return null

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "black" }}>
        {/* Close button */}
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{
            position: "absolute",
            top: insets.top + 12,
            right: 16,
            zIndex: 20,
            backgroundColor: "rgba(0,0,0,0.65)",
            borderRadius: 28,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="close" size={26} color="white" />
        </TouchableOpacity>

        {/* Media content */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          {item.type === "VIDEO" ? (
            <VideoPlayer url={item.url} />
          ) : (
            <Image
              source={{ uri: item.url }}
              style={{ width: SCREEN_W, height: SCREEN_H * 0.88 }}
              contentFit="contain"
              transition={150}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}
