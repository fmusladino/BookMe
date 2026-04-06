/**
 * Script de seed para BookMe
 * Genera todos los tipos de usuarios posibles:
 * - Profesionales Healthcare (médico, psicólogo, odontólogo, kinesiólogo, nutricionista)
 * - Profesionales Business (peluquero, barbero, entrenador, coach, abogado)
 * - Pacientes (asociados a profesionales healthcare)
 * - Clientes (asociados a profesionales business)
 * - Admin de consultorio
 * - Super Admin
 * - Usuario Marketing
 *
 * Ejecutar: npx tsx scripts/seed-users.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

// Cargar env desde apps/web/.env.local
dotenv.config({ path: path.resolve(__dirname, "../apps/web/.env.local") });

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"]!;
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Contraseña común para todos los usuarios de prueba ───────────────
const DEFAULT_PASSWORD = "BookMe2024!";

// ─── Datos de seed ────────────────────────────────────────────────────

interface SeedProfessional {
  email: string;
  full_name: string;
  dni: string;
  phone: string;
  line: "healthcare" | "business";
  specialty: string;
  specialty_slug: string;
  city: string;
  province: string;
  bio: string;
  public_slug: string;
  services: { name: string; duration_minutes: number; price: number; show_price: boolean }[];
}

interface SeedPatient {
  email: string;
  full_name: string;
  dni: string;
  phone: string;
  professional_slug: string; // se linkea al profesional por slug
  insurance_name?: string;
  insurance_number?: string;
}

const PROFESSIONALS_HEALTHCARE: SeedProfessional[] = [
  {
    email: "dr.garcia@bookme-test.com",
    full_name: "Dr. Carlos García",
    dni: "20345678",
    phone: "+5491155550001",
    line: "healthcare",
    specialty: "Médico Clínico",
    specialty_slug: "medico-clinico",
    city: "CABA",
    province: "Buenos Aires",
    bio: "Médico clínico con 15 años de experiencia. Atención integral del adulto.",
    public_slug: "dr-carlos-garcia",
    services: [
      { name: "Consulta general", duration_minutes: 30, price: 15000, show_price: true },
      { name: "Control de rutina", duration_minutes: 20, price: 10000, show_price: true },
      { name: "Certificado médico", duration_minutes: 15, price: 5000, show_price: false },
    ],
  },
  {
    email: "lic.martinez@bookme-test.com",
    full_name: "Lic. Ana Martínez",
    dni: "27654321",
    phone: "+5491155550002",
    line: "healthcare",
    specialty: "Psicóloga",
    specialty_slug: "psicologa",
    city: "Rosario",
    province: "Santa Fe",
    bio: "Psicóloga cognitivo-conductual. Adultos y adolescentes. Ansiedad, depresión y estrés.",
    public_slug: "lic-ana-martinez",
    services: [
      { name: "Sesión individual", duration_minutes: 50, price: 18000, show_price: true },
      { name: "Sesión de pareja", duration_minutes: 60, price: 25000, show_price: true },
    ],
  },
  {
    email: "dra.lopez@bookme-test.com",
    full_name: "Dra. María López",
    dni: "30987654",
    phone: "+5491155550003",
    line: "healthcare",
    specialty: "Odontóloga",
    specialty_slug: "odontologa",
    city: "Córdoba",
    province: "Córdoba",
    bio: "Odontología estética y general. Blanqueamiento, implantes y ortodoncia.",
    public_slug: "dra-maria-lopez",
    services: [
      { name: "Limpieza dental", duration_minutes: 40, price: 12000, show_price: true },
      { name: "Blanqueamiento", duration_minutes: 60, price: 35000, show_price: true },
      { name: "Consulta de urgencia", duration_minutes: 30, price: 8000, show_price: true },
    ],
  },
  {
    email: "lic.fernandez@bookme-test.com",
    full_name: "Lic. Diego Fernández",
    dni: "28456789",
    phone: "+5491155550004",
    line: "healthcare",
    specialty: "Kinesiólogo",
    specialty_slug: "kinesiologo",
    city: "La Plata",
    province: "Buenos Aires",
    bio: "Kinesiólogo deportivo. Rehabilitación de lesiones y entrenamiento funcional.",
    public_slug: "lic-diego-fernandez",
    services: [
      { name: "Sesión de kinesiología", duration_minutes: 45, price: 14000, show_price: true },
      { name: "Rehabilitación deportiva", duration_minutes: 60, price: 20000, show_price: true },
    ],
  },
  {
    email: "lic.nutricion@bookme-test.com",
    full_name: "Lic. Laura Sánchez",
    dni: "31234567",
    phone: "+5491155550005",
    line: "healthcare",
    specialty: "Nutricionista",
    specialty_slug: "nutricionista",
    city: "Mendoza",
    province: "Mendoza",
    bio: "Nutricionista clínica. Planes personalizados, deportiva y trastornos alimentarios.",
    public_slug: "lic-laura-sanchez",
    services: [
      { name: "Primera consulta", duration_minutes: 60, price: 16000, show_price: true },
      { name: "Seguimiento", duration_minutes: 30, price: 10000, show_price: true },
      { name: "Plan nutricional completo", duration_minutes: 45, price: 22000, show_price: true },
    ],
  },
];

const PROFESSIONALS_BUSINESS: SeedProfessional[] = [
  {
    email: "peluqueria.romina@bookme-test.com",
    full_name: "Romina Peluquería",
    dni: "32111222",
    phone: "+5491155550006",
    line: "business",
    specialty: "Peluquera",
    specialty_slug: "peluquera",
    city: "CABA",
    province: "Buenos Aires",
    bio: "Corte, color y tratamientos capilares. 10 años de experiencia en colorimetría.",
    public_slug: "romina-peluqueria",
    services: [
      { name: "Corte de pelo", duration_minutes: 30, price: 8000, show_price: true },
      { name: "Color completo", duration_minutes: 90, price: 25000, show_price: true },
      { name: "Brushing", duration_minutes: 30, price: 5000, show_price: true },
      { name: "Tratamiento capilar", duration_minutes: 45, price: 12000, show_price: true },
    ],
  },
  {
    email: "barberia.martin@bookme-test.com",
    full_name: "Martín Barber Shop",
    dni: "33222333",
    phone: "+5491155550007",
    line: "business",
    specialty: "Barbero",
    specialty_slug: "barbero",
    city: "Rosario",
    province: "Santa Fe",
    bio: "Barbería clásica y moderna. Corte, barba, navaja y tratamientos.",
    public_slug: "martin-barber-shop",
    services: [
      { name: "Corte clásico", duration_minutes: 30, price: 6000, show_price: true },
      { name: "Corte + barba", duration_minutes: 45, price: 9000, show_price: true },
      { name: "Afeitado con navaja", duration_minutes: 20, price: 4000, show_price: true },
    ],
  },
  {
    email: "coach.pablo@bookme-test.com",
    full_name: "Pablo Fitness Coach",
    dni: "29333444",
    phone: "+5491155550008",
    line: "business",
    specialty: "Entrenador Personal",
    specialty_slug: "entrenador-personal",
    city: "Córdoba",
    province: "Córdoba",
    bio: "Entrenador personal certificado. Musculación, funcional y pérdida de peso.",
    public_slug: "pablo-fitness-coach",
    services: [
      { name: "Sesión individual", duration_minutes: 60, price: 10000, show_price: true },
      { name: "Evaluación física", duration_minutes: 45, price: 8000, show_price: true },
      { name: "Plan mensual personalizado", duration_minutes: 90, price: 15000, show_price: true },
    ],
  },
  {
    email: "coach.vida@bookme-test.com",
    full_name: "Valeria Coach de Vida",
    dni: "30444555",
    phone: "+5491155550009",
    line: "business",
    specialty: "Coach",
    specialty_slug: "coach",
    city: "CABA",
    province: "Buenos Aires",
    bio: "Life coaching y desarrollo personal. Sesiones individuales y grupales.",
    public_slug: "valeria-life-coach",
    services: [
      { name: "Sesión de coaching", duration_minutes: 60, price: 20000, show_price: true },
      { name: "Sesión grupal (hasta 5)", duration_minutes: 90, price: 8000, show_price: true },
    ],
  },
  {
    email: "abogado.ramirez@bookme-test.com",
    full_name: "Dr. Raúl Ramírez",
    dni: "25555666",
    phone: "+5491155550010",
    line: "business",
    specialty: "Abogado",
    specialty_slug: "abogado",
    city: "La Plata",
    province: "Buenos Aires",
    bio: "Abogado civil y comercial. Contratos, sucesiones y derecho de familia.",
    public_slug: "dr-raul-ramirez",
    services: [
      { name: "Consulta inicial", duration_minutes: 30, price: 15000, show_price: true },
      { name: "Asesoramiento legal", duration_minutes: 60, price: 25000, show_price: true },
    ],
  },
];

// Pacientes para Healthcare
const PATIENTS_HEALTHCARE: SeedPatient[] = [
  {
    email: "paciente.juan@bookme-test.com",
    full_name: "Juan Pérez",
    dni: "40111222",
    phone: "+5491155551001",
    professional_slug: "dr-carlos-garcia",
    insurance_name: "OSDE",
    insurance_number: "123456",
  },
  {
    email: "paciente.maria@bookme-test.com",
    full_name: "María Gómez",
    dni: "41222333",
    phone: "+5491155551002",
    professional_slug: "dr-carlos-garcia",
    insurance_name: "Swiss Medical",
    insurance_number: "789012",
  },
  {
    email: "paciente.lucia@bookme-test.com",
    full_name: "Lucía Rodríguez",
    dni: "42333444",
    phone: "+5491155551003",
    professional_slug: "lic-ana-martinez",
  },
  {
    email: "paciente.pedro@bookme-test.com",
    full_name: "Pedro Díaz",
    dni: "43444555",
    phone: "+5491155551004",
    professional_slug: "dra-maria-lopez",
    insurance_name: "Galeno",
    insurance_number: "345678",
  },
  {
    email: "paciente.sofia@bookme-test.com",
    full_name: "Sofía Torres",
    dni: "44555666",
    phone: "+5491155551005",
    professional_slug: "lic-diego-fernandez",
  },
  {
    email: "paciente.martin@bookme-test.com",
    full_name: "Martín Álvarez",
    dni: "45666777",
    phone: "+5491155551006",
    professional_slug: "lic-laura-sanchez",
    insurance_name: "OSDE",
    insurance_number: "901234",
  },
];

// Clientes para Business
const CLIENTS_BUSINESS: SeedPatient[] = [
  {
    email: "cliente.carolina@bookme-test.com",
    full_name: "Carolina Méndez",
    dni: "40777888",
    phone: "+5491155552001",
    professional_slug: "romina-peluqueria",
  },
  {
    email: "cliente.facundo@bookme-test.com",
    full_name: "Facundo Herrera",
    dni: "41888999",
    phone: "+5491155552002",
    professional_slug: "martin-barber-shop",
  },
  {
    email: "cliente.agustina@bookme-test.com",
    full_name: "Agustina Blanco",
    dni: "42999000",
    phone: "+5491155552003",
    professional_slug: "pablo-fitness-coach",
  },
  {
    email: "cliente.nicolas@bookme-test.com",
    full_name: "Nicolás Vega",
    dni: "43000111",
    phone: "+5491155552004",
    professional_slug: "valeria-life-coach",
  },
  {
    email: "cliente.valentina@bookme-test.com",
    full_name: "Valentina Ruiz",
    dni: "44111222",
    phone: "+5491155552005",
    professional_slug: "dr-raul-ramirez",
  },
];

// Admins y roles especiales
const ADMIN_USERS = [
  {
    email: "admin@bookme-test.com",
    full_name: "Admin BookMe",
    dni: "10000001",
    phone: "+5491155559001",
    role: "superadmin" as const,
  },
  {
    email: "marketing@bookme-test.com",
    full_name: "Marketing BookMe",
    dni: "10000002",
    phone: "+5491155559002",
    role: "marketing" as const,
  },
  {
    email: "secretaria@bookme-test.com",
    full_name: "Sandra Secretaria",
    dni: "10000003",
    phone: "+5491155559003",
    role: "admin" as const, // admin de consultorio
  },
];

// ─── Funciones helper ─────────────────────────────────────────────────

async function createAuthUser(email: string, password: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message?.includes("already") || error.message?.includes("exists")) {
      // Usuario ya existe, buscar su ID
      const { data: users } = await admin.auth.admin.listUsers();
      const existing = users?.users?.find((u) => u.email === email);
      if (existing) {
        console.log(`  ⚠️  ${email} ya existe, reutilizando ID`);
        return existing.id;
      }
    }
    throw new Error(`Error creando auth user ${email}: ${error.message}`);
  }

  return data.user.id;
}

async function createProfile(
  userId: string,
  data: { full_name: string; dni: string; phone: string; role: string }
) {
  const { error } = await admin.from("profiles").upsert({
    id: userId,
    full_name: data.full_name,
    dni: data.dni,
    phone: data.phone,
    role: data.role,
  });

  if (error) {
    console.error(`  ❌ Error creando perfil para ${data.full_name}:`, error.message);
  }
}

async function createProfessionalRecord(userId: string, prof: SeedProfessional) {
  // Crear registro de profesional
  const { error } = await admin.from("professionals").upsert({
    id: userId,
    line: prof.line,
    specialty: prof.specialty,
    specialty_slug: prof.specialty_slug,
    bio: prof.bio,
    city: prof.city,
    province: prof.province,
    country: "AR",
    public_slug: prof.public_slug,
    is_visible: true,
    subscription_plan: "standard",
    subscription_status: "active",
  });

  if (error) {
    console.error(`  ❌ Error creando profesional ${prof.full_name}:`, error.message);
    return;
  }

  // Crear servicios
  for (const svc of prof.services) {
    const { error: svcError } = await admin.from("services").insert({
      professional_id: userId,
      name: svc.name,
      duration_minutes: svc.duration_minutes,
      price: svc.price,
      show_price: svc.show_price,
      is_active: true,
      line: prof.line,
    });

    if (svcError && !svcError.message?.includes("duplicate")) {
      console.error(`  ❌ Error creando servicio "${svc.name}":`, svcError.message);
    }
  }

  // Crear configuración de agenda
  const { error: schedError } = await admin.from("schedule_configs").upsert({
    professional_id: userId,
    working_days: [1, 2, 3, 4, 5], // Lun-Vie
    slot_duration: 30,
    vacation_mode: false,
  });

  if (schedError) {
    console.error(`  ❌ Error creando schedule config:`, schedError.message);
  }

  // Crear horarios de trabajo (9:00-13:00 y 14:00-18:00, Lun-Vie)
  for (const day of [1, 2, 3, 4, 5]) {
    await admin.from("working_hours").insert([
      { professional_id: userId, day_of_week: day, start_time: "09:00", end_time: "13:00" },
      { professional_id: userId, day_of_week: day, start_time: "14:00", end_time: "18:00" },
    ]);
  }
}

// Map de professional slug → id para linkear pacientes
const professionalIdMap = new Map<string, string>();

async function createPatientForProfessional(
  patientData: SeedPatient,
  professionalId: string
) {
  // Crear auth + profile
  const userId = await createAuthUser(patientData.email, DEFAULT_PASSWORD);
  await createProfile(userId, {
    full_name: patientData.full_name,
    dni: patientData.dni,
    phone: patientData.phone,
    role: "patient",
  });

  // Crear registro de paciente vinculado al profesional
  const patientRecord: Record<string, unknown> = {
    professional_id: professionalId,
    profile_id: userId,
    full_name: patientData.full_name,
    dni: patientData.dni,
    email: patientData.email,
    phone: patientData.phone,
    is_particular: !patientData.insurance_name,
  };

  // Si tiene obra social, buscarla o crearla
  if (patientData.insurance_name) {
    let { data: insurance } = await admin
      .from("insurances")
      .select("id")
      .eq("name", patientData.insurance_name)
      .single();

    if (!insurance) {
      const { data: newIns } = await admin
        .from("insurances")
        .insert({ name: patientData.insurance_name, is_active: true })
        .select("id")
        .single();
      insurance = newIns;
    }

    if (insurance) {
      patientRecord.insurance_id = insurance.id;
      patientRecord.insurance_number = patientData.insurance_number;
    }
  }

  const { error } = await admin.from("patients").upsert(patientRecord as any, {
    onConflict: "professional_id,dni",
  });

  if (error) {
    console.error(`  ❌ Error creando paciente ${patientData.full_name}:`, error.message);
  }

  return userId;
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Iniciando seed de BookMe...\n");
  console.log(`🔑 Contraseña para TODOS los usuarios: ${DEFAULT_PASSWORD}\n`);

  // 1. Profesionales Healthcare
  console.log("━━━ PROFESIONALES HEALTHCARE ━━━");
  for (const prof of PROFESSIONALS_HEALTHCARE) {
    try {
      console.log(`\n👨‍⚕️ Creando: ${prof.full_name} (${prof.specialty})`);
      const userId = await createAuthUser(prof.email, DEFAULT_PASSWORD);
      await createProfile(userId, { ...prof, role: "professional" });
      await createProfessionalRecord(userId, prof);
      professionalIdMap.set(prof.public_slug, userId);
      console.log(`  ✅ ${prof.email} → /${prof.public_slug}`);
    } catch (err) {
      console.error(`  ❌ ${prof.full_name}:`, (err as Error).message);
    }
  }

  // 2. Profesionales Business
  console.log("\n━━━ PROFESIONALES BUSINESS ━━━");
  for (const prof of PROFESSIONALS_BUSINESS) {
    try {
      console.log(`\n💼 Creando: ${prof.full_name} (${prof.specialty})`);
      const userId = await createAuthUser(prof.email, DEFAULT_PASSWORD);
      await createProfile(userId, { ...prof, role: "professional" });
      await createProfessionalRecord(userId, prof);
      professionalIdMap.set(prof.public_slug, userId);
      console.log(`  ✅ ${prof.email} → /${prof.public_slug}`);
    } catch (err) {
      console.error(`  ❌ ${prof.full_name}:`, (err as Error).message);
    }
  }

  // 3. Pacientes Healthcare
  console.log("\n━━━ PACIENTES HEALTHCARE ━━━");
  for (const patient of PATIENTS_HEALTHCARE) {
    try {
      const profId = professionalIdMap.get(patient.professional_slug);
      if (!profId) {
        console.error(`  ❌ Profesional ${patient.professional_slug} no encontrado`);
        continue;
      }
      console.log(`\n🏥 Creando paciente: ${patient.full_name} → ${patient.professional_slug}`);
      await createPatientForProfessional(patient, profId);
      console.log(`  ✅ ${patient.email}`);
    } catch (err) {
      console.error(`  ❌ ${patient.full_name}:`, (err as Error).message);
    }
  }

  // 4. Clientes Business
  console.log("\n━━━ CLIENTES BUSINESS ━━━");
  for (const client of CLIENTS_BUSINESS) {
    try {
      const profId = professionalIdMap.get(client.professional_slug);
      if (!profId) {
        console.error(`  ❌ Profesional ${client.professional_slug} no encontrado`);
        continue;
      }
      console.log(`\n💇 Creando cliente: ${client.full_name} → ${client.professional_slug}`);
      await createPatientForProfessional(client, profId);
      console.log(`  ✅ ${client.email}`);
    } catch (err) {
      console.error(`  ❌ ${client.full_name}:`, (err as Error).message);
    }
  }

  // 5. Usuarios admin
  console.log("\n━━━ USUARIOS ADMIN ━━━");
  for (const adm of ADMIN_USERS) {
    try {
      console.log(`\n🔧 Creando: ${adm.full_name} (${adm.role})`);
      const userId = await createAuthUser(adm.email, DEFAULT_PASSWORD);
      await createProfile(userId, adm);
      console.log(`  ✅ ${adm.email} [${adm.role}]`);
    } catch (err) {
      console.error(`  ❌ ${adm.full_name}:`, (err as Error).message);
    }
  }

  // 6. Crear clínica de ejemplo y asignar secretaria
  console.log("\n━━━ CLÍNICA DE EJEMPLO ━━━");
  try {
    const drGarciaId = professionalIdMap.get("dr-carlos-garcia");
    if (drGarciaId) {
      const { data: clinic, error: clinicError } = await admin
        .from("clinics")
        .insert({
          name: "Centro Médico Salud Total",
          slug: "salud-total",
          owner_id: drGarciaId,
          address: "Av. Corrientes 1234, Piso 5",
          city: "CABA",
          province: "Buenos Aires",
          country: "AR",
          phone: "+5491155550099",
          email: "info@saludtotal-test.com",
        })
        .select("id")
        .single();

      if (clinic && !clinicError) {
        // Vincular Dr. García a la clínica
        await admin.from("professionals").update({ clinic_id: clinic.id }).eq("id", drGarciaId);

        // Vincular secretaria como admin de la clínica
        const { data: secretariaProfile } = await admin
          .from("profiles")
          .select("id")
          .eq("dni", "10000003")
          .single();

        if (secretariaProfile) {
          await admin.from("clinic_admins").insert({
            clinic_id: clinic.id,
            profile_id: secretariaProfile.id,
          });
        }

        console.log(`  ✅ Clínica "Centro Médico Salud Total" creada`);
        console.log(`  ✅ Dr. García vinculado a la clínica`);
        console.log(`  ✅ Secretaria vinculada como admin`);
      } else if (clinicError) {
        console.error(`  ❌ Error creando clínica:`, clinicError.message);
      }
    }
  } catch (err) {
    console.error(`  ❌ Error en clínica:`, (err as Error).message);
  }

  // ─── Resumen final ────────────────────────────────────────────────
  console.log("\n\n╔══════════════════════════════════════════════════════════════╗");
  console.log("║              🌱 SEED COMPLETADO — RESUMEN                   ║");
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log(`║  🔑 Contraseña para todos: ${DEFAULT_PASSWORD}              ║`);
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  👨‍⚕️ PROFESIONALES HEALTHCARE                               ║");
  for (const p of PROFESSIONALS_HEALTHCARE) {
    console.log(`║  • ${p.email.padEnd(42)} ${p.specialty.padEnd(10)}║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  💼 PROFESIONALES BUSINESS                                  ║");
  for (const p of PROFESSIONALS_BUSINESS) {
    console.log(`║  • ${p.email.padEnd(42)} ${p.specialty.padEnd(10)}║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  🏥 PACIENTES HEALTHCARE                                    ║");
  for (const p of PATIENTS_HEALTHCARE) {
    console.log(`║  • ${p.email.padEnd(42)} → ${p.professional_slug.substring(0, 10).padEnd(10)}║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  💇 CLIENTES BUSINESS                                       ║");
  for (const p of CLIENTS_BUSINESS) {
    console.log(`║  • ${p.email.padEnd(42)} → ${p.professional_slug.substring(0, 10).padEnd(10)}║`);
  }
  console.log("╠══════════════════════════════════════════════════════════════╣");
  console.log("║  🔧 ADMIN / SISTEMA                                         ║");
  for (const a of ADMIN_USERS) {
    console.log(`║  • ${a.email.padEnd(42)} [${a.role.padEnd(10)}]║`);
  }
  console.log("╚══════════════════════════════════════════════════════════════╝");
}

main()
  .then(() => {
    console.log("\n✅ Seed finalizado.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error fatal:", err);
    process.exit(1);
  });
