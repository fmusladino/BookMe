"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot,
  ArrowRight,
  ArrowLeft,
  X,
  Calendar,
  Clock,
  Users,
  FileText,
  BarChart3,
  Settings,
  QrCode,
  MessageCircle,
  ClipboardList,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Tour steps definition ─────────────────────────────────
interface TourStep {
  id: string;
  /** Selector CSS para encontrar el elemento a destacar */
  targetSelector: string;
  /** Título del paso */
  title: string;
  /** Descripción de MIA */
  description: string;
  /** Icono para el paso */
  icon: React.ReactNode;
  /** Posición del tooltip relativo al target */
  position: "top" | "bottom" | "left" | "right";
  /** Si el paso es crítico (se marca diferente) */
  isCritical?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "sidebar",
    targetSelector: '[data-tour="sidebar"]',
    title: "Tu panel de navegación",
    description:
      "Desde acá accedés a todas las secciones de BookMe. Cada módulo tiene su propio espacio para que gestiones tu negocio fácilmente.",
    icon: <Bot className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "configuracion",
    targetSelector: '[data-tour="nav-configuracion"]',
    title: "⭐ Primero: Configuración",
    description:
      "Este es tu primer paso. Entrá a Configuración para definir tus días y horarios de trabajo, la duración de tus turnos, y cargar tus obras sociales.",
    icon: <Settings className="h-4 w-4" />,
    position: "right",
    isCritical: true,
  },
  {
    id: "servicios",
    targetSelector: '[data-tour="nav-servicios"]',
    title: "⭐ Segundo: Servicios",
    description:
      "Después cargá tus servicios: el tipo de consulta o atención que ofrecés, la duración y el precio. Tus pacientes van a ver esto al reservar.",
    icon: <FileText className="h-4 w-4" />,
    position: "right",
    isCritical: true,
  },
  {
    id: "agenda",
    targetSelector: '[data-tour="nav-agenda"]',
    title: "Tu Agenda",
    description:
      "Acá vas a ver todos tus turnos en formato semanal o mensual. Podés arrastrar turnos para reprogramarlos y ver tu disponibilidad de un vistazo.",
    icon: <Calendar className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "hoy",
    targetSelector: '[data-tour="nav-hoy"]',
    title: "Vista del día",
    description:
      "La vista rápida de hoy te muestra los turnos del día en formato lista, ideal para cuando estás atendiendo.",
    icon: <Clock className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "pacientes",
    targetSelector: '[data-tour="nav-pacientes"]',
    title: "Pacientes / Clientes",
    description:
      "Acá gestionás tu base de pacientes o clientes: datos personales, obra social, historial de turnos y notas.",
    icon: <Users className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "metricas",
    targetSelector: '[data-tour="nav-metricas"]',
    title: "Métricas",
    description:
      "Mirá cómo viene tu negocio: turnos totales, cancelaciones, asistencia y más. Todo en gráficos claros.",
    icon: <BarChart3 className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "qr",
    targetSelector: '[data-tour="nav-mi-qr"]',
    title: "Tu QR y link directo",
    description:
      "Compartí tu link bookme.ar/@tunombre por WhatsApp o redes. También podés imprimir tu QR para el consultorio.",
    icon: <QrCode className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "importar",
    targetSelector: '[data-tour="nav-importar-turnos"]',
    title: "Importar turnos",
    description:
      "Si ya tenés turnos en otro sistema, podés importarlos desde Excel, CSV o Google Calendar sin perder nada.",
    icon: <Upload className="h-4 w-4" />,
    position: "right",
  },
  {
    id: "mia",
    targetSelector: '[data-tour="mia-fab"]',
    title: "Yo soy MIA 😊",
    description:
      "Podés hablarme en cualquier momento para crear turnos, bloquear horarios o consultar tu agenda. ¡Estoy siempre acá abajo a la derecha!",
    icon: <MessageCircle className="h-4 w-4" />,
    position: "top",
  },
];

// ─── Tooltip position calculator ────────────────────────────
function getTooltipStyle(
  rect: DOMRect,
  position: TourStep["position"]
): React.CSSProperties {
  const gap = 16;
  const tooltipWidth = 340;
  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (position) {
    case "right":
      top = rect.top + rect.height / 2;
      left = rect.right + gap;
      // Si se sale por la derecha, ponerlo abajo
      if (left + tooltipWidth > viewportW) {
        top = rect.bottom + gap;
        left = Math.max(16, rect.left);
      }
      break;
    case "left":
      top = rect.top + rect.height / 2;
      left = rect.left - tooltipWidth - gap;
      if (left < 0) {
        top = rect.bottom + gap;
        left = Math.max(16, rect.left);
      }
      break;
    case "top":
      top = rect.top - gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
    case "bottom":
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - tooltipWidth / 2;
      break;
  }

  // Clamp dentro del viewport
  left = Math.max(16, Math.min(left, viewportW - tooltipWidth - 16));
  top = Math.max(16, Math.min(top, viewportH - 250));

  return {
    position: "fixed",
    top: `${top}px`,
    left: `${left}px`,
    width: `${tooltipWidth}px`,
    zIndex: 110,
  };
}

