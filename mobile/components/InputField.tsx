import {
  View,
  Text,
  TextInput,
  TextInputProps,
} from "react-native";

interface InputFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export default function InputField({
  label,
  error,
  ...props
}: InputFieldProps) {
  return (
    <View className="mb-4">
      <Text className="text-text-secondary text-sm mb-2 font-medium">
        {label}
      </Text>
      <TextInput
        className={`bg-background-card border rounded-2xl px-4 py-4 text-white ${
          error ? "border-red-500" : "border-background-elevated"
        }`}
        placeholderTextColor="#6B6B80"
        {...props}
      />
      {error && (
        <Text className="text-red-500 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}