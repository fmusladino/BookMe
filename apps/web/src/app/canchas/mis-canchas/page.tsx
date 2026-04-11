"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Edit2, Trash2, Clock, DollarSign, Users, Dribbble, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const DAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const SPORTS = [
  "Fútbol 5", "Fútbol 7", "Fútbol 11", "Pádel", "Tenis",
  "Básquet", "Vóley", "Rugby", "Hockey", "Multideporte", "Otro",
];

const SURFACES = ["Césped natural", "Césped sintético", "Cemento", "Hormigón", "Madera", "Polvo de ladrillo", "Indoor", "Otro"];

const SLOT_DURATIONS = [
  { value: 60, label: "60 min (1 hora)" },
  { value: 90, label: "90 min (1:30 hs)" },
  { value: 120, label: "120 min (2 horas)" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 150, label: "150 min (2:30 hs)" },
  { value: 180, label: "180 min (3 horas)" },
];

interface Schedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface Court {
  id: string;
  name: string;
  description?: string;
  sport: string;
  surface?: string;
  players?: number;
  price_per_hour: number;
  slot_duration: number;
  seña_required: boolean;
  seña_amount?: number;
  seña_alias?: string;
  seña_cbu?: string;
  is_active: boolean;
  court_schedules: Schedule[];
}

interface CourtFormData {
  name: string;
  description: string;
  sport: string;
  surface: string;
  players: string;
  price_per_hour: string;
  slot_duration: string;
  seña_required: boolean;
  seña_amount: string;
  seña_alias: string;
  seña_cbu: string;
  is_active: boolean;
  schedules: Schedule[];
}

const emptyForm: CourtFormData = {
  name: "",
  description: "",
  sport: "Fútbol 5",
  surface: "",
  players: "",
  price_per_hour: "",
  slot_duration: "60",
  seña_required: false,
  seña_amount: "",
  seña_alias: "",
  seña_cbu: "",
  is_active: true,
  schedules: [
    { day_of_week: 1, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 2, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 3, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 4, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 5, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 6, start_time: "08:00", end_time: "23:00" },
    { day_of_week: 0, start_time: "08:00", end_time: "23:00" },
  ],
};

