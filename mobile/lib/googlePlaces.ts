import { api } from "./api";

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

// ─── API (proxied through our backend) ──────────────
export const googlePlacesAPI = {
  textSearch: async (
    query: string,
    lat?: number,
    lng?: number,
  ): Promise<GooglePlace[]> => {
    try {
      const params = new URLSearchParams({ q: query });
      if (lat != null) params.append("lat", String(lat));
      if (lng != null) params.append("lng", String(lng));

      const res = await api.get<GooglePlace[]>(
        `/api/places/google-search?${params.toString()}`,
      );
      return res.data;
    } catch (e) {
      console.error("Google Places search error:", e);
      return [];
    }
  },
};
