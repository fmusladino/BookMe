"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  AgendaMockup,
  HoyMockup,
  BookingMockup,
  MeetMockup,
  ProfileMockup,
  MiaMockup,
} from "./app-mockup";

const SLIDES = [
  {
    title: "Agenda visual semana/mes",
    description: "Mirá tu disponibilidad de un vistazo. Drag & drop, bloqueos y modo vacaciones.",
    Mockup: AgendaMockup,
    accent: "from-blue-500/20 to-purple-500/20",
  },
  {
    title: "Vista del día — optimizada para atender",
    description: "Turnos del día con botón directo a la videoconsulta. Badge 'Próximo' cuando se acerca la hora.",
    Mockup: HoyMockup,
    accent: "from-teal-500/20 to-emerald-500/20",
  },
  {
    title: "Reserva online desde tu perfil público",
    description: "Tus pacientes eligen horario y confirman en 30 segundos. Sin llamadas, sin idas y vueltas.",
    Mockup: BookingMockup,
    accent: "from-indigo-500/20 to-blue-500/20",
  },
  {
    title: "Videoconsultas gratis, sin instalación",
    description: "Al reservar virtual, generamos el link automáticamente. Funciona en cualquier navegador.",
    Mockup: MeetMockup,
    accent: "from-purple-500/20 to-pink-500/20",
  },
  {
    title: "Tu marca propia en el directorio",
    description: "Link directo bookme.ar/@tunombre + QR imprimible. Compartilo por redes y WhatsApp.",
    Mockup: ProfileMockup,
    accent: "from-amber-500/20 to-orange-500/20",
  },
  {
    title: "MIA — tu asistente con IA",
    description: "Agendá, cancelá o consultá tu agenda hablándole como a un humano. Siempre disponible.",
    Mockup: MiaMockup,
    accent: "from-fuchsia-500/20 to-purple-500/20",
  },
];

export function LandingCarousel() {
  const [idx, setIdx] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Auto-rotate cada 5s si el mouse no está encima
  useEffect(() => {
    if (isHovering) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, [isHovering]);

  const slide = SLIDES[idx];
  const { Mockup } = slide;

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Gradiente de fondo que cambia según la slide */}
      <div
        className={`absolute inset-0 -z-10 bg-gradient-to-br ${slide.accent} blur-3xl opacity-60 transition-all duration-700 rounded-[3rem]`}
      />

      <div className="grid lg:grid-cols-5 gap-8 items-center">
        {/* Texto descriptivo */}
        <div className="lg:col-span-2 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-bookme-navy/10 dark:bg-bookme-mint/10 px-3 py-1 text-xs font-semibold text-bookme-navy dark:text-bookme-mint">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {idx + 1} de {SLIDES.length}
          </div>
          <h3 key={`t-${idx}`} className="text-2xl sm:text-3xl font-heading font-bold leading-tight animate-in fade-in slide-in-from-left-4 duration-500">
            {slide.title}
          </h3>
          <p key={`d-${idx}`} className="text-muted-foreground animate-in fade-in slide-in-from-left-4 duration-500">
            {slide.description}
          </p>

          {/* Controles */}
          <div className="flex items-center gap-2 pt-4">
            <button
              onClick={() => setIdx((i) => (i - 1 + SLIDES.length) % SLIDES.length)}
              className="w-9 h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % SLIDES.length)}
              className="w-9 h-9 rounded-full border border-border hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="flex gap-1.5 ml-3">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-8 bg-bookme-navy dark:bg-bookme-mint" : "w-1.5 bg-muted-foreground/30"
                  }`}
                  aria-label={`Ir a slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Mockup */}
        <div className="lg:col-span-3">
          <div
            key={`m-${idx}`}
            className="animate-in fade-in zoom-in-95 duration-500"
          >
            <Mockup />
          </div>
        </div>
      </div>
    </div>
  );
}
