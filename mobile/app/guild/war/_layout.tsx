import { Stack } from "expo-router"

export default function WarLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="challenge" />
      <Stack.Screen name="[warId]" />
    </Stack>
  )
}
