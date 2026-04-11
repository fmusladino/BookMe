"use client";

import { useState, useEffect, useRef } from "react";
import { format, addMinutes, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, isBefore, startOfDay, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, AlertCircle, Video, MapPin, ExternalLink, UserPlus, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Calendar, ClipboardList, DollarSign, Shield } from "lucide-react";
import type { Patient, Service } from "@/types";
import { useScheduleConfig } from "@/hooks/use-schedule-config";
import { useSession } from "@/hooks/use-session";

interface Prestacion {
  id: string;
  insurance_id: string;
  code: string;
  description: string;
  amount: number;
  valid_from: string;
  valid_until: string | null;
  is_active: boolean;
  insurance: { id: string; name: string } | null;
}

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
  const { config: scheduleConfig, fetchScheduleConfig } = useScheduleConfig();
  const { user } = useSession();
  const isHealthcare = user?.professional?.line === "healthcare";
  const [loading, setLoading] = useState(false);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [searchingServices, setSearchingServices] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [prestaciones, setPrestaciones] = useState<Prestacion[]>([]);
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");

  const [defaultMeetUrl, setDefaultMeetUrl] = useState("");

  // Obras sociales del profesional
  const [profInsurances, setProfInsurances] = useState<Array<{ id: string; name: string; code: string | null }>>([]);

  // Estado para el date picker custom
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date());
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Estado para crear nuevo paciente inline
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);
  const [newPatientForm, setNewPatientForm] = useState({
    full_name: "",
    dni: "",
    phone: "",
    email: "",
    insurance_id: "",
    insurance_number: "",
  });

  // Formulario
  const [formData, setFormData] = useState({
    patientId: "",
    serviceId: "",
    prestacionId: "",
    date: "",
    startTime: "",
    endTime: "",
    notes: "",
    modality: "presencial" as "presencial" | "virtual",
  });

  // Inicializar fecha y hora cuando cambia el modal
  useEffect(() => {
    if (open && initialDate) {
      const dateStr = format(initialDate, "yyyy-MM-dd");
      setFormData((prev) => ({
        ...prev,
        date: dateStr,
        startTime: initialTime ?? prev.startTime,
      }));
    }
  }, [open, initialDate, initialTime]);

  // Auto-calcular hora de fin y modalidad basado en el servicio
  useEffect(() => {
    if (formData.serviceId) {
      const selectedService = services.find((s) => s.id === formData.serviceId);
      if (selectedService) {
        // Auto-set modality del servicio (si es "both", dejar la actual)
        if ((selectedService as any).modality === "presencial" || (selectedService as any).modality === "virtual") {
          setFormData((prev) => ({ ...prev, modality: (selectedService as any).modality }));
        }
        // Auto-calcular hora de fin
        if (formData.startTime && selectedService.duration_minutes) {
          const [hours, minutes] = formData.startTime.split(":").map(Number);
          const startDate = new Date();
          startDate.setHours(hours, minutes, 0, 0);
          const endDate = addMinutes(startDate, selectedService.duration_minutes);
          const endTime = format(endDate, "HH:mm");
          setFormData((prev) => ({ ...prev, endTime }));
        }
      }
    }
  }, [formData.serviceId, formData.startTime, services]);

  // Fetch prestaciones (solo healthcare)
  const fetchPrestaciones = async () => {
    if (!isHealthcare) return;
    try {
      const res = await fetch("/api/prestaciones?active=true");
      if (res.ok) {
        const data = (await res.json()) as { prestaciones: Prestacion[] };
        setPrestaciones(data.prestaciones ?? []);
      }
    } catch (err) {
      console.error("Error fetching prestaciones:", err);
    }
  };

  // Prestaciones filtradas por la OS del paciente seleccionado
  const selectedPatient = patients.find((p) => p.id === formData.patientId);
  const patientInsuranceId = selectedPatient?.insurance_id;
  const filteredPrestaciones = prestaciones.filter((p) => {
    if (!patientInsuranceId) return true; // mostrar todas si paciente no tiene OS
    return p.insurance_id === patientInsuranceId;
  });

  const selectedPrestacion = prestaciones.find((p) => p.id === formData.prestacionId);

  // Cargar pacientes, servicios y meet URL al abrir el modal
  useEffect(() => {
    if (open) {
      fetchPatients();
      fetchServices();
      fetchPrestaciones();
      fetchScheduleConfig();
      // Cargar meet URL del profesional
      fetch("/api/professionals/me/visibility")
        .then((r) => r.json())
        .then((data: { default_meet_url?: string | null }) => {
          if (data.default_meet_url) setDefaultMeetUrl(data.default_meet_url);
        })
        .catch(() => {});
      // Cargar obras sociales del profesional
      if (isHealthcare) {
        fetch("/api/professionals/me/insurances")
          .then((r) => r.json())
          .then((data: { insurances: Array<{ id: string; name: string; code: string | null }> }) => {
            setProfInsurances(data.insurances ?? []);
          })
          .catch(() => {});
      }
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

  // Días laborales del profesional (0=Dom, 1=Lun, ..., 6=Sáb)
  const workingDays = scheduleConfig?.working_days ?? [1, 2, 3, 4, 5]; // default lun-vie

  const isWorkingDay = (date: Date): boolean => {
    const dayOfWeek = date.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
    return workingDays.includes(dayOfWeek);
  };

  const isDateDisabled = (date: Date): boolean => {
    const today = startOfDay(new Date());
    // No permitir fechas pasadas ni días no laborales
    if (isBefore(date, today)) return true;
    // Modo vacaciones activo (desde/hasta)
    if (scheduleConfig?.vacation_mode) {
      const vacFrom = scheduleConfig.vacation_from ? new Date(scheduleConfig.vacation_from) : null;
      const vacUntil = scheduleConfig.vacation_until ? new Date(scheduleConfig.vacation_until) : null;
      const isInVacation =
        (!vacFrom && !vacUntil) ||
        (!vacFrom && vacUntil && (isBefore(date, vacUntil) || isSameDay(date, vacUntil))) ||
        (vacFrom && !vacUntil && (isBefore(vacFrom, date) || isSameDay(date, vacFrom))) ||
        (vacFrom && vacUntil && (isBefore(vacFrom, date) || isSameDay(date, vacFrom)) && (isBefore(date, vacUntil) || isSameDay(date, vacUntil)));
      if (isInVacation) return true;
    }
    return !isWorkingDay(date);
  };

  // Cerrar date picker al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDatePicker]);

  // Generar días del mes para el calendario
  const generateCalendarDays = (month: Date) => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); // Lunes
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  };

  const handleCreatePatient = async () => {
    if (!newPatientForm.full_name || !newPatientForm.dni) {
      toast.error("Nombre y DNI son obligatorios");
      return;
    }

    setSavingPatient(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: newPatientForm.full_name,
          dni: newPatientForm.dni,
          phone: newPatientForm.phone || null,
          email: newPatientForm.email || null,
          insurance_id: newPatientForm.insurance_id || null,
          insurance_number: newPatientForm.insurance_number || null,
          is_particular: !newPatientForm.insurance_id,
        }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Error al crear paciente");
      }

      const data = (await res.json()) as { patient: Patient };
      toast.success("Paciente creado correctamente");

      // Agregar el nuevo paciente a la lista y seleccionarlo
      setPatients((prev) => [data.patient, ...prev]);
      setFormData((prev) => ({ ...prev, patientId: data.patient.id }));

      // Limpiar y cerrar el formulario de nuevo paciente
      setNewPatientForm({ full_name: "", dni: "", phone: "", email: "", insurance_id: "", insurance_number: "" });
      setShowNewPatientForm(false);
      setShowPatientSearch(false);
      setPatientSearch("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear paciente");
    } finally {
      setSavingPatient(false);
    }
  };

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
          prestacion_id: formData.prestacionId || null,
          starts_at: startsAt,
          ends_at: endsAt,
          notes: formData.notes || null,
          status: "pending",
          modality: formData.modality,
          meet_url: formData.modality === "virtual" ? defaultMeetUrl || null : null,
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
        prestacionId: "",
        date: "",
        startTime: "",
        endTime: "",
        notes: "",
        modality: "presencial",
      });
      setShowNewPatientForm(false);
      setNewPatientForm({ full_name: "", dni: "", phone: "", email: "", insurance_id: "", insurance_number: "" });
    } catch (error) {
      console.error("Error al crear turno:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear turno");
    } finally {
      setLoading(false);
    }
  };

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
            {showNewPatientForm ? (
              /* ---- Formulario inline de nuevo paciente ---- */
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-primary">
                    <UserPlus className="h-4 w-4" />
                    Nuevo paciente
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowNewPatientForm(false)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Volver a buscar
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Nombre completo *"
                    value={newPatientForm.full_name}
                    onChange={(e) => setNewPatientForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  />
                  <Input
                    placeholder="DNI *"
                    value={newPatientForm.dni}
                    onChange={(e) => setNewPatientForm((prev) => ({ ...prev, dni: e.target.value }))}
                  />
                  <Input
                    placeholder="Teléfono"
                    type="tel"
                    value={newPatientForm.phone}
                    onChange={(e) => setNewPatientForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newPatientForm.email}
                    onChange={(e) => setNewPatientForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>

                {/* Obra social del paciente */}
                {isHealthcare && (
                  <div className="space-y-2 pt-1 border-t border-border/50">
                    <Label className="flex items-center gap-1.5 text-xs font-medium">
                      <Shield className="h-3.5 w-3.5 text-emerald-500" />
                      Obra Social / Prepaga
                    </Label>
                    {profInsurances.length > 0 ? (
                      <>
                        <select
                          value={newPatientForm.insurance_id}
                          onChange={(e) => setNewPatientForm((prev) => ({ ...prev, insurance_id: e.target.value }))}
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="">Particular (sin obra social)</option>
                          {profInsurances.map((ins) => (
                            <option key={ins.id} value={ins.id}>
                              {ins.name}
                            </option>
                          ))}
                        </select>
                        {newPatientForm.insurance_id && (
                          <Input
                            placeholder="N° de afiliado / plan *"
                            value={newPatientForm.insurance_number}
                            onChange={(e) => setNewPatientForm((prev) => ({ ...prev, insurance_number: e.target.value }))}
                          />
                        )}
                      </>
                    ) : (
                      <div className="rounded-md border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 p-2">
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          No tenés obras sociales cargadas.{" "}
                          <a href="/dashboard/configuracion" className="underline font-medium hover:text-amber-800 dark:hover:text-amber-300">
                            Agregalas en Configuración
                          </a>{" "}
                          primero.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreatePatient}
                  disabled={savingPatient || !newPatientForm.full_name || !newPatientForm.dni}
                  className="w-full"
                >
                  {savingPatient ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Crear y seleccionar paciente
                    </>
                  )}
                </Button>
              </div>
            ) : selectedPatient ? (
              <div className="rounded-md border border-input bg-muted/30 px-3 py-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{selectedPatient.full_name}</span>
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
                {selectedPatient.insurance_id ? (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {profInsurances.find((i) => i.id === selectedPatient.insurance_id)?.name || "Obra social"}
                    {selectedPatient.insurance_number && ` — N° ${selectedPatient.insurance_number}`}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Particular</p>
                )}
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
                    {/* Botón de nuevo paciente al final de la lista */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewPatientForm(true);
                        setShowPatientSearch(false);
                        // Pre-llenar el nombre si estaba buscando
                        if (patientSearch) {
                          setNewPatientForm((prev) => ({ ...prev, full_name: patientSearch }));
                        }
                        setPatientSearch("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 border-t"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="font-medium">Agregar nuevo paciente</span>
                    </button>
                  </div>
                )}
                {showPatientSearch && patientSearch && filteredPatients.length === 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 rounded-md border bg-background shadow-md z-50">
                    <div className="p-3 text-sm text-muted-foreground">
                      No se encontraron pacientes
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewPatientForm(true);
                        setShowPatientSearch(false);
                        setNewPatientForm((prev) => ({ ...prev, full_name: patientSearch }));
                        setPatientSearch("");
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-primary/10 text-primary transition-colors flex items-center gap-2 border-t"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="font-medium">Crear &quot;{patientSearch}&quot; como nuevo paciente</span>
                    </button>
                  </div>
                )}
                {/* Botón siempre visible debajo del buscador */}
                {!showPatientSearch && (
                  <button
                    type="button"
                    onClick={() => setShowNewPatientForm(true)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Agregar nuevo paciente
                  </button>
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

          {/* Prestación (solo Healthcare) */}
          {isHealthcare && (
            <div className="space-y-2">
              <Label htmlFor="prestacion" className="flex items-center gap-1.5">
                <ClipboardList className="h-3.5 w-3.5 text-muted-foreground" />
                Prestación
                <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Select
                id="prestacion"
                value={formData.prestacionId}
                onChange={(e) => setFormData((prev) => ({ ...prev, prestacionId: e.target.value }))}
              >
                <option value="">Sin prestación</option>
                {filteredPrestaciones.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.code}] {p.description} — ${Number(p.amount).toLocaleString("es-AR")}
                    {p.insurance?.name ? ` (${p.insurance.name})` : ""}
                  </option>
                ))}
              </Select>
              {selectedPrestacion && (
                <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 px-3 py-2">
                  <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-xs text-green-700 dark:text-green-300 font-medium">
                    Valor prestación: ${Number(selectedPrestacion.amount).toLocaleString("es-AR")}
                    {selectedPrestacion.insurance?.name && (
                      <span className="font-normal ml-1">({selectedPrestacion.insurance.name})</span>
                    )}
                  </span>
                </div>
              )}
              {formData.patientId && patientInsuranceId && filteredPrestaciones.length === 0 && (
                <p className="text-xs text-amber-600">
                  No hay prestaciones cargadas para la obra social de este paciente
                </p>
              )}
            </div>
          )}

          {/* Modalidad */}
          <div className="space-y-2">
            <Label>Modalidad</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, modality: "presencial" }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  formData.modality === "presencial"
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:bg-accent"
                }`}
              >
                <MapPin className="h-4 w-4" />
                Presencial
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, modality: "virtual" }))}
                className={`flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                  formData.modality === "virtual"
                    ? "border-blue-500 bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-600"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Video className="h-4 w-4" />
                Virtual (Meet)
              </button>
            </div>
            {formData.modality === "virtual" && defaultMeetUrl && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <Video className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1">{defaultMeetUrl}</span>
                <a href={defaultMeetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {formData.modality === "virtual" && !defaultMeetUrl && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-500" />
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  No tenés un link de Meet configurado. Podés configurarlo en Configuración.
                </p>
              </div>
            )}
          </div>

          {/* Fila 2: Fecha y Horarios en 3 columnas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Fecha — Date picker custom con validación de días laborales */}
          <div className="space-y-2">
            <Label htmlFor="date">Fecha *</Label>
            <div className="relative" ref={datePickerRef}>
              <button
                type="button"
                onClick={() => {
                  setShowDatePicker(!showDatePicker);
                  if (formData.date) {
                    setDatePickerMonth(new Date(formData.date + "T12:00:00"));
                  }
                }}
                className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className={formData.date ? "text-foreground" : "text-muted-foreground"}>
                  {formData.date
                    ? format(new Date(formData.date + "T12:00:00"), "dd/MM/yyyy")
                    : "Seleccionar fecha"}
                </span>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </button>

              {showDatePicker && (
                <div className="absolute top-full left-0 mt-1 rounded-md border bg-background shadow-lg z-50 p-3 w-[280px]">
                  {/* Header del mes */}
                  <div className="flex items-center justify-between mb-2">
                    <button
                      type="button"
                      onClick={() => setDatePickerMonth(subMonths(datePickerMonth, 1))}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-sm font-medium capitalize">
                      {format(datePickerMonth, "MMMM yyyy", { locale: es })}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDatePickerMonth(addMonths(datePickerMonth, 1))}
                      className="p-1 rounded hover:bg-accent"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Días de la semana */}
                  <div className="grid grid-cols-7 gap-0 mb-1">
                    {["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"].map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Días del calendario */}
                  <div className="grid grid-cols-7 gap-0">
                    {generateCalendarDays(datePickerMonth).map((day, i) => {
                      const disabled = isDateDisabled(day);
                      const isCurrentMonth = isSameMonth(day, datePickerMonth);
                      const isSelected = formData.date && isSameDay(day, new Date(formData.date + "T12:00:00"));
                      const isToday = isSameDay(day, new Date());

                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={disabled || !isCurrentMonth}
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, date: format(day, "yyyy-MM-dd") }));
                            setShowDatePicker(false);
                          }}
                          className={`
                            h-8 w-full rounded text-sm transition-colors
                            ${!isCurrentMonth ? "text-transparent pointer-events-none" : ""}
                            ${isCurrentMonth && disabled ? "text-muted-foreground/30 cursor-not-allowed line-through" : ""}
                            ${isCurrentMonth && !disabled ? "hover:bg-accent cursor-pointer" : ""}
                            ${isSelected ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold" : ""}
                            ${isToday && !isSelected && isCurrentMonth ? "border border-primary text-primary font-medium" : ""}
                          `}
                        >
                          {isCurrentMonth ? format(day, "d") : ""}
                        </button>
                      );
                    })}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, date: "" }));
                        setShowDatePicker(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Borrar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const today = new Date();
                        if (!isDateDisabled(today)) {
                          setFormData((prev) => ({ ...prev, date: format(today, "yyyy-MM-dd") }));
                          setShowDatePicker(false);
                        } else {
                          toast.error("Hoy no es un día laborable");
                        }
                      }}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Hoy
                    </button>
                  </div>
                </div>
              )}
            </div>
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
