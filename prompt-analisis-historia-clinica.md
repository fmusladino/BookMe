# Prompt: Análisis comparativo COMPLETO — BookMe vs. competidores

> Copiá este prompt completo y pegalo en Claude o ChatGPT para obtener el análisis.

---

Sos un consultor experto en producto digital para plataformas de salud y gestión de turnos en LATAM. Necesito que hagas un análisis exhaustivo comparando **toda la plataforma BookMe** — no solo la historia clínica — contra lo que ofrecen las plataformas competidoras más relevantes del mercado. El objetivo es identificar qué nos falta, qué podemos mejorar, y en qué orden priorizar.

---

## Contexto de BookMe

BookMe es un SaaS de gestión de turnos, agenda y negocio para profesionales que venden su tiempo. Tiene dos líneas: Healthcare (médicos, psicólogos, odontólogos, kinesiólogos, nutricionistas) y Business (peluqueros, barberos, coaches, abogados). Opera principalmente en Argentina.

### Tres pilares diferenciales:
1. **Horizontalidad de mercado** — sirve para todos los rubros, no solo salud
2. **MIA** — asistente IA integrada que guía el onboarding, informa y ejecuta acciones dentro del sistema
3. **Motor de descubrimiento orgánico** — directorio público geolocalizado indexado en Google que actúa como marketplace de profesionales

### Lo que BookMe tiene HOY (MVP):

**Gestión de agenda:**
- Configuración de días/horarios, duración por tipo de consulta, sobreturno, bloqueos manuales, modo vacaciones
- Vista semanal/mensual con drag & drop
- Listado del día / modo consulta rápida

**Reserva online y directorio:**
- Registro y login de pacientes/clientes (Google OAuth + Email/Contraseña via Supabase Auth)
- Página pública bookme.ar/@nombre (link compartible por WhatsApp, Instagram)
- Directorio público geolocalizado con filtros por rubro, ciudad y especialidad
- Páginas SEO estáticas por ciudad y especialidad ("Kinesiólogos en Rosario", "Dentistas en CABA")
- Reserva online: el paciente se registra, ve disponibilidad y confirma
- El profesional puede cargar turno en nombre del paciente (turno presencial)
- Cancelación y reprogramación online por profesional o paciente

**Notificaciones:**
- Confirmación automática por email + WhatsApp (número único BookMe) al confirmar turno
- Recordatorio 24hs antes por email + WhatsApp unidireccional
- Notificación de cambio o cancelación al paciente

**Historia clínica y notas:**
- Historia clínica digital de texto libre por turno (solo Healthcare)
- Encriptada con AES-256 en reposo, solo visible por el profesional propietario
- Notas de sesión para línea Business (texto libre por turno, sin encriptar)
- SIN campos estructurados, plantillas, adjuntos, odontograma, consentimiento informado, planes de tratamiento, exportación al paciente, log de auditoría, firma digital

**MIA (Asistente IA):**
- Chat flotante básico
- Onboarding guiado paso a paso
- Crear/cancelar/bloquear turnos por texto con confirmación explícita
- MIA transcribe HC (Plan Premium Healthcare)

**Facturación y liquidación:**
- Catálogo de servicios con precio opcional
- Liquidación a obra social (el profesional carga valor por práctica y OS)
- Facturación AFIP vía intermediario (Facturante/Factura.ai) — solo Argentina

**Dashboards:**
- Métricas básicas: turnos totales, asistidos, cancelados, ausentes del mes
- Dashboard financiero (Standard+): ingresos particulares + OS pendiente de cobro + total del mes

**Paneles de admin:**
- Super Admin: KPIs en tiempo real (MRR, churn, nuevos registros, activos pagos), cupones de descuento
- Usuario Marketing: evolución, métricas landing (GA4), cupones, top profesionales, riesgo de abandono
- Gestión de impago: aviso día 1 → gracia 3 días → modo solo lectura
- Trial: avisos de vencimiento a 7 días, 3 días y día del vencimiento

**Otros:**
- Dark mode + PWA instalable (iOS/Android desde browser)
- Importador de turnos: Excel/CSV, Google Calendar (.ics)
- Notificaciones push PWA (Standard+) cuando un paciente reserva
- Google Analytics 4 para tracking de uso
- Soporte por email + Centro de ayuda/FAQ

### Lo que BookMe NO tiene todavía:
- Receta electrónica (planificada V2)
- Teleconsulta / videollamada (planificada V2)
- Cobro online al paciente (MercadoPago integrado pero no implementado)
- Reseñas / valoraciones de profesionales
- Sala de espera virtual
- Multi-idioma
- App nativa (solo PWA)
- CRM / marketing automation para el profesional
- Programa de fidelización de pacientes
- Chat entre profesional y paciente
- Integración con Google Calendar bidireccional (solo importa, no sincroniza)
- Portal del paciente completo (solo ve turnos, no descarga recetas ni HC)

