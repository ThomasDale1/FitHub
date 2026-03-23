import { useEffect } from "react";
import { Stack } from "expo-router";
import { useAuth } from "@clerk/clerk-expo";
import { setGetTokenFn } from "@/lib/api";

export default function OnboardingLayout() {
  const { getToken } = useAuth();

  useEffect(() => {
    setGetTokenFn(getToken);
  }, [getToken]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="personal-info" />
      <Stack.Screen name="goals" />
      <Stack.Screen name="hobbies" />
      <Stack.Screen name="experience" />
      <Stack.Screen name="location" />
      <Stack.Screen name="connect" />
      <Stack.Screen name="first-challenge" />
    </Stack>
  );
}
