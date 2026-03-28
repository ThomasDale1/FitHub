import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
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

interface ExerciseDetailModalProps {
  exercise: Exercise | null;
  visible: boolean;
  bestSet?: { weight: number; reps: number } | null;
  showAddButton?: boolean;
  onClose: () => void;
  onAdd?: () => void;
}

function estimate1RM(weight: number, reps: number): number {
  // Epley formula
  return Math.round(weight * (1 + reps / 30));
}

export default function ExerciseDetailModal({
  exercise,
  visible,
  bestSet,
  showAddButton = false,
  onClose,
  onAdd,
}: ExerciseDetailModalProps) {
  if (!exercise) return null;

  const estimated1RM =
    bestSet ? estimate1RM(bestSet.weight, bestSet.reps) : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000070" }}
        onPress={onClose}
      />

      {/* Sheet */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#13131f",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          maxHeight: "88%",
        }}
      >
        {/* Handle */}
        <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 4 }}>
          <View
            style={{
              width: 40,
              height: 4,
              backgroundColor: "#33334a",
              borderRadius: 2,
            }}
          />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        >
          {/* GIF centrado */}
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <Image
              source={{ uri: exerciseAPI.getGifUrl(exercise.id, "400") }}
              style={{
                width: 200,
                height: 200,
                borderRadius: 20,
                backgroundColor: "#1a1a2e",
              }}
              contentFit="cover"
              autoplay
              cachePolicy="memory-disk"
            />
          </View>

          {/* Nombre */}
          <Text
            style={{
              color: "#fff",
              fontWeight: "800",
              fontSize: 22,
              marginBottom: 8,
              textAlign: "center",
              textTransform: "capitalize",
            }}
          >
            {exercise.name}
          </Text>

          {/* Tags */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              gap: 10,
              marginBottom: 24,
              flexWrap: "wrap",
            }}
          >
            {[
              { icon: "body-outline", label: exercise.target, color: "#6C63FF" },
              {
                icon: "barbell-outline",
                label: exercise.equipment,
                color: "#6B6B80",
              },
              {
                icon: "layers-outline",
                label: BODY_PART_LABELS[exercise.bodyPart] || exercise.bodyPart,
                color: "#6B6B80",
              },
            ].map((tag) => (
              <View
                key={tag.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "#1e1e30",
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                }}
              >
                <Ionicons
                  name={tag.icon as any}
                  size={13}
                  color={tag.color}
                />
                <Text
                  style={{
                    color: tag.color,
                    fontSize: 12,
                    fontWeight: "600",
                    textTransform: "capitalize",
                  }}
                >
                  {tag.label}
                </Text>
              </View>
            ))}
          </View>

          {/* PRs / Stats */}
          {bestSet ? (
            <View
              style={{
                backgroundColor: "#1a1a2e",
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
              }}
            >
              <Text
                style={{
                  color: "#F59E0B",
                  fontWeight: "700",
                  fontSize: 13,
                  marginBottom: 12,
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                }}
              >
                Tu récord
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  {
                    label: "Mejor set",
                    value: `${bestSet.weight}kg × ${bestSet.reps}`,
                    icon: "trophy",
                    color: "#F59E0B",
                  },
                  {
                    label: "1RM est.",
                    value: `~${estimated1RM}kg`,
                    icon: "flash",
                    color: "#6C63FF",
                  },
                ].map((stat) => (
                  <View
                    key={stat.label}
                    style={{
                      flex: 1,
                      backgroundColor: "#13131f",
                      borderRadius: 12,
                      padding: 12,
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons
                      name={stat.icon as any}
                      size={18}
                      color={stat.color}
                    />
                    <Text
                      style={{
                        color: stat.color,
                        fontWeight: "700",
                        fontSize: 15,
                      }}
                    >
                      {stat.value}
                    </Text>
                    <Text style={{ color: "#6B6B80", fontSize: 11 }}>
                      {stat.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "#1a1a2e",
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                alignItems: "center",
              }}
            >
              <Ionicons name="trophy-outline" size={24} color="#44444f" />
              <Text
                style={{ color: "#6B6B80", fontSize: 13, marginTop: 6 }}
              >
                Aún sin récord. ¡Empieza hoy!
              </Text>
            </View>
          )}

          {/* Músculos secundarios */}
          {exercise.secondaryMuscles?.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text
                style={{
                  color: "#8888a0",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 8,
                }}
              >
                Músculos secundarios
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {exercise.secondaryMuscles.map((m: string) => (
                  <View
                    key={m}
                    style={{
                      backgroundColor: "#1e1e30",
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text
                      style={{
                        color: "#6B6B80",
                        fontSize: 12,
                        textTransform: "capitalize",
                      }}
                    >
                      {m}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Instrucciones */}
          {exercise.instructions?.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text
                style={{
                  color: "#8888a0",
                  fontSize: 12,
                  fontWeight: "700",
                  textTransform: "uppercase",
                  letterSpacing: 0.8,
                  marginBottom: 10,
                }}
              >
                Instrucciones
              </Text>
              {exercise.instructions.map((instruction: string, idx: number) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: "#6C63FF20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: 1,
                      flexShrink: 0,
                    }}
                  >
                    <Text
                      style={{
                        color: "#6C63FF",
                        fontSize: 11,
                        fontWeight: "700",
                      }}
                    >
                      {idx + 1}
                    </Text>
                  </View>
                  <Text
                    style={{ color: "#c0c0d0", fontSize: 13, flex: 1, lineHeight: 19 }}
                  >
                    {instruction}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Botones de acción */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 36,
            paddingTop: 8,
            gap: 10,
          }}
        >
          {showAddButton && onAdd && (
            <TouchableOpacity
              onPress={() => {
                onAdd();
                onClose();
              }}
              style={{
                backgroundColor: "#6C63FF",
                borderRadius: 18,
                paddingVertical: 16,
                alignItems: "center",
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                Agregar al workout
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onClose}
            style={{
              borderRadius: 18,
              paddingVertical: 14,
              alignItems: "center",
              borderWidth: 1,
              borderColor: "#252540",
            }}
          >
            <Text
              style={{ color: "#6B6B80", fontWeight: "600", fontSize: 15 }}
            >
              Cerrar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
