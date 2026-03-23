import { Platform } from "react-native";

const getApiKey = (): string =>
  Platform.OS === "ios"
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS || ""
    : process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID || "";

// Places API (New) endpoint
const BASE_URL = "https://places.googleapis.com/v1/places";

// Pro tier fields — photos included at no extra cost ($32 / 1K for Text Search)
const FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos";

// ─── Normalized type for the UI ─────────────────────
export interface GooglePlace {
  place_id: string;
  name: string;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  types: string[];
  photoUri: string | null;
}

/**
 * Build a photo URL from a Places API (New) photo resource name.
 * Format: places/{placeId}/photos/{photoRef}/media?maxWidthPx=400&key=KEY
 */
const buildPhotoUrl = (photoName: string | undefined): string | null => {
  if (!photoName) return null;
  const key = getApiKey();
  if (!key) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${key}`;
};

// ─── API ────────────────────────────────────────────
export const googlePlacesAPI = {
  textSearch: async (
    query: string,
    lat?: number,
    lng?: number,
  ): Promise<GooglePlace[]> => {
    const key = getApiKey();
    if (!key) return [];

    try {
      const body: Record<string, any> = { textQuery: query };

      if (lat != null && lng != null) {
        body.locationBias = {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 10000,
          },
        };
      }

      const res = await fetch(`${BASE_URL}:searchText`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.places) return [];

      return data.places.map((p: any) => ({
        place_id: p.id,
        name: p.displayName?.text || "",
        formatted_address: p.formattedAddress || null,
        latitude: p.location?.latitude || 0,
        longitude: p.location?.longitude || 0,
        types: p.types || [],
        photoUri: buildPhotoUrl(p.photos?.[0]?.name),
      }));
    } catch (e) {
      console.error("Google Places search error:", e);
      return [];
    }
  },
};
