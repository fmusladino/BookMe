// Tipos de la base de datos para el cliente Supabase.
// Formato idéntico al generado por `supabase gen types typescript`.
// Al tener Supabase configurado, reemplazar este archivo con la salida del CLI.

// ─── Enums ───────────────────────────────────────────────────────────────────
export type LineOfBusiness = "healthcare" | "business";
export type UserRole = "professional" | "patient" | "admin" | "superadmin" | "marketing";
export type AppointmentStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type SubscriptionPlan = "free" | "base" | "standard" | "premium";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "read_only" | "cancelled";
export type BillingCycle = "monthly" | "annual";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          dni: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: UserRole;
          full_name: string;
          dni: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: UserRole;
          full_name?: string;
          dni?: string;
          phone?: string | null;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinics: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          owner_id: string;
          address: string | null;
          city: string | null;
          province: string | null;
          country: string;
          phone: string | null;
          email: string | null;
          logo_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string | null;
          owner_id: string;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string | null;
          address?: string | null;
          city?: string | null;
          province?: string | null;
          country?: string;
          phone?: string | null;
          email?: string | null;
          logo_url?: string | null;
        };
        Relationships: [];
      };
      clinic_admins: {
        Row: {
          clinic_id: string;
          profile_id: string;
        };
        Insert: {
          clinic_id: string;
          profile_id: string;
        };
        Update: {
          clinic_id?: string;
          profile_id?: string;
        };
        Relationships: [];
      };
      professionals: {
        Row: {
          id: string;
          clinic_id: string | null;
          line: LineOfBusiness;
          specialty: string;
          specialty_slug: string;
          bio: string | null;
          city: string;
          province: string;
          country: string;
          address: string | null;
          postal_code: string | null;
          latitude: number | null;
          longitude: number | null;
          public_slug: string;
          is_visible: boolean;
          subscription_plan: SubscriptionPlan;
          subscription_status: SubscriptionStatus;
          billing_cycle: BillingCycle;
          trial_ends_at: string | null;
          subscription_expires_at: string | null;
          cancelled_at: string | null;
          data_retention_until: string | null;
          mp_subscription_id: string | null;
          mp_plan_id: string | null;
          default_meet_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          clinic_id?: string | null;
          default_meet_url?: string | null;
          line: LineOfBusiness;
          specialty: string;
          specialty_slug: string;
          bio?: string | null;
          city: string;
          province: string;
          country?: string;
          address?: string | null;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          public_slug: string;
          is_visible?: boolean;
          subscription_plan?: SubscriptionPlan;
          subscription_status?: SubscriptionStatus;
          billing_cycle?: BillingCycle;
          trial_ends_at?: string | null;
          subscription_expires_at?: string | null;
          mp_subscription_id?: string | null;
          mp_plan_id?: string | null;
          created_at?: string;
        };
        Update: {
          clinic_id?: string | null;
          line?: LineOfBusiness;
          specialty?: string;
          specialty_slug?: string;
          bio?: string | null;
          city?: string;
          province?: string;
          country?: string;
          address?: string | null;
          postal_code?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          public_slug?: string;
          is_visible?: boolean;
          subscription_plan?: SubscriptionPlan;
          subscription_status?: SubscriptionStatus;
          billing_cycle?: BillingCycle;
          trial_ends_at?: string | null;
          subscription_expires_at?: string | null;
          cancelled_at?: string | null;
          data_retention_until?: string | null;
          mp_subscription_id?: string | null;
          mp_plan_id?: string | null;
          default_meet_url?: string | null;
        };
        Relationships: [];
      };
      insurances: {
        Row: {
          id: string;
          name: string;
          code: string | null;
          logo_url: string | null;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          code?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
        };
        Update: {
          name?: string;
          code?: string | null;
          logo_url?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          profile_id: string | null;
          professional_id: string;
          dni: string;
          full_name: string;
          email: string | null;
          phone: string | null;
          birth_date: string | null;
          insurance_id: string | null;
          insurance_number: string | null;
          is_particular: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          professional_id: string;
          dni: string;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          insurance_id?: string | null;
          insurance_number?: string | null;
          is_particular?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          profile_id?: string | null;
          professional_id?: string;
          dni?: string;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          birth_date?: string | null;
          insurance_id?: string | null;
          insurance_number?: string | null;
          is_particular?: boolean;
          notes?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          professional_id: string;
          name: string;
          duration_minutes: number;
          price: number | null;
          show_price: boolean;
          is_active: boolean;
          modality: "presencial" | "virtual" | "both";
          line: LineOfBusiness;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          name: string;
          duration_minutes?: number;
          price?: number | null;
          show_price?: boolean;
          is_active?: boolean;
          modality?: "presencial" | "virtual" | "both";
          line: LineOfBusiness;
          created_at?: string;
        };
        Update: {
          professional_id?: string;
          name?: string;
          duration_minutes?: number;
          price?: number | null;
          show_price?: boolean;
          is_active?: boolean;
          modality?: "presencial" | "virtual" | "both";
          line?: LineOfBusiness;
        };
        Relationships: [];
      };
      schedule_configs: {
        Row: {
          id: string;
          professional_id: string;
          working_days: number[];
          slot_duration: number;
          lunch_break_start: string | null;
          lunch_break_end: string | null;
          vacation_mode: boolean;
          vacation_from: string | null;
          vacation_until: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          working_days?: number[];
          slot_duration?: number;
          lunch_break_start?: string | null;
          lunch_break_end?: string | null;
          vacation_mode?: boolean;
          vacation_from?: string | null;
          vacation_until?: string | null;
          updated_at?: string;
        };
        Update: {
          working_days?: number[];
          slot_duration?: number;
          lunch_break_start?: string | null;
          lunch_break_end?: string | null;
          vacation_mode?: boolean;
          vacation_from?: string | null;
          vacation_until?: string | null;
        };
        Relationships: [];
      };
      working_hours: {
        Row: {
          id: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
        };
        Update: {
          professional_id?: string;
          day_of_week?: number;
          start_time?: string;
          end_time?: string;
        };
        Relationships: [];
      };
      schedule_blocks: {
        Row: {
          id: string;
          professional_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
        };
        Insert: {
          id?: string;
          professional_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
        };
        Update: {
          professional_id?: string;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          professional_id: string;
          patient_id: string;
          service_id: string | null;
          starts_at: string;
          ends_at: string;
          status: AppointmentStatus;
          modality: "presencial" | "virtual";
          meet_url: string | null;
          booked_by: string | null;
          notes: string | null;
          reminder_sent: boolean;
          created_at: string;
          updated_at: string;
          cancelled_at: string | null;
          cancellation_reason: string | null;
        };
        Insert: {
          id?: string;
          professional_id: string;
          patient_id: string;
          service_id?: string | null;
          starts_at: string;
          ends_at: string;
          status?: AppointmentStatus;
          modality?: "presencial" | "virtual";
          meet_url?: string | null;
          booked_by?: string | null;
          notes?: string | null;
          reminder_sent?: boolean;
          created_at?: string;
          updated_at?: string;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
        Update: {
          professional_id?: string;
          patient_id?: string;
          service_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          status?: AppointmentStatus;
          modality?: "presencial" | "virtual";
          meet_url?: string | null;
          booked_by?: string | null;
          notes?: string | null;
          reminder_sent?: boolean;
          updated_at?: string;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
        };
        Relationships: [];
      };
      clinical_records: {
        Row: {
          id: string;
          professional_id: string;
          patient_id: string;
          appointment_id: string | null;
          content_encrypted: string;
          iv: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          patient_id: string;
          appointment_id?: string | null;
          content_encrypted: string;
          iv: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          professional_id?: string;
          patient_id?: string;
          appointment_id?: string | null;
          content_encrypted?: string;
          iv?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clinical_record_audit: {
        Row: {
          id: string;
          record_id: string;
          accessed_by: string;
          action: string;
          accessed_at: string;
          ip_address: string | null;
        };
        Insert: {
          id?: string;
          record_id: string;
          accessed_by: string;
          action: string;
          accessed_at?: string;
          ip_address?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      session_notes: {
        Row: {
          id: string;
          professional_id: string;
          patient_id: string;
          appointment_id: string;
          content: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          patient_id: string;
          appointment_id: string;
          content: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          professional_id?: string;
          patient_id?: string;
          appointment_id?: string;
          content?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      billing_items: {
        Row: {
          id: string;
          professional_id: string;
          patient_id: string;
          appointment_id: string;
          insurance_id: string;
          practice_code: string;
          practice_name: string;
          amount: number;
          status: string;
          period_month: number;
          period_year: number;
          facturante_ref: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          patient_id: string;
          appointment_id: string;
          insurance_id: string;
          practice_code: string;
          practice_name: string;
          amount: number;
          status?: string;
          period_month: number;
          period_year: number;
          facturante_ref?: string | null;
          created_at?: string;
        };
        Update: {
          professional_id?: string;
          patient_id?: string;
          appointment_id?: string;
          insurance_id?: string;
          practice_code?: string;
          practice_name?: string;
          amount?: number;
          status?: string;
          period_month?: number;
          period_year?: number;
          facturante_ref?: string | null;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_pct: number;
          max_uses: number | null;
          used_count: number;
          valid_until: string | null;
          created_by: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_pct: number;
          max_uses?: number | null;
          used_count?: number;
          valid_until?: string | null;
          created_by: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          discount_pct?: number;
          max_uses?: number | null;
          used_count?: number;
          valid_until?: string | null;
          created_by?: string;
          is_active?: boolean;
        };
        Relationships: [];
      };
      clinic_subscriptions: {
        Row: {
          id: string;
          clinic_id: string;
          plan: string;
          billing_cycle: BillingCycle;
          status: SubscriptionStatus;
          max_professionals: number;
          price_usd: number;
          trial_ends_at: string | null;
          subscription_expires_at: string | null;
          mp_subscription_id: string | null;
          mp_plan_id: string | null;
          cancelled_at: string | null;
          data_retention_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          clinic_id: string;
          plan: string;
          billing_cycle?: BillingCycle;
          status?: SubscriptionStatus;
          max_professionals?: number;
          price_usd: number;
          trial_ends_at?: string | null;
          subscription_expires_at?: string | null;
          mp_subscription_id?: string | null;
          mp_plan_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          plan?: string;
          billing_cycle?: BillingCycle;
          status?: SubscriptionStatus;
          max_professionals?: number;
          price_usd?: number;
          trial_ends_at?: string | null;
          subscription_expires_at?: string | null;
          mp_subscription_id?: string | null;
          mp_plan_id?: string | null;
          cancelled_at?: string | null;
          data_retention_until?: string | null;
        };
        Relationships: [];
      };
      plan_prices: {
        Row: {
          id: string;
          line: LineOfBusiness;
          plan: SubscriptionPlan;
          billing_cycle: BillingCycle;
          price_usd: number;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          line: LineOfBusiness;
          plan: SubscriptionPlan;
          billing_cycle?: BillingCycle;
          price_usd: number;
          is_active?: boolean;
        };
        Update: {
          line?: LineOfBusiness;
          plan?: SubscriptionPlan;
          billing_cycle?: BillingCycle;
          price_usd?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      line_of_business: LineOfBusiness;
      user_role: UserRole;
      appointment_status: AppointmentStatus;
      subscription_plan: SubscriptionPlan;
      subscription_status: SubscriptionStatus;
      billing_cycle: BillingCycle;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
