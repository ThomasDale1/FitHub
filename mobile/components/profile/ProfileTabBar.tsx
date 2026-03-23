// ─────────────────────────────────────────────────────
// mobile/components/profile/ProfileTabBar.tsx
// Horizontal tab bar for profile sections
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ScrollView } from "react-native"
import { Ionicons } from "@expo/vector-icons"

export type ProfileTab = "posts" | "stats" | "history" | "badges"

const TABS: { key: ProfileTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "posts", label: "Posts", icon: "grid-outline" },
  { key: "stats", label: "Stats", icon: "stats-chart-outline" },
  { key: "history", label: "Historial", icon: "time-outline" },
  { key: "badges", label: "Badges", icon: "trophy-outline" },
]

interface ProfileTabBarProps {
  activeTab: ProfileTab
  onTabChange: (tab: ProfileTab) => void
}

export default function ProfileTabBar({ activeTab, onTabChange }: ProfileTabBarProps) {
  return (
    <View className="flex-row bg-background-card border border-background-elevated rounded-2xl p-1 mb-4">
      {TABS.map(tab => {
        const isActive = activeTab === tab.key
        return (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 flex-row items-center justify-center py-3 rounded-xl gap-x-1 ${isActive ? "bg-primary/20" : ""}`}
            onPress={() => onTabChange(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={isActive ? "#6C63FF" : "#6B6B80"}
            />
            <Text
              className={`text-xs font-semibold ${isActive ? "text-primary" : "text-text-muted"}`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}
