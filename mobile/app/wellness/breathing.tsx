// ─────────────────────────────────────────────────────
// mobile/app/wellness/breathing.tsx
// Breathing Exercises — Animated circle + timer + techniques
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useRef, useCallback } from "react";
import { router } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  runOnJS,
} from "react-native-reanimated";
import { wellnessAPI } from "@/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CIRCLE_SIZE = SCREEN_W * 0.55;

// ─── Technique definitions ──────────────────────────
type TechniqueKey =
  | "BOX_4_4_4_4"
  | "RELAXING_4_7_8"
  | "WIM_HOF"
  | "COHERENT_5_5"
  | "ENERGIZING_4_2";

interface Technique {
  key: TechniqueKey;
  name: string;
  subtitle: string;
  icon: string;
  color: string;
  // Phases: [inhale, hold, exhale, hold] in seconds (0 = skip)
  phases: [number, number, number, number];
  phaseLabels: [string, string, string, string];
  defaultRounds: number;
  description: string;
}

const TECHNIQUES: Technique[] = [
  {
    key: "BOX_4_4_4_4",
    name: "Box Breathing",
    subtitle: "4-4-4-4 · Calma total",
    icon: "🟦",
    color: "#00C9A7",
    phases: [4, 4, 4, 4],
    phaseLabels: ["Inhala", "Sostén", "Exhala", "Sostén"],
    defaultRounds: 4,
    description: "Técnica militar para control de estrés. 4 fases iguales de 4 segundos.",
  },
  {
    key: "RELAXING_4_7_8",
    name: "4-7-8 Relajante",
    subtitle: "Inhala 4 · Sostén 7 · Exhala 8",
    icon: "🌙",
    color: "#5B4FCF",
    phases: [4, 7, 8, 0],
    phaseLabels: ["Inhala", "Sostén", "Exhala", ""],
    defaultRounds: 4,
    description: "Ideal para dormir. Activa el sistema parasimpático profundamente.",
  },
  {
    key: "WIM_HOF",
    name: "Wim Hof",
    subtitle: "30 respiraciones rápidas · Retención",
    icon: "🧊",
    color: "#00BFFF",
    phases: [2, 0, 2, 0],
    phaseLabels: ["Inhala", "", "Exhala", ""],
    defaultRounds: 30,
    description: "Respiración potente para energía, foco y tolerancia al frío.",
  },
  {
    key: "COHERENT_5_5",
    name: "Coherente",
    subtitle: "5-5 · Equilibrio cardíaco",
    icon: "💚",
    color: "#00D48A",
    phases: [5, 0, 5, 0],
    phaseLabels: ["Inhala", "", "Exhala", ""],
    defaultRounds: 6,
    description: "Sincroniza respiración con ritmo cardíaco. Reduce ansiedad.",
  },
  {
    key: "ENERGIZING_4_2",
    name: "Energizante",
    subtitle: "4-2 · Activación rápida",
    icon: "⚡",
    color: "#FFB347",
    phases: [4, 0, 2, 0],
    phaseLabels: ["Inhala", "", "Exhala", ""],
    defaultRounds: 8,
    description: "Exhalación corta para activar energía antes del entrenamiento.",
  },
];

type SessionState = "idle" | "running" | "paused" | "finished";

