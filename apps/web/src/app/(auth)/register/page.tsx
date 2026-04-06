"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Stethoscope, User, ChevronRight } from "lucide-react";

// Especialidades sugeridas por línea
const SPECIALTIES: Record<string, string[]> = {
  healthcare: [
    "Médico/a Clínico/a",
    "Pediatra",
    "Odontólogo/a",
    "Psicólogo/a",
    "Kinesiólogo/a",
    "Nutricionista",
    "Dermatólogo/a",
    "Ginecólogo/a",
    "Traumatólogo/a",
    "Cardiólogo/a",
  ],
  business: [
    "Peluquería",
    "Barbería",
    "Estética",
    "Coach / Consultoría",
    "Abogado/a",
    "Contador/a",
    "Entrenador/a personal",
    "Masajista",
    "Tatuador/a",
    "Profesor/a particular",
  ],
};

export default function RegisterPage() {
  // Step 1: Tipo de cuenta
  const [accountType, setAccountType] = useState<"patient" | "professional" | null>(null);

  // Datos comunes
  const [fullName, setFullName] = useState("");
  const [dni, setDni] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Datos profesionales
  const [line, setLine] = useState<"healthcare" | "business">("healthcare");
  const [specialty, setSpecialty] = useState("");
  const [customSpecialty, setCustomSpecialty] = useState("");

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

  const validateForm = (): boolean => {
    if (!fullName.trim()) { showError("El nombre completo es requerido"); return false; }
    if (!dni.trim()) { showError("El DNI es requerido"); return false; }
    if (!phone.trim()) { showError("El teléfono es requerido"); return false; }
    if (!email.trim()) { showError("El email es requerido"); return false; }
    if (password.length < 6) { showError("La contraseña debe tener al menos 6 caracteres"); return false; }
    if (password !== confirmPassword) { showError("Las contraseñas no coinciden"); return false; }

    if (accountType === "professional") {
      const finalSpecialty = specialty === "__custom" ? customSpecialty : specialty;
      if (!finalSpecialty.trim()) { showError("La especialidad es requerida"); return false; }
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

      setSuccess(
        accountType === "professional"
          ? "Registro exitoso. Redirigiendo a tu panel profesional..."
          : "Registro exitoso. Redirigiendo..."
      );

      const redirect = data.redirect ?? (accountType === "professional" ? "/dashboard" : "/mis-turnos");
      setTimeout(() => { window.location.href = redirect; }, 1500);
    } catch {
      showError("Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/callback` },
    });
    if (authError) setError(authError.message);
  };

  // ─── Step 1: Elegir tipo de cuenta ──────────────────────────
  if (accountType === null) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-8">
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
                    Médico, psicólogo, peluquero, coach, abogado...
                  </p>
                </div>
                <span className="inline-flex items-center text-xs font-medium text-blue-600 dark:text-blue-400">
                  30 días gratis <ChevronRight className="h-3 w-3 ml-0.5" />
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
  const accentColor = isProfessional ? "blue" : "emerald";

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <h1 className="text-4xl font-heading font-bold text-bookme-navy dark:text-bookme-mint">BookMe</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {isProfessional ? "Registro profesional — 30 días gratis" : "Reservá tus turnos online"}
          </p>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 shadow-sm space-y-6">
          {/* Header con botón volver */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-xl font-heading font-semibold text-foreground">
                {isProfessional ? "Registro profesional" : "Crear cuenta"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isProfessional
                  ? "Completá tus datos para activar tu trial de 30 días"
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

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleRegister}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Registrarse con Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o</span>
            </div>
          </div>

          {/* Formulario */}
          <form onSubmit={handleRegister} className="space-y-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label htmlFor="fullName" className="text-sm font-medium text-foreground">
                Nombre completo
              </label>
              <input
                id="fullName" type="text" autoComplete="name"
                placeholder={isProfessional ? "Dr. Juan Pérez" : "Juan Pérez"}
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                required disabled={loading}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
              />
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

            {/* Contraseñas en 2 columnas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-foreground">Contraseña</label>
                <input
                  id="password" type="password" autoComplete="new-password" placeholder="Min. 6 caracteres"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirmar</label>
                <input
                  id="confirmPassword" type="password" autoComplete="new-password" placeholder="Repetir"
                  value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  required disabled={loading}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* ── Campos extra para profesionales ── */}
            {isProfessional && (
              <div className="space-y-4 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 p-4">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Datos profesionales
                </p>

                {/* Línea de negocio */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Línea de negocio</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setLine("healthcare"); setSpecialty(""); }}
                      className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        line === "healthcare"
                          ? "border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-400 dark:bg-blue-900/50 dark:text-blue-200"
                          : "border-border bg-background text-muted-foreground hover:border-blue-300"
                      }`}
                    >
                      <Stethoscope className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                      Salud
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLine("business"); setSpecialty(""); }}
                      className={`rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-all ${
                        line === "business"
                          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-900/50 dark:text-emerald-200"
                          : "border-border bg-background text-muted-foreground hover:border-emerald-300"
                      }`}
                    >
                      <User className="inline h-4 w-4 mr-1.5 -mt-0.5" />
                      Negocios
                    </button>
                  </div>
                </div>

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

                {/* Beneficio trial */}
                <div className="flex items-center gap-2 rounded-md bg-blue-100 dark:bg-blue-900/40 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  <span className="font-bold text-base">30</span>
                  <span>días de prueba gratis con todas las funcionalidades del plan Standard.</span>
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
