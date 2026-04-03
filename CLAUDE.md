# FIT-HUB: Wellness Super App (Unicorn Vision)

## Persona & Tone
Actúa como un equipo de Startup de élite (CTO, Staff Engineer, PM, UX Designer).
- **Enfoque:** Escalabilidad global, arquitectura limpia y gamificación "altamente dopamínica" (estilo Duolingo/Liftoff).
- **Metodología:** Faseada. Detente y pide confirmación al final de cada FASE ACTUAL.

## Tech Stack
- **Frontend:** React Native + Expo (Router), NativeWind, Clerk Auth.
- **Backend:** Node.js, Prisma (Postgres/Neon), Cloudinary.
- **AI/Maps:** Google Maps API, LLMs para Coaching & Vision.

## Core App Logic
1. **Gamificación:** Sistema de niveles, XP, Streaks y Roadmap estilo videojuego.
2. **Social:** Rankings (Global/Gym/Amigos), Challenges, Feed con IA anti-pseudociencia.
3. **Tracking:** Workouts, Nutrición (Manual/Barcode/AI Vision), AI Coach (RAG con papers científicos).

## Coding Standards
- **Arquitectura:** Monorepo. Lógica en `backend/src/services`, UI en `mobile/app`.
- **Estilos:** Mobile-first, limpio, moderno, microinteracciones.
- **Variables:** Usar siempre nombres definidos en `.env.example`.

---

## Fase Actual y Contexto de Memoria
> **[ESTA SECCIÓN LA ACTUALIZA CLAUDE ANTES DE CERRAR CADA CHAT]**
- **Última Fase Completada:** Sprint "Perfil Público Mejorado" — completado al 100%.
- **Estado Actual:** Todo compila limpio (`npx tsc --noEmit` sin errores en backend y mobile). 6 archivos modificados sin commitear (ver tabla abajo).
- **Pendiente Siguiente Sesión:** Hacer commit de los cambios. Luego, probar end-to-end el flujo de sign-up con nombre/username real en dispositivo o emulador. Ver sección "Próximos Pasos Sugeridos" para roadmap completo.

---

## Historial de Sprints Completados

### Sprint 1 — Fundación (Completado, commits anteriores)
Setup inicial del monorepo, autenticación con Clerk, modelos Prisma base, navegación con Expo Router, pantallas de onboarding (8 pasos: personal info, goals, hobbies, experience, location, connect, first-challenge).

### Sprint 2 — Tracking Core (Completado, commits anteriores)
- Workout tracking con sets, reps, peso, timer de descanso (`workout/active.tsx`)
- Exercise picker con búsqueda (`workout/exercise-picker.tsx`)
- Resumen de workout con XP ganada (`workout/summary.tsx`)
- Nutrition logging: manual + barcode + AI photo (`(tabs)/nutrition.tsx` — 21KB)
- Step tracking con integración HealthKit/Health Connect (`(tabs)/steps.tsx` — 25KB)
- Sistema de Personal Records (PR) por ejercicio

### Sprint 3 — Gamificación (Completado, commits anteriores)
- Sistema de XP y niveles (`User.xp`, `User.level`)
- Streaks diarios (`User.streak`, `User.lastWorkoutDate`)
- Badges: 9 categorías, 4 rarezas (COMMON, RARE, EPIC, LEGENDARY)
- `BadgeUnlockModal` — animación al desbloquear badge
- Challenges: tipos VOLUME, FREQUENCY, STREAK, PR, DISTANCE, CUSTOM
- Modos de challenge: MILESTONE (carrera) y TIMED (high score)
- `challengeProgress.ts` — servicio de 11KB para calcular progreso

### Sprint 4 — Social (Completado, commits anteriores)
- Feed social con posts: TEXT, IMAGE, VIDEO, WORKOUT_SHARE, PR_SHARE
- Reacciones: FIRE, MUSCLE, CLAP, TROPHY, TARGET
- Sistema de follows (follow/unfollow)
- Comentarios con threads
- Rankings: Global, Gym, Amigos
- `social.tsx` — pantalla principal del feed (51KB, la más grande del proyecto)
- Places API: buscar gyms/universidades/parques via Google Maps (proxy en backend para seguridad)

### Sprint 5 — AI Coach (Parcialmente Completado)
- Ruta `backend/src/routes/ai.ts` — 13KB, integración con OpenAI
- Pantalla `mobile/app/ai/coach.tsx` — chat UI
- Historial de mensajes en `AiChatMessage` model
- **PENDIENTE:** RAG con papers científicos (solo llama a GPT-4 directo por ahora, sin retrieval)

### Sprint 6 — Perfil Público Mejorado (Completado — última sesión)
Ver sección detallada abajo.

---

## Detalle Sprint 6: Perfil Público Mejorado

### Objetivo
Crear un perfil público rico, tipo athlete profile, que muestre estadísticas avanzadas, gráficas de progreso, historial, badges y permita comparar usuarios.

### Estructura de Tabs del Perfil (5 tabs)

| Tab | Componente | Descripción |
|-----|-----------|-------------|
| Posts | `PostsTab.tsx` | Grid de posts del usuario |
| Stats | `StatsTab.tsx` | Estadísticas de fuerza, physique, nutrición, pasos. Comparación vs otro usuario |
| Charts | `ChartsTab.tsx` | 8 tipos de gráficas de progreso (ver abajo) |
| History | `HistoryTab.tsx` | Lista de workouts pasados y logs de nutrición |
| Badges | `BadgesTab.tsx` | Colección completa de badges ganados, con showcase selector |

