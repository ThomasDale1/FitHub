import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { placesAPI, PlaceData } from "@/lib/api";
import { googlePlacesAPI } from "@/lib/googlePlaces";
import CustomButton from "@/components/CustomButton";
import darkMapStyle from "@/assets/mapStyle.json";

// ─── Dynamic native maps import ────────────────────
let NativeMapView: any = null;
let NativeMarker: any = null;
let PROVIDER_GOOGLE: any = null;

try {
  const maps = require("react-native-maps");
  NativeMapView = maps.default;
  NativeMarker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
} catch {
  // Expo Go — use list fallback
}

const HAS_NATIVE_MAPS = NativeMapView !== null;

// ─── Constants ──────────────────────────────────────
const PLACE_TYPES = [
  { value: "GYM", label: "Gimnasio", icon: "barbell", color: "#6C63FF" },
  { value: "UNIVERSITY", label: "Universidad", icon: "school", color: "#4ECDC4" },
  { value: "CLUB", label: "Club deportivo", icon: "football", color: "#FF6B6B" },
  { value: "PARK", label: "Parque", icon: "leaf", color: "#45B7D1" },
  { value: "OTHER", label: "Otro", icon: "location", color: "#96CEB4" },
] as const;

const PROGRESS_STEP = 5;
const TOTAL_STEPS = 7;
const DEFAULT_LAT_DELTA = 0.015;
const DEFAULT_LNG_DELTA = 0.015;

// ─── Unified place type ─────────────────────────────
interface UnifiedPlace {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  type: string;
  membersCount?: number;
  distance?: number;
  photoUrl?: string | null;
  source: "db" | "google" | "poi";
}

type SheetMode = "hidden" | "confirm" | "create";

