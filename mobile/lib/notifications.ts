// ─────────────────────────────────────────────────────
// mobile/lib/notifications.ts
// Push notification setup, permissions, and token mgmt
// Background notification handling via TaskManager
// ─────────────────────────────────────────────────────
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// ─── Background notification task name ───────────────
export const BACKGROUND_NOTIFICATION_TASK = "BACKGROUND_NOTIFICATION_TASK";

// ─── Define background notification handler ──────────
// Runs when a push notification arrives while app is killed/background
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("🔔 [BG Notification] Error:", error);
    return;
  }
  // data contains the notification payload
  // The OS already shows the notification — here we can do silent processing
  // like updating badge count, pre-fetching data, etc.
  console.log("🔔 [BG Notification] Received:", data);
});

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request permissions and get the Expo push token.
 * Returns null if permissions denied or not a physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log("🔔 [Push] Not a physical device — skipping");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log("🔔 [Push] Existing permission status:", existingStatus);
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log("🔔 [Push] Requested permission, got:", finalStatus);
  }

  if (finalStatus !== "granted") {
    console.log("🔔 [Push] Permission DENIED");
    return null;
  }

  // Android: create notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "FitHub",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6C63FF",
    });
  }

  // Get the Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  console.log("🔔 [Push] ProjectId:", projectId);
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  console.log("🔔 [Push] Got token:", tokenData.data);

  return tokenData.data;
}

/**
 * Register the push token with our backend.
 * Call this after auth is ready and token is obtained.
 */
export async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    await api.post("/api/push-token", {
      token,
      platform: Platform.OS,
    });
  } catch (err) {
    console.error("Failed to save push token:", err);
  }
}

/**
 * Remove push token from backend (on logout).
 */
export async function removePushTokenFromBackend(token: string): Promise<void> {
  try {
    await api.delete("/api/push-token", { data: { token } });
  } catch (err) {
    console.error("Failed to remove push token:", err);
  }
}

/**
 * Set the app badge count (unread notifications).
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

/**
 * Register background notification handler.
 * Allows processing notifications when app is killed/background.
 */
export async function registerBackgroundNotificationHandler(): Promise<void> {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_NOTIFICATION_TASK
    );
    if (!isRegistered) {
      await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
      console.log("🔔 [BG] Background notification handler registered");
    }
  } catch (err) {
    // Silently fail — not all environments support this
    console.log("🔔 [BG] Background notification handler not supported:", err);
  }
}
