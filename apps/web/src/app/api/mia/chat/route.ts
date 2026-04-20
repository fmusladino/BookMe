import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
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
import {
  getOnboardingWelcome,
  processOnboardingStep,
  type OnboardingState,
} from "@/lib/mia/onboarding";

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
        onboardingState?: OnboardingState;
        startOnboarding?: boolean;
      };
    };
    const { message, context } = body;

    if (!message || typeof message !== "string" && !context?.startOnboarding) {
      return NextResponse.json(
        { error: "Mensaje inválido" },
        { status: 400 }
      );
    }

    const userFullName = profileData?.full_name ?? "Profesional";
    let response;

    // ─── MODO ONBOARDING ────────────────────────────────────
    // Si el profesional aún no completó el onboarding, MIA lo guía paso a paso.
    // Se dispara: (a) cuando el cliente manda startOnboarding=true, o (b) cuando ya hay un onboardingState en curso.
    const needsOnboarding = !professional.onboarding_completed;

    if (needsOnboarding && context?.startOnboarding && !context.onboardingState) {
      const welcome = getOnboardingWelcome(userFullName);
      return NextResponse.json({
        response: welcome.message,
        action: "onboarding",
        onboardingState: welcome.state,
        options: welcome.options,
      });
    }

    if (needsOnboarding && context?.onboardingState) {
      const stepResult = processOnboardingStep(context.onboardingState, message);

      // Cuando llegamos a 'done', aplicamos las configuraciones reales en la DB.
      if (stepResult.state.step === "done" && context.onboardingState.step !== "done") {
        await applyOnboardingToDb(user.id, stepResult.state);
      }

      return NextResponse.json({
        response: stepResult.message,
        action: "onboarding",
        onboardingState: stepResult.state,
        options: stepResult.options,
        finished: stepResult.state.step === "done" && context.onboardingState.step !== "done",
      });
    }

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

// Aplica el estado del onboarding a la DB de una vez: professional fields,
// schedule_config con los días/horarios elegidos, y primer service.
// Se ejecuta cuando el flujo llega a step='done'. Fire and forget desde la UX:
// incluso si falla parcial, el usuario ya ve el mensaje de cierre.
async function applyOnboardingToDb(userId: string, state: OnboardingState) {
  const admin = createAdminClient();
  const d = state.data;

  try {
    // 1) Actualizar professional con línea, especialidad, bio y marcar onboarding completo
    await admin
      .from("professionals")
      .update({
        line: d.line,
        specialty: d.specialty,
        bio: d.bio || null,
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 2) Upsert schedule_config con los días y horarios elegidos
    if (d.workingDays && d.startTime && d.endTime) {
      await admin
        .from("schedule_configs")
        .upsert(
          {
            professional_id: userId,
            working_days: d.workingDays,
            slot_duration: d.serviceDuration || 30,
          },
          { onConflict: "professional_id" }
        );

      // 3) Crear working_hours para cada día elegido (si no existen ya)
      const existingHours = await admin
        .from("working_hours")
        .select("day_of_week")
        .eq("professional_id", userId);
      const existingDays = new Set((existingHours.data || []).map((h: { day_of_week: number }) => h.day_of_week));
      const toInsert = d.workingDays
        .filter((day) => !existingDays.has(day))
        .map((day) => ({
          professional_id: userId,
          day_of_week: day,
          start_time: d.startTime,
          end_time: d.endTime,
        }));
      if (toInsert.length > 0) {
        await admin.from("working_hours").insert(toInsert);
      }
    }

    // 4) Crear el primer servicio
    if (d.serviceName) {
      await admin.from("services").insert({
        professional_id: userId,
        name: d.serviceName,
        duration_minutes: d.serviceDuration || 30,
        price: d.servicePrice || null,
        show_price: false,
        is_active: true,
        line: d.line || "healthcare",
      });
    }
  } catch (err) {
    console.error("[MIA Onboarding] Error aplicando configuración:", err);
    // No throw — queremos que el usuario vea el mensaje de cierre aunque la DB falle.
  }
}
