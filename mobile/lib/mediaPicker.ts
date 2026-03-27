// ─────────────────────────────────────────────────────
// mobile/lib/mediaPicker.ts
// Avatar picker + compression
// ─────────────────────────────────────────────────────
import * as ImagePicker from "expo-image-picker"
import { ImageManipulator, SaveFormat } from "expo-image-manipulator"
import { Alert } from "react-native"

// ─── Pick avatar (square crop) ──────────────────────
export async function pickAvatar(): Promise<{ uri: string } | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (status !== "granted") {
    Alert.alert("Permisos necesarios", "Necesitamos acceso a tu galería para cambiar la foto.")
    return null
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  })

  if (result.canceled || !result.assets?.length) return null

  const ctx = ImageManipulator.manipulate(result.assets[0].uri)
  ctx.resize({ width: 500, height: 500 })
  const imageRef = await ctx.renderAsync()
  const saved = await imageRef.saveAsync({ compress: 0.85, format: SaveFormat.JPEG })

  return { uri: saved.uri }
}
