// ─────────────────────────────────────────────────────
// mobile/app/ai/_layout.tsx
// Sprint 3B: Layout para rutas de AI
// ─────────────────────────────────────────────────────
import { Stack } from "expo-router";

export default function AiLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="coach" />
    </Stack>
  );
}