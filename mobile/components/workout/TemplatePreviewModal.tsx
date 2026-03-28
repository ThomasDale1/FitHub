import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WorkoutTemplate } from "@/lib/api";

interface TemplatePreviewModalProps {
  template: WorkoutTemplate | null;
  visible: boolean;
  onClose: () => void;
  onUse: () => void;
}

export default function TemplatePreviewModal({
  template,
  visible,
  onClose,
  onUse,
}: TemplatePreviewModalProps) {
  if (!template) return null;

  // Deduplicate exercises por nombre para mostrar la lista
  const uniqueExercises: WorkoutTemplate["templateSets"] = [];
  const seen = new Set<string>();
  for (const s of template.templateSets) {
    if (!seen.has(s.exerciseName)) {
      seen.add(s.exerciseName);
      uniqueExercises.push(s);
    }
  }

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
          maxHeight: "80%",
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

        {/* Header */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#1e1e30",
          }}
        >
          <Text
            style={{ color: "#fff", fontWeight: "800", fontSize: 20 }}
            numberOfLines={1}
          >
            {template.name}
          </Text>
          {template.description ? (
            <Text
              style={{ color: "#6B6B80", fontSize: 13, marginTop: 3 }}
              numberOfLines={2}
            >
              {template.description}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              marginTop: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Ionicons name="list-outline" size={14} color="#6C63FF" />
              <Text style={{ color: "#6C63FF", fontSize: 13, fontWeight: "600" }}>
                {uniqueExercises.length} ejercicio{uniqueExercises.length !== 1 ? "s" : ""}
              </Text>
            </View>
            {template.timesUsed > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="repeat-outline" size={14} color="#6B6B80" />
                <Text style={{ color: "#6B6B80", fontSize: 13 }}>
                  Usada {template.timesUsed} {template.timesUsed === 1 ? "vez" : "veces"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Lista de ejercicios */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, gap: 10 }}
        >
          {uniqueExercises.map((ex, idx) => (
            <View
              key={ex.id}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                backgroundColor: "#1a1a2e",
                borderRadius: 14,
                padding: 12,
              }}
            >
              {/* Número */}
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: "#6C63FF20",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#6C63FF", fontWeight: "700", fontSize: 14 }}
                >
                  {idx + 1}
                </Text>
              </View>

              {/* Info ejercicio */}
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: 14,
                    textTransform: "capitalize",
                  }}
                  numberOfLines={1}
                >
                  {ex.exerciseName}
                </Text>
                <Text style={{ color: "#6B6B80", fontSize: 12, marginTop: 2 }}>
                  {ex.targetSets} series
                  {ex.targetReps ? ` × ${ex.targetReps} reps` : ""}
                  {ex.targetWeight ? ` · ${ex.targetWeight}kg` : ""}
                  {ex.restSeconds ? ` · ${ex.restSeconds}s descanso` : ""}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Botones */}
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 36,
            paddingTop: 8,
            gap: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              onUse();
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
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Iniciar con esta plantilla
            </Text>
          </TouchableOpacity>

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
            <Text style={{ color: "#6B6B80", fontWeight: "600", fontSize: 15 }}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
