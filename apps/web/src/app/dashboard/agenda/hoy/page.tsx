"use client";

import { useEffect, useState, useCallback } from "react";
import {
  format,
  startOfDay,
  endOfDay,
  parseISO,
  isPast,
  addDays,
  subDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppointments } from "@/hooks/use-appointments";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Mail,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CalendarCheck,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "success" | "destructive" | "warning" | "secondary" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pendiente", variant: "warning", icon: Clock },
  confirmed: { label: "Confirmado", variant: "default", icon: CalendarCheck },
  completed: { label: "Completado", variant: "success", icon: CheckCircle2 },
  cancelled: { label: "Cancelado", variant: "destructive", icon: XCircle },
  no_show: { label: "Ausente", variant: "secondary", icon: AlertCircle },
};

export default function HoyPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { appointments, loading, fetchAppointments, updateAppointment } = useAppointments();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDay = useCallback(
    (date: Date) => {
      fetchAppointments(startOfDay(date).toISOString(), endOfDay(date).toISOString());
    },
    [fetchAppointments]
  );

  useEffect(() => {
    loadDay(selectedDate);
  }, [selectedDate, loadDay]);

  // Ordenar por hora de inicio
  const sorted = [...appointments].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  // Estadísticas del día
  const stats = {
    total: sorted.length,
    pending: sorted.filter((a) => a.status === "pending").length,
    confirmed: sorted.filter((a) => a.status === "confirmed").length,
    completed: sorted.filter((a) => a.status === "completed").length,
    cancelled: sorted.filter((a) => a.status === "cancelled").length,
    noShow: sorted.filter((a) => a.status === "no_show").length,
  };

  // Encontrar el turno actual o próximo
  const now = new Date();
  const currentAppointment = sorted.find(
    (a) =>
      (a.status === "confirmed" || a.status === "pending") &&
      new Date(a.starts_at) <= now &&
      new Date(a.ends_at) > now
  );
  const nextAppointment = sorted.find(
    (a) =>
      (a.status === "confirmed" || a.status === "pending") &&
      new Date(a.starts_at) > now
  );

  const handleStatusChange = async (apt: AppointmentWithRelations, newStatus: string) => {
    try {
      await updateAppointment(apt.id, { status: newStatus });
      toast.success("Estado actualizado");
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-6">
      {/* Header con navegación de día */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isToday ? "Hoy" : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {isToday && format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
            {!isToday && format(selectedDate, "yyyy", { locale: es })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
            Hoy
          </Button>
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedDate((d) => subDays(d, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold">{stats.total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold text-amber-500">{stats.pending}</span>
            <span className="text-xs text-muted-foreground">Pendientes</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold text-blue-500">{stats.confirmed}</span>
            <span className="text-xs text-muted-foreground">Confirmados</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold text-emerald-500">{stats.completed}</span>
            <span className="text-xs text-muted-foreground">Completados</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold text-red-500">{stats.cancelled}</span>
            <span className="text-xs text-muted-foreground">Cancelados</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col items-center p-3">
            <span className="text-2xl font-bold text-gray-500">{stats.noShow}</span>
            <span className="text-xs text-muted-foreground">Ausentes</span>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Lista vacía */}
      {!loading && sorted.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CalendarCheck className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-3 font-medium">Sin turnos para este día</p>
            <p className="text-sm text-muted-foreground">
              No hay turnos programados.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Lista de turnos */}
      {!loading && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((apt) => {
            const statusConf = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG["pending"]!;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === apt.id;
            const isCurrent = currentAppointment?.id === apt.id;
            const isNext = nextAppointment?.id === apt.id && !currentAppointment;
            const aptPast = isPast(parseISO(apt.ends_at));

            return (
              <Card
                key={apt.id}
                className={cn(
                  "transition-all cursor-pointer hover:shadow-md",
                  isCurrent && "ring-2 ring-primary",
                  isNext && "ring-2 ring-accent",
                  apt.status === "cancelled" && "opacity-50"
                )}
                onClick={() => setExpandedId(isExpanded ? null : apt.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Hora */}
                    <div className="text-center">
                      <p className="text-lg font-bold">
                        {format(parseISO(apt.starts_at), "HH:mm")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(apt.ends_at), "HH:mm")}
                      </p>
                    </div>

                    {/* Línea separadora */}
                    <div className={cn(
                      "h-12 w-0.5 rounded-full",
                      isCurrent ? "bg-primary" : "bg-border"
                    )} />

                    {/* Info del paciente */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{apt.patient.full_name}</p>
                        {isCurrent && (
                          <Badge variant="default" className="text-[10px]">EN CURSO</Badge>
                        )}
                        {isNext && !isCurrent && (
                          <Badge variant="outline" className="text-[10px]">SIGUIENTE</Badge>
                        )}
                      </div>
                      {apt.service && (
                        <p className="text-sm text-muted-foreground truncate">
                          {apt.service.name}
                          {apt.service.duration_minutes && ` · ${apt.service.duration_minutes} min`}
                        </p>
                      )}
                    </div>

                    {/* Estado */}
                    <Badge variant={statusConf.variant}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusConf.label}
                    </Badge>
                  </div>

                  {/* Detalle expandido */}
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4 space-y-3">
                      {/* Contacto */}
                      <div className="flex flex-wrap gap-4 text-sm">
                        {apt.patient.phone && (
                          <a
                            href={`tel:${apt.patient.phone}`}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {apt.patient.phone}
                          </a>
                        )}
                        {apt.patient.email && (
                          <a
                            href={`mailto:${apt.patient.email}`}
                            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {apt.patient.email}
                          </a>
                        )}
                      </div>

                      {/* Notas */}
                      {apt.notes && (
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                          {apt.notes}
                        </p>
                      )}

                      {/* Acciones rápidas */}
                      {apt.status !== "cancelled" && apt.status !== "completed" && (
                        <div className="flex flex-wrap gap-2">
                          {apt.status === "pending" && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(apt, "confirmed");
                              }}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Confirmar
                            </Button>
                          )}
                          {(apt.status === "pending" || apt.status === "confirmed") && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(apt, "completed");
                                }}
                              >
                                Completar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(apt, "no_show");
                                }}
                              >
                                Ausente
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(apt, "cancelled");
                                }}
                              >
                                <XCircle className="mr-1 h-3.5 w-3.5" />
                                Cancelar
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
