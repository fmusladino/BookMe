"use client";

import { useMemo, useRef, useCallback, memo } from "react";
import { format, addMinutes, isSameDay, parseISO, differenceInMinutes, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AppointmentWithRelations, ScheduleBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import type { WorkingHour, ScheduleConfig } from "@/hooks/use-schedule-config";
import { Clock, User, Phone, Video, MapPin, AlertCircle, XCircle } from "lucide-react";

// Constantes de grilla
const HOUR_START = 7;
const HOUR_END = 22;
const SLOT_HEIGHT = 60; // px por hora
const TOTAL_HOURS = HOUR_END - HOUR_START;

// ─── Estilos de turno por estado ─── inspirados en HisMe
// Turnos activos: fondo verde/teal oscuro con borde izquierdo grueso
// Cancelados: rojo, No se presentó: naranja/amber
const STATUS_STYLES: Record<string, { card: string; border: string; badge: string; badgeText: string }> = {
  pending: {
    card: "bg-teal-50 dark:bg-teal-900/30",
    border: "border-l-4 border-l-teal-500 border border-teal-200 dark:border-teal-700",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    badgeText: "Pendiente",
  },
  confirmed: {
    card: "bg-emerald-50 dark:bg-emerald-900/30",
    border: "border-l-4 border-l-emerald-500 border border-emerald-200 dark:border-emerald-700",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    badgeText: "Confirmado",
  },
  completed: {
    card: "bg-sky-50 dark:bg-sky-900/20",
    border: "border-l-4 border-l-sky-500 border border-sky-200 dark:border-sky-700",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
    badgeText: "Completado",
  },
  cancelled: {
    card: "bg-red-50/80 dark:bg-red-900/20",
    border: "border-l-4 border-l-red-400 border border-red-200 dark:border-red-800",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
    badgeText: "Cancelado",
  },
  no_show: {
    card: "bg-rose-50 dark:bg-rose-900/20",
    border: "border-l-4 border-l-rose-500 border border-rose-200 dark:border-rose-800",
    badge: "bg-rose-200 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
    badgeText: "No se presentó",
  },
};

interface WeekViewProps {
  weekDays: Date[];
  appointments: AppointmentWithRelations[];
  blocks: ScheduleBlock[];
  scheduleConfig?: ScheduleConfig | null;
  workingHours?: WorkingHour[];
  onAppointmentClick: (appointment: AppointmentWithRelations) => void;
  onSlotClick: (date: Date, time: string) => void;
  onAppointmentDrop: (appointmentId: string, newStartsAt: string, newEndsAt: string) => void;
  onEmptySlotClick?: (date: Date) => void;
}

// memo() evita re-renders innecesarios cuando el padre cambia estado no relacionado
export const WeekView = memo(function WeekView({
  weekDays,
  appointments,
  blocks,
  scheduleConfig,
  workingHours,
  onAppointmentClick,
  onSlotClick,
  onAppointmentDrop,
  onEmptySlotClick,
}: WeekViewProps) {
  const dragRef = useRef<{ appointmentId: string; durationMin: number } | null>(null);

  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i),
    []
  );

  // Calcular disponibilidad por dia y hora
  const availabilityByDay = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!scheduleConfig || !workingHours || workingHours.length === 0) return map;

    for (const day of weekDays) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayOfWeek = getDay(day);

      if (!scheduleConfig.working_days.includes(dayOfWeek)) {
        map.set(dayKey, new Set());
        continue;
      }

      if (scheduleConfig.vacation_mode) {
        const vacFrom = scheduleConfig.vacation_from ? new Date(scheduleConfig.vacation_from) : null;
        const vacUntil = scheduleConfig.vacation_until ? new Date(scheduleConfig.vacation_until) : null;
        const isInVacation =
          (!vacFrom && !vacUntil) || // sin fechas = vacaciones indefinidas
          (!vacFrom && vacUntil && day <= vacUntil) ||
          (vacFrom && !vacUntil && day >= vacFrom) ||
          (vacFrom && vacUntil && day >= vacFrom && day <= vacUntil);
        if (isInVacation) {
          map.set(dayKey, new Set());
          continue;
        }
      }

      const dayWorkingHours = workingHours.filter((wh) => wh.day_of_week === dayOfWeek);
      const availableHours = new Set<number>();

      for (const wh of dayWorkingHours) {
        const startHour = parseInt(wh.start_time.split(":")[0] ?? "0", 10);
        const endHour = parseInt(wh.end_time.split(":")[0] ?? "0", 10);
        const endMinutes = parseInt(wh.end_time.split(":")[1] ?? "0", 10);

        for (let h = startHour; h < endHour; h++) {
          availableHours.add(h);
        }
        if (endMinutes > 0) {
          availableHours.add(endHour);
        }
      }

      if (scheduleConfig.lunch_break_start && scheduleConfig.lunch_break_end) {
        const lunchStart = parseInt(scheduleConfig.lunch_break_start.split(":")[0] ?? "0", 10);
        const lunchEnd = parseInt(scheduleConfig.lunch_break_end.split(":")[0] ?? "0", 10);
        for (let h = lunchStart; h < lunchEnd; h++) {
          availableHours.delete(h);
        }
      }

      map.set(dayKey, availableHours);
    }

    return map;
  }, [weekDays, scheduleConfig, workingHours]);

  // Agrupar turnos por dia
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      map.set(
        key,
        appointments.filter((a) => isSameDay(parseISO(a.starts_at), day))
      );
    }
    return map;
  }, [weekDays, appointments]);

  // Agrupar bloqueos por dia
  const blocksByDay = useMemo(() => {
    const map = new Map<string, ScheduleBlock[]>();
    for (const day of weekDays) {
      const key = format(day, "yyyy-MM-dd");
      map.set(
        key,
        blocks.filter((b) => isSameDay(parseISO(b.starts_at), day))
      );
    }
    return map;
  }, [weekDays, blocks]);

  const getTopOffset = useCallback((dateStr: string) => {
    const d = parseISO(dateStr);
    const hours = d.getHours();
    const minutes = d.getMinutes();
    return ((hours - HOUR_START) + minutes / 60) * SLOT_HEIGHT;
  }, []);

  const getHeight = useCallback((startStr: string, endStr: string) => {
    const min = differenceInMinutes(parseISO(endStr), parseISO(startStr));
    return (min / 60) * SLOT_HEIGHT;
  }, []);

  const handleDragStart = (e: React.DragEvent, apt: AppointmentWithRelations) => {
    const duration = differenceInMinutes(parseISO(apt.ends_at), parseISO(apt.starts_at));
    dragRef.current = { appointmentId: apt.id, durationMin: duration };
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, day: Date, hour: number) => {
    e.preventDefault();
    if (!dragRef.current) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const minuteOffset = Math.round((relY / SLOT_HEIGHT) * 60 / 15) * 15;

    const newStart = new Date(day);
    newStart.setHours(hour, minuteOffset, 0, 0);
    const newEnd = addMinutes(newStart, dragRef.current.durationMin);

    onAppointmentDrop(
      dragRef.current.appointmentId,
      newStart.toISOString(),
      newEnd.toISOString()
    );
    dragRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const isToday = (day: Date) => isSameDay(day, new Date());

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
      <div className="min-w-[800px]">
        {/* Header: dias de la semana */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="p-2" />
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayAvail = availabilityByDay.get(dayKey);
            const isWorkDay = dayAvail ? dayAvail.size > 0 : true;

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-l p-2 text-center transition-colors",
                  isToday(day) && "bg-primary/5",
                  !isWorkDay && "bg-muted/50 opacity-60"
                )}
              >
                <p className={cn(
                  "text-xs font-medium uppercase",
                  isWorkDay ? "text-muted-foreground" : "text-muted-foreground/50"
                )}>
                  {format(day, "EEE", { locale: es })}
                </p>
                <p
                  className={cn(
                    "text-lg font-bold",
                    isToday(day) &&
                      "inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground",
                    !isWorkDay && !isToday(day) && "text-muted-foreground/40"
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
            );
          })}
        </div>

        {/* Grilla de horas */}
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          {/* Columna de horas */}
          <div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="flex h-[60px] items-start justify-end border-b pr-2 pt-0.5"
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Columnas de dias */}
          {weekDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayAppointments = appointmentsByDay.get(dayKey) ?? [];
            const dayBlocks = blocksByDay.get(dayKey) ?? [];
            const dayAvailableHours = availabilityByDay.get(dayKey);
            const hasConfig = availabilityByDay.size > 0;

            return (
              <div
                key={day.toISOString()}
                className={cn("relative border-l", isToday(day) && "bg-primary/[0.02]")}
              >
                {/* Slots horarios */}
                {hours.map((hour) => {
                  const isAvailable = hasConfig && dayAvailableHours ? dayAvailableHours.has(hour) : false;
                  const isUnavailable = hasConfig && !isAvailable;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-[60px] border-b transition-colors cursor-pointer group relative",
                        isAvailable
                          ? "bg-emerald-50/80 border-emerald-200/40 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800/30 dark:hover:bg-emerald-900/40"
                          : isUnavailable
                            ? "bg-gray-100/60 border-gray-200/40 dark:bg-gray-900/40 dark:border-gray-800/30"
                            : "border-border/30 hover:bg-accent/50"
                      )}
                      onClick={() => {
                        if (onEmptySlotClick) {
                          const slotDate = new Date(day);
                          slotDate.setHours(hour, 0, 0, 0);
                          onEmptySlotClick(slotDate);
                        } else {
                          onSlotClick(day, `${hour.toString().padStart(2, "0")}:00`);
                        }
                      }}
                      onDrop={(e) => handleDrop(e, day, hour)}
                      onDragOver={handleDragOver}
                    >
                      {/* Indicador de disponible al hacer hover — estilo HisMe */}
                      {isAvailable && (
                        <div className="h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            Disponible
                          </span>
                        </div>
                      )}
                      {isUnavailable && (
                        <div className="h-full flex items-center justify-center pointer-events-none">
                          {/* Patrón de rayas diagonales sutiles para no-laborales */}
                          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, currentColor 5px, currentColor 6px)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Bloqueos — estilo mejorado */}
                {dayBlocks.map((block) => {
                  const top = getTopOffset(block.starts_at);
                  const height = getHeight(block.starts_at, block.ends_at);
                  return (
                    <div
                      key={block.id}
                      className="absolute left-0.5 right-0.5 rounded-md z-10 flex items-center gap-1.5 px-2 bg-amber-50/90 border border-dashed border-amber-300 dark:bg-amber-900/30 dark:border-amber-700"
                      style={{ top: `${top}px`, height: `${Math.max(height, 24)}px` }}
                    >
                      <AlertCircle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 truncate">
                        {block.reason ?? "Bloqueado por profesional"}
                      </span>
                    </div>
                  );
                })}

                {/* ─── Turnos — Cards estilo HisMe ─── */}
                {dayAppointments.map((apt) => {
                  const top = getTopOffset(apt.starts_at);
                  const height = getHeight(apt.starts_at, apt.ends_at);
                  const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES["pending"];
                  const isCancelled = apt.status === "cancelled";
                  const isNoShow = apt.status === "no_show";
                  const isCompleted = apt.status === "completed";
                  // Próximo si falta <30 min y aún no terminó
                  const minutesUntilStart = (parseISO(apt.starts_at).getTime() - Date.now()) / 60000;
                  const isSoon = !isCancelled && !isCompleted && !isNoShow && minutesUntilStart > -5 && minutesUntilStart < 30;
                  const hasMeet = apt.modality === "virtual" && apt.meet_url;

                  return (
                    <div
                      key={apt.id}
                      draggable={!isCancelled}
                      onDragStart={(e) => handleDragStart(e, apt)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                      className={cn(
                        "absolute left-1 right-1 z-20 cursor-grab overflow-hidden rounded-md shadow-sm active:cursor-grabbing hover:shadow-md transition-all",
                        style.card,
                        style.border,
                        isCancelled && "opacity-60 cursor-pointer",
                        isSoon && "ring-2 ring-blue-500"
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 28)}px`,
                      }}
                    >
                      <div className="px-2 py-1 h-full flex flex-col justify-between">
                        {/* Fila superior: Nombre del paciente */}
                        <div className="flex items-start justify-between gap-1">
                          <p className={cn(
                            "text-xs font-semibold truncate leading-tight text-foreground",
                            isCancelled && "line-through opacity-70"
                          )}>
                            {apt.patient.full_name}
                          </p>
                          {/* Icono de modalidad — clickeable si es virtual con link */}
                          {hasMeet ? (
                            <a
                              href={apt.meet_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Entrar a la videoconsulta"
                              className="flex-shrink-0 rounded hover:bg-blue-500/20 p-0.5 -m-0.5 transition-colors"
                            >
                              <Video className="h-3 w-3 text-blue-500" />
                            </a>
                          ) : apt.modality === "virtual" ? (
                            <Video className="h-3 w-3 flex-shrink-0 text-blue-500 mt-0.5" />
                          ) : (
                            <MapPin className="h-3 w-3 flex-shrink-0 text-muted-foreground/50 mt-0.5" />
                          )}
                        </div>

                        {/* Fila media: Horario y servicio */}
                        {height >= 38 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/70" />
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {format(parseISO(apt.starts_at), "HH:mm")} - {format(parseISO(apt.ends_at), "HH:mm")}
                            </span>
                          </div>
                        )}

                        {/* Servicio */}
                        {height >= 52 && apt.service && (
                          <p className="text-[10px] text-muted-foreground/80 truncate mt-0.5">
                            {apt.service.name}
                          </p>
                        )}

                        {/* Badge de estado — solo para estados especiales */}
                        {height >= 48 && (isNoShow || isCancelled) && (
                          <div className="mt-auto pt-0.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold",
                              style.badge
                            )}>
                              {isNoShow && <XCircle className="h-2.5 w-2.5" />}
                              {style.badgeText}
                            </span>
                          </div>
                        )}

                        {/* Teléfono — solo si hay mucho espacio */}
                        {height >= 70 && apt.patient.phone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/50" />
                            <span className="text-[9px] text-muted-foreground/70">{apt.patient.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});
