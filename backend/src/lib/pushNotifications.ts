// ─────────────────────────────────────────────────────
// backend/src/lib/pushNotifications.ts
// Push Notification Service — Expo Push API
// ─────────────────────────────────────────────────────
import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "./prisma.js";

const expo = new Expo();

/**
 * Send a push notification to a single user.
 * Non-blocking — errors are logged, never thrown.
 */
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const tokens = await prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: "default" as const,
        title,
        body,
        data: data || {},
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets: ExpoPushTicket[] = await expo.sendPushNotificationsAsync(chunk);
        // Clean up invalid tokens
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const invalidToken = (chunk[i] as any).to as string;
            await prisma.pushToken.deleteMany({ where: { token: invalidToken } }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Push chunk error:", err);
      }
    }
  } catch (err) {
    console.error("sendPushToUser error:", err);
  }
}

/**
 * Send a push notification to multiple users at once.
 * Non-blocking — errors are logged, never thrown.
 */
export async function sendPushToMany(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    if (userIds.length === 0) return;

    const tokens = await prisma.pushToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t.token))
      .map((t) => ({
        to: t.token,
        sound: "default" as const,
        title,
        body,
        data: data || {},
      }));

    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            const invalidToken = (chunk[i] as any).to as string;
            await prisma.pushToken.deleteMany({ where: { token: invalidToken } }).catch(() => {});
          }
        }
      } catch (err) {
        console.error("Push chunk error:", err);
      }
    }
  } catch (err) {
    console.error("sendPushToMany error:", err);
  }
}