export default function BreathingScreen() {
  const [selected, setSelected] = useState<Technique>(TECHNIQUES[0]);
  const [state, setState] = useState<SessionState>("idle");
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(TECHNIQUES[0].defaultRounds);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [phaseCountdown, setPhaseCountdown] = useState(0);
  const [remainingCountdown, setRemainingCountdown] = useState<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [moodBefore, setMoodBefore] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animation scale
  const circleScale = useSharedValue(0.6);

  const animatedCircle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
  }));

  // Get active phases (skip 0-duration phases)
  const getActivePhases = useCallback(() => {
    return selected.phases
      .map((dur, i) => ({ duration: dur, label: selected.phaseLabels[i], index: i }))
      .filter((p) => p.duration > 0);
  }, [selected]);

  const currentPhaseLabel = () => {
    const active = getActivePhases();
    if (active.length === 0) return "";
    const phase = active[phaseIndex % active.length];
    return phase?.label || "";
  };

  // Animate circle based on phase
  const animatePhase = useCallback(
    (pIdx: number) => {
      const active = getActivePhases();
      if (active.length === 0) return;
      const phase = active[pIdx % active.length];
      const isInhale = phase.index === 0;
      const isExhale = phase.index === 2;

      if (isInhale) {
        circleScale.value = withTiming(1.0, {
          duration: phase.duration * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      } else if (isExhale) {
        circleScale.value = withTiming(0.6, {
          duration: phase.duration * 1000,
          easing: Easing.inOut(Easing.sin),
        });
      }
      // Hold phases: no animation change
    },
    [getActivePhases, circleScale]
  );

  // Start a session
  const startSession = () => {
    setState("running");
    setCurrentRound(1);
    setPhaseIndex(0);
    setElapsedSec(0);

    const active = getActivePhases();
    if (active.length === 0) return;
    setPhaseCountdown(active[0].duration);
    animatePhase(0);
    startPhaseTimer(0, 1, active);
    startElapsedTimer();
  };

  const startElapsedTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
  };

  const startPhaseTimer = (pIdx: number, round: number, activePhases: ReturnType<typeof getActivePhases>, startingCountdown?: number) => {
    if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

    let countdown = startingCountdown ?? activePhases[pIdx % activePhases.length].duration;
    setPhaseCountdown(countdown);
    setRemainingCountdown(null); // Clear saved remaining time on resume

    phaseTimerRef.current = setInterval(() => {
      countdown -= 1;
      setPhaseCountdown(countdown);

      if (countdown <= 0) {
        if (phaseTimerRef.current) clearInterval(phaseTimerRef.current);

        // Next phase
        const nextPIdx = pIdx + 1;
        if (nextPIdx >= activePhases.length) {
          // Round done
          const nextRound = round + 1;
          if (nextRound > totalRounds) {
            // Session complete
            finishSession();
            return;
          }
          setCurrentRound(nextRound);
          setPhaseIndex(0);
          animatePhase(0);
          startPhaseTimer(0, nextRound, activePhases);
        } else {
          setPhaseIndex(nextPIdx);
          animatePhase(nextPIdx);
          startPhaseTimer(nextPIdx, round, activePhases);
        }
      }
    }, 1000);
  };

  const finishSession = () => {
    setState("finished");
    cleanupTimers();
    circleScale.value = withTiming(0.6, { duration: 600 });
  };

  const pauseSession = () => {
    setState("paused");
    // Save remaining countdown before clearing timers
    setRemainingCountdown(phaseCountdown);
    cleanupTimers();
    cancelAnimation(circleScale);
  };

  const resumeSession = () => {
    setState("running");
    const active = getActivePhases();
    animatePhase(phaseIndex);
    // Use saved remaining countdown if available, otherwise start fresh
    startPhaseTimer(phaseIndex, currentRound, active, remainingCountdown ?? undefined);
    startElapsedTimer();
  };

  const stopSession = () => {
    setState("idle");
    cleanupTimers();
    setCurrentRound(0);
    setPhaseIndex(0);
    setElapsedSec(0);
    setMoodBefore(null);
    circleScale.value = withTiming(0.6, { duration: 400 });
  };

  const cleanupTimers = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (phaseTimerRef.current) { clearInterval(phaseTimerRef.current); phaseTimerRef.current = null; }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupTimers();
  }, []);

  // Save session
  const saveSession = async (moodAfter?: number) => {
    setSaving(true);
    try {
      await wellnessAPI.logBreathing({
        technique: selected.key,
        durationSec: elapsedSec,
        targetSec: totalRounds * getActivePhases().reduce((s, p) => s + p.duration, 0),
        completed: true,
        moodBefore: moodBefore ?? undefined,
        moodAfter,
      });
      // Only navigate back on success
      router.back();
    } catch (err) {
      console.error("Error saving breathing session:", err);
      Alert.alert(
        "Error",
        "No se pudo guardar la sesión de respiración. Intenta de nuevo."
      );
    } finally {
      setSaving(false);
    }
  };

  const selectTechnique = (t: Technique) => {
    setSelected(t);
    setTotalRounds(t.defaultRounds);
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // ─── FINISHED STATE ───────────────────────────────
  if (state === "finished") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-5 pt-4 pb-8 items-center">
            <TouchableOpacity
              onPress={stopSession}
              className="self-start bg-background-card border border-background-elevated rounded-2xl p-2.5 mb-6"
            >
              <Ionicons name="close" size={20} color="#A0A0B0" />
            </TouchableOpacity>

            <Text className="text-4xl mb-2">🧘</Text>
            <Text className="text-white text-2xl font-bold mb-1">
              Sesión completada
            </Text>
            <Text className="text-text-muted text-sm mb-6">
              {selected.name} · {formatTime(elapsedSec)}
            </Text>

            {/* Mood after */}
            <Text className="text-white font-bold text-base mb-3">
              ¿Cómo te sientes ahora?
            </Text>
            <View className="flex-row gap-x-3 mb-8">
              {[
                { val: 1, emoji: "😣" },
                { val: 2, emoji: "😐" },
                { val: 3, emoji: "🙂" },
                { val: 4, emoji: "😊" },
                { val: 5, emoji: "😌" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.val}
                  onPress={() => saveSession(m.val)}
                  disabled={saving}
                  className="flex-1 items-center py-3 rounded-2xl"
                  style={{
                    backgroundColor: `${selected.color}15`,
                    borderWidth: 1.5,
                    borderColor: `${selected.color}40`,
                  }}
                >
                  <Text className="text-2xl">{m.emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => saveSession()}
              disabled={saving}
              className="w-full py-3 items-center"
            >
              <Text className="text-text-muted text-sm">
                Saltar
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── IDLE STATE (Technique Selection) ─────────────
  if (state === "idle") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="px-5 pt-4 pb-8">
            {/* Header */}
            <View className="flex-row items-center gap-x-3 mb-6">
              <TouchableOpacity
                onPress={() => router.back()}
                className="bg-background-card border border-background-elevated rounded-2xl p-2.5"
              >
                <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
              </TouchableOpacity>
              <View>
                <Text className="text-white text-xl font-bold">
                  Respiración
                </Text>
                <Text className="text-text-muted text-xs">
                  Elige tu técnica y respira
                </Text>
              </View>
            </View>

            {/* Technique cards */}
            {TECHNIQUES.map((t) => (
              <TouchableOpacity
                key={t.key}
                onPress={() => selectTechnique(t)}
                className="bg-background-card border rounded-3xl p-4 mb-3 flex-row items-center gap-x-4"
                style={{
                  borderColor:
                    selected.key === t.key ? t.color : "#252540",
                  borderWidth: selected.key === t.key ? 1.5 : 1,
                }}
              >
                <Text className="text-2xl">{t.icon}</Text>
                <View className="flex-1">
                  <Text className="text-white font-bold text-sm">
                    {t.name}
                  </Text>
                  <Text className="text-text-muted text-xs mt-0.5">
                    {t.subtitle}
                  </Text>
                </View>
                {selected.key === t.key && (
                  <Ionicons name="checkmark-circle" size={22} color={t.color} />
                )}
              </TouchableOpacity>
            ))}

            {/* Description */}
            <View
              className="bg-background-card border border-background-elevated rounded-3xl p-4 mt-2 mb-4"
            >
              <Text className="text-text-secondary text-sm leading-5">
                {selected.description}
              </Text>
            </View>

            {/* Rounds selector */}
            <Text className="text-white font-bold text-base mb-3">
              Rondas: {totalRounds}
            </Text>
            <View className="flex-row gap-x-2 mb-6">
              {[2, 4, 6, 8, 10].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setTotalRounds(n)}
                  className="flex-1 items-center py-2.5 rounded-2xl"
                  style={{
                    backgroundColor:
                      totalRounds === n ? `${selected.color}25` : "#252540",
                    borderWidth: totalRounds === n ? 1.5 : 0,
                    borderColor:
                      totalRounds === n ? selected.color : "transparent",
                  }}
                >
                  <Text
                    className="font-bold text-sm"
                    style={{
                      color: totalRounds === n ? selected.color : "#6B6B80",
                    }}
                  >
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Mood before */}
            <Text className="text-white font-bold text-base mb-3">
              ¿Cómo te sientes ahora?
            </Text>
            <View className="flex-row gap-x-2 mb-8">
              {[
                { val: 1, emoji: "😣", label: "Mal" },
                { val: 2, emoji: "😐", label: "Meh" },
                { val: 3, emoji: "🙂", label: "Ok" },
                { val: 4, emoji: "😊", label: "Bien" },
                { val: 5, emoji: "😌", label: "Genial" },
              ].map((m) => (
                <TouchableOpacity
                  key={m.val}
                  onPress={() => setMoodBefore(m.val)}
                  className="flex-1 items-center py-3 rounded-2xl"
                  style={{
                    backgroundColor:
                      moodBefore === m.val ? `${selected.color}25` : "#252540",
                    borderWidth: moodBefore === m.val ? 1.5 : 0,
                    borderColor:
                      moodBefore === m.val ? selected.color : "transparent",
                  }}
                >
                  <Text className="text-xl mb-1">{m.emoji}</Text>
                  <Text
                    className="text-[10px] font-semibold"
                    style={{
                      color:
                        moodBefore === m.val ? selected.color : "#6B6B80",
                    }}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Start button */}
            <TouchableOpacity
              className="rounded-3xl py-4 items-center"
              style={{ backgroundColor: selected.color }}
              onPress={startSession}
            >
              <Text className="text-white font-bold text-base">
                Comenzar sesión
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── RUNNING / PAUSED STATE ───────────────────────
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-5 pt-4 pb-8 items-center justify-between">
        {/* Top info */}
        <View className="w-full flex-row justify-between items-center">
          <TouchableOpacity onPress={stopSession}>
            <Ionicons name="close" size={24} color="#A0A0B0" />
          </TouchableOpacity>
          <Text className="text-text-muted text-sm">
            Ronda {currentRound}/{totalRounds}
          </Text>
          <Text className="text-text-muted text-sm">
            {formatTime(elapsedSec)}
          </Text>
        </View>

        {/* Animated breathing circle */}
        <View className="items-center justify-center" style={{ height: CIRCLE_SIZE + 40 }}>
          <Animated.View
            style={[
              {
                width: CIRCLE_SIZE,
                height: CIRCLE_SIZE,
                borderRadius: CIRCLE_SIZE / 2,
                backgroundColor: `${selected.color}15`,
                borderWidth: 3,
                borderColor: `${selected.color}60`,
                alignItems: "center",
                justifyContent: "center",
              },
              animatedCircle,
            ]}
          >
            <Text className="text-white text-5xl font-bold">
              {phaseCountdown}
            </Text>
            <Text
              className="font-bold text-lg mt-1"
              style={{ color: selected.color }}
            >
              {currentPhaseLabel()}
            </Text>
          </Animated.View>
        </View>

        {/* Controls */}
        <View className="w-full items-center gap-y-4">
          <View className="flex-row gap-x-4">
            <TouchableOpacity
              className="bg-background-card border border-background-elevated rounded-full w-16 h-16 items-center justify-center"
              onPress={stopSession}
            >
              <Ionicons name="stop" size={24} color="#FF6B6B" />
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded-full w-16 h-16 items-center justify-center"
              style={{ backgroundColor: selected.color }}
              onPress={state === "paused" ? resumeSession : pauseSession}
            >
              <Ionicons
                name={state === "paused" ? "play" : "pause"}
                size={28}
                color="white"
              />
            </TouchableOpacity>
          </View>
          <Text className="text-text-muted text-xs">
            {selected.name}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