### Gráficas implementadas en `ChartsTab.tsx` (19KB)

| Tipo | Componente interno | Datos de |
|------|-------------------|----------|
| Volumen semanal | BarChart (gifted-charts) | `workoutAPI.getChartData` type `volume` |
| Grupos musculares | RadarChart / PieChart | `workoutAPI.getChartData` type `muscle` |
| Pasos diarios | LineChart | `stepsAPI.getHistory` |
| Peso corporal | LineChart | `profileAPI.getWeightHistory` |
| XP ganada | BarChart | `profileAPI.getXpHistory` |
| Heatmap de actividad | `HeatmapChart` custom | `workoutAPI.getChartData` type `heatmap` |
| Fuerza por ejercicio | `StrengthChart` | `workoutAPI.getChartData` type `strength` |
| Macros distribución | `MacrosChart` (PieChart) | `nutritionAPI.getHistory` |


## Decisiones de Arquitectura y Patrones Establecidos

### Autenticación y Usuarios
- **Clerk es la fuente de verdad para:** email, avatarUrl, identidad OAuth
- **La app es la fuente de verdad para:** name, username, xp, level, streak, badges, workouts, todo lo demás
- **Nunca** sobreescribir campos de la app desde el webhook `user.updated` — solo email y avatarUrl
- **Idempotencia del webhook:** Usar `prisma.user.upsert` en `user.created` para que reintentos del webhook no creen duplicados

### Validación de Username
- Formato permitido: `^[a-z0-9._]+$` (solo minúsculas, números, punto, guion bajo)
- Longitud mínima: 3 caracteres
- Unicidad: verificada en tiempo real (debounce 500ms) y en el backend (HTTP 409 si tomado)
- Auto-sanitizado en el cliente: `value.toLowerCase().replace(/[^a-z0-9._]/g, "")`
- El mismo endpoint `/check-username` funciona para sign-up y edición de perfil (detecta si el username pertenece al mismo usuario)

### HTTP Status Codes usados
- `200` — éxito
- `400` — validación fallida (formato, longitud)
- `401` — no autenticado
- `403` — no autorizado (ej: editar perfil de otro usuario)
- `404` — recurso no encontrado
- `409` — conflicto (username ya en uso)
- `500` — error interno del servidor

### Manejo de errores en Charts
- Todos los componentes de chart deben tener guards antes de `.map()`, `.filter()`, `.reduce()`
- Pattern: `Array.isArray(data) ? data : []` para arrays
- Pattern: `data?.field ?? defaultValue` para objetos
- Usar `try/catch` en hooks que llaman a APIs de charts

### Imágenes y Media
- Upload vía Cloudinary (no almacenar base64 en DB)
- `cloudinary.ts` en `backend/src/lib/` maneja la lógica de upload
- `avatarUrl` en User apunta a URL de Cloudinary

### Push Notifications
- Tokens guardados en `PushToken` model (un usuario puede tener múltiples devices)
- `pushNotifications.ts` en `backend/src/lib/` usa Expo Server SDK
- **Aún no disparadas** en eventos clave (badge unlock, challenge completado, nuevo follower) — pendiente

---

## Modelo de Datos Clave (resumen para contexto rápido)

### User (campos más importantes)
```
id          String  — UUID interno
clerkId     String  — ID de Clerk (unique)
email       String  — sincronizado desde Clerk
name        String  — gestionado por la app (NO por Clerk)
username    String  — único, gestionado por la app
avatarUrl   String? — URL Cloudinary, sincronizado desde Clerk
xp          Int     — puntos de experiencia acumulados
level       Int     — nivel calculado de XP
streak      Int     — días consecutivos de actividad
bio         String? — descripción del perfil
```

### Gamificación
```
Badge:          id, name, description, category(9 tipos), rarity(COMMON/RARE/EPIC/LEGENDARY), iconUrl, xpReward
UserBadge:      userId, badgeId, earnedAt
ProfileShowcase: userId, badgeId, order — badges destacados en el perfil (los que generan el glow del avatar)
```

### Workouts
```
Workout:    id, userId, name, startedAt, completedAt, totalVolume, totalSets, xpEarned, notes
WorkoutSet: workoutId, exerciseId, setNumber, type(NORMAL/WARMUP/DROPSET/etc), reps, weight, rpe, notes
PersonalRecord: userId, exerciseId, weight, reps, achievedAt
```

### Nutrición
```
FoodLog:   userId, date, totalCalories, totalProtein, totalCarbs, totalFat
FoodEntry: foodLogId, name, calories, protein, carbs, fat, mealType, source(MANUAL/BARCODE/AI_PHOTO/SEARCH/SAVED)
SavedFood: userId, name, macros — biblioteca de alimentos favoritos
```

### Social
```
Post:     userId, type(TEXT/IMAGE/VIDEO/WORKOUT_SHARE/PR_SHARE/etc), content, media[]
Reaction: userId, postId, type(FIRE/MUSCLE/CLAP/TROPHY/TARGET)
Follow:   followerId, followingId
Comment:  userId, postId, content, parentId(para threads)
```

### Steps y Health
```
DailySteps: userId, date, steps, calories, distance, activeMinutes, hourlyData(JSON array 24 elementos)
WeightLog:  userId, weight, unit(KG/LB), date, notes
```

---

