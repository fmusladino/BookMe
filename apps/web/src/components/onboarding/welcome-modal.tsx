"use client";

import { Bot, ArrowRight, Sparkles, Calendar, Settings, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WelcomeModalProps {
  userName: string;
  onStartTour: () => void;
  onSkip: () => void;
}

export function WelcomeModal({ userName, onStartTour, onSkip }: WelcomeModalProps) {
  const firstName = userName.split(" ")[0] || "profesional";

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-300" />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[101] -translate-x-1/2 -translate-y-1/2 w-full max-w-md px-4">
        <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-300">
          {/* Header con gradiente */}
          <div className="bg-gradient-to-br from-bookme-navy via-bookme-navy/90 to-bookme-mint/30 dark:from-bookme-mint/20 dark:via-bookme-navy/60 dark:to-bookme-navy px-6 pt-8 pb-6 text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-white/20 flex items-center justify-center ring-4 ring-white/10">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">
              ¡Bienvenido a BookMe!
            </h1>
            <p className="text-white/80 text-sm">
              Hola {firstName}, soy MIA tu asistente inteligente
            </p>
          </div>

          {/* Cuerpo */}
          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Te voy a guiar por la plataforma para que configures todo lo necesario para empezar a recibir turnos.
            </p>

            {/* Pasos preview */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Settings className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Configurá tu agenda</p>
                  <p className="text-xs text-muted-foreground">
                    Horarios, días laborales y obras sociales
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Cargá tus servicios</p>
                  <p className="text-xs text-muted-foreground">
                    Tipos de consulta, duración y precios
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border p-3 bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Empezá a recibir turnos</p>
                  <p className="text-xs text-muted-foreground">
                    Tu agenda estará lista para tus pacientes
                  </p>
                </div>
              </div>
            </div>

            {/* Botones */}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={onStartTour} className="w-full gap-2" size="lg">
                <Sparkles className="h-4 w-4" />
                Empezar el recorrido
                <ArrowRight className="h-4 w-4" />
              </Button>
              <button
                onClick={onSkip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                Saltar por ahora, ya conozco la plataforma
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
