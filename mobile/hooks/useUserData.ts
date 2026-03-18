// ─────────────────────────────────────────────────────
// mobile/hooks/useUserData.ts
// Sprint 2: Hooks para datos de usuario y dashboard
// ─────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import {
  userAPI,
  type UserProfile,
  type UserStats,
  type DashboardData,
  type WeeklyProgress,
} from "@/lib/api";


// ─── Hook: Dashboard Data ────────────────────────────
export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userAPI.getDashboard();
      setData(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar dashboard");
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

// ─── Hook: User Profile ──────────────────────────────
export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userAPI.getProfile();
      setProfile(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile>) => {
    try {
      const response = await userAPI.updateProfile(data);
      setProfile(response.data);
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || "Error al actualizar perfil");
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { profile, loading, error, refetch: fetch, updateProfile };
}

// ─── Hook: User Stats (lifetime) ─────────────────────
export function useUserStats() {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await userAPI.getStats();
      setStats(response.data);
    } catch (err: any) {
      setError(err.message || "Error al cargar estadísticas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stats, loading, error, refetch: fetch };
}

// ─── Hook: Weekly Progress ───────────────────────────
export function useProgress() {
  const [progress, setProgress] = useState<WeeklyProgress | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const response = await userAPI.getProgress();
      setProgress(response.data);
    } catch (err) {
      console.error("Progress error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { progress, loading, refetch: fetch };
}