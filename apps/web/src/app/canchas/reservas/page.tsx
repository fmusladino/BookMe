"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  format,
  addDays,
  subDays,
  addMinutes,
  parseISO,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  User,
  DollarSign,
  CheckCircle2,
  XCircle,
  RefreshCw,
  CalendarCheck,
  AlertCircle,
  Filter,
  Mail,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ────────────────────────── Types ────────────────────────── */

interface Court {
  id: string;
  name: string;
  sport: string;
  price_per_hour: number;
  slot_duration?: number;
  seña_required: boolean;
  seña_amount?: number;
  seña_alias?: string;
  is_active: boolean;
  court_schedules: Schedule[];
}

interface Schedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Booking {
  id: string;
  court_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours?: number;
  total_amount?: number;
  seña_amount?: number;
  seña_paid: boolean;
  seña_proof_notes?: string;
  payment_completed?: boolean;
  payment_method?: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  notes?: string;
  confirmed_at?: string;
  completed_at?: string;
  created_at: string;
  courts: {
    id: string;
    name: string;
    sport: string;
    price_per_hour: number;
    seña_required: boolean;
    seña_amount?: number;
    seña_alias?: string;
  };
}

interface TimeSlot {
  time: string;
  booking: Booking | null;
}

/* ────────────────────────── Page ────────────────────────── */

