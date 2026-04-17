"use client";

import { Fragment } from "react";
import { Calendar, Clock, Video, MapPin, Check, QrCode, Users, Phone, Sparkles } from "lucide-react";

// Mockups estilizados que representan pantallas reales del sistema.
// Se usan en el carousel de la landing para mostrar cómo se ve BookMe
// sin requerir screenshots reales (fácil de mantener, siempre alineado con la marca).

export function BrowserFrame({ children, url = "bookme.ar/dashboard" }: { children: React.ReactNode; url?: string }) {
  return (
    <div className="rounded-xl overflow-hidden shadow-2xl border border-border bg-card">
      {/* Barra del navegador */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-muted border-b border-border">
        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-0.5 rounded bg-background text-[10px] text-muted-foreground max-w-[200px] truncate">
            {url}
          </div>
        </div>
      </div>
      {/* Contenido */}
      <div className="bg-background">{children}</div>
    </div>
  );
}

// Mockup 1 — Vista de Agenda semanal
export function AgendaMockup() {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie"];
  const hours = ["09", "10", "11", "12"];
  const appointments = [
    { day: 0, hour: 0, name: "María López", virtual: false, color: "bg-blue-100 dark:bg-blue-900/40 border-blue-400" },
    { day: 1, hour: 1, name: "Juan Pérez", virtual: true, color: "bg-purple-100 dark:bg-purple-900/40 border-purple-400" },
    { day: 2, hour: 0, name: "Ana García", virtual: false, color: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-400" },
    { day: 3, hour: 2, name: "Carlos Ruiz", virtual: true, color: "bg-amber-100 dark:bg-amber-900/40 border-amber-400" },
    { day: 4, hour: 1, name: "Lucía M.", virtual: false, color: "bg-rose-100 dark:bg-rose-900/40 border-rose-400" },
  ];
  return (
    <BrowserFrame url="bookme.ar/dashboard/agenda">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold">Mi Agenda</h3>
            <p className="text-[10px] text-muted-foreground">Semana del 15 al 19</p>
          </div>
          <div className="flex gap-1">
            <div className="px-2 py-1 rounded bg-primary text-primary-foreground text-[10px] font-medium">Semana</div>
            <div className="px-2 py-1 rounded bg-muted text-[10px]">Mes</div>
          </div>
        </div>
        {/* Grid de horarios */}
        <div className="grid grid-cols-6 gap-1 text-[9px]">
          <div /> {/* Esquina vacía */}
          {days.map((d) => (
            <div key={d} className="text-center font-medium py-1 text-muted-foreground">{d}</div>
          ))}
          {hours.map((h, hIdx) => (
            <Fragment key={`row-${h}`}>
              <div className="text-right pr-1 text-muted-foreground self-center">{h}:00</div>
              {days.map((_, dIdx) => {
                const apt = appointments.find((a) => a.day === dIdx && a.hour === hIdx);
                return (
                  <div
                    key={`${hIdx}-${dIdx}`}
                    className={`h-10 rounded border ${apt ? apt.color : "border-dashed border-border/40"} p-1 flex flex-col justify-between`}
                  >
                    {apt && (
                      <>
                        <div className="flex items-start justify-between gap-0.5">
                          <span className="text-[8px] font-semibold truncate leading-tight">{apt.name}</span>
                          {apt.virtual ? (
                            <Video className="w-2 h-2 shrink-0 text-blue-500" />
                          ) : (
                            <MapPin className="w-2 h-2 shrink-0 text-muted-foreground/60" />
                          )}
                        </div>
                        <Clock className="w-2 h-2 text-muted-foreground/60" />
                      </>
                    )}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

// Mockup 2 — Vista Hoy con botón de videoconsulta
export function HoyMockup() {
  const slots = [
    { time: "09:00", name: "MARÍA LÓPEZ", service: "Consulta General", virtual: true, status: "Confirmado", statusColor: "bg-teal-100 text-teal-700", next: false },
    { time: "09:30", name: "JUAN PÉREZ", service: "Primera vez", virtual: false, status: "Pendiente", statusColor: "bg-amber-100 text-amber-700", next: true },
    { time: "10:00", name: "ANA GARCÍA", service: "Control", virtual: true, status: "Confirmado", statusColor: "bg-teal-100 text-teal-700", next: false },
  ];
  return (
    <BrowserFrame url="bookme.ar/dashboard/agenda/hoy">
      <div className="p-4">
        <div className="mb-3">
          <h3 className="text-sm font-bold">Agenda Diaria</h3>
          <p className="text-[10px] text-muted-foreground">Lunes 20 de Abril · 8 turnos</p>
        </div>
        <div className="space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.time}
              className={`rounded-md border border-l-4 border-l-teal-500 bg-teal-50/50 dark:bg-teal-950/20 p-2 ${
                slot.next ? "ring-2 ring-blue-500" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold text-foreground/80 w-10">{slot.time}</span>
                <span className="text-[11px] font-bold text-foreground flex-1 truncate">{slot.name}</span>
                {slot.next && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-600 text-white animate-pulse">
                    Próximo
                  </span>
                )}
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${slot.statusColor}`}>
                  {slot.status}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 pl-12 text-[10px] text-muted-foreground">
                <span>{slot.service}</span>
                <span className="opacity-40">·</span>
                {slot.virtual ? (
                  <Video className="w-2.5 h-2.5 text-blue-500" />
                ) : (
                  <MapPin className="w-2.5 h-2.5" />
                )}
              </div>
              {slot.virtual && (
                <div className="mt-1.5 pl-12">
                  <div className="inline-flex items-center gap-1 rounded bg-blue-600 text-white px-2 py-0.5 text-[9px] font-semibold">
                    <Video className="w-2.5 h-2.5" />
                    Entrar a la videoconsulta
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

// Mockup 3 — Flujo público de reserva
export function BookingMockup() {
  const times = ["09:00", "09:15", "09:30", "10:00", "10:15", "10:30", "11:00", "11:15"];
  return (
    <BrowserFrame url="bookme.ar/book/dra-lopez">
      <div className="p-4">
        <div className="flex items-center justify-center gap-1 mb-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex items-center">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  n < 3
                    ? "bg-emerald-500 text-white"
                    : n === 3
                    ? "bg-bookme-navy text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {n < 3 ? <Check className="w-3 h-3" /> : n}
              </div>
              {n < 4 && <div className={`w-8 h-0.5 ${n < 3 ? "bg-emerald-500" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <h3 className="text-sm font-bold mb-1">Seleccioná un horario</h3>
        <p className="text-[10px] text-muted-foreground mb-3">Martes 21 de abril</p>
        <div className="grid grid-cols-4 gap-1.5">
          {times.map((t, i) => (
            <button
              key={t}
              className={`py-1.5 rounded text-[10px] font-semibold transition-all ${
                i === 2
                  ? "bg-bookme-navy text-white shadow-md scale-105"
                  : "bg-muted/60 hover:bg-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-1.5 text-[10px] text-blue-700 dark:text-blue-300">
            <Video className="w-3 h-3" />
            <span className="font-medium">Videoconsulta · el link llega por email</span>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

// Mockup 4 — Videoconsulta activa + notificación
export function MeetMockup() {
  return (
    <BrowserFrame url="meet.jit.si/bookme-abc123">
      <div className="relative bg-slate-900 aspect-[16/10] flex items-center justify-center">
        {/* Video principal simulado */}
        <div className="absolute inset-2 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
            ML
          </div>
        </div>
        {/* Video pequeño */}
        <div className="absolute bottom-3 right-3 w-16 h-12 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white shadow-lg flex items-center justify-center">
          <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-white text-[10px] font-bold">
            JD
          </div>
        </div>
        {/* Barra de controles */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
            <Video className="w-3 h-3 text-white" />
          </div>
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <Phone className="w-3 h-3 text-white" />
          </div>
        </div>
        {/* Badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-semibold">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          En vivo
        </div>
        {/* Info */}
        <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-white/10 backdrop-blur text-white text-[10px]">
          <Sparkles className="w-3 h-3 inline mr-1" />
          Videoconsulta · gratis
        </div>
      </div>
    </BrowserFrame>
  );
}

// Mockup 5 — Perfil público con QR y link directo
export function ProfileMockup() {
  return (
    <BrowserFrame url="bookme.ar/@dra-lopez">
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-lg font-bold shrink-0">
            ML
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold">Dra. María López</h3>
            <p className="text-[10px] text-muted-foreground">Dermatóloga · CABA</p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-2.5 h-2.5 text-amber-400">★</div>
              ))}
              <span className="text-[9px] text-muted-foreground ml-1">4.9 · 128 reseñas</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded border-2 border-foreground/20 p-0.5 flex items-center justify-center">
            <QrCode className="w-full h-full" />
          </div>
        </div>
        <div className="rounded-md bg-muted/40 p-2 mb-2 text-[10px] text-center font-mono">
          bookme.ar/@dra-lopez
        </div>
        <div className="space-y-1.5">
          {["Consulta General · 15 min", "Control anual · 30 min", "Videoconsulta · 20 min"].map((s, i) => (
            <div key={s} className="flex items-center justify-between rounded-md border border-border bg-card p-2">
              <span className="text-[10px] font-medium">{s}</span>
              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                i === 0 ? "bg-bookme-navy text-white" : "bg-muted text-muted-foreground"
              }`}>
                {i === 0 ? "Reservar" : "Ver"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  );
}

// Mockup 6 — Panel MIA (chat IA)
export function MiaMockup() {
  return (
    <BrowserFrame url="bookme.ar/dashboard · MIA">
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-bold">MIA · Tu asistente IA</h3>
            <p className="text-[9px] text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              En línea
            </p>
          </div>
        </div>
        {/* Mensajes */}
        <div className="rounded-lg bg-muted/50 p-2 text-[10px]">
          <div className="text-muted-foreground mb-0.5">Tú</div>
          Agendame a Juan Pérez mañana a las 15hs
        </div>
        <div className="rounded-lg bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 p-2 text-[10px]">
          <div className="text-purple-700 dark:text-purple-400 mb-0.5 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            MIA
          </div>
          Encontré disponibilidad. Turno con Juan Pérez mañana 15:00–15:15, Consulta General. ¿Confirmo?
        </div>
        <div className="flex gap-1.5">
          <div className="px-2 py-1 rounded bg-bookme-navy text-white text-[9px] font-semibold">Sí, confirmar</div>
          <div className="px-2 py-1 rounded bg-muted text-[9px]">Cambiar horario</div>
        </div>
      </div>
    </BrowserFrame>
  );
}
