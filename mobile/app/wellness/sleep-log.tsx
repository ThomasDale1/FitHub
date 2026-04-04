// ─────────────────────────────────────────────────────
// mobile/app/wellness/sleep-log.tsx
// Sleep Log — Registrar sueño de anoche
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { router } from "expo-router";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { wellnessAPI } from "@/lib/api";

const QUALITY_OPTIONS = [
  { value: 1, label: "Pésimo", emoji: "😵" },
  { value: 2, label: "Malo", emoji: "😫" },
  { value: 3, label: "Normal", emoji: "😐" },
  { value: 4, label: "Bueno", emoji: "😊" },
  { value: 5, label: "Excelente", emoji: "😴" },
];

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

export default function SleepLogScreen() {
  // Default: bedTime = anoche 23:00, wakeTime = hoy 07:00
  const now = new Date();
  const defaultBed = new Date(now);
  defaultBed.setDate(defaultBed.getDate() - 1);
  defaultBed.setHours(23, 0, 0, 0);

  const defaultWake = new Date(now);
  defaultWake.setHours(7, 0, 0, 0);

  const [bedTime, setBedTime] = useState(defaultBed);
  const [wakeTime, setWakeTime] = useState(defaultWake);
  const [quality, setQuality] = useState(3);
  const [awakenings, setAwakenings] = useState(0);
  const [loading, setLoading] = useState(false);

  // Pickers visibility (Android needs show/hide toggle)
  const [showBedPicker, setShowBedPicker] = useState(Platform.OS === "ios");
  const [showWakePicker, setShowWakePicker] = useState(Platform.OS === "ios");

  const durationMinutes = Math.round(
    (wakeTime.getTime() - bedTime.getTime()) / 60000
  );

  const isValid = durationMinutes > 0 && durationMinutes < 1440;

  const handleBedChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowBedPicker(false);
    if (date) setBedTime(date);
  };

  const handleWakeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowWakePicker(false);
    if (date) setWakeTime(date);
  };

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Duración inválida", "La hora de despertar debe ser después de acostarse.");
      return;
    }
    setLoading(true);
    try {
      await wellnessAPI.logSleep({
        bedTime: bedTime.toISOString(),
        wakeTime: wakeTime.toISOString(),
        quality,
        awakenings,
      });
      router.back();
    } catch (err) {
      console.error("Error logging sleep:", err);
      Alert.alert("Error", "No se pudo guardar el registro de sueño.");
    } finally {
      setLoading(false);
    }
  };

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
                Registrar sueño
              </Text>
              <Text className="text-text-muted text-xs">
                ¿Cómo dormiste anoche?
              </Text>
            </View>
          </View>

          {/* Duration display */}
          <View className="items-center mb-6">
            <Text
              className="font-bold"
              style={{
                fontSize: 48,
                color: isValid ? "#5B4FCF" : "#FF6B6B",
              }}
            >
              {isValid ? formatDuration(durationMinutes) : "—"}
            </Text>
            <Text className="text-text-muted text-sm">Duración de sueño</Text>
          </View>

          {/* Bed time */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3">
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => Platform.OS === "android" && setShowBedPicker(true)}
            >
              <View className="flex-row items-center gap-x-3">
                <Ionicons name="bed-outline" size={22} color="#5B4FCF" />
                <Text className="text-white font-bold text-base">
                  Me acosté
                </Text>
              </View>
              <Text className="text-white font-bold text-lg">
                {formatTime(bedTime)}
              </Text>
            </TouchableOpacity>
            {showBedPicker && (
              <DateTimePicker
                value={bedTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleBedChange}
                themeVariant="dark"
              />
            )}
          </View>

          {/* Wake time */}
          <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-5">
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => Platform.OS === "android" && setShowWakePicker(true)}
            >
              <View className="flex-row items-center gap-x-3">
                <Ionicons name="sunny-outline" size={22} color="#FFB347" />
                <Text className="text-white font-bold text-base">
                  Me desperté
                </Text>
              </View>
              <Text className="text-white font-bold text-lg">
                {formatTime(wakeTime)}
              </Text>
            </TouchableOpacity>
            {showWakePicker && (
              <DateTimePicker
                value={wakeTime}
                mode="time"
                is24Hour={false}
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={handleWakeChange}
                themeVariant="dark"
              />
            )}
          </View>

          {/* Quality */}
          <Text className="text-white font-bold text-base mb-3">
            Calidad del sueño
          </Text>
          <View className="flex-row gap-x-2 mb-5">
            {QUALITY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setQuality(opt.value)}
                className="flex-1 items-center py-3 rounded-2xl"
                style={{
                  backgroundColor:
                    quality === opt.value ? "#5B4FCF25" : "#252540",
                  borderWidth: quality === opt.value ? 1.5 : 0,
                  borderColor:
                    quality === opt.value ? "#5B4FCF" : "transparent",
                }}
              >
                <Text className="text-xl mb-1">{opt.emoji}</Text>
                <Text
                  className="text-[10px] font-semibold"
                  style={{
                    color: quality === opt.value ? "#5B4FCF" : "#6B6B80",
                  }}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Awakenings */}
          <Text className="text-white font-bold text-base mb-3">
            ¿Te despertaste durante la noche?
          </Text>
          <View className="flex-row gap-x-2 mb-8">
            {[0, 1, 2, 3].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setAwakenings(n)}
                className="flex-1 items-center py-3 rounded-2xl"
                style={{
                  backgroundColor:
                    awakenings === n ? "#5B4FCF25" : "#252540",
                  borderWidth: awakenings === n ? 1.5 : 0,
                  borderColor:
                    awakenings === n ? "#5B4FCF" : "transparent",
                }}
              >
                <Text
                  className="font-bold text-base"
                  style={{
                    color: awakenings === n ? "#5B4FCF" : "#6B6B80",
                  }}
                >
                  {n === 3 ? "3+" : String(n)}
                </Text>
                <Text
                  className="text-[10px] mt-0.5"
                  style={{
                    color: awakenings === n ? "#5B4FCF" : "#6B6B80",
                  }}
                >
                  {n === 0 ? "Nunca" : n === 1 ? "Una vez" : n === 2 ? "Dos" : "Varias"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Save button */}
          <TouchableOpacity
            className="rounded-3xl py-4 items-center"
            style={{
              backgroundColor: isValid ? "#5B4FCF" : "#252540",
              opacity: isValid ? 1 : 0.5,
            }}
            onPress={handleSave}
            disabled={!isValid || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text className="text-white font-bold text-base">
                Guardar registro
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
