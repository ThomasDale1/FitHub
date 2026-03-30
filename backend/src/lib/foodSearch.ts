// ─────────────────────────────────────────────────────
// backend/src/lib/foodSearch.ts
// Food search service — Open Food Facts + USDA FoodData Central
// ─────────────────────────────────────────────────────

export interface FoodSearchResult {
  id: string            // "off:{barcode}" | "usda:{fdcId}" | "saved:{id}"
  name: string
  brand: string | null
  barcode: string | null
  source: "SAVED" | "OPEN_FOOD_FACTS" | "USDA"
  imageUrl: string | null

  servingSize: number
  servingUnit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  sodium: number
}

// ─── Open Food Facts normalization ───────────────────

function parseServingSize(servingStr: string | undefined): { size: number; unit: string } {
  if (!servingStr) return { size: 100, unit: "g" }

  // Common patterns: "30g", "1 cup (240ml)", "100 g", "1 slice (28g)"
  const match = servingStr.match(/(\d+\.?\d*)\s*(g|ml|oz|kg|l)/i)
  if (match) {
    const parsedSize = parseFloat(match[1])
    if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
      return { size: 100, unit: "g" }
    }
    return { size: parsedSize, unit: match[2].toLowerCase() }
  }

  return { size: 100, unit: "g" }
}

export function normalizeOpenFoodFacts(product: any): FoodSearchResult | null {
  if (!product || !product.product_name) return null

  const n = product.nutriments || {}
  const serving = parseServingSize(product.serving_size)

  // Per-serving values if available, otherwise calculate from 100g
  const factor = serving.size / 100

  const caloriesPer100 = n["energy-kcal_100g"] ?? n["energy-kcal"] ?? 0
  const proteinPer100 = n.proteins_100g ?? 0
  const carbsPer100 = n.carbohydrates_100g ?? 0
  const fatPer100 = n.fat_100g ?? 0
  const fiberPer100 = n.fiber_100g ?? 0
  const sugarPer100 = n.sugars_100g ?? 0
  const sodiumPer100g = n.sodium_100g ?? 0 // in grams, convert to mg

  return {
    id: `off:${product.code || product._id || "unknown"}`,
    name: product.product_name,
    brand: product.brands || null,
    barcode: product.code || null,
    source: "OPEN_FOOD_FACTS",
    imageUrl: product.image_small_url || product.image_url || null,

    servingSize: serving.size,
    servingUnit: serving.unit,
    calories: Math.round(caloriesPer100 * factor),
    protein: round1(proteinPer100 * factor),
    carbs: round1(carbsPer100 * factor),
    fat: round1(fatPer100 * factor),
    fiber: round1(fiberPer100 * factor),
    sugar: round1(sugarPer100 * factor),
    sodium: round1(sodiumPer100g * 1000 * factor), // g → mg
  }
}

// ─── USDA FoodData Central normalization ─────────────

// Nutrient IDs: 1008=Energy, 1003=Protein, 1005=Carbs, 1004=Fat, 1079=Fiber, 2000=Sugars, 1093=Sodium
const USDA_NUTRIENT_MAP: Record<number, string> = {
  1008: "calories",
  1003: "protein",
  1005: "carbs",
  1004: "fat",
  1079: "fiber",
  2000: "sugar",
  1093: "sodium",
}

export function normalizeUSDA(food: any): FoodSearchResult | null {
  if (!food || !food.description) return null

  const nutrients: Record<string, number> = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
  }

  const foodNutrients = food.foodNutrients || []
  for (const fn of foodNutrients) {
    const id = fn.nutrientId ?? fn.nutrient?.id
    const key = USDA_NUTRIENT_MAP[id]
    if (key) {
      nutrients[key] = fn.value ?? fn.amount ?? 0
    }
  }

  // USDA values are per 100g by default
  return {
    id: `usda:${food.fdcId}`,
    name: food.description,
    brand: food.brandName || food.brandOwner || null,
    barcode: food.gtinUpc || null,
    source: "USDA",
    imageUrl: null,

    servingSize: 100,
    servingUnit: "g",
    calories: Math.round(nutrients.calories),
    protein: round1(nutrients.protein),
    carbs: round1(nutrients.carbs),
    fat: round1(nutrients.fat),
    fiber: round1(nutrients.fiber),
    sugar: round1(nutrients.sugar),
    sodium: round1(nutrients.sodium),
  }
}

// ─── Search functions ────────────────────────────────

const OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
const OFF_PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product"
const USDA_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search"

export async function searchOpenFoodFacts(
  query: string,
  pageSize = 15,
  offset = 0,
): Promise<FoodSearchResult[]> {
  try {
    const page = Math.floor(offset / pageSize) + 1
    const params = new URLSearchParams({
      search_terms: query,
      search_simple: "1",
      action: "process",
      json: "1",
      page_size: String(pageSize),
      page: String(page),
      fields: "product_name,brands,nutriments,code,image_small_url,serving_size",
    })

    const res = await fetch(`${OFF_SEARCH_URL}?${params}`, {
      headers: { "User-Agent": "FitHub/1.0 (fitness app)" },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const data: any = await res.json()
    const products = data.products || []

    return products
      .map(normalizeOpenFoodFacts)
      .filter((r: FoodSearchResult | null): r is FoodSearchResult => r !== null)
  } catch {
    console.error("[foodSearch] Open Food Facts search failed")
    return []
  }
}

export async function searchUSDA(
  query: string,
  pageSize = 10,
  offset = 0,
): Promise<FoodSearchResult[]> {
  try {
    const pageNumber = Math.floor(offset / pageSize) + 1
    const apiKey = process.env.USDA_API_KEY
    if (!apiKey) {
      const warning = "[foodSearch] USDA_API_KEY is missing. Falling back to DEMO_KEY."
      console.warn(warning)
      if (process.env.NODE_ENV === "production") {
        throw new Error(`${warning} Production requires a valid USDA_API_KEY.`)
      }
    }
    const params = new URLSearchParams({
      query,
      pageSize: String(pageSize),
      pageNumber: String(pageNumber),
      dataType: "Foundation,SR Legacy,Branded",
      api_key: apiKey || "DEMO_KEY",
    })

    const res = await fetch(`${USDA_SEARCH_URL}?${params}`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return []

    const data: any = await res.json()
    const foods = data.foods || []

    return foods
      .map(normalizeUSDA)
      .filter((r: FoodSearchResult | null): r is FoodSearchResult => r !== null)
  } catch {
    console.error("[foodSearch] USDA search failed")
    return []
  }
}

export async function lookupBarcode(code: string): Promise<FoodSearchResult | null> {
  try {
    const res = await fetch(
      `${OFF_PRODUCT_URL}/${code}.json?fields=product_name,brands,nutriments,code,image_small_url,serving_size`,
      {
        headers: { "User-Agent": "FitHub/1.0 (fitness app)" },
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!res.ok) return null

    const data: any = await res.json()
    if (data.status === 0 || !data.product) return null

    return normalizeOpenFoodFacts(data.product)
  } catch {
    console.error("[foodSearch] Barcode lookup failed")
    return null
  }
}

// ─── Helpers ─────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
