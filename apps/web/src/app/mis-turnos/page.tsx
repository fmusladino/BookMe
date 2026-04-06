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
  FileText,
  Download,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  service: { name: string; duration_minutes: number } | null;
  professional: {
    specialty: string;
    city: string;
    public_slug: string;
    profile: { full_name: string; avatar_url: string | null };
  };
}

interface PatientRecord {
  id: string;
  professional_id: string;
  professionalName: string;
  professionalSpecialty: string;
  recordCount: number;
}

export default function MisTurnosPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientRecordsInfo, setPatientRecordsInfo] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [exportingHC, setExportingHC] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"turnos" | "historia">("turnos");
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

      // Obtener turnos del paciente
      // Buscar primero los registros de paciente para este usuario
      const { data: patientRecords } = await supabase
        .from("patients")
        .select("id, professional_id")
        .eq("profile_id", user.id);

      if (!patientRecords || patientRecords.length === 0) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const patientIds = patientRecords.map((p) => p.id);

      const { data: appts } = await supabase
        .from("appointments")
        .select(
          `id, starts_at, ends_at, status, notes,
           service:services(name, duration_minutes),
           professional:professionals(specialty, city, public_slug, profile:profiles(full_name, avatar_url))`
        )
        .in("patient_id", patientIds)
        .order("starts_at", { ascending: false })
        .limit(50);

      setAppointments((appts as unknown as Appointment[]) ?? []);

      // Obtener info de historia clínica via API (admin client, sin RLS)
      try {
        const hcRes = await fetch("/api/clinical-records/patient-info");
        if (hcRes.ok) {
          const hcData = (await hcRes.json()) as {
            professionals: Array<{
              patient_id: string;
              professional_id: string;
              professional_name: string;
              professional_specialty: string;
              record_count: number;
            }>;
          };
          setPatientRecordsInfo(
            hcData.professionals.map((p) => ({
              id: p.patient_id,
              professional_id: p.professional_id,
              professionalName: p.professional_name,
              professionalSpecialty: p.professional_specialty,
              recordCount: p.record_count,
            }))
          );
        }
      } catch (hcErr) {
        console.error("Error obteniendo info HC:", hcErr);
      }

      setLoading(false);
    };

    fetchData();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  // Descargar HC completa como PDF
  const handleDownloadHC = async (patientId: string) => {
    setExportingHC(patientId);
    try {
      const params = new URLSearchParams({
        patient_id: patientId,
        role: "patient",
      });
      const res = await fetch(`/api/clinical-records/export?${params.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error((data as { error?: string }).error || "Error al descargar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "historia_clinica.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error descargando HC:", error);
      alert(error instanceof Error ? error.message : "Error al descargar la historia clínica");
    } finally {
      setExportingHC(null);
    }
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
        <p className="text-muted-foreground mb-4">
          Consultá tus turnos y descargá tu historia clínica.
        </p>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-8">
          <button
            onClick={() => setActiveTab("turnos")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "turnos"
                ? "border-bookme-navy dark:border-bookme-mint text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Mis turnos
            </span>
          </button>
          <button
            onClick={() => setActiveTab("historia")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "historia"
                ? "border-bookme-navy dark:border-bookme-mint text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Mi historia clínica
            </span>
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-bookme-navy dark:text-bookme-mint" />
          </div>
        ) : activeTab === "historia" ? (
          /* === TAB: Historia Clínica === */
          <div className="space-y-6">
            {patientRecordsInfo.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  No tenés historia clínica disponible
                </h2>
                <p className="text-muted-foreground">
                  Tu profesional todavía no cargó registros clínicos.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Tu historia clínica es confidencial
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                        Según la Ley 26.529, tenés derecho a recibir una copia de tu historia
                        clínica. Los registros se almacenan encriptados y solo se desencriptan
                        al momento de la descarga.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {patientRecordsInfo.map((pr) => (
                    <div
                      key={`${pr.id}-${pr.professional_id}`}
                      className="p-5 rounded-lg border border-border bg-card"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {pr.professionalName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {pr.professionalSpecialty}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {pr.recordCount} {pr.recordCount === 1 ? "registro" : "registros"} clínicos
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDownloadHC(pr.id)}
                          disabled={exportingHC === pr.id}
                          className="flex items-center gap-2 rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {exportingHC === pr.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          Descargar PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
                          {apt.professional?.city && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {apt.professional.city}
                            </span>
                          )}
                        </div>
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
