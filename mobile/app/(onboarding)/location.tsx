import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { placesAPI, PlaceData } from "@/lib/api";
import CustomButton from "@/components/CustomButton";

const PLACE_TYPES = [
  { value: "GYM", label: "Gimnasio", icon: "barbell" },
  { value: "UNIVERSITY", label: "Universidad", icon: "school" },
  { value: "CLUB", label: "Club deportivo", icon: "football" },
  { value: "PARK", label: "Parque", icon: "leaf" },
  { value: "OTHER", label: "Otro", icon: "location" },
] as const;

const PROGRESS_STEP = 5;
const TOTAL_STEPS = 7;

export default function LocationScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [places, setPlaces] = useState<PlaceData[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceData | null>(null);
  const [joining, setJoining] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Create place modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceType, setNewPlaceType] = useState<string>("GYM");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [creating, setCreating] = useState(false);

  // Get user location on mount
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const coords = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          setUserLocation(coords);
          // Load nearby places
          loadNearby(coords.lat, coords.lng);
        }
      } catch (e) {
        console.error("Location error:", e);
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  const loadNearby = async (lat: number, lng: number) => {
    try {
      setSearching(true);
      const res = await placesAPI.nearby(lat, lng, 10);
      setPlaces(res.data);
    } catch (e) {
      console.error("Nearby error:", e);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      if (userLocation) loadNearby(userLocation.lat, userLocation.lng);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await placesAPI.search(searchQuery);
        setPlaces(res.data);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectPlace = async (place: PlaceData) => {
    setSelectedPlace(place);
    setJoining(true);
    try {
      await placesAPI.join(place.id);
      router.push("/(onboarding)/connect" as any);
    } catch (e) {
      console.error("Join error:", e);
      Alert.alert("Error", "No se pudo seleccionar el lugar");
    } finally {
      setJoining(false);
    }
  };

  const handleCreatePlace = async () => {
    if (!newPlaceName.trim()) return;
    setCreating(true);
    try {
      const lat = userLocation?.lat || 0;
      const lng = userLocation?.lng || 0;

      const res = await placesAPI.create({
        name: newPlaceName.trim(),
        type: newPlaceType,
        address: newPlaceAddress.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });

      setShowCreateModal(false);
      setNewPlaceName("");
      setNewPlaceAddress("");

      // Go to next step
      router.push("/(onboarding)/connect" as any);
    } catch (e) {
      console.error("Create place error:", e);
      Alert.alert("Error", "No se pudo crear el lugar");
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    router.push("/(onboarding)/connect" as any);
  };

  const getPlaceIcon = (type: string) => {
    switch (type) {
      case "GYM": return "barbell";
      case "UNIVERSITY": return "school";
      case "CLUB": return "football";
      case "PARK": return "leaf";
      default: return "location";
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-muted text-xs">
            {PROGRESS_STEP} de {TOTAL_STEPS}
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={handleSkip}>
              <Text className="text-text-muted text-xs">Saltar</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
            </TouchableOpacity>
          </View>
        </View>
        <View className="h-1.5 bg-background-elevated rounded-full overflow-hidden">
          <View
            className="h-full bg-primary rounded-full"
            style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }}
          />
        </View>
      </View>

      {/* Title */}
      <View className="px-6 mt-4 mb-4">
        <Text className="text-white text-3xl font-bold">
          ¿Dónde entrenas?
        </Text>
        <Text className="text-text-secondary mt-2 text-base">
          Encuentra personas cerca de ti
        </Text>
      </View>

      {/* Search */}
      <View className="px-6 mb-4">
        <View className="bg-background-card border border-background-elevated rounded-2xl flex-row items-center px-4">
          <Ionicons name="search" size={18} color="#6B6B80" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Buscar gimnasio o lugar..."
            placeholderTextColor="#6B6B80"
            className="flex-1 text-white py-3.5 ml-3 text-base"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#6B6B80" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Places list */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {loadingLocation || searching ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text className="text-text-muted mt-3 text-sm">
              {loadingLocation ? "Obteniendo ubicación..." : "Buscando..."}
            </Text>
          </View>
        ) : places.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-5xl mb-4">📍</Text>
            <Text className="text-text-secondary text-center text-base">
              {searchQuery
                ? "No se encontraron lugares"
                : "No hay lugares cerca de ti aún"}
            </Text>
            <Text className="text-text-muted text-center text-sm mt-2">
              ¡Sé el primero en agregar tu gimnasio!
            </Text>
          </View>
        ) : (
          places.map((place) => (
            <TouchableOpacity
              key={place.id}
              onPress={() => handleSelectPlace(place)}
              disabled={joining}
              className="bg-background-card border border-background-elevated rounded-2xl p-4 mb-3 flex-row items-center"
            >
              <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center mr-4">
                <Ionicons
                  name={getPlaceIcon(place.type) as any}
                  size={22}
                  color="#6C63FF"
                />
              </View>
              <View className="flex-1">
                <Text className="text-white font-bold text-base">
                  {place.name}
                </Text>
                {place.address && (
                  <Text className="text-text-muted text-xs mt-0.5" numberOfLines={1}>
                    {place.address}
                  </Text>
                )}
                <View className="flex-row items-center mt-1 gap-3">
                  <View className="flex-row items-center">
                    <Ionicons name="people" size={12} color="#A0A0B0" />
                    <Text className="text-text-secondary text-xs ml-1">
                      {place.membersCount}{" "}
                      {place.membersCount === 1 ? "miembro" : "miembros"}
                    </Text>
                  </View>
                  {place.distance !== undefined && (
                    <View className="flex-row items-center">
                      <Ionicons name="navigate" size={12} color="#A0A0B0" />
                      <Text className="text-text-secondary text-xs ml-1">
                        {place.distance < 1
                          ? `${Math.round(place.distance * 1000)}m`
                          : `${place.distance}km`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#6B6B80" />
            </TouchableOpacity>
          ))
        )}

        <View className="h-24" />
      </ScrollView>

      {/* Bottom — Create place */}
      <View className="px-6 pb-6 pt-2 bg-background">
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          className="flex-row items-center justify-center py-3 mb-3"
        >
          <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
          <Text className="text-primary font-semibold text-sm ml-2">
            Mi gimnasio no aparece
          </Text>
        </TouchableOpacity>
      </View>

      {/* Create Place Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View className="bg-background-card rounded-t-3xl px-6 pt-6 pb-10">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-white text-xl font-bold">
                Agregar lugar
              </Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Ionicons name="close" size={24} color="#A0A0B0" />
              </TouchableOpacity>
            </View>

            {/* Name */}
            <Text className="text-text-secondary text-sm mb-2 font-medium">
              Nombre del lugar
            </Text>
            <TextInput
              value={newPlaceName}
              onChangeText={setNewPlaceName}
              placeholder="Ej: Smart Fit Centro"
              placeholderTextColor="#6B6B80"
              className="bg-background border border-background-elevated rounded-2xl px-4 py-3.5 text-white text-base mb-4"
            />

            {/* Type */}
            <Text className="text-text-secondary text-sm mb-2 font-medium">
              Tipo
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              <View className="flex-row gap-2">
                {PLACE_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt.value}
                    onPress={() => setNewPlaceType(pt.value)}
                    className={`flex-row items-center px-4 py-2.5 rounded-full border ${
                      newPlaceType === pt.value
                        ? "border-primary bg-primary/15"
                        : "border-background-elevated bg-background"
                    }`}
                  >
                    <Ionicons
                      name={pt.icon as any}
                      size={14}
                      color={newPlaceType === pt.value ? "#6C63FF" : "#A0A0B0"}
                    />
                    <Text
                      className={`ml-2 text-sm font-medium ${
                        newPlaceType === pt.value
                          ? "text-primary"
                          : "text-text-secondary"
                      }`}
                    >
                      {pt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Address */}
            <Text className="text-text-secondary text-sm mb-2 font-medium">
              Dirección (opcional)
            </Text>
            <TextInput
              value={newPlaceAddress}
              onChangeText={setNewPlaceAddress}
              placeholder="Ej: Av. Principal #123"
              placeholderTextColor="#6B6B80"
              className="bg-background border border-background-elevated rounded-2xl px-4 py-3.5 text-white text-base mb-6"
            />

            <CustomButton
              title="Crear y seleccionar"
              onPress={handleCreatePlace}
              loading={creating}
              disabled={!newPlaceName.trim()}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
