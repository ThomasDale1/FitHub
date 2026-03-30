// ─────────────────────────────────────────────────────
// AddFoodModal — Search, AI Text, Barcode, Recientes,
//                Favoritos, Populares, Manual
// ─────────────────────────────────────────────────────
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useState, useCallback, useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import {
  nutritionAPI,
  type FoodSearchResult,
  type RecentFood,
  type AiParsedFood,
  type FoodLogData,
} from "@/lib/api";
import { MEAL_CONFIG, type MealType } from "./MealCards";

type Tab = "search" | "recent" | "manual";

interface Props {
  visible: boolean;
  mealType: MealType;
  foodLog: FoodLogData | null;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  onOpenBarcode: () => void;
}

// ─── Search Result Item ─────────────────────────────
function SearchResultItem({
  item,
  onSelect,
}: {
  item: FoodSearchResult;
  onSelect: (item: FoodSearchResult) => void;
}) {
  const sourceBadge: Record<string, { label: string; color: string }> = {
    SAVED: { label: "Guardado", color: "#F59E0B" },
    OPEN_FOOD_FACTS: { label: "OFF", color: "#34D399" },
    USDA: { label: "USDA", color: "#60A5FA" },
  };
  const badge = sourceBadge[item.source] || { label: item.source, color: "#A0A0B0" };

  return (
    <TouchableOpacity
      className="flex-row items-center py-3 border-b border-background-elevated"
      onPress={() => onSelect(item)}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-10 h-10 rounded-lg mr-3"
          resizeMode="cover"
        />
      ) : (
        <View className="w-10 h-10 rounded-lg bg-background-elevated items-center justify-center mr-3">
          <Ionicons name="nutrition-outline" size={20} color="#6B6B80" />
        </View>
      )}

      <View className="flex-1">
        <Text className="text-white text-sm font-medium" numberOfLines={1}>
          {item.name}
        </Text>
        <View className="flex-row items-center gap-x-2 mt-0.5">
          {item.brand && (
            <Text className="text-text-muted text-xs" numberOfLines={1}>
              {item.brand}
            </Text>
          )}
          <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: badge.color + "20" }}>
            <Text className="text-xs font-medium" style={{ color: badge.color }}>
              {badge.label}
            </Text>
          </View>
        </View>
      </View>

      <View className="items-end ml-2">
        <Text className="text-white text-sm font-bold">{item.calories}</Text>
        <Text className="text-text-muted text-xs">
          {item.servingSize}{item.servingUnit}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Recent Food Item ───────────────────────────────
function RecentFoodItem({
  item,
  onSelect,
}: {
  item: RecentFood;
  onSelect: (item: RecentFood) => void;
}) {
  return (
    <TouchableOpacity
      className="flex-row items-center py-3 border-b border-background-elevated"
      onPress={() => onSelect(item)}
    >
      <View className="w-8 h-8 rounded-lg bg-background-elevated items-center justify-center mr-3">
        <Ionicons name="time-outline" size={16} color="#A0A0B0" />
      </View>
      <View className="flex-1">
        <Text className="text-white text-sm" numberOfLines={1}>{item.name}</Text>
        <Text className="text-text-muted text-xs">
          P:{Math.round(item.protein)} C:{Math.round(item.carbs)} G:{Math.round(item.fat)}
        </Text>
      </View>
      <Text className="text-white text-sm font-bold ml-2">{item.calories} kcal</Text>
    </TouchableOpacity>
  );
}

// ─── Macro Chip ─────────────────────────────────────
function MacroChip({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View className="items-center">
      <Text className="font-bold text-base" style={{ color }}>{value}{unit}</Text>
      <Text className="text-text-muted text-xs">{label}</Text>
    </View>
  );
}

