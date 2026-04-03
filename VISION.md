## Próximos Pasos Sugeridos (Roadmap)

### 🔴 Prioridad Crítica (hacer antes del siguiente sprint)
1. **Commitear los 6 archivos modificados** — no hay nada roto, solo hacerlo
2. **Test end-to-end del sign-up con nombre/username** — crear cuenta real en el emulador, verificar que el webhook recibe `unsafe_metadata` y que el usuario se crea correctamente en la DB con nombre y username del form
3. **Verificar migración Prisma** — confirmar que el campo `username` en el schema tiene `@unique` y que la migración está aplicada en la DB de producción (Neon). Si no, correr `npx prisma migrate deploy`

### 🟡 Prioridad Media (próximo sprint)
4. **Integrar notificaciones push con eventos reales:**
   - Badge desbloqueado → notificación "🏆 Desbloqueaste [Badge Name]"
   - Nuevo follower → notificación "[Username] te empezó a seguir"
   - Challenge completado → notificación con resultado
   - El sistema de tokens y envío ya existe en `pushTokens.ts` y `pushNotifications.ts`, falta conectarlo

5. **Completar AI Coach con RAG:**
   - Actualmente solo llama a GPT-4 con el historial de chat
   - Falta: base de conocimiento de papers científicos de nutrición/ejercicio
   - Sugerido: usar embeddings + pgvector en Neon para RAG, o Pinecone como vector store
   - El endpoint `ai.ts` ya existe, solo necesita el retrieval layer

6. **Onboarding — revisar integración con nombre/username:**
   - Los 8 pasos de onboarding en `(onboarding)/` podrían no estar recogiendo el nombre/username del nuevo sistema
   - Verificar si el flujo de onboarding se muestra después del sign-up y si necesita actualización

7. **Rankings mostrar @username:**
   - En rankings global/gym/amigos, verificar que se muestra `@username` del usuario, no solo el nombre display
   - El campo `username` ya existe en el modelo User

### 🟢 Prioridad Baja / Ideas Futuras (backlog)
8. **Feed anti-pseudociencia:** Filtrar posts con claims de salud no verificados usando IA. `social.tsx` es la pantalla más grande (51KB). Considerar moderación asíncrona (proceso en background al publicar)

9. **Comparación de usuarios (`profile/compare.tsx`):** La pantalla existe pero revisar completitud. Comparar stats: volumen, fuerza, pasos, racha, badges.

10. **Barcode scanner para nutrición:** `FoodSource.BARCODE` existe en el schema. Verificar implementación en `nutrition.tsx`. Si usa expo-barcode-scanner, revisar permisos.

11. **Tests automatizados:**
    - El proyecto actualmente no tiene tests
    - Crítico para: sign-up flow, webhook handler, check-username endpoint
    - Stack sugerido: Jest + Supertest (backend), Jest + React Native Testing Library (mobile)

12. **Error boundaries en React Native:**
    - Agregar `ErrorBoundary` wrappers en `ChartsTab`, `StatsTab`, `HistoryTab`
    - Mostrar pantalla de fallback con botón "Reintentar" en vez de crash

13. **Paginación en feeds y listas:**
    - Posts feed, historial de workouts, historial de nutrición, rankings — todos cargan todos los datos
    - Implementar cursor-based pagination en backend y `FlatList` con `onEndReached` en mobile

14. **Caché y performance:**
    - Considerar React Query o SWR para caching de datos de API
    - Actualmente todo es fetch directo con axios sin caché
    - Imágenes: `expo-image` ya tiene caché built-in, bien

15. **Deep links y share:**
    - Compartir perfil público → link que abre `profile/[userId]`
    - Compartir workout completado → share card con stats
    - Compartir badge desbloqueado → imagen generada dinámicamente

---

## Áreas de Riesgo / Deuda Técnica Conocida

> Auditoría estática realizada sobre 14 archivos clave del monorepo. Total: ~70 issues identificados.

### 🔴 CRÍTICO — Pueden causar pérdida de datos o crashes en producción

#### 1. Race Conditions (TOCTOU) en username y challenges

**Caso A — Username en check-username + PUT /me:**
- **Archivo:** `backend/src/routes/users.ts` líneas 81-90 (check-username) y 139-142 (PUT /me)
- **Condición exacta:** Dos usuarios distintos envían simultáneamente el mismo username. Ambos llaman `prisma.user.findUnique({ where: { username } })` al mismo tiempo, ambos reciben `null` (no existe), ambos proceden a crear/actualizar. El segundo INSERT viola el `@unique` con error `P2002` que el catch convierte en 500 genérico.
- **Código problemático:**
  ```typescript
  // línea 81: check ocurre aquí
  const existing = await prisma.user.findUnique({ where: { username } })
  // línea 85-90: si existing es null, responde available: true
  // línea 139: mismo check en PUT /me
  const existing = await prisma.user.findUnique({ where: { username: uname } })
  // Entre el check y el upsert hay una ventana de colisión
  ```
- **Fix sugerido:** Eliminar el check previo. Intentar directamente el `update` o `upsert`, y en el `catch` verificar si el error es Prisma `P2002` (unique constraint) para retornar 409 con mensaje amigable.

**Caso B — Username en webhook `user.created`:**
- **Archivo:** `backend/src/routes/webhooks.ts` líneas 80-83
- **Condición exacta:** Dos sign-ups casi simultáneos con el mismo username en `unsafeMetadata`. La línea 80 hace `findUnique`, y si ambos pasan simultáneamente, el `upsert` del segundo falla o crea un username con sufijo distinto al esperado por el usuario.
- **Código problemático:**
  ```typescript
  // línea 80
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    username = username + "_" + Date.now().toString().slice(-4); // línea 82
  }
  // La colisión puede ocurrir entre línea 80 y el upsert de línea 85
  ```

**Caso C — Race condition en MILESTONE challenge:**
- **Archivo:** `backend/src/lib/challengeProgress.ts` líneas 80-82 y función `handleMilestoneWin` líneas 240-255
- **Condición exacta:** Dos usuarios distintos completan el goal en el mismo segundo (ej: workout finish simultáneo). La línea 80 verifica `!participation.isWinner` para ambos en paralelo — ambos pasan el guard y `handleMilestoneWin` se ejecuta dos veces, cerrando el challenge dos veces y otorgando XP doble.
- **Código problemático:**
  ```typescript
  // línea 80: el check no es atómico
  if (challenge.mode === "MILESTONE" && newValue >= challenge.goal && !participation.isWinner) {
    await handleMilestoneWin(...)  // puede ejecutarse 2 veces si 2 requests entran aquí simultáneamente
  }
  ```
- **Fix global para los 3 casos:** Usar `prisma.$transaction()` con `isolationLevel: "Serializable"`. Para username: catch del error `P2002` en vez de pre-check.

---

#### 2. Paginación ausente — endpoints que pueden retornar miles de registros

**Endpoint `GET /api/users/goals`:**
- **Archivo:** `backend/src/routes/users.ts` líneas 468-471
- **Condición:** Un usuario power-user con 200+ goals activos. `findMany()` sin `take` ni `cursor` — retorna todos. En mobile se renderizan todos en una FlatList.
- **Código:** `prisma.goal.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } })` — sin límite.

**Endpoint `GET /api/users/progress` (weekly loop):**
- **Archivo:** `backend/src/routes/users.ts` líneas 388-415
- **Condición:** Este endpoint ejecuta **8 queries separadas** en un `for` loop sincrónico (una por semana). Si la DB tiene latencia de 50ms, este endpoint tarda mínimo 400ms. No es paginable pero sí optimizable con una sola query `groupBy`.
- **Código problemático:**
  ```typescript
  for (let i = 7; i >= 0; i--) {  // línea 388 — 8 iteraciones
    const weekData = await prisma.workout.aggregate(...)  // línea 396 — query por iteración
    weeks.push(...)
  }
  ```
- **Fix:** `prisma.workout.groupBy({ by: ['startTime'], _count: true, where: { userId, startTime: { gte: 8WeeksAgo } } })` en una sola query.

**Endpoint `GET /api/users/suggestions`:**
- **Archivo:** `backend/src/routes/users.ts` líneas 500-521
- **Condición:** Con 100,000 usuarios registrados, `prisma.user.findMany({ where: { onboardingCompleted: true } })` retorna hasta 100 (hay un `take: 100`), pero el scoring se hace en memoria con un bucle JS sobre todos los candidatos. El `take: 100` mitiga en parte, pero no garantiza que los mejores candidatos estén en ese slice.

**`finalizeExpiredChallenges` en challengeProgress.ts:**
- **Archivo:** `backend/src/lib/challengeProgress.ts` líneas 99-113 y 120-134
- **Condición:** Dos `findMany()` sin límite sobre challenges ACTIVE. Si hay 10,000 challenges activos expirados, se cargan todos en memoria y se procesan en loops con `await` dentro (N queries adicionales por challenge).

---

#### 3. N+1 Queries en perfil público

- **Archivo:** `backend/src/routes/profile.ts` — función que construye la respuesta del endpoint `GET /api/profile/:userId/combo` y `GET /api/profile/:userId/stats`
- **Condición exacta:** Cada vez que cualquier usuario visita el perfil de otro usuario, se disparan hasta **14 queries separadas** en `Promise.all()`. Con Neon (hosted en us-east-1 o eu-west, lejos del servidor), cada query tarda ~30-80ms. Con 14 en paralelo, el RTT efectivo es el de la más lenta, típicamente 200-500ms solo en latencia de DB.
- **Queries que se ejecutan en cada visita al perfil:**
  1. `findUnique` para datos básicos del usuario
  2. `count` workouts completados
  3. `aggregate` volumen total
  4. `aggregate` duración total
  5. `count` PRs totales
  6. `findFirst` workout más largo
  7. `groupBy` ejercicio más frecuente
  8. `count` followers
  9. `count` following
  10. `findMany` badges ganados
  11. `findMany` showcase badges
  12. `findFirst` weight log reciente
  13. `aggregate` steps totales
  14. `count` posts del usuario
- **Fix:** Usar `select` anidado de Prisma para traer relaciones en menos queries. Pre-calcular stats en un `UserStats` materializado que se actualiza con un background job o trigger cada vez que se completa un workout.

---

#### 4. Memory Leaks en `steps.tsx`

**Leak A — Cleanup de async sin guard de mounted:**
- **Archivo:** `mobile/app/(tabs)/steps.tsx` líneas 281-346
- **Condición exacta:** El usuario abre la tab de Steps → navega rápidamente a otra tab antes de que `setup()` termine (setup hace varias llamadas async: `initHealthSteps()`, `healthGetSteps()`, `Pedometer.isAvailableAsync()`). El componente se desmonta pero `setup()` sigue corriendo en background. Cuando resuelve, llama `setLiveSteps()`, `setPedometerAvailable()` sobre un componente desmontado → warning de React "setState on unmounted component" y potencial comportamiento inesperado.
- **Código problemático:**
  ```typescript
  // línea 282: setup() es async pero no tiene flag de cancelación
  const setup = async () => {
    const source = await initHealthSteps();  // async, puede tardar 500ms+
    setStepSource(source);  // si el componente se desmontó, esto falla silenciosamente
    // ... más setStates después de awaits
  }
  setup();  // línea 337: fire-and-forget sin cancelación
  ```

**Leak B — Re-suscripción del pedómetro sin cleanup:**
- **Archivo:** `mobile/app/(tabs)/steps.tsx` líneas 370-403
- **Condición exacta:** El usuario minimiza la app y la vuelve a abrir. El `AppState` listener en línea 371 detecta `active` → llama `Pedometer.watchStepCount()` en línea 391 y guarda en `subscriptionRef.current`. Pero la línea 388-390 remueve la suscripción anterior y crea una nueva CADA VEZ que la app vuelve al foreground. Si el usuario hace esto 10 veces, hay potencialmente múltiples suscripciones activas si la ref no se actualiza correctamente.
- **Código problemático:**
  ```typescript
  // línea 388-393: pattern correcto en teoría, pero el nuevo watchStepCount
  // puede crear listeners internos en el módulo nativo que no se limpian
  if (subscriptionRef.current) {
    subscriptionRef.current.remove();
  }
  subscriptionRef.current = Pedometer.watchStepCount((result) => {
    setLiveSteps(steps + result.steps);
  });
  ```

**Leak C — Colisión entre polling interval y sync interval:**
- **Archivo:** `mobile/app/(tabs)/steps.tsx` líneas 304-309 (polling cada 10s) y líneas 406-412 (sync cada 60s)
- **Condición exacta:** Ambos intervalos pueden dispararse al mismo tiempo. El polling actualiza `liveSteps` con el valor de HealthKit, mientras el sync interval envía `liveSteps` al backend. Si el timing coincide, el sync puede enviar un valor stale (el previo antes del polling).

---

#### 5. Borrado de usuario sin soft delete ni auditoría

- **Archivo:** `backend/src/routes/webhooks.ts` líneas 121-129
- **Condición exacta:** El usuario borra su cuenta desde la app de Clerk (o un admin la borra desde el dashboard de Clerk). Clerk dispara `user.deleted`. El webhook ejecuta `prisma.user.delete({ where: { clerkId } })`. Si el schema de Prisma tiene `onDelete: Cascade` en todas las relaciones, **se borran permanentemente y sin confirmación**: todos sus Workouts, FoodLogs, Posts, Reactions, Comments, Badges, Challenges, Steps, WeightLogs, Notifications, PushTokens — todo.
- **Código actual:**
  ```typescript
  // línea 124: borrado permanente, sin soft delete, sin backup
  await prisma.user.delete({
    where: { clerkId },
  });
  ```
- **Problema adicional:** Si el schema NO tiene cascade en alguna relación, el `delete` falla con un foreign key constraint error, devuelve 500, Clerk reintenta el webhook → loop de reintentos.
- **Fix sugerido:** Agregar campo `deletedAt DateTime?` al modelo `User`. El webhook hace `prisma.user.update({ data: { deletedAt: new Date() } })`. Todos los endpoints filtran `where: { deletedAt: null }`. Después de 30 días, un cron job hace el borrado real.

---

### 🟠 ALTO — Vulnerabilidades de seguridad o bugs que impactan UX

#### 6. Validación de inputs numéricos ausente

