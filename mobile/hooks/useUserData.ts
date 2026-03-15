// ─────────────────────────────────────────────────────
// mobile/hooks/useUserData.ts
// Sprint 2: Hooks para datos de usuario y dashboard
// ─────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-expo";
import {
  userAPI,
  setAuthToken,
  type UserProfile,
  type UserStats,
  type DashboardData,
  type WeeklyProgress,
} from "@/lib/api";

// ─── Hook: Auth Token Setup ──────────────────────────
// Usar en el layout raíz para configurar el token globalmente
export function useAuthSetup() {
  const { getToken } = useAuth();

  useEffect(() => {
    const setupToken = async () => {
      try {
        const token = await getToken();
        setAuthToken(token);
      } catch (error) {
        console.error("Error obteniendo token:", error);
      }
    };

    setupToken();

    // Refrescar token cada 50 segundos (expira en 60s)
    const interval = setInterval(setupToken, 50000);
    return () => clearInterval(interval);
  }, [getToken]);
}

// ─── Hook: Dashboard Data ────────────────────────────
export function useDashboard() {
  const { getToken } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      setAuthToken(token);
      const response = await userAPI.getDashboard();
      setData(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar dashboard");
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Hook: User Profile ──────────────────────────────
export function useProfile() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      setAuthToken(token);
      const response = await userAPI.getProfile();
      setProfile(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const updateProfile = useCallback(
    async (data: Partial<UserProfile>) => {
      try {
        const token = await getToken();
        setAuthToken(token);
        const response = await userAPI.updateProfile(data);
        setProfile(response.data);
        return response.data;
      } catch (err: any) {
        throw new Error(err.message || "Error al actualizar perfil");
      }
    },
    [getToken]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { profile, loading, error, refetch: fetch, updateProfile };
}

// ─── Hook: User Stats (lifetime) ─────────────────────
export function useUserStats() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      setAuthToken(token);
      const response = await userAPI.getStats();
      setStats(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, loading, error, refetch: fetch };
}

// ─── Hook: Weekly Progress ───────────────────────────
export function useProgress() {
  const { getToken } = useAuth();
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      setAuthToken(token);
      const response = await userAPI.getProgress();
      setProgress(response.data);
    } catch (err) {
      console.error("Progress error:", err);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { progress, loading, refetch: fetch };
}