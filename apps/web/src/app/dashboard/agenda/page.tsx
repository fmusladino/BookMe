"use client";

import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from "react";
import {
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppointments } from "@/hooks/use-appointments";
import { useScheduleBlocks } from "@/hooks/use-schedule-blocks";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  LayoutGrid,
  Lock,
} from "lucide-react";
import type { AppointmentWithRelations } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Carga diferida de componentes pesados — solo se descargan cuando se necesitan
const WeekView = lazy(() => import("@/components/agenda/week-view").then((m) => ({ default: m.WeekView })));
const MonthView = lazy(() => import("@/components/agenda/month-view").then((m) => ({ default: m.MonthView })));
const EditAppointmentModal = lazy(() => import("@/components/agenda/edit-appointment-modal").then((m) => ({ default: m.EditAppointmentModal })));
const CreateAppointmentModal = lazy(() => import("@/components/agenda/create-appointment-modal").then((m) => ({ default: m.CreateAppointmentModal })));

type ViewMode = "week" | "month";

export default function AgendaPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const { appointments, loading, fetchAppointments, updateAppointment } = useAppointments();
  const { blocks, fetchBlocks, createBlock, deleteBlock } = useScheduleBlocks();

  // Modal de turno seleccionado
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentWithRelations | null>(null);

  // Modal de crear turno
  const [createModal, setCreateModal] = useState<{ open: boolean; date?: Date }>({ open: false });

  // Modal de bloqueo
  const [blockModal, setBlockModal] = useState<{ open: boolean; date?: Date; time?: string }>({ open: false });
  const [blockForm, setBlockForm] = useState({ startsAt: "", endsAt: "", reason: "" });

  // Rango de fechas según la vista
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { start, end };
    }
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  }, [currentDate, viewMode]);

  // Días de la semana actual
  const weekDays = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 }),
      }),
    [currentDate]
  );

  // Cargar datos al cambiar rango
  useEffect(() => {
    const from = dateRange.start.toISOString();
    const to = dateRange.end.toISOString();
    fetchAppointments(from, to);
    fetchBlocks(from, to);
  }, [dateRange, fetchAppointments, fetchBlocks]);

  const navigate = (direction: "prev" | "next") => {
    if (viewMode === "week") {
      setCurrentDate((d) => (direction === "next" ? addWeeks(d, 1) : subWeeks(d, 1)));
    } else {
      setCurrentDate((d) => (direction === "next" ? addMonths(d, 1) : subMonths(d, 1)));
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleAppointmentClick = (apt: AppointmentWithRelations) => {
    setSelectedAppointment(apt);
  };

  const handleEmptySlotClick = (date: Date) => {
    // Abrir modal de crear turno con la fecha preseleccionada
    setCreateModal({ open: true, date });
  };

  const handleSlotClick = (date: Date, time: string) => {
    // Abrir modal de bloqueo con la fecha y hora preseleccionadas
    const [hours] = time.split(":");
    const startsAt = new Date(date);
    startsAt.setHours(parseInt(hours ?? "9"), 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(startsAt.getHours() + 1);

    setBlockForm({
      startsAt: format(startsAt, "yyyy-MM-dd'T'HH:mm"),
      endsAt: format(endsAt, "yyyy-MM-dd'T'HH:mm"),
      reason: "",
    });
    setBlockModal({ open: true, date, time });
  };

  const handleDayClick = (date: Date) => {
    setCurrentDate(date);
    setViewMode("week");
  };

  const handleAppointmentDrop = useCallback(
    async (appointmentId: string, newStartsAt: string, newEndsAt: string) => {
      try {
        await updateAppointment(appointmentId, {
          starts_at: newStartsAt,
          ends_at: newEndsAt,
        });
        toast.success("Turno reprogramado correctamente");
      } catch {
        toast.error("Error al reprogramar turno");
      }
    },
    [updateAppointment]
  );

  const handleCreateBlock = async () => {
    try {
      await createBlock(
        new Date(blockForm.startsAt).toISOString(),
        new Date(blockForm.endsAt).toISOString(),
        blockForm.reason || undefined
      );
      setBlockModal({ open: false });
      toast.success("Bloqueo creado correctamente");
    } catch {
      toast.error("Error al crear bloqueo");
    }
  };

  const handleStatusChange = async (apt: AppointmentWithRelations, newStatus: string) => {
    try {
      await updateAppointment(apt.id, { status: newStatus });
      setSelectedAppointment(null);
      toast.success("Estado del turno actualizado");
    } catch {
      toast.error("Error al actualizar estado");
    }
  };

  const handleAppointmentCreated = async () => {
    // Refrescar la lista de turnos después de crear uno
    const from = dateRange.start.toISOString();
    const to = dateRange.end.toISOString();
    await fetchAppointments(from, to);
  };

  const headerLabel =
    viewMode === "week"
      ? `${format(weekDays[0]!, "d MMM", { locale: es })} — ${format(weekDays[6]!, "d MMM yyyy", { locale: es })}`
      : format(currentDate, "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground capitalize">{headerLabel}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const startsAt = format(now, "yyyy-MM-dd'T'HH:00");
              const endsAtDate = new Date(now);
              endsAtDate.setHours(now.getHours() + 1);
              const endsAt = format(endsAtDate, "yyyy-MM-dd'T'HH:00");
              setBlockForm({ startsAt, endsAt, reason: "" });
              setBlockModal({ open: true });
            }}
          >
            <Lock className="mr-1 h-3.5 w-3.5" />
            Bloquear horario
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hoy
          </Button>

          <div className="flex items-center rounded-md border">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setViewMode("week")}
            >
              <CalendarIcon className="mr-1 h-3.5 w-3.5" />
              Semana
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setViewMode("month")}
            >
              <LayoutGrid className="mr-1 h-3.5 w-3.5" />
              Mes
            </Button>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Vista semanal */}
      {!loading && viewMode === "week" && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
          <WeekView
            weekDays={weekDays}
            appointments={appointments}
            blocks={blocks}
            onAppointmentClick={handleAppointmentClick}
            onSlotClick={handleSlotClick}
            onAppointmentDrop={handleAppointmentDrop}
            onEmptySlotClick={handleEmptySlotClick}
          />
        </Suspense>
      )}

      {/* Vista mensual */}
      {!loading && viewMode === "month" && (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
          <MonthView
            currentDate={currentDate}
            appointments={appointments}
            onDayClick={handleDayClick}
          />
        </Suspense>
      )}

      {/* Modal: editar turno — solo se carga el bundle cuando se abre */}
      {selectedAppointment && (
        <Suspense fallback={null}>
          <EditAppointmentModal
            appointment={selectedAppointment}
            open={!!selectedAppointment}
            onOpenChange={(open) => { if (!open) setSelectedAppointment(null); }}
            onSave={handleAppointmentCreated}
          />
        </Suspense>
      )}

      {/* Modal: crear turno — solo se carga el bundle cuando se abre */}
      {createModal.open && (
        <Suspense fallback={null}>
          <CreateAppointmentModal
            open={createModal.open}
            onOpenChange={(open) => setCreateModal({ open, date: open ? createModal.date : undefined })}
            onSuccess={handleAppointmentCreated}
            initialDate={createModal.date}
            initialTime={createModal.date ? format(createModal.date, "HH:00") : undefined}
          />
        </Suspense>
      )}

      {/* Modal: crear bloqueo */}
      <Dialog open={blockModal.open} onOpenChange={(open) => setBlockModal({ open })}>
        <DialogContent onClose={() => setBlockModal({ open: false })} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Bloquear horario
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="datetime-local"
                value={blockForm.startsAt}
                onChange={(e) => setBlockForm((f) => ({ ...f, startsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="datetime-local"
                value={blockForm.endsAt}
                onChange={(e) => setBlockForm((f) => ({ ...f, endsAt: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Input
                value={blockForm.reason}
                onChange={(e) => setBlockForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Ej: reunión, almuerzo, emergencia..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBlockModal({ open: false })}>
                Cancelar
              </Button>
              <Button onClick={handleCreateBlock}>Bloquear</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
