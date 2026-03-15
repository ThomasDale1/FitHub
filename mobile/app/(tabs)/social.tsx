import { View, Text } from "react-native";

export default function SocialScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <Text className="text-4xl">👥</Text>
      <Text className="text-white text-xl font-bold mt-4">Social</Text>
      <Text className="text-text-secondary mt-2">Próximamente</Text>
    </View>
  );
}