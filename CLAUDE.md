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
- **Última Fase Completada:** Wellness System Fase 4 — Gamification + Polish (badges, challenges, readiness→training, readiness→nutrition, UI cards). Fases 1-3 (Foundation, Engagement, Intelligence) también completadas en sesiones anteriores.
- **Estado Actual:** Todo compila limpio (`npx tsc --noEmit` sin errores en backend y mobile). 18 archivos modificados/nuevos sin commitear. Prisma client regenerado. Schema tiene 4 nuevos ChallengeType enums pendientes de `prisma db push`.
- **Pendiente Siguiente Sesión:** Hacer commit de todos los cambios de Wellness (Fases 1-4). Ejecutar `prisma db push` para sincronizar los nuevos enum values. Probar end-to-end los flujos de wellness en dispositivo. Seed de los 15 nuevos WELLNESS badges (`POST /api/badges/seed`).