// ─────────────────────────────────────────────────────
// SleepCard — Mini card de sueño con chart de 7 días
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SleepDay {
  date: string;
  duration: number; // minutos
  score: number | null;
  quality: number;
}

interface Props {
  todaySleep: {
    score: number | null;
    duration: number;
    bedTime: string;
    wakeTime: string;
    quality: number;
  } | null;
  history: SleepDay[];
  onLogSleep: () => void;
}

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBarColor(duration: number): string {
  if (duration >= 420) return "#00D48A"; // 7h+ verde
  if (duration >= 360) return "#F5C842"; // 6h+ amarillo
  return "#FF6B6B"; // < 6h rojo
}

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

export default function SleepCard({ todaySleep, history, onLogSleep }: Props) {
  const maxDuration = Math.max(540, ...history.map((d) => d.duration)); // min 9h para escala

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-x-3">
          <View className="bg-[#5B4FCF20] rounded-2xl p-2.5">
            <Ionicons name="moon-outline" size={22} color="#5B4FCF" />
          </View>
          <View>
            <Text className="text-white font-bold text-base">Sueño</Text>
            {todaySleep ? (
              <Text className="text-text-muted text-xs mt-0.5">
                {formatDuration(todaySleep.duration)} · Score{" "}
                {todaySleep.score ?? "—"}
              </Text>
            ) : (
              <Text className="text-text-muted text-xs mt-0.5">
                Sin registro de anoche
              </Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          onPress={onLogSleep}
          className="rounded-xl px-3 py-1.5"
          style={{ backgroundColor: "#5B4FCF25" }}
        >
          <Text style={{ color: "#5B4FCF", fontSize: 12, fontWeight: "700" }}>
            {todaySleep ? "Editar" : "Registrar"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Detalle de anoche */}
      {todaySleep && (
        <View className="flex-row gap-x-4 mb-3 px-1">
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="bed-outline" size={14} color="#6B6B80" />
            <Text className="text-text-secondary text-xs">
              {formatTime(todaySleep.bedTime)}
            </Text>
          </View>
          <View className="flex-row items-center gap-x-1">
            <Ionicons name="sunny-outline" size={14} color="#6B6B80" />
            <Text className="text-text-secondary text-xs">
              {formatTime(todaySleep.wakeTime)}
            </Text>
          </View>
          <View className="flex-row items-center gap-x-1">
            <Text className="text-text-secondary text-xs">
              Calidad: {"⭐".repeat(Math.max(0, Math.min(5, Math.floor(Number(todaySleep.quality) || 0))))}
            </Text>
          </View>
        </View>
      )}

      {/* Mini bar chart últimos 7 días */}
      {history.length > 0 && (
        <View>
          <Text className="text-text-muted text-xs mb-2">Últimos 7 días</Text>
          <View className="flex-row items-end justify-between" style={{ height: 60 }}>
            {history.slice(-7).map((day, i) => {
              const barHeight = Math.max(4, (day.duration / maxDuration) * 52);
              const color = getBarColor(day.duration);
              const dayOfWeek = new Date(day.date).getDay();
              // Adjust: getDay() returns 0=Sunday, we want 0=Monday
              const label = DAY_LABELS[(dayOfWeek + 6) % 7];

              return (
                <View key={day.date} className="items-center flex-1">
                  <View
                    style={{
                      height: barHeight,
                      backgroundColor: color,
                      borderRadius: 4,
                      width: "60%",
                      minWidth: 8,
                    }}
                  />
                  <Text className="text-text-muted mt-1" style={{ fontSize: 9 }}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
          {/* Goal line label */}
          <View className="flex-row items-center justify-end mt-1">
            <View
              style={{
                width: 12,
                height: 1.5,
                backgroundColor: "#6B6B8050",
                borderRadius: 1,
                marginRight: 4,
              }}
            />
            <Text className="text-text-muted" style={{ fontSize: 9 }}>
              Meta 8h
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