export default function LocationScreen() {
  const mapRef = useRef<any>(null);
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // DB places (from our backend)
  const [dbPlaces, setDbPlaces] = useState<PlaceData[]>([]);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UnifiedPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Selected place for confirmation
  const [selectedPlace, setSelectedPlace] = useState<UnifiedPlace | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("hidden");
  const [joining, setJoining] = useState(false);

  // Create mode (pin)
  const [droppedPin, setDroppedPin] = useState<{ lat: number; lng: number } | null>(null);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceType, setNewPlaceType] = useState<string>("GYM");
  const [newPlaceAddress, setNewPlaceAddress] = useState("");
  const [creating, setCreating] = useState(false);

  // List fallback modal
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ─── Get user location ────────────────────────────
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
          loadDbPlaces(coords.lat, coords.lng);
        }
      } catch (e) {
        console.error("Location error:", e);
      } finally {
        setLoadingLocation(false);
      }
    })();
  }, []);

  // ─── Load DB places ──────────────────────────────
  const loadDbPlaces = async (lat: number, lng: number) => {
    try {
      const res = await placesAPI.nearby(lat, lng, 10);
      setDbPlaces(res.data);
    } catch (e) {
      console.error("DB places error:", e);
    }
  };

  // ─── Debounced search (DB + Google Places) ────────
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setShowSearchResults(true);
      try {
        // Fetch from both sources in parallel
        const [dbRes, googleRes] = await Promise.all([
          placesAPI.search(searchQuery).catch(() => ({ data: [] as PlaceData[] })),
          googlePlacesAPI.textSearch(searchQuery, userLocation?.lat, userLocation?.lng),
        ]);

        // Convert DB results
        const dbResults: UnifiedPlace[] = dbRes.data.map((p) => ({
          id: p.id,
          name: p.name,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          type: p.type,
          membersCount: p.membersCount,
          distance: p.distance,
          source: "db" as const,
        }));

        // Convert Google results
        const googleResults: UnifiedPlace[] = googleRes.map((gp) => ({
          id: gp.place_id,
          name: gp.name,
          address: gp.formatted_address || null,
          latitude: gp.latitude,
          longitude: gp.longitude,
          type: gp.types?.includes("gym") ? "GYM" : "OTHER",
          photoUrl: gp.photoUri,
          source: "google" as const,
        }));

        // DB results first, then Google (avoid duplicates by name)
        const dbNames = new Set(dbResults.map((r) => r.name.toLowerCase()));
        const filtered = googleResults.filter(
          (g) => !dbNames.has(g.name.toLowerCase()),
        );
        setSearchResults([...dbResults, ...filtered]);
      } catch (e) {
        console.error("Search error:", e);
      } finally {
        setSearching(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Sheet animation ─────────────────────────────
  const showSheet = (mode: SheetMode) => {
    Keyboard.dismiss();
    setSheetMode(mode);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const hideSheet = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setSheetMode("hidden");
      setSelectedPlace(null);
      if (sheetMode === "create") {
        setDroppedPin(null);
        setNewPlaceName("");
        setNewPlaceAddress("");
        setNewPlaceType("GYM");
      }
    });
  };

  // ─── POI click (Apple Maps / Google Maps labels) ──
  const handlePoiClick = (e: any) => {
    const { name, coordinate } = e.nativeEvent;
    setSelectedPlace({
      id: `poi-${coordinate.latitude}-${coordinate.longitude}`,
      name: name || "Lugar seleccionado",
      address: null,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      type: "GYM",
      source: "poi",
    });
    setShowSearchResults(false);
    showSheet("confirm");

    mapRef.current?.animateToRegion(
      {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      },
      300,
    );
  };

  // ─── DB marker press ─────────────────────────────
  const handleDbMarkerPress = (place: PlaceData) => {
    setSelectedPlace({
      id: place.id,
      name: place.name,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      type: place.type,
      membersCount: place.membersCount,
      distance: place.distance,
      source: "db",
    });
    setShowSearchResults(false);
    showSheet("confirm");

    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      },
      300,
    );
  };

  // ─── Search result tap ────────────────────────────
  const handleSearchResultTap = (place: UnifiedPlace) => {
    Keyboard.dismiss();
    setSelectedPlace(place);
    setSearchQuery("");
    setShowSearchResults(false);
    showSheet("confirm");

    mapRef.current?.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      },
      400,
    );
  };

  // ─── Confirm selection ────────────────────────────
  const handleConfirmPlace = async () => {
    if (!selectedPlace) return;
    setJoining(true);
    try {
      if (selectedPlace.source === "db") {
        // Already in DB — just join
        await placesAPI.join(selectedPlace.id);
      } else {
        // Google/POI place — create in our DB first, then auto-joins
        await placesAPI.create({
          name: selectedPlace.name,
          type: selectedPlace.type,
          address: selectedPlace.address || undefined,
          latitude: selectedPlace.latitude,
          longitude: selectedPlace.longitude,
        });
      }
      router.push("/(onboarding)/connect" as any);
    } catch (e) {
      console.error("Confirm error:", e);
      Alert.alert("Error", "No se pudo seleccionar el lugar");
    } finally {
      setJoining(false);
    }
  };

  // ─── "Mi gimnasio no aparece" → drop pin ─────────
  const handleDropPin = () => {
    if (!userLocation) return;
    const pinCoords = { lat: userLocation.lat, lng: userLocation.lng };
    setDroppedPin(pinCoords);
    setSelectedPlace(null);
    setShowSearchResults(false);
    showSheet("create");

    mapRef.current?.animateToRegion(
      {
        latitude: pinCoords.lat,
        longitude: pinCoords.lng,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      },
      400,
    );
  };

  // ─── Pin drag end ────────────────────────────────
  const handlePinDragEnd = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setDroppedPin({ lat: latitude, lng: longitude });
  };

  // ─── Create place from pin ────────────────────────
  const handleCreatePlace = async () => {
    if (!newPlaceName.trim()) return;
    const lat = droppedPin?.lat ?? userLocation?.lat ?? 0;
    const lng = droppedPin?.lng ?? userLocation?.lng ?? 0;
    setCreating(true);
    try {
      await placesAPI.create({
        name: newPlaceName.trim(),
        type: newPlaceType,
        address: newPlaceAddress.trim() || undefined,
        latitude: lat,
        longitude: lng,
      });
      router.push("/(onboarding)/connect" as any);
    } catch (e) {
      console.error("Create error:", e);
      Alert.alert("Error", "No se pudo crear el lugar");
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = () => {
    router.push("/(onboarding)/connect" as any);
  };

  const handleMapPress = () => {
    Keyboard.dismiss();
    if (showSearchResults) setShowSearchResults(false);
    if (sheetMode !== "hidden" && sheetMode !== "create") hideSheet();
  };

  const centerOnUser = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion(
      {
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        latitudeDelta: DEFAULT_LAT_DELTA,
        longitudeDelta: DEFAULT_LNG_DELTA,
      },
      400,
    );
  };

  const getPlaceTypeConfig = (type: string) =>
    PLACE_TYPES.find((pt) => pt.value === type) || PLACE_TYPES[4];

  const sheetTranslateY = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  // ─── Create Place Form (shared) ───────────────────
  const CreatePlaceForm = ({ onClose }: { onClose: () => void }) => (
    <>
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-white text-xl font-bold">Agregar lugar</Text>
        <TouchableOpacity onPress={onClose} className="p-1">
          <Ionicons name="close" size={22} color="#6B6B80" />
        </TouchableOpacity>
      </View>

      {droppedPin && (
        <View className="flex-row items-center bg-primary/10 rounded-xl px-3 py-2 mb-4">
          <Ionicons name="move" size={14} color="#6C63FF" />
          <Text className="text-primary text-xs ml-2 flex-1">
            Arrastra el pin morado en el mapa para ajustar la ubicación
          </Text>
        </View>
      )}

      <Text className="text-text-secondary text-sm mb-2 font-medium">Nombre del lugar</Text>
      <TextInput
        value={newPlaceName}
        onChangeText={setNewPlaceName}
        placeholder="Ej: Smart Fit Centro"
        placeholderTextColor="#6B6B80"
        className="bg-background border border-background-elevated rounded-2xl px-4 py-3 text-white text-base mb-4"
      />

      <Text className="text-text-secondary text-sm mb-2 font-medium">Tipo</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
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
                color={newPlaceType === pt.value ? pt.color : "#A0A0B0"}
              />
              <Text
                className={`ml-2 text-sm font-medium ${
                  newPlaceType === pt.value ? "text-primary" : "text-text-secondary"
                }`}
              >
                {pt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <Text className="text-text-secondary text-sm mb-2 font-medium">Dirección (opcional)</Text>
      <TextInput
        value={newPlaceAddress}
        onChangeText={setNewPlaceAddress}
        placeholder="Ej: Av. Principal #123"
        placeholderTextColor="#6B6B80"
        className="bg-background border border-background-elevated rounded-2xl px-4 py-3 text-white text-base mb-5"
      />

      <CustomButton
        title="Crear y seleccionar"
        onPress={handleCreatePlace}
        loading={creating}
        disabled={!newPlaceName.trim()}
      />
    </>
  );

  // ══════════════════════════════════════════════════
  //  MAP MODE
  // ══════════════════════════════════════════════════
  if (HAS_NATIVE_MAPS) {
    const MapViewComponent = NativeMapView;
    const MarkerComponent = NativeMarker;

    return (
      <View className="flex-1 bg-background">
        {/* Map */}
        {loadingLocation ? (
          <View className="flex-1 items-center justify-center bg-background">
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text className="text-text-muted mt-3 text-sm">Obteniendo ubicación...</Text>
          </View>
        ) : (
          <MapViewComponent
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={
              userLocation
                ? {
                    latitude: userLocation.lat,
                    longitude: userLocation.lng,
                    latitudeDelta: DEFAULT_LAT_DELTA,
                    longitudeDelta: DEFAULT_LNG_DELTA,
                  }
                : {
                    latitude: 19.4326,
                    longitude: -99.1332,
                    latitudeDelta: DEFAULT_LAT_DELTA,
                    longitudeDelta: DEFAULT_LNG_DELTA,
                  }
            }
            showsUserLocation
            showsMyLocationButton={false}
            showsPointsOfInterest
            onPoiClick={handlePoiClick}
            onPress={handleMapPress}
            customMapStyle={darkMapStyle}
          >
            {/* DB place markers */}
            {dbPlaces.map((place) => {
              const config = getPlaceTypeConfig(place.type);
              return (
                <MarkerComponent
                  key={place.id}
                  coordinate={{ latitude: place.latitude, longitude: place.longitude }}
                  onPress={() => handleDbMarkerPress(place)}
                >
                  <View className="items-center">
                    <View
                      style={{ backgroundColor: config.color }}
                      className="w-10 h-10 rounded-full items-center justify-center shadow-lg"
                    >
                      <Ionicons name={config.icon as any} size={18} color="white" />
                    </View>
                    <View
                      style={{ backgroundColor: config.color }}
                      className="w-3 h-3 rounded-sm rotate-45 -mt-1.5"
                    />
                  </View>
                </MarkerComponent>
              );
            })}

            {/* Selected place marker (from search or POI) */}
            {selectedPlace && selectedPlace.source !== "db" && (
              <MarkerComponent
                coordinate={{ latitude: selectedPlace.latitude, longitude: selectedPlace.longitude }}
              >
                <View className="items-center">
                  <View className="w-10 h-10 rounded-full bg-green-500 items-center justify-center shadow-lg border-2 border-white">
                    <Ionicons name="checkmark" size={20} color="white" />
                  </View>
                  <View className="w-3 h-3 rounded-sm rotate-45 -mt-1.5 bg-green-500" />
                </View>
              </MarkerComponent>
            )}

            {/* Draggable pin — only from "mi gimnasio no aparece" */}
            {droppedPin && (
              <MarkerComponent
                coordinate={{ latitude: droppedPin.lat, longitude: droppedPin.lng }}
                draggable
                onDragEnd={handlePinDragEnd}
              >
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-primary items-center justify-center shadow-lg border-2 border-white">
                    <Ionicons name="add" size={24} color="white" />
                  </View>
                  <View className="w-3 h-3 rounded-sm rotate-45 -mt-1.5 bg-primary" />
                </View>
              </MarkerComponent>
            )}
          </MapViewComponent>
        )}

        {/* ─── Floating top bar ─── */}
        <SafeAreaView
          edges={["top"]}
          className="absolute top-0 left-0 right-0"
          style={{ pointerEvents: "box-none" }}
        >
          {/* Progress */}
          <View className="px-5 pt-2 pb-2" style={{ pointerEvents: "box-none" }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-white text-xs font-semibold bg-black/40 px-2 py-1 rounded-full overflow-hidden">
                {PROGRESS_STEP} de {TOTAL_STEPS}
              </Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity onPress={handleSkip} className="bg-black/40 px-3 py-1.5 rounded-full">
                  <Text className="text-white text-xs font-medium">Saltar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => router.back()}
                  className="bg-black/40 w-8 h-8 rounded-full items-center justify-center"
                >
                  <Ionicons name="arrow-back" size={16} color="white" />
                </TouchableOpacity>
              </View>
            </View>
            <View className="h-1.5 bg-black/30 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }}
              />
            </View>
          </View>

          {/* Title + Search */}
          <View className="px-5 mt-1">
            <Text
              className="text-white text-2xl font-bold mb-1"
              style={{ textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}
            >
              ¿Dónde entrenas?
            </Text>
            <Text
              className="text-white/70 text-sm mb-3"
              style={{ textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 }}
            >
              Toca un gimnasio en el mapa o búscalo
            </Text>

            {/* Search bar */}
            <View
              className="bg-background-card/95 border border-background-elevated rounded-2xl flex-row items-center px-4"
              style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
            >
              <Ionicons name="search" size={18} color="#6B6B80" />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Buscar gimnasio o lugar..."
                placeholderTextColor="#6B6B80"
                className="flex-1 text-white py-3 ml-3 text-sm"
                returnKeyType="search"
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              {searching && <ActivityIndicator size="small" color="#6C63FF" style={{ marginLeft: 8 }} />}
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(""); setShowSearchResults(false); }}>
                  <Ionicons name="close-circle" size={18} color="#6B6B80" />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => Keyboard.dismiss()} className="ml-2">
                <Ionicons name="chevron-down" size={20} color="#6B6B80" />
              </TouchableOpacity>
            </View>

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <View
                className="bg-background-card/95 border border-background-elevated rounded-2xl mt-2 max-h-64 overflow-hidden"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 }}
              >
                <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                  {searchResults.slice(0, 8).map((place, index) => {
                    const config = getPlaceTypeConfig(place.type);
                    return (
                      <TouchableOpacity
                        key={`${place.source}-${place.id}-${index}`}
                        onPress={() => handleSearchResultTap(place)}
                        className={`flex-row items-center px-4 py-3 ${
                          index < searchResults.length - 1 ? "border-b border-background-elevated" : ""
                        }`}
                      >
                        <View
                          style={{ backgroundColor: `${config.color}25` }}
                          className="w-9 h-9 rounded-lg items-center justify-center mr-3"
                        >
                          <Ionicons name={config.icon as any} size={16} color={config.color} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-white text-sm font-semibold" numberOfLines={1}>
                            {place.name}
                          </Text>
                          {place.address && (
                            <Text className="text-text-muted text-xs mt-0.5" numberOfLines={1}>
                              {place.address}
                            </Text>
                          )}
                        </View>
                        {place.source === "db" && (
                          <View className="bg-primary/15 px-2 py-0.5 rounded-full">
                            <Text className="text-primary text-[10px] font-medium">FitHub</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {showSearchResults && !searching && searchResults.length === 0 && searchQuery.length >= 2 && (
              <View className="bg-background-card/95 border border-background-elevated rounded-2xl mt-2 px-4 py-4 items-center">
                <Text className="text-text-muted text-sm">No se encontraron resultados</Text>
              </View>
            )}
          </View>
        </SafeAreaView>

        {/* Center button */}
        {userLocation && (
          <TouchableOpacity
            onPress={centerOnUser}
            className="absolute right-5 bg-background-card/95 w-11 h-11 rounded-full items-center justify-center border border-background-elevated"
            style={{
              bottom: sheetMode !== "hidden" ? 360 : 110,
              shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
            }}
          >
            <Ionicons name="locate" size={20} color="#6C63FF" />
          </TouchableOpacity>
        )}

        {/* "Mi gimnasio no aparece" button — only when no sheet open */}
        {sheetMode === "hidden" && !loadingLocation && (
          <SafeAreaView edges={["bottom"]} className="absolute bottom-0 left-0 right-0" style={{ pointerEvents: "box-none" }}>
            <View className="px-5 pb-4" style={{ pointerEvents: "auto" }}>
              <TouchableOpacity
                onPress={handleDropPin}
                className="bg-background-card/95 border border-background-elevated rounded-2xl py-3.5 flex-row items-center justify-center"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 5 }}
              >
                <Ionicons name="add-circle" size={20} color="#6C63FF" />
                <Text className="text-primary font-semibold text-sm ml-2">Mi gimnasio no aparece</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        )}

        {/* ─── Bottom Sheet ─── */}
        {sheetMode !== "hidden" && (
          <Animated.View
            className="absolute bottom-0 left-0 right-0 bg-background-card rounded-t-3xl border-t border-background-elevated"
            style={{
              transform: [{ translateY: sheetTranslateY }],
              shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
            }}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-10 h-1 rounded-full bg-background-elevated" />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              {/* Confirmation sheet */}
              {sheetMode === "confirm" && selectedPlace && (
                <View className="px-6 pb-10">
                  {/* Place photo */}
                  {selectedPlace.photoUrl && (
                    <Image
                      source={{ uri: selectedPlace.photoUrl }}
                      className="w-full h-40 rounded-2xl mb-4"
                      resizeMode="cover"
                    />
                  )}

                  <View className="flex-row items-start mb-5">
                    <View
                      style={{ backgroundColor: getPlaceTypeConfig(selectedPlace.type).color }}
                      className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
                    >
                      <Ionicons
                        name={getPlaceTypeConfig(selectedPlace.type).icon as any}
                        size={24}
                        color="white"
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-xl font-bold">{selectedPlace.name}</Text>
                      {selectedPlace.address && (
                        <Text className="text-text-muted text-sm mt-1" numberOfLines={2}>
                          {selectedPlace.address}
                        </Text>
                      )}
                      <View className="flex-row items-center mt-2 gap-4">
                        {selectedPlace.membersCount != null && selectedPlace.membersCount > 0 && (
                          <View className="flex-row items-center">
                            <Ionicons name="people" size={14} color="#A0A0B0" />
                            <Text className="text-text-secondary text-sm ml-1.5">
                              {selectedPlace.membersCount} {selectedPlace.membersCount === 1 ? "miembro" : "miembros"}
                            </Text>
                          </View>
                        )}
                        {selectedPlace.distance != null && (
                          <View className="flex-row items-center">
                            <Ionicons name="navigate" size={14} color="#A0A0B0" />
                            <Text className="text-text-secondary text-sm ml-1.5">
                              {selectedPlace.distance < 1
                                ? `${Math.round(selectedPlace.distance * 1000)}m`
                                : `${selectedPlace.distance.toFixed(1)}km`}
                            </Text>
                          </View>
                        )}
                        {selectedPlace.source === "google" && (
                          <View className="flex-row items-center">
                            <Ionicons name="globe-outline" size={14} color="#A0A0B0" />
                            <Text className="text-text-secondary text-sm ml-1.5">Google</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={hideSheet} className="p-1">
                      <Ionicons name="close" size={22} color="#6B6B80" />
                    </TouchableOpacity>
                  </View>

                  <CustomButton
                    title="Confirmar selección"
                    onPress={handleConfirmPlace}
                    loading={joining}
                  />
                </View>
              )}

              {/* Create place sheet */}
              {sheetMode === "create" && (
                <ScrollView className="px-6 pb-10" keyboardShouldPersistTaps="handled">
                  <CreatePlaceForm onClose={hideSheet} />
                  <View className="h-8" />
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          </Animated.View>
        )}
      </View>
    );
  }

  // ══════════════════════════════════════════════════
  //  LIST MODE — Fallback (Expo Go)
  // ══════════════════════════════════════════════════
  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-text-muted text-xs">{PROGRESS_STEP} de {TOTAL_STEPS}</Text>
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
          <View className="h-full bg-primary rounded-full" style={{ width: `${(PROGRESS_STEP / TOTAL_STEPS) * 100}%` }} />
        </View>
      </View>

      {/* Title */}
      <View className="px-6 mt-4 mb-4">
        <Text className="text-white text-3xl font-bold">¿Dónde entrenas?</Text>
        <Text className="text-text-secondary mt-2 text-base">Encuentra personas cerca de ti</Text>
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
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setShowSearchResults(false); }}>
              <Ionicons name="close-circle" size={18} color="#6B6B80" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => Keyboard.dismiss()} className="ml-2">
            <Ionicons name="chevron-down" size={20} color="#6B6B80" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results list */}
      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {loadingLocation || searching ? (
          <View className="items-center py-12">
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text className="text-text-muted mt-3 text-sm">
              {loadingLocation ? "Obteniendo ubicación..." : "Buscando..."}
            </Text>
          </View>
        ) : (showSearchResults && searchQuery.length >= 2 ? searchResults : dbPlaces.map((p): UnifiedPlace => ({
          id: p.id, name: p.name, address: p.address, latitude: p.latitude,
          longitude: p.longitude, type: p.type, membersCount: p.membersCount,
          distance: p.distance, source: "db",
        }))).length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-5xl mb-4">📍</Text>
            <Text className="text-text-secondary text-center text-base">
              {searchQuery.length >= 2 ? "No se encontraron lugares" : "No hay lugares cerca de ti aún"}
            </Text>
            <Text className="text-text-muted text-center text-sm mt-2">
              ¡Sé el primero en agregar tu gimnasio!
            </Text>
          </View>
        ) : (
          (showSearchResults && searchQuery.length >= 2 ? searchResults : dbPlaces.map((p): UnifiedPlace => ({
            id: p.id, name: p.name, address: p.address, latitude: p.latitude,
            longitude: p.longitude, type: p.type, membersCount: p.membersCount,
            distance: p.distance, source: "db",
          }))).map((place, index) => {
            const config = getPlaceTypeConfig(place.type);
            return (
              <TouchableOpacity
                key={`${place.source}-${place.id}-${index}`}
                onPress={() => {
                  setSelectedPlace(place);
                  // For list mode, confirm immediately
                  Alert.alert(
                    place.name,
                    place.address || "¿Quieres seleccionar este lugar?",
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Confirmar",
                        onPress: async () => {
                          try {
                            if (place.source === "db") {
                              await placesAPI.join(place.id);
                            } else {
                              await placesAPI.create({
                                name: place.name,
                                type: place.type,
                                address: place.address || undefined,
                                latitude: place.latitude,
                                longitude: place.longitude,
                              });
                            }
                            router.push("/(onboarding)/connect" as any);
                          } catch (e) {
                            Alert.alert("Error", "No se pudo seleccionar el lugar");
                          }
                        },
                      },
                    ],
                  );
                }}
                disabled={joining}
                className="bg-background-card border border-background-elevated rounded-2xl p-4 mb-3 flex-row items-center"
              >
                <View
                  style={{ backgroundColor: `${config.color}20` }}
                  className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                >
                  <Ionicons name={config.icon as any} size={22} color={config.color} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base">{place.name}</Text>
                  {place.address && (
                    <Text className="text-text-muted text-xs mt-0.5" numberOfLines={1}>{place.address}</Text>
                  )}
                  <View className="flex-row items-center mt-1 gap-3">
                    {place.membersCount != null && place.membersCount > 0 && (
                      <View className="flex-row items-center">
                        <Ionicons name="people" size={12} color="#A0A0B0" />
                        <Text className="text-text-secondary text-xs ml-1">
                          {place.membersCount} {place.membersCount === 1 ? "miembro" : "miembros"}
                        </Text>
                      </View>
                    )}
                    {place.distance != null && (
                      <View className="flex-row items-center">
                        <Ionicons name="navigate" size={12} color="#A0A0B0" />
                        <Text className="text-text-secondary text-xs ml-1">
                          {place.distance < 1
                            ? `${Math.round(place.distance * 1000)}m`
                            : `${place.distance.toFixed(1)}km`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {place.source === "db" ? (
                  <View className="bg-primary/15 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-primary text-[10px] font-medium">FitHub</Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#6B6B80" />
              </TouchableOpacity>
            );
          })
        )}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom create button */}
      <View className="px-6 pb-6 pt-2 bg-background">
        <TouchableOpacity
          onPress={() => setShowCreateModal(true)}
          className="flex-row items-center justify-center py-3 mb-3"
        >
          <Ionicons name="add-circle-outline" size={18} color="#6C63FF" />
          <Text className="text-primary font-semibold text-sm ml-2">Mi gimnasio no aparece</Text>
        </TouchableOpacity>
      </View>

      {/* Create modal (list mode) */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <View className="bg-background-card rounded-t-3xl px-6 pt-6 pb-10">
            <CreatePlaceForm
              onClose={() => {
                setShowCreateModal(false);
                setNewPlaceName("");
                setNewPlaceAddress("");
                setNewPlaceType("GYM");
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