---

## Plataformas a analizar

Analizá las siguientes plataformas y cualquier otra que consideres relevante:

### Argentina / LATAM:
1. **Turnito** — turnito.app
2. **Meducar** — meducar.com
3. **Gestión Salud** — gestionsalud.com.ar
4. **Geclisa** — geclisa.com
5. **DigiDoc** — digidoc.com.ar
6. **iGaleno** — igaleno.com
7. **Medifolios** (Colombia) — medifolios.net
8. **Nimbo** (México) — nimbo-x.com
9. **Clinic Cloud** (España/LATAM) — clinic-cloud.com
10. **DocFav** — docfav.com

### Internacionales (referentes de UX y features):
11. **SimplePractice** — simplepractice.com
12. **Jane App** — jane.app
13. **Kareo / Tebra** — kareo.com
14. **Athenahealth** — athenahealth.com
15. **Medesk** — medesk.net
16. **Calendly** — calendly.com (scheduling puro — referente para línea Business)
17. **Fresha** — fresha.com (referente para belleza/barbería)
18. **Acuity Scheduling** — acuityscheduling.com

---

## PARTE 1: Análisis de Historia Clínica Electrónica

### 1.1 Campos y estructura de datos
Para cada plataforma, listá qué campos/secciones incluye su historia clínica:
- Datos demográficos del paciente (más allá de nombre/DNI)
- Antecedentes personales y familiares
- Alergias y medicación actual
- Signos vitales (TA, FC, peso, talla, IMC, temperatura)
- Motivo de consulta
- Examen físico
- Diagnóstico (CIE-10, texto libre, o ambos)
- Plan de tratamiento
- Indicaciones / prescripciones
- Evoluciones / notas de seguimiento
- Adjuntos (imágenes, estudios, PDFs)
- Consentimiento informado
- Formularios de intake / anamnesis para el paciente
- Herramientas por especialidad (odontograma, dermatología, oftalmología, etc.)
- Plantillas predefinidas (SOAP, DAP, BIRP, etc.)
- Plantillas personalizables por el profesional

### 1.2 UX y flujo de trabajo de la HC
- ¿Cómo se integra la HC con el flujo de la consulta? (¿se abre automáticamente al iniciar turno?)
- ¿Tiene vista timeline / cronológica de evoluciones?
- ¿El profesional puede escribir durante la consulta o tiene que completar formularios rígidos?
- ¿Tiene dictado por voz o AI scribe?
- ¿Tiene búsqueda dentro de la HC de un paciente?
- ¿Puede duplicar/copiar notas previas?
- ¿Tiene atajos de texto o snippets?
- ¿Se puede firmar digitalmente cada entrada?

### 1.3 Compliance y seguridad (marco legal argentino)
- **Ley 26.529** (Derechos del Paciente): ¿la plataforma cumple con los requisitos de HC obligatoria, cronológica, foliada y completa?
- **Ley 25.326** (Protección de Datos Personales): ¿cumple con el tratamiento de datos sensibles de salud?
- **Ley 27.706** (Programa Federal de Digitalización de HC): ¿está alineada?
- Encriptación de datos en reposo y en tránsito
- Log de auditoría de accesos y modificaciones
- Inmutabilidad de registros (que no se pueda borrar/editar sin traza)
- Conservación mínima de 10 años
- Exportación / entrega de copia al paciente en 48hs
- Firma electrónica o digital del profesional
- Backup y recuperación de datos

### 1.4 Integraciones clínicas
- Receta electrónica (¿integra con RCTA, Recetario.com.ar, u otros?)
- Laboratorios (recepción de resultados)
- Imágenes diagnósticas (DICOM viewer)
- Teleconsulta integrada con la HC
- Interoperabilidad (HL7 FHIR, estándares)

---

## PARTE 2: Análisis de TODA la plataforma

### 2.1 Gestión de agenda y turnos
- Configuración de horarios (¿multi-sucursal, multi-profesional, turnos rotativos?)
- Vista de agenda (¿semanal, mensual, diaria, por profesional, por consultorio?)
- Drag & drop de turnos
- Sobreturno / lista de espera
- Bloqueos y modo vacaciones
- Turnos recurrentes (ej: "todos los martes a las 10am")
- Duración variable por tipo de servicio
- Disponibilidad en tiempo real
- Buffer time entre turnos
- Gestión de salas / recursos compartidos

### 2.2 Reserva online y experiencia del paciente/cliente
- Reserva desde web / app / WhatsApp
- Registro del paciente (¿qué datos pide? ¿es obligatorio?)
- Selección de profesional + servicio + horario
- Cobro online al momento de reservar (¿MercadoPago, Stripe, otro?)
- Política de cancelación configurable
- Lista de espera automática
- Portal del paciente (¿qué puede ver y hacer?)
- Descarga de recetas, indicaciones, HC
- Chat/mensajería con el profesional
- Reseñas / valoraciones del profesional
- Programa de fidelización / puntos

