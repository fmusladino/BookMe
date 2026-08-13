"use client";

import { useMemo, useRef, useCallback, memo, useState, useEffect } from "react";
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
const SLOT_HEIGHT = 80; // px por hora — balance entre densidad y legibilidad
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

// ─── Paleta de la grilla horaria ───
// Cada tipo de franja tiene un color propio para distinguirlas de un vistazo:
// verde = atiende, ámbar = almuerzo, gris rayado = fuera de horario.
const SLOT_STYLES = {
  available:
    "bg-emerald-100/70 hover:bg-emerald-200 border-emerald-300/60 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/30 dark:border-emerald-700/50",
  lunch:
    "bg-amber-100/70 border-amber-300/60 dark:bg-amber-500/15 dark:border-amber-700/50",
  off: "bg-slate-200/70 border-slate-300/60 dark:bg-slate-800/60 dark:border-slate-700/50",
  neutral: "border-border/40 hover:bg-accent/50",
} as const;

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

  // Hora actual para la línea indicadora. Arranca en null y se setea en el cliente
  // para no romper la hidratación (el server no sabe la hora del navegador).
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const hours = useMemo(
    () => Array.from({ length: TOTAL_HOURS }, (_, i) => HOUR_START + i),
    []
  );

  // Calcular disponibilidad por dia y hora.
  // Devolvemos el almuerzo aparte para poder pintarlo distinto del "fuera de horario".
  const availabilityByDay = useMemo(() => {
    const map = new Map<string, { available: Set<number>; lunch: Set<number> }>();
    if (!scheduleConfig || !workingHours || workingHours.length === 0) return map;

    for (const day of weekDays) {
      const dayKey = format(day, "yyyy-MM-dd");
      const dayOfWeek = getDay(day);

      if (!scheduleConfig.working_days.includes(dayOfWeek)) {
        map.set(dayKey, { available: new Set(), lunch: new Set() });
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
          map.set(dayKey, { available: new Set(), lunch: new Set() });
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

      const lunchHours = new Set<number>();
      if (scheduleConfig.lunch_break_start && scheduleConfig.lunch_break_end) {
        const lunchStart = parseInt(scheduleConfig.lunch_break_start.split(":")[0] ?? "0", 10);
        const lunchEnd = parseInt(scheduleConfig.lunch_break_end.split(":")[0] ?? "0", 10);
        for (let h = lunchStart; h < lunchEnd; h++) {
          // Solo marcamos como almuerzo las horas que además son laborales
          if (availableHours.delete(h)) lunchHours.add(h);
        }
      }

      map.set(dayKey, { available: availableHours, lunch: lunchHours });
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
            const isWorkDay = dayAvail ? dayAvail.available.size > 0 : true;

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
                className="flex h-[80px] items-start justify-end border-b pr-2 pt-0.5"
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
                  const isAvailable = hasConfig && dayAvailableHours ? dayAvailableHours.available.has(hour) : false;
                  const isLunch = hasConfig && dayAvailableHours ? dayAvailableHours.lunch.has(hour) : false;
                  const isUnavailable = hasConfig && !isAvailable && !isLunch;

                  return (
                    <div
                      key={hour}
                      className={cn(
                        "h-[80px] border-b transition-colors cursor-pointer group relative",
                        isAvailable
                          ? SLOT_STYLES.available
                          : isLunch
                            ? SLOT_STYLES.lunch
                            : isUnavailable
                              ? SLOT_STYLES.off
                              : SLOT_STYLES.neutral
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
                      {/* Guía de la media hora: ayuda a ubicar turnos de 30 min */}
                      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-foreground/10" />

                      {/* Franja disponible: siempre visible, se refuerza en hover */}
                      {isAvailable && (
                        <div className="h-full flex items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-medium text-emerald-700/70 opacity-0 group-hover:opacity-100 transition-opacity dark:text-emerald-300/80">
                            + Turno
                          </span>
                        </div>
                      )}
                      {isLunch && (
                        <div className="h-full flex items-center justify-center pointer-events-none">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700/70 dark:text-amber-300/70">
                            Almuerzo
                          </span>
                        </div>
                      )}
                      {isUnavailable && (
                        <div className="h-full flex items-center justify-center pointer-events-none">
                          {/* Rayado diagonal para dejar clara la franja no laborable */}
                          <div className="absolute inset-0 text-slate-400 opacity-25 dark:text-slate-500 dark:opacity-20"
                            style={{
                              backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 5px, currentColor 5px, currentColor 6px)",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Línea de la hora actual (solo en la columna de hoy) */}
                {now && isSameDay(day, now) && now.getHours() >= HOUR_START && now.getHours() < HOUR_END && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
                    style={{ top: `${((now.getHours() - HOUR_START) + now.getMinutes() / 60) * SLOT_HEIGHT}px` }}
                  >
                    <span className="h-2 w-2 -ml-1 rounded-full bg-rose-500 shadow" />
                    <span className="h-px flex-1 bg-rose-500" />
                  </div>
                )}

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

                {/* ─── Turnos — distribuidos en columnas cuando se solapan ─── */}
                {dayAppointments.map((apt) => {
                  const top = getTopOffset(apt.starts_at);
                  const height = getHeight(apt.starts_at, apt.ends_at);
                  const style = STATUS_STYLES[apt.status] ?? STATUS_STYLES["pending"];
                  const isCancelled = apt.status === "cancelled";
                  const isNoShow = apt.status === "no_show";
                  const isCompleted = apt.status === "completed";
                  const minutesUntilStart = (parseISO(apt.starts_at).getTime() - Date.now()) / 60000;
                  const isSoon = !isCancelled && !isCompleted && !isNoShow && minutesUntilStart > -5 && minutesUntilStart < 30;
                  const hasMeet = apt.modality === "virtual" && apt.meet_url;
                  // Layout: los turnos que solapan temporalmente se distribuyen
                  // lado a lado (columnas) en vez de apilarse invisiblemente.
                  const aStart = parseISO(apt.starts_at).getTime();
                  const aEnd = parseISO(apt.ends_at).getTime();
                  const overlapping = [...dayAppointments]
                    .filter((o) => {
                      const oStart = parseISO(o.starts_at).getTime();
                      const oEnd = parseISO(o.ends_at).getTime();
                      return oStart < aEnd && oEnd > aStart;
                    })
                    .sort((a, b) => a.starts_at.localeCompare(b.starts_at) || a.id.localeCompare(b.id));
                  const col = overlapping.findIndex((o) => o.id === apt.id);
                  const cols = overlapping.length;
                  const widthPct = 100 / cols;
                  const leftPct = col * widthPct;

                  // Layout compacto (horizontal) si la card es chica (<36px).
                  const isCompact = Math.max(height, 40) < 36;

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
                        "absolute z-20 cursor-grab overflow-hidden rounded-md border-l-4 shadow-sm active:cursor-grabbing hover:shadow-md hover:z-30 transition-all",
                        style.card,
                        style.border,
                        isCancelled && "opacity-60 cursor-pointer",
                        isSoon && "ring-2 ring-blue-500"
                      )}
                      style={{
                        top: `${top + 1}px`,
                        height: `${Math.max(height, 32) - 2}px`,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      {isCompact ? (
                        // Card compacta: una sola fila horizontal con todo
                        <div className="flex items-center gap-1.5 px-2 h-full">
                          <span className="text-[10px] font-mono font-bold text-foreground/70 shrink-0">
                            {format(parseISO(apt.starts_at), "HH:mm")}
                          </span>
                          <p className={cn(
                            "text-xs font-semibold truncate flex-1 text-foreground",
                            isCancelled && "line-through opacity-70"
                          )}>
                            {apt.patient.full_name}
                          </p>
                          {hasMeet ? (
                            <a
                              href={apt.meet_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Entrar a la videoconsulta"
                              className="shrink-0 rounded hover:bg-blue-500/20 p-0.5 transition-colors"
                            >
                              <Video className="h-3 w-3 text-blue-500" />
                            </a>
                          ) : apt.modality === "virtual" ? (
                            <Video className="h-3 w-3 shrink-0 text-blue-500" />
                          ) : null}
                        </div>
                      ) : (
                      <div className="px-2 py-1.5 h-full flex flex-col gap-0.5">
                        {/* Header: hora y modalidad */}
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-mono font-bold text-foreground/70">
                            {format(parseISO(apt.starts_at), "HH:mm")}–{format(parseISO(apt.ends_at), "HH:mm")}
                          </span>
                          {hasMeet ? (
                            <a
                              href={apt.meet_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Entrar a la videoconsulta"
                              className="shrink-0 rounded hover:bg-blue-500/20 p-0.5 -m-0.5 transition-colors"
                            >
                              <Video className="h-3.5 w-3.5 text-blue-500" />
                            </a>
                          ) : apt.modality === "virtual" ? (
                            <Video className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Nombre */}
                        <p className={cn(
                          "text-sm font-semibold truncate leading-tight text-foreground",
                          isCancelled && "line-through opacity-70"
                        )}>
                          {apt.patient.full_name}
                        </p>

                        {/* Servicio */}
                        {height >= 56 && apt.service && (
                          <p className="text-[11px] text-muted-foreground/80 truncate">
                            {apt.service.name}
                          </p>
                        )}

                        {/* Badge de estado — solo para estados especiales */}
                        {height >= 56 && (isNoShow || isCancelled) && (
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
                        {height >= 90 && apt.patient.phone && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <Phone className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/50" />
                            <span className="text-[9px] text-muted-foreground/70">{apt.patient.phone}</span>
                          </div>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Leyenda de colores */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-emerald-300/60 bg-emerald-100/70 dark:border-emerald-700/50 dark:bg-emerald-500/15" />
            Disponible
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-amber-300/60 bg-amber-100/70 dark:border-amber-700/50 dark:bg-amber-500/15" />
            Almuerzo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-slate-300/60 bg-slate-200/70 dark:border-slate-700/50 dark:bg-slate-800/60" />
            Fuera de horario
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-900/30" />
            Bloqueado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-emerald-200 border-l-4 border-l-emerald-500 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/30" />
            Turno confirmado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-teal-200 border-l-4 border-l-teal-500 bg-teal-50 dark:border-teal-700 dark:bg-teal-900/30" />
            Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-sky-200 border-l-4 border-l-sky-500 bg-sky-50 dark:border-sky-700 dark:bg-sky-900/20" />
            Completado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-red-200 border-l-4 border-l-red-400 bg-red-50 dark:border-red-800 dark:bg-red-900/20" />
            Cancelado / ausente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Hora actual
          </span>
        </div>
      </div>
    </div>
  );
});
