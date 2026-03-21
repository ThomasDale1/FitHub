// ─────────────────────────────────────────────────────
// backend/src/lib/cloudinary.ts
// Cloudinary configuration & helper utilities
// ─────────────────────────────────────────────────────
import { v2 as cloudinary } from "cloudinary"

// Auto-configured from CLOUDINARY_URL env var
// Format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
// No need to call cloudinary.config() — the SDK reads CLOUDINARY_URL automatically

// ─── Upload presets (create these in Cloudinary Dashboard) ───
export const UPLOAD_PRESETS = {
  POST: "fithub_post",       // unsigned, folder: fithub/posts
  AVATAR: "fithub_avatar",   // unsigned, folder: fithub/avatars
  VIDEO: "fithub_video",     // unsigned, folder: fithub/videos
} as const

// ─── Transformation helpers ─────────────────────────
export const TRANSFORMS = {
  // Images
  feedImage: "w_1080,c_limit,f_auto,q_auto",
  thumbnail: "w_400,h_400,c_fill,f_auto,q_auto",
  avatarLarge: "w_200,h_200,c_fill,g_face,f_auto,q_auto",
  avatarSmall: "w_80,h_80,c_fill,g_face,f_auto,q_auto",
  // Videos
  videoThumbnail: "w_600,h_600,c_fill,f_jpg,so_0",
  videoFeed: "w_720,q_auto,f_mp4",
} as const

// ─── Validate Cloudinary URL ────────────────────────
export function isValidCloudinaryUrl(url: string): boolean {
  return url.startsWith("https://res.cloudinary.com/")
}

// ─── Delete a resource from Cloudinary ──────────────
export async function deleteCloudinaryResource(
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    })
    return result.result === "ok"
  } catch (error) {
    console.error("Cloudinary delete error:", error)
    return false
  }
}

// ─── Delete multiple resources ──────────────────────
export async function deleteCloudinaryResources(
  publicIds: string[],
  resourceType: "image" | "video" = "image"
): Promise<void> {
  if (publicIds.length === 0) return
  try {
    await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    })
  } catch (error) {
    console.error("Cloudinary bulk delete error:", error)
  }
}

export { cloudinary }
