import { useCallback } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSSO } from "@clerk/clerk-expo";
import { router } from "expo-router";
import * as AuthSession from "expo-auth-session";

export default function OAuth() {
  const { startSSOFlow } = useSSO();

  const handleGoogleSignIn = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });

      if (createdSessionId) {
        if (setActive) {
          await setActive({ session: createdSessionId });
          router.replace("/(tabs)");
        }
      } else {
        Alert.alert("Error", "No se pudo iniciar sesión con Google");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.errors?.[0]?.longMessage || "Error con Google Sign In"
      );
    }
  }, []);

  return (
    <View className="mt-6">
      {/* Separador */}
      <View className="flex-row items-center gap-x-3 mb-6">
        <View className="flex-1 h-px bg-background-elevated" />
        <Text className="text-text-muted text-sm">o continúa con</Text>
        <View className="flex-1 h-px bg-background-elevated" />
      </View>

      {/* Botón Google */}
      <TouchableOpacity
        onPress={handleGoogleSignIn}
        className="border border-background-elevated rounded-2xl py-4 flex-row items-center justify-center gap-x-3 bg-background-card"
      >
        {/* Google "G" en colores */}
        <Text className="text-xl">G</Text>
        <Text className="text-white font-bold text-base">
          Continuar con Google
        </Text>
      </TouchableOpacity>
    </View>
  );
}