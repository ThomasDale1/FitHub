// ─────────────────────────────────────────────────────
// mobile/hooks/useProfile.ts
// Enhanced profile hooks — combo, stats, charts, posts, history
// ─────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from "react"
import {
  profileAPI,
  type ProfileComboData,
  type ProfileExpandedStats,
  type ProfileChartData,
  type ProfileHistoryItem,
  type ProfilePostsResponse,
  type ProfileBadgesResponse,
  type CompareResponse,
  type SocialPost,
} from "@/lib/api"

// ─── Hook: Profile Combo ─────────────────────────────
export function useProfileCombo(userId: string | null) {
  const [data, setData] = useState<ProfileComboData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      setError(null)
      const res = await profileAPI.getCombo(userId)
      setData(res.data)
    } catch (err: any) {
      setError(err.message || "Error al cargar perfil")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── Hook: Profile Stats ─────────────────────────────
export function useProfileStats(userId: string | null) {
  const [data, setData] = useState<ProfileExpandedStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getStats(userId)
      setData(res.data)
    } catch (err) {
      console.error("Profile stats error:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, refetch: fetch }
}

// ─── Hook: Chart Data ────────────────────────────────
export function useProfileChart(userId: string | null, type: string, period: string = "3m") {
  const [data, setData] = useState<ProfileChartData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getChart(userId, type, period)
      setData(res.data)
    } catch (err) {
      console.error(`Chart ${type} error:`, err)
    } finally {
      setLoading(false)
    }
  }, [userId, type, period])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, refetch: fetch }
}

// ─── Hook: Profile Posts (cursor-based) ──────────────
export function useProfilePosts(userId: string | null) {
  const [posts, setPosts] = useState<SocialPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const cursorRef = useRef<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getPosts(userId)
      setPosts(res.data.posts)
      cursorRef.current = res.data.nextCursor
      setHasMore(res.data.hasMore)
    } catch (err) {
      console.error("Profile posts error:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchMore = useCallback(async () => {
    if (!userId || !cursorRef.current || loadingMore) return
    try {
      setLoadingMore(true)
      const res = await profileAPI.getPosts(userId, cursorRef.current)
      setPosts(prev => [...prev, ...res.data.posts])
      cursorRef.current = res.data.nextCursor
      setHasMore(res.data.hasMore)
    } catch (err) {
      console.error("Profile posts load more error:", err)
    } finally {
      setLoadingMore(false)
    }
  }, [userId, loadingMore])

  useEffect(() => { fetch() }, [fetch])

  return { posts, loading, loadingMore, hasMore, refetch: fetch, fetchMore }
}

// ─── Hook: Workout History (offset-based) ────────────
export function useProfileHistory(userId: string | null) {
  const [workouts, setWorkouts] = useState<ProfileHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getHistory(userId, 1)
      setWorkouts(res.data.workouts)
      setPage(1)
      setTotalPages(res.data.totalPages)
      setTotal(res.data.total)
    } catch (err) {
      console.error("Profile history error:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  const fetchMore = useCallback(async () => {
    if (!userId || loadingMore || page >= totalPages) return
    try {
      setLoadingMore(true)
      const nextPage = page + 1
      const res = await profileAPI.getHistory(userId, nextPage)
      setWorkouts(prev => [...prev, ...res.data.workouts])
      setPage(nextPage)
    } catch (err) {
      console.error("Profile history load more error:", err)
    } finally {
      setLoadingMore(false)
    }
  }, [userId, loadingMore, page, totalPages])

  useEffect(() => { fetch() }, [fetch])

  return { workouts, loading, loadingMore, total, hasMore: page < totalPages, refetch: fetch, fetchMore }
}

// ─── Hook: Profile Badges ────────────────────────────
export function useProfileBadges(userId: string | null) {
  const [data, setData] = useState<ProfileBadgesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getBadges(userId)
      setData(res.data)
    } catch (err) {
      console.error("Profile badges error:", err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, refetch: fetch }
}

// ─── Hook: Compare ───────────────────────────────────
export function useProfileCompare(userId: string | null) {
  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      setError(null)
      const res = await profileAPI.getCompare(userId)
      setData(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.error || "Error al comparar")
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}
