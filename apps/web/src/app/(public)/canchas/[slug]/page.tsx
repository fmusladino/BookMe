"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  MapPin, Phone, MessageCircle, Clock, DollarSign, Users,
  Calendar, ChevronLeft, ChevronRight, CheckCircle, Dribbble,
  AlertCircle, Info,
} from "lucide-react";

const DAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface CourtSchedule {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Court {
  id: string;
  name: string;
  description?: string;
  sport: string;
  surface?: string;
  players?: number;
  price_per_hour: number;
  seña_required: boolean;
  seña_amount?: number;
  seña_alias?: string;
  is_active: boolean;
  court_schedules: CourtSchedule[];
}

interface CourtOwner {
  id: string;
  business_name: string;
  slug: string;
  description?: string;
  address?: string;
  city: string;
  province: string;
  phone?: string;
  whatsapp?: string;
}

type Step = "select-court" | "select-slot" | "form" | "success";

interface BookingForm {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes: string;
}

// Genera slots de 1 hora entre start_time y end_time del horario de la cancha
function generateTimeSlots(startTime: string, endTime: string, durationH = 1): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let current = (sh ?? 0) * 60 + (sm ?? 0);
  const end = (eh ?? 0) * 60 + (em ?? 0) - durationH * 60;
  while (current <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, "0");
    const m = (current % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    current += 60; // incrementos de 1 hora
  }
  return slots;
}

