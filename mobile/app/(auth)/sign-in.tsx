import { useSignIn } from "@clerk/clerk-expo";
import { router } from "expo-router";
import {
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useCallback, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import OAuth from "@/components/OAuth";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    if (!isLoaded) return;
    setLoading(true);

    try {
      const result = await signIn.create({
        identifier: form.email,
        password: form.password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Error", "No se pudo completar el inicio de sesión");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.errors?.[0]?.longMessage || "Error al iniciar sesión"
      );
    } finally {
      setLoading(false);
    }
  }, [isLoaded, signIn, setActive, form.email, form.password]);

  return (
    <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <SafeAreaView className="flex-1 px-6 pt-8">

        {/* Header */}
        <Text className="text-white text-3xl font-bold mb-2">
          Bienvenido de vuelta
        </Text>
        <Text className="text-text-secondary mb-8">
          Ingresa a tu cuenta de Fit Hub
        </Text>

        {/* Formulario */}
        <InputField
          label="Email"
          placeholder="tu@email.com"
          value={form.email}
          onChangeText={(value) => setForm({ ...form, email: value })}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <InputField
          label="Contraseña"
          placeholder="Tu contraseña"
          value={form.password}
          onChangeText={(value) => setForm({ ...form, password: value })}
          secureTextEntry
        />

        {/* Botón principal */}
        <CustomButton
          title="Iniciar sesión"
          onPress={handleSignIn}
          loading={loading}
          className="mt-2"
        />

        {/* Google OAuth */}
        <OAuth />

        {/* Link a registro */}
        <TouchableOpacity
          className="items-center mt-6 py-2"
          onPress={() => router.push("/(auth)/sign-up")}
        >
          <Text className="text-text-secondary">
            ¿No tienes cuenta?{" "}
            <Text className="text-primary font-bold">Regístrate</Text>
          </Text>
        </TouchableOpacity>

      </SafeAreaView>
    </ScrollView>
  );
}