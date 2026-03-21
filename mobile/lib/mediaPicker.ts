// ─────────────────────────────────────────────────────
// mobile/lib/mediaPicker.ts
// Image/video picker + compression utilities
// ─────────────────────────────────────────────────────
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator"
import { Alert } from "react-native"
import { MEDIA_LIMITS, type MediaAttachment } from "./cloudinary"

// ─── Request permissions ────────────────────────────
async function ensureMediaPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== "granted") {
    Alert.alert(
      "Permisos necesarios",
      "Necesitamos acceso a tu galería para subir fotos y videos.",
    )
    return false
  }
  return true
}

async function ensureCameraPermissions(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync()
  if (status !== "granted") {
    Alert.alert(
      "Permisos necesarios",
      "Necesitamos acceso a tu cámara para tomar fotos.",
    )
    return false
  }
  return true
}

// ─── Compress image ─────────────────────────────────
async function compressImage(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }], // max 1920px wide, height scales proportionally
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  return result.uri
}

// ─── Pick images from gallery ───────────────────────
export async function pickImages(
  maxCount: number = MEDIA_LIMITS.image.maxCount,
): Promise<MediaAttachment[]> {
  const hasPermission = await ensureMediaPermissions()
  if (!hasPermission) return []

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: maxCount > 1,
    selectionLimit: maxCount,
    quality: 0.9,
  })

  if (result.canceled || !result.assets?.length) return []

  // Compress all selected images
  const attachments: MediaAttachment[] = []
  for (const asset of result.assets) {
    const compressedUri = await compressImage(asset.uri)
    attachments.push({
      uri: compressedUri,
      type: "image",
      width: asset.width,
      height: asset.height,
      fileName: asset.fileName || undefined,
    })
  }

  return attachments
}

// ─── Pick video from gallery ────────────────────────
export async function pickVideo(): Promise<MediaAttachment | null> {
  const hasPermission = await ensureMediaPermissions()
  if (!hasPermission) return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["videos"],
    allowsMultipleSelection: false,
    videoMaxDuration: MEDIA_LIMITS.video.maxDuration,
    quality: 0.7,
  })

  if (result.canceled || !result.assets?.length) return null

  const asset = result.assets[0]

  // Check duration
  if (asset.duration && asset.duration / 1000 > MEDIA_LIMITS.video.maxDuration) {
    Alert.alert("Video muy largo", `El video debe durar menos de ${MEDIA_LIMITS.video.maxDuration} segundos.`)
    return null
  }

  return {
    uri: asset.uri,
    type: "video",
    width: asset.width,
    height: asset.height,
    duration: asset.duration ? asset.duration / 1000 : undefined, // ms → sec
    fileName: asset.fileName || undefined,
  }
}

// ─── Take photo with camera ─────────────────────────
export async function takePhoto(): Promise<MediaAttachment | null> {
  const hasPermission = await ensureCameraPermissions()
  if (!hasPermission) return null

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.9,
  })

  if (result.canceled || !result.assets?.length) return null

  const asset = result.assets[0]
  const compressedUri = await compressImage(asset.uri)

  return {
    uri: compressedUri,
    type: "image",
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName || undefined,
  }
}

// ─── Pick avatar (square crop) ──────────────────────
export async function pickAvatar(): Promise<MediaAttachment | null> {
  const hasPermission = await ensureMediaPermissions()
  if (!hasPermission) return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  })

  if (result.canceled || !result.assets?.length) return null

  const asset = result.assets[0]

  // Compress to avatar-friendly size
  const compressed = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: 500, height: 500 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  )

  return {
    uri: compressed.uri,
    type: "image",
    width: 500,
    height: 500,
    fileName: `avatar_${Date.now()}.jpg`,
  }
}