function addHour(time: string, hours = 1): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + hours * 60;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
}

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export default function CanchasPublicPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [owner, setOwner] = useState<CourtOwner | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Flujo de reserva
  const [step, setStep] = useState<Step>("select-court");
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [form, setForm] = useState<BookingForm>({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ id: string; seña_info: { required: boolean; amount?: number } } | null>(null);

  // Cargar datos del complejo
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/court-owners/${slug}`);
        if (!res.ok) { setNotFound(true); return; }
        const data = await res.json() as { owner: CourtOwner; courts: Court[] };
        setOwner(data.owner);
        setCourts(data.courts);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  // Cargar turnos reservados cuando se selecciona cancha + fecha
  useEffect(() => {
    if (!selectedCourt || !selectedDate) return;
    const dateStr = selectedDate.toISOString().split("T")[0];
    const fetchBooked = async () => {
      try {
        const res = await fetch(`/api/court-bookings?court_id=${selectedCourt.id}&date=${dateStr}`);
        if (!res.ok) return;
        const data = await res.json() as { bookings: Array<{ start_time: string; status: string }> };
        const occupied = data.bookings
          .filter((b) => b.status !== "cancelled")
          .map((b) => b.start_time.slice(0, 5));
        setBookedSlots(occupied);
      } catch {
        setBookedSlots([]);
      }
    };
    fetchBooked();
  }, [selectedCourt, selectedDate]);

  const handleSelectCourt = (court: Court) => {
    setSelectedCourt(court);
    setSelectedDate(null);
    setSelectedSlot(null);
    setWeekOffset(0);
    setStep("select-slot");
  };

  const handleSelectSlot = (date: Date, slot: string) => {
    setSelectedDate(date);
    setSelectedSlot(slot);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt || !selectedDate || !selectedSlot) return;
    if (!form.customer_name.trim()) { alert("El nombre es requerido"); return; }

    setSubmitting(true);
    try {
      const dateStr = selectedDate.toISOString().split("T")[0];
      const endTime = addHour(selectedSlot, 1);

      const res = await fetch("/api/court-bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court_id: selectedCourt.id,
          customer_name: form.customer_name,
          customer_phone: form.customer_phone || undefined,
          customer_email: form.customer_email || undefined,
          booking_date: dateStr,
          start_time: selectedSlot,
          end_time: endTime,
          notes: form.notes || undefined,
        }),
      });

      const data = await res.json() as {
        booking: { id: string };
        seña_info: { required: boolean; amount?: number };
        error?: string;
      };

      if (!res.ok) {
        alert(data.error || "Error al crear la reserva");
        return;
      }

      setBookingResult({ id: data.booking.id, seña_info: data.seña_info });
      setStep("success");
    } catch {
      alert("Error al crear la reserva. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (notFound || !owner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-4">
        <Dribbble className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Complejo no encontrado</h1>
        <p className="text-muted-foreground text-center">
          El link que seguiste no existe o el complejo está inactivo.
        </p>
        <Link href="/" className="text-sm font-medium text-primary hover:underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center">
              <span className="text-white dark:text-bookme-navy font-bold text-sm">B</span>
            </div>
            <span className="font-heading font-bold text-bookme-navy dark:text-bookme-mint">BookMe</span>
          </Link>
          <span className="text-sm text-muted-foreground hidden sm:block">Reservas deportivas</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Info del complejo */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center shrink-0">
              <Dribbble className="h-7 w-7 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground">{owner.business_name}</h1>
              {owner.description && (
                <p className="text-muted-foreground mt-1">{owner.description}</p>
              )}
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                {(owner.city || owner.province) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {[owner.city, owner.province].filter(Boolean).join(", ")}
                  </span>
                )}
                {owner.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {owner.address}
                  </span>
                )}
                {owner.phone && (
                  <a href={`tel:${owner.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" />
                    {owner.phone}
                  </a>
                )}
                {owner.whatsapp && (
                  <a
                    href={`https://wa.me/${owner.whatsapp.replace(/\D/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-green-600 dark:text-green-400 hover:underline"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* STEP: Seleccionar cancha */}
        {step === "select-court" && (
          <section className="space-y-4">
            <h2 className="text-xl font-bold">Seleccioná una cancha</h2>
            {courts.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <Dribbble className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Este complejo aún no tiene canchas disponibles.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {courts.map((court) => (
                  <button
                    key={court.id}
                    onClick={() => handleSelectCourt(court)}
                    className="group text-left rounded-xl border-2 border-border bg-card p-5 transition-all hover:border-orange-400 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <p className="font-semibold text-foreground">{court.name}</p>
                        <p className="text-sm text-orange-600 dark:text-orange-400">{court.sport}</p>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        ${court.price_per_hour.toLocaleString("es-AR")}/h
                      </span>
                    </div>

                    {court.description && (
                      <p className="text-sm text-muted-foreground mb-3">{court.description}</p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                      {court.surface && (
                        <span className="rounded-md bg-muted px-2 py-1">{court.surface}</span>
                      )}
                      {court.players && (
                        <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                          <Users className="h-3 w-3" />
                          {court.players} jugadores
                        </span>
                      )}
                    </div>

                    {/* Días disponibles */}
                    <div className="flex flex-wrap gap-1">
                      {DAYS_SHORT.map((day, i) =>
                        court.court_schedules.some((s) => s.day_of_week === i) ? (
                          <span key={i} className="rounded px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium">
                            {day}
                          </span>
                        ) : null
                      )}
                    </div>

                    {court.seña_required && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Info className="h-3.5 w-3.5" />
                        Requiere seña de ${court.seña_amount?.toLocaleString("es-AR")}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {/* STEP: Seleccionar fecha y horario */}
        {step === "select-slot" && selectedCourt && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep("select-court"); setSelectedCourt(null); }}
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold">{selectedCourt.name}</h2>
                <p className="text-sm text-muted-foreground">{selectedCourt.sport} · ${selectedCourt.price_per_hour.toLocaleString("es-AR")}/h</p>
              </div>
            </div>

            {/* Navegación de semana */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
                className="rounded-md p-1.5 hover:bg-muted transition-colors disabled:opacity-30"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium text-muted-foreground">
                {weekDates[0]?.toLocaleDateString("es-AR", { day: "numeric", month: "long" })} —{" "}
                {weekDates[6]?.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
              </span>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Grilla de días y slots */}
            <div className="space-y-3">
              {weekDates.map((date) => {
                const dayOfWeek = date.getDay();
                const schedule = selectedCourt.court_schedules.find((s) => s.day_of_week === dayOfWeek);
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
                const isToday = date.toDateString() === new Date().toDateString();
                const slots = schedule ? generateTimeSlots(schedule.start_time, schedule.end_time, 1) : [];

                if (!schedule) return null; // No hay horario para este día

                return (
                  <div key={date.toISOString()} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {DAYS_FULL[dayOfWeek]} {date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                      </span>
                      {isToday && (
                        <span className="rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5 font-medium">Hoy</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot) => {
                        const isBooked = bookedSlots.includes(slot);
                        const slotDateTime = new Date(date);
                        const [sh, sm] = slot.split(":").map(Number);
                        slotDateTime.setHours(sh ?? 0, sm ?? 0, 0, 0);
                        const isInPast = slotDateTime < new Date();

                        return (
                          <button
                            key={slot}
                            disabled={isBooked || isInPast || isPast}
                            onClick={() => handleSelectSlot(date, slot)}
                            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                              isBooked || isInPast || isPast
                                ? "bg-muted text-muted-foreground opacity-50 cursor-not-allowed line-through"
                                : "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:border-orange-400"
                            }`}
                          >
                            {slot}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP: Formulario de reserva */}
        {step === "form" && selectedCourt && selectedDate && selectedSlot && (
          <section className="space-y-5">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep("select-slot")}
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h2 className="text-xl font-bold">Confirmar reserva</h2>
            </div>

            {/* Resumen */}
            <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-5 space-y-2">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                Resumen de la reserva
              </p>
              <p className="font-semibold text-foreground text-lg">{selectedCourt.name}</p>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {selectedDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {selectedSlot} — {addHour(selectedSlot, 1)}
                </span>
                {selectedCourt.price_per_hour > 0 && (
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4" />
                    ${selectedCourt.price_per_hour.toLocaleString("es-AR")}/hora
                  </span>
                )}
              </div>
              {selectedCourt.seña_required && (
                <div className="mt-2 rounded-md bg-amber-100 dark:bg-amber-900/30 px-3 py-2 text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Esta cancha requiere una seña de <strong>${selectedCourt.seña_amount?.toLocaleString("es-AR")}</strong>.
                    {selectedCourt.seña_alias && (
                      <> Podés enviarla al alias <strong>{selectedCourt.seña_alias}</strong>.</>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="bg-card border border-border rounded-xl p-6 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tus datos</p>

              <div className="space-y-1.5">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Nombre completo *
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  placeholder="Juan Pérez"
                  value={form.customer_name}
                  onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    placeholder="+54 9 11 1234-5678"
                    value={form.customer_phone}
                    onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email (opcional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={form.customer_email}
                    onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="notes" className="text-sm font-medium text-foreground">
                  Notas adicionales (opcional)
                </label>
                <textarea
                  id="notes"
                  rows={2}
                  placeholder="Ej: venimos 10 personas, queremos arcos de fútbol..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {submitting ? "Reservando..." : "Confirmar reserva"}
              </button>
            </form>
          </section>
        )}

        {/* STEP: Éxito */}
        {step === "success" && selectedCourt && selectedDate && selectedSlot && bookingResult && (
          <section className="space-y-5">
            <div className="rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/20 p-8 text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">¡Reserva enviada!</h2>
                <p className="text-muted-foreground mt-1">
                  Tu reserva fue enviada correctamente. El complejo la confirmará a la brevedad.
                </p>
              </div>

              <div className="rounded-lg bg-background border border-border p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cancha</span>
                  <span className="font-medium">{selectedCourt.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {selectedDate.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horario</span>
                  <span className="font-medium">{selectedSlot} — {addHour(selectedSlot, 1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nombre</span>
                  <span className="font-medium">{form.customer_name}</span>
                </div>
              </div>

              {/* Info de seña */}
              {bookingResult.seña_info.required && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 text-left space-y-2">
                  <p className="font-semibold text-amber-700 dark:text-amber-300">
                    Enviá la seña para confirmar tu reserva
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Monto: <strong>${bookingResult.seña_info.amount?.toLocaleString("es-AR")}</strong>
                  </p>
                  {selectedCourt.seña_alias && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      Alias: <strong>{selectedCourt.seña_alias}</strong>
                    </p>
                  )}
                  {owner?.whatsapp && (
                    <a
                      href={`https://wa.me/${owner.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola! Acabo de reservar la ${selectedCourt.name} el ${selectedDate.toLocaleDateString("es-AR")} a las ${selectedSlot}hs. El comprobante de la seña es...`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 mt-2 rounded-md bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Enviar comprobante por WhatsApp
                    </a>
                  )}
                </div>
              )}

              <button
                onClick={() => {
                  setStep("select-court");
                  setSelectedCourt(null);
                  setSelectedDate(null);
                  setSelectedSlot(null);
                  setForm({ customer_name: "", customer_phone: "", customer_email: "", notes: "" });
                  setBookingResult(null);
                }}
                className="mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors underline"
              >
                Hacer otra reserva
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          Reservas online con{" "}
          <Link href="/" className="font-medium text-bookme-navy dark:text-bookme-mint hover:underline">
            BookMe
          </Link>
        </div>
      </footer>
    </div>
  );
}
