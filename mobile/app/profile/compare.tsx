// ─────────────────────────────────────────────────────
// mobile/app/profile/compare.tsx
// Side-by-side comparison screen
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import { useProfileCompare } from "@/hooks/useProfile"
import CompareCard from "@/components/profile/CompareCard"

export default function CompareScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { data, loading, error } = useProfileCompare(userId)

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-8">
          {/* Header */}
          <TouchableOpacity
            className="flex-row items-center gap-x-2 mb-6"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
            <Text className="text-white text-lg font-bold">Comparación</Text>
          </TouchableOpacity>

          {loading && (
            <View className="items-center py-12">
              <ActivityIndicator color="#6C63FF" size="large" />
              <Text className="text-text-secondary mt-3">Analizando estadísticas...</Text>
            </View>
          )}

          {error && (
            <View className="items-center py-12">
              <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
              <Text className="text-red-400 text-sm mt-3">{error}</Text>
              <TouchableOpacity
                className="mt-4 bg-primary/20 rounded-2xl px-5 py-2"
                onPress={() => router.back()}
              >
                <Text className="text-primary font-bold">Volver</Text>
              </TouchableOpacity>
            </View>
          )}

          {data && <CompareCard data={data} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
