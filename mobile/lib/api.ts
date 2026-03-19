// ─────────────────────────────────────────────────────
// mobile/lib/api.ts
// Sprint 2: API completa con endpoints de usuario
// ─────────────────────────────────────────────────────
import axios from "axios";

export const API_URL = "https://fithub-d1pe.onrender.com";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 100000,
});

// ─── Auth interceptor automático ─────────────────────
// Inyecta el token en cada request automáticamente
let getTokenFn: (() => Promise<string | null>) | null = null;

export const setGetTokenFn = (fn: () => Promise<string | null>) => {
  getTokenFn = fn;
};

api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
  }
  return config;
});

// ─── Retry interceptor (para cold starts de Render) ──
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    // Solo reintentar en timeout o network error, máximo 1 retry
    if (
      (error.code === "ECONNABORTED" || !error.response) &&
      !config._retry
    ) {
      config._retry = true;
      // Esperar 2 segundos antes de reintentar
      await new Promise((r) => setTimeout(r, 2000));
      return api(config);
    }
    return Promise.reject(error);
  }
);

// ─── Auth interceptor ─────────────────────────────────
// Configurar esto en el layout raíz para inyectar el token

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
  calorieGoal: number | null;
  proteinGoal: number | null;
  carbsGoal: number | null;
  fatGoal: number | null;
  activityLevel: string | null;
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

export interface FoodEntry {
  id: string;
  foodLogId: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
  name: string;
  brand: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
  createdAt: string;
}
 
export interface FoodLogData {
  id: string;
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  calorieGoal: number;
  proteinGoal: number;
  carbsGoal: number;
  fatGoal: number;
  waterMl: number;
  waterGoalMl: number;
  entries: FoodEntry[];
  meals: {
    BREAKFAST: FoodEntry[];
    LUNCH: FoodEntry[];
    DINNER: FoodEntry[];
    SNACK: FoodEntry[];
  };
  macroPercentages?: {
    protein: number;
    carbs: number;
    fat: number;
  };
}
 
export interface AiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface SocialPost {
  id: string;
  userId: string;
  content: string | null;
  imageUrls: string[];
  postType: string;
  workoutData: any;
  isPublic: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    level: number;
  };
  reactionsCount: number;
  myReaction: string | null;
  _count: { comments: number };
}
 
export interface SocialComment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
  };
  replies?: SocialComment[];
}
 
export interface ChallengeData {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  // ← goal y unit son los campos reales del schema
  goal: number;
  unit: string;
  startDate: string;
  endDate: string;
  isPublic: boolean;
  maxParticipants: number | null;
  xpReward: number;
  createdAt: string;
  isJoined: boolean;
  participantsCount: number;
  creator: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    level: number;
  };
  // El progreso del usuario actual en este challenge
  myProgress: {
    currentValue: number;  // ← currentValue, no progress
    isWinner: boolean;
    rank: number | null;
  } | null;
  // Lista de participantes (solo en getById, incluye rank y percentage)
  participants: ChallengeParticipantData[];
}

export interface ChallengeParticipantData {
  id: string;
  userId: string;
  currentValue: number;
  isWinner: boolean;
  rank: number;
  percentage: number;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    username: string;
    avatarUrl: string | null;
    level: number;
    xp: number;
  };
}

export interface LeaderboardUser {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streak: number;
  rank: number;
  value: number;
  unit: string;
}
 
export interface BadgeData {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xpReward: number;
  earned: boolean;
  earnedAt: string | null;
}
 
export interface UserSuggestion {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streak: number;
  bio: string | null;
  _count: { workouts: number };
}

// ─── Types: Steps ─────────────────────────────────────
export interface DailyStepsData {
  id: string;
  steps: number;
  goal: number;
  calories: number;
  distanceKm: number;
  activeMinutes: number;
  floors: number;
  hourlySteps: number[] | null;
  goalPercentage: number;
  goalReached: boolean;
}

