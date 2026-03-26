// ─────────────────────────────────────────────────────
// mobile/components/TourOverlay.tsx
// Forced onboarding tour: spotlight on correct tab,
// blocks all other interactions, animated arrow + tooltip
// ─────────────────────────────────────────────────────
import { useEffect, useRef } from "react"
import { View, Text, Animated, Dimensions, StyleSheet } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTour, type TourStep } from "@/context/TourContext"

const { width: SW } = Dimensions.get("window")

const TAB_BAR_HEIGHT = 65
const NUM_TABS = 5

// Tab bar index for each tour step
// Tabs order: Home(0) Workout(1) Steps(2) Social(3) Profile(4)
const STEP_CONFIG: Record<TourStep, {
  tabIndex: number
  emoji: string
  title: string
  subtitle: string
  stepLabel: string
  color: string
}> = {
  0: {
    tabIndex: 3,
    emoji: "👥",
    title: "Visita el Feed Social",
    subtitle: "Ve qué hace tu comunidad ahora mismo",
    stepLabel: "Misión 1 de 3",
    color: "#6C63FF",
  },
  1: {
    tabIndex: 2,
    emoji: "👣",
    title: "Ve tus Pasos de hoy",
    subtitle: "Conecta y rastrea tu actividad diaria",
    stepLabel: "Misión 2 de 3",
    color: "#00D48A",
  },
  2: {
    tabIndex: 1,
    emoji: "🏋️",
    title: "Registra tu primer Workout",
    subtitle: "Inicia y completa una sesión de entrenamiento",
    stepLabel: "Misión 3 de 3",
    color: "#F59E0B",
  },
}

interface TourOverlayProps {
  step: TourStep
}

export default function TourOverlay({ step }: TourOverlayProps) {
  const insets = useSafeAreaInsets()
  const { isTransitioning } = useTour()
  const config = STEP_CONFIG[step]

  // During transition: hide all visuals but keep a full-screen blocker
  // so user can see the tab content but can't interact with anything
  if (isTransitioning) {
    return (
      <View
        style={[StyleSheet.absoluteFill]}
        pointerEvents="box-only"
      />
    )
  }
  const tabWidth = SW / NUM_TABS
  const bottomHeight = TAB_BAR_HEIGHT + insets.bottom

  // Hole boundaries for the target tab
  const holeLeft = config.tabIndex * tabWidth
  const holeRight = SW - (config.tabIndex + 1) * tabWidth
  const tabCenterX = holeLeft + tabWidth / 2

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const arrowAnim = useRef(new Animated.Value(0)).current
  const cardAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    // Reset and restart on step change
    fadeAnim.setValue(0)
    cardAnim.setValue(30)
    pulseAnim.stopAnimation()
    arrowAnim.stopAnimation()

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(cardAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start()

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.6, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    )
    pulseLoop.start()

    const arrowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 12, duration: 500, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    )
    arrowLoop.start()

    return () => {
      pulseLoop.stop()
      arrowLoop.stop()
    }
  }, [step])

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
      pointerEvents="box-none"
    >
      {/* ── TOP BLOCKER: covers all main content ─────── */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: bottomHeight,
          backgroundColor: "rgba(0,0,0,0.88)",
        }}
        pointerEvents="box-only"
      />

      {/* ── BOTTOM LEFT: covers tabs left of hole ─────── */}
      {holeLeft > 0 && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: holeLeft,
            height: bottomHeight,
            backgroundColor: "rgba(0,0,0,0.88)",
          }}
          pointerEvents="box-only"
        />
      )}

      {/* ── BOTTOM RIGHT: covers tabs right of hole ───── */}
      {holeRight > 0 && (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            right: 0,
            width: holeRight,
            height: bottomHeight,
            backgroundColor: "rgba(0,0,0,0.88)",
          }}
          pointerEvents="box-only"
        />
      )}

      {/* ── PULSING RING on the target tab ────────────── */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: insets.bottom + TAB_BAR_HEIGHT / 2 - 28,
          left: tabCenterX - 28,
          width: 56,
          height: 56,
          borderRadius: 28,
          borderWidth: 2,
          borderColor: config.color,
          transform: [{ scale: pulseAnim }],
          opacity: pulseAnim.interpolate({
            inputRange: [1, 1.6],
            outputRange: [0.9, 0],
          }),
        }}
        pointerEvents="none"
      />
      {/* Static glow ring */}
      <View
        style={{
          position: "absolute",
          bottom: insets.bottom + TAB_BAR_HEIGHT / 2 - 22,
          left: tabCenterX - 22,
          width: 44,
          height: 44,
          borderRadius: 22,
          borderWidth: 2,
          borderColor: config.color,
          opacity: 0.7,
        }}
        pointerEvents="none"
      />

      {/* ── TOOLTIP CARD ─────────────────────────────── */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: bottomHeight + 120,
          left: 20,
          right: 20,
          backgroundColor: "#12121F",
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: config.color + "50",
          padding: 24,
          alignItems: "center",
          shadowColor: config.color,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 20,
          elevation: 12,
          transform: [{ translateY: cardAnim }],
        }}
        pointerEvents="none"
      >
        {/* Step pill */}
        <View style={{
          backgroundColor: config.color + "25",
          paddingHorizontal: 14,
          paddingVertical: 5,
          borderRadius: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: config.color + "40",
        }}>
          <Text style={{ color: config.color, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
            {config.stepLabel}
          </Text>
        </View>

        <Text style={{ fontSize: 48, marginBottom: 10 }}>{config.emoji}</Text>

        <Text style={{
          color: "#FFFFFF",
          fontSize: 22,
          fontWeight: "800",
          textAlign: "center",
          marginBottom: 8,
          letterSpacing: -0.3,
        }}>
          {config.title}
        </Text>

        <Text style={{
          color: "#8888A8",
          fontSize: 14,
          textAlign: "center",
          lineHeight: 20,
        }}>
          {config.subtitle}
        </Text>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: config.color + "25", width: "100%", marginVertical: 16 }} />

        {/* CTA hint */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ fontSize: 16 }}>👇</Text>
          <Text style={{ color: config.color, fontSize: 14, fontWeight: "700" }}>
            Toca el ícono en la barra de abajo
          </Text>
        </View>
      </Animated.View>

      {/* ── BOUNCING ARROW pointing to the tab ───────── */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: bottomHeight + 52,
          left: tabCenterX - 16,
          transform: [{ translateY: arrowAnim }],
        }}
        pointerEvents="none"
      >
        <Text style={{ fontSize: 32, color: config.color }}>↓</Text>
      </Animated.View>

      {/* ── TOP STATUS BAR: "Desafío de bienvenida" ──── */}
      <View
        style={{
          position: "absolute",
          top: insets.top + 10,
          left: 20,
          right: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        }}
        pointerEvents="none"
      >
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: "#1A1A2E",
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#252540",
        }}>
          <Text style={{ fontSize: 14 }}>🎯</Text>
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>
            Desafío de bienvenida
          </Text>
          <View style={{ backgroundColor: config.color + "30", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
            <Text style={{ color: config.color, fontSize: 11, fontWeight: "800" }}>
              {step + 1}/3
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}
