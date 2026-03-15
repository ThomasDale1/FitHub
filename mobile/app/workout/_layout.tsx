import { Stack } from "expo-router";

export default function WorkoutLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="active" />
      <Stack.Screen
        name="exercise-picker"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen name="summary" />
    </Stack>
  );
}