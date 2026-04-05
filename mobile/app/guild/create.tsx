// ─────────────────────────────────────────────────────
// mobile/app/guild/create.tsx
// Create new Guild (Forge / War Party / Open)
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { guildsAPI, api } from "@/lib/api";
import { Ionicons } from "@expo/vector-icons";

type GuildType = "FORGE" | "WAR_PARTY" | "OPEN";

const TYPE_OPTIONS: { key: GuildType; icon: string; label: string; desc: string; color: string }[] = [
  {
    key: "FORGE",
    icon: "hammer",
    label: "Forge",
    desc: "Vinculada a tu gym. Tu base principal.",
    color: "#F59E0B",
  },
  {
    key: "WAR_PARTY",
    icon: "shield",
    label: "War Party",
    desc: "Privada, solo invitacion. Max 15.",
    color: "#EF4444",
  },
  {
    key: "OPEN",
    icon: "globe",
    label: "Open Guild",
    desc: "Publica, cualquiera puede unirse.",
    color: "#6C63FF",
  },
];

const COLORS = ["#6C63FF", "#EF4444", "#F59E0B", "#22C55E", "#3B82F6", "#EC4899", "#8B5CF6", "#14B8A6"];

interface Place {
  id: string;
  placeId: string;
  place: { id: string; name: string };
}

