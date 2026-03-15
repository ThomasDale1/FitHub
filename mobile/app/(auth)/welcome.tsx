import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-swiper";
import { onboarding } from "@/constants";
import CustomButton from "@/components/CustomButton";

export default function WelcomeScreen() {
  const swiperRef = useRef<Swiper>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastSlide = activeIndex === onboarding.length - 1;

  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-between">

      {/* Botón Skip */}
      <TouchableOpacity
        className="w-full flex items-end px-6 py-2"
        onPress={() => router.replace("/(auth)/sign-up")}
      >
        <Text className="text-text-secondary font-bold">Saltar</Text>
      </TouchableOpacity>

      {/* Carrusel */}
      <Swiper
        ref={swiperRef}
        loop={false}
        onIndexChanged={(index) => setActiveIndex(index)}
        dot={
          <View className="w-8 h-1 mx-1 bg-background-elevated rounded-full" />
        }
        activeDot={
          <View className="w-8 h-1 mx-1 bg-primary rounded-full" />
        }
        paginationStyle={{ bottom: 20 }}
      >
        {onboarding.map((item) => (
          <View
            key={item.id}
            className="flex-1 items-center justify-center px-6"
          >
            {/* Imagen */}
            <Image
              source={item.image}
              className="w-full h-72"
              resizeMode="contain"
            />

            {/* Título */}
            <Text className="text-white text-3xl font-bold text-center mt-10 mx-6">
              {item.title}
            </Text>

            {/* Descripción */}
            <Text className="text-text-secondary text-base text-center mx-6 mt-4 leading-6">
              {item.description}
            </Text>
          </View>
        ))}
      </Swiper>

      {/* Botón siguiente / empezar */}
      <View className="w-full px-6 pb-8">
        <CustomButton
          title={isLastSlide ? "¡Empezar gratis!" : "Siguiente"}
          onPress={() =>
            isLastSlide
              ? router.replace("/(auth)/sign-up")
              : swiperRef.current?.scrollBy(1)
          }
        />

        {/* Ya tengo cuenta */}
        <TouchableOpacity
          className="items-center mt-4 py-2"
          onPress={() => router.push("/(auth)/sign-in")}
        >
          <Text className="text-text-secondary">
            ¿Ya tienes cuenta?{" "}
            <Text className="text-primary font-bold">Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}