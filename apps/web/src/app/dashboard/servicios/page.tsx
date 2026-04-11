"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Clock, DollarSign, Trash2, Edit2, Video, MapPin, Building2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

export default function ServiciosPage() {
  const { user } = useSession();
  const isHealthcare = user?.professional?.line === "healthcare";
  const [services, setServices] = useState<Service[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
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

  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch("/api/insurances");
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
      toast.error("Por favor completa los campos requeridos");
      return;
    }

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
        <Button size="sm" onClick={() => setCreateModalOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
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

      {/* Create/Edit Modal */}
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
        <DialogContent onClose={() => { setCreateModalOpen(false); setEditingService(null); }} className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Servicio *</Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Consulta general"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duración (minutos) *</Label>
              <Input
                id="duration"
                type="number"
                min="5"
                max="480"
                value={createForm.duration_minutes}
                onChange={(e) => setCreateForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                placeholder="30"
              />
            </div>

            {/* Obras sociales / Prepagas (solo Healthcare) */}
            {isHealthcare && insurances.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Obras Sociales / Prepagas que aceptás
                </Label>
                <div className="rounded-md border border-input p-3 space-y-2 max-h-40 overflow-y-auto">
                  {insurances.map((ins) => {
                    const checked = createForm.insurance_ids.includes(ins.id);
                    return (
                      <label
                        key={ins.id}
                        className={`flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer transition-colors text-sm ${
                          checked
                            ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                            : "hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInsurance(ins.id)}
                          className="rounded border-gray-300"
                        />
                        <span>{ins.name}</span>
                        {ins.code && (
                          <span className="text-xs text-muted-foreground">({ins.code})</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                {createForm.insurance_ids.length > 0 && (
                  <p className="text-xs text-emerald-600">
                    {createForm.insurance_ids.length} obra{createForm.insurance_ids.length !== 1 ? "s" : ""} social{createForm.insurance_ids.length !== 1 ? "es" : ""} seleccionada{createForm.insurance_ids.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Precio particular */}
            <div className="space-y-2">
              <Label htmlFor="price">Precio particular (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Solo se aplica a consultas sin obra social
              </p>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={createForm.price}
                onChange={(e) => setCreateForm((f) => ({ ...f, price: e.target.value }))}
                placeholder="0.00"
              />
            </div>

            {createForm.price && Number(createForm.price) > 0 && (
              <div className="flex items-center gap-3">
                <Switch
                  id="show_price"
                  checked={createForm.show_price}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, show_price: checked }))
                  }
                />
                <Label htmlFor="show_price" className="font-normal cursor-pointer">
                  Mostrar precio en la web pública
                </Label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Modalidad</Label>
              <div className="flex gap-2">
                {[
                  { value: "presencial", label: "Presencial", icon: MapPin },
                  { value: "virtual", label: "Virtual", icon: Video },
                  { value: "both", label: "Ambas", icon: null },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCreateForm((f) => ({ ...f, modality: opt.value as "presencial" | "virtual" | "both" }))}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      createForm.modality === opt.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-accent"
                    }`}
                  >
                    {opt.icon && <opt.icon className="h-4 w-4" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditingService(null);
                  setCreateForm(emptyForm);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateService} className="flex-1">
                {editingService ? "Actualizar" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
