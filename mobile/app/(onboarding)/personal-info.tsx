import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { onboardingAPI } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

const GENDERS = [
  { value: "male", label: "Masculino", icon: "male" },
  { value: "female", label: "Femenino", icon: "female" },
  { value: "other", label: "Otro", icon: "person" },
  { value: "prefer_not_to_say", label: "Prefiero no decir", icon: "eye-off" },
] as const;

const PROGRESS_STEP = 1;
const TOTAL_STEPS = 7;

export default function PersonalInfoScreen() {
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [weight, setWeight] = useState("70");
  const [height, setHeight] = useState("170");
  const [bodyFat, setBodyFat] = useState("");
  const [showBodyFat, setShowBodyFat] = useState(true);
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current;
  const slideAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(20))
  ).current;

  useEffect(() => {
    fadeAnims.forEach((anim, i) => {
      Animated.parallel([
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: i * 100,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnims[i], {
          toValue: 0,
          duration: 400,
          delay: i * 100,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, []);

  const isValid = dateOfBirth && gender && weight && height;

  const handleNext = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await onboardingAPI.savePersonalInfo({
        dateOfBirth: dateOfBirth!.toISOString(),
        gender: gender!,
        weight: parseFloat(weight),
        height: parseFloat(height),
        bodyFat: bodyFat ? parseFloat(bodyFat) : undefined,
      });
      router.push("/(onboarding)/goals" as any);
    } catch (e) {
      console.error("Error saving personal info:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

  const animatedItem = (index: number, children: React.ReactNode) => (
    <Animated.View
      style={{
        opacity: fadeAnims[index],
        transform: [{ translateY: slideAnims[index] }],
      }}
    >
      {children}
    </Animated.View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      {animatedItem(
        0,
        <View className="px-6 pt-4 pb-2">
          <View className="flex-row items-center mb-2">
            <Text className="text-text-muted text-xs">
              {PROGRESS_STEP} de {TOTAL_STEPS}
            </Text>
          </View>
          <View className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }}
            />
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        {animatedItem(
          1,
          <View className="mt-4 mb-6">
            <Text className="text-white text-3xl font-bold">
              Cuéntanos sobre ti
            </Text>
            <Text className="text-text-secondary mt-2 text-base">
              Esto nos ayuda a personalizar tu experiencia
            </Text>
          </View>
        )}

        {/* Date of Birth */}
        {animatedItem(
          2,
          <View className="mb-5">
            <Text className="text-text-secondary text-sm mb-2 font-medium">
              Fecha de nacimiento
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="bg-background-card border border-background-elevated rounded-2xl px-4 py-4 flex-row items-center justify-between"
            >
              <Text
                className={dateOfBirth ? "text-white" : "text-text-muted"}
              >
                {dateOfBirth ? formatDate(dateOfBirth) : "Selecciona tu fecha"}
              </Text>
              <Ionicons name="calendar-outline" size={20} color="#A0A0B0" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={dateOfBirth || new Date(2000, 0, 1)}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                minimumDate={new Date(1940, 0, 1)}
                themeVariant="dark"
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (date) setDateOfBirth(date);
                }}
              />
            )}
          </View>
        )}

        {/* Gender */}
        {animatedItem(
          3,
          <View className="mb-5">
            <Text className="text-text-secondary text-sm mb-3 font-medium">
              Género
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => setGender(g.value)}
                  className={`flex-row items-center px-4 py-3 rounded-xl border ${
                    gender === g.value
                      ? "border-primary bg-primary/10"
                      : "border-background-elevated bg-background-card"
                  }`}
                >
                  <Ionicons
                    name={g.icon as any}
                    size={16}
                    color={gender === g.value ? "#6C63FF" : "#A0A0B0"}
                  />
                  <Text
                    className={`ml-2 font-medium ${
                      gender === g.value ? "text-primary" : "text-text-secondary"
                    }`}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Weight & Height */}
        {animatedItem(
          4,
          <View className="flex-row gap-4 mb-5">
            <View className="flex-1">
              <Text className="text-text-secondary text-sm mb-2 font-medium">
                Peso (kg)
              </Text>
              <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4">
                <TextInput
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="numeric"
                  className="flex-1 text-white py-4 text-lg font-bold"
                  placeholderTextColor="#6B6B80"
                  maxLength={5}
                />
                <Text className="text-text-muted text-sm">kg</Text>
              </View>
            </View>
            <View className="flex-1">
              <Text className="text-text-secondary text-sm mb-2 font-medium">
                Altura (cm)
              </Text>
              <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4">
                <TextInput
                  value={height}
                  onChangeText={setHeight}
                  keyboardType="numeric"
                  className="flex-1 text-white py-4 text-lg font-bold"
                  placeholderTextColor="#6B6B80"
                  maxLength={3}
                />
                <Text className="text-text-muted text-sm">cm</Text>
              </View>
            </View>
          </View>
        )}

        {/* Body Fat */}
        {animatedItem(
          5,
          <View className="mb-8">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-text-secondary text-sm font-medium">
                Grasa corporal (%)
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowBodyFat(!showBodyFat);
                  if (showBodyFat) setBodyFat("");
                }}
              >
                <Text className="text-text-muted text-xs">
                  {showBodyFat ? "No lo sé" : "Agregar"}
                </Text>
              </TouchableOpacity>
            </View>
            {showBodyFat && (
              <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4">
                <TextInput
                  value={bodyFat}
                  onChangeText={setBodyFat}
                  keyboardType="numeric"
                  placeholder="Ej: 18"
                  className="flex-1 text-white py-4 text-lg font-bold"
                  placeholderTextColor="#6B6B80"
                  maxLength={4}
                />
                <Text className="text-text-muted text-sm">%</Text>
              </View>
            )}
          </View>
        )}

        <View className="h-24" />
      </ScrollView>

      {/* Bottom button */}
      <View className="px-6 pb-6 pt-2 bg-background">
        <CustomButton
          title="Siguiente"
          onPress={handleNext}
          loading={loading}
          disabled={!isValid}
        />
      </View>
    </SafeAreaView>
  );
}