// ─── Component ──────────────────────────────────────────────
interface OnboardingTourProps {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = TOUR_STEPS[currentStep];
  const totalSteps = TOUR_STEPS.length;

  // Encontrar y posicionar el highlight sobre el target
  const updateTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      // Pequeño delay para que el scroll termine
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
      }, 150);
    } else {
      // Si no encuentra el elemento, mostrar centrado
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    updateTarget();
    // Recalcular al hacer resize o scroll
    window.addEventListener("resize", updateTarget);
    window.addEventListener("scroll", updateTarget, true);
    return () => {
      window.removeEventListener("resize", updateTarget);
      window.removeEventListener("scroll", updateTarget, true);
    };
  }, [updateTarget, currentStep]);

  const goNext = () => {
    if (currentStep < totalSteps - 1) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep((s) => s + 1);
        setIsTransitioning(false);
      }, 150);
    } else {
      onComplete();
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentStep((s) => s - 1);
        setIsTransitioning(false);
      }, 150);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        setCurrentStep((s) => {
          if (s < totalSteps - 1) {
            setIsTransitioning(true);
            setTimeout(() => setIsTransitioning(false), 150);
            return s + 1;
          }
          onComplete();
          return s;
        });
      }
      if (e.key === "ArrowLeft") {
        setCurrentStep((s) => {
          if (s > 0) {
            setIsTransitioning(true);
            setTimeout(() => setIsTransitioning(false), 150);
            return s - 1;
          }
          return s;
        });
      }
      if (e.key === "Escape") onComplete();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onComplete, totalSteps]);

  if (!step) return null;

  // Dimensiones del highlight con padding
  const pad = 8;
  const highlightStyle = targetRect
    ? {
        position: "fixed" as const,
        top: `${targetRect.top - pad}px`,
        left: `${targetRect.left - pad}px`,
        width: `${targetRect.width + pad * 2}px`,
        height: `${targetRect.height + pad * 2}px`,
        zIndex: 105,
      }
    : null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Overlay con "hueco" para el target usando box-shadow */}
      <div
        className="fixed inset-0 transition-all duration-300"
        style={{
          zIndex: 100,
          background: "transparent",
          boxShadow: targetRect
            ? `0 0 0 9999px rgba(0, 0, 0, 0.65)`
            : "0 0 0 9999px rgba(0, 0, 0, 0.65)",
          ...(targetRect
            ? {
                position: "fixed",
                top: `${targetRect.top - pad}px`,
                left: `${targetRect.left - pad}px`,
                width: `${targetRect.width + pad * 2}px`,
                height: `${targetRect.height + pad * 2}px`,
                borderRadius: "12px",
              }
            : {
                position: "fixed",
                top: "50%",
                left: "50%",
                width: "1px",
                height: "1px",
              }),
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Borde luminoso alrededor del target */}
      {highlightStyle && (
        <div
          className="rounded-xl transition-all duration-300 pointer-events-none"
          style={{
            ...highlightStyle,
            border: step.isCritical
              ? "2px solid rgb(34 197 94)"
              : "2px solid hsl(var(--primary))",
            boxShadow: step.isCritical
              ? "0 0 20px rgba(34, 197, 94, 0.4)"
              : "0 0 20px rgba(var(--primary), 0.3)",
          }}
        />
      )}

      {/* Tooltip de MIA */}
      <div
        ref={tooltipRef}
        className={cn(
          "transition-all duration-200",
          isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"
        )}
        style={
          targetRect
            ? getTooltipStyle(targetRect, step.position)
            : {
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "340px",
                zIndex: 110,
              }
        }
      >
        <div className="rounded-xl border bg-card shadow-2xl overflow-hidden">
          {/* Header MIA */}
          <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-bookme-navy to-bookme-navy/80 dark:from-bookme-mint/20 dark:to-bookme-mint/10">
            <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">MIA</span>
            <span className="text-xs text-white/60 ml-auto">
              {currentStep + 1} de {totalSteps}
            </span>
            <button
              onClick={onComplete}
              className="rounded-full p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              title="Cerrar tour"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Contenido */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0",
                  step.isCritical
                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {step.icon}
              </div>
              <h3
                className={cn(
                  "text-sm font-semibold",
                  step.isCritical && "text-green-600 dark:text-green-400"
                )}
              >
                {step.title}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Progress bar + botones */}
          <div className="px-4 pb-3 space-y-3">
            {/* Mini progress */}
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-200",
                    i <= currentStep
                      ? "bg-primary"
                      : "bg-muted"
                  )}
                />
              ))}
            </div>

            {/* Botones */}
            <div className="flex items-center justify-between">
              <button
                onClick={goPrev}
                disabled={currentStep === 0}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                Anterior
              </button>
              <Button onClick={goNext} size="sm" className="gap-1">
                {currentStep === totalSteps - 1 ? (
                  "¡Empezar!"
                ) : (
                  <>
                    Siguiente
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