**En goals (POST /api/users/goals):**
- **Archivo:** `backend/src/routes/users.ts` líneas 436-447
- **Condición:** El campo `targetValue` y `currentValue` vienen directamente del `req.body` sin validación. Un usuario puede enviar `{ targetValue: -999, title: "" }` o `{ targetValue: "abc" }`. Prisma lo acepta si el campo es `Float?` en el schema (null-able float acepta cualquier número, pero `NaN` del `parseFloat("abc")` sería undefined → se omite).
- **Código problemático:** `const { title, description, targetValue, unit } = req.body` → `prisma.goal.create({ data: { targetValue } })` sin sanitización.

**En workoutAPI (addSet):**
- **Archivo:** `mobile/lib/api.ts` línea 488-489
- **Condición:** `addSet: (workoutId: string, data: any)` — el tipo `any` permite enviar `{ weight: NaN, reps: -1, rpe: 15 }`. El backend no valida rangos (un RPE > 10 no tiene sentido; un peso negativo contamina los PRs y el volumen total).

---

#### 7. Timeout de API irrealmente alto

- **Archivo:** `mobile/lib/api.ts` línea 11
- **Condición exacta:** La app está en una red móvil lenta (3G, o con packet loss). El servidor en Render.com hace cold start (puede tardar 30-50 segundos la primera request después de inactividad). Con `timeout: 100000` (100s), el usuario ve un spinner durante casi 2 minutos antes de recibir un error. No hay indicación de que la app está "despertando" al servidor.
- **Código actual:** `timeout: 100000` — debería ser 15000 para requests normales, con manejo especial solo para uploads de imágenes/videos.
- **Retry actual:** Solo reintenta 1 vez (línea 51: `!config._retry`), solo en `ECONNABORTED` o `!error.response`. No reintenta en errores 503 (server unavailable durante cold start).

---

#### 8. Exposición potencial de datos sensibles

- **Archivo:** `backend/src/routes/profile.ts` — endpoint `GET /api/profile/:userId/compare`
- **Condición:** El endpoint de comparación (`/compare`) retorna en el tipo `CompareUserStats` (definido en `mobile/lib/api.ts` líneas 869-885): `benchPR`, `squatPR`, `deadliftPR` — datos de training que algunos usuarios podrían no querer exponer. Más importante: si el endpoint de stats no verifica `isOwnProfile` antes de retornar `weight`, `height`, `bodyFat`, cualquier usuario autenticado puede ver el físico exacto de cualquier otro usuario solo conociendo su `userId`.
- **Campo de riesgo en `api.ts`:** `CompareUserStats` incluye datos que no hay confirmación de que sean filtrados en el backend según privacidad del perfil.

---

#### 9. `unsafeMetadata` sin type guard ni sanitización de longitud

- **Archivo:** `backend/src/routes/webhooks.ts` líneas 62-76
- **Condición exacta:** Un cliente malicioso (o modificado con Jailbreak/root) puede llamar directamente la API de Clerk con `unsafeMetadata: { displayName: "A".repeat(10000), username: "<script>alert(1)</script>" }`. El webhook:
  1. Lee `meta.displayName` sin validar longitud → string de 10,000 chars va a la DB
  2. Lee `meta.username` y aplica `replace(/[^a-z0-9._]/g, "")` → el XSS se limpia, pero no hay límite de longitud
- **Código problemático:**
  ```typescript
  // línea 62-67: sin validación de tipo ni longitud
  const meta = data.unsafe_metadata ?? {};
  const name = meta.displayName || `${firstName} ${lastName}`.trim() || ...
  // meta.displayName podría ser un objeto, un array, o un string de 100KB
  ```
- **Fix:**
  ```typescript
  const displayName = typeof meta.displayName === 'string'
    ? meta.displayName.trim().slice(0, 100) : ''
  const username = typeof meta.username === 'string'
    ? meta.username.toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30) : ''
  ```

---

#### 10. Suggestions API carga N usuarios en RAM

- **Archivo:** `backend/src/routes/users.ts` líneas 500-575
- **Condición exacta:** `prisma.user.findMany({ where: { onboardingCompleted: true }, take: 100 })` — carga 100 usuarios con todos sus hobbies y places. Luego el scoring se hace en un `.map()` en JS (líneas 528-571). Con 1,000 usuarios: OK. Con 100,000 usuarios onboardeados: la query sigue siendo `take: 100` (bien), pero el slice no está basado en relevancia pre-filtrada — se toman los 100 más recientes, no los más relevantes, y se sortean en memoria.
- **Problema adicional:** El scoring incluye `Math.floor((Date.now() - c.dateOfBirth.getTime()) / ...)` — si `c.dateOfBirth` es null (campo opcional), esto crashea con `TypeError: Cannot read properties of null`.
- **Código de riesgo:**
  ```typescript
  // línea 542-545: dateOfBirth puede ser null
  if (myAge && c.dateOfBirth) {
    const theirAge = Math.floor((Date.now() - c.dateOfBirth.getTime()) / ...)
    // OK, sí hay guard. Pero si dateOfBirth viene como string ISO en vez de Date
    // (posible si Prisma serializa diferente), .getTime() falla
  }
  ```

---

### 🟡 MEDIO — Deuda técnica que degradará la mantenibilidad

#### 11. Archivos demasiado grandes (God Files)

| Archivo | Tamaño | Responsabilidades mezcladas |
|---------|--------|-----------------------------|
| `mobile/app/(tabs)/social.tsx` | 51KB | Feed + Rankings + Challenges + Posts + Reactions + Comments + Follows — todo en un componente |
| `backend/src/routes/badges.ts` | 37KB | Definiciones hardcodeadas de badges + lógica de unlock + endpoints REST — 3 responsabilidades distintas |
| `backend/src/routes/profile.ts` | 35KB | Combo stats + Charts + History + Comparison + Weight logs + Showcase — debería ser al menos 3 routers |
| `mobile/app/(tabs)/steps.tsx` | 25KB | Pedómetro nativo + HealthKit + Health Connect + UI de stats + Water tracker |
| `mobile/app/(tabs)/nutrition.tsx` | 21KB | Logging manual + Barcode scanner + AI photo + Water tracker + Saved foods |
| `mobile/components/profile/ChartsTab.tsx` | 19KB | 8 tipos de chart distintos (bar, line, radar, pie, heatmap, strength, macros, xp) |

**Condición de riesgo:** En `social.tsx` de 51KB, cualquier cambio en el feed puede romper accidentalmente el código de rankings o challenges por estar en el mismo scope. Un bug en el renderizado de posts puede afectar el estado de challenges.

---

#### 12. `any` types en TypeScript — pérdida de type safety

Ubicaciones exactas:
- `mobile/lib/api.ts` línea 242: `workoutData: any` en `SocialPost` interface — cualquier dato puede pasarse como workout data sin verificación
- `mobile/lib/api.ts` línea 488: `addSet: (workoutId: string, data: any)` — el payload del set no está tipado, puede enviar campos inválidos
- `mobile/lib/api.ts` línea 496: `createTemplate: (data: any)` — igual, sin tipo
- `mobile/lib/api.ts` línea 546: `saveFavorite: (data: any)` — igual
- `backend/src/routes/webhooks.ts` línea 35: `let payload: any` — el webhook payload no está tipado, acceso a propiedades sin garantía
- `mobile/app/(tabs)/steps.tsx` líneas 266-267: `useState<any>(null)` para `todayData` y `weekData` — se accede a propiedades como `.steps`, `.goal` sin verificación de tipo
- `backend/src/routes/users.ts` línea 123: `const updateData: Record<string, any>` — el objeto de update puede incluir cualquier cosa

**Condición de riesgo:** Un refactor de la API que cambie el nombre de un campo (e.g., `steps` → `stepCount`) no sería detectado por TypeScript en las pantallas que usan `any`, solo fallaría en runtime.

---

#### 13. Valores hardcodeados que deberían ser configurables

| Valor | Ubicación exacta | Impacto de cambiar |
|-------|-----------------|-------------------|
| `40` puntos por mismo gym | `users.ts` línea 532 | Cambiar scoring requiere deploy |
| `20` puntos por hobby compartido | `users.ts` línea 539 | Ídem |
| `10` puntos por edad similar (±5 años) | `users.ts` línea 544 | Ídem |
| `25%` XP parcial por participar en challenge | `challengeProgress.ts` línea 268 | Cambiar economía de XP requiere deploy |
| `10%` mínimo de XP proporcional | `challengeProgress.ts` línea 361 | Ídem |
| Timeout API `100000ms` | `api.ts` línea 11 | No configurable por entorno |
| Agua diaria `2500ml` | Hardcodeado en nutrition | No respeta configuración del usuario |
| Presets de meta de pasos | Hardcodeado en steps | No extensible |

---

#### 14. Loop de 8 queries para progreso semanal

- **Archivo:** `backend/src/routes/users.ts` líneas 388-415
- **Condición exacta:** El endpoint `GET /api/users/progress` se llama cada vez que se abre el dashboard (home tab). Ejecuta 8 `await prisma.workout.aggregate(...)` secuenciales (no en `Promise.all`, sino en `for await` sincrónico). Con latencia de 40ms a Neon, este endpoint tarda mínimo **320ms** solo en queries, más el tiempo de cómputo.
- **Código problemático:**
  ```typescript
  for (let i = 7; i >= 0; i--) {  // línea 388
    // ...
    const weekData = await prisma.workout.aggregate({...})  // línea 396: await dentro del loop
    weeks.push({...})
  }
  ```
- **Fix:** Una sola query: `prisma.$queryRaw\`SELECT DATE_TRUNC('week', "startTime") as week, COUNT(*), SUM("totalVolume"), SUM("xpEarned") FROM "Workout" WHERE "userId"=${userId} AND "isCompleted"=true AND "startTime" >= ${eightWeeksAgo} GROUP BY 1 ORDER BY 1\``

---

#### 15. Upload de media sin validación de tamaño en cliente

- **Archivo:** `mobile/app/(tabs)/social.tsx` — función de upload de posts
- **Condición:** El usuario selecciona un video de 2GB desde galería. `expo-image-picker` retorna el URI. El código sube directamente a Cloudinary sin verificar `fileSize`. Cloudinary tiene límites (por plan, típicamente 100MB para video en plan gratuito), pero el error llega después de subir todo el archivo → UX horrible y posible gasto de ancho de banda.
- **Validación que falta:** Antes del upload, verificar `asset.fileSize < 50 * 1024 * 1024` (50MB max) y `asset.duration < 60` (1 min max).

---

#### 16. `muscleStimulus` como JSON blob no consultable

- **Archivo:** `backend/prisma/schema.prisma` — modelo `WorkoutSet`, campo `muscleStimulus Json?`
- **Condición:** La pantalla de charts muestra "volumen por grupo muscular". Para calcular esto, el backend debe traer TODOS los WorkoutSets del usuario y luego en JS iterar sobre el JSON de cada set para sumar estímulo por músculo. Con 10,000 sets, esto es 10,000 objetos en memoria.
- **Impacto concreto:** El chart de "grupos musculares" (RadarChart en `ChartsTab.tsx`) puede ser lento o timeout para usuarios avanzados con muchos workouts.
- **Fix:** Tabla `MuscleStimulus { id, userId, muscle String, volume Float, date DateTime }` con `@@index([userId, muscle, date])`. Query eficiente: `GROUP BY muscle WHERE userId AND date >= 30days`.

---

#### 17. Definiciones de badges hardcodeadas en código

- **Archivo:** `backend/src/routes/badges.ts` — constante de badges al inicio del archivo (primeras ~200 líneas son solo definiciones de objetos)
- **Condición:** Para agregar un nuevo badge (por ejemplo, para un evento especial de Halloween), hay que: (1) editar el código, (2) hacer commit, (3) hacer deploy. El deploy en Render tarda ~3-5 minutos. Si un badge tiene un bug en su lógica de unlock, hay que hacer deploy para corregirlo.
- **Adicionalmente:** Si se cambia el `xpReward` de un badge existente, los usuarios que ya lo ganaron no se ven afectados (correcto), pero los nuevos usuarios ganan diferente XP — inconsistencia en el historial.

---

#### 18. Índices DB faltantes en queries de alta frecuencia

Queries sin índice compuesto óptimo (verificado contra el schema):
- `Workout` filtrado por `WHERE userId = X AND isCompleted = true ORDER BY startTime DESC` — la query más común del app (dashboard, profile, history). Necesita `@@index([userId, isCompleted, startTime])`.
- `DailySteps` filtrado por `WHERE userId = X AND date = Y` — se ejecuta en cada sync de pasos (cada 60 segundos por usuario activo). Actualmente tiene `@@unique([userId, date])` que sí crea un índice — **este sí está bien**.
- `FoodEntry` filtrado por `WHERE foodLogId = X` — cada vez que se abre la pantalla de nutrición. Depende del índice implícito de la FK.
- `Post` filtrado por `WHERE userId = X ORDER BY createdAt DESC` — para el tab de Posts del perfil. Sin índice compuesto explícito.
- `UserBadge` con `WHERE userId = X AND badgeId = Y` — se verifica en cada check de badges. Depende de índices implícitos de FKs.

---

#### 19. Retry logic insuficiente para cold starts de Render

- **Archivo:** `mobile/lib/api.ts` líneas 42-58
- **Condición exacta:** El servidor en Render.com entra en "sleep mode" después de 15 minutos de inactividad (en plan gratuito). El primer request después de inactividad puede tardar 30-50 segundos (cold start). El interceptor actual:
  - Solo reintenta si `error.code === "ECONNABORTED"` (timeout) o `!error.response` (sin respuesta)
  - Solo reintenta **1 vez** (`!config._retry`)
  - Espera 2 segundos antes del retry (correcto)
  - **No reintenta** si el servidor responde con 503 (Service Unavailable) durante el startup
- **Código:**
  ```typescript
  // línea 47-50: condición de retry muy estricta
  if ((error.code === "ECONNABORTED" || !error.response) && !config._retry) {
    // Solo 1 retry, solo en timeout/no-response
  }
  ```

---

#### 20. Refresh race condition en profile.tsx

- **Archivo:** `mobile/app/(tabs)/profile.tsx` — función `onRefresh()`
- **Condición exacta:** El usuario hace pull-to-refresh. Esto llama `onRefresh()` que dispara 8 refetch hooks en paralelo (combo, stats, posts, charts, history, nutrition history, steps history, badges). Si alguno de los 8 falla (timeout, 500), el `refreshing` state se pone en `false` antes de que todos terminen, y la UI muestra datos mezclados: stats del refresh nuevo + posts del estado anterior.
- **Adicionalmente:** Si el usuario hace pull-to-refresh dos veces rápido, hay 16 requests en vuelo simultáneamente (2 sets de 8). El segundo set puede resolver antes que el primero, dejando datos desactualizados.

