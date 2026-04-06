"use client";

import { useMemo } from "react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { AppointmentWithRelations } from "@/types";

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-blue-400",
  completed: "bg-emerald-400",
  cancelled: "bg-red-400",
  no_show: "bg-gray-400",
};

interface MonthViewProps {
  currentDate: Date;
  appointments: AppointmentWithRelations[];
  onDayClick: (date: Date) => void;
}

export function MonthView({ currentDate, appointments, onDayClick }: MonthViewProps) {
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  // Agrupar turnos por día
  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, AppointmentWithRelations[]>();
    for (const apt of appointments) {
      const key = format(parseISO(apt.starts_at), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      existing.push(apt);
      map.set(key, existing);
    }
    return map;
  }, [appointments]);

  const today = new Date();

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header: días de la semana */}
      <div className="grid grid-cols-7 bg-muted/30">
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day) => (
          <div key={day} className="border-b p-2 text-center text-xs font-medium uppercase text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day) => {
          const dayKey = format(day, "yyyy-MM-dd");
          const dayAppts = appointmentsByDay.get(dayKey) ?? [];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isSameDay(day, today);

          return (
            <button
              key={dayKey}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative min-h-[80px] border-b border-r p-1.5 text-left transition-colors hover:bg-muted/30 sm:min-h-[100px]",
                !isCurrentMonth && "opacity-40"
              )}
            >
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  isCurrentDay && "bg-primary text-primary-foreground",
                  !isCurrentDay && "text-foreground"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Indicadores de turnos */}
              <div className="mt-0.5 space-y-0.5">
                {dayAppts.slice(0, 3).map((apt) => (
                  <div key={apt.id} className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[apt.status] ?? STATUS_DOT["pending"])} />
                    <span className="truncate text-[10px] leading-tight">
                      {format(parseISO(apt.starts_at), "HH:mm")} {apt.patient.full_name.split(" ")[0]}
                    </span>
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    +{dayAppts.length - 3} más
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
