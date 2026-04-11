"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Clock, DollarSign, Trash2, Edit2, Video, MapPin, Building2, Shield, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

interface Insurance {
  id: string;
  name: string;
  code: string | null;
}

interface ServiceInsurance {
  insurance_id: string;
  insurance: Insurance;
}

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  show_price: boolean;
  is_active: boolean;
  modality: "presencial" | "virtual" | "both";
  line: string;
  created_at: string;
  service_insurances?: ServiceInsurance[];
}

interface CreateServiceForm {
  name: string;
  duration_minutes: string;
  price: string;
  show_price: boolean;
  modality: "presencial" | "virtual" | "both";
  insurance_ids: string[];
}

const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];

export default function ServiciosPage() {
  const { user } = useSession();
  const isHealthcare = user?.professional?.line === "healthcare";
  const [services, setServices] = useState<Service[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const emptyForm: CreateServiceForm = {
    name: "",
    duration_minutes: "30",
    price: "",
    show_price: false,
    modality: "presencial",
    insurance_ids: [],
  };
  const [createForm, setCreateForm] = useState<CreateServiceForm>(emptyForm);

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Error al cargar servicios");
      const data = (await res.json()) as { services: Service[] };
      setServices((data.services ?? []).filter((s) => s.is_active !== false));
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      toast.error("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, []);

  // Usar endpoint de obras sociales del profesional en vez del global
  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch("/api/professionals/me/insurances");
      if (res.ok) {
        const data = (await res.json()) as { insurances: Insurance[] };
        setInsurances(data.insurances ?? []);
      }
    } catch (err) {
      console.error("Error fetching insurances:", err);
    }
  }, []);

  useEffect(() => {
    void fetchServices();
    if (isHealthcare) void fetchInsurances();
  }, [fetchServices, fetchInsurances, isHealthcare]);

  const handleCreateService = async () => {
    if (!createForm.name || !createForm.duration_minutes) {
      toast.error("Por favor completá los campos requeridos");
      return;
    }

    setSaving(true);
    try {
      if (editingService) {
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createForm.name,
            duration_minutes: parseInt(createForm.duration_minutes, 10),
            price: createForm.price ? parseFloat(createForm.price) : null,
            show_price: createForm.show_price,
            modality: createForm.modality,
            insurance_ids: createForm.insurance_ids,
          }),
        });

        if (!res.ok) {
          const error = (await res.json()) as { error?: string };
          throw new Error(error.error || "Error al actualizar servicio");
        }
        toast.success("Servicio actualizado correctamente");
      } else {
        const payload = {
          name: createForm.name,
          duration_minutes: parseInt(createForm.duration_minutes, 10),
          price: createForm.price ? parseFloat(createForm.price) : undefined,
          show_price: createForm.show_price,
          modality: createForm.modality,
          line: (user?.professional?.line || "healthcare").toLowerCase(),
          insurance_ids: createForm.insurance_ids,
        };
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const error = (await res.json()) as { error?: string };
          throw new Error(error.error || "Error al crear servicio");
        }
        toast.success("Servicio creado correctamente");
      }

      setCreateModalOpen(false);
      setEditingService(null);
      setCreateForm(emptyForm);
      await fetchServices();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al guardar servicio");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este servicio?")) return;

    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar servicio");
      const data = (await res.json()) as { soft_deleted?: boolean };
      toast.success(data.soft_deleted ? "Servicio desactivado (tiene turnos asociados)" : "Servicio eliminado correctamente");
      setServices((prev) => prev.filter((s) => s.id !== serviceId));
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar servicio");
    }
  };

  const toggleInsurance = (insuranceId: string) => {
    setCreateForm((f) => ({
      ...f,
      insurance_ids: f.insurance_ids.includes(insuranceId)
        ? f.insurance_ids.filter((id) => id !== insuranceId)
        : [...f.insurance_ids, insuranceId],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">
            Configurá los tipos de consulta y sus precios
          </p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo servicio
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Empty State */}
      {!loading && services.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No tenés servicios configurados todavía</p>
          <p className="text-sm text-muted-foreground mt-1">Creá tu primer servicio para empezar a recibir turnos</p>
        </div>
      )}

      {/* Services Grid */}
      {!loading && services.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const hasInsurances = service.service_insurances && service.service_insurances.length > 0;
            return (
              <div
                key={service.id}
                className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-primary/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <h3 className="font-semibold text-foreground">{service.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      Creado el {new Date(service.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      service.is_active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {service.is_active ? "Activo" : "Inactivo"}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4 flex-shrink-0" />
                    <span>{service.duration_minutes} minutos</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {service.modality === "virtual" ? (
                      <Video className="h-4 w-4 flex-shrink-0 text-blue-500" />
                    ) : service.modality === "both" ? (
                      <><MapPin className="h-4 w-4 flex-shrink-0" /><span>/</span><Video className="h-4 w-4 flex-shrink-0 text-blue-500" /></>
                    ) : (
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                    )}
                    <span>{service.modality === "presencial" ? "Presencial" : service.modality === "virtual" ? "Virtual" : "Presencial / Virtual"}</span>
                  </div>

                  {/* Precio particular */}
                  {service.price !== null && Number(service.price) > 0 && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <DollarSign className="h-4 w-4 flex-shrink-0" />
                      <span>Particular: ${Number(service.price).toLocaleString("es-AR")}</span>
                      {service.show_price && (
                        <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">
                          Visible en web
                        </span>
                      )}
                    </div>
                  )}

                  {/* Obras sociales */}
                  {hasInsurances && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {service.service_insurances!.map((si) => (
                          <span
                            key={si.insurance_id}
                            className="inline-flex items-center rounded bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-xs"
                          >
                            {si.insurance?.name || "OS"}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingService(service);
                      setCreateForm({
                        name: service.name,
                        duration_minutes: String(service.duration_minutes),
                        price: service.price ? String(service.price) : "",
                        show_price: service.show_price,
                        modality: service.modality || "presencial",
                        insurance_ids: service.service_insurances?.map((si) => si.insurance_id) ?? [],
                      });
                      setCreateModalOpen(true);
                    }}
                    className="flex-1"
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteService(service.id)}
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create/Edit Modal (rediseñado, más grande) ──────── */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setEditingService(null);
            setCreateForm(emptyForm);
          }
        }}
      >
        <DialogContent
          onClose={() => { setCreateModalOpen(false); setEditingService(null); }}
          className="sm:max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {editingService ? (
                <><Edit2 className="h-5 w-5" /> Editar Servicio</>
              ) : (
                <><Plus className="h-5 w-5" /> Nuevo Servicio</>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 pt-2">
            {/* ── Nombre del servicio ─────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-semibold">
                Nombre del servicio *
              </Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Consulta general, Control mensual, Limpieza dental..."
                className="h-11 text-base"
              />
            </div>

            {/* ── Duración ───────────────────────────────────── */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Duración *</Label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() =>
                      setCreateForm((f) => ({ ...f, duration_minutes: String(d) }))
                    }
                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                      createForm.duration_minutes === String(d)
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-border hover:bg-accent hover:border-accent-foreground/20"
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Otra duración:</span>
                <Input
                  type="number"
                  min="5"
                  max="480"
                  value={createForm.duration_minutes}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, duration_minutes: e.target.value }))
                  }
                  className="w-24 h-9"
                />
                <span className="text-xs text-muted-foreground">minutos</span>
              </div>
            </div>

            {/* ── Modalidad ──────────────────────────────────── */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Modalidad de atención</Label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "presencial", label: "Presencial", icon: MapPin, desc: "En consultorio" },
                  { value: "virtual", label: "Virtual", icon: Video, desc: "Videollamada" },
                  { value: "both", label: "Ambas", icon: null, desc: "Presencial o virtual" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setCreateForm((f) => ({
                        ...f,
                        modality: opt.value as "presencial" | "virtual" | "both",
                      }))
                    }
                    className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-4 py-4 text-sm transition-all ${
                      createForm.modality === opt.value
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {opt.icon ? (
                      <opt.icon className="h-5 w-5" />
                    ) : (
                      <div className="flex gap-1">
                        <MapPin className="h-4 w-4" />
                        <Video className="h-4 w-4" />
                      </div>
                    )}
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Obras sociales (solo Healthcare) ───────────── */}
            {isHealthcare && (
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-emerald-500" />
                  Obras Sociales / Prepagas que aceptás
                </Label>

                {insurances.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                          No tenés obras sociales cargadas
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                          Agregá tus obras sociales desde{" "}
                          <a
                            href="/dashboard/configuracion"
                            className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300"
                          >
                            Configuración
                          </a>{" "}
                          para poder vincularlas a tus servicios.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {insurances.map((ins) => {
                        const checked = createForm.insurance_ids.includes(ins.id);
                        return (
                          <label
                            key={ins.id}
                            className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-all ${
                              checked
                                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                                : "border-border hover:bg-accent hover:border-accent-foreground/20"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleInsurance(ins.id)}
                              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                              <span className="text-sm font-medium">{ins.name}</span>
                              {ins.code && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                  ({ins.code})
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    {createForm.insurance_ids.length > 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {createForm.insurance_ids.length} obra
                        {createForm.insurance_ids.length !== 1 ? "s" : ""} social
                        {createForm.insurance_ids.length !== 1 ? "es" : ""} seleccionada
                        {createForm.insurance_ids.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Precio ─────────────────────────────────────── */}
            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign className="h-4 w-4 text-green-500" />
                  Precio particular (opcional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Se aplica a consultas sin obra social. Dejalo vacío si no querés especificar precio.
                </p>
                <div className="relative w-48">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    $
                  </span>
                  <Input
                    id="price"
                    type="number"
                    step="100"
                    min="0"
                    value={createForm.price}
                    onChange={(e) =>
                      setCreateForm((f) => ({ ...f, price: e.target.value }))
                    }
                    placeholder="0"
                    className="pl-7 h-11 text-lg font-medium"
                  />
                </div>
              </div>

              {createForm.price && Number(createForm.price) > 0 && (
                <div className="flex items-center gap-3 pt-2 border-t border-border">
                  <Switch
                    id="show_price"
                    checked={createForm.show_price}
                    onCheckedChange={(checked) =>
                      setCreateForm((f) => ({ ...f, show_price: checked }))
                    }
                  />
                  <Label htmlFor="show_price" className="font-normal cursor-pointer flex items-center gap-2">
                    {createForm.show_price ? (
                      <Eye className="h-4 w-4 text-blue-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    Mostrar precio en la web pública
                  </Label>
                </div>
              )}
            </div>

            {/* ── Botones ────────────────────────────────────── */}
            <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-background pb-1">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditingService(null);
                  setCreateForm(emptyForm);
                }}
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateService}
                disabled={saving || !createForm.name || !createForm.duration_minutes}
                className="flex-1 h-11"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : editingService ? (
                  "Actualizar servicio"
                ) : (
                  "Crear servicio"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
