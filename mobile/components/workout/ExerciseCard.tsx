import { View, Text, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { exerciseAPI, Exercise } from "@/lib/api";

const BODY_PART_LABELS: Record<string, string> = {
  back: "Espalda",
  cardio: "Cardio",
  chest: "Pecho",
  "lower arms": "Antebrazos",
  "lower legs": "Pantorrillas",
  neck: "Cuello",
  shoulders: "Hombros",
  "upper arms": "Brazos",
  "upper legs": "Piernas",
  waist: "Abdomen",
};

interface ExerciseCardProps {
  exercise: Exercise;
  bestSet?: { weight: number; reps: number } | null;
  showAddButton?: boolean;
  onPress: () => void;
  onAdd?: () => void;
}

export default function ExerciseCard({
  exercise,
  bestSet,
  showAddButton = false,
  onPress,
  onAdd,
}: ExerciseCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={{
        backgroundColor: "#1a1a2e",
        borderWidth: 1,
        borderColor: "#252540",
        borderRadius: 20,
        padding: 14,
        marginBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      {/* GIF */}
      <Image
        source={{ uri: exerciseAPI.getGifUrl(exercise.id, "180") }}
        style={{
          width: 72,
          height: 72,
          borderRadius: 14,
          backgroundColor: "#252540",
        }}
        contentFit="cover"
        autoplay
        cachePolicy="memory-disk"
      />

      {/* Info */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}
          numberOfLines={2}
        >
          {exercise.name}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Ionicons name="body-outline" size={11} color="#6C63FF" />
          <Text style={{ color: "#6C63FF", fontSize: 12 }} numberOfLines={1}>
            {exercise.target}
          </Text>
          <Text style={{ color: "#44444f", fontSize: 12 }}>·</Text>
          <Ionicons name="barbell-outline" size={11} color="#6B6B80" />
          <Text style={{ color: "#6B6B80", fontSize: 12 }} numberOfLines={1}>
            {exercise.equipment}
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View
            style={{
              backgroundColor: "#252540",
              borderRadius: 8,
              paddingHorizontal: 7,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "#8888a0", fontSize: 11 }}>
              {BODY_PART_LABELS[exercise.bodyPart] || exercise.bodyPart}
            </Text>
          </View>

          {bestSet && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name="trophy-outline" size={11} color="#F59E0B" />
              <Text style={{ color: "#F59E0B", fontSize: 11, fontWeight: "600" }}>
                {bestSet.weight}kg × {bestSet.reps}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Botón añadir */}
      {showAddButton && onAdd && (
        <TouchableOpacity
          onPress={onAdd}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            backgroundColor: "#6C63FF20",
            borderRadius: 12,
            padding: 8,
          }}
        >
          <Ionicons name="add" size={22} color="#6C63FF" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}