export default function MisCanchasPage() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourtFormData>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchCourts = useCallback(async () => {
    try {
      const res = await fetch("/api/courts");
      if (!res.ok) throw new Error();
      const data = await res.json() as { courts: Court[] };
      setCourts(data.courts);
    } catch {
      toast.error("No se pudieron cargar las canchas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCourts(); }, [fetchCourts]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (court: Court) => {
    setEditingId(court.id);
    setForm({
      name: court.name,
      description: court.description ?? "",
      sport: court.sport,
      surface: court.surface ?? "",
      players: court.players?.toString() ?? "",
      price_per_hour: court.price_per_hour.toString(),
      slot_duration: (court.slot_duration ?? 60).toString(),
      seña_required: court.seña_required,
      seña_amount: court.seña_amount?.toString() ?? "",
      seña_alias: court.seña_alias ?? "",
      seña_cbu: court.seña_cbu ?? "",
      is_active: court.is_active,
      schedules: court.court_schedules.length > 0
        ? court.court_schedules
        : emptyForm.schedules,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        sport: form.sport,
        surface: form.surface || undefined,
        players: form.players ? parseInt(form.players) : undefined,
        price_per_hour: parseFloat(form.price_per_hour) || 0,
        slot_duration: parseInt(form.slot_duration) || 60,
        seña_required: form.seña_required,
        seña_amount: form.seña_required && form.seña_amount ? parseFloat(form.seña_amount) : undefined,
        seña_alias: form.seña_alias || undefined,
        seña_cbu: form.seña_cbu || undefined,
        is_active: form.is_active,
        schedules: form.schedules,
      };

      const url = editingId ? `/api/courts/${editingId}` : "/api/courts";
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json() as { error: string };
        throw new Error(err.error);
      }

      toast.success(editingId ? "Cancha actualizada" : "Cancha creada exitosamente");
      setDialogOpen(false);
      fetchCourts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/courts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Cancha eliminada");
      fetchCourts();
    } catch {
      toast.error("Error al eliminar la cancha");
    } finally {
      setDeleteId(null);
    }
  };

  const addSchedule = () => {
    setForm((f) => ({
      ...f,
      schedules: [...f.schedules, { day_of_week: 1, start_time: "08:00", end_time: "23:00" }],
    }));
  };

  const updateSchedule = (index: number, field: keyof Schedule, value: string | number) => {
    setForm((f) => ({
      ...f,
      schedules: f.schedules.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const removeSchedule = (index: number) => {
    setForm((f) => ({ ...f, schedules: f.schedules.filter((_, i) => i !== index) }));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mis Canchas</h1>
          <p className="text-muted-foreground text-sm">
            Administrá tus canchas, horarios y precios.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva cancha
        </Button>
      </div>

      {courts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Dribbble className="h-8 w-8 text-orange-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">No tenés canchas configuradas</p>
              <p className="text-sm text-muted-foreground">Agregá tu primera cancha para empezar a recibir reservas.</p>
            </div>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar cancha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {courts.map((court) => (
            <Card key={court.id} className={court.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{court.name}</CardTitle>
                    <CardDescription>{court.sport}</CardDescription>
                  </div>
                  <Badge variant={court.is_active ? "default" : "secondary"}>
                    {court.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {court.description && (
                  <p className="text-sm text-muted-foreground">{court.description}</p>
                )}
                <div className="flex flex-wrap gap-2 text-sm">
                  {court.surface && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                      {court.surface}
                    </span>
                  )}
                  {court.players && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      {court.players} jugadores
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <DollarSign className="h-3.5 w-3.5" />
                    ${court.price_per_hour}/turno
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {court.slot_duration ?? 60} min
                  </span>
                  {court.seña_required && (
                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs font-medium">
                      Seña ${court.seña_amount}
                    </span>
                  )}
                </div>

                {/* Horarios resumidos */}
                {court.court_schedules.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {DAYS.filter((d) => court.court_schedules.some((s) => s.day_of_week === d.value)).map((d) => (
                      <span
                        key={d.value}
                        className="rounded px-1.5 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium"
                      >
                        {d.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(court)} className="flex-1">
                    <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(court.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de confirmación para eliminar */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg border border-border p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">¿Eliminar cancha?</h3>
            <p className="text-sm text-muted-foreground">
              Esta acción no se puede deshacer. Se eliminarán también todos los horarios de esta cancha.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
              <Button variant="destructive" onClick={() => handleDelete(deleteId)}>Eliminar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog de creación/edición */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar cancha" : "Nueva cancha"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Nombre */}
            <div className="space-y-1.5">
              <Label htmlFor="court-name">Nombre de la cancha *</Label>
              <Input
                id="court-name"
                placeholder="Ej: Cancha 1 - Pádel"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <Label htmlFor="court-desc">Descripción (opcional)</Label>
              <Input
                id="court-desc"
                placeholder="Ej: Cancha techada con iluminación LED"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            {/* Deporte + Superficie + Jugadores */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Deporte *</Label>
                <select
                  value={form.sport}
                  onChange={(e) => setForm((f) => ({ ...f, sport: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {SPORTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Superficie</Label>
                <select
                  value={form.surface}
                  onChange={(e) => setForm((f) => ({ ...f, surface: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">—</option>
                  {SURFACES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="players">Jugadores</Label>
                <Input
                  id="players"
                  type="number"
                  placeholder="10"
                  value={form.players}
                  onChange={(e) => setForm((f) => ({ ...f, players: e.target.value }))}
                />
              </div>
            </div>

            {/* Precio por turno */}
            <div className="space-y-1.5">
              <Label htmlFor="price">Precio por turno ($)</Label>
              <Input
                id="price"
                type="number"
                placeholder="5000"
                value={form.price_per_hour}
                onChange={(e) => setForm((f) => ({ ...f, price_per_hour: e.target.value }))}
              />
            </div>

            {/* Duración del turno */}
            <div className="space-y-1.5">
              <Label htmlFor="slot-duration">Duración del turno *</Label>
              <p className="text-xs text-muted-foreground">Cuánto dura cada turno de reserva para esta cancha.</p>
              <select
                id="slot-duration"
                value={form.slot_duration}
                onChange={(e) => setForm((f) => ({ ...f, slot_duration: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SLOT_DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Seña */}
            <div className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Requerir seña para confirmar</Label>
                  <p className="text-xs text-muted-foreground">El cliente debe enviar una seña para reservar.</p>
                </div>
                <Switch
                  checked={form.seña_required}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, seña_required: v }))}
                />
              </div>

              {form.seña_required && (
                <div className="space-y-3 pt-1">
                  <div className="space-y-1.5">
                    <Label>Monto de la seña ($)</Label>
                    <Input
                      type="number"
                      placeholder="2000"
                      value={form.seña_amount}
                      onChange={(e) => setForm((f) => ({ ...f, seña_amount: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Alias CBU/CVU</Label>
                      <Input
                        placeholder="mi.alias.mp"
                        value={form.seña_alias}
                        onChange={(e) => setForm((f) => ({ ...f, seña_alias: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CBU (opcional)</Label>
                      <Input
                        placeholder="0000000000000000000000"
                        value={form.seña_cbu}
                        onChange={(e) => setForm((f) => ({ ...f, seña_cbu: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Activa */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Cancha activa</Label>
                <p className="text-xs text-muted-foreground">Las canchas inactivas no aparecen en la página pública.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>

            {/* Horarios */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Horarios disponibles</Label>
                  <p className="text-xs text-muted-foreground">Definí los días y horarios en que esta cancha está disponible.</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar
                </Button>
              </div>

              {form.schedules.map((s, index) => (
                <div key={index} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={s.day_of_week}
                    onChange={(e) => updateSchedule(index, "day_of_week", parseInt(e.target.value))}
                    className="rounded-md border border-input bg-background px-2 py-1.5 text-sm max-w-24"
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <Input
                    type="time"
                    value={s.start_time}
                    onChange={(e) => updateSchedule(index, "start_time", e.target.value)}
                    className="max-w-28"
                  />
                  <span className="text-muted-foreground text-sm">a</span>
                  <Input
                    type="time"
                    value={s.end_time}
                    onChange={(e) => updateSchedule(index, "end_time", e.target.value)}
                    className="max-w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeSchedule(index)}
                    className="rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Botones */}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear cancha"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
