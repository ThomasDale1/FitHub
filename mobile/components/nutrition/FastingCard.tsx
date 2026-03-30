// ─────────────────────────────────────────────────────
// FastingCard — Ayuno intermitente timer (client-side)
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DonutRing from "./DonutRing";

const FASTING_KEY = "fithub_fasting_config";

interface FastingConfig {
  enabled: boolean;
  protocol: "16:8" | "18:6" | "20:4";
  startHour: number; // 0-23 (hora en que inicia el ayuno)
}

const PROTOCOLS: Record<string, { fast: number; eat: number }> = {
  "16:8": { fast: 16, eat: 8 },
  "18:6": { fast: 18, eat: 6 },
  "20:4": { fast: 20, eat: 4 },
};

function getDefaultConfig(): FastingConfig {
  return { enabled: false, protocol: "16:8", startHour: 20 };
}

export default function FastingCard() {
  const [config, setConfig] = useState<FastingConfig>(getDefaultConfig());
  const [now, setNow] = useState(new Date());

  // Load config from AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(FASTING_KEY)
      .then((val) => {
        if (!val) return;
        try {
          setConfig(JSON.parse(val));
        } catch (error) {
          console.warn("[FastingCard] invalid fasting config:", error);
        }
      })
      .catch((error) => {
        console.warn("[FastingCard] failed reading fasting config:", error);
      });
  }, []);

  // Tick every minute
  useEffect(() => {
    if (!config.enabled) return;
    setNow(new Date());
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, [config.enabled]);

  const saveConfig = useCallback(async (newConfig: FastingConfig) => {
    setConfig(newConfig);
    await AsyncStorage.setItem(FASTING_KEY, JSON.stringify(newConfig));
  }, []);

  const toggle = () => {
    saveConfig({ ...config, enabled: !config.enabled });
  };

  const cycleProtocol = () => {
    const options: FastingConfig["protocol"][] = ["16:8", "18:6", "20:4"];
    const idx = options.indexOf(config.protocol);
    const next = options[(idx + 1) % options.length];
    saveConfig({ ...config, protocol: next });
  };

  if (!config.enabled) {
    return (
      <View className="bg-background-card border border-background-elevated rounded-3xl p-4 flex-1">
        <View className="flex-row items-center gap-x-2 mb-2">
          <Ionicons name="timer-outline" size={18} color="#A0A0B0" />
          <Text className="text-white font-bold text-sm">Ayuno</Text>
        </View>
        <Text className="text-text-muted text-xs mb-3">Intermittent fasting</Text>
        <TouchableOpacity
          className="bg-primary/20 rounded-2xl py-2 items-center"
          onPress={toggle}
        >
          <Text className="text-primary font-bold text-sm">Activar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate fasting state
  const prot = PROTOCOLS[config.protocol];
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const fastStart = config.startHour;
  const fastEnd = (fastStart + prot.fast) % 24;

  // Check if currently fasting
  let isFasting: boolean;
  let hoursIntoPhase: number;
  let phaseTotal: number;

  if (fastStart < fastEnd) {
    isFasting = currentHour >= fastStart && currentHour < fastEnd;
  } else {
    isFasting = currentHour >= fastStart || currentHour < fastEnd;
  }

  if (isFasting) {
    phaseTotal = prot.fast;
    if (currentHour >= fastStart) {
      hoursIntoPhase = currentHour - fastStart;
    } else {
      hoursIntoPhase = (24 - fastStart) + currentHour;
    }
  } else {
    phaseTotal = prot.eat;
    const eatStart = fastEnd;
    if (currentHour >= eatStart) {
      hoursIntoPhase = currentHour - eatStart;
    } else {
      hoursIntoPhase = (24 - eatStart) + currentHour;
    }
  }

  const progress = phaseTotal > 0 ? hoursIntoPhase / phaseTotal : 0;
  const totalMinutesLeft = Math.max(0, Math.round((phaseTotal - hoursIntoPhase) * 60));
  const hoursLeftH = Math.floor(totalMinutesLeft / 60);
  const minsLeft = totalMinutesLeft % 60;

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 flex-1">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-x-2">
          <Ionicons
            name={isFasting ? "timer" : "restaurant"}
            size={18}
            color={isFasting ? "#F59E0B" : "#34D399"}
          />
          <Text className="text-white font-bold text-sm">Ayuno</Text>
        </View>
        <TouchableOpacity onPress={cycleProtocol}>
          <Text className="text-primary text-xs font-bold">{config.protocol}</Text>
        </TouchableOpacity>
      </View>

      <View className="items-center my-2">
        <DonutRing
          size={70}
          strokeWidth={6}
          progress={progress}
          color={isFasting ? "#F59E0B" : "#34D399"}
        >
          <Text className="text-white text-xs font-bold">
            {hoursLeftH}:{minsLeft.toString().padStart(2, "0")}
          </Text>
        </DonutRing>
      </View>

      <Text
        className="text-center text-xs font-semibold mt-1"
        style={{ color: isFasting ? "#F59E0B" : "#34D399" }}
      >
        {isFasting ? "Ayunando" : "Ventana abierta"}
      </Text>

      <TouchableOpacity
        className="mt-2 items-center"
        onPress={toggle}
      >
        <Text className="text-text-muted text-xs">Desactivar</Text>
      </TouchableOpacity>
    </View>
  );
}
