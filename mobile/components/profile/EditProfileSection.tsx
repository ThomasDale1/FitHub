// ─────────────────────────────────────────────────────
// mobile/components/profile/EditProfileSection.tsx
// Inline edit section for own profile
// ─────────────────────────────────────────────────────
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native"
import { useState } from "react"
import { userAPI, profileAPI } from "@/lib/api"

interface EditProfileSectionProps {
  profile: {
    name: string
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
  const [bio, setBio] = useState(profile.bio || "")
  const [weight, setWeight] = useState(profile.weight?.toString() || "")
  const [height, setHeight] = useState(profile.height?.toString() || "")
  const [bodyFat, setBodyFat] = useState(profile.bodyFat?.toString() || "")
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updateData: any = {
        name,
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
    } catch {
      Alert.alert("Error", "No se pudo guardar el perfil")
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
          disabled={saving}
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