### 2.3 Directorio y descubrimiento
- Directorio público de profesionales
- SEO / páginas indexadas por ciudad y especialidad
- Geolocalización
- Filtros avanzados (precio, disponibilidad, obra social, idioma, valoración)
- Perfil público del profesional (¿qué muestra?)
- Widget embebible en sitio web del profesional
- Integración con Google Maps / Google Business

### 2.4 Notificaciones y comunicación
- Confirmación de turno (email, SMS, WhatsApp, push)
- Recordatorios (¿cuántos? ¿configurables?)
- Notificación de cambio/cancelación
- Follow-up post-consulta
- Campañas de marketing / email masivo
- WhatsApp bidireccional vs. unidireccional
- Notificaciones push en celular
- Mensajería interna (profesional ↔ paciente)

### 2.5 Facturación, pagos y finanzas
- Cobro online a pacientes
- Facturación electrónica (AFIP u otro ente fiscal)
- Liquidación a obras sociales / seguros
- Gestión de deuda / pagos pendientes
- Reportes financieros
- Integración con contabilidad
- Pasarelas de pago soportadas
- Split payment / comisiones

### 2.6 Asistente IA / Automatización
- Chatbot / asistente para el profesional
- Chatbot para el paciente (reserva por chat)
- AI scribe / transcripción de consulta a HC
- Sugerencias inteligentes (diagnóstico, tratamiento)
- Onboarding guiado
- Automatización de tareas repetitivas
- Reportes generados por IA

### 2.7 Dashboards y analytics
- Métricas de turnos (totales, asistidos, cancelados, no-show)
- Tasa de ocupación de agenda
- Métricas financieras
- Tendencias y comparativas mes a mes
- Reportes exportables (PDF, Excel)
- Analytics de pacientes (nuevos vs. recurrentes, retención)
- Predicción de demanda / horarios óptimos

### 2.8 Multi-profesional / Clínica
- Panel de administración de clínica / centro
- Gestión de múltiples profesionales
- Roles y permisos (admin, secretaria, profesional)
- Agenda compartida / vista cruzada
- Facturación centralizada
- Reportes por profesional
- Multi-sucursal

### 2.9 Experiencia técnica y UX general
- App nativa vs. PWA vs. solo web
- Dark mode
- Velocidad de carga / performance
- Diseño mobile-first
- Onboarding del profesional (¿cuántos pasos?)
- Curva de aprendizaje
- Personalización de marca (logo, colores, dominio propio)
- API pública para integraciones
- Sync bidireccional con Google Calendar / Outlook
- Importación de datos desde otras plataformas

---

## Output esperado

### Tabla comparativa general
Generá UNA tabla grande con todas las plataformas en columnas y TODAS las funcionalidades (de las dos partes) en filas, agrupadas por categoría. Usá ✅ / ⚠️ (parcial) / ❌ para indicar si lo tienen.

### Gap analysis de BookMe
Después de la tabla, hacé un análisis de gaps organizado así:

#### 1. CRÍTICO para el MVP — Implementar YA
Funcionalidades que sin ellas BookMe pierde credibilidad o usuarios no pueden confiar en la plataforma. Separar por línea (Healthcare vs. Business) si aplica.

#### 2. IMPORTANTE — Implementar en V2 (próximos 3-6 meses)
Features que agregan valor significativo y los competidores ya tienen, pero no bloquean la adopción inicial.

#### 3. DIFERENCIADORES — Implementar en V3 (6-12 meses)
Features que posicionarían a BookMe por encima de la competencia o que solo los líderes del mercado tienen.

#### 4. NICE TO HAVE — Backlog
Ideas interesantes pero de bajo impacto inmediato.

### Para CADA funcionalidad faltante, incluí:
- Qué es y por qué importa
- Qué plataformas la tienen
- Para qué línea aplica (Healthcare, Business, o ambas)
- Nivel de esfuerzo estimado (bajo/medio/alto)
- Impacto en adopción (bajo/medio/alto)
- Si hay requisito legal que lo haga obligatorio

### Recomendación final
Cerrá con un roadmap priorizado de las 15 mejoras más importantes que BookMe debería implementar, en orden, explicando por qué en ese orden. Considerá que BookMe es un MVP, tiene un equipo pequeño, y no quiere sobre-ingenierizar.

### Oportunidades únicas
Identificá si hay alguna funcionalidad que NINGUNA de las plataformas analizadas tiene y que BookMe podría implementar como diferenciador radical, especialmente aprovechando MIA (la IA integrada) y la horizontalidad de mercado (servir tanto a Healthcare como Business).
