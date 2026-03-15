// ─────────────────────────────────────────────────────
// mobile/lib/api.ts
// Sprint 2: API completa con endpoints de usuario
// ─────────────────────────────────────────────────────
import axios from "axios";

export const API_URL = "https://fithub-d1pe.onrender.com";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

// ─── Auth interceptor ─────────────────────────────────
// Configurar esto en el layout raíz para inyectar el token
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common["Authorization"];
  }
};

// ─── Types ────────────────────────────────────────────
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

export interface UserProfile {
  id: string;
  clerkId: string;
  email: string;
  username: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  weight: number | null;
  height: number | null;
  bodyFat: number | null;
  xp: number;
  level: number;
  currentXP: number;
  maxXP: number;
  streak: number;
  lastWorkout: string | null;
  createdAt: string;
}

export interface UserStats {
  totalWorkouts: number;
  totalVolume: number;
  totalMinutes: number;
  totalPRs: number;
  longestWorkout: { duration: number; name: string } | null;
  topExercise: { name: string; count: number } | null;
  memberSince: string;
}

export interface DashboardData {
  user: {
    name: string;
    avatarUrl: string | null;
    xp: number;
    level: number;
    currentXP: number;
    maxXP: number;
    streak: number;
  };
  weekStats: {
    workouts: number;
    calories: number;
    volume: number;
    minutes: number;
  };
  recentWorkouts: Array<{
    id: string;
    name: string;
    date: string;
    duration: number;
    xpEarned: number;
    setsCount: number;
  }>;
  activeGoals: Array<{
    id: string;
    title: string;
    description: string | null;
    targetValue: number | null;
    currentValue: number | null;
    unit: string | null;
    isCompleted: boolean;
  }>;
}

export interface WeeklyProgress {
  weeks: Array<{
    week: string;
    workouts: number;
    volume: number;
    xp: number;
  }>;
}

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  isCompleted: boolean;
}

// ─── Exercise API ─────────────────────────────────────
export const exerciseAPI = {
  getBodyParts: () => api.get<string[]>("/api/exercises/bodyparts"),

  getByBodyPart: (bodyPart: string) =>
    api.get<Exercise[]>(`/api/exercises/bodypart/${bodyPart}`),

  search: (name: string) =>
    api.get<Exercise[]>(`/api/exercises/search?name=${name}`),

  getById: (id: string) => api.get<Exercise>(`/api/exercises/${id}`),

  getGifUrl: (
    id: string,
    resolution: "180" | "360" | "720" | "1080" = "180"
  ) => `${API_URL}/api/exercises/${id}/image?resolution=${resolution}`,
};

// ─── User API (Sprint 2) ─────────────────────────────
export const userAPI = {
  // Perfil del usuario
  getProfile: () => api.get<UserProfile>("/api/users/me"),

  // Actualizar perfil
  updateProfile: (data: Partial<UserProfile>) =>
    api.put<UserProfile>("/api/users/me", data),

  // Stats del perfil (lifetime stats)
  getStats: () => api.get<UserStats>("/api/users/stats"),

  // Dashboard data (stats semanales + recientes)
  getDashboard: () => api.get<DashboardData>("/api/users/dashboard"),

  // Progreso semanal (últimas 8 semanas)
  getProgress: () => api.get<WeeklyProgress>("/api/users/progress"),

  // Goals
  getGoals: () => api.get<Goal[]>("/api/users/goals"),
  createGoal: (data: { title: string; description?: string; targetValue?: number; unit?: string }) =>
    api.post<Goal>("/api/users/goals", data),
};

// ─── Workout API ──────────────────────────────────────
export const workoutAPI = {
  getAll: () => api.get("/api/workouts"),

  start: (name: string, templateId?: string) =>
    api.post("/api/workouts/start", { name, templateId }),

  addSet: (workoutId: string, data: any) =>
    api.post(`/api/workouts/${workoutId}/sets`, data),

  finish: (workoutId: string) =>
    api.post(`/api/workouts/${workoutId}/finish`),

  getTemplates: () => api.get("/api/workouts/templates"),

  createTemplate: (data: any) =>
    api.post("/api/workouts/templates", data),

  getPRs: () => api.get("/api/workouts/prs"),
};