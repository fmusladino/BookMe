"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Dribbble, Calendar, Settings, Plus, TrendingUp, Clock, CheckCircle, XCircle, Copy, Check, MessageCircle, Share2, Loader2, BarChart3 } from "lucide-react";
import { useSession } from "@/hooks/use-session";

interface CourtStats {
  totalCourts: number;
  activeCourts: number;
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  cancelledBookings: number;
  todayBookings: number;
}

export default function CanchasDashboard() {
  const { user } = useSession();
  const [stats, setStats] = useState<CourtStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);
  const [loadingWA, setLoadingWA] = useState(false);
  const [waText, setWaText] = useState<string | null>(null);
  const [waTextCopied, setWaTextCopied] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/courts/stats");
        if (res.ok) {
          const data = await res.json() as CourtStats;
          setStats(data);
        }
      } catch {
        // Silencioso
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const publicLink = user?.court_owner?.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/complejos/${user.court_owner.slug}`
    : null;

  const handleCopyLink = () => {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const handleShareWA = async () => {
    setLoadingWA(true);
    try {
      const res = await fetch("/api/courts/availability");
      if (!res.ok) throw new Error();
      const data = await res.json() as { whatsapp_text: string };
      setWaText(data.whatsapp_text);
      // Abrir WhatsApp Web con el texto
      const encoded = encodeURIComponent(data.whatsapp_text);
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    } catch {
      alert("Error al generar la disponibilidad");
    } finally {
      setLoadingWA(false);
    }
  };

  const handleCopyWAText = () => {
    if (waText) {
      navigator.clipboard.writeText(waText);
      setWaTextCopied(true);
      setTimeout(() => setWaTextCopied(false), 2000);
    }
  };

  const handleDownloadDashboard = async () => {
    setLoadingDashboard(true);
    try {
      const res = await fetch("/api/courts/dashboard");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "BookMe_Dashboard.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al descargar el dashboard");
    } finally {
      setLoadingDashboard(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user?.court_owner?.business_name ?? "Panel de Canchas"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {user?.court_owner?.city ? `${user.court_owner.city} · ` : ""}
            Panel de gestión de canchas y reservas
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/canchas/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card text-foreground px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/canchas/mis-canchas"
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nueva cancha
          </Link>
        </div>
      </div>

      {/* Link público */}
      {publicLink && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 px-4 py-3">
          <Dribbble className="h-5 w-5 text-orange-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide mb-0.5">
              Tu página pública de reservas
            </p>
            <p className="text-sm text-muted-foreground truncate">{publicLink}</p>
          </div>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 rounded-md border border-orange-300 dark:border-orange-700 bg-background px-3 py-1.5 text-xs font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
          >
            {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {linkCopied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
      )}

      {/* Compartir disponibilidad por WhatsApp */}
      <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20 px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg bg-green-100 dark:bg-green-900/40 p-2 shrink-0">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                Compartir disponibilidad
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                Generá el resumen de hoy y mañana y envialo a tu grupo de WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleShareWA}
              disabled={loadingWA}
              className="flex items-center gap-1.5 rounded-md bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loadingWA ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              {loadingWA ? "Generando..." : "Enviar por WhatsApp"}
            </button>
          </div>
        </div>

        {/* Texto generado (copiable) */}
        {waText && (
          <div className="rounded-md border border-green-200 dark:border-green-800 bg-background p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mensaje generado
              </p>
              <button
                onClick={handleCopyWAText}
                className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 transition-colors"
              >
                {waTextCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {waTextCopied ? "¡Copiado!" : "Copiar texto"}
              </button>
            </div>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto font-sans leading-relaxed">
              {waText}
            </pre>
          </div>
        )}
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Canchas activas",
            value: loading ? "—" : (stats?.activeCourts ?? 0),
            icon: Dribbble,
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-950/30",
          },
          {
            label: "Reservas hoy",
            value: loading ? "—" : (stats?.todayBookings ?? 0),
            icon: Calendar,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-950/30",
          },
          {
            label: "Pendientes de confirmar",
            value: loading ? "—" : (stats?.pendingBookings ?? 0),
            icon: Clock,
            color: "text-amber-500",
            bg: "bg-amber-50 dark:bg-amber-950/30",
          },
          {
            label: "Confirmadas",
            value: loading ? "—" : (stats?.confirmedBookings ?? 0),
            icon: CheckCircle,
            color: "text-green-500",
            bg: "bg-green-50 dark:bg-green-950/30",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-lg border border-border bg-card p-4 flex items-start gap-3"
          >
            <div className={`rounded-lg ${metric.bg} p-2`}>
              <metric.icon className={`h-5 w-5 ${metric.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/canchas/mis-canchas"
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center group-hover:bg-orange-200 dark:group-hover:bg-orange-900 transition-colors">
            <Dribbble className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Gestionar Canchas</p>
            <p className="text-sm text-muted-foreground">Agregá, editá y configurá tus canchas con horarios y precios.</p>
          </div>
        </Link>

        <Link
          href="/canchas/reservas"
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900 transition-colors">
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Ver Reservas</p>
            <p className="text-sm text-muted-foreground">Confirmá reservas, verificá señas y gestioná el calendario.</p>
          </div>
        </Link>

        <Link
          href="/canchas/configuracion"
          className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 hover:shadow-md transition-shadow group"
        >
          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
            <Settings className="h-5 w-5 text-slate-600 dark:text-slate-400" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Configuración</p>
            <p className="text-sm text-muted-foreground">Datos del complejo, visibilidad y opciones de pago de seña.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
