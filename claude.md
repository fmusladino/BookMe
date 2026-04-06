# BookMe — Contexto de Producto para Claude Code

## ¿Qué es BookMe?

BookMe es una plataforma SaaS de gestión de turnos, agenda y negocio diseñada para cualquier profesional o negocio que venda su tiempo en LATAM. No es una plataforma exclusivamente médica: es una herramienta **horizontal de productividad con IA integrada**.

Opera en dos líneas de producto:
- **Línea Healthcare** — médicos, psicólogos, odontólogos, kinesiólogos, nutricionistas y todo profesional de la salud
- **Línea Business** — peluqueros, barberos, entrenadores, coaches, abogados, contadores y cualquier negocio de servicios

### Tres pilares diferenciales
1. **Horizontalidad de mercado** — sirve para todos los rubros
2. **MIA** — asistente IA integrada que guía el onboarding, informa y ejecuta acciones dentro del sistema
3. **Motor de descubrimiento orgánico** — directorio público geolocalizado indexado en Google que actúa como marketplace de profesionales

---

## Diferencias entre líneas de producto

| Feature | Healthcare | Business |
|---|---|---|
| Registro | DNI + nombre/apellido + obra social o prepaga + nº de afiliado (o particular) | Login + DNI + teléfono de contacto |
| DNI como ID único global | ✅ | ✅ |
| Historia clínica | ✅ texto libre, AES-256, solo visible por el profesional | ❌ |
| Notas de sesión | ✅ (complementaria a la HC) | ✅ texto libre por turno |
| Liquidación obra social | ✅ el profesional carga valor por práctica y OS | ❌ |
| Receta electrónica (V2) | ✅ integración API Recetario.com.ar / RCTA | ❌ |
| Teleconsulta (V2) | ✅ Standard y Premium (Daily.co) | ❌ |
| Facturación AFIP (MVP) | ✅ vía Facturante/Factura.ai — solo Argentina | ❌ |
| MIA transcribe HC | ✅ Plan Premium Healthcare | ❌ |

---

## Paneles y Roles del Sistema

| Panel | Usuarios | Descripción |
|---|---|---|
| Panel del Profesional | Médico, peluquero, nutricionista, etc. | Gestión completa de agenda, pacientes, MIA, métricas y facturación OS |
| Panel del Paciente / Cliente | Paciente o cliente final (acceso gratuito) | Ver turnos, historial, descargar recetas e indicaciones (V2) |
| Panel Admin de Consultorio | Secretaria o gestor de clínica/centro | Gestión de múltiples profesionales. MIA con vista de todos los profesionales |
| Super Admin | Socios — acceso idéntico | KPIs en tiempo real, gestión de usuarios, cupones, comunicaciones, alertas de churn |
| Usuario Marketing | 1 cuenta única | Métricas de producto, evolución de profesionales, cupones (puede crear, no modificar), landing analytics, top profesionales, riesgo de abandono |

---

## Funcionalidades MVP (lanzamiento)

