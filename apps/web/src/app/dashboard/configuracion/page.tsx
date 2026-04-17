"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Plus, Trash2, Palmtree, Save, Calendar, Link2, Unlink, Globe, EyeOff, Video, Copy, Check, Building2, Loader2, X, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { invalidateScheduleConfigGlobal } from "@/hooks/use-schedule-config";
import { useSession } from "@/hooks/use-session";
import { AvatarUpload } from "@/components/avatar-upload";
import { SLOT_DURATIONS } from "@/lib/constants";

const DAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

// Lista precargada de obras sociales y prepagas argentinas
const INSURANCES_CATALOG = [
  // Prepagas principales
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medicus",
  "Omint",
  "Hospital Italiano",
  "Hospital Alemán",
  "Hospital Británico",
  "Avalian (ex ACA Salud)",
  "ACCORD Salud",
  "Medifé",
  "Sancor Salud",
  "Prevención Salud",
  "Jerárquicos Salud",
  "Federada Salud",
  "Sanitas Argentina",
  "Fundación Favaloro",
  "CEMIC",
  "Docthos",
  "Bristol Group",
  "Hominis",
  "Luis Pasteur",
  "Mita Salud",
  "Paraná Salud",
  "Prana Salud",
  "Staff Médico",
  "UP! Salud",
  "Vittal",
  "William Hope",
  // Obras sociales sindicales / nacionales
  "OSECAC (Comercio)",
  "OSPACA (Alimentación)",
  "OSDOP (Docentes Privados)",
  "OSUTHGRA (Gastronómicos)",
  "OSPLAD (Docentes)",
  "OSDE Binario",
  "OSPEDYC (Entidades Deportivas)",
  "OSPECON (Construcción)",
  "OSPAT (Transporte Automotor)",
  "OSPRERA (Rural)",
  "OSMATA (SMATA - Mecánicos)",
  "OSECAC",
  "OSPEGAP",
  "OSJERA",
  "OSPJN (Poder Judicial)",
  "OSDIPP",
  "OSFATLYF (Luz y Fuerza)",
  "OSPF (Farmacéuticos)",
  "OSSEG (Seguros)",
  "OSPE (Petroleros)",
  "OSPIA (Publicidad)",
  "UPCN Salud",
  "Unión Personal",
  // Provinciales / IOMA
  "IOMA",
  "IAPOS (Santa Fe)",
  "IPROSS (Río Negro)",
  "SEMPRE (Mendoza)",
  "DOSEP (San Luis)",
  "IPS (Misiones)",
  "OSEP (Mendoza)",
  "IOSCOR (Corrientes)",
  // PAMI y estatales
  "PAMI",
  "Incluir Salud (ex PROFE)",
  "DASPU (Universitarios)",
  // Otras
  "Particular (sin cobertura)",
].sort((a, b) => a.localeCompare(b, "es"));

interface WorkingHourRow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  modality: "presencial" | "virtual" | "both";
}

interface ScheduleConfigState {
  workingDays: number[];
  slotDuration: number;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  vacationMode: boolean;
  vacationFrom: string;
  vacationUntil: string;
}

interface GCalStatus {
  connected: boolean;
  lastSyncedAt: string | null;
  connectedSince: string | null;
}

interface ProfInsurance {
  id: string;
  name: string;
  code: string | null;
  logo_url: string | null;
  professional_insurance_id: string;
}

