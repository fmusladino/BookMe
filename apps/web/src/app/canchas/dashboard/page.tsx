"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Phone,
} from "lucide-react";
import { useSession } from "@/hooks/use-session";

/* ─── Tipos ─── */
interface PeriodStats {
  total: number;
  confirmed: number;
  pending: number;
  completed: number;
  cancelled: number;
}
interface FinancePeriod {
  revenue: number;
  cobrado: number;
  señasCobradas: number;
  señasPendientes: number;
  ticketPromedio: number;
}
interface CourtStat {
  id: string;
  name: string;
  sport: string;
  pricePerHour: number;
  totalBookings: number;
  weekBookings: number;
  monthBookings: number;
  confirmed: number;
  revenue: number;
  weekRevenue: number;
  monthRevenue: number;
  señasCobradas: number;
}
interface DayData {
  date: string;
  bookings: number;
  revenue: number;
}
interface PendingSeña {
  id: string;
  date: string;
  startTime: string;
  court: string;
  customer: string;
  phone: string | null;
  señaAmount: number;
  totalAmount: number;
}
interface OccupancyPeriod {
  totalSlots: number;
  occupied: number;
  free: number;
  pct: number;
}
interface DashboardData {
  businessName: string;
  bookingStats: { today: PeriodStats; week: PeriodStats; month: PeriodStats; allTime: PeriodStats };
  financeStats: { today: FinancePeriod; week: FinancePeriod; month: FinancePeriod; allTime: FinancePeriod };
  courtStats: CourtStat[];
  last7Days: DayData[];
  pendingSeñas: PendingSeña[];
  totalCourts: number;
  occupancy: { today: OccupancyPeriod; week: OccupancyPeriod; month: OccupancyPeriod };
}

type Period = "today" | "week" | "month" | "allTime";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoy",
  week: "Esta Semana",
  month: "Este Mes",
  allTime: "Total",
};

