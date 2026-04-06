import type { Metadata } from "next";
import Link from "next/link";
import {
  HelpCircle,
  Mail,
  Calendar,
  Users,
  CreditCard,
  Shield,
  Smartphone,
  Clock,
  ChevronDown,
  MessageCircle,
  Search,
  MapPin,
  FileText,
  Settings,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Centro de Ayuda",
  description:
    "Preguntas frecuentes y soporte para BookMe. Encontrá respuestas sobre turnos, agenda, facturación y más.",
};

// ─── FAQ data ────────────────────────────────────────────────────────────────

interface FaqCategory {
  id: string;
  icon: React.ElementType;
  title: string;
  questions: { q: string; a: string }[];
}

const faqCategories: FaqCategory[] = [
  {
    id: "cuenta",
    icon: Users,
    title: "Cuenta y registro",
    questions: [
      {
        q: "¿Cómo me registro como profesional?",
        a: "Hacé clic en \"Registrarse\" desde la página principal. Completá tus datos (nombre, DNI, email) y elegí tu línea: Salud o Negocios. Una vez registrado, MIA te guía paso a paso para configurar tu agenda.",
      },
      {
        q: "¿Puedo registrarme con mi cuenta de Google?",
        a: "Sí. En la pantalla de login o registro podés elegir \"Continuar con Google\" para vincular tu cuenta directamente.",
      },
      {
        q: "¿Mis pacientes o clientes necesitan registrarse para sacar turno?",
        a: "Sí, necesitan crear una cuenta con su DNI, nombre y email. Esto permite que vean su historial de turnos y reciban recordatorios automáticos.",
      },
      {
        q: "¿Cómo cambio mi contraseña?",
        a: "Ingresá a tu panel en Configuración y buscá la opción \"Cambiar contraseña\". Si usás login con Google, no necesitás contraseña.",
      },
    ],
  },
  {
    id: "agenda",
    icon: Calendar,
    title: "Agenda y turnos",
    questions: [
      {
        q: "¿Cómo configuro mis horarios de atención?",
        a: "En tu panel, andá a Configuración > Horarios. Ahí podés definir los días y horarios en que atendés, la duración por tipo de consulta, y activar sobreturno si lo necesitás.",
      },
      {
        q: "¿Puedo bloquear días o activar modo vacaciones?",
        a: "Sí. Desde Configuración podés activar \"Modo vacaciones\" con una fecha de regreso, o crear bloqueos puntuales para días u horarios específicos.",
      },
      {
        q: "¿Cómo muevo un turno de horario?",
        a: "En la vista semanal de tu agenda, podés arrastrar y soltar (drag & drop) el turno al nuevo horario. El paciente recibe una notificación automática del cambio.",
      },
      {
        q: "¿Puedo cargar un turno manualmente?",
        a: "Sí. Hacé clic en el botón \"+\" o en un espacio libre de la agenda. Podés buscar al paciente por nombre o DNI y asignarle un servicio y horario.",
      },
      {
        q: "¿Cómo importo turnos de otro sistema?",
        a: "Andá a Importar turnos en el menú lateral. Podés subir archivos CSV, Excel (.xlsx) o Google Calendar (.ics). BookMe mapea las columnas automáticamente.",
      },
    ],
  },
  {
    id: "reservas",
    icon: Search,
    title: "Reservas online y directorio",
    questions: [
      {
        q: "¿Cómo reservan mis pacientes/clientes?",
        a: "Compartiles tu link directo bookme.ar/@tunombre (por WhatsApp, Instagram, etc.). Ahí ven tus servicios, eligen fecha y horario, y confirman el turno.",
      },
      {
        q: "¿Qué es el directorio público?",
        a: "Es un buscador geolocalizado donde cualquier persona puede encontrar profesionales por especialidad, ciudad y rubro. Si tenés cuenta activa, aparecés automáticamente.",
      },
      {
        q: "¿Puedo usar el link de BookMe en mi bio de Instagram?",
        a: "Sí. Tu link directo bookme.ar/@tunombre funciona perfecto como link en bio. Es una URL corta y profesional que lleva directo a tu página de reservas.",
      },
    ],
  },
  {
    id: "notificaciones",
    icon: Clock,
    title: "Notificaciones y recordatorios",
    questions: [
      {
        q: "¿Qué notificaciones recibe el paciente?",
        a: "Recibe confirmación de turno por email y WhatsApp al reservar, un recordatorio 24 horas antes, y notificación si el turno se modifica o cancela.",
      },
      {
        q: "¿Las notificaciones se envían desde mi número de WhatsApp?",
        a: "No. Se envían desde un número único de BookMe para mantener la consistencia. El mensaje incluye tu nombre como profesional para que el paciente te identifique.",
      },
      {
        q: "¿Puedo desactivar los recordatorios?",
        a: "Los recordatorios están diseñados para reducir ausencias y son una parte clave del servicio, por lo que no se pueden desactivar individualmente.",
      },
    ],
  },
  {
    id: "hc",
    icon: FileText,
    title: "Historia clínica y notas",
    questions: [
      {
        q: "¿La historia clínica es segura?",
        a: "Sí. Cada registro está encriptado con AES-256 antes de guardarse en la base de datos. Solo vos, como profesional tratante, podés ver y editar las historias de tus pacientes.",
      },
      {
        q: "¿Qué son las notas de sesión?",
        a: "Son anotaciones de texto libre que podés agregar a cada turno. Están disponibles tanto en la línea Salud como en la de Negocios (ej: un peluquero puede anotar el tipo de corte).",
      },
      {
        q: "¿Mis pacientes pueden ver la historia clínica?",
        a: "No. La historia clínica solo es visible y editable por el profesional que la creó. El paciente puede ver sus turnos y descargar indicaciones cuando estén disponibles (V2).",
      },
    ],
  },
  {
    id: "facturacion",
    icon: CreditCard,
    title: "Facturación y pagos",
    questions: [
      {
        q: "¿Cuánto cuesta BookMe?",
        a: "BookMe ofrece un período de prueba gratuito. Después, hay planes Standard y Premium según la línea (Salud o Negocios). Podés ver los precios en la configuración de tu cuenta.",
      },
      {
        q: "¿Cómo funciona la liquidación a obras sociales?",
        a: "En la línea Salud, podés cargar el valor por práctica y obra social. BookMe agrupa las liquidaciones y las prepara para presentar ante AFIP a través de un intermediario autorizado.",
      },
      {
        q: "¿Qué pasa si no pago la suscripción?",
        a: "Al día 1 del fallo de pago recibís un aviso. Tenés 3 días de gracia. Si no se regulariza, tu cuenta pasa a modo solo lectura hasta que se normalice el pago. No perdés datos.",
      },
    ],
  },
  {
    id: "mia",
    icon: MessageCircle,
    title: "MIA — Asistente IA",
    questions: [
      {
        q: "¿Qué es MIA?",
        a: "MIA es tu asistente con inteligencia artificial integrada en BookMe. Podés chatear con ella para consultar tu agenda, crear o cancelar turnos, bloquear horarios y más, todo por texto.",
      },
      {
        q: "¿MIA puede crear turnos por mí?",
        a: "Sí. Decile algo como \"creame un turno mañana a las 10 para Juan Pérez\" y MIA te pide confirmación antes de ejecutar la acción.",
      },
      {
        q: "¿MIA accede a mis datos privados?",
        a: "MIA trabaja dentro de tu sesión autenticada y puede consultar tu agenda y datos de pacientes. No comparte información con otros profesionales ni con terceros.",
      },
    ],
  },
  {
    id: "tecnico",
    icon: Settings,
    title: "Técnico y dispositivos",
    questions: [
      {
        q: "¿Puedo instalar BookMe en mi celular?",
        a: "Sí. BookMe es una PWA (Progressive Web App). Desde el navegador de tu celular, tocá \"Agregar a pantalla de inicio\" y se instala como una app nativa.",
      },
      {
        q: "¿Hay modo oscuro?",
        a: "Sí. BookMe tiene dark mode que se activa automáticamente según la preferencia de tu sistema, o podés cambiarlo manualmente.",
      },
      {
        q: "¿Funciona en cualquier navegador?",
        a: "BookMe funciona en Chrome, Safari, Firefox y Edge, tanto en computadora como en celular. Recomendamos Chrome o Safari para la mejor experiencia.",
      },
    ],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

function FaqAccordionItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group border-b border-border last:border-0">
      <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer list-none text-left">
        <span className="text-sm font-medium text-foreground group-open:text-bookme-navy dark:group-open:text-bookme-mint transition-colors">
          {question}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground group-open:rotate-180 transition-transform duration-200" />
      </summary>
      <div className="pb-4 pr-8">
        <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}

export default function SoportePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="w-14 h-14 rounded-2xl bg-bookme-navy/10 dark:bg-bookme-mint/10 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-7 h-7 text-bookme-navy dark:text-bookme-mint" />
        </div>
        <h1 className="text-3xl font-heading font-bold text-foreground mb-3">
          Centro de Ayuda
        </h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Encontrá respuestas a las preguntas más frecuentes sobre BookMe. Si no encontrás lo que
          buscás, escribinos a soporte.
        </p>
      </div>

      {/* Quick contact card */}
      <div className="mb-12 p-6 rounded-xl border border-border bg-card flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        <div className="w-12 h-12 rounded-xl bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-white dark:text-bookme-navy" />
        </div>
        <div className="text-center sm:text-left flex-1">
          <h2 className="font-semibold text-foreground mb-1">¿Necesitás ayuda personalizada?</h2>
          <p className="text-sm text-muted-foreground">
            Escribinos a{" "}
            <a
              href="mailto:soporte@bookme.ar"
              className="text-bookme-navy dark:text-bookme-mint font-medium hover:underline"
            >
              soporte@bookme.ar
            </a>{" "}
            y te respondemos en menos de 24 horas hábiles.
          </p>
        </div>
      </div>

      {/* FAQ sections */}
      <div className="space-y-8">
        {faqCategories.map((category) => (
          <section key={category.id} id={category.id}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-bookme-navy/10 dark:bg-bookme-mint/10 flex items-center justify-center">
                <category.icon className="w-4 h-4 text-bookme-navy dark:text-bookme-mint" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{category.title}</h2>
            </div>
            <div className="rounded-lg border border-border bg-card px-5">
              {category.questions.map((faq) => (
                <FaqAccordionItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-16 text-center">
        <p className="text-muted-foreground mb-4">¿No encontraste lo que buscabas?</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="mailto:soporte@bookme.ar"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Mail className="w-4 h-4" />
            Escribinos a soporte
          </a>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border text-foreground px-6 py-3 text-sm font-medium hover:bg-muted transition-colors"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
