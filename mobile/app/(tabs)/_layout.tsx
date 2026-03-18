import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect } from "react";
import { setGetTokenFn } from "@/lib/api";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  const { getToken } = useAuth();

  // Configurar el token function una sola vez
  useEffect(() => {
    setGetTokenFn(getToken);
  }, [getToken]);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#1A1A2E",
          borderTopColor: "#252540",
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#6C63FF",
        tabBarInactiveTintColor: "#6B6B80",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: "Workout",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="barbell" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="steps"
        options={{
          title: "Pasos",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="footsteps" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Social",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
      {/* Nutrición se oculta del tab bar pero sigue accesible por ruta */}
      <Tabs.Screen
        name="nutrition"
        options={{
          href: null, // oculta del tab bar
        }}
      />
    </Tabs>
  );
}