"use client";

import { useState, useEffect } from "react";
import { format, addMinutes, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, AlertCircle } from "lucide-react";
import type { Patient, Service } from "@/types";

interface CreateAppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialDate?: Date;
  initialTime?: string;
}

export function CreateAppointmentModal({
  open,
  onOpenChange,
  onSuccess,
  initialDate,
  initialTime,
}: CreateAppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [searchingServices, setSearchingServices] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  // Formulario
  const [formData, setFormData] = useState({
    patientId: "",
    serviceId: "",
    date: "",
    startTime: "",
    endTime: "",
    notes: "",
  });

  // Inicializar fecha y hora cuando cambia el modal
  useEffect(() => {
    if (open && initialDate && initialTime) {
      const dateStr = format(initialDate, "yyyy-MM-dd");
      const timeStr = initialTime; // formato HH:00
      setFormData((prev) => ({
        ...prev,
        date: dateStr,
        startTime: timeStr,
      }));
    }
  }, [open, initialDate, initialTime]);

  // Auto-calcular hora de fin basado en la duración del servicio
  useEffect(() => {
    if (formData.serviceId && formData.startTime) {
      const selectedService = services.find((s) => s.id === formData.serviceId);
      if (selectedService && selectedService.duration_minutes) {
        const [hours, minutes] = formData.startTime.split(":").map(Number);
        const startDate = new Date();
        startDate.setHours(hours, minutes, 0, 0);
        const endDate = addMinutes(startDate, selectedService.duration_minutes);
        const endTime = format(endDate, "HH:mm");
        setFormData((prev) => ({ ...prev, endTime }));
      }
    }
  }, [formData.serviceId, formData.startTime, services]);

  // Cargar pacientes al abrir el modal
  useEffect(() => {
    if (open) {
      fetchPatients();
      fetchServices();
    }
  }, [open]);

  const fetchPatients = async () => {
    try {
      setSearchingPatients(true);
      const res = await fetch("/api/patients");
      if (!res.ok) throw new Error("Error al cargar pacientes");
      const data = (await res.json()) as { patients: Patient[] };
      setPatients(data.patients ?? []);
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
      toast.error("No se pudieron cargar los pacientes");
    } finally {
      setSearchingPatients(false);
    }
  };

  const fetchServices = async () => {
    try {
      setSearchingServices(true);
      const res = await fetch("/api/services");
      if (!res.ok) throw new Error("Error al cargar servicios");
      const data = (await res.json()) as { services: Service[] };
      setServices(data.services ?? []);
    } catch (error) {
      console.error("Error al cargar servicios:", error);
      toast.error("No se pudieron cargar los servicios");
    } finally {
      setSearchingServices(false);
    }
  };

  const filteredPatients = patients.filter((p) =>
    p.full_name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.email?.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.phone?.includes(patientSearch)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validar campos requeridos
    if (!formData.patientId) {
      toast.error("Selecciona un paciente");
      return;
    }
    if (!formData.serviceId) {
      toast.error("Selecciona un servicio");
      return;
    }
    if (!formData.date || !formData.startTime) {
      toast.error("Selecciona fecha y hora");
      return;
    }

    // Construir datetimes ISO preservando la hora local
    // Usamos el offset de Argentina (-03:00) para que el backend reciba
    // la hora correcta y no se desplace por conversión UTC automática
    const startsAt = `${formData.date}T${formData.startTime}:00-03:00`;
    const endsAt = `${formData.date}T${formData.endTime}:00-03:00`;

    try {
      setLoading(true);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: formData.patientId,
          service_id: formData.serviceId,
          starts_at: startsAt,
          ends_at: endsAt,
          notes: formData.notes || null,
          status: "pending",
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string; message?: string };
        throw new Error(body.error || body.message || "Error al crear turno");
      }

      toast.success("Turno creado correctamente");
      onOpenChange(false);
      onSuccess();

      // Resetear formulario
      setFormData({
        patientId: "",
        serviceId: "",
        date: "",
        startTime: "",
        endTime: "",
        notes: "",
      });
    } catch (error) {
      console.error("Error al crear turno:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear turno");
    } finally {
      setLoading(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === formData.patientId);
  const selectedService = services.find((s) => s.id === formData.serviceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" />
            Crear nuevo turno
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Fila 1: Paciente y Servicio en 2 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Paciente */}
          <div className="space-y-2">
            <Label htmlFor="patient">Paciente *</Label>
            {selectedPatient ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 py-2">
                <span className="text-sm">{selectedPatient.full_name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({ ...prev, patientId: "" }));
                    setPatientSearch("");
                    setShowPatientSearch(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Buscar paciente por nombre, email o teléfono..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    onFocus={() => setShowPatientSearch(true)}
                    className="pl-10"
                  />
                </div>
                {showPatientSearch && filteredPatients.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-background shadow-md z-50 max-h-48 overflow-y-auto">
                    {filteredPatients.map((patient) => (
                      <button
                        key={patient.id}
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, patientId: patient.id }));
                          setShowPatientSearch(false);
                          setPatientSearch("");
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b last:border-0"
                      >
                        <p className="font-medium">{patient.full_name}</p>
                        {patient.email && <p className="text-xs text-muted-foreground">{patient.email}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {showPatientSearch && patientSearch && filteredPatients.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-background shadow-md z-50 p-3 text-sm text-muted-foreground">
                    No se encontraron pacientes
                  </div>
                )}
              </div>
            )}
            {searchingPatients && (
              <p className="text-xs text-muted-foreground">Cargando pacientes...</p>
            )}
          </div>

          {/* Servicio */}
          <div className="space-y-2">
            <Label htmlFor="service">Servicio *</Label>
            <Select
              id="service"
              value={formData.serviceId}
              onChange={(e) => setFormData((prev) => ({ ...prev, serviceId: e.target.value }))}
              disabled={searchingServices}
            >
              <option value="">
                {searchingServices ? "Cargando servicios..." : "Seleccionar servicio"}
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {service.duration_minutes ? ` (${service.duration_minutes} min)` : ""}
                </option>
              ))}
            </Select>
            {selectedService && selectedService.price && (
              <p className="text-xs text-muted-foreground">
                Precio: ${selectedService.price}
              </p>
            )}
          </div>
          </div>

          {/* Fila 2: Fecha y Horarios en 3 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Fecha */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>

          {/* Hora de inicio */}
          <div className="space-y-2">
            <Label htmlFor="startTime">Hora de inicio *</Label>
            <Input
              id="startTime"
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData((prev) => ({ ...prev, startTime: e.target.value }))}
            />
          </div>

          {/* Hora de fin */}
          <div className="space-y-2">
            <Label htmlFor="endTime">Hora de fin</Label>
            <Input
              id="endTime"
              type="time"
              value={formData.endTime}
              disabled
              className="bg-muted"
            />
            {formData.endTime && (
              <p className="text-xs text-muted-foreground">
                Auto-calculada
              </p>
            )}
          </div>
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales sobre el turno..."
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Validación */}
          {!formData.endTime && formData.serviceId && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
              <p className="text-xs text-amber-700 dark:text-amber-200">
                Selecciona la hora de inicio para calcular la hora de fin
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.endTime}>
              {loading ? "Creando..." : "Crear turno"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
