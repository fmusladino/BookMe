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
} from "lucide-react";
import { PricingSection } from "@/components/landing/pricing-section";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center">
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
              className="inline-flex items-center rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Registrarse
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-bookme-navy/5 to-bookme-mint/5 dark:from-bookme-navy/20 dark:to-bookme-mint/10" />
        <div className="relative max-w-7xl mx-auto px-4 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold text-foreground leading-tight">
            Gestioná tu agenda
            <br />
            <span className="text-bookme-navy dark:text-bookme-mint">de forma inteligente</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            La plataforma de gestión de turnos para profesionales de la salud y negocios de servicios en LATAM. Agenda, recordatorios, directorio público y más.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-8 py-3 text-base font-semibold hover:opacity-90 transition-opacity"
            >
              Empezá gratis
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/directorio"
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-bookme-navy dark:border-bookme-mint text-bookme-navy dark:text-bookme-mint px-8 py-3 text-base font-semibold hover:bg-bookme-navy/5 dark:hover:bg-bookme-mint/10 transition-colors"
            >
              Explorar directorio
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-card">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center text-foreground mb-4">
            Todo lo que necesitás en un solo lugar
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Diseñado para profesionales que venden su tiempo. Desde médicos hasta peluqueros.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Calendar,
                title: "Agenda inteligente",
                description:
                  "Vista semanal, mensual y diaria. Drag & drop para reorganizar turnos. Bloqueos y modo vacaciones.",
              },
              {
                icon: Users,
                title: "Reserva online",
                description:
                  "Tus pacientes y clientes reservan desde tu perfil público. Sin llamadas, sin WhatsApp.",
              },
              {
                icon: MapPin,
                title: "Directorio geolocalizado",
                description:
                  "Aparecé en búsquedas de Google. Páginas SEO por ciudad y especialidad.",
              },
              {
                icon: Clock,
                title: "Recordatorios automáticos",
                description:
                  "Email y WhatsApp 24hs antes del turno. Reducí ausencias sin esfuerzo.",
              },
              {
                icon: Shield,
                title: "Historia clínica segura",
                description:
                  "Encriptada con AES-256. Solo vos podés ver los datos de tus pacientes.",
              },
              {
                icon: Smartphone,
                title: "PWA instalable",
                description:
                  "Instalá BookMe en tu celular como una app. Dark mode incluido.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-lg border border-border bg-background hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-lg bg-bookme-navy/10 dark:bg-bookme-mint/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-bookme-navy dark:text-bookme-mint" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Two lines */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-heading font-bold text-center text-foreground mb-12">
            Para cualquier profesional
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Healthcare */}
            <div className="p-8 rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30">
              <div className="inline-block px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm font-medium mb-4">
                Línea Salud
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Healthcare</h3>
              <ul className="space-y-3">
                {[
                  "Historia clínica digital encriptada",
                  "Liquidación a obras sociales",
                  "Receta electrónica (próximamente)",
                  "Gestión de pacientes con DNI",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Business */}
            <div className="p-8 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30">
              <div className="inline-block px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 text-sm font-medium mb-4">
                Línea Negocios
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Business</h3>
              <ul className="space-y-3">
                {[
                  "Notas de sesión por turno",
                  "Catálogo de servicios con precios",
                  "Link directo para redes sociales",
                  "Métricas y dashboard financiero",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing — dinámico desde DB */}
      <PricingSection />

      {/* CTA */}
      <section className="py-20 bg-bookme-navy dark:bg-bookme-navy/80">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-heading font-bold text-white mb-4">
            Empezá a gestionar tu agenda hoy
          </h2>
          <p className="text-blue-200 mb-8">
            Creá tu cuenta gratis y configurá tu agenda en minutos.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bookme-mint text-bookme-navy px-8 py-3 text-base font-semibold hover:opacity-90 transition-opacity"
          >
            Crear cuenta gratis
            <ArrowRight className="w-4 h-4" />
          </Link>
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
