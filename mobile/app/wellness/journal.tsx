// ─────────────────────────────────────────────────────
// mobile/app/wellness/journal.tsx
// Journal — Diario de bienestar con prompts contextuales
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { wellnessAPI } from "@/lib/api";

// ─── Journal types & prompts ─────────────────────────
type JournalType = "FREE" | "GRATITUDE" | "REFLECTION";

interface JournalTypeOption {
  key: JournalType;
  label: string;
  icon: string;
  color: string;
  prompts: string[];
}

const JOURNAL_TYPES: JournalTypeOption[] = [
  {
    key: "FREE",
    label: "Libre",
    icon: "📝",
    color: "#7B68EE",
    prompts: [
      "¿Qué tienes en mente hoy?",
      "¿Cómo fue tu día hasta ahora?",
      "Escribe lo que necesites soltar...",
      "¿Qué es lo más importante para ti hoy?",
    ],
  },
  {
    key: "GRATITUDE",
    label: "Gratitud",
    icon: "🙏",
    color: "#00D48A",
    prompts: [
      "Escribe 3 cosas por las que estás agradecido hoy...",
      "¿Quién te hizo sonreír hoy?",
      "¿Qué momento del día te hizo sentir bien?",
      "¿Qué parte de tu cuerpo agradeces hoy?",
    ],
  },
  {
    key: "REFLECTION",
    label: "Reflexión",
    icon: "🪞",
    color: "#FFB347",
    prompts: [
      "¿Qué aprendiste de tu entrenamiento de hoy?",
      "¿Qué harías diferente mañana?",
      "¿Cómo puedes mejorar tu bienestar esta semana?",
      "¿Qué obstáculo superaste recientemente?",
    ],
  },
];

const MOOD_OPTIONS = [
  { val: 1, emoji: "😣" },
  { val: 2, emoji: "😕" },
  { val: 3, emoji: "😐" },
  { val: 4, emoji: "😊" },
  { val: 5, emoji: "😄" },
];

const TAG_OPTIONS = [
  "entrenamiento", "nutrición", "sueño", "estrés",
  "motivación", "recuperación", "social", "logro",
];

interface JournalEntry {
  id: string;
  content: string;
  type: JournalType;
  mood: number | null;
  tags: string[];
  createdAt: string;
}

