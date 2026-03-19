// ─────────────────────────────────────────────────────
// mobile/hooks/useNotifications.ts
// Hook to initialize push notifications + deep linking
// ─────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import {
  registerForPushNotifications,
  savePushTokenToBackend,
} from "@/lib/notifications";

export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    // Register for push notifications
    console.log("🔔 [Push] Starting registration...");
    registerForPushNotifications().then((token) => {
      console.log("🔔 [Push] Token result:", token ? token.substring(0, 30) + "..." : "NULL");
      if (token) {
        setExpoPushToken(token);
        savePushTokenToBackend(token)
          .then(() => console.log("🔔 [Push] Token saved to backend ✅"))
          .catch((err) => console.error("🔔 [Push] Failed to save token:", err));
      } else {
        console.warn("🔔 [Push] No token obtained — check permissions or device");
      }
    }).catch((err) => console.error("🔔 [Push] Registration error:", err));

    // Listener: notification received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Could update badge count or in-app notification state here
      }
    );

    // Listener: user tapped on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return { expoPushToken };
}

/**
 * Navigate to the relevant screen based on notification data.
 */
function handleNotificationNavigation(data: Record<string, any>) {
  try {
    switch (data.type) {
      case "follow":
      case "reaction":
      case "comment":
        // Go to notifications screen
        router.push("/notifications");
        break;
      case "badge":
        // Go to profile (badges section)
        router.push("/(tabs)/profile");
        break;
      case "challenge_join":
        // Go to challenges (could deep link to specific challenge later)
        router.push("/notifications");
        break;
      default:
        router.push("/notifications");
        break;
    }
  } catch (err) {
    console.error("Notification navigation error:", err);
  }
}