export default function DisponibilidadReservasPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCourt, setSelectedCourt] = useState<string>("all");
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  // ─── Modal para tomar turno ───
  const [bookingModal, setBookingModal] = useState<{
    courtId: string;
    courtName: string;
    time: string;
    endTime: string;
  } | null>(null);
  const [bookingForm, setBookingForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    notes: "",
  });
  const [creatingBooking, setCreatingBooking] = useState(false);

  // Cargar canchas
  const fetchCourts = useCallback(async () => {
    try {
      const res = await fetch("/api/courts");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { courts: Court[] };
      setCourts(data.courts);
    } catch {
      toast.error("No se pudieron cargar las canchas");
    }
  }, []);

  // Cargar reservas del día
  const fetchBookings = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const params = new URLSearchParams({ date: dateStr });
      if (selectedCourt !== "all") params.set("court_id", selectedCourt);
      const res = await fetch(`/api/court-bookings?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { bookings: Booking[] };
      setBookings(data.bookings);
    } catch {
      toast.error("No se pudieron cargar las reservas");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedCourt]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  useEffect(() => {
    setLoading(true);
    fetchBookings();
  }, [fetchBookings]);

  // Acciones
  const handleStatusChange = async (id: string, newStatus: "confirmed" | "cancelled") => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/court-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
      toast.success(newStatus === "confirmed" ? "Reserva confirmada" : "Reserva cancelada");
      fetchBookings();
    } catch {
      toast.error("Error al actualizar la reserva");
    } finally {
      setUpdating(null);
    }
  };

  const handleMarkSeñaPaid = async (id: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/court-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seña_paid: true, status: "confirmed" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Seña registrada y reserva confirmada");
      fetchBookings();
    } catch {
      toast.error("Error al registrar la seña");
    } finally {
      setUpdating(null);
    }
  };

  const handleComplete = async (id: string) => {
    setUpdating(id);
    try {
      const res = await fetch(`/api/court-bookings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Turno finalizado — Pago registrado ✓");
      fetchBookings();
    } catch {
      toast.error("Error al finalizar el turno");
    } finally {
      setUpdating(null);
    }
  };

  const openBookingModal = (court: Court, slotTime: string) => {
    const duration = court.slot_duration ?? 60;
    const [h, m] = slotTime.split(":").map(Number);
    const endDate = addMinutes(new Date(2000, 0, 1, h!, m!), duration);
    const endTime = format(endDate, "HH:mm");
    setBookingModal({
      courtId: court.id,
      courtName: court.name,
      time: slotTime,
      endTime,
    });
    setBookingForm({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
  };

  const handleCreateBooking = async () => {
    if (!bookingModal || !bookingForm.customer_name.trim()) {
      toast.error("El nombre del cliente es obligatorio");
      return;
    }
    setCreatingBooking(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const res = await fetch("/api/court-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_id: bookingModal.courtId,
          customer_name: bookingForm.customer_name.trim(),
          customer_phone: bookingForm.customer_phone.trim() || undefined,
          customer_email: bookingForm.customer_email.trim() || undefined,
          booking_date: dateStr,
          start_time: bookingModal.time,
          end_time: bookingModal.endTime,
          notes: bookingForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al crear la reserva");
      }
      toast.success("Turno creado exitosamente");
      setBookingModal(null);
      fetchBookings();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear la reserva");
    } finally {
      setCreatingBooking(false);
    }
  };

  // Filtrar canchas visibles
  const visibleCourts = useMemo(() => {
    if (selectedCourt === "all") return courts.filter((c) => c.is_active);
    return courts.filter((c) => c.id === selectedCourt);
  }, [courts, selectedCourt]);

  // Generar time slots por cancha
  const courtSlots = useMemo(() => {
    const dayOfWeek = selectedDate.getDay();

    return visibleCourts.map((court) => {
      const slotDuration = court.slot_duration ?? 60;
      const daySchedules = court.court_schedules.filter(
        (s) => s.day_of_week === dayOfWeek
      );

      if (daySchedules.length === 0) {
        return { court, slots: [] as TimeSlot[], isWorkDay: false };
      }

      const courtBookings = bookings.filter((b) => b.court_id === court.id && b.status !== "cancelled");
      const slots: TimeSlot[] = [];

      for (const schedule of daySchedules) {
        const [startH, startM] = schedule.start_time.split(":").map(Number);
        const [endH, endM] = schedule.end_time.split(":").map(Number);
        let current = new Date(selectedDate);
        current.setHours(startH!, startM!, 0, 0);
        const endTime = new Date(selectedDate);
        endTime.setHours(endH!, endM!, 0, 0);

        while (current < endTime) {
          const timeStr = format(current, "HH:mm");
          const slotEnd = format(addMinutes(current, slotDuration), "HH:mm");

          // Buscar booking que ocupe este slot
          const booking = courtBookings.find((b) => {
            const bStart = b.start_time.slice(0, 5);
            const bEnd = b.end_time.slice(0, 5);
            return bStart < slotEnd && bEnd > timeStr;
          });

          slots.push({ time: timeStr, booking: booking ?? null });
          current = addMinutes(current, slotDuration);
        }
      }

      return { court, slots, isWorkDay: true };
    });
  }, [visibleCourts, selectedDate, bookings]);

  // Stats globales
  const stats = useMemo(() => {
    let totalSlots = 0;
    let occupiedSlots = 0;
    let pendingCount = 0;
    let confirmedCount = 0;
    let señaPending = 0;

    courtSlots.forEach(({ slots }) => {
      totalSlots += slots.length;
      slots.forEach((s) => {
        if (s.booking) {
          occupiedSlots++;
          if (s.booking.status === "pending") pendingCount++;
          if (s.booking.status === "confirmed") confirmedCount++;
          if (s.booking.courts?.seña_required && !s.booking.seña_paid) señaPending++;
        }
      });
    });

    return {
      total: totalSlots,
      free: totalSlots - occupiedSlots,
      occupied: occupiedSlots,
      occupancyPct: totalSlots > 0 ? Math.round((occupiedSlots / totalSlots) * 100) : 0,
      pendingCount,
      confirmedCount,
      señaPending,
    };
  }, [courtSlots]);

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const formatTime = (t: string) => t.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ─── Header BookMe Navy ─── */}
      <div className="rounded-xl bg-gradient-to-r from-[hsl(213,64%,17%)] to-[hsl(213,50%,28%)] dark:from-[hsl(213,64%,12%)] dark:to-[hsl(213,50%,20%)] px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest">
              Disponibilidad y Reservas
            </p>
            <h1 className="text-xl font-bold capitalize">
              {isToday ? "Hoy" : format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}
            </h1>
            <p className="text-blue-200 text-xs mt-0.5">
              {visibleCourts.length} cancha{visibleCourts.length !== 1 ? "s" : ""} · {stats.total} turnos disponibles
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Navegación de fecha */}
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
                  ? "bg-white text-[hsl(213,64%,17%)] hover:bg-white/90"
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
              onClick={() => { setLoading(true); fetchBookings(); }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Filtro por cancha + Stats ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Filtro */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedCourt}
            onChange={(e) => setSelectedCourt(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
          >
            <option value="all">Todas las canchas</option>
            {courts.filter((c) => c.is_active).map((c) => (
              <option key={c.id} value={c.id}>{c.name} — {c.sport}</option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 rounded-lg px-2.5 py-1 text-xs font-medium">
            <CalendarCheck className="h-3 w-3" />
            {stats.occupied} reservados
          </div>
          <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 rounded-lg px-2.5 py-1 text-xs font-medium">
            <Clock className="h-3 w-3" />
            {stats.free} libres
          </div>
          {stats.pendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-lg px-2.5 py-1 text-xs font-medium">
              <AlertCircle className="h-3 w-3" />
              {stats.pendingCount} pendientes
            </div>
          )}
          {stats.señaPending > 0 && (
            <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 rounded-lg px-2.5 py-1 text-xs font-medium">
              <DollarSign className="h-3 w-3" />
              {stats.señaPending} sin seña
            </div>
          )}

          {/* Barra de ocupación */}
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.occupancyPct}%`,
                  background:
                    stats.occupancyPct > 80
                      ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                      : stats.occupancyPct > 50
                        ? "linear-gradient(90deg, #34d399, #f59e0b)"
                        : "linear-gradient(90deg, #0ea5e9, #34d399)",
                }}
              />
            </div>
            <span className="text-xs font-bold text-muted-foreground">{stats.occupancyPct}%</span>
          </div>
        </div>
      </div>

      {/* ─── Loading ─── */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(158,69%,52%)] border-t-transparent" />
        </div>
      )}

      {/* ─── Grilla por cancha ─── */}
      {!loading && courtSlots.map(({ court, slots, isWorkDay }) => (
        <div key={court.id} className="space-y-2">
          {/* Título de cancha */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[hsl(158,69%,52%)]" />
              <h2 className="text-base font-bold text-foreground">{court.name}</h2>
            </div>
            <span className="text-xs text-muted-foreground">{court.sport}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">${court.price_per_hour.toLocaleString("es-AR")}/turno</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{court.slot_duration ?? 60} min</span>
            {court.seña_required && (
              <>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Seña ${court.seña_amount?.toLocaleString("es-AR")}
                </span>
              </>
            )}
          </div>

          {!isWorkDay ? (
            <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">Sin horarios configurados para este día</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {slots.map((slot) => {
                const bk = slot.booking;
                const slotKey = `${court.id}-${slot.time}`;
                const isExpanded = expandedSlot === slotKey;

                if (!bk) {
                  /* ─── Slot disponible ─── Verde BookMe — click para tomar turno */
                  return (
                    <div
                      key={slotKey}
                      onClick={() => openBookingModal(court, slot.time)}
                      className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 transition-all hover:bg-emerald-100 dark:hover:bg-emerald-950/40 hover:border-emerald-400 cursor-pointer group"
                    >
                      <span className="text-sm font-mono font-bold text-emerald-700 dark:text-emerald-300 w-11">
                        {slot.time}
                      </span>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex-1">
                        Disponible
                      </span>
                      <Plus className="h-4 w-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  );
                }

                /* ─── Slot reservado ─── */
                const isCancelled = bk.status === "cancelled";
                const isPending = bk.status === "pending";
                const isConfirmed = bk.status === "confirmed";
                const isCompleted = bk.status === "completed";
                const señaPending = bk.courts?.seña_required && !bk.seña_paid;

                // Estilos por estado
                const cardStyles = isCancelled
                  ? "border-l-gray-400 bg-gray-50/60 dark:bg-gray-950/15 border-gray-200 dark:border-gray-800 opacity-50"
                  : isCompleted
                    ? "border-l-[hsl(213,64%,17%)] bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    : señaPending
                      ? "border-l-rose-600 bg-rose-50/80 dark:bg-rose-950/25 border-rose-300 dark:border-rose-800"
                      : isPending
                        ? "border-l-amber-500 bg-amber-50/80 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800"
                        : "border-l-red-600 bg-red-50/70 dark:bg-red-950/25 border-red-200 dark:border-red-800";

                const statusBadge = isCancelled
                  ? { label: "Cancelada", cls: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" }
                  : isCompleted
                    ? { label: "Finalizado ✓", cls: "bg-[hsl(213,64%,17%)] text-white" }
                    : isConfirmed
                      ? { label: "Confirmada", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
                      : señaPending
                        ? { label: "Seña pendiente", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" }
                        : { label: "Pendiente", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };

                return (
                  <div
                    key={slotKey}
                    className={cn(
                      "rounded-lg border border-l-4 overflow-hidden transition-all cursor-pointer hover:shadow-md",
                      cardStyles,
                      isExpanded && "ring-2 ring-[hsl(213,64%,17%)]/30 dark:ring-[hsl(158,69%,52%)]/30"
                    )}
                    onClick={() => setExpandedSlot(isExpanded ? null : slotKey)}
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
                          {bk.customer_name.toUpperCase()}
                        </p>
                        <span className={cn("shrink-0 px-2 py-0.5 rounded text-[10px] font-bold", statusBadge.cls)}>
                          {statusBadge.label}
                        </span>
                      </div>

                      {/* Hora range + Seña indicator */}
                      <div className="flex items-center gap-2 mt-1 pl-[52px]">
                        <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(bk.start_time)}–{formatTime(bk.end_time)}
                        </span>
                        {bk.total_amount && bk.total_amount > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">
                              ${bk.total_amount.toLocaleString("es-AR")}
                            </span>
                          </>
                        )}
                        {/* Indicador de seña */}
                        {bk.courts?.seña_required && (
                          <>
                            <span className="text-xs text-muted-foreground/40">·</span>
                            {bk.seña_paid ? (
                              <span className="flex items-center gap-0.5 text-[11px] font-bold text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3" />
                                SEÑA OK
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 animate-pulse">
                                <DollarSign className="h-3 w-3" />
                                SIN SEÑA
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Teléfono */}
                      {bk.customer_phone && (
                        <div className="flex items-center gap-1 mt-1 pl-[52px]">
                          <Phone className="h-3 w-3 text-muted-foreground/40" />
                          <span className="text-[11px] text-muted-foreground">{bk.customer_phone}</span>
                        </div>
                      )}
                    </div>

                    {/* ─── Detalle expandido ─── */}
                    {isExpanded && (
                      <div className="border-t border-inherit px-3.5 py-3 bg-white/60 dark:bg-black/10 space-y-2.5">
                        {/* Contacto */}
                        <div className="flex flex-wrap gap-3 text-xs">
                          {bk.customer_phone && (
                            <a
                              href={`https://wa.me/${bk.customer_phone.replace(/\D/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-green-600 hover:text-green-800 dark:text-green-400 font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </a>
                          )}
                          {bk.customer_email && (
                            <a
                              href={`mailto:${bk.customer_email}`}
                              className="flex items-center gap-1 text-sky-600 hover:text-sky-800 dark:text-sky-400 font-medium"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3" />
                              Email
                            </a>
                          )}
                        </div>

                        {/* Seña detallada */}
                        {bk.courts?.seña_required && !bk.seña_paid && !isCancelled && !isCompleted && (() => {
                          const total = Number(bk.total_amount) || 0;
                          const seña = Number(bk.seña_amount) || 0;
                          const resta = total - seña;
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800">
                                <DollarSign className="h-4 w-4 text-rose-600" />
                                <span className="text-rose-700 dark:text-rose-300 font-medium">
                                  Seña ${seña.toLocaleString("es-AR")} — Pendiente de pago
                                </span>
                              </div>
                              {resta > 0 && (
                                <div className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Total turno: ${total.toLocaleString("es-AR")} · Resta: ${resta.toLocaleString("es-AR")}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {bk.courts?.seña_required && bk.seña_paid && !isCompleted && (() => {
                          const total = Number(bk.total_amount) || 0;
                          const seña = Number(bk.seña_amount) || 0;
                          const resta = total - seña;
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <span className="text-green-700 dark:text-green-300 font-medium">
                                  Seña ${seña.toLocaleString("es-AR")} — Pagada ✓
                                </span>
                              </div>
                              {resta > 0 && (
                                <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                  <span className="text-amber-700 dark:text-amber-300 font-bold">
                                    Resta por cobrar: ${resta.toLocaleString("es-AR")}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Pago completado indicator */}
                        {isCompleted && (() => {
                          const total = Number(bk.total_amount) || 0;
                          const seña = bk.seña_paid ? (Number(bk.seña_amount) || 0) : 0;
                          const resta = total - seña;
                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-[hsl(213,64%,17%)]/10 dark:bg-[hsl(213,64%,17%)]/30 border border-[hsl(213,64%,17%)]/20">
                                <DollarSign className="h-4 w-4 text-[hsl(213,64%,17%)] dark:text-blue-300" />
                                <div className="text-[hsl(213,64%,17%)] dark:text-blue-200">
                                  <span className="font-bold">FINALIZADO — Total ${total.toLocaleString("es-AR")}</span>
                                  {seña > 0 && (
                                    <span className="ml-2 font-normal">
                                      (Seña ${seña.toLocaleString("es-AR")} + Resta ${resta.toLocaleString("es-AR")})
                                    </span>
                                  )}
                                </div>
                              </div>
                              {seña > 0 && resta > 0 && (
                                <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                  <span className="text-amber-700 dark:text-amber-300 font-bold">
                                    Cobrar en cancha: ${resta.toLocaleString("es-AR")}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {bk.notes && (
                          <p className="text-xs text-muted-foreground bg-gray-50 dark:bg-gray-900/50 rounded p-2 italic">
                            {bk.notes}
                          </p>
                        )}

                        {/* Acciones */}
                        {!isCancelled && !isCompleted && (
                          <div className="flex flex-wrap gap-1.5">
                            {/* Seña pendiente → Confirmar seña (paga seña + confirma reserva) */}
                            {señaPending && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-[hsl(213,64%,17%)] hover:bg-[hsl(213,50%,28%)] text-white"
                                onClick={(e) => { e.stopPropagation(); handleMarkSeñaPaid(bk.id); }}
                                disabled={updating === bk.id}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                {updating === bk.id ? "..." : "Confirmar Seña"}
                              </Button>
                            )}
                            {/* Sin seña requerida y pendiente → Confirmar reserva directamente */}
                            {isPending && !señaPending && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-[hsl(213,64%,17%)] hover:bg-[hsl(213,50%,28%)] text-white"
                                onClick={(e) => { e.stopPropagation(); handleStatusChange(bk.id, "confirmed"); }}
                                disabled={updating === bk.id}
                              >
                                <CheckCircle2 className="mr-1 h-3 w-3" />
                                Confirmar
                              </Button>
                            )}
                            {/* Finalizar → jugaron y pagaron total */}
                            {(isConfirmed || isPending) && (
                              <Button
                                size="sm"
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={(e) => { e.stopPropagation(); handleComplete(bk.id); }}
                                disabled={updating === bk.id}
                              >
                                <DollarSign className="mr-1 h-3 w-3" />
                                {updating === bk.id ? "..." : "Finalizar"}
                              </Button>
                            )}
                            {/* Cancelar siempre disponible */}
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); handleStatusChange(bk.id, "cancelled"); }}
                              disabled={updating === bk.id}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Cancelar
                            </Button>
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
      ))}

      {/* Sin canchas */}
      {!loading && visibleCourts.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-border p-16 text-center">
          <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground/40" />
          <p className="mt-4 text-lg font-medium text-muted-foreground">No hay canchas configuradas</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Agregá tus canchas desde "Mis Canchas" para empezar a ver la disponibilidad.
          </p>
        </div>
      )}

      {/* ─── Modal: Tomar turno ─── */}
      {bookingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[hsl(213,64%,17%)] to-[hsl(213,50%,28%)] px-5 py-4 text-white flex items-center justify-between">
              <div>
                <p className="text-emerald-300 text-[10px] font-bold uppercase tracking-widest">Nuevo turno</p>
                <h3 className="text-lg font-bold">
                  {bookingModal.courtName} — {bookingModal.time} a {bookingModal.endTime}
                </h3>
                <p className="text-blue-200 text-xs mt-0.5">
                  {format(selectedDate, "EEEE d 'de' MMMM yyyy", { locale: es })}
                </p>
              </div>
              <button
                onClick={() => setBookingModal(null)}
                className="p-1 rounded-lg hover:bg-white/20 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Formulario */}
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Nombre del cliente *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={bookingForm.customer_name}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Nombre y apellido"
                    className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(158,69%,52%)] focus:border-transparent"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Teléfono
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={bookingForm.customer_phone}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    placeholder="Ej: 1133560954"
                    className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(158,69%,52%)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    value={bookingForm.customer_email}
                    onChange={(e) => setBookingForm((f) => ({ ...f, customer_email: e.target.value }))}
                    placeholder="cliente@email.com"
                    className="w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(158,69%,52%)] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Notas
                </label>
                <textarea
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Notas opcionales..."
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(158,69%,52%)] focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border px-5 py-4 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBookingModal(null)}
                disabled={creatingBooking}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-[hsl(213,64%,17%)] hover:bg-[hsl(213,50%,28%)] text-white"
                onClick={handleCreateBooking}
                disabled={creatingBooking || !bookingForm.customer_name.trim()}
              >
                {creatingBooking ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Tomar turno
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