function fmt(n: number): string {
  return n.toLocaleString("es-AR");
}
function fmtMoney(n: number): string {
  return "$" + n.toLocaleString("es-AR");
}
function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}`;
}
function dayName(d: string): string {
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("es-AR", { weekday: "short" });
}

export default function CanchasDashboardPage() {
  const { user, loading: sessionLoading } = useSession();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [showSeñas, setShowSeñas] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/courts/dashboard/stats");
      if (!res.ok) throw new Error("Error al cargar datos");
      const json = await res.json();
      setData(json);
    } catch {
      setError("No se pudieron cargar las estadísticas. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) fetchData();
  }, [sessionLoading, user, fetchData]);

  if (sessionLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2A47]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <p className="text-muted-foreground">{error ?? "Sin datos"}</p>
        <button onClick={fetchData} className="text-sm text-[#0EA5E9] hover:underline">
          Reintentar
        </button>
      </div>
    );
  }

  const bs = data.bookingStats[period];
  const fs = data.financeStats[period];

  // Barra del gráfico — max para escalar
  const maxBookings = Math.max(...data.last7Days.map((d) => d.bookings), 1);
  const maxRevenue = Math.max(...data.last7Days.map((d) => d.revenue), 1);

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0F2A47] to-[#1a3a5c] rounded-xl p-6 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-7 w-7" />
              Dashboard
            </h1>
            <p className="text-white/70 mt-1">{data.businessName}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Selector de periodo */}
            <div className="flex bg-white/10 rounded-lg p-1">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    period === p
                      ? "bg-white text-[#0F2A47] font-semibold"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <button
              onClick={fetchData}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Actualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards — Turnos */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={<Calendar className="h-5 w-5 text-[#0EA5E9]" />}
          label="Reservas"
          value={fmt(bs.total)}
          color="bg-sky-50 dark:bg-sky-950/30"
        />
        <KpiCard
          icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
          label="Confirmadas"
          value={fmt(bs.confirmed)}
          color="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5 text-[#0F2A47] dark:text-blue-300" />}
          label="Finalizadas"
          value={fmt(bs.completed)}
          color="bg-blue-50 dark:bg-blue-950/30"
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-amber-500" />}
          label="Pendientes"
          value={fmt(bs.pending)}
          color="bg-amber-50 dark:bg-amber-950/30"
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-rose-500" />}
          label="Canceladas"
          value={fmt(bs.cancelled)}
          color="bg-rose-50 dark:bg-rose-950/30"
        />
      </div>

      {/* KPI Cards — Finanzas */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={<DollarSign className="h-5 w-5 text-[#34D399]" />}
          label="Facturación"
          value={fmtMoney(fs.revenue)}
          color="bg-emerald-50 dark:bg-emerald-950/30"
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5 text-[#0F2A47] dark:text-blue-300" />}
          label="Cobrado"
          value={fmtMoney(fs.cobrado)}
          color="bg-blue-50 dark:bg-blue-950/30"
          highlight
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-[#0EA5E9]" />}
          label="Señas Cobradas"
          value={fmtMoney(fs.señasCobradas)}
          color="bg-sky-50 dark:bg-sky-950/30"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-amber-500" />}
          label="Señas Pendientes"
          value={fmtMoney(fs.señasPendientes)}
          color="bg-amber-50 dark:bg-amber-950/30"
        />
        <KpiCard
          icon={<Users className="h-5 w-5 text-violet-500" />}
          label="Ticket Promedio"
          value={fmtMoney(fs.ticketPromedio)}
          color="bg-violet-50 dark:bg-violet-950/30"
        />
      </div>

      {/* Ocupación */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
          Ocupación de Canchas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {([
            { label: "Hoy", data: data.occupancy.today },
            { label: "Esta Semana", data: data.occupancy.week },
            { label: "Este Mes", data: data.occupancy.month },
          ] as const).map(({ label, data: occ }) => (
            <div key={label} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">{label}</span>
                <span className={`text-2xl font-bold ${
                  occ.pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                  occ.pct >= 40 ? "text-amber-600 dark:text-amber-400" :
                  "text-muted-foreground"
                }`}>
                  {occ.pct}%
                </span>
              </div>
              {/* Barra de progreso */}
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${occ.pct}%`,
                    background:
                      occ.pct >= 70
                        ? "linear-gradient(90deg, #34d399, #10b981)"
                        : occ.pct >= 40
                          ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                          : "linear-gradient(90deg, #0ea5e9, #38bdf8)",
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{occ.occupied} ocupados</span>
                <span>{occ.free} libres</span>
                <span>{occ.totalSlots} totales</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico últimos 7 días */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reservas */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
            Reservas — Últimos 7 días
          </h3>
          <div className="flex items-end gap-2 h-40">
            {data.last7Days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-foreground">{d.bookings}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#0F2A47] to-[#0EA5E9] transition-all"
                  style={{ height: `${Math.max((d.bookings / maxBookings) * 100, 4)}%` }}
                />
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {dayName(d.date)}
                  <br />
                  {fmtDate(d.date)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Facturación */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
            Facturación — Últimos 7 días
          </h3>
          <div className="flex items-end gap-2 h-40">
            {data.last7Days.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold text-foreground">
                  {d.revenue > 0 ? fmtMoney(d.revenue) : "—"}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-[#34D399] to-[#6EE7B7] transition-all"
                  style={{ height: `${Math.max((d.revenue / maxRevenue) * 100, 4)}%` }}
                />
                <span className="text-[10px] text-muted-foreground leading-tight">
                  {dayName(d.date)}
                  <br />
                  {fmtDate(d.date)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rendimiento por cancha */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-muted-foreground mb-4 uppercase tracking-wide">
          Rendimiento por Cancha
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 pr-4 font-medium">Cancha</th>
                <th className="pb-3 pr-4 font-medium">Deporte</th>
                <th className="pb-3 pr-4 font-medium text-right">Precio/turno</th>
                <th className="pb-3 pr-4 font-medium text-right">Semana</th>
                <th className="pb-3 pr-4 font-medium text-right">Mes</th>
                <th className="pb-3 pr-4 font-medium text-right">Total</th>
                <th className="pb-3 pr-4 font-medium text-right">Facturación</th>
                <th className="pb-3 font-medium text-right">Señas</th>
              </tr>
            </thead>
            <tbody>
              {data.courtStats.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                  <td className="py-3 pr-4 font-medium">{c.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground capitalize">{c.sport}</td>
                  <td className="py-3 pr-4 text-right">{fmtMoney(c.pricePerHour)}</td>
                  <td className="py-3 pr-4 text-right">{c.weekBookings}</td>
                  <td className="py-3 pr-4 text-right">{c.monthBookings}</td>
                  <td className="py-3 pr-4 text-right font-semibold">{c.totalBookings}</td>
                  <td className="py-3 pr-4 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                    {fmtMoney(c.revenue)}
                  </td>
                  <td className="py-3 text-right">{fmtMoney(c.señasCobradas)}</td>
                </tr>
              ))}
              {data.courtStats.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No hay canchas registradas
                  </td>
                </tr>
              )}
            </tbody>
            {data.courtStats.length > 1 && (
              <tfoot>
                <tr className="font-bold border-t-2 border-border">
                  <td className="pt-3 pr-4">TOTAL</td>
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4" />
                  <td className="pt-3 pr-4 text-right">
                    {data.courtStats.reduce((s, c) => s + c.weekBookings, 0)}
                  </td>
                  <td className="pt-3 pr-4 text-right">
                    {data.courtStats.reduce((s, c) => s + c.monthBookings, 0)}
                  </td>
                  <td className="pt-3 pr-4 text-right">
                    {data.courtStats.reduce((s, c) => s + c.totalBookings, 0)}
                  </td>
                  <td className="pt-3 pr-4 text-right text-emerald-600 dark:text-emerald-400">
                    {fmtMoney(data.courtStats.reduce((s, c) => s + c.revenue, 0))}
                  </td>
                  <td className="pt-3 text-right">
                    {fmtMoney(data.courtStats.reduce((s, c) => s + c.señasCobradas, 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Señas pendientes */}
      {data.pendingSeñas.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <button
            onClick={() => setShowSeñas(!showSeñas)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Señas Pendientes ({data.pendingSeñas.length})
            </h3>
            {showSeñas ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {showSeñas && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Fecha</th>
                    <th className="pb-2 pr-4 font-medium">Hora</th>
                    <th className="pb-2 pr-4 font-medium">Cancha</th>
                    <th className="pb-2 pr-4 font-medium">Cliente</th>
                    <th className="pb-2 pr-4 font-medium text-right">Seña</th>
                    <th className="pb-2 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingSeñas.map((s) => (
                    <tr key={s.id} className="border-b border-border/50">
                      <td className="py-2 pr-4">{fmtDate(s.date)}</td>
                      <td className="py-2 pr-4">{s.startTime}</td>
                      <td className="py-2 pr-4">{s.court}</td>
                      <td className="py-2 pr-4 flex items-center gap-2">
                        {s.customer}
                        {s.phone && (
                          <a
                            href={`https://wa.me/${s.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-500 hover:text-emerald-600"
                            title="WhatsApp"
                          >
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-medium text-amber-600">
                        {fmtMoney(s.señaAmount)}
                      </td>
                      <td className="py-2 text-right">{fmtMoney(s.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Resumen rápido al pie */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0F2A47] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{data.totalCourts}</p>
          <p className="text-xs text-white/60 mt-1">Canchas Activas</p>
        </div>
        <div className="bg-[#0F2A47] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{fmt(data.bookingStats.allTime.total)}</p>
          <p className="text-xs text-white/60 mt-1">Reservas Históricas</p>
        </div>
        <div className="bg-[#0F2A47] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">{fmtMoney(data.financeStats.allTime.revenue)}</p>
          <p className="text-xs text-white/60 mt-1">Facturación Total</p>
        </div>
        <div className="bg-[#0F2A47] text-white rounded-xl p-4 text-center">
          <p className="text-2xl font-bold">
            {data.bookingStats.allTime.total > 0
              ? Math.round((data.bookingStats.allTime.confirmed / data.bookingStats.allTime.total) * 100) + "%"
              : "—"}
          </p>
          <p className="text-xs text-white/60 mt-1">Tasa de Confirmación</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Componente KPI ─── */
function KpiCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 ${color} transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
      </div>
      <p className={`text-xl font-bold ${highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
