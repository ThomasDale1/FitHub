// ─────────────────────────────────────────────────────
// mobile/lib/mediaPicker.ts
// Avatar picker + compression
// ─────────────────────────────────────────────────────
import * as ImagePicker from "expo-image-picker"
import * as ImageManipulator from "expo-image-manipulator"
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

  const image = await ImageManipulator.manipulate(result.assets[0].uri)
    .resize({ width: 500, height: 500 })
    .renderAsync()
  const saved = await image.saveAsync({ compress: 0.85, format: ImageManipulator.SaveFormat.JPEG })

  return { uri: saved.uri }
}
