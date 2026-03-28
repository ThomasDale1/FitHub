import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { WorkoutTemplate } from "@/lib/api";

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  if (diffDays < 30) return `Hace ${Math.floor(diffDays / 7)} semanas`;
  return `Hace ${Math.floor(diffDays / 30)} meses`;
}

interface TemplateCardProps {
  template: WorkoutTemplate;
  onUse: () => void;
  onPreview: () => void;
  onDelete: () => void;
}

export default function TemplateCard({
  template,
  onUse,
  onPreview,
  onDelete,
}: TemplateCardProps) {
  const exerciseNames = template.templateSets
    .map((s) => s.exerciseName)
    .filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate

  const preview = exerciseNames.slice(0, 3).join(" · ");
  const extra = exerciseNames.length > 3 ? ` +${exerciseNames.length - 3}` : "";

  const handleOptions = () => {
    Alert.alert(template.name, "¿Qué quieres hacer?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () =>
          Alert.alert(
            "Eliminar plantilla",
            `¿Eliminar "${template.name}"? Esta acción no se puede deshacer.`,
            [
              { text: "Cancelar", style: "cancel" },
              { text: "Eliminar", style: "destructive", onPress: onDelete },
            ]
          ),
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={onPreview}
      activeOpacity={0.8}
      style={{
        backgroundColor: "#1a1a2e",
        borderWidth: 1,
        borderColor: "#252540",
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
      }}
    >
      {/* Fila superior */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <View style={{ flex: 1, gap: 3 }}>
          <Text
            style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}
            numberOfLines={1}
          >
            {template.name}
          </Text>
          {template.description ? (
            <Text
              style={{ color: "#6B6B80", fontSize: 12 }}
              numberOfLines={1}
            >
              {template.description}
            </Text>
          ) : null}
        </View>

        {/* Botón opciones */}
        <TouchableOpacity
          onPress={handleOptions}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingLeft: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#6B6B80" />
        </TouchableOpacity>
      </View>

      {/* Ejercicios preview */}
      <Text
        style={{ color: "#8888a0", fontSize: 12, marginBottom: 12 }}
        numberOfLines={1}
      >
        {preview}
        {extra && (
          <Text style={{ color: "#6C63FF" }}>{extra}</Text>
        )}
      </Text>

      {/* Stats + botón usar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="list-outline" size={13} color="#6B6B80" />
            <Text style={{ color: "#6B6B80", fontSize: 12 }}>
              {exerciseNames.length} ejercicio{exerciseNames.length !== 1 ? "s" : ""}
            </Text>
          </View>
          {template.timesUsed > 0 && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Ionicons name="time-outline" size={13} color="#6B6B80" />
              <Text style={{ color: "#6B6B80", fontSize: 12 }}>
                {timeAgo(template.updatedAt)}
              </Text>
            </View>
          )}
        </View>

        {/* Botón usar */}
        <TouchableOpacity
          onPress={onUse}
          style={{
            backgroundColor: "#6C63FF",
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
          }}
        >
          <Ionicons name="play" size={13} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
            Usar
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
