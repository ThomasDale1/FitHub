// ─────────────────────────────────────────────────────
// ReadinessRing — Hero visual del Wellness Dashboard
// Ring animado 0-100 con semáforo (RED/YELLOW/GREEN)
// ─────────────────────────────────────────────────────
import { View, Text, Dimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SCREEN_WIDTH = Dimensions.get("window").width;
const RING_SIZE = SCREEN_WIDTH * 0.52;
const STROKE_WIDTH = 12;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;

const ZONE_CONFIG = {
  GREEN: {
    color: "#00D48A",
    bgColor: "#00D48A15",
    label: "Listo para entrenar",
    icon: "⚡",
  },
  YELLOW: {
    color: "#F5C842",
    bgColor: "#F5C84215",
    label: "Energía moderada",
    icon: "☀️",
  },
  RED: {
    color: "#FF6B6B",
    bgColor: "#FF6B6B15",
    label: "Tu cuerpo pide descanso",
    icon: "🛌",
  },
};

interface Props {
  score: number;
  zone: "RED" | "YELLOW" | "GREEN";
  recommendation?: string;
}

export default function ReadinessRing({ score, zone, recommendation }: Props) {
  const config = ZONE_CONFIG[zone];
  const progress = useSharedValue(0);
  
  // Clamp score to 0-100 range
  const safeScore = Math.min(100, Math.max(0, score));

  useEffect(() => {
    progress.value = withTiming(safeScore / 100, {
      duration: 1200,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeScore]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <View className="items-center py-4">
      {/* Ring */}
      <View style={{ width: RING_SIZE, height: RING_SIZE }} className="items-center justify-center">
        <Svg width={RING_SIZE} height={RING_SIZE} style={{ position: "absolute" }}>
          {/* Background track */}
          <Circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            stroke="#1A1A2E"
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* Animated progress */}
          <AnimatedCircle
            cx={CX}
            cy={CY}
            r={RADIUS}
            stroke={config.color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX}, ${CY}`}
          />
        </Svg>

        {/* Center content */}
        <View className="items-center">
          <Text style={{ fontSize: 42, fontWeight: "800", color: config.color }}>
            {safeScore}
          </Text>
          <Text className="text-text-secondary text-xs mt-1">Readiness</Text>
        </View>
      </View>

      {/* Zone label */}
      <View
        className="flex-row items-center mt-3 px-4 py-2 rounded-full"
        style={{ backgroundColor: config.bgColor }}
      >
        <Text className="text-lg mr-2">{config.icon}</Text>
        <Text style={{ color: config.color, fontWeight: "700", fontSize: 14 }}>
          {config.label}
        </Text>
      </View>

      {/* Recommendation */}
      {recommendation && (
        <Text className="text-text-muted text-xs text-center mt-2 px-8">
          {recommendation}
        </Text>
      )}
    </View>
  );
}
