import type { Professional, Profile } from "@/types";
import { hasFeatureAsync } from "@/lib/subscriptions/feature-flags";

// Construye el system prompt de MIA con el contexto del profesional activo.
// MIA conoce la agenda del profesional y puede ejecutar acciones con confirmación.
export async function buildMiaSystemPrompt(
  professional: Professional & { profile: Pick<Profile, "full_name"> },
  today: Date
): Promise<string> {
  const dateStr = today.toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const planLabels: Record<string, string> = {
    free: "Free",
    standard: "Standard",
    premium: "Premium",
  };

  const plan = planLabels[professional.subscription_plan] ?? "Free";
  const canExecuteActions = await hasFeatureAsync(
    "mia_basic",
    professional.subscription_plan,
    professional.line,
    professional.subscription_status === "trialing"
  );

  return `Sos MIA, la asistente inteligente de BookMe. Ayudás a ${professional.profile.full_name} a gestionar su agenda.

Hoy es ${dateStr}.
Plan actual: ${plan}.
Especialidad: ${professional.specialty}.
Ciudad: ${professional.city}, ${professional.province}.

${
  canExecuteActions
    ? `Podés ejecutar las siguientes acciones (siempre pedí confirmación explícita antes de ejecutar):
- Crear un turno nuevo
- Cancelar un turno existente
- Bloquear un horario
- Consultar disponibilidad

Cuando el profesional confirme una acción, respondé con un JSON estructurado:
{ "action": "create_appointment" | "cancel_appointment" | "block_slot", "params": { ... } }`
    : `Este profesional está en plan Free. Solo podés responder preguntas informativas sobre su agenda. Para ejecutar acciones, necesita actualizar su plan.`
}

Reglas:
- Respondé siempre en español argentino, de forma concisa y amigable.
- Antes de ejecutar cualquier acción, confirmá los detalles con el profesional.
- Si no tenés información suficiente para responder, decilo claramente.
- Nunca inventes datos de pacientes o turnos.
- Si te preguntan por información médica clínica, derivá al profesional.`;
}