---

### ⚪ BAJO — Calidad de código y mejoras futuras

#### 21. Falta de Empty States
- `mobile/components/profile/HistoryTab.tsx`: si el array `workouts` está vacío, renderiza lista vacía sin mensaje — el usuario no sabe si es un error o si realmente no hay datos.
- `mobile/components/profile/PostsTab.tsx`: grid vacío sin ilustración ni CTA ("Comparte tu primer workout").
- `mobile/components/profile/BadgesTab.tsx`: si `earned === 0`, podría mostrar badges bloqueados con descripción de cómo ganarlos — motivación y gamificación.
- `mobile/components/profile/StatsTab.tsx`: si `totalWorkouts === 0`, muestra estadísticas en 0 sin guía de "completa tu primer workout para ver tus stats".

#### 22. Accesibilidad (a11y) ausente
- Ningún componente tiene `accessibilityLabel` o `accessibilityHint` — lectores de pantalla no pueden navegar la app.
- Botones de reacción en `social.tsx` son solo emojis (FIRE, MUSCLE, CLAP, etc.) sin texto alternativo.
- Las gráficas en `ChartsTab.tsx` (react-native-gifted-charts) solo diferencian series por color — usuarios con daltonismo no pueden distinguir las líneas.

#### 23. `timeAgo()` recalculado en cada render

- **Archivo:** `mobile/app/(tabs)/social.tsx` — cada Post renderizado en el feed
- **Condición:** El componente padre de la lista se re-renderiza (por ejemplo, al llegar nuevas reacciones). Cada Post recalcula `timeAgo(post.createdAt)` aunque la fecha no haya cambiado.
- **Fix:** `useMemo(() => timeAgo(post.createdAt), [post.createdAt])` dentro del componente PostCard.

#### 24. Modal de comentarios no implementado (visible en UI)

- **Archivo:** `mobile/app/(tabs)/social.tsx` — línea ~1082
- **Condición:** El botón de comentarios en cada post es visible y tappeable, pero el handler está marcado como TODO. Cuando el usuario lo toca, no pasa nada (o abre un modal vacío). Esto confunde a usuarios en testing y staging.

#### 25. Ausencia total de tests automatizados

- No hay ningún archivo `*.test.ts`, `*.spec.ts`, `*.test.tsx` en todo el monorepo.
- **Riesgo concreto:** El fix del flujo de sign-up con `unsafeMetadata` involucró 6 archivos. Sin tests, la única forma de verificar que funciona es probarlo manualmente en el emulador. Un refactor futuro podría romper el webhook silenciosamente.
- **Mínimo viable sugerido (por orden de impacto):**
  1. Test del webhook `user.created` con `unsafeMetadata` — simular evento de Clerk y verificar que crea usuario con nombre/username correcto
  2. Test del endpoint `GET /api/users/check-username/:username` — casos: disponible, tomado, formato inválido, pertenece al mismo usuario
  3. Test de `updateChallengeProgress` — verificar que MILESTONE no declara doble ganador
  4. Test de componente sign-up — verificar validación de username y estado del botón Submit
- **Stack sugerido:** Jest + Supertest para backend, Jest + React Native Testing Library para mobile.

---

### 🔴 CRÍTICO — Issues adicionales encontrados en auditoría profunda

#### 26. `createWorkoutInBackend()` sin await ni manejo de error

- **Archivo:** `mobile/app/workout/active.tsx` líneas 44-48
- **Condición exacta:** El componente monta, el `useEffect` llama `createWorkoutInBackend()` sin `await` y sin `.catch()`. Si el servidor está caído o hay un error de red en ese momento, el workout no se crea en el backend, `activeWorkout.workoutId` queda `null`. Todos los sets que el usuario agrega después fallan silenciosamente (llamadas a `POST /api/workouts/undefined/sets`). El usuario completa el workout creyendo que se guardó.
- **Código problemático:**
  ```typescript
  useEffect(() => {
    if (!activeWorkout.workoutId && activeWorkout.isActive) {
      createWorkoutInBackend(); // ← sin await, sin .catch(), falla silenciosamente
    }
  }, []);
  ```
- **Fix:** `createWorkoutInBackend().catch(err => { showError("No se pudo conectar. Intenta de nuevo."); router.back(); })`

---

#### 27. Race condition al unirse a un challenge lleno

- **Archivo:** `backend/src/routes/challenges.ts` — endpoint `POST /challenges/:id/join`
- **Condición exacta:** El challenge tiene `maxParticipants: 10` y actualmente hay 9 participantes. Dos usuarios presionan "Unirse" al mismo tiempo. Ambos pasan el check `participantCount >= maxParticipants` (ambos ven 9 < 10), ambos ejecutan `prisma.challengeParticipant.create()`. El challenge termina con 11 participantes. Ninguno recibe error — el segundo create tiene `@@unique([challengeId, userId])` que protege al mismo usuario, pero dos usuarios distintos pueden unirse ambos.
- **Fix:** Usar `prisma.$transaction()` con `SELECT ... FOR UPDATE` o confiar en un trigger de DB para limitar participantes.

---

#### 28. Endpoint de comentarios sin autenticación

- **Archivo:** `backend/src/routes/social.ts` — `GET /api/social/comments/:postId`
- **Condición exacta:** El router de social tiene `router.use(requireAuth)` al inicio, lo que protege todas las rutas. Pero si en algún momento se reorganiza el código y este endpoint se mueve fuera del middleware, o si el middleware falla silenciosamente, cualquier request sin token puede leer todos los comentarios de cualquier post (incluyendo posts privados).
- **Riesgo adicional:** El endpoint devuelve `user.name`, `user.username`, `user.avatarUrl` de cada comentarista — datos de perfiles que algunos usuarios pueden haber configurado como privados.

---

#### 29. XP y operaciones críticas no son transaccionales

- **Archivo:** `backend/src/routes/nutrition.ts` — endpoint `POST /api/nutrition/entry`
- **Condición exacta:** Al agregar un alimento, el backend hace dos operaciones separadas:
  1. `prisma.foodEntry.create(...)` — crea la entrada
  2. `prisma.user.update({ data: { xp: { increment: 5 } } })` — da XP
  Si la operación 1 falla, el usuario no tiene entry pero tampoco XP (correcto). Si la operación 2 falla (DB momentáneamente sobrecargada), el usuario tiene la entry en su log pero **no recibe el XP**. Con el tiempo, acumula inconsistencias entre entries y XP total.
- **Mismo patrón en:** `backend/src/routes/workouts.ts` al completar workout (XP + badge check son operaciones separadas sin transacción).
- **Fix:** `prisma.$transaction([foodEntry.create(...), user.update(...)])` — o aceptar la inconsistencia si el XP es "best effort".

---

#### 30. API_URL hardcodeada en producción (no usa env var)

- **Archivo:** `mobile/lib/api.ts` línea 7
- **Condición:** `export const API_URL = "https://fithub-d1pe.onrender.com"` — URL hardcodeada directamente en el código fuente. Para apuntar a un servidor de staging o local durante desarrollo, hay que editar el archivo y acordarse de no comitearlo con la URL de desarrollo.
- **Problema adicional:** El nombre del proyecto en Render (`fithub-d1pe`) es visible en el código fuente público si el repo se hace open source.
- **Fix:** `export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://fithub-d1pe.onrender.com"` — ya existe la variable en `.env.example`.

---

#### 31. Coordenadas geográficas sin validación de rango

- **Archivo:** `backend/src/routes/places.ts` líneas 23-25
- **Condición exacta:** El endpoint `GET /api/places/nearby?lat=X&lng=Y` acepta cualquier valor para `lat` y `lng`. Un usuario puede enviar `lat=99999&lng=99999` (coordenadas imposibles). `parseFloat("99999")` retorna `99999`. La query a Google Places API con coordenadas inválidas falla, pero el error puede ser confuso. Un atacante puede también enviar `lat=NaN` → `parseFloat("NaN")` = `NaN` → la query de Google Maps API falla con error 400, que se propaga como 500 al cliente.
- **Rangos válidos:** latitud: -90 a 90, longitud: -180 a 180.

---

#### 32. Timezone mismatch en registros de nutrición

- **Archivo:** `backend/src/routes/nutrition.ts` líneas 21-22
- **Condición exacta:** El endpoint recibe `date` del cliente como string `"2025-03-24"`. El backend hace `new Date(date + "T00:00:00.000Z")` — forzando UTC. Un usuario en Ciudad de México (UTC-6) que registra comida a las 11 PM local (5 AM UTC del día siguiente) ve ese registro en el día correcto en la app, pero en la DB está guardado como día siguiente. Esto corrompe las estadísticas de "calorías por día" en los charts de nutrición.
- **Contraste:** El endpoint de steps SÍ lo hace bien — recibe la fecha local del cliente sin convertir a UTC.

---

#### 33. Errores de Cloudinary sin logging ni tracking

- **Archivo:** `backend/src/routes/social.ts` — funciones de upload/delete
- **Condición:** Cuando se borra un post con media, se llama `deleteCloudinaryResource(m.publicId, ...)` en un `.catch(() => {})` vacío. Si Cloudinary está caído, las imágenes/videos quedan huérfanos (nadie los referencia pero ocupan storage y se facturan). Con muchas deleciones fallidas, los costos de Cloudinary se disparan sin visibilidad.
- **Mismo patrón en:** `backend/src/routes/users.ts` línea 153 (borrado de avatar anterior al cambiar avatar).
- **Fix mínimo:** `.catch(err => console.error("[Cloudinary cleanup failed]", err.message, { publicId: m.publicId }))` para al menos tener visibilidad.

---

#### 34. Metas de nutrición hardcodeadas como fallback

- **Archivo:** `backend/src/routes/nutrition.ts` líneas 42-45
- **Condición:** Si el usuario no ha configurado sus metas de macros, el endpoint retorna:
  ```typescript
  calorieGoal: user?.calorieGoal ?? 2000,   // 2000 kcal genérico
  proteinGoal: user?.proteinGoal ?? 150,    // 150g proteína
  carbsGoal:   user?.carbsGoal ?? 250,      // 250g carbos
  fatGoal:     user?.fatGoal ?? 65,         // 65g grasa
  ```
  Estos valores son para un hombre de ~75kg con actividad moderada. Para una mujer de 55kg sedentaria o un atleta de 100kg, estos valores son completamente incorrectos y dan un tracking de nutrición incorrecto sin advertir al usuario que son genéricos.
- **Fix:** Mostrar aviso en la UI ("Configura tus metas personalizadas") cuando se usen los defaults.

---

#### 35. Botón de submit no deshabilitado durante verificación de username

- **Archivo:** `mobile/app/(auth)/sign-up.tsx`
- **Condición exacta:** El usuario escribe un username, el debounce de 500ms inicia la verificación (`usernameChecking = true`). Durante esos 500ms de espera + el tiempo de la llamada API, el botón "Crear cuenta" NO está deshabilitado por la condición de `usernameChecking`. El usuario puede presionar "Crear cuenta" mientras aún se está verificando si el username está disponible, enviando un username que podría no estar validado aún.
- **Estado del código:** El botón sí verifica `usernameError !== null` pero no verifica `usernameChecking === true`. Si el API de check-username es lento (cold start de Render), hay una ventana de ~3-5 segundos donde el submit es posible con username no verificado.

---

#### 36. Sin rate limiting en ningún endpoint

- **Archivo:** `backend/src/index.ts` — configuración del servidor Express
- **Condición:** No hay middleware de rate limiting (`express-rate-limit` o similar). Cualquier IP puede hacer:
  - 1000 requests/segundo al endpoint `POST /api/auth` (brute force de contraseñas)
  - 1000 requests/segundo a `GET /api/users/check-username/:username` (enumeración de usuarios existentes)
  - 1000 requests/segundo a `POST /api/social/posts` (spam de posts)
  - DDoS básico que puede tumbar el servidor en Render (plan gratuito con recursos limitados)
- **Fix mínimo:** `npm install express-rate-limit` + `app.use(rateLimit({ windowMs: 15*60*1000, max: 100 }))` como global, con límites más estrictos en endpoints sensibles.

---

#### 37. `any` types adicionales identificados

Más allá de los ya documentados, encontrados en la auditoría profunda:

| Archivo | Línea | Uso de `any` | Riesgo |
|---------|-------|--------------|--------|
| `backend/src/routes/webhooks.ts` | 35 | `let payload: any` | El payload del webhook no está tipado, acceso unsafe a `.type`, `.data` |
| `backend/src/routes/places.ts` | 134 | `const data: any = await gRes.json()` | Respuesta de Google Places API sin tipo |
| `backend/src/routes/social.ts` | múltiples | `media.filter((m: any) => ...)` | Items de media sin tipo en destructuring |
| `mobile/app/(tabs)/steps.tsx` | 266-267 | `useState<any>(null)` para `todayData` y `weekData` | `.steps`, `.goal` accedidos sin verificación |
| `mobile/app/workout/active.tsx` | varios | Zustand store con `any` implícito en algunas acciones | Estado del workout podría corromperse silenciosamente |

---

#### 38. Años y números de query sin validación de rango

- **Archivo:** `backend/src/routes/steps.ts` — endpoint `GET /api/steps/month`
- **Condición:** `parseInt(req.query.year as string) || new Date().getFullYear()`. El usuario puede enviar `year=1900` o `year=2099`. La query `WHERE date BETWEEN 1900-01-01 AND 1900-12-31` retorna 0 resultados (correcto), pero si se usa para cálculos de fecha como `new Date(year, month, 0)`, ciertos valores extremos pueden producir fechas inválidas o comportamiento inesperado en JavaScript.

---

### Resumen ejecutivo de issues por categoría

