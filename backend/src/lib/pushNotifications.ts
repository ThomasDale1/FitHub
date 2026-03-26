// ─────────────────────────────────────────────────────
// backend/src/lib/pushNotifications.ts
// Push Notification Service — Expo Push API
// ─────────────────────────────────────────────────────
import Expo, { ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";
import { prisma } from "./prisma.js";

const expo = new Expo();

// ─── Internal helper: chunk, send in parallel, batch-delete invalid tokens ───
async function sendMessages(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;
  const chunks = expo.chunkPushNotifications(messages);

  // Send all chunks concurrently instead of sequentially
  const results = await Promise.all(
    chunks.map(async (chunk): Promise<ExpoPushTicket[]> => {
      try {
        return await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error("Push chunk error:", err);
        return [];
      }
    })
  );

  // Collect all invalid tokens, then delete in a single query
  const invalidTokens: string[] = [];
  for (let c = 0; c < chunks.length; c++) {
    for (let i = 0; i < results[c].length; i++) {
      const ticket = results[c][i];
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(chunks[c][i].to as string);
      }
    }
  }
  if (invalidTokens.length > 0) {
    await prisma.pushToken.deleteMany({ where: { token: { in: invalidTokens } } }).catch(() => {});
  }
}

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

    await sendMessages(messages);
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

    await sendMessages(messages);
  } catch (err) {
    console.error("sendPushToMany error:", err);
  }
}
