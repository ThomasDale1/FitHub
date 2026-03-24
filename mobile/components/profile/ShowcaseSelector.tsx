// ─────────────────────────────────────────────────────
// mobile/components/profile/ShowcaseSelector.tsx
// Modal to select up to 4 showcase badges
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect } from "react"
import { profileAPI, badgesAPI, type BadgesResponse } from "@/lib/api"

const RARITY_COLORS: Record<string, { border: string; text: string }> = {
  COMMON: { border: "#6B7280", text: "#9CA3AF" },
  RARE: { border: "#3B82F6", text: "#60A5FA" },
  EPIC: { border: "#A855F7", text: "#C084FC" },
  LEGENDARY: { border: "#F59E0B", text: "#FBBF24" },
}

interface ShowcaseSelectorProps {
  visible: boolean
  currentBadgeIds: string[]
  onClose: () => void
  onSave: (badgeIds: string[]) => void
}

export default function ShowcaseSelector({ visible, currentBadgeIds, onClose, onSave }: ShowcaseSelectorProps) {
  const [badgesData, setBadgesData] = useState<BadgesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<string[]>(currentBadgeIds)

  useEffect(() => {
    if (visible) {
      setSelected(currentBadgeIds)
      setLoading(true)
      badgesAPI.getAll()
        .then(res => setBadgesData(res.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [visible, currentBadgeIds])

  const toggleBadge = (badgeId: string) => {
    setSelected(prev => {
      if (prev.includes(badgeId)) {
        return prev.filter(id => id !== badgeId)
      }
      if (prev.length >= 4) {
        Alert.alert("Máximo 4", "Solo puedes mostrar 4 badges en tu showcase. Quita uno primero.")
        return prev
      }
      return [...prev, badgeId]
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await profileAPI.updateShowcase(selected)
      onSave(selected)
      onClose()
    } catch {
      Alert.alert("Error", "No se pudo guardar el showcase")
    } finally {
      setSaving(false)
    }
  }

  const earnedBadges = (badgesData?.badges || []).filter(b => b.earned)

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-background rounded-t-3xl max-h-[80%]">
          {/* Header */}
          <View className="flex-row justify-between items-center p-5 border-b border-background-elevated">
            <View>
              <Text className="text-white font-bold text-lg">Showcase Badges</Text>
              <Text className="text-text-muted text-xs mt-0.5">
                Selecciona hasta 4 badges para mostrar en tu perfil
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#A0A0B0" />
            </TouchableOpacity>
          </View>

          {/* Selected preview */}
          <View className="px-5 py-3 border-b border-background-elevated">
            <Text className="text-text-secondary text-xs mb-2">
              Seleccionados ({selected.length}/4)
            </Text>
            <View className="flex-row gap-x-3 min-h-[60px] items-center">
              {selected.length === 0 ? (
                <Text className="text-text-muted text-xs">Toca un badge para agregarlo</Text>
              ) : (
                selected.map(id => {
                  const badge = earnedBadges.find(b => b.id === id)
                  if (!badge) return null
                  const r = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON
                  return (
                    <TouchableOpacity
                      key={id}
                      onPress={() => toggleBadge(id)}
                      className="items-center px-2 py-1.5 rounded-xl"
                      style={{ backgroundColor: r.border + "20", borderWidth: 1, borderColor: r.border + "50" }}
                    >
                      <Text style={{ fontSize: 22 }}>{badge.icon}</Text>
                      <Text className="text-xs font-semibold mt-0.5" style={{ color: r.text }}>{badge.name}</Text>
                      <View className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 items-center justify-center">
                        <Ionicons name="close" size={10} color="white" />
                      </View>
                    </TouchableOpacity>
                  )
                })
              )}
            </View>
          </View>

          {/* Badge list */}
          <ScrollView className="px-5 py-3" style={{ maxHeight: 400 }}>
            {loading ? (
              <ActivityIndicator color="#6C63FF" size="large" className="py-12" />
            ) : earnedBadges.length === 0 ? (
              <View className="items-center py-12">
                <Ionicons name="trophy-outline" size={48} color="#4A4A5A" />
                <Text className="text-text-muted text-sm mt-3">
                  Aún no has desbloqueado badges
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-3">
                {earnedBadges.map(badge => {
                  const isSelected = selected.includes(badge.id)
                  const r = RARITY_COLORS[badge.rarity] || RARITY_COLORS.COMMON
                  return (
                    <TouchableOpacity
                      key={badge.id}
                      onPress={() => toggleBadge(badge.id)}
                      className="items-center p-3 rounded-2xl"
                      style={{
                        width: 80,
                        backgroundColor: isSelected ? r.border + "25" : r.border + "10",
                        borderWidth: 2,
                        borderColor: isSelected ? r.border : "transparent",
                      }}
                    >
                      <Text className="text-2xl">{badge.icon}</Text>
                      <Text
                        className="text-xs mt-1 text-center font-semibold"
                        style={{ color: r.text }}
                        numberOfLines={2}
                      >
                        {badge.name}
                      </Text>
                      {isSelected && (
                        <View className="absolute top-1 right-1 bg-primary rounded-full w-4 h-4 items-center justify-center">
                          <Ionicons name="checkmark" size={10} color="white" />
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}
          </ScrollView>

          {/* Save button */}
          <View className="p-5 border-t border-background-elevated">
            <TouchableOpacity
              className="bg-primary rounded-2xl py-4 items-center"
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-white font-bold text-base">Guardar Showcase</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
