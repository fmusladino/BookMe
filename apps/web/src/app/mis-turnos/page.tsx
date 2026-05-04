"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  LogOut,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Video,
} from "lucide-react";
import Link from "next/link";

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  modality?: "presencial" | "virtual";
  meet_url?: string | null;
  service: { name: string; duration_minutes: number } | null;
  professional: {
    specialty: string;
    city: string;
    public_slug: string;
    profile: { full_name: string; avatar_url: string | null };
  };
}

export default function MisTurnosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener nombre del perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (profile) setUserName(profile.full_name);

      // Obtener turnos del paciente via API (admin client, sin problemas de RLS)
      try {
        const apptsRes = await fetch("/api/patient/appointments");
        if (apptsRes.ok) {
          const apptsData = await apptsRes.json();
          setAppointments(apptsData.appointments ?? []);
        } else {
          console.error("[MIS-TURNOS] Error fetching appointments:", apptsRes.status);
          setAppointments([]);
        }
      } catch (apptsErr) {
        console.error("[MIS-TURNOS] Error fetching appointments:", apptsErr);
        setAppointments([]);
      }

      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: {
      label: "Pendiente",
      color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    confirmed: {
      label: "Confirmado",
      color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    completed: {
      label: "Completado",
      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    cancelled: {
      label: "Cancelado",
      color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    no_show: {
      label: "Ausente",
      color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
  };

  const upcomingAppointments = appointments.filter(
    (a) =>
      (a.status === "pending" || a.status === "confirmed") &&
      new Date(a.starts_at) >= new Date()
  );
  const pastAppointments = appointments.filter(
    (a) =>
      a.status === "completed" ||
      a.status === "cancelled" ||
      a.status === "no_show" ||
      new Date(a.starts_at) < new Date()
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center">
              <span className="text-white dark:text-bookme-navy font-bold text-lg">B</span>
            </div>
            <span className="text-xl font-heading font-bold text-bookme-navy dark:text-bookme-mint">
              BookMe
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {userName}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold text-foreground mb-2">
          Mi portal
        </h1>
        <p className="text-muted-foreground mb-8">
          Consultá tus turnos.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-bookme-navy dark:text-bookme-mint" />
          </div>
        ) : appointments.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No tenés turnos todavía
            </h2>
            <p className="text-muted-foreground mb-6">
              Buscá un profesional en el directorio y reservá tu primer turno.
            </p>
            <Link
              href="/directorio"
              className="inline-flex items-center gap-2 rounded-lg bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Buscar profesional
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Próximos turnos */}
            {upcomingAppointments.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Próximos turnos
                </h2>
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => {
                    const status = statusConfig[apt.status] ?? statusConfig.pending;
                    return (
                      <div
                        key={apt.id}
                        className="p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                              <User className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-foreground">
                                {apt.professional?.profile?.full_name ?? "Profesional"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {apt.professional?.specialty}
                              </p>
                              {apt.service && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {apt.service.name} — {apt.service.duration_minutes} min
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(apt.starts_at), "EEE d MMM", { locale: es })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(apt.starts_at), "HH:mm")}
                          </span>
                          {apt.modality === "virtual" ? (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Video className="w-3.5 h-3.5" />
                              Videoconsulta
                            </span>
                          ) : apt.professional?.city ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {apt.professional.city}
                            </span>
                          ) : null}
                        </div>

                        {apt.modality === "virtual" && apt.meet_url && apt.status !== "cancelled" && (
                          <div className="mt-3">
                            <a
                              href={apt.meet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 text-sm font-semibold transition-colors"
                            >
                              <Video className="w-4 h-4" />
                              Entrar a la videoconsulta
                            </a>
                            <p className="mt-1.5 text-xs text-muted-foreground">
                              Entrá unos minutos antes del horario del turno. Se abre en el navegador.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Historial */}
            {pastAppointments.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Historial
                </h2>
                <div className="space-y-3">
                  {pastAppointments.map((apt) => {
                    const status = statusConfig[apt.status] ?? statusConfig.pending;
                    return (
                      <div
                        key={apt.id}
                        className="p-4 rounded-lg border border-border bg-card opacity-75"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">
                              {apt.professional?.profile?.full_name ?? "Profesional"}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {apt.service?.name ?? apt.professional?.specialty}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}
                          >
                            {status.icon}
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(apt.starts_at), "d MMM yyyy", { locale: es })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(apt.starts_at), "HH:mm")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* CTA para reservar más */}
            <div className="text-center pt-4">
              <Link
                href="/directorio"
                className="inline-flex items-center gap-2 text-sm font-medium text-bookme-navy dark:text-bookme-mint hover:underline"
              >
                Buscar otro profesional
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
