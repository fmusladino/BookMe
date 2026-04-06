/**
 * MIA Onboarding — Guía paso a paso para nuevos profesionales.
 * Flujo:
 *  1. Bienvenida → Pregunta línea (Healthcare/Business)
 *  2. Especialidad
 *  3. Configurar horarios de atención
 *  4. Crear primer servicio
 *  5. Completar perfil público (slug, bio)
 *  6. Resumen final
 */

export type OnboardingStep =
  | "welcome"
  | "line"
  | "specialty"
  | "schedule"
  | "service"
  | "profile"
  | "done";

export interface OnboardingState {
  step: OnboardingStep;
  data: {
    line?: "healthcare" | "business";
    specialty?: string;
    workingDays?: number[];
    startTime?: string;
    endTime?: string;
    serviceName?: string;
    serviceDuration?: number;
    servicePrice?: number;
    bio?: string;
    slug?: string;
  };
}

export interface OnboardingResponse {
  message: string;
  nextStep: OnboardingStep;
  state: OnboardingState;
  options?: string[];
}

const STEP_MESSAGES: Record<OnboardingStep, string> = {
  welcome: `¡Bienvenido a BookMe! 🎉 Soy MIA, tu asistente, y te voy a guiar para configurar tu cuenta en unos minutos.\n\nEmpecemos: ¿tu actividad es del área de salud o es un negocio/servicio?`,
  line: "",
  specialty: "",
  schedule: "",
  service: "",
  profile: "",
  done: `¡Listo! 🎉 Tu cuenta está configurada. Ya podés empezar a recibir turnos.\n\nRecordá que podés escribirme en cualquier momento para gestionar tu agenda. ¡Éxitos! 🚀`,
};

export function getOnboardingWelcome(userName: string): OnboardingResponse {
  return {
    message: `¡Hola ${userName}! 🎉 Soy MIA, tu asistente inteligente.\n\nTe voy a guiar para configurar tu cuenta en unos minutos.\n\n¿Tu actividad es del área de **salud** (médico, psicólogo, kinesiólogo, etc.) o es un **negocio/servicio** (peluquería, barbería, coaching, etc.)?`,
    nextStep: "line",
    state: { step: "line", data: {} },
    options: ["Salud", "Negocio/Servicio"],
  };
}

