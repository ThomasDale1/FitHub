// ─────────────────────────────────────────────────────
// mobile/app/wellness/recovery.tsx
// Recovery — Soreness body map + recovery protocols
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { wellnessAPI } from "@/lib/api";
import BodyMap from "@/components/wellness/BodyMap";

// ─── Recovery protocols ──────────────────────────────
interface Protocol {
  id: string;
  title: string;
  icon: string;
  color: string;
  description: string;
  steps: string[];
  duration: string;
  bestFor: string;
}

const RECOVERY_PROTOCOLS: Protocol[] = [
  {
    id: "foam_roll",
    title: "Foam Rolling",
    icon: "🧱",
    color: "#FF6B6B",
    description: "Miofascial release para reducir nudos y mejorar circulación.",
    steps: [
      "Cuádriceps: 60s por pierna, pausando en puntos tensos",
      "IT Band: 60s por pierna, rodar lateral del muslo",
      "Espalda alta: 60s, cruzar brazos sobre pecho",
      "Glúteos: 60s por lado, sentado sobre el foam roller",
      "Pantorrillas: 60s por pierna, cruzar una pierna sobre otra",
    ],
    duration: "10-15 min",
    bestFor: "Post-entrenamiento, piernas pesadas",
  },
  {
    id: "stretch",
    title: "Estiramientos",
    icon: "🧘",
    color: "#00D48A",
    description: "Estiramientos estáticos para mejorar flexibilidad y relajar.",
    steps: [
      "Pecho: 30s por lado contra pared o marco de puerta",
      "Hip flexor: 30s por pierna, rodilla al suelo",
      "Isquiotibiales: 30s por pierna, sentado o de pie",
      "Piriforme: 30s por lado, figura 4 tumbado",
      "Cuello: 20s por lado, oreja hacia hombro",
      "Espalda baja: 30s, rodillas al pecho tumbado",
    ],
    duration: "10-12 min",
    bestFor: "Rigidez general, días de descanso",
  },
  {
    id: "cold_exposure",
    title: "Exposición al frío",
    icon: "🧊",
    color: "#00BFFF",
    description: "Ducha fría o inmersión para reducir inflamación.",
    steps: [
      "Empieza con 30s de agua fría al final de tu ducha",
      "Respira profundo: inhala 4s, exhala 6s",
      "Incrementa gradualmente hasta 2-3 minutos",
      "Enfoca el agua en las zonas más adoloridas",
      "Termina con 30s de agua tibia para cerrar",
    ],
    duration: "3-5 min",
    bestFor: "Inflamación, dolor muscular intenso",
  },
  {
    id: "active_recovery",
    title: "Recuperación activa",
    icon: "🚶",
    color: "#FFB347",
    description: "Movimiento ligero para promover circulación sin fatiga adicional.",
    steps: [
      "Caminata ligera: 15-20 min a ritmo cómodo",
      "Movilidad de cadera: 10 círculos por dirección",
      "Sentadillas a profundidad sin peso: 10 reps lentas",
      "Shoulder dislocations con banda: 10 reps",
      "Cat-cow: 10 reps, coordinar con respiración",
    ],
    duration: "20-30 min",
    bestFor: "Días de descanso, soreness moderado",
  },
  {
    id: "sleep_recovery",
    title: "Protocolo de sueño",
    icon: "🌙",
    color: "#5B4FCF",
    description: "Optimiza tu descanso nocturno para máxima recuperación.",
    steps: [
      "Apaga pantallas 30 min antes de dormir",
      "Baja la temperatura de la habitación (18-20°C)",
      "Ejercicio de respiración 4-7-8 (3 ciclos)",
      "Cuarto oscuro: usa cortinas blackout o antifaz",
      "No cafeína después de las 2 PM",
      "Acuéstate a la misma hora cada noche (±30 min)",
    ],
    duration: "30 min pre-sueño",
    bestFor: "Sueño pobre, fatiga crónica",
  },
];

const OVERALL_SORENESS_OPTIONS = [
  { val: 0, label: "Nada", emoji: "💪", color: "#00D48A" },
  { val: 1, label: "Mínimo", emoji: "🟢", color: "#00D48A" },
  { val: 2, label: "Leve", emoji: "🟡", color: "#F5C842" },
  { val: 3, label: "Moderado", emoji: "🟠", color: "#FFB347" },
  { val: 4, label: "Alto", emoji: "🔴", color: "#FF6B6B" },
  { val: 5, label: "Intenso", emoji: "🔥", color: "#FF4444" },
];

