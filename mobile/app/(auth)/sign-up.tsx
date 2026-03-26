import { useSignUp } from "@clerk/clerk-expo";
import { router } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import Modal from "@/components/Modal";
import InputField from "@/components/InputField";
import CustomButton from "@/components/CustomButton";
import OAuth from "@/components/OAuth";
import { userAPI } from "@/lib/api";

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
  });


  const [verification, setVerification] = useState({
    state: "default", // default | pending | success
    error: "",
    code: "",
  });

  const [loading, setLoading] = useState(false);
  const [usernameError, setUsernameError] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Username validation (debounced) ─────────────────
  const validateUsername = useCallback((value: string) => {
    const clean = value.toLowerCase().replace(/[^a-z0-9._]/g, "");
    setForm(f => ({ ...f, username: clean }));
    setUsernameError("");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (clean.length === 0) return;
    if (clean.length < 3) {
      setUsernameError("Mínimo 3 caracteres");
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setUsernameChecking(true);
        const res = await userAPI.checkUsername(clean);
        if (!res.data.available) {
          setUsernameError(res.data.reason || "Username no disponible");
        }
      } catch {
        // ignore network errors during typing
      } finally {
        setUsernameChecking(false);
      }
    }, 500);
  }, []);

  // PASO 1 — Crear cuenta y enviar código
  const handleSignUp = async () => {
    if (!isLoaded) return;

    // Validate fields
    if (!form.name.trim()) {
      Alert.alert("Error", "Por favor ingresa tu nombre"); return;
    }
    if (!form.username || form.username.length < 3) {
      Alert.alert("Error", "El username debe tener al menos 3 caracteres"); return;
    }
    if (usernameError) {
      Alert.alert("Error", usernameError); return;
    }

    setLoading(true);

    try {
      await signUp.create({
        emailAddress: form.email,
        password: form.password,
        firstName: form.name.trim().split(" ")[0],
        lastName: form.name.trim().split(" ").slice(1).join(" ") || undefined,
        unsafeMetadata: {
          displayName: form.name.trim(),
          username: form.username.toLowerCase().trim(),
        },
      });

      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setVerification({ ...verification, state: "pending" });
    } catch (err: any) {
      Alert.alert("Error", err.errors?.[0]?.longMessage || "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  // PASO 2 — Verificar código del email
  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verification.code,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setVerification({ ...verification, state: "success" });
      } else {
        setVerification({
          ...verification,
          error: "Verificación incompleta",
          state: "pending",
        });
      }
    } catch (err: any) {
      setVerification({
        ...verification,
        error: err.errors?.[0]?.longMessage || "Código incorrecto",
        state: "pending",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <SafeAreaView className="flex-1 px-6 pt-8">

        {/* Header */}
        <Text className="text-white text-3xl font-bold mb-2">
          Crea tu cuenta
        </Text>
        <Text className="text-text-secondary mb-8">
          Únete a la comunidad Fit Hub
        </Text>

        {/* Formulario */}
        <InputField
          label="Nombre"
          placeholder="Tu nombre completo"
          value={form.name}
          onChangeText={(value) => setForm({ ...form, name: value })}
          autoCapitalize="words"
        />
        <View>
          <InputField
            label="Username"
            placeholder="tu_username"
            value={form.username}
            onChangeText={validateUsername}
            autoCapitalize="none"
            autoCorrect={false}
            error={usernameError}
          />
          {usernameChecking && (
            <Text className="text-text-muted text-xs -mt-2 mb-2 ml-1">Verificando...</Text>
          )}
          {!usernameError && !usernameChecking && form.username.length >= 3 && (
            <Text className="text-green-500 text-xs -mt-2 mb-2 ml-1">Disponible</Text>
          )}
        </View>
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
          placeholder="Mínimo 8 caracteres"
          value={form.password}
          onChangeText={(value) => setForm({ ...form, password: value })}
          secureTextEntry
        />

        {/* Botón principal */}
        <CustomButton
          title="Crear cuenta"
          onPress={handleSignUp}
          loading={loading}
          className="mt-2"
        />

        {/* Google OAuth */}
        <OAuth />

        {/* Link a login */}
        <TouchableOpacity
          className="items-center mt-6 py-2"
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text className="text-text-secondary">
            ¿Ya tienes cuenta?{" "}
            <Text className="text-primary font-bold">Inicia sesión</Text>
          </Text>
        </TouchableOpacity>

      </SafeAreaView>

      {/* Modal verificación de código */}
      <Modal
        isVisible={verification.state === "pending"}
        avoidKeyboard
        onModalHide={() => {
          if (verification.state === "success") {
            router.replace("/(onboarding)/personal-info" as any);
          }
        }}
      >
        <View className="bg-background-card px-7 py-9 rounded-3xl">
          <Text className="text-white text-2xl font-bold mb-2">
            Verifica tu email
          </Text>
          <Text className="text-text-secondary mb-6">
            Enviamos un código a {form.email}
          </Text>

          <InputField
            label="Código de verificación"
            placeholder="000000"
            value={verification.code}
            onChangeText={(code) =>
              setVerification({ ...verification, code })
            }
            keyboardType="number-pad"
            maxLength={6}
            error={verification.error}
          />

          <CustomButton
            title="Verificar email"
            onPress={handleVerify}
            loading={loading}
            className="mt-2"
          />
        </View>
      </Modal>

      {/* Modal éxito */}
      <Modal
        isVisible={verification.state === "success"}
      >
        <View className="bg-background-card px-7 py-9 rounded-3xl items-center">
          <Text className="text-6xl mb-4">🎉</Text>
          <Text className="text-white text-3xl font-bold text-center">
            ¡Verificado!
          </Text>
          <Text className="text-text-secondary text-base text-center mt-2 mb-6">
            Tu cuenta ha sido creada exitosamente.
          </Text>
          <CustomButton
            title="¡Personalizar mi experiencia!"
            onPress={() => router.replace("/(onboarding)/personal-info" as any)}
            className="w-full"
          />
        </View>
      </Modal>

    </ScrollView>
  );
}
