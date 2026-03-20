import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@clerk/clerk-expo";
import { useEffect, useState, useCallback } from "react";
import { setGetTokenFn, socialAPI } from "@/lib/api";
import { useNotifications } from "@/hooks/useNotifications";
import { initStepTracking } from "@/lib/stepTracker";
import { registerBackgroundNotificationHandler } from "@/lib/notifications";
import { View, Text } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function SocialTabIcon({ color, size }: { color: string; size: number }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      socialAPI.getNotifications().then((res) => {
        setUnreadCount(res.data.unreadCount || 0);
      }).catch(() => {});
    }, [])
  );

  // Also poll every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      socialAPI.getNotifications().then((res) => {
        setUnreadCount(res.data.unreadCount || 0);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View>
      <Ionicons name="people" size={size} color={color} />
      {unreadCount > 0 ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -8,
            backgroundColor: "#FF4757",
            borderRadius: 8,
            minWidth: 16,
            height: 16,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: "#FFF", fontSize: 9, fontWeight: "800" }}>
            {unreadCount > 99 ? "99+" : String(unreadCount)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { getToken } = useAuth();

  // Configurar el token function una sola vez
  useEffect(() => {
    setGetTokenFn(getToken);
    // Init step tracking y background notifications DESPUÉS de auth
    initStepTracking();
    registerBackgroundNotificationHandler();
  }, [getToken]);

  // Initialize push notifications
  useNotifications();

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
            <SocialTabIcon color={color} size={size} />
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