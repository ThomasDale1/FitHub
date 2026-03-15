import { TouchableOpacity, Text, ActivityIndicator } from "react-native";

interface CustomButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function CustomButton({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  className = "",
}: CustomButtonProps) {
  const baseStyles = "rounded-2xl py-4 items-center justify-center";

  const variants = {
    primary: "bg-primary",
    outline: "border border-primary bg-transparent",
    ghost: "bg-transparent",
  };

  const textVariants = {
    primary: "text-white font-bold text-lg",
    outline: "text-primary font-bold text-lg",
    ghost: "text-text-secondary font-bold text-lg",
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={`${baseStyles} ${variants[variant]} ${
        disabled ? "opacity-50" : ""
      } ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "white" : "#6C63FF"} />
      ) : (
        <Text className={textVariants[variant]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}