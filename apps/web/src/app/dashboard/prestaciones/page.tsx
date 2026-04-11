"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Filter,
  ClipboardList,
  DollarSign,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

// ─── Types ──────────────────────────────────────────────────
interface Insurance {
  id: string;
  name: string;
  code: string | null;
  logo_url: string | null;
}

interface Prestacion {
  id: string;
  professional_id: string;
  insurance_id: string;
  code: string;
  description: string;
  amount: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  insurance: Insurance;
}

interface PrestacionStats {
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

interface FormData {
  insurance_id: string;
  code: string;
  description: string;
  amount: string;
  valid_from: string;
  valid_until: string;
}

const emptyForm: FormData = {
  insurance_id: "",
  code: "",
  description: "",
  amount: "",
  valid_from: new Date().toISOString().split("T")[0],
  valid_until: "",
};

const formatCurrency = (v: number) =>
  `$${v.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;

// ─── Component ──────────────────────────────────────────────
export default function PrestacionesPage() {
  const { user, loading: userLoading } = useSession();
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [stats, setStats] = useState<PrestacionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [search, setSearch] = useState("");
  const [filterInsurance, setFilterInsurance] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  // Stats section
  const [showEvolution, setShowEvolution] = useState(false);

  // ── Fetch data ────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prestRes, insRes, statsRes] = await Promise.all([
        fetch("/api/prestaciones"),
        fetch("/api/professionals/me/insurances"),
        fetch("/api/prestaciones/stats"),
      ]);

      if (prestRes.ok) {
        const d = (await prestRes.json()) as { prestaciones: Prestacion[] };
        setPrestaciones(d.prestaciones ?? []);
      }
      if (insRes.ok) {
        const d = (await insRes.json()) as { insurances: Insurance[] };
        setInsurances(d.insurances ?? []);
      }
      if (statsRes.ok) {
        const d = (await statsRes.json()) as PrestacionStats;
        setStats(d);
      }
    } catch (err) {
      console.error("Error loading prestaciones:", err);
      toast.error("Error al cargar prestaciones");
    } finally {
      setLoading(false);
    }
  };

  // ── Filtrar ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    return prestaciones.filter((p) => {
      if (!showInactive && !p.is_active) return false;
      if (filterInsurance && p.insurance_id !== filterInsurance) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          p.description.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.insurance?.name?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [prestaciones, search, filterInsurance, showInactive]);

  // Agrupar por obra social
  const grouped = useMemo(() => {
    const map = new Map<string, { insurance: Insurance; items: Prestacion[] }>();
    for (const p of filtered) {
      const key = p.insurance_id;
      if (!map.has(key)) {
        map.set(key, { insurance: p.insurance, items: [] });
      }
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) =>
      a.insurance.name.localeCompare(b.insurance.name)
    );
  }, [filtered]);

  // ── Modal handlers ────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: Prestacion) => {
    setEditingId(p.id);
    setForm({
      insurance_id: p.insurance_id,
      code: p.code,
      description: p.description,
      amount: String(p.amount),
      valid_from: p.valid_from,
      valid_until: p.valid_until || "",
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.insurance_id || !form.code || !form.description || !form.amount) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        insurance_id: form.insurance_id,
        code: form.code,
        description: form.description,
        amount: Number(form.amount),
        valid_from: form.valid_from || undefined,
        valid_until: form.valid_until || null,
      };

      const url = editingId ? `/api/prestaciones/${editingId}` : "/api/prestaciones";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Error al guardar");
      }

      toast.success(editingId ? "Prestación actualizada" : "Prestación creada");
      setModalOpen(false);
      fetchAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Desactivar esta prestación?")) return;
    try {
      const res = await fetch(`/api/prestaciones/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error");
      toast.success("Prestación desactivada");
      fetchAll();
    } catch {
      toast.error("Error al desactivar prestación");
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/prestaciones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: true }),
      });
      if (!res.ok) throw new Error("Error");
      toast.success("Prestación reactivada");
      fetchAll();
    } catch {
      toast.error("Error al reactivar");
    }
  };

  // ── Loading state ─────────────────────────────────────────
  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prestaciones</h1>
          <p className="text-sm text-muted-foreground">Cargando...</p>
        </div>
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  // ── Max for charts ────────────────────────────────────────
  const maxMonthly = stats
    ? Math.max(...stats.monthlyEvolution.map((m) => m.total), 1)
    : 1;

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prestaciones</h1>
          <p className="text-sm text-muted-foreground">
            Cargá y gestioná tus prestaciones por obra social o prepaga
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Prestación
        </Button>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prestaciones activas</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {prestaciones.filter((p) => p.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground">cargadas en el sistema</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total mes actual</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats ? formatCurrency(stats.currentMonth.total) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.currentMonth.count || 0} turnos con prestación
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
              {stats ? formatCurrency(stats.totalHistorico) : "$0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalCount || 0} turnos totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Obras sociales</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(prestaciones.filter((p) => p.is_active).map((p) => p.insurance_id)).size}
            </div>
            <p className="text-xs text-muted-foreground">con prestaciones cargadas</p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Evolución mensual ──────────────────────────────── */}
      <Card>
        <CardHeader
          className="cursor-pointer"
          onClick={() => setShowEvolution(!showEvolution)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Evolución mensual</CardTitle>
              <CardDescription>Total en pesos por mes (últimos 12 meses)</CardDescription>
            </div>
            {showEvolution ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        {showEvolution && stats && (
          <CardContent>
            <div className="flex items-end gap-1 h-48 px-2 pb-4 border-b border-muted">
              {stats.monthlyEvolution.map((m, i) => {
                const heightPct = (m.total / maxMonthly) * 100;
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
                      className="w-full bg-primary/80 hover:bg-primary rounded transition-all duration-200"
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

            {/* Desglose por OS del mes actual */}
            {stats.byInsurance.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Desglose por obra social — {stats.currentMonth.label}
                </p>
                {stats.byInsurance.map((ins) => {
                  const maxIns = stats.byInsurance[0].total;
                  const widthPct = (ins.total / maxIns) * 100;
                  return (
                    <div key={ins.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm truncate flex-1">{ins.name}</span>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {ins.count} turnos · {formatCurrency(ins.total)}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-sm h-5 overflow-hidden">
                        <div
                          className="h-full bg-primary/80 rounded-sm transition-all"
                          style={{ width: `${widthPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* ─── Filtros ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descripción u obra social..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={filterInsurance}
          onChange={(e) => setFilterInsurance(e.target.value)}
        >
          <option value="">Todas las obras sociales</option>
          {insurances.map((ins) => (
            <option key={ins.id} value={ins.id}>
              {ins.name}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-muted-foreground"
          />
          Mostrar inactivas
        </label>
      </div>

      {/* ─── Lista agrupada por OS ──────────────────────────── */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-lg font-medium">No hay prestaciones cargadas</p>
            <p className="text-sm text-muted-foreground mt-1">
              {insurances.length === 0
                ? "Primero agregá tus obras sociales desde Configuración, y luego cargá tus prestaciones."
                : "Hacé clic en \"Nueva Prestación\" para empezar a cargar"}
            </p>
            {insurances.length === 0 && (
              <a
                href="/dashboard/configuracion"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Ir a Configuración
              </a>
            )}
          </CardContent>
        </Card>
      ) : (
        grouped.map((group) => (
          <Card key={group.insurance.id}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {group.insurance.name.charAt(0)}
                </div>
                {group.insurance.name}
                {group.insurance.code && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({group.insurance.code})
                  </span>
                )}
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {group.items.length} prestacion{group.items.length !== 1 ? "es" : ""}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {group.items.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-4 py-3 ${!p.is_active ? "opacity-50" : ""}`}
                  >
                    {/* Código */}
                    <div className="min-w-[80px]">
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-mono font-medium">
                        {p.code}
                      </span>
                    </div>

                    {/* Descripción */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Vigencia: {new Date(p.valid_from + "T12:00:00").toLocaleDateString("es-AR")}
                        {p.valid_until
                          ? ` — ${new Date(p.valid_until + "T12:00:00").toLocaleDateString("es-AR")}`
                          : " — Indefinida"}
                      </p>
                    </div>

                    {/* Estado */}
                    {!p.is_active && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 rounded px-2 py-0.5">
                        Inactiva
                      </span>
                    )}

                    {/* Vencida check */}
                    {p.valid_until && new Date(p.valid_until) < new Date() && p.is_active && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded px-2 py-0.5">
                        <AlertCircle className="h-3 w-3" />
                        Vencida
                      </span>
                    )}

                    {/* Monto */}
                    <div className="text-right min-w-[100px]">
                      <span className="text-sm font-bold text-green-600 dark:text-green-400">
                        {formatCurrency(Number(p.amount))}
                      </span>
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openEdit(p)}
                        title="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {p.is_active ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                          onClick={() => handleDelete(p.id)}
                          title="Desactivar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-green-500 hover:text-green-700"
                          onClick={() => handleReactivate(p.id)}
                          title="Reactivar"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* ─── Modal Crear/Editar ─────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent onClose={() => setModalOpen(false)} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingId ? "Editar Prestación" : "Nueva Prestación"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            {/* Obra social */}
            <div className="space-y-2">
              <Label>Obra Social / Prepaga *</Label>
              <Select
                value={form.insurance_id}
                onChange={(e) => setForm((f) => ({ ...f, insurance_id: e.target.value }))}
              >
                <option value="">
                  {insurances.length === 0 ? "No tenés obras sociales cargadas" : "Seleccionar..."}
                </option>
                {insurances.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name} {ins.code ? `(${ins.code})` : ""}
                  </option>
                ))}
              </Select>
              {insurances.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Agregá obras sociales desde{" "}
                  <a href="/dashboard/configuracion" className="underline font-medium">
                    Configuración
                  </a>{" "}
                  antes de crear una prestación.
                </p>
              )}
            </div>

            {/* Código + Descripción */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Código *</Label>
                <Input
                  placeholder="Ej: 420101"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Descripción *</Label>
                <Input
                  placeholder="Ej: Consulta médica general"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-2">
              <Label>Valor ($) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 15000"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>

            {/* Vigencia */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vigencia desde *</Label>
                <Input
                  type="date"
                  value={form.valid_from}
                  onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Vigencia hasta</Label>
                <Input
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Vacío = indefinida</p>
              </div>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : editingId ? (
                  "Guardar cambios"
                ) : (
                  "Crear prestación"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