| # | Funcionalidad | Detalle | Línea |
|---|---|---|---|
| 1 | Onboarding guiado por MIA | Paso a paso: horarios → tipos de consulta → servicios → config inicial | Ambas |
| 2 | Importador de turnos | Excel/CSV, Google Calendar (.ics), otros SaaS. MIA sugiere mapeo. Reporte de conflictos | Ambas |
| 3 | Configuración de agenda | Días/horarios, duración por tipo de consulta, sobreturno, bloqueos manuales, modo vacaciones | Ambas |
| 4 | Vista semanal/mensual + listado del día | Agenda visual con drag & drop + modo consulta rápida | Ambas |
| 5 | Reserva online | El paciente/cliente se registra, ve disponibilidad y confirma. Sin reserva sin registro | Ambas |
| 6 | Directorio público geolocalizado | Filtros por rubro, ciudad y especialidad. Geolocalización automática. Reserva directa desde resultados | Ambas |
| 7 | SEO — páginas por ciudad y especialidad | Páginas estáticas indexadas: "Kinesiólogos en Rosario", "Dentistas en CABA" | Ambas |
| 8 | Confirmación automática | Email + WhatsApp desde número único BookMe al confirmar un turno | Ambas |
| 9 | Recordatorio 24hs antes | Email + WhatsApp unidireccional. Nombre del profesional como remitente | Ambas |
| 10 | Notificación de cambio de turno | Si el profesional modifica un turno confirmado: email + WhatsApp al paciente con nuevo horario | Ambas |
| 11 | Cancelación y reprogramación online | Profesional o paciente pueden cancelar/reprogramar desde su panel | Ambas |
| 12 | Turno cargado por el profesional | El profesional saca turno en nombre del paciente (turno presencial) | Ambas |
| 13 | Historia clínica digital | Texto libre por turno, AES-256. Solo visible y editable por el profesional | Healthcare |
| 14 | Notas de sesión | Texto libre por turno para peluqueros, coaches, etc. | Business |
| 15 | Liquidación a obra social | El profesional carga valor por práctica y OS. BookMe agrupa y conecta con AFIP vía intermediario | Healthcare |
| 16 | MIA básica (chat flotante) | Preguntas sobre agenda, crear/cancelar/bloquear turnos con confirmación | Ambas |
| 17 | Dashboard de métricas básico | Turnos totales, asistidos, cancelados, ausentes del mes | Ambas |
| 18 | Dashboard financiero (Standard+) | Ingresos particulares + OS pendiente de cobro + total del mes | Healthcare Standard+ |
| 19 | Link directo de reserva | bookme.ar/@nombre compartible por WhatsApp, Instagram y redes | Ambas |
| 20 | Widget Instagram Bio | Link directo bookme.ar/@nombre — Instagram no permite iframes | Ambas |
| 21 | Notificaciones push PWA (Standard+) | Push al celular del profesional cuando un paciente reserva un turno | Ambas Standard+ |
| 22 | Catálogo de servicios + precio | Precio opcional: el profesional decide si lo muestra | Ambas Standard+ |
| 23 | Login Google + Email/Contraseña | Supabase Auth | Ambas |
| 24 | Dark mode + PWA instalable | Toggle en todos los paneles. Instalable en iOS/Android desde el browser | Ambas |
| 25 | Super Admin en tiempo real | MRR, churn, nuevos registros, activos pagos en vivo. Cupones de descuento para campañas | Admin |
| 26 | Usuario Marketing | Evolución, métricas landing (GA4), cupones (puede crear), top profes, riesgo abandono | Admin |
| 27 | Gestión de impago | Aviso día 1 de fallo → gracia 3 días → modo solo lectura hasta regularizar | Sistema |
| 28 | Trial: avisos de vencimiento | 7 días antes + 3 días antes + día del vencimiento | Sistema |
| 29 | Soporte | Email soporte@bookme.ar + Centro de ayuda/FAQ autogestionado | Sistema |
| 30 | Google Analytics 4 | Tracking de uso y comportamiento en plataforma y landing | Sistema |

---

## Restricciones y decisiones ya tomadas

- **Autenticación**: Supabase Auth (Google OAuth + Email/Contraseña)
- **Historia clínica**: encriptada AES-256 en reposo, visible solo por el profesional propietario
- **DNI**: identificador único global en toda la plataforma (tanto Healthcare como Business)
- **Facturación AFIP**: solo para Argentina, vía intermediario (Facturante o Factura.ai)
- **WhatsApp**: número único BookMe (no número propio del profesional)
- **Receta electrónica y Teleconsulta**: V2, no MVP
- **PWA**: instalable en iOS/Android desde el browser. Dark mode en todos los paneles
- **URL pública**: `bookme.ar/@nombre`

---

## Instrucciones para Claude Code

### Fase 1 — Propuesta de arquitectura (hacer esto primero)

Antes de escribir una sola línea de código de negocio, proponé:

1. **Stack completo recomendado** con justificación para cada elección. Considerá:
   - Framework frontend (Next.js App Router, Remix, etc.)
   - Backend / BaaS (Supabase, PlanetScale, etc.)
   - ORM o acceso a datos
   - Autenticación (ya definido: Supabase Auth)
   - Cola de trabajo / background jobs (para notificaciones, recordatorios)
   - Almacenamiento de archivos
   - Proveedor de email transaccional
   - Integración WhatsApp (Twilio, Infobip, Meta Cloud API, etc.)
   - Hosting / deploy
   - Monorepo vs. repos separados

