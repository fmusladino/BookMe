/**
 * Google Calendar Sync Module
 *
 * IMPORTANTE: No usar barrel exports aquí porque webpack intenta resolver
 * las dependencias estáticamente, incluyendo 'googleapis' que es opcional.
 *
 * Importar directamente desde los módulos específicos:
 *   - "@/lib/google-calendar/client"
 *   - "@/lib/google-calendar/sync"
 *   - "@/lib/google-calendar/appointment-hooks"
 *
 * En API routes, usar import() dinámico:
 *   const client = await import("@/lib/google-calendar/client").catch(() => null);
 */

// Barrel exports removidos intencionalmente para evitar que webpack
// resuelva 'googleapis' en tiempo de build.
