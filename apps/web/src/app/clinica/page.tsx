"use client";

import { useState, useEffect, useCallback } from "react";
import { Stethoscope, Calendar, Users, TrendingUp, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

interface Stats {
  professionals_count: number;
  today_appointments: number;
  total_patients: number;
  month_appointments: number;
  cancelled_month: number;
}

export default function ClinicaDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/clinic/stats");
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      setStats(data);
    } catch {
      // Si falla, dejamos stats en null y se muestran los placeholder
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const statCards = [
    {
      label: "Profesionales del consultorio",
      value: stats?.professionals_count ?? "—",
      icon: Stethoscope,
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      href: "/clinica/profesionales",
    },
    {
      label: "Turnos de hoy",
      value: stats?.today_appointments ?? "—",
      icon: Calendar,
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-950",
      href: "/clinica/agenda",
    },
    {
      label: "Pacientes totales",
      value: stats?.total_patients ?? "—",
      icon: Users,
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
      href: "/clinica/pacientes",
    },
    {
      label: "Turnos del mes",
      value: stats?.month_appointments ?? "—",
      icon: TrendingUp,
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-950",
      href: "/clinica/agenda",
    },
    {
      label: "Cancelados del mes",
      value: stats?.cancelled_month ?? "—",
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-950",
      href: "/clinica/agenda",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Panel del Consultorio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gestión centralizada de tu consultorio
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Tarjetas de estadísticas */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-2 text-2xl font-bold text-foreground">
                        {card.value}
                      </p>
                    </div>
                    <div className={`${card.bgColor} rounded-lg p-3`}>
                      <Icon className={`h-5 w-5 ${card.color}`} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Accesos rápidos */}
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              Accesos rápidos
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/clinica/profesionales"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <Stethoscope className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-medium">Ver profesionales</span>
              </Link>
              <Link
                href="/clinica/agenda"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <Calendar className="h-5 w-5 text-pink-500" />
                <span className="text-sm font-medium">Agenda del día</span>
              </Link>
              <Link
                href="/clinica/pacientes"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <Users className="h-5 w-5 text-cyan-500" />
                <span className="text-sm font-medium">Pacientes</span>
              </Link>
              <Link
                href="/clinica/configuracion"
                className="flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
              >
                <Stethoscope className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium">Configuración</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
