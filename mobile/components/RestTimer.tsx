import { useEffect, useState, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface RestTimerProps {
  seconds: number;          // duración del timer
  onComplete: () => void;   // callback cuando termina
  onDismiss: () => void;    // callback para cerrar
}

export default function RestTimer({
  seconds,
  onComplete,
  onDismiss,
}: RestTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isRunning, setIsRunning] = useState(true);
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Animación de progreso circular
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: seconds * 1000,
      useNativeDriver: false,
    }).start();
  }, []);

  // Countdown
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          // Vibración cuando termina
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
          onComplete();
          return 0;
        }
        // Vibración a los últimos 3 segundos
        if (prev <= 4) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const addTime = (extra: number) => {
    setTimeLeft((prev) => prev + extra);
  };

  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-6 mx-5 items-center">

      {/* Header */}
      <View className="flex-row justify-between items-center w-full mb-4">
        <Text className="text-text-secondary text-sm font-semibold">
          DESCANSO
        </Text>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={20} color="#6B6B80" />
        </TouchableOpacity>
      </View>

      {/* Timer */}
      <Text className="text-white text-6xl font-bold my-4">
        {formatTime(timeLeft)}
      </Text>

      {/* Barra de progreso */}
      <View className="w-full h-2 bg-background-elevated rounded-full mb-6 overflow-hidden">
        <Animated.View
          className="h-full bg-primary rounded-full"
          style={{
            width: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          }}
        />
      </View>

      {/* Botones de control */}
      <View className="flex-row gap-x-3 w-full">
        <TouchableOpacity
          onPress={() => addTime(15)}
          className="flex-1 bg-background-elevated rounded-2xl py-3 items-center"
        >
          <Text className="text-text-secondary font-bold">+15s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => addTime(30)}
          className="flex-1 bg-background-elevated rounded-2xl py-3 items-center"
        >
          <Text className="text-text-secondary font-bold">+30s</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDismiss}
          className="flex-1 bg-primary rounded-2xl py-3 items-center"
        >
          <Text className="text-white font-bold">Saltar</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}