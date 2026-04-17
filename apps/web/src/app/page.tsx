import Link from "next/link";
import {
  Calendar,
  Clock,
  MapPin,
  Shield,
  Smartphone,
  Users,
  ArrowRight,
  CheckCircle2,
  Dribbble,
  Video,
  Sparkles,
  Bell,
  CreditCard,
  Zap,
  UserPlus,
  Settings,
  Rocket,
  Star,
} from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";
import { LandingCarousel } from "@/components/landing/landing-carousel";
import { Reveal } from "@/components/landing/reveal";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-bookme-navy to-bookme-navy/80 dark:from-bookme-mint dark:to-bookme-mint/80 flex items-center justify-center shadow-md">
              <span className="text-white dark:text-bookme-navy font-bold text-lg">B</span>
            </div>
            <span className="text-2xl font-heading font-bold text-bookme-navy dark:text-bookme-mint">
              BookMe
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/directorio"
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Directorio
            </Link>
            <Link
              href="/soporte"
              className="hidden sm:inline-flex text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Ayuda
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity shadow-sm"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero con badge nuevo y gradiente animado */}
      <section className="relative overflow-hidden">
        {/* Blobs animados */}
        <div className="absolute top-0 -left-20 w-96 h-96 bg-bookme-mint/20 dark:bg-bookme-mint/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-bookme-navy/10 dark:bg-bookme-navy/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />

        <div className="relative max-w-7xl mx-auto px-4 py-20 sm:py-28 text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 px-4 py-1.5 text-xs font-semibold mb-6">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                Nuevo: videoconsultas gratis con link automático
              </span>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-heading font-bold text-foreground leading-tight">
              Gestioná tu agenda
              <br />
              <span className="bg-gradient-to-r from-bookme-navy via-blue-600 to-bookme-mint dark:from-bookme-mint dark:via-blue-400 dark:to-bookme-navy bg-clip-text text-transparent">
                de forma inteligente
              </span>
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              La plataforma de gestión de turnos con IA, videoconsultas y reservas online para profesionales de LATAM. Agenda, recordatorios y mucho más.
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="group inline-flex items-center justify-center gap-2 rounded-lg bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-8 py-3.5 text-base font-semibold hover:shadow-xl hover:shadow-bookme-navy/30 dark:hover:shadow-bookme-mint/30 transition-all"
              >
                Empezá gratis — 30 días
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/directorio"
                className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-bookme-navy dark:border-bookme-mint text-bookme-navy dark:text-bookme-mint px-8 py-3.5 text-base font-semibold hover:bg-bookme-navy/5 dark:hover:bg-bookme-mint/10 transition-colors"
              >
                Explorar directorio
              </Link>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Sin tarjeta de crédito
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Cancelás cuando quieras
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Soporte en español
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Carousel con mockups */}
      <section className="py-16 bg-gradient-to-b from-transparent via-muted/30 to-transparent">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
                Así se ve BookMe
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Una plataforma pensada para que te enfoques en atender, no en organizar.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <LandingCarousel />
          </Reveal>
        </div>
      </section>

      {/* Cómo funciona — 3 pasos */}
      <section className="py-20 bg-card relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal>
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
                Empezás en 3 pasos
              </h2>
              <p className="text-muted-foreground">Menos de 10 minutos y ya estás recibiendo reservas.</p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Línea conectora */}
            <div className="hidden md:block absolute top-12 left-[16.66%] right-[16.66%] h-0.5 bg-gradient-to-r from-bookme-navy/20 via-bookme-mint/40 to-bookme-navy/20 dark:from-bookme-mint/20 dark:via-bookme-navy/40 dark:to-bookme-mint/20" />

            {[
              {
                icon: UserPlus,
                n: "01",
                title: "Creá tu cuenta",
                desc: "Email + Google en 30 segundos. Contestás 3 preguntas sobre tu profesión y listo.",
              },
              {
                icon: Settings,
                n: "02",
                title: "Configurá tu agenda",
                desc: "Elegí días, horarios y modalidades (presencial o virtual). Cargá tus servicios.",
              },
              {
                icon: Rocket,
                n: "03",
                title: "Compartí tu link",
                desc: "bookme.ar/@tunombre · compartilo por Instagram, WhatsApp o imprimí el QR.",
              },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 150}>
                <div className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-br from-bookme-navy to-bookme-navy/80 dark:from-bookme-mint dark:to-bookme-mint/80 flex items-center justify-center shadow-xl shadow-bookme-navy/20 dark:shadow-bookme-mint/20 mb-6">
                    <step.icon className="w-10 h-10 text-white dark:text-bookme-navy" />
                  </div>
                  <div className="text-5xl font-heading font-bold text-muted-foreground/20 absolute top-0 right-1/4">
                    {step.n}
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid — 6 features con mejores gradientes */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
                Todo lo que necesitás, en un solo lugar
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Diseñado para profesionales que venden su tiempo. Desde médicos hasta peluqueros.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Calendar, title: "Agenda inteligente", description: "Semanal, mensual y diaria. Drag & drop, bloqueos y modo vacaciones.", gradient: "from-blue-500/10 to-cyan-500/10", iconBg: "from-blue-500 to-cyan-500" },
              { icon: Video, title: "Videoconsultas gratis", description: "Al reservar virtual, generamos el link automáticamente y se lo enviamos al paciente.", gradient: "from-purple-500/10 to-pink-500/10", iconBg: "from-purple-500 to-pink-500", badge: "Nuevo" },
              { icon: Users, title: "Reserva online", description: "Tus pacientes y clientes reservan desde tu perfil público. Sin llamadas.", gradient: "from-emerald-500/10 to-teal-500/10", iconBg: "from-emerald-500 to-teal-500" },
              { icon: Bell, title: "Recordatorios automáticos", description: "Email + WhatsApp al confirmar, 24hs antes y 5 min antes del turno virtual.", gradient: "from-amber-500/10 to-orange-500/10", iconBg: "from-amber-500 to-orange-500" },
              { icon: Sparkles, title: "MIA — Asistente IA", description: "Hablale con voz o texto: 'agendame a Juan mañana 15hs'. Ella se encarga.", gradient: "from-fuchsia-500/10 to-violet-500/10", iconBg: "from-fuchsia-500 to-violet-500" },
              { icon: MapPin, title: "Directorio geolocalizado", description: "Aparecé en búsquedas de Google. Páginas SEO por ciudad y especialidad.", gradient: "from-rose-500/10 to-red-500/10", iconBg: "from-rose-500 to-red-500" },
              { icon: Shield, title: "Historia clínica AES-256", description: "Encriptada en reposo. Cumple con Ley 26.529 de datos médicos.", gradient: "from-slate-500/10 to-gray-500/10", iconBg: "from-slate-600 to-gray-700" },
              { icon: CreditCard, title: "Facturación integrada", description: "Liquidación a obras sociales y facturación AFIP vía Facturante.", gradient: "from-indigo-500/10 to-blue-500/10", iconBg: "from-indigo-500 to-blue-500" },
              { icon: Smartphone, title: "PWA instalable", description: "Instalá BookMe en tu celular. Push notifications y dark mode incluidos.", gradient: "from-lime-500/10 to-green-500/10", iconBg: "from-lime-500 to-green-500" },
            ].map((feature, i) => (
              <Reveal key={feature.title} delay={(i % 3) * 100}>
                <div className={`group relative p-6 rounded-xl border border-border bg-gradient-to-br ${feature.gradient} hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full`}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.iconBg} flex items-center justify-center shadow-lg`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    {feature.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-0.5 text-[10px] font-bold">
                        <Zap className="w-2.5 h-2.5" />
                        {feature.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Stats / Social proof */}
      <section className="py-16 bg-gradient-to-br from-bookme-navy to-bookme-navy/90 dark:from-bookme-navy/60 dark:to-bookme-navy/40 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { n: "+500", label: "Profesionales activos" },
              { n: "30k+", label: "Turnos gestionados" },
              { n: "99.9%", label: "Uptime garantizado" },
              { n: "4.9★", label: "Rating promedio" },
            ].map((stat, i) => (
              <Reveal key={stat.label} delay={i * 100}>
                <div>
                  <div className="text-4xl sm:text-5xl font-heading font-bold bg-gradient-to-br from-bookme-mint to-white bg-clip-text text-transparent">
                    {stat.n}
                  </div>
                  <div className="text-sm text-blue-200 mt-1">{stat.label}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Three lines */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Reveal>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold mb-3">
                Para cualquier profesional o negocio
              </h2>
              <p className="text-muted-foreground">BookMe se adapta a tu rubro.</p>
            </div>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Reveal delay={0}>
              <div className="group p-8 rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/70 to-cyan-50/70 dark:from-blue-950/40 dark:to-cyan-950/30 hover:shadow-xl hover:-translate-y-1 transition-all h-full">
                <div className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold mb-4">
                  Línea Salud
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Healthcare</h3>
                <ul className="space-y-3">
                  {["Historia clínica digital encriptada", "Liquidación a obras sociales", "Receta electrónica (próx.)", "Gestión de pacientes con DNI"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={150}>
              <div className="group p-8 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/40 dark:to-teal-950/30 hover:shadow-xl hover:-translate-y-1 transition-all h-full">
                <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-xs font-semibold mb-4">
                  Línea Negocios
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Business</h3>
                <ul className="space-y-3">
                  {["Notas de sesión por turno", "Catálogo de servicios con precios", "Link directo para redes sociales", "Métricas y dashboard financiero"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={300}>
              <div className="group p-8 rounded-2xl border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50/70 to-amber-50/70 dark:from-orange-950/40 dark:to-amber-950/30 hover:shadow-xl hover:-translate-y-1 transition-all h-full">
                <div className="inline-block px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs font-semibold mb-4">
                  Comercios
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-4">Espacios & Canchas</h3>
                <ul className="space-y-3">
                  {["Gestión de múltiples espacios", "Reserva online con seña integrada", "Canchas, restaurantes, bares", "Página pública shareable"].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="w-4 h-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 mt-6 text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                >
                  <Dribbble className="h-4 w-4" />
                  Registrar mi complejo
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <PricingSection />

      {/* Testimonial destacado */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-4">
          <Reveal>
            <div className="relative rounded-3xl bg-gradient-to-br from-bookme-navy to-bookme-navy/80 dark:from-slate-800 dark:to-slate-900 p-10 sm:p-16 text-white overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-bookme-mint/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="flex gap-0.5 mb-6">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="text-xl sm:text-2xl font-medium leading-relaxed mb-6">
                  "Pasé de Google Calendar + WhatsApp a BookMe y ahora mis pacientes se reservan solos. La videoconsulta integrada me ahorró horas de mandar links a mano."
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bookme-mint to-white flex items-center justify-center text-bookme-navy font-bold">
                    DL
                  </div>
                  <div>
                    <p className="font-bold">Dra. Daniela López</p>
                    <p className="text-sm text-blue-200">Dermatóloga · CABA</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bookme-navy via-purple-900 to-bookme-navy" />
        <div className="absolute top-10 left-10 w-72 h-72 bg-bookme-mint/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Reveal>
            <h2 className="text-4xl sm:text-5xl font-heading font-bold text-white mb-4">
              Listo para probarlo?
            </h2>
            <p className="text-blue-200 mb-10 text-lg">
              30 días gratis. Sin tarjeta. Cancelás cuando quieras.
            </p>
            <Link
              href="/register"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-bookme-mint to-white text-bookme-navy px-10 py-4 text-lg font-bold shadow-2xl hover:scale-105 transition-transform"
            >
              Crear cuenta gratis
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center">
              <span className="text-white dark:text-bookme-navy font-bold text-xs">B</span>
            </div>
            <span className="text-sm text-muted-foreground">
              &copy; 2026 BookMe. Todos los derechos reservados.
            </span>
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="/directorio" className="hover:text-foreground transition-colors">
              Directorio
            </Link>
            <Link href="/soporte" className="hover:text-foreground transition-colors">
              Centro de Ayuda
            </Link>
            <a href="mailto:soporte@bookme.ar" className="hover:text-foreground transition-colors">
              soporte@bookme.ar
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
