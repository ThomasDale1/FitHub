// ─────────────────────────────────────────────────────
// mobile/lib/cloudinary.ts
// Cloudinary direct upload from mobile + URL transforms
// ─────────────────────────────────────────────────────

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}`

// ─── Types ──────────────────────────────────────────
export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  resource_type: "image" | "video"
  width: number
  height: number
  bytes: number
  format: string
  duration?: number // only for video
  eager?: Array<{
    secure_url: string
    width: number
    height: number
  }>
}

export interface UploadProgress {
  loaded: number
  total: number
  percent: number
}

export interface MediaAttachment {
  uri: string
  type: "image" | "video"
  width?: number
  height?: number
  duration?: number // seconds, for video
  fileName?: string
}

// ─── Upload a single file to Cloudinary ─────────────
export function uploadToCloudinary(
  file: MediaAttachment,
  options?: {
    folder?: string
    onProgress?: (progress: UploadProgress) => void
  }
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const resourceType = file.type === "video" ? "video" : "image"
    const url = `${UPLOAD_URL}/${resourceType}/upload`

    const formData = new FormData()
    const ext = file.uri.split(".").pop() || (file.type === "video" ? "mp4" : "jpg")

    formData.append("file", {
      uri: file.uri,
      type: file.type === "video" ? `video/${ext}` : `image/${ext}`,
      name: file.fileName || `upload_${Date.now()}.${ext}`,
    } as any)
    formData.append("upload_preset", UPLOAD_PRESET)
    if (options?.folder) {
      formData.append("folder", options.folder)
    }

    const xhr = new XMLHttpRequest()
    xhr.open("POST", url)

    // Track upload progress
    if (options?.onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          options.onProgress!({
            loaded: event.loaded,
            total: event.total,
            percent: Math.round((event.loaded / event.total) * 100),
          })
        }
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText)
          resolve(response as CloudinaryUploadResult)
        } catch {
          reject(new Error("Failed to parse Cloudinary response"))
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`))
      }
    }

    xhr.onerror = () => reject(new Error("Network error during upload"))
    xhr.ontimeout = () => reject(new Error("Upload timed out"))
    xhr.timeout = 120000 // 2 min for large videos

    xhr.send(formData)
  })
}

// ─── Upload multiple files ──────────────────────────
export async function uploadMultiple(
  files: MediaAttachment[],
  options?: {
    folder?: string
    onFileProgress?: (fileIndex: number, progress: UploadProgress) => void
    onFileComplete?: (fileIndex: number, result: CloudinaryUploadResult) => void
  }
): Promise<CloudinaryUploadResult[]> {
  const results: CloudinaryUploadResult[] = []

  for (let i = 0; i < files.length; i++) {
    const result = await uploadToCloudinary(files[i], {
      folder: options?.folder,
      onProgress: (progress) => options?.onFileProgress?.(i, progress),
    })
    results.push(result)
    options?.onFileComplete?.(i, result)
  }

  return results
}

// ─── URL Transformation helpers ─────────────────────
// Insert transforms into a Cloudinary URL:
// https://res.cloudinary.com/CLOUD/image/upload/v123/file.jpg
// → https://res.cloudinary.com/CLOUD/image/upload/w_400,f_auto/v123/file.jpg

export function transformUrl(url: string, transforms: string): string {
  return url.replace("/upload/", `/upload/${transforms}/`)
}

export const transforms = {
  // Images
  feedImage: (url: string) => transformUrl(url, "w_1080,c_limit,f_auto,q_auto"),
  thumbnail: (url: string) => transformUrl(url, "w_400,h_400,c_fill,f_auto,q_auto"),
  fullscreen: (url: string) => transformUrl(url, "f_auto,q_auto"),

  // Avatars
  avatarLarge: (url: string) => transformUrl(url, "w_200,h_200,c_fill,g_face,f_auto,q_auto"),
  avatarSmall: (url: string) => transformUrl(url, "w_80,h_80,c_fill,g_face,f_auto,q_auto"),

  // Videos
  videoThumbnail: (url: string) => {
    // Convert video URL to jpg thumbnail at first frame
    const jpgUrl = url
      .replace("/video/upload/", "/video/upload/w_600,h_600,c_fill,so_0/")
      .replace(/\.\w+$/, ".jpg")
    return jpgUrl
  },
  videoFeed: (url: string) => transformUrl(url, "w_720,q_auto"),
} as const

// ─── Limits ─────────────────────────────────────────
export const MEDIA_LIMITS = {
  image: {
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
    maxCount: 4,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"] as string[],
  },
  video: {
    maxSizeBytes: 100 * 1024 * 1024, // 100MB
    maxDuration: 60, // seconds
    maxCount: 1,
    allowedTypes: ["video/mp4", "video/quicktime", "video/mov"] as string[],
  },
} as const