| Categoría | Cantidad | Severidad máxima | Archivos afectados |
|-----------|----------|-----------------|-------------------|
| Race Conditions | 4 (username×2, challenge join, MILESTONE win) | 🔴 Crítico | users.ts, webhooks.ts, challenges.ts, challengeProgress.ts |
| Operaciones no transaccionales (XP+entry) | 2 flujos | 🔴 Crítico | nutrition.ts, workouts.ts |
| Workout creation sin manejo de error | 1 | 🔴 Crítico | active.tsx |
| Loop de N queries | 2 endpoints | 🔴 Crítico | users.ts (progress), challengeProgress.ts |
| N+1 / 14 queries paralelas en perfil | 1 | 🔴 Crítico | profile.ts |
| Memory Leaks | 3 en steps.tsx | 🔴 Crítico | steps.tsx |
| Borrado sin soft delete | 1 | 🔴 Crítico | webhooks.ts |
| Sin rate limiting | Todo el backend | 🔴 Crítico | index.ts |
| Validación inputs numéricos | 6+ endpoints | 🟠 Alto | nutrition, steps, places, onboarding |
| API_URL hardcodeada | 1 | 🟠 Alto | api.ts L7 |
| XP no transaccional | 2 flujos | 🟠 Alto | nutrition.ts, workouts.ts |
| Timeout API 100s | 1 | 🟠 Alto | api.ts L11 |
| Exposición datos sensibles | 1 | 🟠 Alto | profile.ts /compare |
| unsafeMetadata sin sanitizar | 1 | 🟠 Alto | webhooks.ts L62-76 |
| Suggestions en RAM | 1 | 🟠 Alto | users.ts L500-575 |
| Cloudinary cleanup silencioso | 2 lugares | 🟠 Alto | social.ts, users.ts |
| Timezone mismatch nutrición | 1 | 🟠 Alto | nutrition.ts L21-22 |
| Coordenadas sin validar | 1 | 🟠 Alto | places.ts L23-25 |
| God Files | 6 archivos | 🟡 Medio | social.tsx, profile.ts, badges.ts... |
| `any` types | 15+ lugares | 🟡 Medio | api.ts, social.ts, places.ts, steps.tsx... |
| Hardcoded values | 12+ valores | 🟡 Medio | nutrition.ts, steps.ts, api.ts... |
| Botón submit durante username check | 1 | 🟡 Medio | sign-up.tsx |
| Metas nutrición defaults incorrectos | 1 | 🟡 Medio | nutrition.ts L42-45 |
| Índices DB faltantes | 4 queries | 🟡 Medio | schema.prisma |
| Retry insuficiente | 1 | 🟡 Medio | api.ts L42-58 |
| Refresh race condition | 1 | 🟡 Medio | profile.tsx |
| Years sin validar en steps month | 1 | 🟡 Medio | steps.ts |
| Empty states | 4 pantallas | ⚪ Bajo | HistoryTab, PostsTab, BadgesTab, StatsTab |
| Accesibilidad | Todo el repo | ⚪ Bajo | social.tsx, nutrition.tsx... |
| timeAgo() sin memoización | 1 | ⚪ Bajo | social.tsx |
| TODO: comentarios no implementados | 1 | ⚪ Bajo | social.tsx ~L1082 |
| Sin tests | Todo el repo | 🟠 Alto | — |

---

## Decisión Pendiente: Fuentes de Datos — Ejercicios y Nutrición

> Esta sección documenta una decisión arquitectónica crítica que debe resolverse antes de escalar. Ambos problemas son independientes y pueden atacarse en sprints distintos.

---

### PROBLEMA 1 — ExerciseDB API (RapidAPI) viola ToS si se cachea, y requiere internet

#### Contexto exacto del problema

La app **actualmente** consulta `https://exercisedb.p.rapidapi.com` en tiempo real para TODA interacción con ejercicios:
- Pantalla de selección de ejercicio (`workout/exercise-picker.tsx`) → llama `exerciseAPI.getByBodyPart()` o `exerciseAPI.search()`
- Cada llamada va al backend → el backend llama a RapidAPI → responde al mobile

**Lo que SÍ se guarda en DB (permitido por ToS):**
- `externalId` (String) — solo el ID de referencia del ejercicio en ExerciseDB
- `exerciseName` (String) — solo el nombre en texto plano
- Ambos están en el modelo `WorkoutSet` de Prisma

**Lo que NO se guarda (los datos completos del ejercicio):**
- `instructions[]`, `gifUrl`, `bodyPart`, `target`, `equipment`, `secondaryMuscles` — todo llega solo en runtime desde la API

**Problema UX:** Si el usuario está en un gimnasio con WiFi malo o sin señal, **no puede seleccionar ejercicios ni ver instrucciones durante su workout**. Esto es un bloqueante crítico de UX.

**Problema de escalabilidad:** RapidAPI cobra por request. Con 10,000 usuarios activos buscando ejercicios 5 veces por sesión = 50,000 requests/día = costos que escalan sin control.

---

#### Evaluación de opciones — Ejercicios

| Opción | Licencia | Offline | Costo | GIFs/Imágenes | Calidad datos | Esfuerzo impl. |
|--------|----------|---------|-------|---------------|---------------|----------------|
| **A. Seguir con ExerciseDB (RapidAPI)** | ❌ ToS prohibe almacenar | ❌ No | $$/mes escalando | ✅ 1300+ GIFs | ✅ Excelente | ✅ Cero |
| **B. wger Open Source dataset** | ✅ AGPL (datos libres) | ✅ Sí | $0 | ⚠️ Sin GIFs (solo texto/SVG) | ✅ Bueno (~800 ejercicios) | 🟡 Medio |
| **C. Seed desde dataset GitHub CC** | ✅ MIT/CC0 | ✅ Sí | $0 | ⚠️ Limitado | 🟡 Variable | 🟡 Medio |
| **D. Construir Exercise model propio en Prisma** | ✅ Propio | ✅ Sí | $0 | 🔧 A criterio | ✅ Controlable | 🔴 Alto |
| **E. Free Tier de ExerciseDB + caché client-side en AsyncStorage** | ⚠️ Zona gris | ✅ Parcial (solo ejercicios usados) | $0 (hasta límite) | ✅ GIFs | ✅ Excelente | 🟡 Medio |

#### ✅ Recomendación para ejercicios: Opción D con seed de wger

