"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Clock, DollarSign, Trash2, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number | null;
  show_price: boolean;
  is_active: boolean;
  line: string;
  created_at: string;
}

interface CreateServiceForm {
  name: string;
  duration_minutes: string;
  price: string;
  show_price: boolean;
}

export default function ServiciosPage() {
  const { user } = useSession();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [createForm, setCreateForm] = useState<CreateServiceForm>({
    name: "",
    duration_minutes: "30",
    price: "",
    show_price: false,
  });

  const fetchServices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Error al cargar servicios");
      const data = (await res.json()) as { services: Service[] };
      setServices(data.services ?? []);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      toast.error("Error al cargar servicios");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const handleCreateService = async () => {
    if (!createForm.name || !createForm.duration_minutes) {
      toast.error("Por favor completa los campos requeridos");
      return;
    }

    try {
      if (editingService) {
        // Update existing service
        const res = await fetch(`/api/services/${editingService.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createForm.name,
            duration_minutes: parseInt(createForm.duration_minutes, 10),
            price: createForm.price ? parseFloat(createForm.price) : null,
            show_price: createForm.show_price,
          }),
        });

        if (!res.ok) {
          const error = (await res.json()) as any;
          throw new Error(error.error || "Error al actualizar servicio");
        }
        toast.success("Servicio actualizado correctamente");
      } else {
        // Create new service
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: createForm.name,
            duration_minutes: parseInt(createForm.duration_minutes, 10),
            price: createForm.price ? parseFloat(createForm.price) : null,
            show_price: createForm.show_price,
            line: user?.professional?.line || "business",
          }),
        });

        if (!res.ok) {
          const error = (await res.json()) as any;
          throw new Error(error.error || "Error al crear servicio");
        }
        toast.success("Servicio creado correctamente");
      }

      setCreateModalOpen(false);
      setEditingService(null);
      setCreateForm({
        name: "",
        duration_minutes: "30",
        price: "",
        show_price: false,
      });
      await fetchServices();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al guardar servicio");
    }
  };

  const handleUpdateService = async (serviceId: string, updates: Partial<Service>) => {
    try {
      const res = await fetch(`/api/services/${serviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) throw new Error("Error al actualizar servicio");
      toast.success("Servicio actualizado correctamente");
      setEditingService(null);
      await fetchServices();
    } catch (error) {
      console.error(error);
      toast.error("Error al actualizar servicio");
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm("¿Estás seguro de que quieres eliminar este servicio?")) return;

    try {
      const res = await fetch(`/api/services/${serviceId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar servicio");
      toast.success("Servicio eliminado correctamente");
      await fetchServices();
    } catch (error) {
      console.error(error);
      toast.error("Error al eliminar servicio");
    }
  };

  const handleToggleActive = async (service: Service) => {
    await handleUpdateService(service.id, { is_active: !service.is_active });
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
          <p className="text-muted-foreground">
            No tenés servicios configurados todavía
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Creá tu primer servicio para empezar a recibir turnos
          </p>
        </div>
      )}

      {/* Services Grid */}
      {!loading && services.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <div
              key={service.id}
              className="rounded-lg border border-border bg-card p-5 space-y-4 hover:border-primary/50 transition-colors"
            >
              {/* Service Header */}
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

              {/* Service Details */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>{service.duration_minutes} minutos</span>
                </div>
                {service.price !== null && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4 flex-shrink-0" />
                    <span>${Number(service.price).toFixed(2)}</span>
                    {service.show_price && <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded">Visible</span>}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleActive(service)}
                  className="flex-1"
                >
                  {service.is_active ? "Desactivar" : "Activar"}
                </Button>
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
                    });
                    setCreateModalOpen(true);
                  }}
                  className="flex-1"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteService(service.id)}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog
        open={createModalOpen}
        onOpenChange={(open) => {
          setCreateModalOpen(open);
          if (!open) {
            setEditingService(null);
            setCreateForm({
              name: "",
              duration_minutes: "30",
              price: "",
              show_price: false,
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar Servicio" : "Nuevo Servicio"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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

            <div className="space-y-2">
              <Label htmlFor="price">Precio (opcional)</Label>
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

            {createForm.price && (
              <div className="flex items-center gap-3">
                <Switch
                  id="show_price"
                  checked={createForm.show_price}
                  onCheckedChange={(checked) =>
                    setCreateForm((f) => ({ ...f, show_price: checked }))
                  }
                />
                <Label htmlFor="show_price" className="font-normal cursor-pointer">
                  Mostrar precio públicamente
                </Label>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateModalOpen(false);
                  setEditingService(null);
                  setCreateForm({
                    name: "",
                    duration_minutes: "30",
                    price: "",
                    show_price: false,
                  });
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
