// ─────────────────────────────────────────────────────
// mobile/app/ai/coach.tsx
// Sprint 3B: AI Coach — Chat screen
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback, useRef } from "react";
import { router } from "expo-router";
import { aiAPI, type AiMessage } from "@/lib/api";

// ─── Quick Action Button ─────────────────────────────
function QuickAction({
  icon,
  label,
  onPress,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  color: string;
}) {
  return (
    <TouchableOpacity
      className="bg-background-card border border-background-elevated rounded-2xl px-4 py-3 flex-row items-center gap-x-2"
      onPress={onPress}
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text className="text-text-secondary text-sm">{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Chat Bubble ─────────────────────────────────────
function ChatBubble({
  message,
}: {
  message: AiMessage;
}) {
  const isUser = message.role === "user";

  return (
    <View
      className={`mb-3 max-w-[85%] ${isUser ? "self-end" : "self-start"}`}
    >
      {!isUser && (
        <View className="flex-row items-center gap-x-2 mb-1">
          <View className="bg-primary/20 rounded-full p-1">
            <Ionicons name="sparkles" size={12} color="#6C63FF" />
          </View>
          <Text className="text-text-muted text-xs">AI Coach</Text>
        </View>
      )}
      <View
        className={`rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary rounded-br-sm"
            : "bg-background-card border border-background-elevated rounded-bl-sm"
        }`}
      >
        <Text
          className={`text-sm leading-5 ${
            isUser ? "text-white" : "text-text-secondary"
          }`}
        >
          {message.content}
        </Text>
      </View>
      <Text
        className={`text-text-muted text-xs mt-1 ${
          isUser ? "text-right" : "text-left"
        }`}
      >
        {new Date(message.createdAt).toLocaleTimeString("es", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// AI COACH SCREEN
// ═══════════════════════════════════════════════════════
export default function AiCoachScreen() {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  // Cargar historial
  const loadHistory = useCallback(async () => {
    try {
      const response = await aiAPI.getHistory();
      setMessages(response.data.messages);
    } catch (err) {
      console.error("Error loading AI history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Scroll al fondo cuando hay nuevos mensajes
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Enviar mensaje
  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || sending) return;

    // Agregar mensaje del usuario localmente
    const userMsg: AiMessage = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: messageText,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const response = await aiAPI.chat(messageText);

      // Agregar respuesta de la IA
      const aiMsg: AiMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: response.data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      console.error("AI Chat error:", err);
      const errorMsg: AiMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "Lo siento, no pude procesar tu mensaje. Intenta de nuevo.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  // Quick actions
  const handleQuickAction = async (type: string) => {
    if (sending) return;

    const labels: Record<string, string> = {
      workout_suggestion: "¿Qué debería entrenar hoy?",
      nutrition_tip: "Analiza mi nutrición de hoy",
      motivation: "Dame motivación",
      recovery: "¿Necesito descansar?",
    };

    const userMsg: AiMessage = {
      id: `temp_${Date.now()}`,
      role: "user",
      content: labels[type] || type,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const response = await aiAPI.quick(type as any);
      const aiMsg: AiMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: response.data.message,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg: AiMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "Error al obtener respuesta. Intenta de nuevo.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  };

  const handleClearHistory = () => {
    Alert.alert("Borrar historial", "¿Estás seguro? Se borrará toda la conversación.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          try {
            await aiAPI.clearHistory();
            setMessages([]);
          } catch (err) {
            Alert.alert("Error", "No se pudo borrar el historial");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ─── HEADER ─────────────────────────────── */}
        <View className="px-5 pt-4 pb-3 flex-row justify-between items-center border-b border-background-elevated">
          <View className="flex-row items-center gap-x-3">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#A0A0B0" />
            </TouchableOpacity>
            <View className="flex-row items-center gap-x-2">
              <View className="bg-primary/20 rounded-full p-2">
                <Ionicons name="sparkles" size={20} color="#6C63FF" />
              </View>
              <View>
                <Text className="text-white font-bold text-lg">AI Coach</Text>
                <Text className="text-text-muted text-xs">
                  {sending ? "Pensando..." : "Conectado"}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity onPress={handleClearHistory}>
            <Ionicons name="trash-outline" size={20} color="#6B6B80" />
          </TouchableOpacity>
        </View>

        {/* ─── MESSAGES ───────────────────────────── */}
        <ScrollView
          ref={scrollRef}
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color="#6C63FF" size="large" className="mt-20" />
          ) : messages.length === 0 ? (
            /* Empty state */
            <View className="items-center mt-10 px-4">
              <View className="bg-primary/10 rounded-3xl p-6 mb-4">
                <Ionicons name="sparkles" size={40} color="#6C63FF" />
              </View>
              <Text className="text-white font-bold text-xl text-center mb-2">
                Tu coach personal con IA
              </Text>
              <Text className="text-text-secondary text-sm text-center mb-6">
                Conoce tu historial de entrenamientos, PRs y nutrición.
                Pregúntame lo que quieras.
              </Text>

              {/* Quick actions */}
              <View className="gap-y-2 w-full">
                <QuickAction
                  icon="barbell-outline"
                  label="¿Qué debería entrenar hoy?"
                  onPress={() => handleQuickAction("workout_suggestion")}
                  color="#6C63FF"
                />
                <QuickAction
                  icon="nutrition-outline"
                  label="Analiza mi nutrición"
                  onPress={() => handleQuickAction("nutrition_tip")}
                  color="#00D48A"
                />
                <QuickAction
                  icon="flash-outline"
                  label="Dame motivación"
                  onPress={() => handleQuickAction("motivation")}
                  color="#F59E0B"
                />
                <QuickAction
                  icon="bed-outline"
                  label="¿Necesito descansar?"
                  onPress={() => handleQuickAction("recovery")}
                  color="#FF6B35"
                />
              </View>
            </View>
          ) : (
            /* Chat messages */
            <>
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <View className="self-start mb-3">
                  <View className="flex-row items-center gap-x-2 mb-1">
                    <View className="bg-primary/20 rounded-full p-1">
                      <Ionicons name="sparkles" size={12} color="#6C63FF" />
                    </View>
                    <Text className="text-text-muted text-xs">AI Coach</Text>
                  </View>
                  <View className="bg-background-card border border-background-elevated rounded-2xl rounded-bl-sm px-4 py-3">
                    <ActivityIndicator color="#6C63FF" size="small" />
                  </View>
                </View>
              )}
              <View className="h-4" />
            </>
          )}
        </ScrollView>

        {/* ─── INPUT BAR ──────────────────────────── */}
        <View className="px-5 py-3 border-t border-background-elevated">
          {/* Quick action chips (si hay mensajes) */}
          {messages.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2"
              contentContainerStyle={{ gap: 8 }}
            >
              <TouchableOpacity
                className="bg-background-elevated rounded-full px-3 py-1.5"
                onPress={() => handleQuickAction("workout_suggestion")}
              >
                <Text className="text-text-secondary text-xs">💪 ¿Qué entreno?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-background-elevated rounded-full px-3 py-1.5"
                onPress={() => handleQuickAction("nutrition_tip")}
              >
                <Text className="text-text-secondary text-xs">🥗 Mi nutrición</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-background-elevated rounded-full px-3 py-1.5"
                onPress={() => handleQuickAction("motivation")}
              >
                <Text className="text-text-secondary text-xs">🔥 Motivación</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-background-elevated rounded-full px-3 py-1.5"
                onPress={() => handleQuickAction("recovery")}
              >
                <Text className="text-text-secondary text-xs">😴 ¿Descanso?</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Text input */}
          <View className="flex-row items-end gap-x-2">
            <TextInput
              className="flex-1 bg-background-card border border-background-elevated text-white rounded-2xl px-4 py-3 text-base max-h-24"
              value={input}
              onChangeText={setInput}
              placeholder="Pregúntale a tu coach..."
              placeholderTextColor="#6B6B80"
              multiline
              editable={!sending}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            <TouchableOpacity
              className={`rounded-2xl p-3 ${
                input.trim() && !sending ? "bg-primary" : "bg-background-elevated"
              }`}
              onPress={() => handleSend()}
              disabled={!input.trim() || sending}
            >
              <Ionicons
                name="send"
                size={20}
                color={input.trim() && !sending ? "white" : "#6B6B80"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}