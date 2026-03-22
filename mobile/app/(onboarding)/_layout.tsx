import { Stack } from "expo-router";

export default function OnboardingLayout() {
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
