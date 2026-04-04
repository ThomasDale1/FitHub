// ─────────────────────────────────────────────────────
// MoodCheckCard — Quick mood/energy/stress check-in
// 3 sliders + nota opcional, < 5 segundos para completar
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";

const MOOD_EMOJIS = ["😫", "😕", "😐", "😊", "🥳"];
const ENERGY_EMOJIS = ["🪫", "🔋", "⚡", "💪", "🚀"];
const STRESS_LABELS = ["Zen", "Bajo", "Normal", "Alto", "Máx"];

interface Props {
  currentMood?: { mood: number; energy: number; stress: number; loggedAt: string } | null;
  onSubmit: (data: { mood: number; energy: number; stress: number; note?: string }) => Promise<void>;
}

function SliderRow({
  label,
  value,
  onChange,
  emojis,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  emojis?: string[];
  color: string;
}) {
  return (
    <View className="mb-3">
      <View className="flex-row justify-between items-center mb-1.5">
        <Text className="text-text-secondary text-xs font-semibold">{label}</Text>
        <Text style={{ color, fontSize: 11, fontWeight: "700" }}>
          {emojis ? emojis[value - 1] : value} {value}/5
        </Text>
      </View>
      <View className="flex-row gap-x-2">
        {[1, 2, 3, 4, 5].map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => onChange(v)}
            className="flex-1 items-center justify-center rounded-xl py-2"
            style={{
              backgroundColor: v === value ? color + "25" : "#252540",
              borderWidth: v === value ? 1.5 : 0,
              borderColor: v === value ? color : "transparent",
            }}
          >
            <Text style={{ fontSize: emojis ? 18 : 14, color: v === value ? color : "#6B6B80" }}>
              {emojis ? emojis[v - 1] : STRESS_LABELS[v - 1]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function MoodCheckCard({ currentMood, onSubmit }: Props) {
  const [mood, setMood] = useState(3);
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(!currentMood);

  // Si ya loggeó hoy, mostrar resumen
  if (currentMood && !expanded) {
    const time = new Date(currentMood.loggedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <TouchableOpacity
        className="bg-background-card border border-background-elevated rounded-3xl p-4 flex-row items-center justify-between"
        onPress={() => setExpanded(true)}
      >
        <View className="flex-row items-center gap-x-3">
          <View className="bg-[#FFB34720] rounded-2xl p-2.5">
            <Ionicons name="happy-outline" size={22} color="#FFB347" />
          </View>
          <View>
            <Text className="text-white font-bold text-sm">Mood de hoy</Text>
            <Text className="text-text-muted text-xs mt-0.5">
              {MOOD_EMOJIS[currentMood.mood - 1]} Ánimo {currentMood.mood}/5 · ⚡ Energía{" "}
              {currentMood.energy}/5 · a las {time}
            </Text>
          </View>
        </View>
        <Ionicons name="refresh-outline" size={18} color="#6B6B80" />
      </TouchableOpacity>
    );
  }

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({ mood, energy, stress, note: note.trim() || undefined });
      setExpanded(false);
    } catch (err) {
      console.error("Error logging mood:", err);
      Alert.alert("Error", "No se pudo registrar el ánimo. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4">
      {/* Header */}
      <View className="flex-row items-center gap-x-3 mb-4">
        <View className="bg-[#FFB34720] rounded-2xl p-2.5">
          <Ionicons name="happy-outline" size={22} color="#FFB347" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-base">¿Cómo estás hoy?</Text>
          <Text className="text-text-muted text-xs">Check-in rápido</Text>
        </View>
        {currentMood && (
          <TouchableOpacity onPress={() => setExpanded(false)}>
            <Ionicons name="close" size={20} color="#6B6B80" />
          </TouchableOpacity>
        )}
      </View>

      {/* Sliders */}
      <SliderRow
        label="ÁNIMO"
        value={mood}
        onChange={setMood}
        emojis={MOOD_EMOJIS}
        color="#FFB347"
      />
      <SliderRow
        label="ENERGÍA"
        value={energy}
        onChange={setEnergy}
        emojis={ENERGY_EMOJIS}
        color="#00D48A"
      />
      <SliderRow
        label="ESTRÉS"
        value={stress}
        onChange={setStress}
        color="#FF6B6B"
      />

      {/* Note */}
      <TextInput
        className="bg-[#252540] text-white rounded-2xl px-4 py-3 text-sm mt-1 mb-3"
        placeholder="Nota (opcional)..."
        placeholderTextColor="#6B6B80"
        value={note}
        onChangeText={setNote}
        maxLength={200}
      />

      {/* Submit */}
      <TouchableOpacity
        className="rounded-2xl py-3 items-center"
        style={{ backgroundColor: "#7B68EE" }}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text className="text-white font-bold text-sm">Registrar</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
