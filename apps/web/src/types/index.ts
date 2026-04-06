// Re-exporta tipos de DB para uso en la app.
// Los Row types se extraen del tipo Database centralizado.
export type {
  Database,
  LineOfBusiness,
  UserRole,
  AppointmentStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  BillingCycle,
} from "./database";

import type { Database } from "./database";

// ─── Aliases de filas (extraídos del tipo Database) ───────────────────────────
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Professional = Database["public"]["Tables"]["professionals"]["Row"];
export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Insurance = Database["public"]["Tables"]["insurances"]["Row"];
export type ScheduleConfig = Database["public"]["Tables"]["schedule_configs"]["Row"];
export type WorkingHour = Database["public"]["Tables"]["working_hours"]["Row"];
export type ScheduleBlock = Database["public"]["Tables"]["schedule_blocks"]["Row"];
export type ClinicalRecord = Database["public"]["Tables"]["clinical_records"]["Row"];
export type SessionNote = Database["public"]["Tables"]["session_notes"]["Row"];
export type BillingItem = Database["public"]["Tables"]["billing_items"]["Row"];
export type Coupon = Database["public"]["Tables"]["coupons"]["Row"];
export type ClinicSubscription = Database["public"]["Tables"]["clinic_subscriptions"]["Row"];
export type PlanPrice = Database["public"]["Tables"]["plan_prices"]["Row"];

// ─── Tipos compuestos de UI ───────────────────────────────────────────────────

// Turno con relaciones cargadas (para vistas de agenda)
export type AppointmentWithRelations = Appointment & {
  patient: Pick<Patient, "id" | "full_name" | "phone" | "email">;
  service: Pick<Service, "id" | "name" | "duration_minutes" | "price"> | null;
};

// Profesional con perfil cargado (para directorio)
export type ProfessionalWithProfile = Professional & {
  profile: Pick<Profile, "full_name" | "avatar_url">;
};

// Contexto de sesión disponible globalmente
export type SessionContext = {
  userId: string;
  role: Profile["role"];
  professionalId?: string;
  plan?: Professional["subscription_plan"];
  planStatus?: Professional["subscription_status"];
};
