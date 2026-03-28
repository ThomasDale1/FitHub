import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { workoutAPI, WorkoutTemplate } from "@/lib/api";
import { useWorkoutStore } from "@/store/workoutStore";
import TemplateCard from "./TemplateCard";
import TemplatePreviewModal from "./TemplatePreviewModal";

interface TemplatesTabProps {
  onStartWithTemplate: (templateId: string, name: string) => void;
}

export default function TemplatesTab({ onStartWithTemplate }: TemplatesTabProps) {
  const { activeWorkout } = useWorkoutStore();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await workoutAPI.getTemplates();
      setTemplates(data ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Recargar cada vez que el tab recibe foco (ej: volviendo del workout summary)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleUseTemplate = (template: WorkoutTemplate) => {
    if (activeWorkout.isActive) {
      Alert.alert(
        "Workout en curso",
        "Ya tienes un workout activo. ¿Quieres finalizar y empezar este?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Continuar activo",
            onPress: () => router.push("/workout/active"),
          },
        ]
      );
      return;
    }
    onStartWithTemplate(template.id, template.name);
  };

  const handleDeleteTemplate = async (template: WorkoutTemplate) => {
    try {
      await workoutAPI.deleteTemplate(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch {
      Alert.alert("Error", "No se pudo eliminar la plantilla. Intenta de nuevo.");
    }
  };

  const renderTemplate = ({ item }: { item: WorkoutTemplate }) => (
    <TemplateCard
      template={item}
      onUse={() => handleUseTemplate(item)}
      onPreview={() => {
        setSelectedTemplate(item);
        setPreviewVisible(true);
      }}
      onDelete={() => handleDeleteTemplate(item)}
    />
  );

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={{ color: "#6B6B80", marginTop: 12 }}>Cargando plantillas...</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={templates}
        keyExtractor={(item) => item.id}
        renderItem={renderTemplate}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          paddingTop: 4,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <TouchableOpacity
            onPress={() => {
              // Por ahora, el usuario crea plantillas guardando desde el workout summary.
              // Aquí mostramos info de cómo hacerlo.
              Alert.alert(
                "Crear plantilla",
                "Completa un entrenamiento y al finalizar elige \"Guardar como plantilla\". También puedes iniciar un workout vacío y guardar los ejercicios.",
                [
                  { text: "Entendido" },
                  {
                    text: "Iniciar workout",
                    onPress: () => router.push("/workout/active"),
                  },
                ]
              );
            }}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#1a1a2e",
              borderWidth: 1,
              borderColor: "#6C63FF40",
              borderRadius: 18,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#6C63FF25",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="add" size={22} color="#6C63FF" />
            </View>
            <Text style={{ color: "#6C63FF", fontWeight: "700", fontSize: 15 }}>
              Crear nueva plantilla
            </Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 60,
              gap: 12,
            }}
          >
            <Ionicons name="copy-outline" size={56} color="#33334a" />
            <Text
              style={{
                color: "#c0c0d0",
                fontSize: 18,
                fontWeight: "700",
              }}
            >
              Sin plantillas aún
            </Text>
            <Text
              style={{
                color: "#6B6B80",
                fontSize: 14,
                textAlign: "center",
                lineHeight: 20,
                paddingHorizontal: 20,
              }}
            >
              Guarda tus rutinas favoritas para iniciar más rápido en tu próximo
              entrenamiento.
            </Text>
          </View>
        }
      />

      <TemplatePreviewModal
        template={selectedTemplate}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        onUse={() => {
          if (selectedTemplate) handleUseTemplate(selectedTemplate);
        }}
      />
    </>
  );
}