export default function CreateGuildScreen() {
  const [type, setType] = useState<GuildType>("OPEN");
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [motto, setMotto] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6C63FF");
  const [submitting, setSubmitting] = useState(false);
  const [myPlace, setMyPlace] = useState<Place | null>(null);
  const [loadingPlace, setLoadingPlace] = useState(true);
  const [placeError, setPlaceError] = useState(false);

  // Fetch user's primary place for FORGE type
  const fetchMyPlace = async () => {
    setPlaceError(false);
    setLoadingPlace(true);
    try {
      const res = await api.get("/api/users/me");
      const places = res.data?.places;
      if (places && places.length > 0) {
        setMyPlace(places[0]);
      }
    } catch (err) {
      console.error("Failed to fetch user places:", err);
      setPlaceError(true);
    } finally {
      setLoadingPlace(false);
    }
  };

  useEffect(() => {
    fetchMyPlace();
  }, []);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    const trimmedTag = tag.trim();

    if (!trimmedName || !trimmedTag) {
      Alert.alert("Error", "Nombre y tag son requeridos");
      return;
    }
    if (trimmedTag.length < 2 || trimmedTag.length > 5) {
      Alert.alert("Error", "Tag debe ser 2-5 caracteres");
      return;
    }

    if (type === "FORGE" && !myPlace) {
      Alert.alert("Error", "Necesitas tener un gym registrado para crear una Forge");
      return;
    }
    if (type === "FORGE" && !myPlace?.place?.id) {
      Alert.alert("Error", "Datos del gym incompletos. Intenta de nuevo.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await guildsAPI.create({
        name: trimmedName,
        tag: trimmedTag.toUpperCase(),
        type,
        motto: motto.trim() || undefined,
        description: description.trim() || undefined,
        colorPrimary: color,
        placeId: type === "FORGE" ? myPlace?.place?.id : undefined,
      });
      router.replace(`/guild/${res.data.id}` as any);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Error al crear guild";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-5 pt-3 pb-2 flex-row items-center">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Crear Guild</Text>
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        {/* ─── TYPE SELECTOR ──────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Tipo de Guild</Text>
        {TYPE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            className={`flex-row items-center p-3 rounded-xl mb-2 border ${
              type === opt.key ? "border-primary bg-primary/10" : "border-background-elevated bg-background-card"
            }`}
            onPress={() => setType(opt.key)}
          >
            <View
              className="w-10 h-10 rounded-lg items-center justify-center"
              style={{ backgroundColor: opt.color + "20" }}
            >
              <Ionicons name={opt.icon as any} size={20} color={opt.color} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-white font-bold text-sm">{opt.label}</Text>
              <Text className="text-text-muted text-[10px]">{opt.desc}</Text>
            </View>
            {type === opt.key && (
              <Ionicons name="checkmark-circle" size={20} color="#6C63FF" />
            )}
          </TouchableOpacity>
        ))}

        {/* FORGE place info */}
        {type === "FORGE" && (
          <View className="bg-amber-500/10 rounded-xl p-3 mb-3 flex-row items-center">
            <Ionicons name="location" size={16} color="#F59E0B" />
            <Text className="text-amber-400 text-xs ml-2 flex-1">
              {loadingPlace
                ? "Cargando gym..."
                : myPlace
                  ? `Se vinculara a: ${myPlace.place.name}`
                  : placeError
                    ? "Error al cargar gym. "
                    : "No tienes gym registrado. Registra uno en tu perfil primero."}
            </Text>
            {placeError && (
              <TouchableOpacity onPress={fetchMyPlace} className="ml-2">
                <Ionicons name="refresh" size={16} color="#F59E0B" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ─── NAME ───────────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Nombre</Text>
        <TextInput
          className="bg-background-card border border-background-elevated rounded-xl px-4 py-3 text-white text-sm"
          placeholder="Ej: Iron Wolves"
          placeholderTextColor="#6B6B80"
          value={name}
          onChangeText={setName}
          maxLength={30}
        />

        {/* ─── TAG ────────────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Tag (2-5 chars)</Text>
        <TextInput
          className="bg-background-card border border-background-elevated rounded-xl px-4 py-3 text-white text-sm"
          placeholder="Ej: IRWV"
          placeholderTextColor="#6B6B80"
          value={tag}
          onChangeText={(t) => setTag(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5))}
          maxLength={5}
          autoCapitalize="characters"
        />
        <Text className="text-text-muted text-[10px] mt-1">Aparece junto al nombre: [{tag || "TAG"}]</Text>

        {/* ─── MOTTO ──────────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Lema (opcional)</Text>
        <TextInput
          className="bg-background-card border border-background-elevated rounded-xl px-4 py-3 text-white text-sm"
          placeholder="Ej: No descansamos"
          placeholderTextColor="#6B6B80"
          value={motto}
          onChangeText={setMotto}
          maxLength={60}
        />

        {/* ─── DESCRIPTION ────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Descripcion (opcional)</Text>
        <TextInput
          className="bg-background-card border border-background-elevated rounded-xl px-4 py-3 text-white text-sm"
          placeholder="Sobre esta guild..."
          placeholderTextColor="#6B6B80"
          value={description}
          onChangeText={setDescription}
          maxLength={200}
          multiline
          numberOfLines={3}
          style={{ textAlignVertical: "top", minHeight: 70 }}
        />

        {/* ─── COLOR ──────────────────────────── */}
        <Text className="text-white font-bold text-sm mb-2 mt-3">Color</Text>
        <View className="flex-row gap-2 flex-wrap mb-4">
          {COLORS.map((c) => (
            <TouchableOpacity
              key={c}
              className="w-10 h-10 rounded-xl items-center justify-center"
              style={{ backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: "#FFFFFF" }}
              onPress={() => setColor(c)}
            >
              {color === c && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── PREVIEW ────────────────────────── */}
        <View
          className="bg-background-card rounded-2xl p-4 mb-4"
          style={{ borderLeftColor: color, borderLeftWidth: 3 }}
        >
          <Text className="text-text-muted text-[10px] mb-1">Vista previa</Text>
          <View className="flex-row items-center gap-x-2">
            <Text className="text-white font-bold">{name || "Nombre de Guild"}</Text>
            <View className="bg-white/10 rounded px-1.5 py-0.5">
              <Text className="text-text-muted text-[10px] font-bold">[{tag || "TAG"}]</Text>
            </View>
          </View>
          {motto ? <Text className="text-text-secondary text-xs italic mt-1">"{motto}"</Text> : null}
        </View>

        {/* ─── CREATE BUTTON ──────────────────── */}
        <TouchableOpacity
          className={`rounded-2xl py-4 items-center mb-8 ${submitting ? "bg-primary/50" : "bg-primary"}`}
          onPress={handleCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-sm">Crear Guild</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