**Razonamiento:**
1. Crear modelo `Exercise` en Prisma (no existe actualmente — `CustomExercise` es solo para los creados por usuarios)
2. Seed de ~800-1000 ejercicios desde el dataset de [wger](https://github.com/wger-project/wger) que es AGPL y permite almacenar los datos
3. Para imágenes: usar ilustraciones SVG de grupos musculares (libres) en lugar de GIFs animados — es más limpio y pesa menos
4. El `exerciseService.ts` existente puede apuntar al endpoint propio en vez de RapidAPI con cambio mínimo
5. Los `CustomExercise` del usuario ya existen en DB — el merge de ambos en la UI es sencillo

**Schema a crear:**
```prisma
model Exercise {
  id               String   @id @default(cuid())
  externalId       String?  @unique  // ID del dataset fuente (wger id, etc.)
  name             String
  nameEs           String?  // Nombre en español
  bodyPart         String
  target           String
  equipment        String
  instructions     String[]
  secondaryMuscles String[]
  difficulty       String?
  imageUrl         String?  // URL de ilustración SVG/PNG (Cloudinary)
  isActive         Boolean  @default(true)
  source           String   @default("wger") // "wger" | "custom" | "admin"
  createdAt        DateTime @default(now())

  workoutSets     WorkoutSet[]
  templateSets    TemplateSet[]
  personalRecords PersonalRecord[]

  @@index([bodyPart])
  @@index([name])
  @@map("exercises")
}
```

**Pasos de implementación:**
1. Crear migración Prisma con modelo `Exercise`
2. Crear script `backend/prisma/seed-exercises.ts` que importa el dataset wger (disponible como JSON en su repo)
3. Actualizar `exerciseService.ts` para buscar en DB en vez de RapidAPI
4. Actualizar `WorkoutSet` para referenciar `Exercise` (además del `externalId` texto plano actual)
5. Mantener backward compatibility: si `customExerciseId` → usa `CustomExercise`, si `exerciseId` → usa `Exercise`

---

### PROBLEMA 2 — Nutrición: Solo entrada manual, sin búsqueda de alimentos ni barcode

#### Contexto exacto del estado actual

La infraestructura en Prisma ya está lista (enum `FoodSource` con `BARCODE | AI_PHOTO | SEARCH | SAVED`), pero **ningún flow está implementado**. El usuario solo puede ingresar macros manualmente campo por campo — extremadamente tedioso para un tracking serio.

**Lo que falta implementar:**
1. **Búsqueda de alimentos por nombre** (FoodSource.SEARCH) — "2 tazas de avena" o "Big Mac" → auto-rellena macros
2. **Escaneo de barcode** (FoodSource.BARCODE) — escanear código de barras del producto → auto-rellena macros
3. **Foto con IA** (FoodSource.AI_PHOTO) — ya tiene endpoint en `ai.ts`, falta conectar a nutrición

---

#### Evaluación de opciones — Nutrición

| Opción | Licencia almacenamiento | DB size | Barcode | Gratis | Productos latam | Esfuerzo |
|--------|------------------------|---------|---------|--------|-----------------|---------|
| **Open Food Facts** | ✅ CC BY-SA — puede almacenar | 3M+ productos | ✅ Sí | ✅ Sí, ilimitado | ✅ Muy bueno (México, LATAM bien cubierto) | 🟢 Bajo |
| **USDA FoodData Central** | ✅ Datos públicos — puede almacenar | 600k alimentos | ⚠️ Limitado | ✅ Sí (API key gratis) | ❌ Principalmente EE.UU. | 🟢 Bajo |
| **Nutritionix** | ✅ Permite almacenar con atribución | 1M+ branded + restaurantes | ✅ Sí | ⚠️ 500 req/día gratis | ✅ Bueno | 🟡 Medio |
| **Edamam Food DB** | ❌ No permite almacenar en free tier | 900k items | ✅ Sí | ❌ Solo 1000 req/mes | 🟡 Regular | 🟡 Medio |
| **Spoonacular** | ❌ No permite almacenar en free | 365k | ✅ Sí | ❌ Muy limitado | ❌ Poca | 🟡 Medio |
| **DB local propia (seed USDA + OFF)** | ✅ Totalmente libre | ~3M combinado | ✅ Sí | ✅ Sí | ✅ Excelente | 🔴 Alto inicial |

#### ✅ Recomendación para nutrición: Open Food Facts como fuente principal + USDA como fallback

**Razonamiento:**
- **Open Food Facts** es la Wikipedia de los alimentos: 3M+ productos, actualizado por la comunidad, licencia CC BY-SA que **permite almacenar los resultados en DB propia**, gratuito sin rate limits razonables, barcode lookup incluido, excelente cobertura de México y LATAM
- **USDA FoodData Central** cubre ingredientes básicos que Open Food Facts no tiene bien cubiertos (arroz cocido, pollo a la plancha, etc.)
- Juntos cubren el 95%+ de casos de uso sin costo, sin ToS problemáticos

**Flujo recomendado:**
```
Usuario escanea barcode → Open Food Facts API (/product/{barcode}.json)
  → encontrado → cachear en SavedFood table → pre-rellenar form
  → no encontrado → búsqueda por nombre en Open Food Facts
  → no encontrado → búsqueda en USDA FoodData Central
  → no encontrado → entrada manual (flow actual)
```

**Para búsqueda por nombre:**
```
GET https://world.openfoodfacts.org/cgi/search.pl?search_terms=avena&json=1
GET https://api.nal.usda.gov/fdc/v1/foods/search?query=oatmeal&api_key=DEMO_KEY
```

**Para barcode:**
```
GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json
```

**Variables de entorno a agregar:**
- `USDA_API_KEY` — gratuita, solicitar en https://fdc.nal.usda.gov/api-guide.html

---

### TODO — Sprints a planificar

#### Sprint: Migrar ejercicios a DB propia (Prioridad Alta)
- [ ] Crear modelo `Exercise` en `schema.prisma` con campos: `id, externalId, name, nameEs, bodyPart, target, equipment, instructions[], secondaryMuscles[], difficulty, imageUrl, isActive, source`
- [ ] Crear migración Prisma (`npx prisma migrate dev --name add-exercise-table`)
- [ ] Crear `backend/prisma/seeds/exercises.ts` — script que descarga el dataset de wger (JSON disponible en GitHub) y hace upsert masivo en DB
- [ ] Actualizar `backend/src/lib/exerciseService.ts` para buscar en `prisma.exercise.findMany()` en vez de llamar RapidAPI
- [ ] Actualizar `backend/src/routes/exercise.ts` — los endpoints existentes quedan igual, solo cambia la fuente de datos
- [ ] Actualizar `WorkoutSet` en Prisma para agregar relación opcional `exerciseId → Exercise` además del `externalId` texto actual (backward compatible)
- [ ] Probar que `workout/exercise-picker.tsx` funciona offline
- [ ] Eliminar `RAPIDAPI_KEY` del `.env.example` una vez migrado

#### Sprint: Implementar búsqueda de alimentos y barcode (Prioridad Alta)
- [ ] Crear `backend/src/lib/foodSearch.ts` — servicio que llama Open Food Facts y USDA FoodData Central
- [ ] Agregar endpoint `GET /api/nutrition/search?q={nombre}` — busca en Open Food Facts + USDA, retorna array de alimentos con macros
- [ ] Agregar endpoint `GET /api/nutrition/barcode/{code}` — lookup en Open Food Facts por barcode
- [ ] Agregar campo `USDA_API_KEY` a `.env.example`
- [ ] En mobile: actualizar `AddFoodModal` en `nutrition.tsx` para mostrar campo de búsqueda + resultados de API
- [ ] En mobile: implementar barcode scanner usando `expo-barcode-scanner` (ya está en dependencias) → llamar `/api/nutrition/barcode/{code}`
- [ ] Cachear resultados frecuentes en `SavedFood` table para no re-llamar la API (ya existe el modelo)
- [ ] El `FoodSource` enum ya tiene los valores correctos: `SEARCH`, `BARCODE` — solo hay que usarlos

---

## Variables de Entorno (ver `.env.example` para nombres exactos)

**Backend:**
- `DATABASE_URL` — PostgreSQL/Neon connection string
- `CLERK_SECRET_KEY` — Clerk secret para verificar webhooks y auth
- `CLERK_WEBHOOK_SECRET` — Secret para verificar firma de webhooks Svix
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `OPENAI_API_KEY` — Para AI Coach
- `GOOGLE_MAPS_API_KEY` — Para Places API proxy

**Mobile:**
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clave pública de Clerk
- `EXPO_PUBLIC_API_URL` — URL del backend (ej: `https://fit-hub-api.onrender.com`)

---

## Roadmap de Features — Próximos Sprints

> Análisis completo de lo que está implementado, lo que falta y lo que se puede mejorar. Organizado por área funcional y prioridad. Las features con ⚡ son quick wins (alto impacto, bajo esfuerzo).

---

### 🏋️ Workout Tracking

#### Features en schema/backend SIN UI (prioridad inmediata)

**Workout Templates** — modelo `WorkoutTemplate` + `TemplateSet` existen en Prisma, endpoints en backend, pero NO hay UI para crearlos/cargarlos.
- [ ] ⚡ Pantalla de mis plantillas en `workout.tsx`
- [ ] Crear plantilla desde workout completado ("Guardar como plantilla")
- [ ] Cargar plantilla → iniciar workout pre-cargado con ejercicios y sets
- [ ] Plantillas predefinidas del sistema: PPL, Upper/Lower, Full Body, 5/3/1, GZCLP
- [ ] Compartir plantilla con la comunidad (campo `isPublic` ya existe)

**Custom Exercises** — modelo `CustomExercise` existe en Prisma, pero NO hay UI.
- [ ] Botón "+ Crear ejercicio" en el exercise picker
- [ ] Form: nombre, grupo muscular, equipo, instrucciones, músculos secundarios
- [ ] Foto/GIF del ejercicio propio (upload a Cloudinary)
- [ ] Marcar como público para compartir con la comunidad

**Personal Records — visualización**
- [ ] ⚡ Widget de "Últimos PRs" en dashboard (última semana)
- [ ] ⚡ En la pantalla de ejercicio, mostrar PR actual antes de iniciar un set
- [ ] Pantalla de PRs dedicada con historial por ejercicio
- [ ] Gráfica de progresión de 1RM estimado en el tiempo

#### Mejoras al Active Workout (`workout/active.tsx`)
- [ ] **Calculadora de placa** — "¿Cómo cargo 87.5kg en una barra?" → mostrar discos necesarios
- [ ] **Rest timer por ejercicio** — actualmente fijo en 90s, debería ser configurable por ejercicio (compound vs isolation)
- [ ] **Audio cue al terminar el rest** — vibración + sonido configurable
- [ ] **Sugerencia de peso** — "La semana pasada hiciste 3×8 @ 60kg. Intenta 62.5kg hoy" (basado en historial)
- [ ] **SetType UI diferenciado** — el enum `SetType` tiene WARMUP, DROPSET, SUPERSET, FAILURE, AMRAP pero la UI no los distingue visualmente
- [ ] **Notas por ejercicio** — campo de texto libre para cues de técnica ("codos hacia adentro", "apretón neutro")
- [ ] **1RM estimado inline** — calcular y mostrar mientras el usuario logea (fórmula Epley)
- [ ] **Calor de músculos** — mostrar qué músculos has entrenado hoy con un bodymap simple
- [ ] **Modo no molestar** — desactivar notificaciones automáticamente durante workout activo

#### Mejoras al Workout Summary (`workout/summary.tsx`)
- [ ] **Desglose de ejercicios** — lista de todos los ejercicios: sets × reps × peso
- [ ] **Heatmap muscular** — mapa del cuerpo con calor de estímulo (ya existe `muscleStimulus` en WorkoutSet, no se muestra)
- [ ] **Comparación vs sesión anterior** — "Hiciste 8% más volumen que la última vez que entrenaste esto"
- [ ] **Rating de dificultad** — slider 1-10 "¿Cómo te sentiste?" → alimenta al AI Coach
- [ ] **Share card** — imagen pre-generada para stories de Instagram/WhatsApp
- [ ] **Próximo entrenamiento sugerido** — "Basado en tu volumen de hoy, entrena espalda mañana"
- [ ] ⚡ **Mostrar badges desbloqueados** — si se ganó un badge en este workout, mostrarlo aquí

#### Features de análisis de workout (nuevos)
- [ ] **Análisis de recuperación** — "Llevas 3 días de pecho seguidos, considera un descanso"
- [ ] **Detección de plateau** — "Tu bench press no ha subido en 4 semanas. Aquí hay estrategias"
- [ ] **Deload automático** — después de X semanas de carga, sugerir semana de deload
- [ ] **Balance muscular** — "Tus cuádriceps superan a tus isquiotibiales en volumen (ratio 3:1 vs recomendado 2:1)"
- [ ] **Tiempo bajo tensión** — tempo logging opcional (excentrico:pausa:concentrico)

---

### 🥗 Nutrición

#### Features en schema SIN implementar
- [ ] **Búsqueda de alimentos** — endpoint `GET /api/nutrition/search?q=` + UI en AddFoodModal (ver sección "Decisión Pendiente" arriba)
- [ ] **Barcode scanner** — `expo-barcode-scanner` ya está en dependencias, `FoodSource.BARCODE` ya existe en schema
- [ ] **Biblioteca de alimentos guardados** — modelo `SavedFood` existe, no hay UI dedicada para navegar/editar/eliminar
- [ ] **Foto AI** — `FoodSource.AI_PHOTO` existe, endpoint AI podría recibir imagen y retornar macros estimados

#### Mejoras al tracking diario
- [ ] ⚡ **Anillos de progreso de macros** — círculos estilo Apple Fitness en lugar de solo barras de progreso
- [ ] ⚡ **Aviso de meta alcanzada** — notificación push cuando el usuario llega al 100% de proteína/calorías
- [ ] **Log de timing de comidas** — hora en que se comió cada entrada (para análisis de ayuno intermitente)
- [ ] **Sugerencia de macros faltantes** — "Te faltan 40g de proteína. Agrega: atún, pollo, huevos"
- [ ] **Agua con recordatorios** — notificaciones programables "Bebe agua" cada 2 horas
- [ ] ⚡ **Añadir agua con gestos** — shortcut de +250ml desde el home

#### Features de análisis nutricional
- [ ] **TDEE Calculator** — calculadora de calorías de mantenimiento basada en peso, altura, actividad → pre-llenar metas automáticamente
- [ ] **Presets de macros** — "Alta proteína (30/30/40)", "Keto (5/25/70)", "Balanced (30/40/30)"
- [ ] **Detección de déficit/superávit** — "Esta semana consumiste 300 kcal/día en déficit. Ritmo de pérdida: ~0.3 kg/semana"
- [ ] **Correlación workout-nutrición** — "Los días que entrenaste, comiste 200 kcal menos de mantenimiento"
- [ ] **Semana de macros** — vista semanal de cómo distribuyó cada macro en el tiempo

#### Restricciones y preferencias
- [ ] **Filtros alimentarios** — vegano, vegetariano, sin gluten, sin lactosa, sin frutos secos → filtrar búsquedas
- [ ] **Alergias** — advertencia si alimento buscado contiene alérgeno configurado

---

### 🚶 Pasos y Actividad

- [ ] **Actividad rings** — anillos de cierre estilo Apple Fitness (Mover, Ejercitar, Estar de pie)
- [ ] **Challenge de pasos entre amigos** — "¿Quién llega a 100k pasos primero esta semana?"
- [ ] **Historial de pasos + comparación** — "Esta semana caminaste 15% más que la semana pasada"
- [ ] **GPS tracking de rutas** — modo "Salida" que graba ruta en mapa (para correr/caminar), usando `expo-location` (ya instalado)
- [ ] **Registro de actividades cardio** — correr, bicicleta, nadar (distancia, tiempo, calorías)
- [ ] **Integración con wearables** — Garmin Connect, Fitbit, Oura Ring, Polar (via Health Connect en Android)
- [ ] ⚡ **Meta de pasos dinámica** — ajustar meta según la semana (más activo = meta sube gradualmente)

---

### 🤖 AI Coach

- [ ] **RAG con papers científicos** — implementar retrieval layer con pgvector en Neon o Pinecone. Papers de: PubMed, NSCA, ACSM sobre hipertrofia, nutrición, recuperación. El endpoint `ai.ts` ya existe, solo añadir el retrieval.
- [ ] **Planes de entrenamiento generados por IA** — "Crea un plan de 12 semanas para ganar masa muscular entrenando 4 días" → genera `WorkoutTemplate` y los agrega a la biblioteca del usuario
- [ ] **Análisis de foto corporal** — comparar dos fotos (espalda/frente/lateral) y dar feedback de composición corporal
- [ ] **Voz** — input por voz (expo-speech) + respuesta leída en voz alta (manos libres durante workout)
- [ ] **Coach personalidad** — elegir estilo: "Motivacional 🔥", "Científico 📊", "Militar 💪", "Amigo 😊"
- [ ] **Follow-up automático** — "Hace 3 días preguntaste sobre proteína. ¿Cómo te ha ido?"
- [ ] **Correlación con datos reales** — coach puede decir "Vi que tu volumen de pecho bajó 30% esta semana. ¿Todo bien?"
- [ ] **Export de conversación** — descargar historial de coaching como PDF


### 🏆 Retos y Gamificación

#### Challenges
- [ ] **UI de creación de challenges** — backend existe pero no hay pantalla para crearlos desde mobile
- [ ] **Invitaciones a challenge privado** — enviar invitación a amigos específicos
- [ ] **Challenges de equipo** — grupos de 2-5 personas compitiendo como equipo
- [ ] **Challenges temáticos de temporada** — "Reto de Enero: 100k pasos", "Verano Shred: -5% BF"
- [ ] **Modo espectador** — ver el progreso de amigos en un challenge sin participar
- [ ] **Challenge recurrente** — "Cada lunes nuevo challenge de volumen semanal"

#### Sistema de niveles y XP
- [ ] ⚡ **Animación de level up** — efecto visual/sonido cuando el usuario sube de nivel (con confetti y push notification)
- [ ] ⚡ **"Próximo nivel en X XP"** — indicador en dashboard y perfil
- [ ] **Árbol de habilidades** — por área: fuerza, resistencia, nutrición, social — visualizable como skill tree de videojuego
- [ ] **Prestige system** — al llegar al nivel máximo, reset voluntario con emblema especial y multiplicador de XP
- [ ] **XP por streak de nutrición** — actualmente solo por workouts

#### Rankings
- [ ] **UI de leaderboards** — pantalla completa con tabs Global/Gym/Amigos (backend ya tiene endpoints)
- [ ] ⚡ **"Tu posición global"** — widget en home o perfil: "#347 globalmente, #12 en tu gym"
- [ ] **Rankings por categoría** — fuerza vs cardio vs nutrición vs pasos por separado
- [ ] **Rankings semanales** — reseteo semanal con badge "Top 10 de la semana"
- [ ] **Sistema de rival** — marcar a un usuario como rival, comparación head-to-head en el perfil

#### Badges
- [ ] ⚡ **Push notification al desbloquear badge** — `sendPushToUser` existe en el sistema, solo falta dispararlo en badge unlock
- [ ] **Badges de temporada/evento** — badges limitados en tiempo (San Valentín, Año Nuevo, etc.)
- [ ] **Badge sets con bonus** — completar todos los badges de "Fuerza" desbloquea badge especial + XP extra
- [ ] **Meta-badges** — "Desbloquea 50 badges", "Consigue 3 LEGENDARY", etc.
- [ ] **Badge mastery** — completar mismo badge 3 veces → versión dorada del badge

---

### ⚙️ Settings y Configuración

- [ ] ⚡ **Recordatorios de entrenamiento** — notificaciones programables: "Entrena a las 7pm"
- [ ] ⚡ **Recordatorios de nutrición** — "Registra tu desayuno a las 9am"
- [ ] **Toggle métrico/imperial** — kg ↔ lbs, km ↔ millas (con conversión automática en DB)
- [ ] **TDEE Calculator en settings** — calcular calorías de mantenimiento y auto-rellenar metas
- [ ] **Horas de no molestar** — no enviar push notifications entre X pm y Y am
- [ ] **Días de descanso programados** — "Domingos siempre descanso" → no enviar recordatorio ese día
- [ ] **Exportar mis datos** — descargar CSV/PDF con historial completo (requerimiento GDPR)
- [ ] **Eliminar datos específicos** — borrar historial de nutrición, workouts o pasos por rango de fecha
- [ ] **Nivel de privacidad del perfil** — público / solo seguidores / privado
- [ ] **Ocultar campos del perfil** — peso, % grasa, edad — visibles/ocultos a otros usuarios

---

### 🔔 Notificaciones

- [ ] ⚡ **Agrupación de notificaciones** — "3 personas reaccionaron a tu post" en vez de 3 notificaciones separadas
- [ ] **Horas silenciosas** — configurar horario de silencio
- [ ] **Acciones inline** — aceptar challenge / follow back directamente desde la notificación
- [ ] **Digest diario** — resumen de actividad del día a las 9pm en vez de notificaciones individuales
- [ ] **Notificación de logro semanal** — "Esta semana: 4 workouts, nuevo PR, 2 badges. ¡Tu mejor semana!"

---

### 👤 Perfil y Progreso Corporal

#### Weight tracking (modelo `WeightLog` existe, no hay pantalla)
- [ ] **Pantalla de progreso corporal** — gráfica de peso en el tiempo + % grasa corporal
- [ ] **Log rápido de peso** — desde home o perfil: "Registrar peso de hoy"
- [ ] **Masa libre de grasa** — calcular y mostrar "peso limpio" = peso × (1 - BF%)
- [ ] **Predicción de llegada a meta** — "A este ritmo llegarás a 75kg en ~6 semanas"

#### Medidas corporales
- [ ] **Log de medidas** — pecho, cintura, cadera, brazos, muslos, cuello (modelo a crear en schema)
- [ ] **Fotos de progreso** — galería privada de fotos de progreso con comparación lado a lado
- [ ] **Curva de recomposición** — mostrar peso vs % grasa juntos para ver recomposición corporal real

#### Análisis de perfil mejorado
- [ ] **"Tu mejor semana"** — highlight automático de la semana con más volumen/workouts
- [ ] **Estadísticas de vida** — "Desde que usas FitHub: has levantado X toneladas, caminado Y km, quemado Z kcal"
- [ ] **Links a redes sociales** — Instagram, YouTube, TikTok en perfil público

---

### 🏟️ Gyms y Lugares

- [ ] **UI de gestión de gym** — pantalla dedicada para ver tu gym, los miembros, el leaderboard local
- [ ] **Check-in en gym** — registrar que estás en el gym (gamificado: badge por X check-ins)
- [ ] **PRs por ubicación** — "Mi PR de bench en este gym vs en casa"
- [ ] **Feed del gym** — posts solo de personas de tu mismo gym
- [ ] **Eventos del gym** — crear eventos de entrenamiento grupal en una ubicación

---

### 📊 Analytics y Business Intelligence (Admin)

- [ ] **Panel de admin** — endpoints protegidos para ver métricas de uso (DAU, MAU, retention)
- [ ] **Análisis de retención** — qué features usan más los usuarios que se quedan
- [ ] **A/B testing infrastructure** — probar variantes de UI/UX
- [ ] **Feature flags** — habilitar/deshabilitar features sin deploy (via DB o servicio como LaunchDarkly)
- [ ] **Gestión de badges desde admin** — crear/editar badges sin deploy (ver deuda técnica #17)

---

### 🔗 Integraciones Externas

- [ ] **Apple Watch app** — mostrar workout activo, rest timer, reps counter en muñeca
- [ ] **Garmin Connect** — sync de actividades cardio automático
- [ ] **Oura Ring** — importar datos de sueño y recuperación HRV
- [ ] **Spotify/Apple Music** — controles de música integrados en el workout activo
- [ ] **Google Fit** — sync bidireccional de actividad y nutrición
- [ ] **MyFitnessPal import** — migrar historial de nutrición desde MFP
- [ ] **Strava import** — migrar actividades cardio desde Strava
- [ ] **QR Code de perfil** — generar QR para que otros escaneen y te sigan en el gym

---

### 🌐 Internacionalización y Accesibilidad

- [ ] **i18n** — soporte multiidioma (español, inglés, portugués para LATAM/Brasil)
- [ ] **Nombres de ejercicios en español** — `nameEs` en el futuro modelo `Exercise`
- [ ] **Accesibilidad** — `accessibilityLabel` en todos los componentes interactivos
- [ ] **Modo daltónico** — paleta de colores alternativa para gráficas y badges
- [ ] **Texto grande** — respeto del tamaño de fuente del sistema operativo
- [ ] **Modo offline** — workouts se guardan localmente y sincronizan cuando hay internet

---

### ⚡ Quick Wins — Alto impacto, bajo esfuerzo

Estas features se pueden implementar en 1-2 días cada una:

| # | Feature | Dónde | Esfuerzo |
|---|---------|-------|---------|
| 1 | "Próximo nivel en X XP" en dashboard y perfil | `index.tsx`, `profile.tsx` | 2h |
| 2 | Widget de últimos 3 PRs en dashboard | `index.tsx` | 3h |
| 3 | Badge unlock push notification | `badges.ts` + `challengeProgress.ts` | 2h |
| 4 | Agrupación de notificaciones en UI | `notifications/index.tsx` | 3h |
| 5 | Log rápido de peso desde perfil | nueva pantalla simple | 4h |
| 6 | "Tu posición en el ranking global" en perfil | `profile.tsx` + `challenges.ts` | 3h |
| 7 | Anillos de macro en nutrición | `nutrition.tsx` | 4h |
| 8 | Modal de comentarios (TODO existente) | `social.tsx` ~L1082 | 1 día |
| 9 | Calculadora de placa en workout activo | `active.tsx` | 3h |
| 10 | Share card del workout (imagen para stories) | `summary.tsx` | 1 día |
| 11 | Recordatorio de entrenamiento configurable | `settings/index.tsx` | 4h |
| 12 | Animación de level up (confetti + push) | `users.ts` + hooks de XP | 3h |
| 13 | Rating de dificultad post-workout | `summary.tsx` | 2h |
| 14 | Plantilla "Cargar y empezar" (si ya existe en backend) | `workout.tsx` | 1 día |
| 15 | Feed del gym (posts filtrados por lugar) | `social.tsx` | 4h |
| 16 | Selector de tipo de set (WARMUP/DROPSET/AMRAP) con color diferenciado | `active.tsx` | 2h |
| 17 | 1RM estimado inline al loggear un set (fórmula Epley) | `active.tsx` | 1h |
| 18 | Predicción de llegada a meta de peso | `profile.tsx` | 2h |
| 19 | Estadísticas de vida ("Has levantado X toneladas en total") | `profile.tsx` | 2h |
| 20 | Check-in en gym gamificado (botón en tab de Gym) | `gym.tsx` nueva | 4h |

---

## Nuevas Áreas de Features — Sprints Futuros Ampliados

> Continuación del roadmap. Estas ideas cubren áreas aún NO exploradas en el codebase actual. Cada sección está organizada como un sprint/fase potencial.

---

### 😴 Sprint: Sleep & Recovery Tracking

El sueño es el factor más subestimado en el rendimiento atlético. FitHub puede diferenciar integrando recovery tracking de clase mundial.

#### Sleep Logging
- [ ] **Registro manual de sueño** — hora de dormir, hora de despertar, calidad percibida (1-5). Modelo `SleepLog { userId, bedTime, wakeTime, durationMinutes, quality, notes }` nuevo en schema
- [ ] **Sleep score diario** — algoritmo que combina duración + calidad + consistencia en un score 0-100
- [ ] **Correlación sueño-rendimiento** — "Los días con >7h de sueño, tu fuerza promedio sube 12%"
- [ ] **Patrón de sueño semanal** — gráfica de barras con horas de sueño por día, línea de meta (8h)
- [ ] **Alerta de deuda de sueño** — "Llevas 3 días con menos de 6h. Tu recuperación está comprometida"
- [ ] **Correlación sueño-streak** — si el usuario duerme mal, el AI Coach lo considera antes de recomendar workout intenso

#### HRV y Readiness Score
- [ ] **Log manual de HRV** — campo para ingresar HRV de la mañana (de apps como Elite HRV, Garmin, Oura exportado)
- [ ] **Readiness Score compuesto** — combina: horas de sueño + HRV + días desde último descanso + volumen de carga semanal → score 0-100
- [ ] **Semáforo de readiness** — 🔴 Descansa / 🟡 Entrenamiento ligero / 🟢 A tope
- [ ] **Recomendación adaptativa** — si readiness < 60, el AI Coach sugiere workout de baja intensidad o descanso activo
- [ ] **Integración Oura Ring** — importar HRV, temperatura, sueño via Oura API (OAuth2)
- [ ] **Integración WHOOP** — importar strain, recovery, sleep via WHOOP API

#### Recovery Protocols
- [ ] **Protocolo de recuperación post-workout** — checklist: estiramiento, foam rolling, hidratación, comida post-workout
- [ ] **Timer de recuperación activa** — modo "Descanso activo" con rutina de movilidad guiada
- [ ] **Tracking de dolor muscular (DOMS)** — slider por grupo muscular "¿Cómo está tu pecho hoy?" (1-5) → alimenta al readiness score
- [ ] **Sugerencia de días de descanso óptimos** — basado en volumen de la semana + HRV + sleep

---

### 💊 Sprint: Supplement & Medication Tracking

- [ ] **Stack de suplementos** — modelo `SupplementLog { userId, name, dose, unit, timing, takenAt }`. Registrar: proteína, creatina, cafeína, vitaminas, etc.
- [ ] **Recordatorios de suplementos** — push notification a la hora configurada: "¿Tomaste tu creatina?"
- [ ] **Timing recomendado** — metadata por tipo de suplemento: pre-workout (30min antes), post-workout, con comida, en ayunas
- [ ] **Historial de suplementos** — vista de semana/mes con % de días tomados (adherencia)
- [ ] **Integración con nutrición** — si el usuario logea proteína en polvo, puede agregar a FoodLog con macros pre-configurados
- [ ] **Biblioteca de suplementos** — base de datos curada con: para qué sirve, dosis sugerida, momento óptimo, evidencia científica (A/B/C)
- [ ] **Alerts de interacciones** — "Cafeína + pre-workout ya contiene cafeína → podrías estar tomando doble dosis"
- [ ] **Tracking de hidratación avanzado** — contabilizar agua de alimentos, no solo líquidos directos
- [ ] **Ciclos de suplementación** — "Creatina: carga 20g/día por 5 días, luego 5g/día de mantenimiento" → guía automatizada

---

### 🩹 Sprint: Injury Management & Mobility

El manejo de lesiones es casi inexistente en apps de fitness. FitHub puede liderar aquí.

- [ ] **Registro de lesiones** — modelo `InjuryLog { userId, bodyPart, type(MUSCLE_STRAIN/TENDON/JOINT/OVERUSE/OTHER), severity(1-5), startDate, endDate, notes }` nuevo en schema
- [ ] **Historial de lesiones** — timeline de lesiones pasadas y tiempo de recuperación real
- [ ] **Modificación automática de workout** — si el usuario reporta dolor en hombro derecho, el exercise picker filtra ejercicios que lo afecten y sugiere alternativas
- [ ] **Protocolo de regreso gradual** — "Semana 1: 50% del peso normal en press de banca. Semana 2: 70%. Semana 3: evaluar"
- [ ] **Ejercicios de rehabilitación** — categoría especial en la biblioteca de ejercicios: "Rehab & Movilidad"
- [ ] **Alerta de sobreentrenamiento por zona** — "Llevas 6 sesiones de hombros en 10 días. Riesgo de sobrecarga"
- [ ] **Foam rolling tracker** — log de grupos musculares trabajados con foam roller + duración
- [ ] **Rutinas de movilidad** — biblioteca de rutinas de 5/10/15 minutos por área (cadera, hombros, lumbar, tobillo). Modelo `MobilityRoutine`
- [ ] **Video de técnica** — al agregar un ejercicio, botón "Ver técnica" → video corto de YouTube (no almacenado, solo link)
- [ ] **Modo warm-up asistido** — antes de iniciar workout, app sugiere calentamiento específico según ejercicios del día

---

### 📈 Sprint: Periodization & Programming Avanzado

Para usuarios intermedios/avanzados que quieren estructura científica en su entrenamiento.

#### Sistemas de Periodización
- [ ] **Programas predefinidos** — biblioteca de programas populares listos para cargar:
  - Starting Strength (5×5, progresión lineal)
  - StrongLifts 5×5
  - GZCLP (Tier 1/2/3)
  - 5/3/1 (Wendler) con variantes
  - PPL (Push/Pull/Legs) de Reddit
  - nSuns 531
  - PHUL (Power/Hypertrophy)
  - Coolcicada PPL
- [ ] **Periodización en bloques** — configurar mesociclos: Acumulación → Intensificación → Realización → Deload
- [ ] **DUP (Daily Undulating Periodization)** — días alternos de fuerza/hipertrofia/potencia, el sistema rota automáticamente
- [ ] **Progresión automática** — el sistema sugiere incrementar peso cuando el usuario completa el target de reps por X semanas consecutivas
- [ ] **Deload automático** — detectar cuando el usuario lleva 4+ semanas de carga creciente y sugerir semana de deload al 60-70%
- [ ] **Microciclo semanal** — planeación visual de qué se entrena cada día de la semana (tipo calendario)

#### Auto-regulación (RPE-Based Training)
- [ ] **RPE logging completo** — el campo RPE en WorkoutSet ya existe, pero no se usa para tomar decisiones
- [ ] **1RM estimado por RPE** — tabla de Sorinex: si hiciste 5 reps @ RPE 8 con 100kg → 1RM estimado = ~116kg
- [ ] **Ajuste de carga por RPE** — "Tu RPE objetivo era 7 pero lograste 9. Hoy te esforzaste más de lo planificado → reduce mañana"
- [ ] **Fatigue Management Score** — suma ponderada de RPE × volumen de la semana = carga subjetiva (ACWR: Acute:Chronic Workload Ratio)
- [ ] **Zona verde/amarilla/roja de carga** — si ACWR > 1.5, alertar de riesgo de lesión por spike de carga

#### Analytics de Progresión
- [ ] **Gráfica de 1RM estimado en el tiempo** — por ejercicio (bench, squat, deadlift, OHP, row) con tendencia
- [ ] **Proyección de PR** — "A este ritmo, harás 100kg en bench en ~6 semanas"
- [ ] **Comparación con estándares de fuerza** — tabla basada en peso corporal: Novice / Intermediate / Advanced / Elite (datos de Strength Level)
- [ ] **Índice de Wilks** — para powerlifters: calcular Wilks coefficient para comparar fuerza relativa entre atletas de distinto peso
- [ ] **IPF GL Points** — alternativa moderna al Wilks, más precisa por categoría de peso
- [ ] **Plateau detector avanzado** — detectar plateau en curva de 1RM (3+ semanas sin mejora > 2%) y ofrecer estrategias: deload, variación del ejercicio, cambio de rango de reps

---

### 🏃 Sprint: Cardio & Running Específico

El cardio es un ciudadano de segunda en la app actual. Sprint dedicado para tratarlo igual que el lifting.

#### GPS Running / Cycling
- [ ] **Modo Running** — nueva pantalla `cardio/active.tsx`. Graba GPS en tiempo real con `expo-location`. Muestra: ritmo actual (min/km), distancia, tiempo, calorías, mapa de la ruta
- [ ] **Splits automáticos** — cada kilómetro, registrar split time. Ver splits al terminar: "Km 1: 5:20, Km 2: 5:15, Km 3: 5:40..."
- [ ] **Mapa de la ruta** — `react-native-maps` para visualizar la ruta recorrida con colores según ritmo (verde = rápido, rojo = lento)
- [ ] **Análisis post-ruta** — gráfica de ritmo vs elevación. Dónde frenaste, dónde aceleraste
- [ ] **Historial de rutas** — lista de todas las rutas con mini-mapa, distancia, duración, ritmo promedio
- [ ] **Rutas favoritas** — guardar rutas frecuentes y comparar tiempos entre ejecuciones
- [ ] **Record de ruta** — PR por ruta guardada: "Tu mejor tiempo en esta ruta: 24:35 (hace 2 semanas)"
- [ ] **Modo ciclismo** — misma UI de cardio activo pero con métricas de ciclismo (velocidad, cadencia si hay sensor BLE)
- [ ] **Modo natación** — tracking por vueltas en piscina (manual), distancia, tiempo, estilo
- [ ] **Modo HIIT outdoor** — intervalos programados durante cardio: "30s sprint, 90s caminata × 8"

#### Heart Rate Zones & VO2max
- [ ] **Zonas de frecuencia cardíaca** — configurar 5 zonas basadas en FC máxima (220 - edad o test real). Mostrar tiempo en cada zona durante cardio
- [ ] **Estimación de VO2max** — fórmula de Cooper o submáxima (12 minutos corriendo, medir distancia). Tracking en el tiempo
- [ ] **Cardio score** — composite de: VO2max estimado + tiempo en zona 2 semanal + frecuencia de sesiones cardio

---

### 🥊 Sprint: Deportes Específicos y Modos

#### Powerlifting Mode
- [ ] **Competencia tracking** — registro de intentos (opener / 2nd / 3rd) por levantamiento (squat, bench, deadlift)
- [ ] **Total de fuerza** — SBD total calculado. Comparación vs meets anteriores
- [ ] **Preparación para competencia** — peaking plan automático: 8 semanas antes de meet, carga decrece, intensidad aumenta
- [ ] **Categorías de peso** — clasificar al usuario por categoría IPF. Alertar cuando está cerca de cambiar de categoría

#### Bodybuilding Mode
- [ ] **Simetría corporal** — log de medidas por lado: brazo derecho vs izquierdo, pierna derecha vs izquierda. Detectar desequilibrios
- [ ] **Pose practice tracker** — log de sesiones de práctica de posado con notas de coach o auto-evaluación
- [ ] **Ciclos de bulk/cut** — configurar fase actual (bulk limpio, bulk sucio, cut, mantenimiento). Ajuste automático de calorías objetivo según fase
- [ ] **Rate of weight change** — "Este mes subiste 0.8kg. Para un bulk limpio el objetivo es 0.5-1kg/mes. Estás en rango"
- [ ] **Stage prep countdown** — si hay una competencia de fisiculturismo programada, countdown y progreso de prep

#### CrossFit / Functional Fitness
- [ ] **WOD logger** — workouts tipo AMRAP, For Time, EMOM, Tabata con diferentes métricas (rondas, tiempo, escalado)
- [ ] **Box tracking** — seguir WODs de tu box específico. Compararte con otros miembros
- [ ] **Benchmark WODs** — "Fran", "Murph", "Helen" con historial de tiempos. PR tracking de WODs
- [ ] **Movement library para CF** — kipping pull-up, muscle up, double under, clean & jerk, snatch — con instrucciones específicas

---

### 🤝 Sprint: Workout Buddy & Gym Partner

- [ ] **Matching de compañero de gym** — dentro de tu gym (mismo lugar en Places), emparejar con usuarios de nivel similar + horarios compatibles + goals parecidos
- [ ] **Modo workout juntos** — dos usuarios sincronizan su sesión. Ven el progreso del otro en tiempo real. Pantalla split: "Tu / Amigo"
- [ ] **Reto 1vs1** — desafiar a un amigo específico: "¿Quién hace más volumen de piernas esta semana?"
- [ ] **Entrenamiento remoto con coach** — coach puede asignar workout a un atleta. El atleta lo ve en su app, lo ejecuta, el coach ve el log en tiempo real
- [ ] **Sesiones de accountability** — "Dile a tu compañero que vas al gym hoy" → check-in compartido
- [ ] **Virtual training partner** — avatar animado que "te acompaña" en el workout con tus propios PRs históricos como referencia

---

### 💰 Sprint: Monetización & Premium Tier (FitHub Pro)

Arquitectura de monetización sin alienar a usuarios gratuitos.

#### Free vs Pro
| Feature | Free | Pro |
|---------|------|-----|
| Workouts logged | Ilimitado | Ilimitado |
| Historial | 3 meses | Ilimitado |
| Charts | 3 tipos | 8 tipos |
| AI Coach | 10 mensajes/mes | Ilimitado |
| Workout Templates | 3 | Ilimitado |
| Programas predefinidos | 2 | Todos |
| Export de datos | No | CSV/PDF |
| Badgets exclusivos | No | Sí |
| Sin ads | No | Sí |
| Priority support | No | Sí |

#### Implementación técnica
- [ ] **Modelo `Subscription { userId, plan(FREE/PRO/COACH), status, currentPeriodEnd, stripeCustomerId, stripeSubscriptionId }`** en schema
- [ ] **Integración Stripe** — `stripe.ts` en backend. Endpoints: `/api/billing/create-checkout`, `/api/billing/portal`, `/api/billing/webhook` (para escuchar pagos y cancelaciones)
- [ ] **RevenueCat** — alternativa a Stripe directo, maneja In-App Purchases de iOS y Google Play automáticamente. SDK disponible para React Native. Preferible a Stripe para evitar problemas con App Store (Apple exige IAP para subs)
- [ ] **Gating de features** — `useSubscription()` hook que verifica el plan del usuario antes de mostrar features Pro
- [ ] **Paywall UI** — modal animado al intentar acceder a feature Pro. Beneficios claros, social proof, trial de 7 días
- [ ] **Precio** — sugerido: $6.99/mes, $49.99/año (~40% descuento). Tier anual motiva retención

#### Coach Marketplace
- [ ] **Perfil de Coach** — coaches certificados crean perfil con: especialidad, precio/mes, nivel, reviews
- [ ] **Suscripción a coach** — usuario paga $X/mes para acceso a coach. Coach ve sus datos y le asigna workouts
- [ ] **Revenue sharing** — FitHub toma 20-30% de la suscripción al coach
- [ ] **Coach dashboard** — pantalla web (no mobile) donde el coach ve a todos sus atletas: progreso, workouts, compliance
- [ ] **Mensajería coach-atleta** — chat privado separado del AI Coach
- [ ] **Planes de entrenamiento en venta** — coaches publican planes de 4/8/12 semanas para comprar una vez ($5-20)

#### Training Plan Marketplace
- [ ] **Store de planes** — usuarios y coaches venden programas de entrenamiento y dietas
- [ ] **Plan viewer** — antes de comprar, preview de la primera semana del plan
- [ ] **Ratings y reviews** — sistema de estrellas por plan
- [ ] **Plan en progreso** — al comprar, el plan se importa como `WorkoutTemplate` y el usuario puede iniciarlo

---

### 🎥 Sprint: Video & Form Analysis con IA

- [ ] **Grabación de sets** — botón de grabación durante el workout. Video de 10-30 segundos del set. Subida a Cloudinary
- [ ] **Análisis de forma con IA** — enviar frame del video a GPT-4 Vision o Gemini Vision. Recibir feedback: "Las rodillas se van hacia adentro en el squat. Activa los glúteos"
- [ ] **Overlay de ángulos** — usando MediaPipe o PoseNet, detectar keypoints del cuerpo y dibujar ángulos de articulaciones: rodilla, cadera, codo, hombro
- [ ] **Form score** — puntuación 0-100 de la técnica en cada set. Trending a lo largo del tiempo
- [ ] **Biblioteca de videos de sets** — galería de los videos de tus mejores sets y PRs
- [ ] **Form check request** — pedir feedback de forma a la comunidad o al coach. Post especial tipo "FORM_CHECK" donde otros comentan
- [ ] **Comparación con video referencia** — split screen: tu squat vs el squat perfecto de referencia
- [ ] **Detección de rep count automático** — contar repeticiones desde el video usando acelerómetro + pose estimation. Eliminar el conteo manual

---

### 🌟 Sprint: Community, Groups & Clubs

#### Grupos y Clubs
- [ ] **Grupos privados** — modelo `Group { id, name, description, privacy(PUBLIC/PRIVATE), adminId, members[] }` en schema. Como un sub-reddit de FitHub
- [ ] **Tipos de grupos** — por gym, por objetivo ("Runners de CDMX"), por programa ("StrongLifts"), por nivel ("Principiantes")
- [ ] **Feed del grupo** — posts visibles solo para miembros del grupo
- [ ] **Challenges del grupo** — retos exclusivos para miembros
- [ ] **Leaderboard del grupo** — rankings internos del grupo
- [ ] **Rol de admin/moderador** — admin puede aprobar miembros, eliminar posts, crear challenges
- [ ] **Club de running** — tipo especial de grupo con mapas de rutas compartidas y calendario de salidas

#### Eventos Live
- [ ] **Eventos de FitHub** — retos especiales creados por el equipo de FitHub. Ej: "Semana Mundial de la Fuerza" — todos compiten al mismo tiempo
- [ ] **Live workout** — sesión en vivo donde un usuario/coach transmite su workout. Viewers envían reacciones en tiempo real
- [ ] **Virtual races** — carrera virtual de 5K/10K en una semana — todos corren en su lugar, se compara tiempo al terminar

---

### 📱 Sprint: Home Screen Widgets & App Clips

#### iOS Widgets (WidgetKit via expo-widget)
- [ ] **Widget pequeño (2×2)** — anillo de progreso de pasos del día con número y % de meta
- [ ] **Widget mediano (4×2)** — racha + nivel XP + próximo workout del día
- [ ] **Widget grande (4×4)** — resumen completo: macros del día, pasos, último workout, posición en ranking
- [ ] **Widget de racha** — solo el número de días de racha con llama animada. Motiva a no romperla
- [ ] **Widget de water intake** — vasos de agua del día. Tap para agregar un vaso desde el widget
- [ ] **Complication de Apple Watch** — mostrar pasos y racha en la esfera del reloj

#### Android Widgets
- [ ] **Mismo set de widgets** via `react-native-android-widget` o nativo
- [ ] **Shortcut de "Iniciar Workout"** — icono en home que abre directamente la pantalla de workout activo

#### App Clips / Instant App
- [ ] **App Clip de check-in** — escanear QR del gym → App Clip de FitHub → check-in sin instalar la app completa
- [ ] **App Clip de follow** — escanear QR del perfil de alguien → App Clip → seguirlo sin instalar la app

---

### 🧘 Sprint: Mindfulness & Bienestar Mental

El fitness completo incluye la mente. Feature set diferenciador.

- [ ] **Mood tracking** — antes y después del workout: "¿Cómo te sientes?" (slider + emoji). Modelo `MoodLog { userId, mood(1-5), energy(1-5), stress(1-5), loggedAt, note }` en schema
- [ ] **Correlación mood-workout** — "Los días que entrenas, tu estado de ánimo sube un promedio de 1.8 puntos"
- [ ] **Meditación guiada pre-workout** — biblioteca de audios de 2/5/10 minutos de respiración y visualización
- [ ] **Breathing exercises** — técnicas de respiración: Box breathing (4-4-4-4), Wim Hof, 4-7-8. Timer visual animado
- [ ] **Journaling de workout** — campo de diario libre post-workout: "¿Cómo te sentiste hoy?" → el AI Coach lee los journals para dar contexto emocional al coaching
- [ ] **Stress tracking** — integración con HRV para estimar estrés fisiológico. Si el estrés es alto, sugerir yoga en vez de heavy lifting
- [ ] **Screen time fitness** — notificación motivacional cuando el usuario lleva 2h en redes sociales sin moverse: "Lleva 2h sentado. ¿5 minutos de movilidad?"
- [ ] **Gratitud post-workout** — al completar un workout, prompt: "¿Qué salió bien hoy?" → alimenta la motivación a largo plazo

---

### 🍽️ Sprint: Meal Planning & Recipes

- [ ] **Planeación semanal de comidas** — calendario de 7 días donde el usuario asigna comidas a cada slot (desayuno/almuerzo/cena/snacks)
- [ ] **Recetas con macros calculados** — modelo `Recipe { id, name, servings, ingredients[{foodId, amount}], prepTime, cookTime, category }`. Macros totales calculados automáticamente
- [ ] **Biblioteca de recetas de la comunidad** — users pueden publicar recetas. Rating + filtros (alto en proteína, vegano, bajo en carbos, etc.)
- [ ] **Meal prep mode** — "Cocinar X porciones para la semana". Divide ingredientes × porciones automáticamente
- [ ] **Lista de compras automática** — del meal plan semanal → genera lista de ingredientes agrupados por categoría (proteínas, verduras, lácteos, etc.)
- [ ] **Calorías restantes del día** — "Quedan 540 kcal para hoy. Aquí hay 3 opciones de cenas que se ajustan"
- [ ] **Receta desde foto** — foto de la comida → AI Vision estima ingredientes y macros (similar al feature de AI foto ya planificado)
- [ ] **Macros de restaurante** — integración con Nutritionix para buscar platos específicos de cadenas de restaurantes (McDonald's, Subway, Chipotle, etc.)
- [ ] **Meal logging por voz** — "Comí dos huevos con avena" → NLP extrae alimentos y macros automáticamente

---

### 🏫 Sprint: Corporate Wellness & Teams

FitHub B2B — empresas que quieren mejorar el bienestar de sus empleados.

- [ ] **Workspace / Empresa** — modelo `Workspace { id, name, domain, adminId, members[], plan }`. Admin puede invitar empleados por email corporativo
- [ ] **Challenges corporativos** — retos entre departamentos o equipos de trabajo. "Ventas vs Marketing: ¿quién camina más esta semana?"
- [ ] **Leaderboard de empresa** — ranking interno solo visible para empleados de esa empresa
- [ ] **Reporte de bienestar** — dashboard para HR: % de empleados activos, promedio de pasos, % que completaron al menos 3 workouts/semana
- [ ] **Programa de beneficios** — empleados que llegan a X pasos semanales reciben puntos canjeables por beneficios (definidos por la empresa)
- [ ] **Integración con Slack** — bot de Slack que publica el leaderboard semanal de la empresa cada lunes
- [ ] **Pricing B2B** — $3-5/empleado/mes. Con 100 empleados = $300-500/mes. Alto LTV, bajo churn

---

### 📊 Sprint: Advanced Analytics & Data Science

- [ ] **Correlation Matrix** — correlación entre múltiples variables: sueño vs rendimiento, proteína vs fuerza, steps vs mood, etc. Visualización tipo heatmap
- [ ] **Predictive Analytics** — "Basado en tu ritmo actual, estarás en nivel 15 en X días" / "A este ritmo de pérdida de peso, llegarás a tu meta en X semanas"
- [ ] **Anomaly Detection** — detectar caídas inusuales en rendimiento, sueño, o actividad. "Esta semana entrenaste 60% menos que tu promedio. ¿Todo bien?"
- [ ] **Export a Google Sheets** — exportar cualquier dataset (workouts, nutrición, pasos, peso) directamente a Google Sheets via API
- [ ] **Personal Report mensual** — PDF generado automáticamente cada fin de mes: highlights, PRs, progreso vs metas, gráficas. Enviado por push/email
- [ ] **Benchmark vs población** — comparar tus stats vs el percentil de todos los usuarios de FitHub. "Tu volumen semanal está en el top 25%"
- [ ] **Time-of-day analytics** — "Rindes mejor entrenando entre 5pm y 7pm (fuerza 8% superior vs mañanas)"
- [ ] **Análisis de fatiga acumulada** — ACWR (Acute:Chronic Workload Ratio). Si la carga de esta semana supera 1.3× el promedio de las últimas 4 → alerta de riesgo

---

### 🔐 Sprint: Privacy, Safety & Trust

- [ ] **Privacidad granular de datos** — por campo: peso, % grasa, altura, macros, workouts, posts — cada uno configurable como Público / Solo seguidores / Solo yo
- [ ] **Modo incógnito** — navegar el feed y perfiles sin que aparezca en la lista de "visto por"
- [ ] **Block de usuarios** — bloquear usuario → desaparece su contenido, no puede ver el perfil del bloqueador
- [ ] **Content warnings** — marcar posts con advertencias: lesiones, before/after extremos, etc.
- [ ] **Safety check post-workout** — si el usuario logea un workout de >3h, opcionalmente recordarle hidratación y descanso
- [ ] **Emergency contact en perfil** — campo opcional para contacto de emergencia visible para el gym donde hace check-in
- [ ] **Exportar historial GDPR** — botón en settings para recibir todos los datos personales en formato JSON (requerimiento legal en muchos países)
- [ ] **Borrado de cuenta en app** — flujo de eliminación de cuenta desde la app (no solo desde Clerk). Confirmación de 30 días con posibilidad de reactivar (soft delete — ver deuda técnica #5)

---

### 🎮 Sprint: Gamificación Avanzada (Beyond XP)

Llevar la gamificación al siguiente nivel, estilo videojuego.

#### Quest System
- [ ] **Quests diarias** — 3 misiones diarias rotativas: "Completa un workout hoy" (+50 XP), "Registra 3 comidas" (+30 XP), "Llega a tu meta de pasos" (+40 XP)
- [ ] **Quests semanales** — misiones de mayor alcance: "5 workouts esta semana" (+300 XP), "7 días de nutrición registrada" (+200 XP)
- [ ] **Quests épicas** — misiones de largo plazo: "Levanta 1 tonelada en total en el mes" (+1000 XP), "30 días de racha" (+2000 XP)
- [ ] **Quest chains** — serie de misiones que desbloquean la siguiente al completarse: "Novato → Atleta → Campeón" — narrativa progresiva

#### Titles & Cosmetics
- [ ] **Títulos** — texto decorativo bajo el nombre en el perfil: "Iron Warrior", "Nutrition Master", "Step King", "Consistency Legend". Se desbloquean por logros específicos
- [ ] **Marcos de avatar** — borde decorativo del avatar: llamas (racha > 30 días), corona (top 10 global), etc.
- [ ] **Temas de perfil** — color scheme del perfil: oscuro, dorado, azul neón, verde naturaleza. Algunos exclusivos de Pro o de badges LEGENDARY
- [ ] **Emotes de reacción** — reacciones animadas al ver el workout de un amigo: diferente de los emojis estáticos actuales
- [ ] **Trophy Room** — pantalla dedicada a todos los logros visualizada como una sala de trofeos 3D (usando Lottie animations)

#### Seasonal Events
- [ ] **Temporadas de 3 meses** — cada temporada tiene: tema visual, badge exclusivo de temporada, leaderboard fresh desde 0, rewards especiales para los top 3
- [ ] **Battle Pass** — libre vs premium. Track de recompensas progresivas (XP, badges, cosmetics) que se completa en la temporada
- [ ] **Eventos de fin de año** — "Reto Diciembre: 31 workouts en 31 días" con badge LEGENDARY exclusivo
- [ ] **Eventos de comunidad** — cuando 1,000 usuarios completan el reto → se desbloquea contenido especial para todos

---

### 🗺️ Sprint: Maps & Location Features Avanzado

- [ ] **Mapa global de usuarios** — mapa interactivo de dónde están los usuarios de FitHub. Heatmap de densidad por ciudad
- [ ] **Explorar gyms cercanos** — buscar gyms con FitHub users activos. Ver cuántos miembros activos, leaderboard del gym
- [ ] **Rutas de running compartidas** — publicar tu ruta GPS en la comunidad. Otros pueden "importar" la ruta y compararla
- [ ] **Outdoor workout spots** — marcar spots de entrenamiento al aire libre (parques con barras, escaleras, etc.) con info de equipamiento disponible
- [ ] **Heat map de actividad personal** — tu propio mapa de calor de dónde has corrido/caminado en los últimos meses
- [ ] **Social run** — organizar salida grupal desde un punto de encuentro. Los interesados se apuntan. Al terminar, el líder marca la ruta como completada

---

### 🔧 Sprint: Developer Experience & Infrastructure

Mejoras de infraestructura que no son features visibles pero son críticas para escalar.

#### Testing
- [ ] **Suite de tests unitarios backend** — Jest + Supertest. Cobertura mínima: webhooks, check-username, challenge progress
- [ ] **Tests de integración con DB de test** — Prisma con base de datos SQLite en memoria para tests rápidos
- [ ] **Tests de componentes mobile** — React Native Testing Library. Prioridad: sign-up form, workout active, nutrition logging
- [ ] **CI/CD pipeline** — GitHub Actions: en cada PR, correr TypeScript (`npx tsc --noEmit`), ESLint, y tests. Bloquear merge si falla

#### Observability
- [ ] **Logging estructurado** — reemplazar `console.log` con Winston o Pino. Formato JSON con: timestamp, level, requestId, userId, route, duration
- [ ] **Error tracking** — integrar Sentry en backend y mobile. Capturar errores no manejados con contexto (userId, route, stack)
- [ ] **APM (Application Performance Monitoring)** — DataDog o NewRelic. Ver qué endpoints son más lentos, qué queries tardan más
- [ ] **Health check endpoint** — `GET /health` que verifica: DB conectada, memoria OK, disco OK. Usado por Render para restart automático
- [ ] **Alertas de error** — si 5xx rate > 5% en 5 minutos → alerta a Slack/email del equipo

#### Caching
- [ ] **Redis** — agregar Redis (Upstash gratuito). Cachear: leaderboards (TTL 5min), suggestions (TTL 1h), exercise list (TTL 24h), profile combo (TTL 2min)
- [ ] **Cache invalidation** — cuando el usuario actualiza su perfil, invalidar cache de `profile/:userId/combo`
- [ ] **React Query en mobile** — reemplazar el fetch directo con axios por React Query/TanStack Query. Cache automático, stale-while-revalidate, retry logic, optimistic updates

#### Database
- [ ] **Read replicas** — Neon soporta read replicas. Enviar queries de lectura (GET perfil, leaderboard, feed) a la réplica para no saturar la DB primary
- [ ] **Connection pooling** — PgBouncer o el connection pooler de Neon para no agotar conexiones con el servidor serverless de Render
- [ ] **Backup automático** — Neon hace backups automáticos, pero documentar y probar el restore. Simular disaster recovery trimestral
- [ ] **Índices missing** — agregar índices compuestos faltantes (ver deuda técnica #18)

---

### 🌍 Sprint: Growth & Viral Features

Features diseñadas explícitamente para crecimiento orgánico.

- [ ] **Sistema de referidos** — cada usuario tiene código de referido único. Si alguien se registra con tu código: tú ganas 500 XP, él gana 300 XP + badge "Recién llegado con amigo"
- [ ] **Share dinámico de logros** — al desbloquear un badge LEGENDARY, popup: "¡Comparte este logro!" → genera imagen con tu foto + badge + stats → compartir a Instagram Stories / WhatsApp / TikTok
- [ ] **Share de PR** — al registrar un PR, card estilo NBA (paleta de colores épica): "NUEVO RÉCORD PERSONAL — 120kg Bench Press — @username"
- [ ] **Share de racha** — al llegar a 30/60/100/365 días de racha, notificación especial con card para compartir
- [ ] **Profile.fithub.app/username** — deep link de perfil público. Accesible sin instalar la app. Muestra: avatar, stats, últimos PRs, badges LEGENDARY. CTA: "Únete a FitHub"
- [ ] **Challenge invite link** — link de invitación a un challenge específico. Al abrir → deep link a la app o web → unirse al challenge
- [ ] **Wrap-up anual** — cada fin de año, resumen animado estilo Spotify Wrapped: "Tu 2025 en FitHub — X workouts, Y toneladas levantadas, Z días de racha, tu canción de entrenamiento más reproducida (Spotify integración)..."
- [ ] **Leaderboard público** — página web pública de top 100 usuarios globales y top 10 por país. SEO indexable

---

### 📲 Sprint: Onboarding & Retention Mejorado

El onboarding actual son 8 pasos. Hay mucho margen para mejorar la retención temprana.

#### Onboarding Mejorado
- [ ] **Onboarding personalizado por objetivo** — la secuencia de pasos cambia según el goal elegido: "Perder peso" vs "Ganar músculo" vs "Mejorar resistencia" → cada rama muestra configuración relevante
- [ ] **Quick start (skip onboarding)** — opción de saltar el onboarding y configurar después. Mostrar banner hasta que esté completo
- [ ] **Onboarding de nutrición** — paso dedicado: ¿quieres trackear nutrición? Configura TDEE y macros ahora. El TDEE se calcula automáticamente con los datos de peso/altura/actividad
- [ ] **First workout guided** — tutorial interactivo del primer workout. Guía paso a paso: "Toca + para agregar un ejercicio → selecciona Bench Press → agrega un set → ingresa peso y reps → completa el set → ¡listo!"
- [ ] **Onboarding coach AI** — en la primera apertura del AI Coach, hay un "diagnóstico" de 5 preguntas: experiencia, lesiones, equipo disponible, tiempo disponible, objective principal → AI Coach tiene contexto para dar respuestas personalizadas desde el inicio

#### Day 1, Day 7, Day 30 Retention
- [ ] **Day 1 email** — bienvenida con "Tus primeros 3 pasos" (logear primer workout, configurar nutrición, seguir a 3 personas)
- [ ] **Day 3 push** — "¿Todo bien? Muchos usuarios logean su primer workout en el día 3"
- [ ] **Win rápido en día 1** — el primer workout siempre da badge "Primer paso" + animación especial → sensación de logro inmediato
- [ ] **Streak protection** — si el usuario lleva 7+ días de racha y no ha loggeado hoy a las 8pm → push: "Tu racha de X días está en riesgo. ¡5 minutos de actividad cuentan!"
- [ ] **Re-engagement para inactivos** — si el usuario no abre la app en 7 días → email/push: "Te extrañamos. Tu nivel X te espera. ¿Qué pasó esta semana?"

---

### 🏅 Sprint: Competencias & Events Reales

- [ ] **Eventos físicos de FitHub** — la app puede anunciar eventos en ciudades específicas (carreras, hackathons de fitness, Open de FitHub)
- [ ] **Virtual Open** — competencia mensual virtual: todos tienen 1 semana para hacer el mismo WOD/PR attempt. Ranking de resultados al final
- [ ] **Clasificatorias** — estructura de torneos: fase local → regional → nacional → global. Badge "Clasificado Nacional 2026"
- [ ] **Juegos FitHub** — evento anual de 1 semana con múltiples pruebas: fuerza (1RM), resistencia (pasos), nutrición (tracking consistency), social (posts de la semana). Campeón por categoría + overall

---

### 🔮 Sprint: Future Tech (Largo Plazo, 12+ meses)

Ideas más ambiciosas que requieren tecnología madura o inversión mayor.

- [ ] **AR Form Coach** — realidad aumentada: cámara del teléfono ve al usuario haciendo el ejercicio, overlay de líneas guía y ángulos articulares en tiempo real (MediaPipe + ARKit/ARCore)
- [ ] **AI-generated workout videos** — generar video personalizado de demostración de ejercicio con el avatar del usuario realizando el movimiento (Sora/RunwayML)
- [ ] **3D Body Scanning** — usar TrueDepth camera de iPhone o LiDAR para escanear composición corporal. Comparar meses después
- [ ] **Smart Scale Integration** — conectar con básculas inteligentes (Withings, Garmin Index) via BLE o API para importar peso + % grasa automáticamente
- [ ] **BLE Heart Rate Monitor** — conectar con monitores de FC BLE (Polar H10, Wahoo Tickr) durante el workout. Mostrar FC en tiempo real en la pantalla de workout activo
- [ ] **Voice Workout** — modo completamente hands-free: "Hey FitHub, agrega set. 5 reps, 100 kilos, RPE 8" → se loggea por voz. Sin tocar el teléfono durante el workout
- [ ] **AI Nutritionist Vision** — foto del plato → detectar CADA alimento visualmente y dar breakdown calórico con certeza (modelo especializado fine-tuned en fotos de comida LATAM)
- [ ] **Predictive Injury Prevention** — ML model entrenado en patrones de carga que predice riesgo de lesión 2-3 semanas antes de que ocurra
- [ ] **FitHub API pública** — developers externos pueden construir integraciones. Partner program: apps de nutrición, wearables, gyms pueden integrarse con FitHub

---

### ⚡ Quick Wins Adicionales

| # | Feature | Dónde | Esfuerzo |
|---|---------|-------|---------|
| 21 | Mood emoji antes de workout (1-5) | `active.tsx` inicio | 1h |
| 22 | Contador de series completadas vs total (2/5 sets) | `active.tsx` header | 30min |
| 23 | Confetti al completar el último set del workout | `active.tsx` | 1h |
| 24 | "Días sin entrenar" badge negativo → motivación | `badges.ts` | 2h |
| 25 | Volumen del workout en tiempo real durante sesión | `active.tsx` | 1h |
| 26 | Nota de audio post-set (memo de voz) | `active.tsx` | 4h |
| 27 | Sorteo de ejercicio random del día | `workout.tsx` | 2h |
| 28 | Historial del ejercicio al ver el exercise picker | `exercise-picker.tsx` | 3h |
| 29 | "¿Cuántos días llevas sin [ejercicio]?" | `exercise-picker.tsx` | 2h |
| 30 | Dark/Light mode toggle en settings | `settings/index.tsx` | 2h |
| 31 | Haptic feedback en acciones clave (completar set, badge) | global | 2h |
| 32 | Skeleton loading en vez de spinner en todas las listas | global | 4h |
| 33 | Pull-to-refresh en todas las pantallas que no lo tienen | global | 3h |
| 34 | "Comparte tu racha" botón en profile | `profile.tsx` | 2h |
| 35 | Countdown animado al final del rest timer (3-2-1) | `active.tsx` | 1h |
| 36 | Macro summary al final del día (push a las 9pm) | `backend/notifications` | 3h |
| 37 | Foto de progreso mensual reminder | `backend/notifications` | 2h |
| 38 | Link de invitación de app en perfil | `profile.tsx` | 2h |
| 39 | "Entrena con música" — abrir Spotify sin salir de la app | `active.tsx` | 2h |
| 40 | Preview de tu posición en ranking antes de empezar el workout | `workout.tsx` | 1h |
