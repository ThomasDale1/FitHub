import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKeyIOS = process.env.GOOGLE_MAPS_API_KEY_IOS || "";
  const googleMapsApiKeyAndroid = process.env.GOOGLE_MAPS_API_KEY_ANDROID || "";

  return {
    name: "Fit Hub",
    slug: "fit-hub",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "fithub",
    userInterfaceStyle: "dark",
    newArchEnabled: true,
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.fithub.app",
      config: {
        googleMapsApiKey: googleMapsApiKeyIOS,
      },
      infoPlist: {
        NSMotionUsageDescription:
          "FitHub necesita acceso al sensor de movimiento para contar tus pasos automáticamente.",
        NSHealthShareUsageDescription:
          "FitHub usa tus datos de salud para mostrar tus pasos, calorías y distancia con la misma precisión que Apple Fitness.",
        NSHealthUpdateUsageDescription:
          "FitHub guarda tu actividad de pasos en Salud para mantener un historial unificado.",
        UIBackgroundModes: ["processing", "remote-notification"],
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      permissions: ["android.permission.ACTIVITY_RECOGNITION"],
      config: {
        googleMaps: {
          apiKey: googleMapsApiKeyAndroid,
        },
      },
      adaptiveIcon: {
        backgroundColor: "#0F0F1A",
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: "com.fithub.app",
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      "expo-router",
      [
        "@kingstinct/react-native-healthkit",
        {
          NSHealthShareUsageDescription:
            "FitHub usa tus datos de salud para mostrar tus pasos, calorías y distancia con la misma precisión que Apple Fitness.",
          NSHealthUpdateUsageDescription:
            "FitHub guarda tu actividad de pasos en Salud para mantener un historial unificado.",
        },
      ],
      "expo-health-connect",
      [
        "expo-build-properties",
        {
          android: {
            compileSdkVersion: 34,
            targetSdkVersion: 34,
            minSdkVersion: 26,
          },
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#0F0F1A",
          dark: {
            backgroundColor: "#0F0F1A",
          },
        },
      ],
      "expo-font",
      "expo-secure-store",
      "expo-web-browser",
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#6C63FF",
          defaultChannel: "default",
          sounds: [],
          enableBackgroundRemoteNotifications: true,
        },
      ],
      "expo-background-task",
      "@react-native-community/datetimepicker",
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "556521cc-0666-4752-91dc-50fdca5e9b30",
      },
    },
    owner: "thomasdale",
  };
};