2. **Estructura de carpetas** del proyecto

3. **Modelo de datos** — tablas principales, relaciones, claves foráneas. Incluí:
   - `professionals`, `patients`, `appointments`, `services`, `clinical_records`, `session_notes`, `insurances`, `billing_items`
   - Considerá multi-tenancy: un profesional puede pertenecer a un consultorio

4. **Diagrama de flujos clave**:
   - Flujo de onboarding de profesional (guiado por MIA)
   - Flujo de reserva por parte del paciente
   - Flujo de recordatorio automático (24hs antes)

5. **Módulos y orden de desarrollo sugerido** — qué construir primero para llegar al MVP más rápido

Presentá la propuesta y esperá aprobación antes de empezar a codear.

---

### Fase 2 — Desarrollo módulo por módulo

Una vez aprobada la arquitectura, construí el sistema módulo por módulo en este orden sugerido (podés proponer variaciones si tiene sentido técnico):

**Módulo 0 — Fundamentos**
- Setup del proyecto, estructura de carpetas, variables de entorno, CI/CD básico
- Schema de base de datos + migraciones iniciales
- Supabase Auth (Google + email/contraseña)
- Layout base + Dark mode + PWA manifest

**Módulo 1 — Gestión de agenda**
- Configuración de horarios, duración por tipo de consulta, bloqueos, modo vacaciones
- Vista semanal/mensual con drag & drop
- Listado del día / modo consulta rápida

**Módulo 2 — Reserva online y directorio**
- Registro y login de pacientes/clientes
- Página pública `bookme.ar/@nombre`
- Directorio geolocalizado con filtros
- Páginas SEO estáticas por ciudad y especialidad

**Módulo 3 — Notificaciones**
- Confirmación automática (email + WhatsApp)
- Recordatorio 24hs antes
- Notificación de cambio o cancelación

**Módulo 4 — Historia clínica y notas**
- Historia clínica digital (Healthcare) — AES-256
- Notas de sesión (Business)

**Módulo 5 — MIA (Asistente IA)**
- Chat flotante
- Onboarding guiado paso a paso
- Crear/cancelar/bloquear turnos por voz/texto con confirmación explícita

**Módulo 6 — Facturación y liquidación OS**
- Catálogo de servicios con precio opcional
- Liquidación a obra social
- Integración AFIP vía Facturante/Factura.ai

**Módulo 7 — Dashboards**
- Métricas básicas (turnos totales, asistidos, cancelados, ausentes)
- Dashboard financiero (Standard+)

**Módulo 8 — Paneles de admin**
- Super Admin: KPIs en tiempo real, gestión de usuarios, cupones, alertas de churn
- Usuario Marketing
- Gestión de impago y estados de suscripción

---

### Convenciones de código

- Escribí todo en **TypeScript estricto** (`strict: true`)
- Usá **inglés** para nombres de variables, funciones, componentes y tablas de base de datos
- Usá **español** para comentarios cuando sean necesarios
- Cada módulo debe tener sus propios tests unitarios mínimos
- Seguí principios **SOLID** y arquitectura limpia
- Antes de crear un archivo nuevo, verificá que no exista ya algo similar
- Documentá decisiones técnicas no obvias con comentarios inline

---

### Reglas de seguridad obligatorias

- Historia clínica: encriptada con AES-256 **antes** de guardar en la base de datos. Nunca en texto plano
- Row Level Security (RLS) en Supabase para todas las tablas sensibles
- El profesional solo puede ver los datos de sus propios pacientes
- El Admin de Consultorio puede ver todos los profesionales de su consultorio, pero no los de otros consultorios
- Logs de auditoría para accesos a historia clínica

---

## Notas finales

- El MVP es el objetivo principal. No sobre-ingenierizar.
- Las funcionalidades marcadas como V2 (receta electrónica, teleconsulta) **no** se implementan ahora.
- Cuando algo no esté especificado, preguntá antes de asumir.
- Si encontrás una decisión de diseño que podría mejorarse, señalala y proponé la alternativa.