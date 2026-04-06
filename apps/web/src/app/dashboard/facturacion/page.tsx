"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CreditCard,
  FileText,
  TrendingUp,
  Plus,
  Download,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

interface BillingItem {
  id: string;
  professional_id: string;
  patient_id: string;
  appointment_id: string;
  insurance_id: string;
  practice_code: string;
  practice_name: string;
  amount: number;
  status: "pending" | "submitted" | "paid";
  period_month: number;
  period_year: number;
  facturante_ref: string | null;
  created_at: string;
  patient?: { full_name: string };
  insurance?: { name: string };
  appointment?: { starts_at: string };
}

interface BillingResponse {
  items: BillingItem[];
  summary: {
    total_amount: number;
    count_pending: number;
    count_submitted: number;
    count_paid: number;
    items_by_insurance: Record<string, { count: number; total: number }>;
    items_by_status: Record<string, BillingItem[]>;
  };
}

interface CreateBillingForm {
  appointment_id: string;
  insurance_id: string;
  practice_code: string;
  practice_name: string;
  amount: string;
  period_month: string;
  period_year: string;
}

export default function FacturacionPage() {
  const { user } = useSession();
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted" | "paid">("all");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [insurances, setInsurances] = useState<any[]>([]);
  const [createForm, setCreateForm] = useState<CreateBillingForm>({
    appointment_id: "",
    insurance_id: "",
    practice_code: "",
    practice_name: "",
    amount: "",
    period_month: "",
    period_year: "",
  });

  const fetchBillingData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (period) params.append("period", period);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (insuranceFilter) params.append("insurance_id", insuranceFilter);

      const res = await fetch(`/api/billing?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar datos de facturación");
      const json = (await res.json()) as BillingResponse;
      setData(json);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar datos de facturación");
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter, insuranceFilter]);

  const fetchAppointments = useCallback(async () => {
    try {
      // Get last 90 days of appointments for selection
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      const res = await fetch(
        `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      if (!res.ok) return;
      const json = (await res.json()) as any;
      // Filter for completed or confirmed appointments
      const filtered = (json.appointments || []).filter(
        (apt: any) => apt.status === "completed" || apt.status === "confirmed"
      );
      setAppointments(filtered);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, []);

  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch("/api/insurances");
      if (!res.ok) return;
      const json = (await res.json()) as any;
      setInsurances(json.insurances || []);
    } catch (error) {
      console.error("Error fetching insurances:", error);
    }
  }, []);

  useEffect(() => {
    void fetchBillingData();
    void fetchAppointments();
    void fetchInsurances();
  }, [fetchBillingData, fetchAppointments, fetchInsurances]);

  const handleCreateBillingItem = async () => {
    if (!createForm.appointment_id || !createForm.insurance_id || !createForm.practice_code || !createForm.practice_name || !createForm.amount) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: createForm.appointment_id,
          insurance_id: createForm.insurance_id,
          practice_code: createForm.practice_code,
          practice_name: createForm.practice_name,
          amount: parseFloat(createForm.amount),
          period_month: parseInt(createForm.period_month || String(new Date().getMonth() + 1), 10),
          period_year: parseInt(createForm.period_year || String(new Date().getFullYear()), 10),
        }),
      });

      if (!res.ok) throw new Error("Error al crear item de facturación");
      toast.success("Item de facturación creado correctamente");
      setCreateModalOpen(false);
      setCreateForm({
        appointment_id: "",
        insurance_id: "",
        practice_code: "",
        practice_name: "",
        amount: "",
        period_month: "",
        period_year: "",
      });
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al crear item de facturación");
    }
  };

  const handleUpdateStatus = async (itemId: string, newStatus: "pending" | "submitted" | "paid") => {
    try {
      const res = await fetch(`/api/billing/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Error al actualizar estado");
      toast.success("Estado actualizado correctamente");
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar estado");
    }
  };

  const handleBatchStatusUpdate = async (newStatus: "submitted" | "paid") => {
    if (selectedItems.size === 0) {
      toast.error("Por favor selecciona al menos un item");
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedItems).map((itemId) =>
          fetch(`/api/billing/${itemId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      );
      toast.success(`${selectedItems.size} items actualizados correctamente`);
      setSelectedItems(new Set());
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar items");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este item?")) return;

    try {
      const res = await fetch(`/api/billing/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar item");
      toast.success("Item eliminado correctamente");
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar item");
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setSelectedItems(newSet);
  };

  const filteredItems = data?.items || [];
  const summary = data?.summary;

  if (!user || user.role !== "professional" || user.professional?.line !== "healthcare") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
          <p className="text-sm text-muted-foreground">No tienes acceso a esta sección</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Facturación</h1>
          <p className="text-sm text-muted-foreground">Liquidación de obras sociales</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-1 h-3.5 w-3.5" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nueva liquidación
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Pendiente de cobro</p>
            <FileText className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-3xl font-bold">
            ${summary ? summary.items_by_status.pending.reduce((s, i) => s + Number(i.amount), 0).toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{summary?.count_pending || 0} items</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Presentado</p>
            <CreditCard className="h-5 w-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold">
            ${summary ? summary.items_by_status.submitted.reduce((s, i) => s + Number(i.amount), 0).toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{summary?.count_submitted || 0} items</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Cobrado</p>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold">
            ${summary ? summary.items_by_status.paid.reduce((s, i) => s + Number(i.amount), 0).toFixed(2) : "—"}
          </p>
          <p className="text-xs text-muted-foreground">{summary?.count_paid || 0} items</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total del mes</p>
            <TrendingUp className="h-5 w-5 text-slate-500" />
          </div>
          <p className="text-3xl font-bold">${summary?.total_amount.toFixed(2) || "—"}</p>
          <p className="text-xs text-muted-foreground">{filteredItems.length} items</p>
        </div>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-32 h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Obra Social</Label>
            <Select
              value={insuranceFilter}
              onChange={(e) => setInsuranceFilter(e.target.value)}
              className="w-40 h-9"
            >
              <option value="">Todas</option>
              {insurances.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {selectedItems.size > 0 && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleBatchStatusUpdate("submitted")}>
              Marcar como Presentado
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBatchStatusUpdate("paid")}>
              Marcar como Cobrado
            </Button>
          </div>
        )}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 border-b border-border">
        {(["all", "pending", "submitted", "paid"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "all" ? "Todos" : tab === "pending" ? "Pendientes" : tab === "submitted" ? "Presentados" : "Cobrados"}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No hay ítems de facturación para este período</p>
          <p className="text-sm text-muted-foreground mt-1">Crea tu primer item para empezar a facturar</p>
        </div>
      )}

      {/* Table */}
      {!loading && filteredItems.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <Checkbox
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedItems(new Set(filteredItems.map((i) => i.id)));
                        } else {
                          setSelectedItems(new Set());
                        }
                      }}
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Fecha Turno</th>
                  <th className="px-4 py-3 text-left font-medium">Paciente</th>
                  <th className="px-4 py-3 text-left font-medium">Obra Social</th>
                  <th className="px-4 py-3 text-left font-medium">Práctica</th>
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedItems.has(item.id)}
                        onCheckedChange={() => toggleItemSelection(item.id)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {item.appointment?.starts_at
                        ? format(new Date(item.appointment.starts_at), "d MMM yyyy", { locale: es })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{item.patient?.full_name || "—"}</td>
                    <td className="px-4 py-3">{item.insurance?.name || "—"}</td>
                    <td className="px-4 py-3">{item.practice_name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.practice_code}</td>
                    <td className="px-4 py-3 text-right">${Number(item.amount).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          item.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : item.status === "submitted"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        }
                      >
                        {item.status === "pending" ? "Pendiente" : item.status === "submitted" ? "Presentado" : "Cobrado"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {item.status === "pending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Liquidación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Turno</Label>
              <Select
                value={createForm.appointment_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, appointment_id: e.target.value }))}
              >
                <option value="">Selecciona un turno</option>
                {appointments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.patient?.full_name} - {format(new Date(apt.starts_at), "d MMM yyyy HH:mm", { locale: es })}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Obra Social</Label>
              <Select
                value={createForm.insurance_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, insurance_id: e.target.value }))}
              >
                <option value="">Selecciona una obra social</option>
                {insurances.map((ins) => (
                  <option key={ins.id} value={ins.id}>
                    {ins.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código de Práctica</Label>
              <Input
                value={createForm.practice_code}
                onChange={(e) => setCreateForm((f) => ({ ...f, practice_code: e.target.value }))}
                placeholder="Ej: 101.01"
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre de Práctica</Label>
              <Input
                value={createForm.practice_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, practice_name: e.target.value }))}
                placeholder="Ej: Consulta general"
              />
            </div>
            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={createForm.amount}
                onChange={(e) => setCreateForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleCreateBillingItem} className="flex-1">
                Crear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
