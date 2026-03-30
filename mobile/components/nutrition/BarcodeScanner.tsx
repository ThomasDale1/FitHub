// ─────────────────────────────────────────────────────
// BarcodeScanner — Escaneo de código de barras
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, Alert, TextInput } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useState, useRef, useCallback } from "react";
import * as Haptics from "expo-haptics";
import { nutritionAPI, type FoodSearchResult } from "@/lib/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  onFoodFound: (food: FoodSearchResult) => void;
}

export default function BarcodeScanner({ visible, onClose, onFoodFound }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [torch, setTorch] = useState(false);
  const cooldownRef = useRef(false);

  const lookupBarcode = useCallback(async (code: string) => {
    if (searching) return;
    setScannedCode(code);
    setSearching(true);
    setNotFound(false);

    try {
      const res = await nutritionAPI.barcode(code);
      if (res.data.found && res.data.food) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFoodFound(res.data.food);
        // Reset state for next use
        setScannedCode(null);
        setSearching(false);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNotFound(true);
        setSearching(false);
      }
    } catch {
      setNotFound(true);
      setSearching(false);
    }
  }, [searching, onFoodFound]);

  const handleBarcodeScanned = useCallback(({ data }: { data: string }) => {
    // Cooldown to prevent rapid scanning
    if (cooldownRef.current || searching) return;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 2000);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lookupBarcode(data);
  }, [lookupBarcode, searching]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code.length < 8) {
      Alert.alert("Error", "El código debe tener al menos 8 dígitos");
      return;
    }
    lookupBarcode(code);
  };

  const handleRetry = () => {
    setScannedCode(null);
    setNotFound(false);
    setShowManualInput(false);
    setManualCode("");
  };

  const handleClose = () => {
    setScannedCode(null);
    setNotFound(false);
    setShowManualInput(false);
    setManualCode("");
    setTorch(false);
    setSearching(false);
    onClose();
  };

  if (!visible) return null;

  // Permission not yet determined
  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-black items-center justify-center">
          <ActivityIndicator color="white" size="large" />
        </View>
      </Modal>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View className="flex-1 bg-background items-center justify-center px-8">
          <Ionicons name="camera-outline" size={60} color="#6B6B80" />
          <Text className="text-white text-xl font-bold mt-4 text-center">
            Acceso a la cámara
          </Text>
          <Text className="text-text-muted text-center mt-2 mb-6">
            Necesitamos acceso a tu cámara para escanear códigos de barras de productos.
          </Text>
          <TouchableOpacity
            className="bg-primary rounded-2xl px-8 py-4 mb-3"
            onPress={requestPermission}
          >
            <Text className="text-white font-bold text-base">Permitir cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-text-muted text-sm">Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View className="flex-1 bg-black">
        {/* Camera view */}
        {!notFound && !showManualInput && (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{
              barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39"],
            }}
            onBarcodeScanned={searching ? undefined : handleBarcodeScanned}
          >
            {/* Overlay */}
            <View className="flex-1">
              {/* Top bar */}
              <View className="flex-row justify-between items-center px-5 pt-14 pb-4">
                <TouchableOpacity onPress={handleClose}>
                  <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <Text className="text-white font-bold text-lg">Escanear código</Text>
                <TouchableOpacity onPress={() => setTorch(!torch)}>
                  <Ionicons name={torch ? "flash" : "flash-outline"} size={24} color="white" />
                </TouchableOpacity>
              </View>

              {/* Scanning frame */}
              <View className="flex-1 items-center justify-center">
                <View
                  className="w-72 h-40 border-2 border-white/60 rounded-2xl"
                  style={{
                    shadowColor: "#6C63FF",
                    shadowRadius: 20,
                    shadowOpacity: 0.3,
                  }}
                />
                {searching ? (
                  <View className="mt-4 flex-row items-center gap-x-2">
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white text-sm">Buscando... {scannedCode}</Text>
                  </View>
                ) : (
                  <Text className="text-white/70 text-sm mt-4">
                    Apunta al código de barras del producto
                  </Text>
                )}
              </View>

              {/* Bottom: manual input link */}
              <View className="items-center pb-12">
                <TouchableOpacity
                  className="bg-white/10 rounded-xl px-5 py-3"
                  onPress={() => setShowManualInput(true)}
                >
                  <Text className="text-white text-sm">Ingresar código manualmente</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        )}

        {/* Not found state */}
        {notFound && (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="close-circle-outline" size={60} color="#EF4444" />
            <Text className="text-white text-xl font-bold mt-4">Producto no encontrado</Text>
            <Text className="text-text-muted text-center mt-2 mb-2">
              Código: {scannedCode}
            </Text>
            <Text className="text-text-muted text-center mb-6 text-sm">
              Este producto no está en nuestra base de datos.
            </Text>

            <TouchableOpacity
              className="bg-primary rounded-2xl px-8 py-4 mb-3 w-full items-center"
              onPress={handleRetry}
            >
              <Text className="text-white font-bold">Escanear otro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-background-elevated rounded-2xl px-8 py-4 w-full items-center"
              onPress={handleClose}
            >
              <Text className="text-text-secondary font-bold">Crear manualmente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Manual input */}
        {showManualInput && !notFound && (
          <View className="flex-1 bg-background items-center justify-center px-8">
            <TouchableOpacity
              className="absolute top-14 left-5"
              onPress={() => setShowManualInput(false)}
            >
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>

            <Ionicons name="barcode-outline" size={50} color="#6B6B80" />
            <Text className="text-white text-lg font-bold mt-4 mb-2">Ingresar código</Text>
            <Text className="text-text-muted text-center text-sm mb-6">
              Escribe el código de barras del producto (8-13 dígitos)
            </Text>

            <TextInput
              className="bg-background-elevated text-white text-center rounded-2xl px-6 py-4 text-xl w-full mb-4 tracking-widest"
              value={manualCode}
              onChangeText={(t) => setManualCode(t.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={13}
              placeholder="7501000611072"
              placeholderTextColor="#6B6B80"
              autoFocus
            />

            <TouchableOpacity
              className={`rounded-2xl px-8 py-4 w-full items-center ${
                manualCode.length >= 8 ? "bg-primary" : "bg-primary/30"
              }`}
              onPress={handleManualSubmit}
              disabled={manualCode.length < 8 || searching}
            >
              {searching ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold">Buscar</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}
