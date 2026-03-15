import axios from "axios";

// En desarrollo apunta a tu backend local
// En producción cambiará a la URL de Render
export const API_URL = "https://fithub-d1pe.onrender.com";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// Tipos de Exercise
export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  instructions: string[];
  secondaryMuscles: string[];
  difficulty?: string;
  category?: string;
}

// Funciones de ejercicios
export const exerciseAPI = {
  getBodyParts: () =>
    api.get<string[]>("/api/exercises/bodyparts"),

  getByBodyPart: (bodyPart: string) =>
    api.get<Exercise[]>(`/api/exercises/bodypart/${bodyPart}`),

  search: (name: string) =>
    api.get<Exercise[]>(`/api/exercises/search?name=${name}`),

  getById: (id: string) =>
    api.get<Exercise>(`/api/exercises/${id}`),

  getGifUrl: (id: string, resolution: "180" | "360" | "720" | "1080" = "180") =>
    `${API_URL}/api/exercises/${id}/image?resolution=${resolution}`,
};