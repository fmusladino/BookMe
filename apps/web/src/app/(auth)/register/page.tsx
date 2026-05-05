"use client";

import { useState, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Stethoscope, User, ChevronRight, Store, Eye, EyeOff, Check, X } from "lucide-react";
import { getPasswordStrength, PASSWORD_MIN_LENGTH } from "@/lib/password";
import { TRIAL_DAYS } from "@/lib/trial";

// Especialidades sugeridas por línea
const SPECIALTIES: Record<string, string[]> = {
  healthcare: [
    "Acupunturista",
    "Alergólogo/a",
    "Anestesiólogo/a",
    "Cardiólogo/a",
    "Cirujano/a General",
    "Cirujano/a Plástico/a",
    "Dermatólogo/a",
    "Endocrinólogo/a",
    "Endodoncista",
    "Enfermero/a",
    "Fisiatra",
    "Fonoaudiólogo/a",
    "Gastroenterólogo/a",
    "Geriatra",
    "Ginecólogo/a",
    "Hematólogo/a",
    "Homeópata",
    "Implantólogo/a",
    "Infectólogo/a",
    "Inmunólogo/a",
    "Kinesiólogo/a",
    "Médico/a Clínico/a",
    "Médico/a Deportólogo/a",
    "Médico/a Estético/a",
    "Médico/a Familiar",
    "Nefrólogo/a",
    "Neumólogo/a",
    "Neurocirujano/a",
    "Neurólogo/a",
    "Nutricionista",
    "Obstetra / Partera",
    "Odontólogo/a",
    "Oftalmólogo/a",
    "Oncólogo/a",
    "Optometrista",
    "Ortodoncista",
    "Osteópata",
    "Otorrinolaringólogo/a",
    "Patólogo/a",
    "Pediatra",
    "Periodoncista",
    "Podólogo/a",
    "Psicólogo/a",
    "Psicopedagogo/a",
    "Psiquiatra",
    "Quiropráctico/a",
    "Radiólogo/a",
    "Reumatólogo/a",
    "Terapeuta Ocupacional",
    "Traumatólogo/a",
    "Urólogo/a",
  ],
};

const BUSINESS_TYPES = [
  "Canchas de fútbol",
  "Canchas de pádel",
  "Canchas de tenis",
  "Canchas multideporte",
  "Restaurante",
  "Bar / Cervecería",
  "Cafetería",
  "Salón de eventos",
  "Coworking",
  "Estudio de grabación",
  "Otro",
];

