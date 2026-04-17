"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  CreditCard,
  TrendingUp,
  Plus,
  Download,
  Filter,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  patient?: { full_name: string; dni?: string; insurance_number?: string };
  insurance?: { name: string };
  appointment?: { starts_at: string };
}

interface InsuranceSummary {
  insurance_id: string;
  count: number;
  total: number;
}

interface BillingResponse {
  items: BillingItem[];
  summary: {
    total_amount: number;
    count_pending: number;
    count_submitted: number;
    count_paid: number;
    items_by_insurance: Record<string, InsuranceSummary>;
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

  // Filtros por rango de fechas
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Primer día del mes actual
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted" | "paid">("all");
  const [insuranceFilter, setInsuranceFilter] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);
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
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
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
  }, [dateFrom, dateTo, statusFilter, insuranceFilter]);

  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch("/api/professionals/me/insurances");
      if (!res.ok) return;
      const json = (await res.json()) as any;
      setInsurances(json.insurances || []);
    } catch (error) {
      console.error("Error fetching insurances:", error);
    }
  }, []);

  const fetchAppointments = useCallback(async () => {
    try {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 90);
      const res = await fetch(
        `/api/appointments?from=${from.toISOString()}&to=${to.toISOString()}`
      );
      if (!res.ok) return;
      const json = (await res.json()) as any;
      const filtered = (json.appointments || []).filter(
        (apt: any) => apt.status === "completed" || apt.status === "confirmed"
      );
      setAppointments(filtered);
    } catch (error) {
      console.error("Error fetching appointments:", error);
    }
  }, []);

  useEffect(() => {
    void fetchBillingData();
    void fetchInsurances();
    void fetchAppointments();
  }, [fetchBillingData, fetchInsurances, fetchAppointments]);

  // Exportar PDF
  const handleExportPDF = async () => {
    setExportingPDF(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.append("from", dateFrom);
      if (dateTo) params.append("to", dateTo);
      if (insuranceFilter) params.append("insurance_id", insuranceFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const res = await fetch(`/api/billing/export?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" })) as { error?: string };
        throw new Error(err.error || "Error al exportar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        `facturacion_${dateFrom}_${dateTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF exportado correctamente");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al exportar PDF");
    } finally {
      setExportingPDF(false);
    }
  };

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
      toast.success("Item de facturación creado");
      setCreateModalOpen(false);
      setCreateForm({
        appointment_id: "", insurance_id: "", practice_code: "",
        practice_name: "", amount: "", period_month: "", period_year: "",
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
      toast.success("Estado actualizado");
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar estado");
    }
  };

  const handleBatchStatusUpdate = async (newStatus: "submitted" | "paid") => {
    if (selectedItems.size === 0) {
      toast.error("Selecciona al menos un item");
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
      toast.success(`${selectedItems.size} items actualizados`);
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
      toast.success("Item eliminado");
      await fetchBillingData();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar item");
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemId)) newSet.delete(itemId);
    else newSet.add(itemId);
    setSelectedItems(newSet);
  };

  // Agrupar items por prepaga para mostrar subtotales
  const itemsByInsurance: Record<string, { name: string; items: BillingItem[]; total: number }> = {};
  (data?.items || []).forEach((item) => {
    const key = item.insurance_id || "sin-prepaga";
    const name = item.insurance?.name || "Particular";
    if (!itemsByInsurance[key]) {
      itemsByInsurance[key] = { name, items: [], total: 0 };
    }
    itemsByInsurance[key].items.push(item);
    itemsByInsurance[key].total += Number(item.amount);
  });

  const filteredItems = data?.items || [];
  const summary = data?.summary;
  const grandTotal = summary?.total_amount || 0;

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
          <p className="text-sm text-muted-foreground">Liquidación de obras sociales y prepagas</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exportingPDF || filteredItems.length === 0}>
            <Download className="mr-1 h-3.5 w-3.5" />
            {exportingPDF ? "Exportando..." : "Exportar PDF"}
          </Button>
          <Button size="sm" onClick={() => setCreateModalOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Nueva liquidación
          </Button>
        </div>
      </div>

      {/* Total facturado */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Total facturado en el período</p>
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>
        <p className="text-3xl font-bold">
          ${grandTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-muted-foreground">{filteredItems.length} consultas</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Desde</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40 h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hasta</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40 h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Prepaga</Label>
            <Select
              value={insuranceFilter}
              onChange={(e) => setInsuranceFilter(e.target.value)}
              className="w-48 h-9"
            >
              <option value="">Todas</option>
              {insurances.map((ins: any) => (
                <option key={ins.id || ins.insurance_id} value={ins.id || ins.insurance_id}>
                  {ins.name}
                </option>
              ))}
            </Select>
          </div>
          {/* Estado removido — solo se factura */}
        </div>

        {/* Batch actions removidas */}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredItems.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No hay ítems de facturación para este rango de fechas</p>
          <p className="text-sm text-muted-foreground mt-1">Ajustá las fechas o creá una nueva liquidación</p>
        </div>
      )}

      {/* Grouped Tables by Insurance */}
      {!loading && filteredItems.length > 0 && (
        <div className="space-y-6">
          {Object.entries(itemsByInsurance).map(([key, group]) => (
            <div key={key} className="rounded-lg border border-border overflow-hidden">
              {/* Insurance Header */}
              <div className="bg-muted/70 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{group.name}</span>
                  <Badge variant="outline" className="ml-2">{group.items.length} consultas</Badge>
                </div>
                <span className="font-bold text-lg">
                  Subtotal: ${group.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                      <th className="px-4 py-2.5 text-left font-medium">Paciente</th>
                      <th className="px-4 py-2.5 text-left font-medium">DNI</th>
                      <th className="px-4 py-2.5 text-left font-medium">Nº Afiliado</th>
                      <th className="px-4 py-2.5 text-left font-medium">Práctica</th>
                      <th className="px-4 py-2.5 text-right font-medium">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {item.appointment?.starts_at
                            ? format(new Date(item.appointment.starts_at), "dd/MM/yyyy", { locale: es })
                            : format(new Date(item.created_at), "dd/MM/yyyy", { locale: es })}
                        </td>
                        <td className="px-4 py-2.5 font-medium">{item.patient?.full_name || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{item.patient?.dni || "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-xs">{item.patient?.insurance_number || "—"}</td>
                        <td className="px-4 py-2.5">{item.practice_name}</td>
                        <td className="px-4 py-2.5 text-right font-medium">
                          ${Number(item.amount).toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Grand Total */}
          <div className="rounded-lg border-2 border-primary bg-primary/5 p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total general</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filteredItems.length} consultas — {Object.keys(itemsByInsurance).length} prepagas
              </p>
            </div>
            <p className="text-3xl font-bold text-primary">
              ${grandTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          {/* Resumen por prepaga */}
          {Object.keys(itemsByInsurance).length > 1 && (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 font-semibold text-sm">Resumen por prepaga</div>
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Prepaga</th>
                    <th className="px-4 py-2.5 text-center font-medium">Consultas</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(itemsByInsurance).map(([key, group]) => (
                    <tr key={key} className="border-b border-border">
                      <td className="px-4 py-2.5 font-medium">{group.name}</td>
                      <td className="px-4 py-2.5 text-center">{group.items.length}</td>
                      <td className="px-4 py-2.5 text-right font-bold">
                        ${group.total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-bold">
                    <td className="px-4 py-3">TOTAL</td>
                    <td className="px-4 py-3 text-center">{filteredItems.length}</td>
                    <td className="px-4 py-3 text-right">
                      ${grandTotal.toLocaleString("es-AR", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
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
                {appointments.map((apt: any) => (
                  <option key={apt.id} value={apt.id}>
                    {apt.patient?.full_name} - {format(new Date(apt.starts_at), "d MMM yyyy HH:mm", { locale: es })}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prepaga</Label>
              <Select
                value={createForm.insurance_id}
                onChange={(e) => setCreateForm((f) => ({ ...f, insurance_id: e.target.value }))}
              >
                <option value="">Selecciona una prepaga</option>
                {insurances.map((ins: any) => (
                  <option key={ins.id || ins.insurance_id} value={ins.id || ins.insurance_id}>
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