// ─── Food Detail / Portion Selector ─────────────────
function FoodDetail({
  food,
  mealType,
  foodLog,
  onSave,
  onBack,
}: {
  food: FoodSearchResult | RecentFood;
  mealType: MealType;
  foodLog: FoodLogData | null;
  onSave: (data: any) => Promise<void>;
  onBack: () => void;
}) {
  const baseCals = food.calories;
  const baseServing = food.servingSize;

  const [servingMultiplier, setServingMultiplier] = useState("1");
  const [saving, setSaving] = useState(false);

  const multiplier = parseFloat(servingMultiplier) || 1;
  const adjustedCals = Math.round(baseCals * multiplier);
  const adjustedProtein = Math.round(food.protein * multiplier * 10) / 10;
  const adjustedCarbs = Math.round(food.carbs * multiplier * 10) / 10;
  const adjustedFat = Math.round(food.fat * multiplier * 10) / 10;
  const adjustedFiber = Math.round(food.fiber * multiplier * 10) / 10;
  const adjustedSugar = Math.round((food.sugar ?? 0) * multiplier * 10) / 10;
  const adjustedSodium = Math.round((food.sodium ?? 0) * multiplier * 10) / 10;

  // Contribution to daily goal
  const calGoal = foodLog?.calorieGoal ?? 2000;
  const protGoal = foodLog?.proteinGoal ?? 150;
  const calPct = calGoal > 0 ? Math.round((adjustedCals / calGoal) * 100) : 0;
  const protPct = protGoal > 0 ? Math.round((adjustedProtein / protGoal) * 100) : 0;

  const handleSave = async () => {
    setSaving(true);
    const sourceMap: Record<string, string> = {
      SAVED: "SAVED",
      OPEN_FOOD_FACTS: "SEARCH",
      USDA: "SEARCH",
    };
    const foodSource = "source" in food && typeof food.source === "string"
      ? (sourceMap[food.source] || food.source)
      : "MANUAL";

    try {
      await onSave({
        mealType,
        name: food.name,
        brand: food.brand || undefined,
        barcode: "barcode" in food ? food.barcode || undefined : undefined,
        servingSize: Math.round(baseServing * multiplier * 10) / 10,
        servingUnit: food.servingUnit,
        calories: adjustedCals,
        protein: adjustedProtein,
        carbs: adjustedCarbs,
        fat: adjustedFat,
        fiber: adjustedFiber,
        sugar: adjustedSugar,
        sodium: adjustedSodium,
        source: foodSource,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo agregar el alimento")
    } finally {
      setSaving(false);
    }
  };

  const presets = [0.5, 1, 1.5, 2];

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Back button */}
      <TouchableOpacity className="flex-row items-center mb-4" onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
        <Text className="text-text-secondary text-sm ml-1">Volver</Text>
      </TouchableOpacity>

      <Text className="text-white text-xl font-bold mb-1">{food.name}</Text>
      {food.brand && <Text className="text-text-muted text-sm mb-4">{food.brand}</Text>}

      {/* Portion selector */}
      <Text className="text-text-secondary text-sm mb-2">Porciones</Text>
      <View className="flex-row gap-x-2 mb-3">
        {presets.map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => {
              setServingMultiplier(String(p));
              Haptics.selectionAsync();
            }}
            className={`flex-1 py-2 rounded-xl items-center ${
              multiplier === p ? "bg-primary" : "bg-background-elevated"
            }`}
          >
            <Text className={`font-bold text-sm ${multiplier === p ? "text-white" : "text-text-secondary"}`}>
              {p}×
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom multiplier */}
      <View className="flex-row items-center gap-x-2 mb-4">
        <Text className="text-text-secondary text-sm">Personalizado:</Text>
        <TextInput
          className="bg-background-elevated text-white rounded-xl px-3 py-2 text-sm w-20 text-center"
          value={servingMultiplier}
          onChangeText={setServingMultiplier}
          keyboardType="decimal-pad"
        />
        <Text className="text-text-muted text-sm">
          × {baseServing}{food.servingUnit}
        </Text>
      </View>

      {/* Macro summary */}
      <View className="bg-background-elevated rounded-2xl p-4 mb-3">
        <Text className="text-white text-2xl font-bold text-center mb-3">
          {adjustedCals} kcal
        </Text>
        <View className="flex-row justify-around">
          <MacroChip label="Prot" value={adjustedProtein} unit="g" color="#FF6B6B" />
          <MacroChip label="Carbs" value={adjustedCarbs} unit="g" color="#6C63FF" />
          <MacroChip label="Grasa" value={adjustedFat} unit="g" color="#F59E0B" />
        </View>

        {(adjustedFiber > 0 || adjustedSugar > 0 || adjustedSodium > 0) && (
          <View className="flex-row justify-around mt-3 pt-3 border-t border-background">
            {adjustedFiber > 0 && <MacroChip label="Fibra" value={adjustedFiber} unit="g" color="#34D399" />}
            {adjustedSugar > 0 && <MacroChip label="Azúcar" value={adjustedSugar} unit="g" color="#F472B6" />}
            {adjustedSodium > 0 && <MacroChip label="Sodio" value={adjustedSodium} unit="mg" color="#60A5FA" />}
          </View>
        )}
      </View>

      {/* Contribution to daily goal */}
      <View className="bg-primary/10 rounded-2xl px-4 py-3 mb-4">
        <Text className="text-primary text-sm">
          Esto cubre el {calPct}% de tu meta de calorías y el {protPct}% de tu proteína
        </Text>
      </View>

      {/* Save button */}
      <TouchableOpacity
        className="bg-primary rounded-2xl py-4 items-center"
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base">
            Agregar a {MEAL_CONFIG[mealType].label}
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── AI Text Parse View ─────────────────────────────
function AiTextView({
  mealType,
  onSave,
  onBack,
}: {
  mealType: MealType;
  onSave: (data: any) => Promise<void>;
  onBack: () => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AiParsedFood[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleAnalyze = async () => {
    if (text.trim().length < 3) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await nutritionAPI.aiParse(text.trim(), mealType);
      const parsed = res.data.items;
      setItems(parsed);
      setSelected(new Set(parsed.map((_, i) => i)));
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Error al analizar";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSaveSelected = async () => {
    setSaving(true);
    const selectedIndices = Array.from(selected);
    const failures: string[] = [];

    try {
      const results = await Promise.allSettled(
        selectedIndices.map(async (idx) => {
          const item = items[idx];
          await onSave({
            mealType,
            name: item.name,
            servingSize: item.servingSize,
            servingUnit: item.servingUnit,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            sodium: item.sodium,
            source: "AI_TEXT",
            aiConfidence: item.confidence,
          });
          return item.name;
        })
      );

      results.forEach((result, idx) => {
        if (result.status === "rejected") {
          failures.push(items[selectedIndices[idx]].name);
        }
      });

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      if (successCount > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      if (failures.length > 0) {
        Alert.alert(
          "Algunos alimentos no pudieron guardarse",
          `No se pudieron agregar: ${failures.join(", ")}`
        );
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudieron agregar los alimentos")
    } finally {
      setSaving(false);
    }
  };

  const totalCals = items
    .filter((_, i) => selected.has(i))
    .reduce((s, item) => s + item.calories, 0);

  // Before analysis
  if (items.length === 0) {
    return (
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity className="flex-row items-center mb-4" onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
          <Text className="text-text-secondary text-sm ml-1">Volver</Text>
        </TouchableOpacity>

        <View className="flex-row items-center gap-x-2 mb-4">
          <Text className="text-lg">🤖</Text>
          <Text className="text-white font-bold text-base">Describe lo que comiste</Text>
        </View>

        <TextInput
          className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base mb-3"
          value={text}
          onChangeText={setText}
          placeholder='Ej: "2 huevos con pan tostado y jugo"'
          placeholderTextColor="#6B6B80"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: "top" }}
        />

        <View className="bg-background-elevated/50 rounded-xl p-3 mb-4">
          <Text className="text-text-muted text-xs mb-1">Tips:</Text>
          <Text className="text-text-muted text-xs">  - Incluye cantidades</Text>
          <Text className="text-text-muted text-xs">  - Menciona cómo fue preparado</Text>
          <Text className="text-text-muted text-xs">  - "100g de arroz con pollo"</Text>
        </View>

        <TouchableOpacity
          className={`rounded-2xl py-4 items-center ${text.trim().length >= 3 ? "bg-primary" : "bg-primary/30"}`}
          onPress={handleAnalyze}
          disabled={loading || text.trim().length < 3}
        >
          {loading ? (
            <View className="flex-row items-center gap-x-2">
              <ActivityIndicator color="white" size="small" />
              <Text className="text-white font-bold">Analizando...</Text>
            </View>
          ) : (
            <Text className="text-white font-bold text-base">Analizar</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // After analysis — show results with checkboxes
  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <TouchableOpacity className="flex-row items-center mb-4" onPress={() => { setItems([]); setText(""); }}>
        <Ionicons name="arrow-back" size={20} color="#A0A0B0" />
        <Text className="text-text-secondary text-sm ml-1">Nuevo análisis</Text>
      </TouchableOpacity>

      <View className="flex-row items-center gap-x-2 mb-3">
        <Text className="text-lg">🤖</Text>
        <Text className="text-white font-bold text-sm">
          Encontré {items.length} alimento{items.length !== 1 ? "s" : ""}:
        </Text>
      </View>

      {items.map((item, idx) => {
        const isSelected = selected.has(idx);
        const lowConf = item.confidence < 0.7;
        return (
          <TouchableOpacity
            key={idx}
            className={`flex-row items-center py-3 px-3 rounded-xl mb-2 ${
              lowConf ? "border border-amber-500/40" : "border border-background-elevated"
            } ${isSelected ? "bg-background-elevated" : "bg-background"}`}
            onPress={() => toggleItem(idx)}
          >
            <Ionicons
              name={isSelected ? "checkbox" : "square-outline"}
              size={22}
              color={isSelected ? "#6C63FF" : "#6B6B80"}
            />
            <View className="flex-1 ml-3">
              <View className="flex-row items-center gap-x-2">
                <Text className="text-white text-sm font-medium" numberOfLines={1}>{item.name}</Text>
                {lowConf && <Text className="text-amber-400 text-xs">⚠️</Text>}
              </View>
              <Text className="text-text-muted text-xs">
                {item.servingSize} {item.servingUnit} · P:{item.protein} C:{item.carbs} G:{item.fat}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-white text-sm font-bold">{item.calories}</Text>
              <Text className="text-text-muted text-xs">kcal</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Total */}
      <View className="bg-background-elevated rounded-xl p-3 mt-2 mb-4">
        <Text className="text-white text-center text-sm">
          Total: <Text className="font-bold">{totalCals} kcal</Text>
          {" · "}
          <Text className="font-bold">{selected.size}</Text> seleccionado{selected.size !== 1 ? "s" : ""}
        </Text>
      </View>

      <TouchableOpacity
        className={`rounded-2xl py-4 items-center ${selected.size > 0 ? "bg-primary" : "bg-primary/30"}`}
        onPress={handleSaveSelected}
        disabled={saving || selected.size === 0}
      >
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base">
            Agregar seleccionados ({selected.size})
          </Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Manual Entry Form ──────────────────────────────
function ManualForm({
  mealType,
  onSave,
}: {
  mealType: MealType;
  onSave: (data: any) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [servingSize, setServingSize] = useState("1");
  const [servingUnit, setServingUnit] = useState("porción");
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !calories.trim()) {
      Alert.alert("Error", "Nombre y calorías son requeridos");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        mealType,
        name: name.trim(),
        brand: brand.trim() || undefined,
        calories: parseInt(calories),
        protein: parseFloat(protein) || 0,
        carbs: parseFloat(carbs) || 0,
        fat: parseFloat(fat) || 0,
        fiber: parseFloat(fiber) || 0,
        sugar: parseFloat(sugar) || 0,
        sodium: parseFloat(sodium) || 0,
        servingSize: parseFloat(servingSize) || 1,
        servingUnit: servingUnit || "porción",
        source: "MANUAL",
      });

      // Save as favorite if toggled
      if (saveAsFavorite) {
        nutritionAPI.saveFavorite({
          name: name.trim(),
          brand: brand.trim() || undefined,
          servingSize: parseFloat(servingSize) || 1,
          servingUnit: servingUnit || "porción",
          calories: parseInt(calories),
          protein: parseFloat(protein) || 0,
          carbs: parseFloat(carbs) || 0,
          fat: parseFloat(fat) || 0,
          fiber: parseFloat(fiber) || 0,
          sugar: parseFloat(sugar) || 0,
          sodium: parseFloat(sodium) || 0,
        }).catch(() => {}); // best-effort
      }

      setName("");
      setBrand("");
      setCalories("");
      setProtein("");
      setCarbs("");
      setFat("");
      setFiber("");
      setSugar("");
      setSodium("");
      setServingSize("1");
      setServingUnit("porción");
      setSaveAsFavorite(false);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "No se pudo guardar el alimento")
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text className="text-text-secondary text-sm mb-1">Alimento *</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={name}
        onChangeText={setName}
        placeholder="Ej: Pechuga de pollo a la plancha"
        placeholderTextColor="#6B6B80"
      />

      <Text className="text-text-secondary text-sm mb-1">Marca (opcional)</Text>
      <TextInput
        className="bg-background-elevated text-white rounded-2xl px-4 py-3 mb-3 text-base"
        value={brand}
        onChangeText={setBrand}
        placeholder="Ej: Great Value"
        placeholderTextColor="#6B6B80"
      />

      <View className="flex-row gap-x-3 mb-3">
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">Cantidad</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={servingSize}
            onChangeText={setServingSize}
            keyboardType="decimal-pad"
          />
        </View>
        <View className="flex-1">
          <Text className="text-text-secondary text-sm mb-1">Unidad</Text>
          <TextInput
            className="bg-background-elevated text-white rounded-2xl px-4 py-3 text-base"
            value={servingUnit}
            onChangeText={setServingUnit}
            placeholder="g, ml, unidad..."
            placeholderTextColor="#6B6B80"
          />
        </View>
      </View>

      <Text className="text-white font-bold text-base mb-2">Macros</Text>
      <View className="flex-row gap-x-2 mb-3">
        {([
          { label: "Kcal *", value: calories, setter: setCalories, kb: "number-pad" as const },
          { label: "Prot (g)", value: protein, setter: setProtein, kb: "decimal-pad" as const },
          { label: "Carbs (g)", value: carbs, setter: setCarbs, kb: "decimal-pad" as const },
          { label: "Grasa (g)", value: fat, setter: setFat, kb: "decimal-pad" as const },
        ]).map(({ label, value, setter, kb }) => (
          <View key={label} className="flex-1">
            <Text className="text-text-secondary text-xs mb-1 text-center">{label}</Text>
            <TextInput
              className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
              value={value}
              onChangeText={setter}
              keyboardType={kb}
              placeholder="0"
              placeholderTextColor="#6B6B80"
            />
          </View>
        ))}
      </View>

      <Text className="text-white font-bold text-base mb-2">Micros (opcional)</Text>
      <View className="flex-row gap-x-2 mb-4">
        {([
          { label: "Fibra (g)", value: fiber, setter: setFiber },
          { label: "Azúcar (g)", value: sugar, setter: setSugar },
          { label: "Sodio (mg)", value: sodium, setter: setSodium },
        ]).map(({ label, value, setter }) => (
          <View key={label} className="flex-1">
            <Text className="text-text-secondary text-xs mb-1 text-center">{label}</Text>
            <TextInput
              className="bg-background-elevated text-white rounded-2xl px-3 py-3 text-base text-center"
              value={value}
              onChangeText={setter}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor="#6B6B80"
            />
          </View>
        ))}
      </View>

      {/* Save as favorite toggle */}
      <View className="flex-row items-center justify-between bg-background-elevated rounded-2xl px-4 py-3 mb-4">
        <View className="flex-row items-center gap-x-2">
          <Ionicons name="star" size={18} color="#F59E0B" />
          <Text className="text-white text-sm">Guardar en favoritos</Text>
        </View>
        <Switch
          value={saveAsFavorite}
          onValueChange={setSaveAsFavorite}
          trackColor={{ false: "#3A3A50", true: "#6C63FF" }}
          thumbColor="white"
        />
      </View>

      <TouchableOpacity
        className="bg-primary rounded-2xl py-4 items-center"
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-base">Agregar alimento</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Section with quick-add items ───────────────────
function QuickSection({
  title,
  icon,
  items,
  onSelect,
  emptyText,
  loading,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number }>;
  onSelect: (item: any) => void;
  emptyText?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <View className="mb-4">
        <Text className="text-text-secondary text-xs font-bold mb-2 uppercase">{title}</Text>
        <ActivityIndicator color="#6C63FF" size="small" />
      </View>
    );
  }
  if (items.length === 0) {
    if (!emptyText) return null;
    return (
      <View className="mb-4">
        <Text className="text-text-secondary text-xs font-bold mb-2 uppercase">{title}</Text>
        <Text className="text-text-muted text-xs">{emptyText}</Text>
      </View>
    );
  }

  return (
    <View className="mb-4">
      <Text className="text-text-secondary text-xs font-bold mb-2 uppercase">{title}</Text>
      {items.slice(0, 5).map((item, idx) => (
        <TouchableOpacity
          key={`${item.name}-${idx}`}
          className="flex-row items-center py-2.5 border-b border-background-elevated/50"
          onPress={() => {
            Haptics.selectionAsync();
            onSelect(item);
          }}
        >
          <View className="w-7 h-7 rounded-lg bg-background-elevated items-center justify-center mr-2.5">
            <Ionicons name={icon} size={14} color="#A0A0B0" />
          </View>
          <Text className="text-white text-sm flex-1" numberOfLines={1}>{item.name}</Text>
          <TouchableOpacity
            className="bg-primary/20 rounded-lg px-2.5 py-1 ml-2"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onSelect(item);
            }}
          >
            <Ionicons name="add" size={16} color="#6C63FF" />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════
// ─── Search cache (30s TTL) ─────────────────────────
const searchCache = new Map<string, { results: FoodSearchResult[]; hasMore: boolean; ts: number }>();
const SEARCH_CACHE_TTL = 30_000;

function getCachedSearch(query: string, page: number) {
  const key = `${query.toLowerCase().trim()}:${page}`;
  const entry = searchCache.get(key);
  if (entry && Date.now() - entry.ts < SEARCH_CACHE_TTL) return entry;
  return null;
}

function setCachedSearch(query: string, page: number, results: FoodSearchResult[], hasMore: boolean) {
  const key = `${query.toLowerCase().trim()}:${page}`;
  searchCache.set(key, { results, hasMore, ts: Date.now() });
  // Evict old entries to prevent memory growth
  if (searchCache.size > 50) {
    const oldest = [...searchCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) searchCache.delete(oldest[0]);
  }
}

export function clearSearchCache() {
  searchCache.clear();
}

export default function AddFoodModal({ visible, mealType, foodLog, onClose, onSave, onOpenBarcode }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [recentFoods, setRecentFoods] = useState<RecentFood[]>([]);
  const [favoriteFoods, setFavoriteFoods] = useState<any[]>([]);
  const [popularFoods, setPopularFoods] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [loadingHome, setLoadingHome] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodSearchResult | RecentFood | null>(null);
  const [showAiText, setShowAiText] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const homeLoadedRef = useRef(false);

  // Load home screen data (recents, favorites, popular) on first open
  useEffect(() => {
    if (visible && !homeLoadedRef.current) {
      homeLoadedRef.current = true;
      setLoadingHome(true);
      Promise.all([
        nutritionAPI.getRecent().then((r) => setRecentFoods(r.data.recent)).catch(() => {}),
        nutritionAPI.getSaved().then((r) => {
          const favs = (r.data as any[]).filter((s: any) => s.isFavorite);
          setFavoriteFoods(favs);
        }).catch(() => {}),
        nutritionAPI.getPopular().then((r) => setPopularFoods(r.data.results)).catch(() => {}),
      ]).finally(() => setLoadingHome(false));
    }
  }, [visible]);

  // Load recent foods when tab changes to recent
  useEffect(() => {
    if (tab === "recent" && recentFoods.length === 0 && !loadingHome) {
      setLoadingRecent(true);
      nutritionAPI.getRecent()
        .then((res) => setRecentFoods(res.data.recent))
        .catch(() => {})
        .finally(() => setLoadingRecent(false));
    }
  }, [tab, loadingHome, recentFoods]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!visible) {
      setQuery("");
      setSearchResults([]);
      setSelectedFood(null);
      setShowAiText(false);
      setTab("search");
      setSearchPage(1);
      setHasMoreResults(false);
      homeLoadedRef.current = false;
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
    }
  }, [])

  // Debounced search with cache
  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    setSearchPage(1);
    setHasMoreResults(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    // Check cache first
    const cached = getCachedSearch(text.trim(), 1);
    if (cached) {
      setSearchResults(cached.results);
      setHasMoreResults(cached.hasMore);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await nutritionAPI.search(text.trim(), 1);
        setSearchResults(res.data.results);
        setHasMoreResults(res.data.hasMore);
        setCachedSearch(text.trim(), 1, res.data.results, res.data.hasMore);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, []);

  // Load more results (pagination)
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMoreResults || query.trim().length < 2) return;
    const nextPage = searchPage + 1;

    // Check cache
    const cached = getCachedSearch(query.trim(), nextPage);
    if (cached) {
      setSearchResults((prev) => [...prev, ...cached.results]);
      setHasMoreResults(cached.hasMore);
      setSearchPage(nextPage);
      return;
    }

    setLoadingMore(true);
    try {
      const res = await nutritionAPI.search(query.trim(), nextPage);
      setSearchResults((prev) => [...prev, ...res.data.results]);
      setHasMoreResults(res.data.hasMore);
      setSearchPage(nextPage);
      setCachedSearch(query.trim(), nextPage, res.data.results, res.data.hasMore);
    } catch {} finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreResults, query, searchPage]);

  const handleSelectSearchResult = (item: FoodSearchResult) => {
    Haptics.selectionAsync();
    setSelectedFood(item);
  };

  const handleSelectRecent = (item: RecentFood) => {
    Haptics.selectionAsync();
    setSelectedFood(item);
  };

  const handleQuickAdd = (item: any) => {
    // Convert to a RecentFood-like object for FoodDetail
    const food: RecentFood = {
      name: item.name,
      brand: item.brand || null,
      barcode: item.barcode || null,
      servingSize: item.servingSize || 1,
      servingUnit: item.servingUnit || "porción",
      calories: item.calories,
      protein: item.protein || 0,
      carbs: item.carbs || 0,
      fat: item.fat || 0,
      fiber: item.fiber || 0,
      sugar: item.sugar || 0,
      sodium: item.sodium || 0,
      source: item.source || "SAVED",
    };
    setSelectedFood(food);
  };

  const handleSaveAndClose = async (data: any) => {
    await onSave(data);
    setSelectedFood(null);
  };

  const tabs: { key: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "search", label: "Buscar", icon: "search" },
    { key: "recent", label: "Recientes", icon: "time-outline" },
    { key: "manual", label: "Manual", icon: "create-outline" },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ maxHeight: "90%" }}
          >
            <View className="bg-background rounded-t-3xl p-5 pb-10" style={{ minHeight: 500 }}>
              {/* Header */}
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-white font-bold text-xl">
                  {selectedFood
                    ? "Detalle"
                    : showAiText
                    ? "🤖 AI Análisis"
                    : `Agregar a ${MEAL_CONFIG[mealType].label}`}
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color="#A0A0B0" />
                </TouchableOpacity>
              </View>

              {selectedFood ? (
                <FoodDetail
                  food={selectedFood}
                  mealType={mealType}
                  foodLog={foodLog}
                  onSave={handleSaveAndClose}
                  onBack={() => setSelectedFood(null)}
                />
              ) : showAiText ? (
                <AiTextView
                  mealType={mealType}
                  onSave={handleSaveAndClose}
                  onBack={() => setShowAiText(false)}
                />
              ) : (
                <>
                  {/* Tab bar */}
                  <View className="flex-row bg-background-elevated rounded-2xl p-1 mb-4">
                    {tabs.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setTab(t.key)}
                        className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-x-1 ${
                          tab === t.key ? "bg-primary" : ""
                        }`}
                      >
                        <Ionicons
                          name={t.icon}
                          size={14}
                          color={tab === t.key ? "white" : "#A0A0B0"}
                        />
                        <Text
                          className={`text-sm font-semibold ${
                            tab === t.key ? "text-white" : "text-text-muted"
                          }`}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Tab content */}
                  {tab === "search" && (
                    <View className="flex-1">
                      {/* Search bar */}
                      <View className="flex-row bg-background-elevated rounded-2xl px-4 py-3 items-center mb-3">
                        <Ionicons name="search" size={18} color="#6B6B80" />
                        <TextInput
                          className="flex-1 text-white text-base ml-2"
                          value={query}
                          onChangeText={handleSearch}
                          placeholder="Buscar alimento..."
                          placeholderTextColor="#6B6B80"
                          autoFocus
                          returnKeyType="search"
                        />
                        {searching && <ActivityIndicator size="small" color="#6C63FF" />}
                      </View>

                      {/* Quick action buttons */}
                      <View className="flex-row gap-x-2 mb-4">
                        <TouchableOpacity
                          className="flex-1 flex-row items-center justify-center bg-background-elevated rounded-xl py-2.5 gap-x-1.5"
                          onPress={onOpenBarcode}
                        >
                          <Ionicons name="barcode-outline" size={16} color="#34D399" />
                          <Text className="text-text-secondary text-xs font-semibold">Barcode</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 flex-row items-center justify-center bg-background-elevated rounded-xl py-2.5 gap-x-1.5"
                          onPress={() => setShowAiText(true)}
                        >
                          <Text className="text-sm">🤖</Text>
                          <Text className="text-text-secondary text-xs font-semibold">AI Texto</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 flex-row items-center justify-center bg-background-elevated rounded-xl py-2.5 gap-x-1.5"
                          onPress={() => setTab("manual")}
                        >
                          <Ionicons name="create-outline" size={16} color="#F59E0B" />
                          <Text className="text-text-secondary text-xs font-semibold">Manual</Text>
                        </TouchableOpacity>
                      </View>

                      {searchResults.length > 0 ? (
                        <FlatList
                          data={searchResults}
                          keyExtractor={(item) => item.id}
                          renderItem={({ item }) => (
                            <SearchResultItem item={item} onSelect={handleSelectSearchResult} />
                          )}
                          keyboardShouldPersistTaps="handled"
                          style={{ maxHeight: 300 }}
                          onEndReached={hasMoreResults ? handleLoadMore : undefined}
                          onEndReachedThreshold={0.3}
                          ListFooterComponent={
                            loadingMore ? (
                              <ActivityIndicator color="#6C63FF" size="small" style={{ paddingVertical: 12 }} />
                            ) : hasMoreResults ? (
                              <TouchableOpacity
                                className="py-3 items-center"
                                onPress={handleLoadMore}
                              >
                                <Text className="text-primary text-sm font-semibold">Cargar más</Text>
                              </TouchableOpacity>
                            ) : null
                          }
                        />
                      ) : query.length >= 2 && !searching ? (
                        <View className="items-center py-8">
                          <Ionicons name="search-outline" size={40} color="#3A3A50" />
                          <Text className="text-text-muted text-sm mt-2">
                            No se encontraron resultados
                          </Text>
                          <TouchableOpacity
                            className="mt-3 bg-primary/20 rounded-xl px-4 py-2"
                            onPress={() => setTab("manual")}
                          >
                            <Text className="text-primary text-sm font-semibold">Agregar manualmente</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Home screen: recientes, favoritos, populares */
                        <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
                          <QuickSection
                            title="Recientes"
                            icon="time-outline"
                            items={recentFoods}
                            onSelect={handleQuickAdd}
                            loading={loadingHome}
                          />
                          <QuickSection
                            title="Favoritos"
                            icon="star"
                            items={favoriteFoods}
                            onSelect={handleQuickAdd}
                            emptyText="Guarda alimentos como favoritos para verlos aquí"
                          />
                          <QuickSection
                            title="Populares"
                            icon="flame-outline"
                            items={popularFoods}
                            onSelect={handleQuickAdd}
                            loading={loadingHome && popularFoods.length === 0}
                          />
                        </ScrollView>
                      )}
                    </View>
                  )}

                  {tab === "recent" && (
                    <View className="flex-1">
                      {loadingRecent ? (
                        <ActivityIndicator color="#6C63FF" className="mt-8" />
                      ) : recentFoods.length > 0 ? (
                        <FlatList
                          data={recentFoods}
                          keyExtractor={(item, idx) => `${item.name}-${idx}`}
                          renderItem={({ item }) => (
                            <RecentFoodItem item={item} onSelect={handleSelectRecent} />
                          )}
                          keyboardShouldPersistTaps="handled"
                          style={{ maxHeight: 350 }}
                        />
                      ) : (
                        <View className="items-center py-8">
                          <Ionicons name="time-outline" size={40} color="#3A3A50" />
                          <Text className="text-text-muted text-sm mt-2">
                            Aún no tienes alimentos registrados
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {tab === "manual" && (
                    <ManualForm mealType={mealType} onSave={handleSaveAndClose} />
                  )}
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
