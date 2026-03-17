// ─────────────────────────────────────────────────────
// mobile/app/notifications/index.tsx
// Sprint 5C: Notifications screen
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
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { socialAPI, setAuthToken } from "@/lib/api";

// Notification type → icon + color mapping
const NOTIF_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  follow: { icon: "person-add", color: "#6C63FF" },
  reaction: { icon: "heart", color: "#FF6B6B" },
  comment: { icon: "chatbubble", color: "#00D48A" },
  challenge_invite: { icon: "flag", color: "#FF6B35" },
  badge: { icon: "ribbon", color: "#F59E0B" },
  milestone: { icon: "star", color: "#F59E0B" },
  level_up: { icon: "arrow-up-circle", color: "#6C63FF" },
  system: { icon: "notifications", color: "#A0A0B0" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es", { month: "short", day: "numeric" });
}

export default function NotificationsScreen() {
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      setAuthToken(token);
      const res = await socialAPI.getNotifications();
      setNotifications(res.data.notifications);
      // Mark as read
      await socialAPI.markNotificationsRead();
    } catch (err) {
      console.error("Notifications error:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-x-3 border-b border-background-elevated">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#A0A0B0" />
        </TouchableOpacity>
        <Text className="text-white text-2xl font-bold">Notificaciones</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
        }
      >
        {loading ? (
          <ActivityIndicator color="#6C63FF" size="large" className="mt-20" />
        ) : notifications.length === 0 ? (
          <View className="items-center mt-20 px-8">
            <Ionicons name="notifications-off-outline" size={48} color="#6B6B80" />
            <Text className="text-text-secondary text-sm text-center mt-4">
              No tienes notificaciones todavía.{"\n"}
              Empieza a entrenar y conectar con la comunidad.
            </Text>
          </View>
        ) : (
          <View className="px-5 pt-4">
            {notifications.map((notif) => {
              const config = NOTIF_CONFIG[notif.type] || NOTIF_CONFIG.system;
              return (
                <View
                  key={notif.id}
                  className={`flex-row items-start gap-x-3 py-3 border-b border-background-elevated ${
                    !notif.isRead ? "opacity-100" : "opacity-60"
                  }`}
                >
                  <View
                    className="rounded-full p-2 mt-0.5"
                    style={{ backgroundColor: config.color + "20" }}
                  >
                    <Ionicons name={config.icon} size={16} color={config.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white text-sm">{notif.title}</Text>
                    {notif.body && (
                      <Text className="text-text-secondary text-xs mt-0.5" numberOfLines={2}>
                        {notif.body}
                      </Text>
                    )}
                    <Text className="text-text-muted text-xs mt-1">
                      {timeAgo(notif.createdAt)}
                    </Text>
                  </View>
                  {!notif.isRead && (
                    <View className="bg-primary rounded-full w-2 h-2 mt-2" />
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}