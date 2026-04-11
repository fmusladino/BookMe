"use client";

import { useEffect, useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Calendar,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { useFeatures } from "@/hooks/use-features";
import { toast } from "sonner";

interface MetricsData {
  period: string;
  appointments: {
    total: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    no_show: number;
    pending: number;
  };
  comparison: {
    total_prev: number;
    change_pct: number;
  };
  daily: Array<{ date: string; count: number }>;
  byService: Array<{ service_name: string; count: number; revenue: number }>;
  topPatients: Array<{ name: string; appointments: number }>;
  occupancy: {
    available_slots: number;
    booked_slots: number;
    rate: number;
  };
}

interface BillingData {
  period: string;
  total_pending: number;
  total_submitted: number;
  total_paid: number;
  total_amount: number;
  items_by_insurance: Record<
    string,
    { count: number; total: number; items: unknown[] }
  >;
}

interface PrestacionStatsData {
  currentMonth: { total: number; count: number; label: string };
  totalHistorico: number;
  totalCount: number;
  monthlyEvolution: Array<{
    month: string;
    year: number;
    monthNum: number;
    total: number;
    count: number;
  }>;
  byInsurance: Array<{ name: string; total: number; count: number }>;
}

const formatCurrency = (value: number): string => {
  return `$${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString("es-AR");
};

export default function MetricasPage() {
  const { user, loading: userLoading } = useSession();
  const { hasFeature } = useFeatures();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [billing, setBilling] = useState<BillingData | null>(null);
  const [prestacionStats, setPrestacionStats] = useState<PrestacionStatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("");

  // Generar opciones de períodos (últimos 12 meses)
  const periodOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const label = format(date, "MMMM yyyy", { locale: es });
      options.push({
        value: `${year}-${month}`,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      });
    }
    return options;
  }, []);

  // Inicializar período actual
  useEffect(() => {
    if (periodOptions.length > 0 && !period) {
      setPeriod(periodOptions[0].value);
    }
  }, [periodOptions, period]);

  // Fetch métricas
  useEffect(() => {
    if (!period || !user) return;

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch metrics y billing en paralelo
        const isHealthcare = user.professional?.line && user.professional?.plan
          ? hasFeature("dashboard_financial", user.professional.plan, user.professional.line)
          : false;

        const promises: Promise<Response>[] = [
          fetch(`/api/metrics?period=${period}`),
        ];
        if (isHealthcare) {
          promises.push(fetch(`/api/billing/summary?period=${period}`));
          promises.push(fetch(`/api/prestaciones/stats`));
        }

        const results = await Promise.allSettled(promises);

        // Procesar metrics
        const metricsResult = results[0];
        if (metricsResult.status === "fulfilled" && metricsResult.value.ok) {
          const metricsData = await metricsResult.value.json();
          setMetrics(metricsData);
        } else {
          const status = metricsResult.status === "fulfilled" ? metricsResult.value.status : "network error";
          console.error("Metrics API failed with status:", status);
          toast.error("No se pudieron cargar las métricas. Intentá de nuevo.");
        }

        // Procesar billing (si aplica)
        if (isHealthcare && results[1]?.status === "fulfilled" && results[1].value.ok) {
          const billingData = await results[1].value.json();
          setBilling(billingData);
        }

        // Procesar prestaciones stats (si aplica)
        if (isHealthcare && results[2]?.status === "fulfilled" && results[2].value.ok) {
          const prestData = await results[2].value.json();
          setPrestacionStats(prestData);
        }
      } catch (error) {
        console.error("Error fetching metrics:", error);
        toast.error("Error al cargar las métricas");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [period, user]);

  if (userLoading || !period) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // SECTION 1: MÉTRICAS BÁSICAS (todos los profesionales)
  // ──────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground">Análisis de desempeño y actividad</p>
        </div>

        {/* Período selector */}
        <Select value={period} onChange={(e) => setPeriod(e.currentTarget.value)}>
          {periodOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>

      {/* MÉTRICAS BÁSICAS */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={`skeleton-${i}`} className="h-32" />
          ))}
        </div>
      ) : metrics ? (
        <>
          {/* Stat Cards (4 columnas) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Turnos Totales */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Turnos del mes</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.appointments.total}</div>
                <p className="flex items-center gap-1 text-xs">
                  {metrics.comparison.change_pct > 0 && (
                    <TrendingUp className="h-3 w-3 text-green-500" />
                  )}
                  {metrics.comparison.change_pct < 0 && (
                    <TrendingDown className="h-3 w-3 text-red-500" />
                  )}
                  {metrics.comparison.change_pct > 0 ? (
                    <span className="text-green-500">
                      +{metrics.comparison.change_pct.toFixed(0)}%
                    </span>
                  ) : metrics.comparison.change_pct < 0 ? (
                    <span className="text-red-500">{metrics.comparison.change_pct.toFixed(0)}%</span>
                  ) : (
                    <span className="text-muted-foreground">sin cambio</span>
                  )}
                  <span className="text-muted-foreground">vs. mes anterior</span>
                </p>
              </CardContent>
            </Card>

            {/* Completados */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completados</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.appointments.completed}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.appointments.total > 0
                    ? Math.round((metrics.appointments.completed / metrics.appointments.total) * 100)
                    : 0}
                  % del total
                </p>
              </CardContent>
            </Card>

            {/* Cancelados */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.appointments.cancelled}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.appointments.total > 0
                    ? Math.round((metrics.appointments.cancelled / metrics.appointments.total) * 100)
                    : 0}
                  % del total
                </p>
              </CardContent>
            </Card>

            {/* Ausentes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ausentes</CardTitle>
                <AlertCircle className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.appointments.no_show}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.appointments.total > 0
                    ? Math.round((metrics.appointments.no_show / metrics.appointments.total) * 100)
                    : 0}
                  % del total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Area (2 columnas) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Daily Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Turnos por día</CardTitle>
                <CardDescription>Distribución diaria del mes</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.daily.length > 0 ? (
                  <div className="space-y-2">
                    {/* Chart Container */}
                    <div className="flex items-end gap-1 h-48 px-2 pb-4 border-b border-muted">
                      {metrics.daily.map((day) => {
                        const maxCount = Math.max(...metrics.daily.map((d) => d.count));
                        const heightPercent = (day.count / maxCount) * 100;
                        return (
                          <div
                            key={day.date}
                            className="flex-1 flex flex-col items-center gap-1 group"
                            title={`${format(parseISO(day.date), "d MMM", { locale: es })}: ${day.count} turnos`}
                          >
                            <div className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                              {day.count}
                            </div>
                            <div
                              className="w-full bg-primary/80 hover:bg-primary rounded transition-all duration-200"
                              style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: "4px" }}
                            />
                            <div className="text-xs text-muted-foreground truncate max-w-full">
                              {format(parseISO(day.date), "d", { locale: es })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Sin datos para este período
                  </p>
                )}
              </CardContent>
            </Card>

            {/* By Service Horizontal Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Por servicio</CardTitle>
                <CardDescription>Distribución de turnos e ingresos</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.byService.length > 0 ? (
                  <div className="space-y-4">
                    {metrics.byService.slice(0, 5).map((service) => {
                      const maxCount = metrics.byService[0].count;
                      const widthPercent = (service.count / maxCount) * 100;
                      return (
                        <div key={service.service_name} className="space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium truncate flex-1">
                              {service.service_name}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {service.count}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-sm h-6 overflow-hidden">
                            <div
                              className="h-full bg-primary/80 rounded-sm flex items-center justify-end pr-2 transition-all duration-200"
                              style={{ width: `${widthPercent}%` }}
                            >
                              {service.revenue > 0 && (
                                <span className="text-xs font-medium text-primary-foreground whitespace-nowrap">
                                  {formatCurrency(service.revenue)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Sin datos para este período
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom Section: Top Patients + Occupancy */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Top 5 Pacientes */}
            <Card>
              <CardHeader>
                <CardTitle>Pacientes principales</CardTitle>
                <CardDescription>Top 5 por cantidad de turnos</CardDescription>
              </CardHeader>
              <CardContent>
                {metrics.topPatients.length > 0 ? (
                  <div className="space-y-2">
                    <div className="divide-y">
                      {metrics.topPatients.map((patient, idx) => (
                        <div key={`${patient.name}-${idx}`} className="flex items-center justify-between py-2">
                          <p className="text-sm font-medium truncate flex-1">{patient.name}</p>
                          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded">
                            {patient.appointments}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground py-8">
                    Sin datos para este período
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Occupancy Rate */}
            <Card>
              <CardHeader>
                <CardTitle>Tasa de ocupación</CardTitle>
                <CardDescription>Turnos booked vs. disponibles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary">
                      {metrics.occupancy.rate.toFixed(1)}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {metrics.occupancy.booked_slots} de {metrics.occupancy.available_slots} turnos
                    </p>
                  </div>
                  <Progress value={metrics.occupancy.rate} max={100} />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Booked</p>
                      <p className="font-semibold text-foreground">
                        {formatNumber(metrics.occupancy.booked_slots)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Disponibles</p>
                      <p className="font-semibold text-foreground">
                        {formatNumber(metrics.occupancy.available_slots)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SECTION 2: Dashboard Financiero (Healthcare Standard+ only) */}
          {user?.professional?.line && user?.professional?.plan && hasFeature("dashboard_financial", user.professional.plan, user.professional.line) && (
            <>
              <hr className="my-8" />

              {billing ? (
                <>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Dashboard Financiero</h2>
                    <p className="text-sm text-muted-foreground">Estado de facturación a obras sociales</p>
                  </div>

                  {/* Financial Cards (4 columnas) */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Ingresos Particulares */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingresos particulares</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {formatCurrency(billing.total_amount - billing.total_pending - billing.total_submitted - billing.total_paid)}
                        </div>
                        <p className="text-xs text-muted-foreground">pagos directos</p>
                      </CardContent>
                    </Card>

                    {/* OS Pendiente */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">OS pendiente</CardTitle>
                        <Activity className="h-4 w-4 text-yellow-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-yellow-600">
                          {formatCurrency(billing.total_pending)}
                        </div>
                        <p className="text-xs text-muted-foreground">sin procesar</p>
                      </CardContent>
                    </Card>

                    {/* OS Cobrado */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">OS cobrado</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {formatCurrency(billing.total_paid)}
                        </div>
                        <p className="text-xs text-muted-foreground">recaudado</p>
                      </CardContent>
                    </Card>

                    {/* Total */}
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total del mes</CardTitle>
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrency(billing.total_amount)}
                        </div>
                        <p className="text-xs text-muted-foreground">todas las fuentes</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Revenue by Insurance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Ingresos por obra social</CardTitle>
                      <CardDescription>Total facturado a cada cobertura</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(billing.items_by_insurance).length > 0 ? (
                        <div className="space-y-4">
                          {Object.entries(billing.items_by_insurance)
                            .sort(([, a], [, b]) => b.total - a.total)
                            .map(([insuranceName, data]) => {
                              const maxTotal = Math.max(
                                ...Object.values(billing.items_by_insurance).map((d) => d.total)
                              );
                              const widthPercent = (data.total / maxTotal) * 100;
                              return (
                                <div key={insuranceName} className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate flex-1">{insuranceName}</p>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {data.count} items
                                    </span>
                                  </div>
                                  <div className="w-full bg-muted rounded-sm h-6 overflow-hidden">
                                    <div
                                      className="h-full bg-primary/80 rounded-sm flex items-center justify-end pr-2 transition-all duration-200"
                                      style={{ width: `${widthPercent}%` }}
                                    >
                                      <span className="text-xs font-medium text-primary-foreground whitespace-nowrap">
                                        {formatCurrency(data.total)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <p className="text-center text-sm text-muted-foreground py-8">
                          Sin datos de facturación para este período
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-center text-sm text-muted-foreground">
                      Cargando datos financieros...
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* SECTION 3: Prestaciones (Healthcare only) */}
          {prestacionStats && (
            <>
              <hr className="my-8" />
              <div>
                <h2 className="text-xl font-bold tracking-tight">Prestaciones</h2>
                <p className="text-sm text-muted-foreground">Total facturado por prestaciones médicas</p>
              </div>

              {/* Prestaciones KPI Cards */}
              <div className="grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Mes actual</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(prestacionStats.currentMonth.total)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prestacionStats.currentMonth.count} turnos con prestación
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total histórico</CardTitle>
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {formatCurrency(prestacionStats.totalHistorico)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {prestacionStats.totalCount} turnos totales
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket promedio</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {prestacionStats.totalCount > 0
                        ? formatCurrency(prestacionStats.totalHistorico / prestacionStats.totalCount)
                        : "$0"}
                    </div>
                    <p className="text-xs text-muted-foreground">por prestación</p>
                  </CardContent>
                </Card>
              </div>

              {/* Evolución mensual chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Evolución mensual de prestaciones</CardTitle>
                  <CardDescription>Total en pesos por mes (últimos 12 meses)</CardDescription>
                </CardHeader>
                <CardContent>
                  {prestacionStats.monthlyEvolution.some((m) => m.total > 0) ? (
                    <div className="flex items-end gap-1 h-48 px-2 pb-4 border-b border-muted">
                      {prestacionStats.monthlyEvolution.map((m) => {
                        const maxVal = Math.max(
                          ...prestacionStats.monthlyEvolution.map((x) => x.total),
                          1
                        );
                        const heightPct = (m.total / maxVal) * 100;
                        return (
                          <div
                            key={`${m.year}-${m.monthNum}`}
                            className="flex-1 flex flex-col items-center gap-1 group"
                            title={`${m.month} ${m.year}: ${formatCurrency(m.total)} (${m.count} turnos)`}
                          >
                            <div className="text-[10px] text-muted-foreground font-medium group-hover:text-foreground transition-colors truncate max-w-full">
                              {m.total > 0 ? formatCurrency(m.total) : ""}
                            </div>
                            <div
                              className="w-full bg-green-500/80 hover:bg-green-500 rounded transition-all duration-200"
                              style={{
                                height: `${Math.max(heightPct, m.total > 0 ? 8 : 2)}%`,
                                minHeight: "2px",
                              }}
                            />
                            <div className="text-[10px] text-muted-foreground truncate max-w-full">
                              {m.month}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Sin datos de prestaciones aún
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Desglose por OS */}
              {prestacionStats.byInsurance.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Prestaciones por obra social</CardTitle>
                    <CardDescription>
                      Distribución del mes actual ({prestacionStats.currentMonth.label})
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {prestacionStats.byInsurance.map((ins) => {
                        const maxTotal = prestacionStats.byInsurance[0].total;
                        const widthPct = (ins.total / maxTotal) * 100;
                        return (
                          <div key={ins.name} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate flex-1">{ins.name}</p>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {ins.count} turnos · {formatCurrency(ins.total)}
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-sm h-6 overflow-hidden">
                              <div
                                className="h-full bg-green-500/80 rounded-sm flex items-center justify-end pr-2 transition-all duration-200"
                                style={{ width: `${widthPct}%` }}
                              >
                                <span className="text-xs font-medium text-white whitespace-nowrap">
                                  {formatCurrency(ins.total)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