export default function ConfiguracionPage() {
  const { user, refresh: refreshSession } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gcalStatus, setGcalStatus] = useState<GCalStatus>({ connected: false, lastSyncedAt: null, connectedSince: null });
  const [gcalLoading, setGcalLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  // Obras sociales / prepagas del profesional
  const [profInsurances, setProfInsurances] = useState<ProfInsurance[]>([]);
  const [insurancesLoading, setInsurancesLoading] = useState(false);
  const [newInsuranceName, setNewInsuranceName] = useState("");
  const [addingInsurance, setAddingInsurance] = useState(false);
  const [insuranceSearch, setInsuranceSearch] = useState("");
  const searchParams = useSearchParams();

  const [config, setConfig] = useState<ScheduleConfigState>({
    workingDays: [1, 2, 3, 4, 5],
    slotDuration: 30,
    lunchBreakStart: "",
    lunchBreakEnd: "",
    vacationMode: false,
    vacationFrom: "",
    vacationUntil: "",
  });

  const [workingHours, setWorkingHours] = useState<WorkingHourRow[]>([
    { dayOfWeek: 1, startTime: "09:00", endTime: "18:00", modality: "both" },
    { dayOfWeek: 2, startTime: "09:00", endTime: "18:00", modality: "both" },
    { dayOfWeek: 3, startTime: "09:00", endTime: "18:00", modality: "both" },
    { dayOfWeek: 4, startTime: "09:00", endTime: "18:00", modality: "both" },
    { dayOfWeek: 5, startTime: "09:00", endTime: "18:00", modality: "both" },
  ]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/schedule/config");
      if (!res.ok) throw new Error("Error al cargar configuración");
      const data = await res.json() as {
        config: {
          working_days: number[];
          slot_duration: number;
          lunch_break_start: string | null;
          lunch_break_end: string | null;
          vacation_mode: boolean;
          vacation_from: string | null;
          vacation_until: string | null;
        } | null;
        workingHours: Array<{
          day_of_week: number;
          start_time: string;
          end_time: string;
          modality?: "presencial" | "virtual" | "both";
        }>;
      };

      if (data.config) {
        setConfig({
          workingDays: data.config.working_days,
          slotDuration: data.config.slot_duration,
          lunchBreakStart: data.config.lunch_break_start ?? "",
          lunchBreakEnd: data.config.lunch_break_end ?? "",
          vacationMode: data.config.vacation_mode,
          vacationFrom: data.config.vacation_from ?? "",
          vacationUntil: data.config.vacation_until ?? "",
        });
      }

      if (data.workingHours.length > 0) {
        setWorkingHours(
          data.workingHours.map((h) => ({
            dayOfWeek: h.day_of_week,
            startTime: h.start_time.slice(0, 5),
            endTime: h.end_time.slice(0, 5),
            modality: h.modality ?? "both",
          }))
        );
      }
    } catch (error) {
      console.error("Error al cargar configuración:", error);
      toast.error("No se pudo cargar la configuración");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch visibility status
  const fetchVisibility = useCallback(async () => {
    try {
      const res = await fetch("/api/professionals/me/visibility");
      if (res.ok) {
        const data = await res.json() as { is_visible: boolean };
        setIsVisible(data.is_visible);
      }
    } catch {
      // Silencioso
    }
  }, []);

  // Fetch Google Calendar status
  const fetchGcalStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google-calendar/status");
      if (res.ok) {
        const data = await res.json() as GCalStatus;
        setGcalStatus(data);
      }
    } catch {
      // Silencioso — no bloquear la página si falla
    }
  }, []);

  // Fetch obras sociales del profesional
  const fetchProfInsurances = useCallback(async () => {
    setInsurancesLoading(true);
    try {
      const res = await fetch("/api/professionals/me/insurances");
      if (res.ok) {
        const data = await res.json() as { insurances: ProfInsurance[] };
        setProfInsurances(data.insurances ?? []);
      }
    } catch {
      // Silencioso
    } finally {
      setInsurancesLoading(false);
    }
  }, []);

  const handleAddInsurance = async () => {
    const name = newInsuranceName.trim();
    if (!name) return;
    setAddingInsurance(true);
    try {
      const res = await fetch("/api/professionals/me/insurances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        toast.success(`"${name}" agregada correctamente`);
        setNewInsuranceName("");
        fetchProfInsurances();
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Error al agregar obra social");
      }
    } catch {
      toast.error("Error al agregar obra social");
    } finally {
      setAddingInsurance(false);
    }
  };

  const handleRemoveInsurance = async (insuranceId: string, name: string) => {
    try {
      const res = await fetch("/api/professionals/me/insurances", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insurance_id: insuranceId }),
      });
      if (res.ok) {
        toast.success(`"${name}" eliminada`);
        fetchProfInsurances();
      } else {
        toast.error("Error al eliminar obra social");
      }
    } catch {
      toast.error("Error al eliminar obra social");
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchGcalStatus();
    fetchVisibility();
    fetchProfInsurances();
  }, [fetchConfig, fetchGcalStatus, fetchVisibility, fetchProfInsurances]);

  // Mostrar toast después del redirect de Google OAuth
  useEffect(() => {
    const gcalResult = searchParams.get("gcal");
    if (gcalResult === "success") {
      toast.success("Google Calendar conectado correctamente");
    } else if (gcalResult === "cancelled") {
      toast.info("Conexión con Google Calendar cancelada");
    } else if (gcalResult === "error") {
      toast.error("Error al conectar Google Calendar");
    }
  }, [searchParams]);

  const toggleDay = (day: number) => {
    setConfig((prev) => {
      const days = prev.workingDays.includes(day)
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day].sort((a, b) => a - b);
      return { ...prev, workingDays: days };
    });
  };

  const addWorkingHour = () => {
    // Agregar horario para el primer día sin horario definido
    const usedDays = new Set(workingHours.map((h) => h.dayOfWeek));
    const availableDay = config.workingDays.find((d) => !usedDays.has(d));
    if (availableDay !== undefined) {
      setWorkingHours([...workingHours, { dayOfWeek: availableDay, startTime: "09:00", endTime: "18:00", modality: "both" }]);
    } else {
      toast.info("Todos los días laborales ya tienen horario configurado");
    }
  };

  const removeWorkingHour = (index: number) => {
    setWorkingHours(workingHours.filter((_, i) => i !== index));
  };

  const updateWorkingHour = (index: number, field: keyof WorkingHourRow, value: string | number) => {
    setWorkingHours(
      workingHours.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  };

  const handleGcalConnect = () => {
    // Redirigir al endpoint que inicia OAuth
    window.location.href = "/api/google-calendar/connect";
  };

  const handleGcalDisconnect = async () => {
    setGcalLoading(true);
    try {
      const res = await fetch("/api/google-calendar/disconnect", { method: "POST" });
      if (!res.ok) throw new Error("Error al desconectar");
      setGcalStatus({ connected: false, lastSyncedAt: null, connectedSince: null });
      toast.success("Google Calendar desconectado");
    } catch {
      toast.error("Error al desconectar Google Calendar");
    } finally {
      setGcalLoading(false);
    }
  };

  const handleVisibilityToggle = async (checked: boolean) => {
    setVisibilityLoading(true);
    try {
      const res = await fetch("/api/professionals/me/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: checked }),
      });
      if (!res.ok) throw new Error("Error al actualizar");
      setIsVisible(checked);
      toast.success(
        checked
          ? "Tu perfil ahora aparece en la cartilla pública"
          : "Tu perfil fue ocultado de la cartilla"
      );
    } catch {
      toast.error("Error al cambiar la visibilidad");
    } finally {
      setVisibilityLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Derivar working_days de las filas reales de workingHours para mantener sincronía
      const derivedWorkingDays = [...new Set(workingHours.map((h) => h.dayOfWeek))].sort((a, b) => a - b);

      // Guardar configuración general
      const configRes = await fetch("/api/schedule/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workingDays: derivedWorkingDays,
          slotDuration: config.slotDuration,
          lunchBreakStart: config.lunchBreakStart || null,
          lunchBreakEnd: config.lunchBreakEnd || null,
          vacationMode: config.vacationMode,
          vacationFrom: config.vacationFrom || null,
          vacationUntil: config.vacationUntil || null,
        }),
      });

      if (!configRes.ok) throw new Error("Error al guardar configuración");

      // Guardar horarios laborales
      const hoursRes = await fetch("/api/schedule/working-hours", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: workingHours }),
      });

      if (!hoursRes.ok) {
        const errData = await hoursRes.json() as { error: string };
        throw new Error(errData.error);
      }

      // Actualizar state local con los working_days derivados
      setConfig((prev) => ({ ...prev, workingDays: derivedWorkingDays }));

      // Invalidar cache global para que Agenda y Hoy refresquen la config
      invalidateScheduleConfigGlobal();
      toast.success("Configuración guardada correctamente");
    } catch (error) {
      console.error("Error al guardar:", error);
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración de agenda</h1>
        <p className="text-muted-foreground">
          Configurá tus horarios de trabajo, duración de turnos y descansos.
        </p>
      </div>

      {/* Foto de perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Foto de perfil</CardTitle>
          <CardDescription>
            Esta foto se muestra en tu perfil público y en el directorio de BookMe.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            currentUrl={user?.avatar_url ?? null}
            fallbackName={user?.full_name ?? ""}
            table="profiles"
            onAvatarChange={() => refreshSession()}
          />
        </CardContent>
      </Card>

      {/* Modo vacaciones */}
      <Card className={config.vacationMode ? "border-amber-300 dark:border-amber-700" : ""}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Palmtree className="h-5 w-5 text-amber-500" />
            <div className="flex-1">
              <CardTitle className="text-lg">Modo vacaciones</CardTitle>
              <CardDescription>
                Cuando está activo, no se pueden reservar nuevos turnos.
              </CardDescription>
            </div>
            <Switch
              checked={config.vacationMode}
              onCheckedChange={(checked) =>
                setConfig((prev) => ({ ...prev, vacationMode: checked }))
              }
            />
          </div>
        </CardHeader>
        {config.vacationMode && (
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="vacation-from" className="whitespace-nowrap text-sm">
                  Desde
                </Label>
                <Input
                  id="vacation-from"
                  type="date"
                  value={config.vacationFrom}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, vacationFrom: e.target.value }))
                  }
                  className="max-w-48"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="vacation-until" className="whitespace-nowrap text-sm">
                  Hasta
                </Label>
                <Input
                  id="vacation-until"
                  type="date"
                  value={config.vacationUntil}
                  onChange={(e) =>
                    setConfig((prev) => ({ ...prev, vacationUntil: e.target.value }))
                  }
                  className="max-w-48"
                />
              </div>
            </div>
            {config.vacationFrom && config.vacationUntil && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Las vacaciones están programadas del {new Date(config.vacationFrom + "T12:00:00").toLocaleDateString("es-AR")} al {new Date(config.vacationUntil + "T12:00:00").toLocaleDateString("es-AR")}
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Visibilidad en cartilla */}
      <Card className={isVisible ? "border-green-300 dark:border-green-700" : ""}>
        <CardHeader>
          <div className="flex items-center gap-3">
            {isVisible ? (
              <Globe className="h-5 w-5 text-green-500" />
            ) : (
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            )}
            <div className="flex-1">
              <CardTitle className="text-lg">Publicar en cartilla</CardTitle>
              <CardDescription>
                {isVisible
                  ? "Tu perfil aparece en el directorio público de BookMe. Los pacientes y clientes pueden encontrarte y reservar turnos."
                  : "Tu perfil está oculto en el directorio. Solo quienes tengan tu link directo podrán reservar."}
              </CardDescription>
            </div>
            <Switch
              checked={isVisible}
              onCheckedChange={handleVisibilityToggle}
              disabled={visibilityLoading}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Google Calendar Sync */}
      <Card className={gcalStatus.connected ? "border-green-300 dark:border-green-700" : ""}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <CardTitle className="text-lg">Google Calendar</CardTitle>
              <CardDescription>
                Sincronizá tu agenda de BookMe con Google Calendar en ambas direcciones.
              </CardDescription>
            </div>
            {gcalStatus.connected && (
              <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Conectado
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gcalStatus.connected ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Los turnos de BookMe aparecen en tu Google Calendar y los eventos de Google Calendar bloquean horarios en BookMe automáticamente.
              </p>
              {gcalStatus.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Última sincronización: {new Date(gcalStatus.lastSyncedAt).toLocaleString("es-AR")}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleGcalDisconnect}
                disabled={gcalLoading}
                className="text-destructive hover:text-destructive"
              >
                <Unlink className="mr-2 h-4 w-4" />
                {gcalLoading ? "Desconectando..." : "Desconectar Google Calendar"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Conectá tu Google Calendar para evitar doble agenda. Los turnos se sincronizan automáticamente en ambas direcciones.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGcalConnect}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Conectar Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuración general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuración general</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Días laborales */}
          <div className="space-y-2">
            <Label>Días laborales</Label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    config.workingDays.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duración de turno */}
          <div className="space-y-2">
            <Label htmlFor="slot-duration">Duración por defecto del turno</Label>
            <Select
              id="slot-duration"
              value={config.slotDuration.toString()}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, slotDuration: parseInt(e.target.value) }))
              }
              className="max-w-48"
            >
              {SLOT_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutos
                </option>
              ))}
            </Select>
          </div>

          {/* Descanso/almuerzo */}
          <div className="space-y-2">
            <Label>Horario de descanso (opcional)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="time"
                value={config.lunchBreakStart}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, lunchBreakStart: e.target.value }))
                }
                className="max-w-32"
                placeholder="Desde"
              />
              <span className="text-muted-foreground">a</span>
              <Input
                type="time"
                value={config.lunchBreakEnd}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, lunchBreakEnd: e.target.value }))
                }
                className="max-w-32"
                placeholder="Hasta"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Horarios laborales por día */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Horarios por día</CardTitle>
              <CardDescription>
                Definí el horario de atención para cada día laboral.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addWorkingHour}>
              <Plus className="mr-1 h-4 w-4" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workingHours.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No hay horarios configurados. Agregá al menos uno.
              </p>
            )}
            {workingHours.map((hour, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-md border bg-muted/30 p-3"
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={hour.dayOfWeek.toString()}
                  onChange={(e) =>
                    updateWorkingHour(index, "dayOfWeek", parseInt(e.target.value))
                  }
                  className="max-w-36"
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </Select>
                <Input
                  type="time"
                  value={hour.startTime}
                  onChange={(e) => updateWorkingHour(index, "startTime", e.target.value)}
                  className="max-w-28"
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="time"
                  value={hour.endTime}
                  onChange={(e) => updateWorkingHour(index, "endTime", e.target.value)}
                  className="max-w-28"
                />
                <Select
                  value={hour.modality}
                  onChange={(e) =>
                    updateWorkingHour(index, "modality", e.target.value)
                  }
                  className="max-w-36"
                  title="Modalidad permitida en esta franja"
                >
                  <option value="both">Ambas</option>
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                </Select>
                <Badge variant="secondary">
                  {(() => {
                    const [sh, sm] = hour.startTime.split(":").map(Number);
                    const [eh, em] = hour.endTime.split(":").map(Number);
                    const totalMin = ((eh ?? 0) * 60 + (em ?? 0)) - ((sh ?? 0) * 60 + (sm ?? 0));
                    return `${Math.floor(totalMin / 60)}h ${totalMin % 60 > 0 ? `${totalMin % 60}m` : ""}`;
                  })()}
                </Badge>
                <button
                  onClick={() => removeWorkingHour(index)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Obras Sociales / Prepagas */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Obras Sociales / Prepagas</CardTitle>
              <CardDescription>
                Seleccioná las obras sociales y prepagas con las que trabajás. Estas aparecerán en Servicios y Prestaciones.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Seleccionadas actualmente */}
          {profInsurances.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Seleccionadas ({profInsurances.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {profInsurances.map((ins) => (
                  <Badge
                    key={ins.id}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  >
                    {ins.name}
                    <button
                      onClick={() => handleRemoveInsurance(ins.id, ins.name)}
                      className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
                      title={`Quitar ${ins.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar obra social o prepaga..."
              value={insuranceSearch}
              onChange={(e) => setInsuranceSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Lista precargada con checkboxes */}
          {insurancesLoading ? (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando...
            </div>
          ) : (
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {(() => {
                const profNames = new Set(profInsurances.map((p) => p.name.toLowerCase()));
                const searchLower = insuranceSearch.toLowerCase();
                const filtered = INSURANCES_CATALOG.filter((name) =>
                  name.toLowerCase().includes(searchLower)
                );

                if (filtered.length === 0 && insuranceSearch.trim()) {
                  return (
                    <div className="p-4 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        No se encontró &quot;{insuranceSearch}&quot; en el listado
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setNewInsuranceName(insuranceSearch.trim());
                          handleAddInsurance();
                          setInsuranceSearch("");
                        }}
                        disabled={addingInsurance}
                      >
                        <Plus className="mr-1 h-4 w-4" />
                        Agregar &quot;{insuranceSearch.trim()}&quot; manualmente
                      </Button>
                    </div>
                  );
                }

                return filtered.map((name) => {
                  const isSelected = profNames.has(name.toLowerCase());
                  return (
                    <label
                      key={name}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b last:border-b-0 transition-colors ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/20"
                          : "hover:bg-accent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={async () => {
                          if (isSelected) {
                            const ins = profInsurances.find(
                              (p) => p.name.toLowerCase() === name.toLowerCase()
                            );
                            if (ins) await handleRemoveInsurance(ins.id, ins.name);
                          } else {
                            setNewInsuranceName(name);
                            // Llamar directamente con el nombre
                            setAddingInsurance(true);
                            try {
                              const res = await fetch("/api/professionals/me/insurances", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name }),
                              });
                              if (res.ok) {
                                toast.success(`"${name}" agregada`);
                                fetchProfInsurances();
                              } else {
                                const data = await res.json() as { error?: string };
                                toast.error(data.error ?? "Error al agregar");
                              }
                            } catch {
                              toast.error("Error al agregar obra social");
                            } finally {
                              setAddingInsurance(false);
                              setNewInsuranceName("");
                            }
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className={`text-sm ${isSelected ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}`}>
                        {name}
                      </span>
                      {isSelected && (
                        <Check className="ml-auto h-4 w-4 text-emerald-500" />
                      )}
                    </label>
                  );
                });
              })()}
            </div>
          )}

          {/* Agregar manualmente si no está en la lista */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              ¿No encontrás tu obra social? Agregala manualmente:
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nombre de la obra social..."
                value={newInsuranceName}
                onChange={(e) => setNewInsuranceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddInsurance();
                }}
                className="flex-1"
              />
              <Button
                onClick={handleAddInsurance}
                disabled={addingInsurance || !newInsuranceName.trim()}
                size="sm"
              >
                {addingInsurance ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Agregar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
