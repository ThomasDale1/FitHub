import { Stack } from "expo-router"

export default function GuildLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[guildId]" />
      <Stack.Screen name="create" />
      <Stack.Screen name="war" />
    </Stack>
  )
}
