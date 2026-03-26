// ─────────────────────────────────────────────────────
// mobile/components/profile/EditProfileSection.tsx
// Inline edit section for own profile
// ─────────────────────────────────────────────────────
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { useState, useCallback, useRef } from "react"
import { userAPI, profileAPI } from "@/lib/api"

interface EditProfileSectionProps {
  profile: {
    name: string
    username: string
    bio: string | null
    weight: number | null
    height: number | null
    bodyFat: number | null
  }
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}

export default function EditProfileSection({ profile, onSave, onCancel }: EditProfileSectionProps) {
  const [name, setName] = useState(profile.name || "")
  const [username, setUsername] = useState(profile.username || "")
  const [bio, setBio] = useState(profile.bio || "")
  const [weight, setWeight] = useState(profile.weight?.toString() || "")
  const [height, setHeight] = useState(profile.height?.toString() || "")
  const [bodyFat, setBodyFat] = useState(profile.bodyFat?.toString() || "")
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState("")
  const [usernameChecking, setUsernameChecking] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const validateUsername = useCallback((value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9._]/g, "")
    setUsername(clean)
    setUsernameError("")

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (clean === profile.username) return // unchanged
    if (clean.length === 0) return
    if (clean.length < 3) {
      setUsernameError("Mínimo 3 caracteres")
      return
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setUsernameChecking(true)
        const res = await userAPI.checkUsername(clean)
        if (!res.data.available) {
          setUsernameError(res.data.reason || "Username no disponible")
        }
      } catch {
        // ignore
      } finally {
        setUsernameChecking(false)
      }
    }, 500)
  }, [profile.username])

  const handleSave = async () => {
    if (usernameError) {
      Alert.alert("Error", usernameError)
      return
    }
    if (username.length < 3) {
      Alert.alert("Error", "El username debe tener al menos 3 caracteres")
      return
    }

    setSaving(true)
    try {
      const updateData: any = {
        name,
        username,
        bio: bio || null,
        weight: weight ? parseFloat(weight) : null,
        height: height ? parseFloat(height) : null,
        bodyFat: bodyFat ? parseFloat(bodyFat) : null,
      }
      await userAPI.updateProfile(updateData)

      // Also log weight if changed
      if (weight && parseFloat(weight) !== profile.weight) {
        await profileAPI.logWeight({
          weight: parseFloat(weight),
          bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
        }).catch(() => {})
      }

      await onSave(updateData)
    } catch (err: any) {
      const msg = err?.response?.data?.error || "No se pudo guardar el perfil"
      Alert.alert("Error", msg)
    }
    setSaving(false)
  }

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-5 mb-4">
      <Text className="text-white font-bold text-lg mb-4">Editar perfil</Text>

      <Text className="text-text-secondary text-sm mb-1">Nombre</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={name}
        onChangeText={setName}
        placeholderTextColor="#6B6B80"
        placeholder="Tu nombre"
      />

      <Text className="text-text-secondary text-sm mb-1">Username</Text>
      <TextInput
        className={`bg-background-elevated text-white rounded-2xl px-4 py-3 text-base ${usernameError ? "border border-red-500" : ""}`}
        value={username}
        onChangeText={validateUsername}
        placeholderTextColor="#6B6B80"
        placeholder="tu_username"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {usernameError ? (
        <Text className="text-red-500 text-xs mt-1 mb-3 ml-1">{usernameError}</Text>
      ) : usernameChecking ? (
        <Text className="text-text-muted text-xs mt-1 mb-3 ml-1">Verificando...</Text>
      ) : username !== profile.username && username.length >= 3 ? (
        <Text className="text-green-500 text-xs mt-1 mb-3 ml-1">Disponible</Text>
      ) : (
        <View className="mb-3" />
      )}

      <Text className="text-text-secondary text-sm mb-1">Bio</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={bio}
        onChangeText={setBio}
        placeholderTextColor="#6B6B80"
        placeholder="Cuéntanos sobre ti..."
        multiline
        numberOfLines={3}
        style={{ textAlignVertical: "top", minHeight: 80 }}
      />

      <Text className="text-white font-bold text-base mt-2 mb-3">Métricas corporales</Text>

      <View className="flex-row gap-x-3">
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">Peso (kg)</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholderTextColor="#6B6B80"
            placeholder="75.0"
          />
        </View>
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">Altura (cm)</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholderTextColor="#6B6B80"
            placeholder="175"
          />
        </View>
      </View>

      <View className="mt-3">
        <Text className="text-text-secondary text-sm mb-1">Grasa corporal (%)</Text>
        <TextInput
          className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
          value={bodyFat}
          onChangeText={setBodyFat}
          keyboardType="decimal-pad"
          placeholderTextColor="#6B6B80"
          placeholder="15.0"
        />
      </View>

      <View className="flex-row gap-x-3 mt-5">
        <TouchableOpacity
          className="flex-1 bg-background-elevated rounded-2xl py-3 items-center"
          onPress={onCancel}
        >
          <Text className="text-text-secondary font-bold">Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-primary rounded-2xl py-3 items-center"
          onPress={handleSave}
          disabled={saving || !!usernameError}
        >
          {saving ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white font-bold">Guardar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}