export interface WeekDayData {
  date: string;
  dayLabel: string;
  steps: number;
  goal: number;
  calories: number;
  distanceKm: number;
  activeMinutes: number;
  goalReached: boolean;
  isToday: boolean;
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

export const nutritionAPI = {
  // Log de hoy
  getToday: () => api.get<FoodLogData>("/api/nutrition/today"),
 
  // Log de un día específico
  getByDate: (date: string) =>
    api.get<FoodLogData>(`/api/nutrition/date/${date}`),
 
  // Agregar alimento
  addEntry: (data: {
    mealType: string;
    name: string;
    brand?: string;
    servingSize?: number;
    servingUnit?: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    source?: string;
    date?: string;
  }) => api.post("/api/nutrition/entry", data),
 
  // Eliminar alimento
  deleteEntry: (id: string) => api.delete(`/api/nutrition/entry/${id}`),
 
  // Agregar agua
  addWater: (amount: number) =>
    api.post("/api/nutrition/water", { amount }),
 
  // Actualizar metas
  updateGoals: (data: {
    calorieGoal?: number;
    proteinGoal?: number;
    carbsGoal?: number;
    fatGoal?: number;
  }) => api.put("/api/nutrition/goals", data),
 
  // Historial 7 días
  getHistory: () => api.get("/api/nutrition/history"),
 
  // Alimentos guardados
  getSaved: () => api.get("/api/nutrition/saved"),
  saveFavorite: (data: any) => api.post("/api/nutrition/saved", data),
};
 
// ─── AI Coach API (Sprint 3B) ─────────────────────────
export const aiAPI = {
  // Enviar mensaje
  chat: (message: string) =>
    api.post<{ message: string; xpEarned: number }>("/api/ai/chat", { message }),
 
  // Historial
  getHistory: () =>
    api.get<{ messages: AiMessage[] }>("/api/ai/history"),
 
  // Borrar historial
  clearHistory: () => api.delete("/api/ai/history"),
 
  // Respuestas rápidas
  quick: (type: "workout_suggestion" | "nutrition_tip" | "motivation" | "recovery") =>
    api.post<{ message: string; xpEarned: number; type: string }>("/api/ai/quick", { type }),
};

export const socialAPI = {
  // Feed
  getFeed: (cursor?: string) =>
    api.get(`/api/social/feed${cursor ? `?cursor=${cursor}` : ""}`),
 
  // Posts
  createPost: (data: { content?: string; imageUrls?: string[]; postType?: string; workoutData?: any }) =>
    api.post("/api/social/posts", data),
 
  // Reactions
  react: (postId: string, type: string) =>
    api.post("/api/social/react", { postId, type }),
 
  // Comments
  getComments: (postId: string) =>
    api.get(`/api/social/comments/${postId}`),
  addComment: (postId: string, content: string, parentId?: string) =>
    api.post("/api/social/comments", { postId, content, parentId }),
 
  // Follows
  follow: (targetUserId: string) =>
    api.post("/api/social/follow", { targetUserId }),
  unfollow: (userId: string) =>
    api.delete(`/api/social/follow/${userId}`),
  getFollowers: () => api.get("/api/social/followers"),
  getFollowing: () => api.get("/api/social/following"),
 
  // Discover
  discover: () => api.get("/api/social/discover"),
 
  // Profile
  getProfile: (userId: string) =>
    api.get(`/api/social/profile/${userId}`),
 
  // Notifications
  getNotifications: () => api.get("/api/social/notifications"),
  markNotificationsRead: () => api.put("/api/social/notifications/read"),
};
 
// ─── Challenges API (Sprint 4) ────────────────────────
export const challengesAPI = {
  getAll: (filter: "active" | "mine" | "available" = "active") =>
    api.get<ChallengeData[]>(`/api/challenges?filter=${filter}`),

  getById: (id: string) =>
    api.get<ChallengeData>(`/api/challenges/${id}`),

  create: (data: {
    title: string;
    description?: string;
    type: string;
    goal: number;
    unit: string;
    startDate: string;
    endDate: string;
    isPublic?: boolean;
    maxParticipants?: number;
    xpReward?: number;
  }) => api.post<ChallengeData>("/api/challenges", data),

  join: (id: string) =>
    api.post(`/api/challenges/${id}/join`),

  leave: (id: string) =>
    api.post(`/api/challenges/${id}/leave`),

  getLeaderboard: (
    category: "xp" | "volume" | "streak" = "xp",
    period: "weekly" | "monthly" | "alltime" = "alltime"
  ) =>
    api.get<LeaderboardUser[]>(
      `/api/challenges/leaderboard/global?category=${category}&period=${period}`
    ),
};
 
// ─── Badges API (Sprint 4) ───────────────────────────
export const badgesAPI = {
  getAll: () => api.get("/api/badges"),
  check: () => api.post("/api/badges/check"),
  seed: () => api.post("/api/badges/seed"),
};

// ─── Push Token API ──────────────────────────────────
export const pushTokenAPI = {
  register: (token: string, platform: string) =>
    api.post("/api/push-token", { token, platform }),
  unregister: (token: string) =>
    api.delete("/api/push-token", { data: { token } }),
};

// ─── Steps API ────────────────────────────────────────
export const stepsAPI = {
  syncSteps: (steps: number, hourlySteps?: number[]) => {
    // Enviar fecha local (YYYY-MM-DD) para que el backend no use UTC
    const localDate = new Date().toLocaleDateString("en-CA");
    return api.post("/api/steps/sync", { steps, hourlySteps, date: localDate });
  },

  getToday: () => api.get<DailyStepsData>("/api/steps/today"),

  getWeek: () =>
    api.get<{ days: WeekDayData[]; weekTotal: any; avgSteps: number }>("/api/steps/week"),

  getMonth: (year?: number, month?: number) =>
    api.get(`/api/steps/month${year ? `?year=${year}&month=${month}` : ""}`),

  updateGoal: (goal: number) =>
    api.put("/api/steps/goal", { goal }),
};