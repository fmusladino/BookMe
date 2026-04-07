"use client";

import { useMemo, useRef, useCallback, memo } from "react";
import { format, addMinutes, isSameDay, parseISO, differenceInMinutes, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AppointmentWithRelations, ScheduleBlock } from "@/types";
import { Badge } from "@/components/ui/badge";
import type { WorkingHour, ScheduleConfig } from "@/hooks/use-schedule-config";

// Constantes de grilla
const HOUR_START = 7;
const HOUR_END = 22;
const SLOT_HEIGHT = 60; // px por hora
const TOTAL_HOURS = HOUR_END - HOUR_START;

// Colores de turnos ocupados — azul para todos los estados activos
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-900/40 dark:border-blue-600 dark:text-blue-100",
  confirmed: "bg-blue-200 border-blue-500 text-blue-900 dark:bg-blue-800/50 dark:border-blue-500 dark:text-blue-100",
  completed: "bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-200",
  cancelled: "bg-red-100 border-red-300 text-red-900 line-through dark:bg-red-900/30 dark:border-red-700 dark:text-red-200",
  no_show: "bg-gray-100 border-gray-300 text-gray-900 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200",
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

  // Calcular disponibilidad por día y hora
  // Retorna un Map<"yyyy-MM-dd", Set<number>> donde el Set contiene las horas disponibles
  const availabilityByDay = useMemo(() => {
    const map = new Map<string, Set<number>>();
    if (!scheduleConfig || !workingHours || workingHours.length === 0) return map;

    for (const day of weekDays) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayOfWeek = getDay(day); // 0=Dom, 1=Lun, etc.

      // Verificar si es día laboral
      if (!scheduleConfig.working_days.includes(dayOfWeek)) {
        map.set(dayKey, new Set());
        continue;
      }

      // Verificar modo vacaciones
      if (scheduleConfig.vacation_mode) {
        if (!scheduleConfig.vacation_until || new Date(scheduleConfig.vacation_until) >= day) {
          map.set(dayKey, new Set());
          continue;
        }
      }

      // Obtener horarios laborales para este día
      const dayWorkingHours = workingHours.filter((wh) => wh.day_of_week === dayOfWeek);
      const availableHours = new Set<number>();

      for (const wh of dayWorkingHours) {
        const startHour = parseInt(wh.start_time.split(":")[0] ?? "0", 10);
        const endHour = parseInt(wh.end_time.split(":")[0] ?? "0", 10);
        // Si los minutos de fin son > 0, esa hora también es parcialmente disponible
        const endMinutes = parseInt(wh.end_time.split(":")[1] ?? "0", 10);

        for (let h = startHour; h < endHour; h++) {
          availableHours.add(h);
        }
        // Si la hora de fin tiene minutos, agregar esa hora parcial
        if (endMinutes > 0) {
          availableHours.add(endHour);
        }
      }

      // Quitar horario de almuerzo
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

  // Agrupar turnos por día
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

  // Agrupar bloqueos por día
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

    // Calcular posición Y relativa al slot para determinar minutos
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const minuteOffset = Math.round((relY / SLOT_HEIGHT) * 60 / 15) * 15; // Snap a 15 min

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
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="min-w-[800px]">
        {/* Header: días de la semana */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
          <div className="p-2" />
          {weekDays.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "border-l p-2 text-center",
                isToday(day) && "bg-primary/5"
              )}
            >
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {format(day, "EEE", { locale: es })}
              </p>
              <p
                className={cn(
                  "text-lg font-bold",
                  isToday(day) &&
                    "inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
                )}
              >
                {format(day, "d")}
              </p>
            </div>
          ))}
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
                <span className="text-xs text-muted-foreground">
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Columnas de días */}
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
                {/* Slots horarios (clickeables y droppables) */}
                {hours.map((hour) => {
                  const isAvailable = hasConfig && dayAvailableHours ? dayAvailableHours.has(hour) : false;
                  const isUnavailable = hasConfig && !isAvailable;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-[60px] border-b border-dashed transition-colors cursor-pointer group",
                        isAvailable
                          ? "bg-emerald-50 border-emerald-200/60 hover:bg-emerald-100/80 dark:bg-emerald-950/20 dark:border-emerald-800/40 dark:hover:bg-emerald-900/30"
                          : isUnavailable
                            ? "bg-gray-50/50 border-border/30 hover:bg-gray-100/50 dark:bg-gray-900/20 dark:border-gray-800/30 dark:hover:bg-gray-800/30"
                            : "border-border/50 hover:bg-accent/50"
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
                      {/* Visual indicator for clickable slots */}
                      <div className={cn(
                        "h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs pointer-events-none",
                        isAvailable ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      )}>
                        +
                      </div>
                    </div>
                  );
                })}

                {/* Bloqueos */}
                {dayBlocks.map((block) => {
                  const top = getTopOffset(block.starts_at);
                  const height = getHeight(block.starts_at, block.ends_at);
                  return (
                    <div
                      key={block.id}
                      className="absolute left-0.5 right-0.5 rounded bg-muted/80 border border-dashed border-muted-foreground/30 z-10 flex items-center justify-center"
                      style={{ top: `${top}px`, height: `${Math.max(height, 20)}px` }}
                    >
                      <span className="text-[10px] text-muted-foreground truncate px-1">
                        {block.reason ?? "Bloqueado"}
                      </span>
                    </div>
                  );
                })}

                {/* Turnos */}
                {dayAppointments.map((apt) => {
                  const top = getTopOffset(apt.starts_at);
                  const height = getHeight(apt.starts_at, apt.ends_at);
                  const colorClass = STATUS_COLORS[apt.status] ?? STATUS_COLORS["pending"];

                  return (
                    <div
                      key={apt.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, apt)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAppointmentClick(apt);
                      }}
                      className={cn(
                        "absolute left-1 right-1 z-20 cursor-grab overflow-hidden rounded border px-1.5 py-0.5 text-xs shadow-sm active:cursor-grabbing hover:shadow-md transition-shadow",
                        colorClass
                      )}
                      style={{
                        top: `${top}px`,
                        height: `${Math.max(height, 24)}px`,
                      }}
                    >
                      <p className="font-medium truncate">{apt.patient.full_name}</p>
                      {height >= 40 && (
                        <p className="truncate opacity-75">
                          {format(parseISO(apt.starts_at), "HH:mm")} - {format(parseISO(apt.ends_at), "HH:mm")}
                        </p>
                      )}
                      {height >= 56 && apt.service && (
                        <p className="truncate opacity-60">{apt.service.name}</p>
                      )}
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
