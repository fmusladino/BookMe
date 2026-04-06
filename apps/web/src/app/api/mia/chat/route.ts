import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseIntent } from "@/lib/mia/intents";
import {
  handleQueryToday,
  handleQueryWeek,
  handleQueryDate,
  handleQueryNext,
  handleCreateAppointment,
  handleCancelAppointment,
  handleBlockSchedule,
  handleQueryPatients,
  handleQueryStats,
  handleGreeting,
  handleHelp,
} from "@/lib/mia/actions";
import { executeConfirmedAction } from "@/lib/mia/executor";
import { hasFeatureAsync } from "@/lib/subscriptions/feature-flags";

export const dynamic = "force-dynamic";

// POST /api/mia/chat — Chat con MIA. Procesa intents y ejecuta acciones.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verificar sesión
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado" },
        { status: 401 }
      );
    }

    // Obtener datos del profesional
    const { data: professional, error: profError } = await supabase
      .from("professionals")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profError || !professional) {
      return NextResponse.json(
        { error: "Profesional no encontrado" },
        { status: 404 }
      );
    }

    // Obtener perfil
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Verificar plan — MIA disponible según feature flag dinámico
    const hasMia = await hasFeatureAsync(
      "mia_basic",
      professional.subscription_plan,
      professional.line,
      professional.subscription_status === "trialing"
    );
    if (!hasMia) {
      return NextResponse.json(
        { error: "MIA está disponible a partir del plan Standard" },
        { status: 403 }
      );
    }

    // Verificar estado de la suscripción
    if (professional.subscription_status === "read_only") {
      return NextResponse.json(
        { error: "Tu suscripción tiene pagos pendientes. Regularizá para usar MIA." },
        { status: 403 }
      );
    }

    const body = await request.json() as {
      message: string;
      context?: {
        pendingAction?: string;
        pendingData?: Record<string, unknown>;
      };
    };
    const { message, context } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Mensaje inválido" },
        { status: 400 }
      );
    }

    const userFullName = profileData?.full_name ?? "Profesional";
    let response;

    // Si hay una acción pendiente y el usuario confirma
    if (context?.pendingAction) {
      const confirmationWords = ["sí", "si", "dale", "ok", "confirmo", "confirmá", "confirmar", "yes", "yep"];
      const denialWords = ["no", "cancelar", "nope", "no quiero"];

      const lowerMessage = message.toLowerCase();
      const isConfirming = confirmationWords.some((word) => lowerMessage.includes(word));
      const isDenying = denialWords.some((word) => lowerMessage.includes(word));

      if (isConfirming && context.pendingData) {
        // Ejecuta la acción confirmada
        response = await executeConfirmedAction(
          supabase,
          user.id,
          context.pendingAction,
          context.pendingData
        );
      } else if (isDenying) {
        response = {
          message: "Perfecto, cancelamos esa acción. ¿Qué más necesitás?",
          action: "none" as const,
        };
      } else {
        response = {
          message: "No estoy seguro si confirmas. Decime 'sí' para confirmar o 'no' para cancelar.",
          action: "none" as const,
        };
      }
    } else {
      // Parsea el intent del mensaje
      const parsedIntent = parseIntent(message);

      // Ejecuta la acción correspondiente
      switch (parsedIntent.intent) {
        case "query_today":
          response = await handleQueryToday(supabase, user.id);
          break;

        case "query_week":
          response = await handleQueryWeek(supabase, user.id);
          break;

        case "query_date":
          response = await handleQueryDate(supabase, user.id, parsedIntent.entities.date || "");
          break;

        case "query_next":
          response = await handleQueryNext(supabase, user.id);
          break;

        case "create_appointment":
          response = await handleCreateAppointment(supabase, user.id, parsedIntent.entities);
          break;

        case "cancel_appointment":
          response = await handleCancelAppointment(supabase, user.id, parsedIntent.entities);
          break;

        case "block_schedule":
          response = await handleBlockSchedule(supabase, user.id, parsedIntent.entities);
          break;

        case "query_patients":
          response = await handleQueryPatients(supabase, user.id);
          break;

        case "query_stats":
          response = await handleQueryStats(supabase, user.id);
          break;

        case "greeting":
          response = handleGreeting(userFullName);
          break;

        case "help":
          response = handleHelp();
          break;

        case "unknown":
        default:
          response = {
            message: `No entendí bien. ¿Podés repetir o escribir 'ayuda' para saber qué puedo hacer?`,
            action: "none" as const,
          };
      }
    }

    return NextResponse.json({
      response: response.message,
      action: response.action,
      actionData: response.data,
    });
  } catch (error) {
    console.error("[MIA] Error en chat:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el mensaje" },
      { status: 500 }
    );
  }
}
