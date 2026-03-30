// ─────────────────────────────────────────────────────
// AiInsightCard — AI nutrition insight (cached per session)
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef } from "react";
import { aiAPI } from "@/lib/api";

interface Props {
  hasEntries: boolean; // only show if user has logged food today
}

export default function AiInsightCard({ hasEntries }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!hasEntries || fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);

    aiAPI
      .quick("nutrition_tip")
      .then((res) => setInsight(res.data.message))
      .catch(() => setInsight(null))
      .finally(() => setLoading(false));
  }, [hasEntries]);

  if (!hasEntries) return null;
  if (!insight && !loading) return null;

  return (
    <View className="bg-background-card border border-primary/20 rounded-3xl p-4 mb-3">
      <TouchableOpacity
        className="flex-row items-center justify-between"
        onPress={() => setCollapsed(!collapsed)}
      >
        <View className="flex-row items-center gap-x-2">
          <Text className="text-lg">🤖</Text>
          <Text className="text-white font-bold text-sm">Tu nutrición hoy</Text>
        </View>
        <Ionicons
          name={collapsed ? "chevron-down" : "chevron-up"}
          size={18}
          color="#A0A0B0"
        />
      </TouchableOpacity>

      {!collapsed && (
        <View className="mt-3">
          {loading ? (
            <ActivityIndicator color="#6C63FF" size="small" />
          ) : (
            <Text className="text-text-secondary text-sm leading-5">
              {insight}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
