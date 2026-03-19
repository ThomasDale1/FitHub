// ─────────────────────────────────────────────────────
// mobile/lib/notifications.ts
// Push notification setup, permissions, and token mgmt
// ─────────────────────────────────────────────────────
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api";

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
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
    console.log("Push notifications require a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission denied");
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
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

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
