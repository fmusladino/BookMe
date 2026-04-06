"use client";

import { useEffect, useState } from "react";
import {
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  Stethoscope,
  Activity,
} from "lucide-react";
import { Card } from "@/components/ui/card";

interface Stats {
  total_professionals: number;
  total_patients: number;
  appointments_this_month: number;
  active_subscriptions: number;
  healthcare_professionals: number;
  business_professionals: number;
  free_plan: number;
  base_plan: number;
  standard_plan: number;
  premium_plan: number;
  recent_signups: Array<{
    id: string;
    full_name: string;
    email: string;
    specialty: string;
    line: string;
    created_at: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (!response.ok) throw new Error("Failed to fetch stats");
        const data = await response.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading stats");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  const statCards = [
    {
      label: "Profesionales totales",
      value: stats?.total_professionals || 0,
      icon: Stethoscope,
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Pacientes totales",
      value: stats?.total_patients || 0,
      icon: Users,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50 dark:bg-emerald-950",
    },
    {
      label: "Turnos este mes",
      value: stats?.appointments_this_month || 0,
      icon: Activity,
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      label: "Suscripciones activas",
      value: stats?.active_subscriptions || 0,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-950",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Panel de Administración
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bienvenido al panel de control de BookMe
        </p>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-foreground">
                    {card.value}
                  </p>
                </div>
                <div className={`${card.bgColor} rounded-lg p-3`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Grid de gráficos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profesionales por línea */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Profesionales por línea
          </h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Healthcare</span>
                <span className="text-muted-foreground">
                  {stats?.healthcare_professionals || 0}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{
                    width: `${
                      ((stats?.healthcare_professionals || 0) /
                        (stats?.total_professionals || 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Business</span>
                <span className="text-muted-foreground">
                  {stats?.business_professionals || 0}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500"
                  style={{
                    width: `${
                      ((stats?.business_professionals || 0) /
                        (stats?.total_professionals || 1)) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Distribución de planes */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Distribución de planes
          </h2>
          <div className="space-y-3">
            {[
              { name: "Free", value: stats?.free_plan || 0, color: "bg-gray-500" },
              { name: "Base", value: stats?.base_plan || 0, color: "bg-blue-500" },
              {
                name: "Standard",
                value: stats?.standard_plan || 0,
                color: "bg-purple-500",
              },
              {
                name: "Premium",
                value: stats?.premium_plan || 0,
                color: "bg-amber-500",
              },
            ].map((plan) => (
              <div key={plan.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-muted-foreground">{plan.value}</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${plan.color}`}
                    style={{
                      width: `${
                        ((plan.value || 0) / (stats?.total_professionals || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabla de últimas inscripciones */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Últimas inscripciones
        </h2>
        {stats?.recent_signups && stats.recent_signups.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Especialidad</th>
                  <th className="px-4 py-3 text-left font-medium">Línea</th>
                  <th className="px-4 py-3 text-left font-medium">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stats.recent_signups.map((signup, idx) => (
                  <tr
                    key={signup.id}
                    className={
                      idx % 2 === 0
                        ? "bg-muted/30"
                        : "bg-background"
                    }
                  >
                    <td className="px-4 py-3 font-medium">{signup.full_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {signup.email}
                    </td>
                    <td className="px-4 py-3">{signup.specialty}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          signup.line === "healthcare"
                            ? "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }
                      >
                        {signup.line === "healthcare" ? "Healthcare" : "Business"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(signup.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              Sin inscripciones recientes
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
