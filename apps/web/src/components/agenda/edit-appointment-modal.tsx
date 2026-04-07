"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertCircle, Trash2, FileText, Video, MapPin, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import type { AppointmentWithRelations } from "@/types";

interface EditAppointmentModalProps {
  appointment: AppointmentWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

interface FormData {
  startsAt: string;
  endsAt: string;
  status: string;
  notes: string;
  cancellationReason: string;
}

export function EditAppointmentModal({
  appointment,
  open,
  onOpenChange,
  onSave,
}: EditAppointmentModalProps) {
  const [formData, setFormData] = useState<FormData>(() => {
    if (!appointment) {
      return {
        startsAt: "",
        endsAt: "",
        status: "pending",
        notes: "",
        cancellationReason: "",
      };
    }

    return {
      startsAt: format(new Date(appointment.starts_at), "yyyy-MM-dd'T'HH:mm"),
      endsAt: format(new Date(appointment.ends_at), "yyyy-MM-dd'T'HH:mm"),
      status: appointment.status,
      notes: appointment.notes || "",
      cancellationReason: appointment.cancellation_reason || "",
    };
  });

  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const router = useRouter();

  if (!appointment) return null;

  const getStatusBadgeVariant = (status: string) => {
    if (status === "confirmed") return "default";
    if (status === "completed") return "success";
    if (status === "cancelled") return "destructive";
    if (status === "no_show") return "secondary";
    return "warning";
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendiente",
      confirmed: "Confirmado",
      completed: "Completado",
      cancelled: "Cancelado",
      no_show: "Ausente",
    };
    return labels[status] || status;
  };

  const handleSave = async () => {
    if (!appointment) return;

    try {
      setLoading(true);

      const payload: Record<string, unknown> = {
        starts_at: new Date(formData.startsAt).toISOString(),
        ends_at: new Date(formData.endsAt).toISOString(),
        status: formData.status,
        notes: formData.notes,
      };

      // Incluir cancellation_reason solo si está marcado como cancelado
      if (formData.status === "cancelled") {
        payload.cancellation_reason = formData.cancellationReason;
      }

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al guardar el turno");
      }

      toast.success("Turno actualizado correctamente");
      onOpenChange(false);
      onSave?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al guardar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/appointments/${appointment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Error al cancelar el turno");
      }

      toast.success("Turno cancelado correctamente");
      onOpenChange(false);
      onSave?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al cancelar";
      toast.error(message);
    } finally {
      setLoading(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg">Editar turno</DialogTitle>
            <Badge variant={getStatusBadgeVariant(appointment.status)} className="text-xs">
              {getStatusLabel(appointment.status)}
            </Badge>
          </div>
        </DialogHeader>

        {/* Cabecera: paciente + servicio + acceso rápido */}
        <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Paciente</p>
              <p className="font-medium">{appointment.patient.full_name}</p>
            </div>
            {appointment.service && (
              <div className="border-l pl-4">
                <p className="text-sm text-muted-foreground">Servicio</p>
                <p className="font-medium">{appointment.service.name}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(appointment as any).modality === "virtual" && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 gap-1">
                <Video className="h-3 w-3" />
                Virtual
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                router.push(`/dashboard/pacientes/${appointment.patient_id}/historia-clinica`);
              }}
            >
              <FileText className="h-4 w-4" />
              Historia Clínica
            </Button>
          </div>
        </div>

        {/* Link de Google Meet */}
        {(appointment as any).modality === "virtual" && (appointment as any).meet_url && (
          <div className="flex items-center gap-3 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
            <Video className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Google Meet</p>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">{(appointment as any).meet_url}</p>
            </div>
            <a
              href={(appointment as any).meet_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Unirse
            </a>
          </div>
        )}

        {/* Contenido principal en 2 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {/* Columna izquierda: horarios y estado */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="starts-at">Inicio</Label>
                <Input
                  id="starts-at"
                  type="datetime-local"
                  value={formData.startsAt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, startsAt: e.target.value }))
                  }
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ends-at">Fin</Label>
                <Input
                  id="ends-at"
                  type="datetime-local"
                  value={formData.endsAt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, endsAt: e.target.value }))
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status">Estado</Label>
              <Select
                id="status"
                value={formData.status}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, status: e.target.value }))
                }
                disabled={loading}
              >
                <option value="pending">Pendiente</option>
                <option value="confirmed">Confirmado</option>
                <option value="completed">Completado</option>
                <option value="no_show">Ausente</option>
                <option value="cancelled">Cancelado</option>
              </Select>
            </div>

            {formData.status === "cancelled" && (
              <div className="space-y-1.5">
                <Label htmlFor="cancellation-reason">Motivo de cancelación</Label>
                <Input
                  id="cancellation-reason"
                  type="text"
                  placeholder="Ej: paciente canceló, emergencia..."
                  value={formData.cancellationReason}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      cancellationReason: e.target.value,
                    }))
                  }
                  disabled={loading}
                />
              </div>
            )}
          </div>

          {/* Columna derecha: notas */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas</Label>
            <textarea
              id="notes"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-vertical min-h-[160px]"
              placeholder="Anotaciones sobre el turno..."
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              disabled={loading}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.notes.length}/500
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-between border-t pt-4">
          {/* Izquierda: cancelar turno */}
          <div>
            {appointment.status !== "cancelled" &&
              appointment.status !== "completed" && (
                <>
                  {!showCancelConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={loading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Cancelar turno
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-destructive font-medium">¿Confirmar?</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={loading}
                      >
                        No
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={loading}
                      >
                        Sí, cancelar
                      </Button>
                    </div>
                  )}
                </>
              )}
          </div>

          {/* Derecha: cerrar y guardar */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cerrar
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