export default function RegisterPage() {
  // Step 1: Tipo de cuenta
  const [accountType, setAccountType] = useState<"patient" | "professional" | "canchas" | null>(null);

  // Datos comunes
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Datos profesionales (BookMe es solo Healthcare)
  const line = "healthcare" as const;
  const [specialty, setSpecialty] = useState("");
  const [customSpecialty, setCustomSpecialty] = useState("");

  // Datos de canchas
  const [businessName, setBusinessName] = useState("");
  const [sport, setSport] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  // Ubicación del consultorio/local/complejo
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("AR");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const showError = (msg: string) => {
    setError(msg);
    setTimeout(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  };

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const validateForm = (): boolean => {
    if (!firstName.trim()) { showError("El nombre es requerido"); return false; }
    if (!lastName.trim()) { showError("El apellido es requerido"); return false; }
    if (!dni.trim()) { showError("El DNI es requerido"); return false; }
    if (!phone.trim()) { showError("El teléfono es requerido"); return false; }
    if (!email.trim()) { showError("El email es requerido"); return false; }
    if (!passwordStrength.valid) {
      showError(`La contraseña no cumple los requisitos mínimos de seguridad`);
      return false;
    }
    if (password !== confirmPassword) { showError("Las contraseñas no coinciden"); return false; }

    if (accountType === "professional") {
      const finalSpecialty = specialty === "__custom" ? customSpecialty : specialty;
      if (!finalSpecialty.trim()) { showError("La especialidad es requerida"); return false; }
      if (!address.trim()) { showError("La dirección del consultorio es requerida"); return false; }
      if (!city.trim()) { showError("La localidad es requerida"); return false; }
      if (!province.trim()) { showError("La provincia es requerida"); return false; }
      if (!postalCode.trim()) { showError("El código postal es requerido"); return false; }
      if (!country.trim()) { showError("El país es requerido"); return false; }
    }

    if (accountType === "canchas") {
      if (!businessName.trim()) { showError("El nombre del comercio es requerido"); return false; }
      if (!city.trim()) { showError("La localidad es requerida"); return false; }
      if (!province.trim()) { showError("La provincia es requerida"); return false; }
    }

    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (!validateForm()) { setLoading(false); return; }

    const finalSpecialty = specialty === "__custom" ? customSpecialty : specialty;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          dni,
          phone,
          account_type: accountType,
          ...(accountType === "professional" && {
            line,
            specialty: finalSpecialty,
            address,
            city,
            province,
            postal_code: postalCode,
            country,
          }),
          ...(accountType === "canchas" && {
            business_name: businessName,
            sport,
            whatsapp,
            address,
            city,
            province,
            postal_code: postalCode,
            country,
          }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Error al registrarse");
        return;
      }

      // Login automático
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

      if (loginError) {
        setSuccess("Cuenta creada. Redirigiendo al login...");
        setTimeout(() => router.push("/login"), 1500);
        return;
      }

      const redirectMap = {
        professional: "/dashboard",
        patient: "/mis-turnos",
        canchas: "/canchas",
      };

      setSuccess(
        accountType === "canchas"
          ? "Registro exitoso. Redirigiendo a tu panel de canchas..."
          : accountType === "professional"
            ? "Registro exitoso. Redirigiendo a tu panel profesional..."
            : "Registro exitoso. Redirigiendo..."
      );

      const redirect = data.redirect ?? redirectMap[accountType as keyof typeof redirectMap] ?? "/";
      setTimeout(() => { window.location.href = redirect; }, 1500);
    } catch {
      showError("Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  // ─── Step 1: Elegir tipo de cuenta ──────────────────────────
  if (accountType === null) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <h1 className="text-4xl font-heading font-bold text-bookme-navy dark:text-bookme-mint">BookMe</h1>
            <p className="mt-2 text-muted-foreground text-sm">Creá tu cuenta para empezar</p>
          </div>

          <div className="bg-card border border-border rounded-lg p-8 shadow-sm space-y-6">
            <div className="space-y-1 text-center">
              <h2 className="text-xl font-heading font-semibold text-foreground">
                ¿Cómo querés usar BookMe?
              </h2>
              <p className="text-sm text-muted-foreground">
                Elegí tu tipo de cuenta para personalizar tu experiencia
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Profesional */}
              <button
                onClick={() => setAccountType("professional")}
                className="group relative flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 text-center transition-all hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-md dark:hover:border-blue-400 dark:hover:bg-blue-950/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50 transition-colors group-hover:bg-blue-200 dark:group-hover:bg-blue-900">
                  <Stethoscope className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Soy Profesional</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Médico, psicólogo, kinesiólogo, nutricionista...
                  </p>
                </div>
                <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                  {TRIAL_DAYS} días gratis <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </button>

              {/* Paciente / Cliente */}
              <button
                onClick={() => setAccountType("patient")}
                className="group relative flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 text-center transition-all hover:border-emerald-500 hover:bg-emerald-50/50 hover:shadow-md dark:hover:border-emerald-400 dark:hover:bg-emerald-950/30"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50 transition-colors group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900">
                  <User className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Soy Paciente / Cliente</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Quiero reservar turnos con profesionales
                  </p>
                </div>
                <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  Gratis para siempre <ChevronRight className="h-3 w-3 ml-0.5" />
                </span>
              </button>

              {/* Canchas — oculto temporalmente, en construcción */}
              {false && (
                <button
                  onClick={() => setAccountType("canchas")}
                  className="group relative flex flex-col items-center gap-3 rounded-xl border-2 border-border bg-background p-6 text-center transition-all hover:border-orange-500 hover:bg-orange-50/50 hover:shadow-md dark:hover:border-orange-400 dark:hover:bg-orange-950/30"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/50 transition-colors group-hover:bg-orange-200 dark:group-hover:bg-orange-900">
                    <Store className="h-7 w-7 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Tengo un Comercio</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Canchas, restaurantes, bares y más
                    </p>
                  </div>
                  <span className="inline-flex items-center text-xs font-medium text-orange-600 dark:text-orange-400">
                    {TRIAL_DAYS} días gratis <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </button>
              )}
            </div>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">¿Ya tenés cuenta? </span>
              <Link href="/login" className="font-medium text-bookme-navy dark:text-bookme-mint hover:underline">
                Iniciá sesión
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ─── Step 2: Formulario de registro ─────────────────────────
  const isProfessional = accountType === "professional";
  const isCanchas = accountType === "canchas";

  const accentColors = {
    professional: "blue",
    patient: "emerald",
    canchas: "orange",
  };
  const accentColor = accentColors[accountType];

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-bookme-navy dark:text-bookme-mint">BookMe</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isProfessional
              ? `Registro profesional — ${TRIAL_DAYS} días gratis`
              : isCanchas
                ? `Registro de canchas — ${TRIAL_DAYS} días gratis`
                : "Reservá tus turnos online"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm space-y-6">
          {/* Header con botón volver */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-heading font-semibold text-foreground">
                {isProfessional
                  ? "Registro profesional"
                  : isCanchas
                    ? "Registro de canchas"
                    : "Crear cuenta"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isProfessional
                  ? `Completá tus datos para activar tu trial de ${TRIAL_DAYS} días`
                  : isCanchas
                    ? "Configurá tu comercio y empezá a recibir reservas"
                    : "Registrate para reservar turnos"
                }
              </p>
            </div>
            <button
              onClick={() => setAccountType(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Cambiar
            </button>
          </div>

          {success && (
            <div className="rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-600 dark:text-green-400">
              {success}
            </div>
          )}

          {/* Formulario */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nombre + Apellido */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="firstName" className="text-sm font-medium text-foreground">Nombre</label>
                <input
                  id="firstName" type="text" autoComplete="given-name"
                  placeholder={isProfessional ? "Juan" : "Juan"}
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lastName" className="text-sm font-medium text-foreground">Apellido</label>
                <input
                  id="lastName" type="text" autoComplete="family-name"
                  placeholder="Pérez"
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* DNI + Teléfono */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="dni" className="text-sm font-medium text-foreground">DNI</label>
                <input
                  id="dni" type="text" autoComplete="off" placeholder="12345678"
                  value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="phone" className="text-sm font-medium text-foreground">Teléfono</label>
                <input
                  id="phone" type="tel" autoComplete="tel" placeholder="+54 9 11 1234-5678"
                  value={phone} onChange={(e) => setPhone(e.target.value)}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">Email</label>
              <input
                id="email" type="email" autoComplete="email" placeholder="tu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required disabled={loading}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
              />
            </div>

            {/* Contraseñas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder={`Mín. ${PASSWORD_MIN_LENGTH} caracteres`}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirmar</label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repetir"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    required disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Medidor de fuerza + checklist */}
            {password.length > 0 && (
              <div className="space-y-2 -mt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {[1, 2, 3, 4].map((i) => {
                      const active = passwordStrength.score >= i;
                      const color =
                        passwordStrength.score <= 1 ? "bg-red-500"
                        : passwordStrength.score === 2 ? "bg-orange-500"
                        : passwordStrength.score === 3 ? "bg-yellow-500"
                        : "bg-green-500";
                      return (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-colors ${active ? color : "bg-muted"}`}
                        />
                      );
                    })}
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength.score <= 1 ? "text-red-500"
                    : passwordStrength.score === 2 ? "text-orange-500"
                    : passwordStrength.score === 3 ? "text-yellow-600 dark:text-yellow-500"
                    : "text-green-600 dark:text-green-500"
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  {[
                    { ok: passwordStrength.requirements.length, text: `Al menos ${PASSWORD_MIN_LENGTH} caracteres` },
                    { ok: passwordStrength.requirements.upper, text: "Una mayúscula (A-Z)" },
                    { ok: passwordStrength.requirements.lower, text: "Una minúscula (a-z)" },
                    { ok: passwordStrength.requirements.number, text: "Un número (0-9)" },
                    { ok: passwordStrength.requirements.special, text: "Un símbolo (!@#$...)" },
                    { ok: passwordStrength.requirements.notCommon, text: "No ser una clave común" },
                  ].map((req) => (
                    <li key={req.text} className={`flex items-center gap-1.5 ${req.ok ? "text-green-600 dark:text-green-500" : "text-muted-foreground"}`}>
                      {req.ok ? <Check className="h-3 w-3 shrink-0" /> : <X className="h-3 w-3 shrink-0" />}
                      <span>{req.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Campos extra para profesionales ── */}
            {isProfessional && (
              <div className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Datos profesionales
                </p>

                {/* Especialidad */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Especialidad</label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  >
                    <option value="">Seleccioná tu especialidad...</option>
                    {(SPECIALTIES[line] ?? []).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                    <option value="__custom">Otra (escribir manualmente)</option>
                  </select>
                  {specialty === "__custom" && (
                    <input
                      type="text"
                      placeholder="Escribí tu especialidad..."
                      value={customSpecialty}
                      onChange={(e) => setCustomSpecialty(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50 mt-2"
                    />
                  )}
                </div>

                {/* Ubicación del consultorio */}
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide pt-2">
                  Ubicación del consultorio
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label htmlFor="address" className="text-sm font-medium text-foreground">Dirección</label>
                    <input
                      id="address" type="text" autoComplete="street-address"
                      placeholder="Av. Corrientes 1234, Piso 3, Of. B"
                      value={address} onChange={(e) => setAddress(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="postalCode" className="text-sm font-medium text-foreground">CP</label>
                    <input
                      id="postalCode" type="text" autoComplete="postal-code" placeholder="2000"
                      value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="city" className="text-sm font-medium text-foreground">Localidad</label>
                    <input
                      id="city" type="text" autoComplete="address-level2" placeholder="Rosario"
                      value={city} onChange={(e) => setCity(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="province" className="text-sm font-medium text-foreground">Provincia</label>
                    <select
                      id="province" value={province} onChange={(e) => setProvince(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    >
                      <option value="">Seleccioná...</option>
                      <option value="Buenos Aires">Buenos Aires</option>
                      <option value="CABA">CABA</option>
                      <option value="Catamarca">Catamarca</option>
                      <option value="Chaco">Chaco</option>
                      <option value="Chubut">Chubut</option>
                      <option value="Córdoba">Córdoba</option>
                      <option value="Corrientes">Corrientes</option>
                      <option value="Entre Ríos">Entre Ríos</option>
                      <option value="Formosa">Formosa</option>
                      <option value="Jujuy">Jujuy</option>
                      <option value="La Pampa">La Pampa</option>
                      <option value="La Rioja">La Rioja</option>
                      <option value="Mendoza">Mendoza</option>
                      <option value="Misiones">Misiones</option>
                      <option value="Neuquén">Neuquén</option>
                      <option value="Río Negro">Río Negro</option>
                      <option value="Salta">Salta</option>
                      <option value="San Juan">San Juan</option>
                      <option value="San Luis">San Luis</option>
                      <option value="Santa Cruz">Santa Cruz</option>
                      <option value="Santa Fe">Santa Fe</option>
                      <option value="Santiago del Estero">Santiago del Estero</option>
                      <option value="Tierra del Fuego">Tierra del Fuego</option>
                      <option value="Tucumán">Tucumán</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="country" className="text-sm font-medium text-foreground">País</label>
                    <select
                      id="country" value={country} onChange={(e) => setCountry(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    >
                      <option value="AR">Argentina</option>
                      <option value="UY">Uruguay</option>
                      <option value="CL">Chile</option>
                      <option value="CO">Colombia</option>
                      <option value="MX">México</option>
                      <option value="PE">Perú</option>
                      <option value="BR">Brasil</option>
                      <option value="PY">Paraguay</option>
                      <option value="BO">Bolivia</option>
                      <option value="EC">Ecuador</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-blue-100 dark:bg-blue-900/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-bold text-base">{TRIAL_DAYS}</span>
                  <span>días de prueba gratis con todas las funcionalidades del plan Standard.</span>
                </div>
              </div>
            )}

            {/* ── Campos extra para canchas ── */}
            {isCanchas && (
              <div className="space-y-4 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20 p-4">
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  Datos del comercio
                </p>

                {/* Nombre del comercio */}
                <div className="space-y-1.5">
                  <label htmlFor="businessName" className="text-sm font-medium text-foreground">
                    Nombre del comercio
                  </label>
                  <input
                    id="businessName" type="text"
                    placeholder="Ej: Club Deportivo Los Pinos, Restaurante El Roble"
                    value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    required disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Tipo de comercio */}
                <div className="space-y-1.5">
                  <label htmlFor="sport" className="text-sm font-medium text-foreground">
                    Tipo de comercio (opcional)
                  </label>
                  <select
                    id="sport"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  >
                    <option value="">Seleccioná el tipo de comercio...</option>
                    {BUSINESS_TYPES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* WhatsApp */}
                <div className="space-y-1.5">
                  <label htmlFor="whatsapp" className="text-sm font-medium text-foreground">
                    WhatsApp del comercio (opcional)
                  </label>
                  <input
                    id="whatsapp" type="tel"
                    placeholder="+54 9 11 1234-5678"
                    value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  />
                </div>

                {/* Ubicación */}
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide pt-2">
                  Ubicación del comercio
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="address-c" className="text-sm font-medium text-foreground">
                    Dirección (opcional)
                  </label>
                  <input
                    id="address-c" type="text"
                    placeholder="Av. San Martín 1500"
                    value={address} onChange={(e) => setAddress(e.target.value)}
                    disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1.5">
                    <label htmlFor="city-c" className="text-sm font-medium text-foreground">Localidad</label>
                    <input
                      id="city-c" type="text" placeholder="Rosario"
                      value={city} onChange={(e) => setCity(e.target.value)}
                      required disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="postalCode-c" className="text-sm font-medium text-foreground">CP</label>
                    <input
                      id="postalCode-c" type="text" placeholder="2000"
                      value={postalCode} onChange={(e) => setPostalCode(e.target.value)}
                      disabled={loading}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="province-c" className="text-sm font-medium text-foreground">Provincia</label>
                  <select
                    id="province-c" value={province} onChange={(e) => setProvince(e.target.value)}
                    required disabled={loading}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                  >
                    <option value="">Seleccioná...</option>
                    <option value="Buenos Aires">Buenos Aires</option>
                    <option value="CABA">CABA</option>
                    <option value="Catamarca">Catamarca</option>
                    <option value="Chaco">Chaco</option>
                    <option value="Chubut">Chubut</option>
                    <option value="Córdoba">Córdoba</option>
                    <option value="Corrientes">Corrientes</option>
                    <option value="Entre Ríos">Entre Ríos</option>
                    <option value="Formosa">Formosa</option>
                    <option value="Jujuy">Jujuy</option>
                    <option value="La Pampa">La Pampa</option>
                    <option value="La Rioja">La Rioja</option>
                    <option value="Mendoza">Mendoza</option>
                    <option value="Misiones">Misiones</option>
                    <option value="Neuquén">Neuquén</option>
                    <option value="Río Negro">Río Negro</option>
                    <option value="Salta">Salta</option>
                    <option value="San Juan">San Juan</option>
                    <option value="San Luis">San Luis</option>
                    <option value="Santa Cruz">Santa Cruz</option>
                    <option value="Santa Fe">Santa Fe</option>
                    <option value="Santiago del Estero">Santiago del Estero</option>
                    <option value="Tierra del Fuego">Tierra del Fuego</option>
                    <option value="Tucumán">Tucumán</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-md bg-orange-100 dark:bg-orange-900/40 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
                  <span className="font-bold text-base">{TRIAL_DAYS}</span>
                  <span>días de prueba gratis. Configurá tus canchas, horarios y empezá a recibir reservas online.</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div ref={errorRef} className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading
                ? "Registrando..."
                : isProfessional
                  ? "Crear cuenta y empezar trial"
                  : isCanchas
                    ? "Crear cuenta de canchas"
                    : "Crear cuenta"
              }
            </button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">¿Ya tenés cuenta? </span>
            <Link href="/login" className="font-medium text-bookme-navy dark:text-bookme-mint hover:underline">
              Iniciá sesión
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
