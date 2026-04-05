// ─────────────────────────────────────────────────────
// mobile/app/(tabs)/social.tsx
// Social Tab: Discover + Guilds sub-tabs
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useTour } from "@/context/TourContext";
import { Ionicons } from "@expo/vector-icons";
import DiscoverTab from "@/components/social/DiscoverTab";
import GuildsTab from "@/components/social/GuildsTab";

type SubTab = "discover" | "guilds";

// ═══════════════════════════════════════════════════════
// SOCIAL SCREEN
// ═══════════════════════════════════════════════════════
export default function SocialScreen() {
  const { isActive, step, advanceStep, beginTransition } = useTour();
  const [activeTab, setActiveTab] = useState<SubTab>("discover");

  useFocusEffect(
    useCallback(() => {
      if (isActive && step === 0) {
        beginTransition();
        const t = setTimeout(() => advanceStep(), 3000);
        return () => clearTimeout(t);
      }
    }, [isActive, step, advanceStep, beginTransition])
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ─── HEADER ─────────────────────────────── */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-white text-2xl font-bold">Social</Text>
          <TouchableOpacity
            onPress={() => router.push("/notifications" as any)}
            className="p-1"
          >
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ─── SUB-TAB SWITCHER ─────────────────── */}
        <View className="flex-row mt-3 bg-background-card rounded-xl p-1">
          <TouchableOpacity
            className={`flex-1 rounded-lg py-2 items-center ${
              activeTab === "discover" ? "bg-primary" : ""
            }`}
            onPress={() => setActiveTab("discover")}
          >
            <View className="flex-row items-center gap-x-1.5">
              <Ionicons
                name="compass"
                size={14}
                color={activeTab === "discover" ? "#FFFFFF" : "#6B6B80"}
              />
              <Text
                className={`text-xs font-bold ${
                  activeTab === "discover" ? "text-white" : "text-text-muted"
                }`}
              >
                Discover
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 rounded-lg py-2 items-center ${
              activeTab === "guilds" ? "bg-primary" : ""
            }`}
            onPress={() => setActiveTab("guilds")}
          >
            <View className="flex-row items-center gap-x-1.5">
              <Ionicons
                name="shield"
                size={14}
                color={activeTab === "guilds" ? "#FFFFFF" : "#6B6B80"}
              />
              <Text
                className={`text-xs font-bold ${
                  activeTab === "guilds" ? "text-white" : "text-text-muted"
                }`}
              >
                Guilds
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── CONTENT ────────────────────────────── */}
      {activeTab === "discover" ? <DiscoverTab /> : <GuildsTab />}
    </SafeAreaView>
  );
}
