"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "@/hooks/use-session";
import { WelcomeModal } from "./welcome-modal";
import { OnboardingTour } from "./onboarding-tour";

type OnboardingPhase = "loading" | "welcome" | "tour" | "done";

/**
 * Componente orquestador del onboarding.
 * Fases: loading → welcome (modal) → tour (highlights) → done
 *
 * Se monta en el layout del dashboard y solo se activa
 * para profesionales que aún no completaron el onboarding.
 */
export function OnboardingProvider() {
  const { user, loading: userLoading } = useSession();
  const [phase, setPhase] = useState<OnboardingPhase>("loading");

  // Consultar si el profesional ya completó el onboarding
  useEffect(() => {
    if (userLoading || !user) return;

    // Solo para profesionales
    if (user.role !== "professional") {
      setPhase("done");
      return;
    }

    const checkOnboarding = async () => {
      try {
        const res = await fetch("/api/professionals/me/onboarding");
        if (res.ok) {
          const data = (await res.json()) as {
            onboarding_completed: boolean;
          };
          if (data.onboarding_completed) {
            setPhase("done");
          } else {
            setPhase("welcome");
          }
        } else {
          // Si falla, no bloquear la app
          setPhase("done");
        }
      } catch {
        setPhase("done");
      }
    };

    checkOnboarding();
  }, [user, userLoading]);

  // Permite volver a disparar el tour desde otros componentes (ej. botón en sidebar)
  useEffect(() => {
    const handleRestart = () => setPhase("tour");
    window.addEventListener("bookme:restart-tour", handleRestart);
    return () => window.removeEventListener("bookme:restart-tour", handleRestart);
  }, []);

  // Marcar como completado en la DB
  const markComplete = useCallback(async () => {
    setPhase("done");
    try {
      await fetch("/api/professionals/me/onboarding", { method: "PATCH" });
    } catch {
      // Silencioso — la próxima vez se mostrará de nuevo si falló
    }
  }, []);

  // Handlers
  const handleStartTour = () => setPhase("tour");
  const handleSkipAll = () => markComplete();
  const handleTourComplete = () => markComplete();

  // No renderizar nada si está cargando o ya completó
  if (phase === "loading" || phase === "done") return null;

  return (
    <>
      {phase === "welcome" && (
        <WelcomeModal
          userName={user?.full_name ?? ""}
          onStartTour={handleStartTour}
          onSkip={handleSkipAll}
        />
      )}
      {phase === "tour" && (
        <OnboardingTour onComplete={handleTourComplete} />
      )}
    </>
  );
}
