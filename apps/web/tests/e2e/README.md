# E2E Tests — BookMe

Tests E2E con Playwright que cubren los **5 flujos críticos** antes de lanzar a producción.

## Qué cubren

1. **Home pública y landing** (`01-home.spec.ts`) — la landing carga y los CTAs principales son clickeables
2. **Directorio + reserva guest** (`02-booking-guest.spec.ts`) — un paciente no registrado puede reservar un turno
3. **Login profesional + dashboard** (`03-login.spec.ts`) — un profesional existente ingresa, ve su agenda
4. **Registro paciente + login** (`04-patient-signup.spec.ts`) — un paciente nuevo se registra y puede loguearse
5. **Cancelación de turno** (`05-cancel-appointment.spec.ts`) — un turno confirmado puede cancelarse

## Cómo correr

```bash
# Primera vez: instalar el browser
pnpm test:e2e:install

# Correr todos los tests (levanta dev server solo)
pnpm test:e2e

# Modo UI interactivo (recomendado para debuggear)
pnpm test:e2e:ui

# Contra un deploy específico
E2E_BASE_URL=https://staging.bookme.ar pnpm test:e2e
```

## Variables de entorno

Los tests usan usuarios de prueba. Configurar en `.env.test.local`:

```
E2E_PROFESSIONAL_EMAIL=test+pro@bookme.ar
E2E_PROFESSIONAL_PASSWORD=TestPro123!
E2E_PATIENT_EMAIL=test+patient@bookme.ar
E2E_PATIENT_PASSWORD=TestPatient123!
E2E_PROFESSIONAL_SLUG=test-pro
```

## Estado conocido

- Los tests son **smoke tests** que verifican que los flujos críticos no rompen.
- Para tests unitarios de lógica de negocio: usar Vitest (pendiente en Sprint 2).
- CI: los tests se corren contra el preview de Vercel en cada PR (setup pendiente).