export function processOnboardingStep(
  currentState: OnboardingState,
  userMessage: string
): OnboardingResponse {
  const lower = userMessage.toLowerCase().trim();

  switch (currentState.step) {
    case "line": {
      let line: "healthcare" | "business";
      if (lower.includes("salud") || lower.includes("medic") || lower.includes("doctor") || lower.includes("health")) {
        line = "healthcare";
      } else if (lower.includes("negocio") || lower.includes("servicio") || lower.includes("business") || lower.includes("peluq") || lower.includes("barber")) {
        line = "business";
      } else {
        return {
          message: "No entendí bien. ¿Es del área de **salud** o un **negocio/servicio**?",
          nextStep: "line",
          state: currentState,
          options: ["Salud", "Negocio/Servicio"],
        };
      }

      const lineLabel = line === "healthcare" ? "Salud" : "Negocios";
      return {
        message: `Perfecto, línea ${lineLabel}. 👍\n\n¿Cuál es tu especialidad? Por ejemplo: ${line === "healthcare" ? "Médico Clínico, Psicólogo, Odontólogo, Kinesiólogo, Nutricionista" : "Peluquero/a, Barbero, Entrenador Personal, Coach, Abogado"}`,
        nextStep: "specialty",
        state: { step: "specialty", data: { ...currentState.data, line } },
      };
    }

    case "specialty": {
      if (lower.length < 3) {
        return {
          message: "Necesito que me digas tu especialidad. ¿Cuál es?",
          nextStep: "specialty",
          state: currentState,
        };
      }

      // Capitalizar primera letra de cada palabra
      const specialty = userMessage.trim().replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        message: `${specialty}, anotado. 📝\n\nAhora configuremos tus horarios de atención. ¿Qué días atendés?\n\nPor ejemplo: "lunes a viernes" o "lunes, miércoles y viernes"`,
        nextStep: "schedule",
        state: { step: "schedule", data: { ...currentState.data, specialty } },
        options: ["Lunes a Viernes", "Lunes a Sábado", "Todos los días"],
      };
    }

    case "schedule": {
      let workingDays: number[];

      if (lower.includes("lunes a viernes") || lower.includes("lun a vie")) {
        workingDays = [1, 2, 3, 4, 5];
      } else if (lower.includes("lunes a sábado") || lower.includes("lunes a sabado") || lower.includes("lun a sab")) {
        workingDays = [1, 2, 3, 4, 5, 6];
      } else if (lower.includes("todos")) {
        workingDays = [0, 1, 2, 3, 4, 5, 6];
      } else {
        // Intentar parsear días individuales
        workingDays = [];
        const dayMap: Record<string, number> = {
          domingo: 0, lunes: 1, martes: 2, miércoles: 3, miercoles: 3,
          jueves: 4, viernes: 5, sábado: 6, sabado: 6,
        };
        for (const [dayName, dayNum] of Object.entries(dayMap)) {
          if (lower.includes(dayName)) workingDays.push(dayNum);
        }
        if (workingDays.length === 0) {
          workingDays = [1, 2, 3, 4, 5]; // Default lun-vie
        }
      }

      return {
        message: `Perfecto. ¿A qué hora empezás y terminás de atender?\n\nPor ejemplo: "de 9 a 18" o "9:00 a 13:00 y 14:00 a 18:00"`,
        nextStep: "service",
        state: {
          step: "service",
          data: { ...currentState.data, workingDays, startTime: "09:00", endTime: "18:00" },
        },
        options: ["9 a 18", "8 a 17", "9 a 13 y 14 a 18"],
      };
    }

    case "service": {
      // Parsear horarios si el usuario los especificó
      const timeMatch = lower.match(/(\d{1,2})\s*(?::|hs)?\s*a\s*(\d{1,2})/);
      let startTime = "09:00";
      let endTime = "18:00";
      if (timeMatch) {
        startTime = `${timeMatch[1].padStart(2, "0")}:00`;
        endTime = `${timeMatch[2].padStart(2, "0")}:00`;
      }

      const lineLabel = currentState.data.line === "healthcare" ? "Consulta general" : "Servicio estándar";

      return {
        message: `Horarios configurados: ${startTime} a ${endTime}. ⏰\n\nAhora creemos tu primer servicio. ¿Cómo se llama y cuánto dura?\n\nPor ejemplo: "${lineLabel}, 30 minutos"`,
        nextStep: "profile",
        state: {
          step: "profile",
          data: { ...currentState.data, startTime, endTime },
        },
      };
    }

    case "profile": {
      // Parsear nombre del servicio y duración
      let serviceName = userMessage.trim();
      let serviceDuration = 30;

      const durationMatch = lower.match(/(\d+)\s*(?:min|minutos)/);
      if (durationMatch) {
        serviceDuration = parseInt(durationMatch[1]);
        serviceName = userMessage.replace(/,?\s*\d+\s*(?:min|minutos).*/, "").trim();
      }

      if (!serviceName || serviceName.length < 3) {
        serviceName = currentState.data.line === "healthcare" ? "Consulta general" : "Servicio estándar";
      }

      return {
        message: `Servicio "${serviceName}" (${serviceDuration} min) creado. ✅\n\nÚltimo paso: ¿querés agregar una breve descripción para tu perfil público? (o escribí "omitir" para saltar este paso)`,
        nextStep: "done",
        state: {
          step: "done",
          data: {
            ...currentState.data,
            serviceName,
            serviceDuration,
          },
        },
      };
    }

    case "done": {
      const bio = lower === "omitir" || lower === "no" ? undefined : userMessage.trim();

      return {
        message: `¡Listo! 🎉 Tu cuenta está configurada:\n\n• Línea: ${currentState.data.line === "healthcare" ? "Salud" : "Negocios"}\n• Especialidad: ${currentState.data.specialty}\n• Horario: ${currentState.data.startTime} a ${currentState.data.endTime}\n• Servicio: ${currentState.data.serviceName} (${currentState.data.serviceDuration} min)\n${bio ? `• Bio: ${bio}\n` : ""}\nYa podés empezar a recibir turnos. Escribime cuando necesites ayuda. 🚀`,
        nextStep: "done",
        state: {
          step: "done",
          data: { ...currentState.data, bio },
        },
      };
    }

    default:
      return {
        message: "No entendí. ¿Podés repetir?",
        nextStep: currentState.step,
        state: currentState,
      };
  }
}
