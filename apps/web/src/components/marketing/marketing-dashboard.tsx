"use client";

import { useEffect, useState } from "react";
import {
  Eye,
  UserPlus,
  Star,
  TrendingDown,
  TrendingUp,
  Users,
  Calendar,
  CreditCard,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  BarChart3,
  Percent,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsData {
  summary: {
    total_professionals: number;
    total_patients: number;
    total_appointments: number;
    registros_este_mes: number;
    registros_mes_anterior: number;
    change_pct: number;
    conversion_rate: number;
  };
  distribution: {
    by_line: { healthcare: number; business: number };
    by_plan: { free: number; base: number; standard: number; premium: number };
    by_status: { active: number; trialing: number; past_due: number; cancelled: number; read_only: number };
  };
  monthly_evolution: Array<{ month: string; count: number }>;
}

interface ProfessionalsData {
  top_professionals: Array<{
    id: string;
    full_name: string;
    specialty: string;
    line: string;
    plan: string;
    appointments_30d: number;
  }>;
  churn_risk: Array<{
    id: string;
    full_name: string;
    specialty: string;
    line: string;
    plan: string;
    status: string;
    last_appointment: string | null;
    reasons: string[];
  }>;
  churn_risk_count: number;
}

interface Coupon {
  id: string;
  code: string;
  discount_pct: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface MarketingDashboardProps {
  title?: string;
  subtitle?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleDateString("es-AR", { month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function lineBadge(line: string) {
  return line === "healthcare" ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      Salud
    </span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
      Negocios
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MarketingDashboard({
  title = "Panel de Marketing",
  subtitle = "Métricas de producto, evolución y riesgo de abandono",
}: MarketingDashboardProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pros, setPros] = useState<ProfessionalsData | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Dialog crear cupón
  const [couponDialogOpen, setCouponDialogOpen] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_pct: 10,
    max_uses: null as number | null,
    valid_until: "",
  });
  const [savingCoupon, setSavingCoupon] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [statsRes, prosRes, couponsRes] = await Promise.allSettled([
          fetch("/api/marketing/stats"),
          fetch("/api/marketing/professionals"),
          fetch("/api/marketing/coupons"),
        ]);

        if (statsRes.status === "fulfilled" && statsRes.value.ok) {
          setStats(await statsRes.value.json());
        }
        if (prosRes.status === "fulfilled" && prosRes.value.ok) {
          setPros(await prosRes.value.json());
        }
        if (couponsRes.status === "fulfilled" && couponsRes.value.ok) {
          const data = await couponsRes.value.json();
          setCoupons(data.coupons || []);
        }
      } catch (error) {
        console.error("Error fetching marketing data:", error);
        toast.error("Error al cargar datos");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const handleCreateCoupon = async () => {
    if (!couponForm.code || couponForm.discount_pct <= 0) {
      toast.error("Código y descuento son obligatorios");
      return;
    }

    setSavingCoupon(true);
    try {
      const res = await fetch("/api/marketing/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...couponForm,
          valid_until: couponForm.valid_until
            ? new Date(couponForm.valid_until).toISOString()
            : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear cupón");
      }

      const data = await res.json();
      setCoupons((prev) => [data.coupon, ...prev]);
      setCouponDialogOpen(false);
      setCouponForm({ code: "", discount_pct: 10, max_uses: null, valid_until: "" });
      toast.success("Cupón creado exitosamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear cupón");
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ─── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const s = stats?.summary;
  const d = stats?.distribution;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* ──── STAT CARDS (4 columnas) ──────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Registros del mes</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.registros_este_mes ?? 0}</div>
            <div className="flex items-center gap-1 text-xs">
              {(s?.change_pct ?? 0) > 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-500">+{s?.change_pct}%</span>
                </>
              ) : (s?.change_pct ?? 0) < 0 ? (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500" />
                  <span className="text-red-500">{s?.change_pct}%</span>
                </>
              ) : (
                <span className="text-muted-foreground">sin cambio</span>
              )}
              <span className="text-muted-foreground">vs. mes anterior</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profesionales totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.total_professionals ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {s?.total_patients ?? 0} pacientes registrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversión trial → pago</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{s?.conversion_rate ?? 0}%</div>
            <p className="text-xs text-muted-foreground">de trials finalizados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riesgo de abandono</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pros?.churn_risk_count ?? 0}</div>
            <p className="text-xs text-muted-foreground">profesionales en riesgo</p>
          </CardContent>
        </Card>
      </div>

      {/* ──── EVOLUCIÓN MENSUAL + DISTRIBUCIÓN ─────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Evolución de registros */}
        <Card>
          <CardHeader>
            <CardTitle>Evolución de registros</CardTitle>
            <CardDescription>Nuevos profesionales por mes (últimos 12 meses)</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.monthly_evolution && stats.monthly_evolution.length > 0 ? (
              <div className="flex items-end gap-1 h-48 px-2 pb-4 border-b border-muted">
                {stats.monthly_evolution.map((m) => {
                  const maxCount = Math.max(...stats.monthly_evolution.map((x) => x.count), 1);
                  const heightPct = (m.count / maxCount) * 100;
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col items-center gap-1 group"
                      title={`${m.month}: ${m.count} registros`}
                    >
                      <div className="text-xs text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                        {m.count > 0 ? m.count : ""}
                      </div>
                      <div
                        className="w-full bg-primary/80 hover:bg-primary rounded transition-all duration-200"
                        style={{ height: `${Math.max(heightPct, 4)}%`, minHeight: "4px" }}
                      />
                      <div className="text-[10px] text-muted-foreground truncate max-w-full">
                        {monthLabel(m.month)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Distribución por plan y línea */}
        <Card>
          <CardHeader>
            <CardTitle>Distribución</CardTitle>
            <CardDescription>Profesionales por plan y línea de producto</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Por línea */}
            <div>
              <p className="text-sm font-medium mb-2">Por línea</p>
              <div className="space-y-2">
                {[
                  { name: "Healthcare", value: d?.by_line.healthcare ?? 0, color: "bg-blue-500" },
                  { name: "Business", value: d?.by_line.business ?? 0, color: "bg-emerald-500" },
                ].map((item) => {
                  const total = (d?.by_line.healthcare ?? 0) + (d?.by_line.business ?? 0);
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.value} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Por plan */}
            <div>
              <p className="text-sm font-medium mb-2">Por plan</p>
              <div className="space-y-2">
                {[
                  { name: "Free", value: d?.by_plan.free ?? 0, color: "bg-gray-400" },
                  { name: "Base", value: d?.by_plan.base ?? 0, color: "bg-blue-500" },
                  { name: "Standard", value: d?.by_plan.standard ?? 0, color: "bg-purple-500" },
                  { name: "Premium", value: d?.by_plan.premium ?? 0, color: "bg-amber-500" },
                ].map((item) => {
                  const total = s?.total_professionals ?? 1;
                  const pct = total > 0 ? (item.value / total) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.value} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ──── TOP PROFESIONALES + RIESGO ABANDONO ──────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top profesionales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Top profesionales
            </CardTitle>
            <CardDescription>Mayor cantidad de turnos en los últimos 30 días</CardDescription>
          </CardHeader>
          <CardContent>
            {pros?.top_professionals && pros.top_professionals.length > 0 ? (
              <div className="divide-y">
                {pros.top_professionals.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.specialty}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {lineBadge(p.line)}
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">
                        {p.appointments_30d}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">Sin datos</p>
            )}
          </CardContent>
        </Card>

        {/* Riesgo de abandono */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Riesgo de abandono
            </CardTitle>
            <CardDescription>Profesionales sin actividad o con problemas de pago</CardDescription>
          </CardHeader>
          <CardContent>
            {pros?.churn_risk && pros.churn_risk.length > 0 ? (
              <div className="divide-y max-h-96 overflow-y-auto">
                {pros.churn_risk.map((p) => (
                  <div key={p.id} className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{p.specialty}</p>
                      </div>
                      {lineBadge(p.line)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-8">
                Sin profesionales en riesgo
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ──── CUPONES ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cupones de descuento</CardTitle>
            <CardDescription>Crear cupones para campañas (no se pueden modificar desde este panel)</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCouponDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Nuevo cupón
          </Button>
        </CardHeader>
        <CardContent>
          {coupons.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">Código</th>
                    <th className="px-3 py-2 text-left font-medium">Descuento</th>
                    <th className="px-3 py-2 text-left font-medium">Usos</th>
                    <th className="px-3 py-2 text-left font-medium">Válido hasta</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {coupons.map((c) => {
                    const isExpired = c.valid_until && new Date(c.valid_until) < new Date();
                    const isMaxed = c.max_uses && c.used_count >= c.max_uses;
                    return (
                      <tr key={c.id}>
                        <td className="px-3 py-2 font-mono font-medium">
                          <div className="flex items-center gap-1.5">
                            {c.code}
                            <button onClick={() => handleCopyCode(c.code)} className="p-0.5 hover:bg-muted rounded">
                              {copiedCode === c.code ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">{c.discount_pct}%</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {c.used_count}{c.max_uses ? `/${c.max_uses}` : ""}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {c.valid_until ? new Date(c.valid_until).toLocaleDateString("es-AR") : "Sin límite"}
                        </td>
                        <td className="px-3 py-2">
                          {isExpired ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Expirado</span>
                          ) : isMaxed ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Agotado</span>
                          ) : c.is_active ? (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Activo</span>
                          ) : (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">Inactivo</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">
              No hay cupones creados todavía
            </p>
          )}
        </CardContent>
      </Card>

      {/* ──── DIALOG CREAR CUPÓN ───────────────────────────────────────── */}
      <Dialog open={couponDialogOpen} onOpenChange={setCouponDialogOpen}>
        <DialogContent onClose={() => setCouponDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>Crear nuevo cupón</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Código *</label>
              <Input
                value={couponForm.code}
                onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })}
                placeholder="PROMO2026"
              />
              <p className="text-xs text-muted-foreground mt-1">Mayúsculas, sin espacios</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Descuento (%) *</label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={couponForm.discount_pct}
                  onChange={(e) => setCouponForm({ ...couponForm, discount_pct: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Usos máximos</label>
                <Input
                  type="number"
                  min="1"
                  value={couponForm.max_uses || ""}
                  onChange={(e) =>
                    setCouponForm({ ...couponForm, max_uses: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="Sin límite"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Válido hasta</label>
              <Input
                type="date"
                value={couponForm.valid_until}
                onChange={(e) => setCouponForm({ ...couponForm, valid_until: e.target.value })}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setCouponDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCreateCoupon} className="flex-1" disabled={savingCoupon}>
                {savingCoupon ? "Creando..." : "Crear cupón"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
