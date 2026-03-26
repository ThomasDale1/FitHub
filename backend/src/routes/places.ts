// ─────────────────────────────────────────────────────
// backend/src/routes/places.ts
// Places (gyms, universities, clubs) — CRUD + nearby
// ─────────────────────────────────────────────────────
import { Router, Request, Response } from "express"
import { prisma } from "../lib/prisma.js"
import { requireAuth } from "../middleware/auth.js"
import { getAuth } from "@clerk/express"

import { getUserByClerkId } from "../lib/userHelpers.js"

const router = Router()
router.use(requireAuth)

// ═══════════════════════════════════════════════════════
// GET /api/places/nearby?lat=X&lng=Y&radius=5
// Returns places within radius (km) using bounding box
// ═══════════════════════════════════════════════════════
router.get("/nearby", async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string)
    const lng = parseFloat(req.query.lng as string)
    const radius = parseFloat(req.query.radius as string) || 5 // km

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ error: "lat y lng son requeridos" }); return
    }

    // Bounding box approximation (1 degree ≈ 111 km)
    const latDelta = radius / 111
    const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180))

    const places = await prisma.place.findMany({
      where: {
        latitude: { gte: lat - latDelta, lte: lat + latDelta },
        longitude: { gte: lng - lngDelta, lte: lng + lngDelta },
      },
      include: {
        _count: { select: { members: true } },
        createdBy: { select: { id: true, name: true } },
      },
      take: 50,
    })

    // Calculate actual distance and sort
    const withDistance = places.map((p) => {
      const R = 6371 // Earth radius in km
      const dLat = ((p.latitude - lat) * Math.PI) / 180
      const dLng = ((p.longitude - lng) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((p.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const distance = R * c

      return { ...p, membersCount: p._count.members, distance: Math.round(distance * 100) / 100 }
    })
    .filter((p) => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance)

    res.json(withDistance)
  } catch (error) {
    console.error("Places nearby error:", error)
    res.status(500).json({ error: "Error al buscar lugares cercanos" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/places/search?q=texto
// ═══════════════════════════════════════════════════════
router.get("/search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim()
    if (q.length < 2) { res.json([]); return }

    const places = await prisma.place.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
      },
      include: {
        _count: { select: { members: true } },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    })

    res.json(places.map((p) => ({ ...p, membersCount: p._count.members })))
  } catch (error) {
    console.error("Places search error:", error)
    res.status(500).json({ error: "Error al buscar lugares" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/places/google-search?q=texto&lat=X&lng=Y
// Proxy to Google Places API (New) — key stays server-side
// ═══════════════════════════════════════════════════════
const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
const GOOGLE_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.location,places.types,places.photos"

router.get("/google-search", async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim()
    if (q.length < 2) { res.json([]); return }

    const key = process.env.GOOGLE_PLACES_API_KEY
    if (!key) { res.status(503).json({ error: "Google Places not configured" }); return }

    const lat = parseFloat(req.query.lat as string)
    const lng = parseFloat(req.query.lng as string)

    const body: Record<string, any> = { textQuery: q }
    if (!isNaN(lat) && !isNaN(lng)) {
      body.locationBias = {
        circle: { center: { latitude: lat, longitude: lng }, radius: 10000 },
      }
    }

    const gRes = await fetch(GOOGLE_PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": GOOGLE_FIELD_MASK,
      },
      body: JSON.stringify(body),
    })

    const data: any = await gRes.json()
    if (!data.places) { res.json([]); return }

    const buildPhotoUrl = (photoName?: string) =>
      photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${key}` : null

    const results = data.places.map((p: any) => ({
      place_id: p.id,
      name: p.displayName?.text || "",
      formatted_address: p.formattedAddress || null,
      latitude: p.location?.latitude || 0,
      longitude: p.location?.longitude || 0,
      types: p.types || [],
      photoUri: buildPhotoUrl(p.photos?.[0]?.name),
    }))

    res.json(results)
  } catch (error) {
    console.error("Google Places proxy error:", error)
    res.status(500).json({ error: "Error al buscar en Google Places" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/places — Create a new place
// ═══════════════════════════════════════════════════════
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const { name, type, address, latitude, longitude } = req.body

    if (!name || latitude === undefined || longitude === undefined) {
      res.status(400).json({ error: "name, latitude y longitude son requeridos" }); return
    }

    const place = await prisma.place.create({
      data: {
        name,
        type: type || "GYM",
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        createdById: user.id,
      },
    })

    // Auto-join the creator
    await prisma.userPlace.create({
      data: { userId: user.id, placeId: place.id, isPrimary: true },
    })

    res.json({ ...place, membersCount: 1 })
  } catch (error) {
    console.error("Places create error:", error)
    res.status(500).json({ error: "Error al crear lugar" })
  }
})

// ═══════════════════════════════════════════════════════
// POST /api/places/:id/join
// ═══════════════════════════════════════════════════════
router.post("/:id/join", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const placeId = req.params.id as string

    // Set all other places to non-primary
    await prisma.userPlace.updateMany({
      where: { userId: user.id },
      data: { isPrimary: false },
    })

    await prisma.userPlace.upsert({
      where: { userId_placeId: { userId: user.id, placeId } },
      create: { userId: user.id, placeId, isPrimary: true },
      update: { isPrimary: true },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Places join error:", error)
    res.status(500).json({ error: "Error al unirse al lugar" })
  }
})

// ═══════════════════════════════════════════════════════
// DELETE /api/places/:id/leave
// ═══════════════════════════════════════════════════════
router.delete("/:id/leave", async (req: Request, res: Response) => {
  try {
    const { userId: clerkId } = getAuth(req)
    const user = await getUserByClerkId(clerkId!)
    if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return }

    const placeId = req.params.id as string

    await prisma.userPlace.deleteMany({
      where: { userId: user.id, placeId },
    })

    res.json({ success: true })
  } catch (error) {
    console.error("Places leave error:", error)
    res.status(500).json({ error: "Error al dejar el lugar" })
  }
})

// ═══════════════════════════════════════════════════════
// GET /api/places/:id/members
// ═══════════════════════════════════════════════════════
router.get("/:id/members", async (req: Request, res: Response) => {
  try {
    const placeId = req.params.id as string

    const members = await prisma.userPlace.findMany({
      where: { placeId },
      include: {
        user: {
          select: {
            id: true, name: true, username: true, avatarUrl: true,
            xp: true, level: true, experienceLevel: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: "asc" },
    })

    res.json(members.map((m) => m.user))
  } catch (error) {
    console.error("Places members error:", error)
    res.status(500).json({ error: "Error al obtener miembros" })
  }
})

export default router