export default function JournalScreen() {
  const [tab, setTab] = useState<"write" | "history">("write");
  const [journalType, setJournalType] = useState<JournalTypeOption>(JOURNAL_TYPES[0]);
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // History state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Random prompt
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const prompts = journalType.prompts;
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);
  }, [journalType]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await wellnessAPI.getJournalEntries(30, 20);
      setEntries(res.data.data || []);
    } catch (err) {
      console.error("Error fetching journal history:", err);
      Alert.alert("Error", "No se pudo cargar el historial del diario. Intenta de nuevo.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "history") fetchHistory();
  }, [tab, fetchHistory]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert("Escribe algo", "Tu entrada de diario no puede estar vacía.");
      return;
    }

    setSaving(true);
    try {
      await wellnessAPI.createJournal({
        content: content.trim(),
        type: journalType.key,
        mood: mood ?? undefined,
        tags: selectedTags,
      });
      // Reset form
      setContent("");
      setMood(null);
      setSelectedTags([]);
      // Refresh prompt
      const prompts = journalType.prompts;
      setPrompt(prompts[Math.floor(Math.random() * prompts.length)]);

      Alert.alert("Guardado", "Tu entrada se ha guardado correctamente.", [
        { text: "OK" },
      ]);
    } catch (err) {
      console.error("Error saving journal:", err);
      Alert.alert("Error", "No se pudo guardar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert("Eliminar", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await wellnessAPI.deleteJournal(id);
            setEntries((prev) => prev.filter((e) => e.id !== id));
          } catch {
            Alert.alert("Error", "No se pudo eliminar.");
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
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
                  Diario
                </Text>
                <Text className="text-text-muted text-xs">
                  Escribe, reflexiona, crece
                </Text>
              </View>
            </View>

            {/* Tab switcher */}
            <View className="flex-row bg-background-card border border-background-elevated rounded-2xl p-1 mb-5">
              {(["write", "history"] as const).map((t) => (
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
                    style={{
                      color: tab === t ? "#7B68EE" : "#6B6B80",
                    }}
                  >
                    {t === "write" ? "Escribir" : "Historial"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {tab === "write" ? (
              <>
                {/* Type selector */}
                <View className="flex-row gap-x-2 mb-5">
                  {JOURNAL_TYPES.map((jt) => (
                    <TouchableOpacity
                      key={jt.key}
                      onPress={() => setJournalType(jt)}
                      className="flex-1 items-center py-3 rounded-2xl"
                      style={{
                        backgroundColor:
                          journalType.key === jt.key
                            ? `${jt.color}20`
                            : "#252540",
                        borderWidth: journalType.key === jt.key ? 1.5 : 0,
                        borderColor:
                          journalType.key === jt.key
                            ? jt.color
                            : "transparent",
                      }}
                    >
                      <Text className="text-lg mb-0.5">{jt.icon}</Text>
                      <Text
                        className="text-[11px] font-semibold"
                        style={{
                          color:
                            journalType.key === jt.key
                              ? jt.color
                              : "#6B6B80",
                        }}
                      >
                        {jt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Prompt */}
                <View
                  className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4"
                >
                  <View className="flex-row items-center gap-x-2 mb-1">
                    <Ionicons
                      name="sparkles"
                      size={14}
                      color={journalType.color}
                    />
                    <Text
                      className="text-xs font-bold"
                      style={{ color: journalType.color }}
                    >
                      Prompt
                    </Text>
                  </View>
                  <Text className="text-text-secondary text-sm italic">
                    {prompt}
                  </Text>
                </View>

                {/* Text input */}
                <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
                  <TextInput
                    className="text-white text-base"
                    placeholder="Empieza a escribir..."
                    placeholderTextColor="#6B6B80"
                    multiline
                    numberOfLines={8}
                    textAlignVertical="top"
                    style={{ minHeight: 160 }}
                    value={content}
                    onChangeText={setContent}
                  />
                  <Text className="text-text-muted text-[10px] text-right mt-2">
                    {content.length} caracteres
                  </Text>
                </View>

                {/* Mood */}
                <Text className="text-white font-bold text-base mb-3">
                  ¿Cómo te sientes?
                </Text>
                <View className="flex-row gap-x-2 mb-5">
                  {MOOD_OPTIONS.map((m) => (
                    <TouchableOpacity
                      key={m.val}
                      onPress={() => setMood(mood === m.val ? null : m.val)}
                      className="flex-1 items-center py-2.5 rounded-2xl"
                      style={{
                        backgroundColor:
                          mood === m.val
                            ? `${journalType.color}25`
                            : "#252540",
                        borderWidth: mood === m.val ? 1.5 : 0,
                        borderColor:
                          mood === m.val ? journalType.color : "transparent",
                      }}
                    >
                      <Text className="text-xl">{m.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Tags */}
                <Text className="text-white font-bold text-base mb-3">
                  Etiquetas
                </Text>
                <View className="flex-row flex-wrap gap-2 mb-6">
                  {TAG_OPTIONS.map((tag) => {
                    const active = selectedTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        className="px-3 py-1.5 rounded-full"
                        style={{
                          backgroundColor: active
                            ? `${journalType.color}25`
                            : "#252540",
                          borderWidth: active ? 1 : 0,
                          borderColor: active
                            ? journalType.color
                            : "transparent",
                        }}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{
                            color: active ? journalType.color : "#6B6B80",
                          }}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Save */}
                <TouchableOpacity
                  className="rounded-3xl py-4 items-center"
                  style={{
                    backgroundColor: content.trim()
                      ? journalType.color
                      : "#252540",
                    opacity: content.trim() ? 1 : 0.5,
                  }}
                  onPress={handleSave}
                  disabled={!content.trim() || saving}
                >
                  {saving ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text className="text-white font-bold text-base">
                      Guardar entrada
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              /* ─── HISTORY TAB ────────────────────────── */
              <>
                {loadingHistory && (
                  <ActivityIndicator
                    color="#7B68EE"
                    size="large"
                    className="py-12"
                  />
                )}
                {!loadingHistory && entries.length === 0 && (
                  <View className="items-center py-12">
                    <Text className="text-3xl mb-2">📓</Text>
                    <Text className="text-text-muted text-sm text-center">
                      Aún no tienes entradas.{"\n"}
                      ¡Empieza a escribir tu primera!
                    </Text>
                  </View>
                )}
                {entries.map((entry) => {
                  const typeOpt = JOURNAL_TYPES.find(
                    (jt) => jt.key === entry.type
                  );
                  return (
                    <View
                      key={entry.id}
                      className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-3"
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center gap-x-2">
                          <Text className="text-sm">
                            {typeOpt?.icon || "📝"}
                          </Text>
                          <Text className="text-text-muted text-xs">
                            {formatDate(entry.createdAt)}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-x-2">
                          {entry.mood && (
                            <Text className="text-sm">
                              {MOOD_OPTIONS.find((m) => m.val === entry.mood)
                                ?.emoji || ""}
                            </Text>
                          )}
                          <TouchableOpacity
                            onPress={() => handleDelete(entry.id)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={16}
                              color="#6B6B80"
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text
                        className="text-white text-sm leading-5"
                        numberOfLines={5}
                      >
                        {entry.content}
                      </Text>
                      {entry.tags.length > 0 && (
                        <View className="flex-row flex-wrap gap-1.5 mt-2">
                          {entry.tags.map((tag) => (
                            <View
                              key={tag}
                              className="bg-background-elevated px-2 py-0.5 rounded-full"
                            >
                              <Text className="text-text-muted text-[10px]">
                                {tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
