"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  X,
  Save,
} from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  professional_id: string;
  professional: {
    id: string;
    specialty: string;
    profile: { full_name: string } | null;
  } | null;
  patient: { full_name: string; phone: string | null } | null;
  service: { name: string } | null;
}

interface ProfessionalOption {
  id: string;
  full_name: string;
  specialty: string;
}

export default function ClinicaAgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [professionals, setProfessionals] = useState<ProfessionalOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]!
  );
  const [selectedProfId, setSelectedProfId] = useState<string>("all");
  const [showNewModal, setShowNewModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newApt, setNewApt] = useState({
    professional_id: "",
    patient_name: "",
    patient_dni: "",
    patient_phone: "",
    patient_email: "",
    date: new Date().toISOString().split("T")[0]!,
    start_time: "09:00",
    end_time: "09:30",
    notes: "",
  });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ date: selectedDate });
      if (selectedProfId !== "all") {
        params.set("professional_id", selectedProfId);
      }
      const res = await fetch(`/api/clinic/appointments?${params}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setAppointments(data.appointments ?? []);
      if (data.professionals) {
        setProfessionals(data.professionals);
      }
    } catch (err) {
      console.error("Error:", err);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedProfId]);

  useEffect(() => {
    void fetchAppointments();
  }, [fetchAppointments]);

  // Abrir modal de nuevo turno
  const openNewApt = () => {
    setNewApt({
      professional_id: selectedProfId !== "all" ? selectedProfId : (professionals[0]?.id ?? ""),
      patient_name: "",
      patient_dni: "",
      patient_phone: "",
      patient_email: "",
      date: selectedDate,
      start_time: "09:00",
      end_time: "09:30",
      notes: "",
    });
    setShowNewModal(true);
  };

  const handleCreateApt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApt.professional_id || !newApt.patient_name || !newApt.patient_dni || !newApt.date || !newApt.start_time || !newApt.end_time) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clinic/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApt),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear turno");
      }
      toast.success("Turno creado exitosamente");
      setShowNewModal(false);
      void fetchAppointments();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  // Navegación de fechas
  const changeDate = (days: number) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]!);
  };

  const goToday = () => {
    setSelectedDate(new Date().toISOString().split("T")[0]!);
  };

  const isToday = selectedDate === new Date().toISOString().split("T")[0];

  // Formateo
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("es-AR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const statusColors: Record<string, string> = {
    confirmed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    no_show: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  };

  const statusLabels: Record<string, string> = {
    confirmed: "Confirmado",
    pending: "Pendiente",
    cancelled: "Cancelado",
    completed: "Completado",
    no_show: "No asistió",
  };

  // Agrupar turnos por profesional
  const grouped = new Map<string, { prof: ProfessionalOption; apts: Appointment[] }>();
  appointments.forEach((apt) => {
    const profId = apt.professional_id;
    if (!grouped.has(profId)) {
      const profName = apt.professional?.profile?.full_name ?? "Profesional";
      const profSpec = apt.professional?.specialty ?? "";
      grouped.set(profId, {
        prof: { id: profId, full_name: profName, specialty: profSpec },
        apts: [],
      });
    }
    grouped.get(profId)!.apts.push(apt);
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Agenda del consultorio
          </h1>
          <p className="text-sm text-muted-foreground">
            Turnos de todos los profesionales
          </p>
        </div>
        <button
          onClick={openNewApt}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Nuevo turno
        </button>
      </div>

      {/* Controles: navegación de fecha + filtro profesional */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Navegación de fechas */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="rounded-md border border-input p-2 hover:bg-muted transition-colors"
            title="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {!isToday && (
              <button
                onClick={goToday}
                className="rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Hoy
              </button>
            )}
          </div>

          <button
            onClick={() => changeDate(1)}
            className="rounded-md border border-input p-2 hover:bg-muted transition-colors"
            title="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Filtro por profesional */}
        {professionals.length > 1 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedProfId}
              onChange={(e) => setSelectedProfId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[200px]"
            >
              <option value="all">Todos los profesionales</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} — {p.specialty}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Fecha actual */}
      <p className="text-sm font-medium text-muted-foreground capitalize">
        {formatDateLabel(selectedDate)}
        {isToday && (
          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-semibold">
            Hoy
          </span>
        )}
      </p>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            No hay turnos para esta fecha
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Usá las flechas o el calendario para ver otros días
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Si hay un solo profesional filtrado, no agrupar */}
          {selectedProfId !== "all" ? (
            <div className="grid gap-2">
              {appointments.map((apt) => (
                <AppointmentCard
                  key={apt.id}
                  apt={apt}
                  showProfessional={false}
                  statusColors={statusColors}
                  statusLabels={statusLabels}
                  formatTime={formatTime}
                />
              ))}
            </div>
          ) : (
            /* Agrupado por profesional */
            Array.from(grouped.values()).map(({ prof, apts }) => (
              <div key={prof.id} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {prof.full_name}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {prof.specialty} · {apts.length} turno{apts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid gap-2 pl-6">
                  {apts.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      apt={apt}
                      showProfessional={false}
                      statusColors={statusColors}
                      statusLabels={statusLabels}
                      formatTime={formatTime}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Resumen */}
          <div className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{appointments.length}</strong> turno{appointments.length !== 1 ? "s" : ""} en total
            </span>
            <span>·</span>
            <span>
              <strong className="text-foreground">
                {appointments.filter((a) => a.status === "confirmed" || a.status === "pending").length}
              </strong>{" "}
              activos
            </span>
            <span>·</span>
            <span>
              <strong className="text-foreground">
                {appointments.filter((a) => a.status === "cancelled" || a.status === "no_show").length}
              </strong>{" "}
              cancelados/ausentes
            </span>
          </div>
        </div>
      )}

      {/* ─── Modal: Nuevo turno ─────────────────────────────── */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Nuevo turno</h2>
              <button
                onClick={() => setShowNewModal(false)}
                className="rounded-md p-1 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateApt} className="space-y-4 px-6 py-5">
              {/* Profesional */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Profesional <span className="text-red-500">*</span>
                </label>
                <select
                  value={newApt.professional_id}
                  onChange={(e) => setNewApt({ ...newApt, professional_id: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                >
                  <option value="">Seleccionar profesional</option>
                  {professionals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} — {p.specialty}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paciente: Nombre + DNI */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Nombre del paciente <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newApt.patient_name}
                    onChange={(e) => setNewApt({ ...newApt, patient_name: e.target.value })}
                    placeholder="Juan Pérez"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    DNI <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newApt.patient_dni}
                    onChange={(e) => setNewApt({ ...newApt, patient_dni: e.target.value })}
                    placeholder="12345678"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              {/* Teléfono + Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    value={newApt.patient_phone}
                    onChange={(e) => setNewApt({ ...newApt, patient_phone: e.target.value })}
                    placeholder="+54 9 11 1234-5678"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newApt.patient_email}
                    onChange={(e) => setNewApt({ ...newApt, patient_email: e.target.value })}
                    placeholder="paciente@email.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Fecha */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Fecha <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newApt.date}
                  onChange={(e) => setNewApt({ ...newApt, date: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>

              {/* Hora inicio + Hora fin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Hora inicio <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newApt.start_time}
                    onChange={(e) => setNewApt({ ...newApt, start_time: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-foreground">
                    Hora fin <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={newApt.end_time}
                    onChange={(e) => setNewApt({ ...newApt, end_time: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    required
                  />
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">
                  Notas
                </label>
                <textarea
                  value={newApt.notes}
                  onChange={(e) => setNewApt({ ...newApt, notes: e.target.value })}
                  placeholder="Observaciones del turno..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Crear turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente de tarjeta de turno ──────────────────────────

function AppointmentCard({
  apt,
  showProfessional,
  statusColors,
  statusLabels,
  formatTime,
}: {
  apt: Appointment;
  showProfessional: boolean;
  statusColors: Record<string, string>;
  statusLabels: Record<string, string>;
  formatTime: (iso: string) => string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        {/* Horario */}
        <div className="text-center min-w-[55px]">
          <p className="text-sm font-semibold text-foreground">
            {formatTime(apt.starts_at)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatTime(apt.ends_at)}
          </p>
        </div>

        <div className="h-8 w-px bg-border" />

        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">
              {apt.patient?.full_name ?? "Paciente"}
            </p>
            {apt.patient?.phone && (
              <span className="text-xs text-muted-foreground">{apt.patient.phone}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {showProfessional && apt.professional && (
              <span className="flex items-center gap-1">
                <Stethoscope className="h-3 w-3" />
                {apt.professional.profile?.full_name}
              </span>
            )}
            {apt.service && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {apt.service.name}
              </span>
            )}
            {apt.notes && (
              <span className="italic truncate max-w-[200px]">{apt.notes}</span>
            )}
          </div>
        </div>
      </div>

      <span
        className={`rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
          statusColors[apt.status] ?? "bg-gray-100 text-gray-700"
        }`}
      >
        {statusLabels[apt.status] ?? apt.status}
      </span>
    </div>
  );
}
