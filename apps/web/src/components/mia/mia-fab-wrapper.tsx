"use client";

import { lazy, Suspense } from "react";
import { useSession } from "@/hooks/use-session";
import { useFeatures } from "@/hooks/use-features";

// Lazy load: el componente pesado de MIA solo se carga cuando el usuario
// es un profesional. Esto evita cargar ~5 íconos de Lucide + toda la lógica
// del chat en páginas de pacientes, landing, directorio, etc.
const MiaFab = lazy(() =>
  import("./mia-fab").then((mod) => ({ default: mod.MiaFab }))
);

export function MiaFabWrapper() {
  const { user, loading } = useSession();
  const { hasFeature } = useFeatures();

  // No renderizar nada si no hay usuario o no es profesional
  if (loading || !user || user.role !== "professional") {
    return null;
  }

  // Verificar si el profesional tiene acceso a MIA según su plan
  const hasMiaAccess = user.professional?.plan && user.professional?.line
    ? hasFeature("mia_basic", user.professional.plan, user.professional.line)
    : false;

  if (!hasMiaAccess) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <MiaFab />
    </Suspense>
  );
}
