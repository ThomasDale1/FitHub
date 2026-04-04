// ─────────────────────────────────────────────────────
// mobile/components/wellness/BodyMap.tsx
// Interactive body map — tap muscles to set soreness (0-5)
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import { useState } from "react";

// ─── Muscle group definitions ────────────────────────
export interface MuscleGroup {
  key: string;
  label: string;
  // Position as percentage of body map (top, left)
  top: number;
  left: number;
  width: number;
  height: number;
  view?: "front" | "back"; // Which view this muscle belongs to
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  // Upper body
  { key: "neck", label: "Cuello", top: 8, left: 38, width: 24, height: 5 },
  { key: "shoulders", label: "Hombros", top: 13, left: 18, width: 64, height: 7 },
  { key: "chest", label: "Pecho", top: 17, left: 28, width: 44, height: 9, view: "front" },
  { key: "upperBack", label: "Espalda alta", top: 17, left: 28, width: 44, height: 9, view: "back" },
  { key: "biceps", label: "Bíceps", top: 22, left: 12, width: 16, height: 10, view: "front" },
  { key: "triceps", label: "Tríceps", top: 22, left: 72, width: 16, height: 10, view: "back" },

  // Core
  { key: "core", label: "Core", top: 28, left: 30, width: 40, height: 10, view: "front" },
  { key: "lowerBack", label: "Espalda baja", top: 34, left: 30, width: 40, height: 8, view: "back" },

  // Lower body
  { key: "glutes", label: "Glúteos", top: 42, left: 25, width: 50, height: 8 },
  { key: "quads", label: "Cuádriceps", top: 50, left: 22, width: 56, height: 14, view: "front" },
  { key: "hamstrings", label: "Isquiotibiales", top: 55, left: 24, width: 52, height: 10, view: "back" },
  { key: "calves", label: "Pantorrillas", top: 70, left: 26, width: 48, height: 12 },
];

// Soreness colors (0 = no data, 1 = fine, 5 = very sore)
const SORENESS_COLORS: Record<number, string> = {
  0: "#252540",
  1: "#00D48A40",
  2: "#00D48A80",
  3: "#FFB34780",
  4: "#FF6B6B80",
  5: "#FF6B6BCC",
};

const SORENESS_LABELS = ["Sin dolor", "Mínimo", "Leve", "Moderado", "Alto", "Intenso"];

interface BodyMapProps {
  muscleData: Record<string, number>;
  onMuscleChange: (key: string, value: number) => void;
  editable?: boolean;
}

export default function BodyMap({
  muscleData,
  onMuscleChange,
  editable = true,
}: BodyMapProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [view, setView] = useState<"front" | "back">("front");

  // Responsive sizing
  const mapWidth = Math.min(screenWidth - 40, 320);
  const mapHeight = mapWidth * 1.6;

  // Filter muscles based on current view
  const visibleMuscles = MUSCLE_GROUPS.filter(
    (m) => !m.view || m.view === view
  );

  const handleTap = (key: string) => {
    if (!editable) return;
    if (selectedMuscle === key) {
      // Cycle value: 0 → 1 → 2 → 3 → 4 → 5 → 0
      const current = muscleData[key] || 0;
      onMuscleChange(key, (current + 1) % 6);
    } else {
      setSelectedMuscle(key);
    }
  };

  const selectedGroup = MUSCLE_GROUPS.find((m) => m.key === selectedMuscle);

  return (
    <View className="items-center gap-3">
      {/* View toggle */}
      <View className="flex-row gap-2 bg-neutral-200 dark:bg-neutral-700 rounded-full p-1">
        {(["front", "back"] as const).map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => {
              setView(v);
              setSelectedMuscle(null); // Clear selection when switching views
            }}
            className={`flex-1 px-4 py-2 rounded-full transition-all ${
              view === v
                ? "bg-white dark:bg-neutral-600"
                : "bg-transparent"
            }`}
          >
            <Text
              className={`text-center font-semibold text-sm ${
                view === v
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {v === "front" ? "Frontal" : "Espalda"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Body outline with tappable muscle zones */}
      <View
        style={{
          width: mapWidth,
          height: mapHeight,
          position: "relative",
        }}
        className="bg-background-card border border-background-elevated rounded-3xl overflow-hidden"
      >
        {/* Body silhouette placeholder */}
        <View className="absolute inset-0 items-center justify-center">
          <Text
            style={{ fontSize: mapHeight * 0.7, opacity: 0.08 }}
          >
            🧍
          </Text>
        </View>

        {/* Tappable muscle zones */}
        {visibleMuscles.map((muscle) => {
          const val = muscleData[muscle.key] || 0;
          const isSelected = selectedMuscle === muscle.key;

          return (
            <TouchableOpacity
              key={muscle.key}
              onPress={() => handleTap(muscle.key)}
              activeOpacity={0.7}
              style={{
                position: "absolute",
                top: `${muscle.top}%`,
                left: `${muscle.left}%`,
                width: `${muscle.width}%`,
                height: `${muscle.height}%`,
                backgroundColor: SORENESS_COLORS[val],
                borderWidth: isSelected ? 2 : 1,
                borderColor: isSelected ? "#7B68EE" : "#FFFFFF10",
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                className="font-bold"
                style={{
                  fontSize: 9,
                  color: val >= 3 ? "#FFF" : "#A0A0B0",
                }}
                numberOfLines={1}
              >
                {muscle.label}
              </Text>
              {val > 0 && (
                <Text style={{ fontSize: 7, color: "#A0A0B0" }}>
                  {val}/5
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected muscle detail */}
      {selectedGroup && editable && (
        <View className="w-full mt-4 bg-background-card border border-background-elevated rounded-3xl p-4">
          <Text className="text-white font-bold text-sm mb-3">
            {selectedGroup.label}:{" "}
            <Text style={{ color: "#7B68EE" }}>
              {SORENESS_LABELS[muscleData[selectedGroup.key] || 0]}
            </Text>
          </Text>
          <View className="flex-row gap-x-2">
            {[0, 1, 2, 3, 4, 5].map((level) => {
              const active = (muscleData[selectedGroup.key] || 0) === level;
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => onMuscleChange(selectedGroup.key, level)}
                  className="flex-1 items-center py-2 rounded-xl"
                  style={{
                    backgroundColor: active
                      ? SORENESS_COLORS[level] || "#252540"
                      : "#1A1A2E",
                    borderWidth: active ? 1.5 : 0,
                    borderColor: active ? "#7B68EE" : "transparent",
                  }}
                >
                  <Text
                    className="font-bold text-xs"
                    style={{ color: active ? "#FFF" : "#6B6B80" }}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Legend */}
      <View className="flex-row justify-center gap-x-3 mt-3">
        {[
          { color: "#00D48A40", label: "Bajo" },
          { color: "#FFB34780", label: "Medio" },
          { color: "#FF6B6BCC", label: "Alto" },
        ].map((item) => (
          <View key={item.label} className="flex-row items-center gap-x-1">
            <View
              style={{ backgroundColor: item.color, width: 10, height: 10, borderRadius: 3 }}
            />
            <Text className="text-text-muted text-[10px]">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
