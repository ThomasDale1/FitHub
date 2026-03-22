// ─────────────────────────────────────────────────────
// components/BadgeUnlockModal.tsx
// Full-screen animated overlay when a badge is unlocked
// Rarity-themed: color, glow intensity, label
// ─────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { badgesAPI } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const RARITY_CONFIG = {
  COMMON: { color: "#9CA3AF", bg: "#9CA3AF20", label: "LOGRO DESBLOQUEADO", gradient: ["#6B7280", "#9CA3AF"] },
  RARE: { color: "#3B82F6", bg: "#3B82F620", label: "LOGRO RARO DESBLOQUEADO", gradient: ["#2563EB", "#60A5FA"] },
  EPIC: { color: "#A855F7", bg: "#A855F720", label: "LOGRO EPICO DESBLOQUEADO", gradient: ["#7C3AED", "#C084FC"] },
  LEGENDARY: { color: "#F59E0B", bg: "#F59E0B20", label: "LOGRO LEGENDARIO DESBLOQUEADO", gradient: ["#D97706", "#FBBF24"] },
};

interface UnlockBadge {
  slug: string;
  name: string;
  description: string;
  icon: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  xpReward: number;
  isSecret: boolean;
}

interface Props {
  badges: UnlockBadge[];
  visible: boolean;
  onDismiss: () => void;
}

export default function BadgeUnlockModal({ badges, visible, onDismiss }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const xpAnim = useRef(new Animated.Value(0)).current;
  const bannerAnim = useRef(new Animated.Value(-100)).current;

  const badge = badges[currentIndex];
  const rarity = badge ? RARITY_CONFIG[badge.rarity] || RARITY_CONFIG.COMMON : RARITY_CONFIG.COMMON;

  useEffect(() => {
    if (visible && badge) {
      // Reset
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
      xpAnim.setValue(0);
      bannerAnim.setValue(-100);

      // Animate in sequence
      Animated.sequence([
        // Fade in background
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Badge scale bounce
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 60,
          useNativeDriver: true,
        }),
        // Banner slide in
        Animated.spring(bannerAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
        // XP float up
        Animated.timing(xpAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Mark as seen
      badgesAPI.markSeen(badge.slug).catch(() => {});
    }
  }, [visible, currentIndex]);

  const handleNext = () => {
    if (currentIndex < badges.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
      onDismiss();
    }
  };

  if (!badge) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleNext}>
      <Animated.View
        className="flex-1 justify-center items-center"
        style={{
          backgroundColor: "rgba(0,0,0,0.9)",
          opacity: opacityAnim,
        }}
      >
        {/* Rarity banner */}
        <Animated.View
          className="absolute top-20 px-6 py-2 rounded-full"
          style={{
            backgroundColor: rarity.bg,
            borderWidth: 1,
            borderColor: rarity.color,
            transform: [{ translateY: bannerAnim }],
          }}
        >
          <Text style={{ color: rarity.color, fontWeight: "800", fontSize: 12, letterSpacing: 2 }}>
            {rarity.label}
          </Text>
        </Animated.View>

        {/* Badge icon with glow */}
        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            alignItems: "center",
          }}
        >
          {/* Glow ring */}
          <View
            className="rounded-full items-center justify-center mb-6"
            style={{
              width: 140,
              height: 140,
              backgroundColor: rarity.bg,
              borderWidth: 3,
              borderColor: rarity.color,
              shadowColor: rarity.color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 20,
              elevation: 20,
            }}
          >
            <Text style={{ fontSize: 64 }}>{badge.icon}</Text>
          </View>

          {/* Badge name */}
          <Text className="text-white text-2xl font-bold text-center mb-2">
            {badge.name}
          </Text>

          {/* Description */}
          <Text className="text-text-secondary text-center text-sm mb-4 px-8">
            {badge.description}
          </Text>

          {/* Secret badge indicator */}
          {badge.isSecret && (
            <View className="flex-row items-center gap-x-1 mb-3">
              <Ionicons name="eye-off" size={14} color="#A855F7" />
              <Text style={{ color: "#A855F7", fontSize: 12, fontWeight: "600" }}>
                Logro secreto
              </Text>
            </View>
          )}

          {/* XP reward */}
          <Animated.View
            style={{
              opacity: xpAnim,
              transform: [
                {
                  translateY: xpAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            }}
          >
            <View
              className="flex-row items-center gap-x-2 rounded-full px-5 py-2"
              style={{ backgroundColor: "#F59E0B20", borderWidth: 1, borderColor: "#F59E0B40" }}
            >
              <Ionicons name="star" size={18} color="#F59E0B" />
              <Text style={{ color: "#FBBF24", fontWeight: "800", fontSize: 18 }}>
                +{badge.xpReward} XP
              </Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Actions */}
        <View className="absolute bottom-16 w-full px-8">
          {badges.length > 1 && (
            <Text className="text-text-muted text-center text-xs mb-3">
              {currentIndex + 1} de {badges.length}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleNext}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: rarity.color }}
          >
            <Text className="text-white font-bold text-base">
              {currentIndex < badges.length - 1 ? "Siguiente" : "Continuar"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}