export default function RecoveryScreen() {
  const [tab, setTab] = useState<"soreness" | "protocols">("soreness");
  const [muscleData, setMuscleData] = useState<Record<string, number>>({});
  const [overallSoreness, setOverallSoreness] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedProtocol, setExpandedProtocol] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Record<string, Set<number>>>({});

  // Load today's soreness data
  useEffect(() => {
    const load = async () => {
      try {
        const res = await wellnessAPI.getSorenessToday();
        if (res.data.data) {
          const d = res.data.data;
          setMuscleData(
            typeof d.muscleData === "object" && d.muscleData !== null
              ? (d.muscleData as Record<string, number>)
              : {}
          );
          setOverallSoreness(d.overallSoreness ?? 0);
        }
      } catch {
        // no data yet — fine
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleMuscleChange = (key: string, value: number) => {
    setMuscleData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await wellnessAPI.logSoreness({
        muscleData,
        overallSoreness,
      });
      Alert.alert("Guardado", "Tu registro de soreness se guardó correctamente.");
    } catch (err) {
      console.error("Error saving soreness:", err);
      Alert.alert("Error", "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStep = (protocolId: string, stepIdx: number) => {
    setCheckedSteps((prev) => {
      const set = new Set(prev[protocolId] || []);
      if (set.has(stepIdx)) set.delete(stepIdx);
      else set.add(stepIdx);
      return { ...prev, [protocolId]: set };
    });
  };

  // Recommend protocols based on soreness level
  const getRecommended = (): string[] => {
    if (overallSoreness >= 4) return ["foam_roll", "cold_exposure", "sleep_recovery"];
    if (overallSoreness >= 2) return ["stretch", "active_recovery", "foam_roll"];
    return ["active_recovery", "stretch"];
  };

  const recommended = getRecommended();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center gap-x-3 mb-5">
            <TouchableOpacity
              onPress={() => router.back()}
              className="bg-background-card border border-background-elevated rounded-2xl p-2.5"
            >
              <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-white text-xl font-bold">
                Recovery
              </Text>
              <Text className="text-text-muted text-xs">
                Monitorea tu cuerpo y recupérate mejor
              </Text>
            </View>
          </View>

          {/* Tab switcher */}
          <View className="flex-row bg-background-card border border-background-elevated rounded-2xl p-1 mb-5">
            {(["soreness", "protocols"] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setTab(t)}
                className="flex-1 py-2.5 items-center rounded-xl"
                style={{
                  backgroundColor: tab === t ? "#7B68EE20" : "transparent",
                }}
              >
                <Text
                  className="font-bold text-sm"
                  style={{ color: tab === t ? "#7B68EE" : "#6B6B80" }}
                >
                  {t === "soreness" ? "Soreness" : "Protocolos"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color="#7B68EE" size="large" className="py-12" />
          ) : tab === "soreness" ? (
            <>
              {/* Overall soreness */}
              <Text className="text-white font-bold text-base mb-3">
                Nivel general de dolor muscular
              </Text>
              <View className="flex-row gap-x-1.5 mb-5">
                {OVERALL_SORENESS_OPTIONS.map((opt) => {
                  const active = overallSoreness === opt.val;
                  return (
                    <TouchableOpacity
                      key={opt.val}
                      onPress={() => setOverallSoreness(opt.val)}
                      className="flex-1 items-center py-2.5 rounded-2xl"
                      style={{
                        backgroundColor: active ? `${opt.color}25` : "#252540",
                        borderWidth: active ? 1.5 : 0,
                        borderColor: active ? opt.color : "transparent",
                      }}
                    >
                      <Text className="text-sm mb-0.5">{opt.emoji}</Text>
                      <Text
                        className="text-[9px] font-semibold"
                        style={{ color: active ? opt.color : "#6B6B80" }}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Body map */}
              <Text className="text-white font-bold text-base mb-3">
                Mapa de dolor muscular
              </Text>
              <Text className="text-text-muted text-xs mb-3">
                Toca un músculo para seleccionarlo, luego ajusta el nivel de dolor
              </Text>
              <BodyMap
                muscleData={muscleData}
                onMuscleChange={handleMuscleChange}
                editable={true}
              />

              {/* Save */}
              <TouchableOpacity
                className="rounded-3xl py-4 items-center mt-6"
                style={{ backgroundColor: "#7B68EE" }}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    Guardar registro
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* ─── PROTOCOLS TAB ─────────────────────── */
            <>
              {/* Smart recommendation */}
              {overallSoreness > 0 && (
                <View className="bg-background-card border border-[#7B68EE30] rounded-3xl p-4 mb-4">
                  <View className="flex-row items-center gap-x-2 mb-2">
                    <Ionicons name="sparkles" size={16} color="#7B68EE" />
                    <Text className="text-white font-bold text-sm">
                      Recomendado para ti
                    </Text>
                  </View>
                  <Text className="text-text-muted text-xs">
                    Basado en tu nivel de soreness ({OVERALL_SORENESS_OPTIONS[Math.max(0, Math.min(5, overallSoreness))].label.toLowerCase()}),
                    te recomendamos estos protocolos:
                  </Text>
                </View>
              )}

              {/* Protocol cards */}
              {[...RECOVERY_PROTOCOLS].sort((a, b) => {
                const aRec = recommended.includes(a.id) ? 0 : 1;
                const bRec = recommended.includes(b.id) ? 0 : 1;
                return aRec - bRec;
              }).map((protocol) => {
                const isExpanded = expandedProtocol === protocol.id;
                const isRecommended = recommended.includes(protocol.id);
                const stepsChecked = checkedSteps[protocol.id] || new Set();
                const progress = protocol.steps.length > 0
                  ? (stepsChecked.size / protocol.steps.length) * 100
                  : 0;

                return (
                  <View
                    key={protocol.id}
                    className="bg-background-card border rounded-3xl mb-3 overflow-hidden"
                    style={{
                      borderColor: isRecommended ? `${protocol.color}40` : "#252540",
                    }}
                  >
                    <TouchableOpacity
                      className="p-4 flex-row items-center gap-x-3"
                      onPress={() =>
                        setExpandedProtocol(isExpanded ? null : protocol.id)
                      }
                    >
                      <Text className="text-2xl">{protocol.icon}</Text>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-x-2">
                          <Text className="text-white font-bold text-sm">
                            {protocol.title}
                          </Text>
                          {isRecommended && (
                            <View
                              className="px-1.5 py-0.5 rounded-full"
                              style={{ backgroundColor: `${protocol.color}25` }}
                            >
                              <Text
                                className="text-[9px] font-bold"
                                style={{ color: protocol.color }}
                              >
                                Recomendado
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text className="text-text-muted text-xs mt-0.5">
                          {protocol.duration} · {protocol.bestFor}
                        </Text>
                      </View>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={18}
                        color="#6B6B80"
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View className="px-4 pb-4">
                        <Text className="text-text-secondary text-xs mb-3">
                          {protocol.description}
                        </Text>

                        {/* Progress bar */}
                        {stepsChecked.size > 0 && (
                          <View className="mb-3">
                            <View className="bg-background-elevated rounded-full h-1.5">
                              <View
                                className="rounded-full h-1.5"
                                style={{
                                  backgroundColor: protocol.color,
                                  width: `${progress}%`,
                                }}
                              />
                            </View>
                            <Text className="text-text-muted text-[10px] mt-1">
                              {stepsChecked.size}/{protocol.steps.length} pasos
                            </Text>
                          </View>
                        )}

                        {/* Steps checklist */}
                        {protocol.steps.map((step, idx) => {
                          const checked = stepsChecked.has(idx);
                          return (
                            <TouchableOpacity
                              key={idx}
                              onPress={() => toggleStep(protocol.id, idx)}
                              className="flex-row items-start gap-x-3 py-2"
                            >
                              <View
                                className="w-5 h-5 rounded-md items-center justify-center mt-0.5"
                                style={{
                                  backgroundColor: checked
                                    ? protocol.color
                                    : "#252540",
                                  borderWidth: checked ? 0 : 1,
                                  borderColor: "#6B6B80",
                                }}
                              >
                                {checked && (
                                  <Ionicons
                                    name="checkmark"
                                    size={14}
                                    color="white"
                                  />
                                )}
                              </View>
                              <Text
                                className="text-sm flex-1"
                                style={{
                                  color: checked ? "#6B6B80" : "#A0A0B0",
                                  textDecorationLine: checked
                                    ? "line-through"
                                    : "none",
                                }}
                              >
                                {step}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
