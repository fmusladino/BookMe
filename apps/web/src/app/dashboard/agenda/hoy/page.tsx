"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  parseISO,
  addDays,
  subDays,
  addMinutes,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useAppointments } from "@/hooks/use-appointments";
import { useScheduleConfig } from "@/hooks/use-schedule-config";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarCheck,
  CalendarPlus,
  Video,
  MapPin,
  RefreshCw,
  User,
  Stethoscope,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/types";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CreateAppointmentModal } from "@/components/agenda/create-appointment-modal";

interface TimeSlot {
  time: string;
  appointment: AppointmentWithRelations | null;
}

export default function HoyPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { appointments, loading, fetchAppointments, updateAppointment } = useAppointments();
  const { config: scheduleConfig, workingHours, fetchScheduleConfig } = useScheduleConfig();
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);

  // Modal para crear turno desde slot disponible
  const [createModal, setCreateModal] = useState<{ open: boolean; time?: string }>({ open: false });

  const loadDay = useCallback(
    (date: Date) => {
      fetchAppointments(startOfDay(date).toISOString(), endOfDay(date).toISOString());
    },
    [fetchAppointments]
  );

  useEffect(() => {
    fetchScheduleConfig();
  }, [fetchScheduleConfig]);

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  // Generar los time slots del día
  const timeSlots: TimeSlot[] = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();
    const slotDuration = scheduleConfig?.slot_duration ?? 30;
    const dayWH = workingHours?.filter((wh) => wh.day_of_week === dayOfWeek) ?? [];

    if (dayWH.length === 0 || !scheduleConfig?.working_days.includes(dayOfWeek)) return [];

    if (scheduleConfig?.vacation_mode) {
      const vacFrom = scheduleConfig.vacation_from ? new Date(scheduleConfig.vacation_from) : null;
      const vacUntil = scheduleConfig.vacation_until ? new Date(scheduleConfig.vacation_until) : null;
      const isInVacation =
        (!vacFrom && !vacUntil) ||
        (!vacFrom && vacUntil && selectedDate <= vacUntil) ||
        (vacFrom && !vacUntil && selectedDate >= vacFrom) ||
        (vacFrom && vacUntil && selectedDate >= vacFrom && selectedDate <= vacUntil);
      if (isInVacation) return [];
    }

    const slots: TimeSlot[] = [];
    const dayAppts = [...appointments].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );

    for (const wh of dayWH) {
      const [startH, startM] = wh.start_time.split(":").map(Number);
      const [endH, endM] = wh.end_time.split(":").map(Number);
      let current = new Date(selectedDate);
      current.setHours(startH!, startM!, 0, 0);
      const endTime = new Date(selectedDate);
      endTime.setHours(endH!, endM!, 0, 0);

      const lunchStart = scheduleConfig?.lunch_break_start
        ? (() => { const [h, m] = scheduleConfig.lunch_break_start!.split(":").map(Number); const d = new Date(selectedDate); d.setHours(h!, m!, 0, 0); return d; })()
        : null;
      const lunchEnd = scheduleConfig?.lunch_break_end
        ? (() => { const [h, m] = scheduleConfig.lunch_break_end!.split(":").map(Number); const d = new Date(selectedDate); d.setHours(h!, m!, 0, 0); return d; })()
        : null;

      while (current < endTime) {
        const slotTime = format(current, "HH:mm");
        const isLunch = lunchStart && lunchEnd && current >= lunchStart && current < lunchEnd;

        if (!isLunch) {
          const apt = dayAppts.find((a) => {
            const aptStart = parseISO(a.starts_at);
            return format(aptStart, "HH:mm") === slotTime && isSameDay(aptStart, selectedDate);
          });
          slots.push({ time: slotTime, appointment: apt ?? null });
        }

        current = addMinutes(current, slotDuration);
      }
    }

    return slots;
  }, [selectedDate, scheduleConfig, workingHours, appointments]);

  const occupiedSlots = timeSlots.filter((s) => s.appointment !== null);
  const freeSlots = timeSlots.filter((s) => s.appointment === null);
  const stats = {
    total: timeSlots.length,
    free: freeSlots.length,
    occupied: occupiedSlots.length,
    occupancyPct: timeSlots.length > 0 ? Math.round((occupiedSlots.length / timeSlots.length) * 100) : 0,
  };

  const handleStatusChange = async (apt: AppointmentWithRelations, newStatus: string) => {
    try {
      await updateAppointment(apt.id, { status: newStatus });
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const isWorkDay = timeSlots.length > 0;

  const workingRange = useMemo(() => {
    if (timeSlots.length === 0) return "";
    return `${timeSlots[0]!.time} - ${timeSlots[timeSlots.length - 1]!.time}`;
  }, [timeSlots]);

  return (
    <div className="space-y-4">
      {/* ─── Header con teal HisMe ─── */}
      <div className="rounded-xl bg-gradient-to-r from-teal-600 to-teal-700 dark:from-teal-800 dark:to-teal-900 px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-teal-200 text-[10px] font-bold uppercase tracking-widest">
              Agenda Diaria
            </p>
            <h1 className="text-xl font-bold capitalize">
              {isToday ? "Hoy" : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h1>
            {isWorkDay && workingRange && (
              <p className="text-teal-100 text-xs mt-0.5">
                {workingRange} · Turnos de {scheduleConfig?.slot_duration ?? 30} min
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg bg-white/10 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setSelectedDate((d) => subDays(d, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-sm font-medium min-w-[90px] text-center">
                {format(selectedDate, "dd/MM/yyyy")}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                onClick={() => setSelectedDate((d) => addDays(d, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Button
              size="sm"
              className={cn(
                "h-8 text-xs",
                isToday
                  ? "bg-white text-teal-700 hover:bg-white/90"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              onClick={() => setSelectedDate(new Date())}
            >
              Hoy
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
              onClick={() => loadDay(selectedDate)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Stats bar estilo HisMe ─── */}
      {isWorkDay && (
        <div className="flex items-center gap-3 flex-wrap text-sm">
          <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 rounded-lg px-3 py-1.5 font-medium">
            <CalendarCheck className="h-3.5 w-3.5" />
            <span>{stats.occupied} turnos</span>
          </div>
          <div className="flex items-center gap-2 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 rounded-lg px-3 py-1.5 font-medium">
            <Clock className="h-3.5 w-3.5" />
            <span>{stats.free} libres</span>
          </div>

          {/* Barra de ocupación */}
          <div className="flex items-center gap-2 flex-1 min-w-[150px]">
            <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.occupancyPct}%`,
                  background: stats.occupancyPct > 80
                    ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                    : stats.occupancyPct > 50
                      ? "linear-gradient(90deg, #14b8a6, #f59e0b)"
                      : "linear-gradient(90deg, #06b6d4, #14b8a6)",
                }}
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{stats.occupancyPct}%</span>
          </div>
        </div>
      )}

      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
        </div>
      )}

      {/* ─── Día no laboral ─── */}
      {!loading && !isWorkDay && (
        <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 text-center">
          <CalendarCheck className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">Día no laboral</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            No hay horarios de atención configurados para este día
          </p>
        </div>
      )}

      {/* ─── Grilla de slots HisMe ─── */}
      {/* ─── Modal de crear turno ─── */}
      <CreateAppointmentModal
        open={createModal.open}
        onOpenChange={(open) => setCreateModal({ open })}
        onSuccess={() => loadDay(selectedDate)}
        initialDate={selectedDate}
        initialTime={createModal.time}
      />

      {!loading && isWorkDay && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {timeSlots.map((slot) => {
            const apt = slot.appointment;
            const isExpanded = expandedSlot === slot.time;

            if (!apt) {
              // ─── Slot disponible ─── Teal como HisMe — click abre modal de agendar
              return (
                <div
                  key={slot.time}
                  className="group flex items-center gap-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 px-3.5 py-2.5 transition-all hover:bg-teal-100 dark:hover:bg-teal-950/40 hover:border-teal-400 cursor-pointer"
                  onClick={() => setCreateModal({ open: true, time: slot.time })}
                >
                  <span className="text-sm font-mono font-bold text-teal-700 dark:text-teal-300 w-11">
                    {slot.time}
                  </span>
                  <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                    Disponible
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-[11px] text-transparent group-hover:text-teal-500 transition-colors">
                    <CalendarPlus className="h-3 w-3" />
                    Agendar
                  </span>
                </div>
              );
            }

            // ─── Slot ocupado ─── Colores por estado
            const isCancelled = apt.status === "cancelled";
            const isNoShow = apt.status === "no_show";
            const isCompleted = apt.status === "completed";
            const isPending = apt.status === "pending";

            // Paleta HisMe: naranja/ámbar para turnos ocupados, variantes por estado
            const cardStyles = isCancelled
              ? "border-l-red-400 bg-red-50/60 dark:bg-red-950/15 border-red-200 dark:border-red-800 opacity-60"
              : isNoShow
                ? "border-l-rose-500 bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800"
                : isCompleted
                  ? "border-l-sky-500 bg-sky-50/60 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800"
                  : isPending
                    ? "border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                    : "border-l-teal-500 bg-teal-50/60 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800";

            const statusBadge = isCancelled
              ? { label: "Cancelado", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
              : isNoShow
                ? { label: "Ausente", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" }
                : isCompleted
                  ? { label: "Atendido", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" }
                  : isPending
                    ? { label: "Pendiente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
                    : { label: "Confirmado", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300" };

            return (
              <div
                key={slot.time}
                className={cn(
                  "rounded-lg border border-l-4 overflow-hidden transition-all cursor-pointer hover:shadow-md",
                  cardStyles,
                  isExpanded && "ring-2 ring-teal-400/40"
                )}
                onClick={() => setExpandedSlot(isExpanded ? null : slot.time)}
              >
                <div className="px-3.5 py-2.5">
                  {/* Fila: Hora + Nombre + Badge */}
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-mono font-bold text-foreground/80 w-11 shrink-0">
                      {slot.time}
                    </span>
                    <p className={cn(
                      "font-bold text-sm truncate flex-1 text-foreground",
                      isCancelled && "line-through opacity-60"
                    )}>
                      {apt.patient.full_name.toUpperCase()}
                    </p>
                    <span className={cn("shrink-0 px-2 py-0.5 rounded text-[10px] font-bold", statusBadge.cls)}>
                      {statusBadge.label}
                    </span>
                  </div>

                  {/* Servicio + Modalidad */}
                  <div className="flex items-center gap-2 mt-1 pl-[52px]">
                    {apt.service && (
                      <span className="text-xs text-muted-foreground truncate">
                        {apt.service.name}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground/40">·</span>
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(apt.starts_at), "HH:mm")}–{format(parseISO(apt.ends_at), "HH:mm")}
                    </span>
                    {apt.modality === "virtual" && (
                      <Video className="h-3 w-3 text-blue-500 shrink-0" />
                    )}
                  </div>

                  {/* Teléfono */}
                  {apt.patient.phone && (
                    <div className="flex items-center gap-1 mt-1 pl-[52px]">
                      <Phone className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[11px] text-muted-foreground">{apt.patient.phone}</span>
                    </div>
                  )}
                </div>

                {/* ─── Detalle expandido ─── */}
                {isExpanded && (
                  <div className="border-t border-inherit px-3.5 py-3 bg-white/60 dark:bg-black/10 space-y-2.5">
                    {/* Contacto */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      {apt.patient.phone && (
                        <a
                          href={`tel:${apt.patient.phone}`}
                          className="flex items-center gap-1 text-teal-600 hover:text-teal-800 dark:text-teal-400 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3 w-3" />
                          Llamar
                        </a>
                      )}
                      {apt.patient.email && (
                        <a
                          href={`mailto:${apt.patient.email}`}
                          className="flex items-center gap-1 text-teal-600 hover:text-teal-800 dark:text-teal-400 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="h-3 w-3" />
                          Email
                        </a>
                      )}
                    </div>

                    {apt.notes && (
                      <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900/50 rounded p-2 italic">
                        {apt.notes}
                      </p>
                    )}

                    {/* Acciones rápidas */}
                    {apt.status !== "cancelled" && apt.status !== "completed" && (
                      <div className="flex flex-wrap gap-1.5">
                        {/* Botón ATENDER — abre Historia Clínica del paciente */}
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-teal-600 hover:bg-teal-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/pacientes/${apt.patient.id}/historia-clinica`);
                          }}
                        >
                          <Stethoscope className="mr-1 h-3 w-3" />
                          Atender
                        </Button>
                        {apt.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-teal-300 text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:text-teal-300 dark:hover:bg-teal-950/30"
                            onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, "confirmed"); }}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Confirmar
                          </Button>
                        )}
                        {(apt.status === "pending" || apt.status === "confirmed") && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, "no_show"); }}
                            >
                              Ausente
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(apt, "cancelled"); }}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
