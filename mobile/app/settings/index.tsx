// ─────────────────────────────────────────────────────
// mobile/app/settings/index.tsx
// Sprint 5B: Settings screen
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { router } from "expo-router";
import { userAPI, nutritionAPI, setAuthToken } from "@/lib/api";

// ─── Settings Row ────────────────────────────────────
function SettingsRow({
  icon,
  label,
  value,
  onPress,
  color,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  color?: string;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-4 border-b border-background-elevated"
      onPress={onPress}
      disabled={!onPress}
    >
      <Ionicons
        name={icon}
        size={20}
        color={danger ? "#FF6B6B" : color || "#A0A0B0"}
      />
      <Text
        className={`flex-1 ml-3 text-sm ${
          danger ? "text-red-400" : "text-white"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-text-secondary text-sm mr-2">{value}</Text>
      )}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color="#6B6B80" />
      )}
    </TouchableOpacity>
  );
}

// ─── Toggle Row ──────────────────────────────────────
function ToggleRow({
  icon,
  label,
  value,
  onToggle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  return (
    <View className="flex-row items-center py-4 border-b border-background-elevated">
      <Ionicons name={icon} size={20} color="#A0A0B0" />
      <Text className="flex-1 ml-3 text-white text-sm">{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: "#252540", true: "#6C63FF" }}
        thumbColor="white"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// SETTINGS SCREEN
// ═══════════════════════════════════════════════════════
export default function SettingsScreen() {
  const { signOut, getToken } = useAuth();
  const [autoShare, setAutoShare] = useState(true);
  const [publicProfile, setPublicProfile] = useState(true);
  const [showNutritionGoals, setShowNutritionGoals] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nutrition goals state
  const [calorieGoal, setCalorieGoal] = useState("2000");
  const [proteinGoal, setProteinGoal] = useState("150");
  const [carbsGoal, setCarbsGoal] = useState("250");
  const [fatGoal, setFatGoal] = useState("65");

  // Load current goals
  useEffect(() => {
    const load = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const res = await userAPI.getProfile();
        const u = res.data;
        if (u.calorieGoal) setCalorieGoal(String(u.calorieGoal));
        if (u.proteinGoal) setProteinGoal(String(u.proteinGoal));
        if (u.carbsGoal) setCarbsGoal(String(u.carbsGoal));
        if (u.fatGoal) setFatGoal(String(u.fatGoal));
      } catch {}
    };
    load();
  }, [getToken]);

  const handleSaveNutritionGoals = async () => {
    setSaving(true);
    try {
      const token = await getToken();
      setAuthToken(token);
      await nutritionAPI.updateGoals({
        calorieGoal: parseInt(calorieGoal) || 2000,
        proteinGoal: parseFloat(proteinGoal) || 150,
        carbsGoal: parseFloat(carbsGoal) || 250,
        fatGoal: parseFloat(fatGoal) || 65,
      });
      Alert.alert("Guardado", "Tus metas de nutrición se actualizaron");
      setShowNutritionGoals(false);
    } catch {
      Alert.alert("Error", "No se pudieron guardar las metas");
    }
    setSaving(false);
  };

  const handleSignOut = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Eliminar cuenta",
      "Esta acción es irreversible. Se borrarán todos tus datos, workouts, y progreso.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Sí, eliminar",
          style: "destructive",
          onPress: () => {
            Alert.alert("Contacto", "Envía un email a soporte@fithub.app para eliminar tu cuenta.");
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-5 pt-4 pb-8">
          {/* Header */}
          <View className="flex-row items-center gap-x-3 mb-6">
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#A0A0B0" />
            </TouchableOpacity>
            <Text className="text-white text-2xl font-bold">Settings</Text>
          </View>

          {/* ─── PERFIL ─────────────────────────────── */}
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2 mt-2">
            Perfil
          </Text>
          <View className="bg-background-card border border-background-elevated rounded-3xl px-4">
            <SettingsRow
              icon="person-outline"
              label="Editar perfil"
              onPress={() => router.push("/(tabs)/profile")}
            />
            <ToggleRow
              icon="eye-outline"
              label="Perfil público"
              value={publicProfile}
              onToggle={setPublicProfile}
            />
            <ToggleRow
              icon="share-social-outline"
              label="Auto-compartir workouts"
              value={autoShare}
              onToggle={setAutoShare}
            />
          </View>

          {/* ─── NUTRICIÓN ──────────────────────────── */}
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2 mt-6">
            Nutrición
          </Text>
          <View className="bg-background-card border border-background-elevated rounded-3xl px-4">
            <SettingsRow
              icon="nutrition-outline"
              label="Metas de macros"
              value={`${calorieGoal} kcal`}
              onPress={() => setShowNutritionGoals(!showNutritionGoals)}
            />
          </View>

          {/* Nutrition goals editor */}
          {showNutritionGoals && (
            <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mt-2">
              <View className="flex-row gap-x-2 mb-3">
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs mb-1">Calorías</Text>
                  <TextInput
                    className="bg-background-elevated text-white rounded-xl px-3 py-2 text-center"
                    value={calorieGoal}
                    onChangeText={setCalorieGoal}
                    keyboardType="number-pad"
                    placeholderTextColor="#6B6B80"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs mb-1">Proteína (g)</Text>
                  <TextInput
                    className="bg-background-elevated text-white rounded-xl px-3 py-2 text-center"
                    value={proteinGoal}
                    onChangeText={setProteinGoal}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#6B6B80"
                  />
                </View>
              </View>
              <View className="flex-row gap-x-2 mb-3">
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs mb-1">Carbos (g)</Text>
                  <TextInput
                    className="bg-background-elevated text-white rounded-xl px-3 py-2 text-center"
                    value={carbsGoal}
                    onChangeText={setCarbsGoal}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#6B6B80"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-text-secondary text-xs mb-1">Grasa (g)</Text>
                  <TextInput
                    className="bg-background-elevated text-white rounded-xl px-3 py-2 text-center"
                    value={fatGoal}
                    onChangeText={setFatGoal}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#6B6B80"
                  />
                </View>
              </View>
              <TouchableOpacity
                className="bg-primary rounded-xl py-3 items-center"
                onPress={handleSaveNutritionGoals}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text className="text-white font-bold">Guardar metas</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ─── APP ────────────────────────────────── */}
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2 mt-6">
            App
          </Text>
          <View className="bg-background-card border border-background-elevated rounded-3xl px-4">
            <SettingsRow
              icon="sparkles-outline"
              label="AI Coach"
              onPress={() => router.push("/ai/coach")}
            />
            <SettingsRow
              icon="trophy-outline"
              label="Mis logros"
              value="Ver todos"
              onPress={() => {
                Alert.alert("Logros", "Visita tu perfil para ver todos tus logros y badges.");
              }}
            />
            <SettingsRow
              icon="help-circle-outline"
              label="Ayuda y soporte"
              onPress={() => {
                Alert.alert("Soporte", "Escríbenos a soporte@fithub.app");
              }}
            />
          </View>

          {/* ─── ABOUT ──────────────────────────────── */}
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2 mt-6">
            Acerca de
          </Text>
          <View className="bg-background-card border border-background-elevated rounded-3xl px-4">
            <SettingsRow
              icon="information-circle-outline"
              label="Versión"
              value="1.0.0 (Sprint 5)"
            />
            <SettingsRow
              icon="document-text-outline"
              label="Términos de servicio"
              onPress={() => {}}
            />
            <SettingsRow
              icon="shield-checkmark-outline"
              label="Política de privacidad"
              onPress={() => {}}
            />
          </View>

          {/* ─── DANGER ZONE ────────────────────────── */}
          <Text className="text-text-muted text-xs uppercase tracking-wider mb-2 mt-6">
            Cuenta
          </Text>
          <View className="bg-background-card border border-background-elevated rounded-3xl px-4">
            <SettingsRow
              icon="log-out-outline"
              label="Cerrar sesión"
              onPress={handleSignOut}
              danger
            />
            <SettingsRow
              icon="trash-outline"
              label="Eliminar cuenta"
              onPress={handleDeleteAccount}
              danger
            />
          </View>

          <Text className="text-text-muted text-xs text-center mt-8">
            Fit Hub — Made in El Salvador 🇸🇻
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}