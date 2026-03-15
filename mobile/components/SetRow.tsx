import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ActiveSet, SetType } from "@/store/workoutStore";

interface SetRowProps {
  set: ActiveSet;
  onUpdate: (data: Partial<ActiveSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
}

const SET_TYPE_LABELS: Record<SetType, string> = {
  NORMAL: "N",
  WARMUP: "W",
  DROPSET: "D",
  SUPERSET: "S",
  FAILURE: "F",
  AMRAP: "A",
};

const SET_TYPE_COLORS: Record<SetType, string> = {
  NORMAL: "#6C63FF",
  WARMUP: "#F59E0B",
  DROPSET: "#EF4444",
  SUPERSET: "#00D48A",
  FAILURE: "#FF6B35",
  AMRAP: "#8B5CF6",
};

export default function SetRow({
  set,
  onUpdate,
  onComplete,
  onRemove,
}: SetRowProps) {

  const handleComplete = () => {
    if (!set.weight || !set.reps) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  const typeColor = SET_TYPE_COLORS[set.setType];

  return (
    <View
      className={`flex-row items-center gap-x-3 py-2 px-1 rounded-2xl mb-1 ${
        set.isCompleted ? "bg-primary/10" : ""
      }`}
    >
      {/* Número de set / tipo */}
      <TouchableOpacity
        className="w-8 h-8 rounded-xl items-center justify-center"
        style={{ backgroundColor: `${typeColor}20` }}
        onPress={() => {
          // Ciclar entre tipos de set
          const types: SetType[] = [
            "NORMAL", "WARMUP", "DROPSET", "SUPERSET", "FAILURE", "AMRAP"
          ];
          const currentIndex = types.indexOf(set.setType);
          const nextType = types[(currentIndex + 1) % types.length];
          onUpdate({ setType: nextType });
        }}
      >
        <Text
          className="text-xs font-bold"
          style={{ color: typeColor }}
        >
          {SET_TYPE_LABELS[set.setType]}
        </Text>
      </TouchableOpacity>

      {/* Set número */}
      <Text className="text-text-muted text-sm w-5 text-center">
        {set.setNumber}
      </Text>

      {/* Input peso */}
      <View className="flex-1 bg-background-elevated rounded-xl px-3 py-2">
        <TextInput
          className="text-white text-center font-bold text-base"
          placeholder="kg"
          placeholderTextColor="#6B6B80"
          value={set.weight}
          onChangeText={(v) => onUpdate({ weight: v })}
          keyboardType="decimal-pad"
          editable={!set.isCompleted}
        />
      </View>

      {/* Input reps */}
      <View className="flex-1 bg-background-elevated rounded-xl px-3 py-2">
        <TextInput
          className="text-white text-center font-bold text-base"
          placeholder="reps"
          placeholderTextColor="#6B6B80"
          value={set.reps}
          onChangeText={(v) => onUpdate({ reps: v })}
          keyboardType="number-pad"
          editable={!set.isCompleted}
        />
      </View>

      {/* Botón completar */}
      <TouchableOpacity
        onPress={handleComplete}
        className={`w-10 h-10 rounded-xl items-center justify-center ${
          set.isCompleted ? "bg-success" : "bg-background-elevated"
        }`}
      >
        <Ionicons
          name="checkmark"
          size={18}
          color={set.isCompleted ? "white" : "#6B6B80"}
        />
      </TouchableOpacity>

      {/* Botón eliminar */}
      <TouchableOpacity onPress={onRemove}>
        <Ionicons name="trash-outline" size={16} color="#6B6B80" />
      </TouchableOpacity>

    </View>
  );
}