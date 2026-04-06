"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Stethoscope,
  Eye,
  EyeOff,
  Users,
  Loader2,
  Plus,
  X,
  MapPin,
  Edit,
  Trash2,
  Save,
  AlertTriangle,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Branch {
  id: string;
  name: string | null;
  address: string;
  city: string;
}

interface Professional {
  id: string;
  specialty: string;
  specialty_slug: string;
  city: string;
  province: string;
  is_visible: boolean;
  subscription_plan: string;
  subscription_status: string;
  created_at: string;
  branch_id: string | null;
  branch: Branch | null;
  profile: {
    full_name: string;
    avatar_url: string | null;
    phone: string | null;
  } | null;
}

interface Clinic {
  id: string;
  name: string;
}

interface ClinicSubscriptionInfo {
  plan: "small" | "large";
  status: string;
  max_professionals: number | null;
  current_count: number;
  remaining: number | null;
  limit_reached: boolean;
}

const EMPTY_CREATE_FORM = {
  email: "",
  password: "",
  full_name: "",
  dni: "",
  phone: "",
  line: "healthcare" as string,
  specialty: "",
  city: "",
  province: "",
  bio: "",
  branch_id: "",
};

const EMPTY_EDIT_FORM = {
  full_name: "",
  phone: "",
  specialty: "",
  city: "",
  province: "",
  bio: "",
  branch_id: "",
  is_visible: true,
};

export default function ClinicaProfesionalesPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState<ClinicSubscriptionInfo | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");

  // Modales
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);

  const fetchData = useCallback(async () => {
    try {
      const [profRes, branchRes] = await Promise.all([
        fetch("/api/clinic/professionals"),
        fetch("/api/clinic/branches"),
      ]);

      if (profRes.ok) {
        const data = await profRes.json();
        setProfessionals(data.professionals ?? []);
        setClinic(data.clinic ?? null);
        setSubscriptionInfo(data.subscription ?? null);
      }

      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranches(data.branches ?? []);
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filtered = professionals.filter((p) => {
    const name = p.profile?.full_name?.toLowerCase() ?? "";
    const specialty = p.specialty.toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || specialty.includes(q);
    const matchesBranch =
      selectedBranchId === "all" ||
      (selectedBranchId === "none" ? !p.branch_id : p.branch_id === selectedBranchId);
    return matchesSearch && matchesBranch;
  });

  // ─── CREAR ────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = createForm;
    if (!f.email || !f.password || !f.full_name || !f.dni || !f.phone || !f.specialty || !f.city || !f.province) {
      toast.error("Completá todos los campos obligatorios");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clinic/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear profesional");
      }
      toast.success("Profesional creado exitosamente");
      setShowCreateModal(false);
      setCreateForm(EMPTY_CREATE_FORM);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  // ─── EDITAR ───────────────────────────────────────────────
  const openEdit = (prof: Professional) => {
    setEditingProf(prof);
    setEditForm({
      full_name: prof.profile?.full_name ?? "",
      phone: prof.profile?.phone ?? "",
      specialty: prof.specialty,
      city: prof.city,
      province: prof.province,
      bio: "",
      branch_id: prof.branch_id ?? "",
      is_visible: prof.is_visible,
    });
    setShowEditModal(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProf) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/clinic/professionals/${editingProf.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al actualizar");
      }
      toast.success("Profesional actualizado");
      setShowEditModal(false);
      setEditingProf(null);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    } finally {
      setSaving(false);
    }
  };

  // ─── ELIMINAR ─────────────────────────────────────────────
  const handleDelete = async (prof: Professional) => {
    const name = prof.profile?.full_name ?? "este profesional";
    if (!confirm(`¿Eliminar a "${name}"? Esta acción no se puede deshacer y eliminará su cuenta, perfil y configuración de agenda.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clinic/professionals/${prof.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar");
      }
      toast.success("Profesional eliminado");
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    }
  };

  const planLabel: Record<string, string> = {
    free: "Free",
    base: "Base",
    standard: "Standard",
    premium: "Premium",
  };

  const statusLabel: Record<string, { text: string; color: string }> = {
    active: { text: "Activo", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    trialing: { text: "Trial", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    past_due: { text: "Impago", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    cancelled: { text: "Cancelado", color: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300" },
    read_only: { text: "Solo lectura", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Profesionales
          </h1>
          <p className="text-sm text-muted-foreground">
            {clinic
              ? `Profesionales del consultorio ${clinic.name}`
              : "Gestión de profesionales del consultorio"}
          </p>
        </div>
        <button
          onClick={() => {
            if (subscriptionInfo?.limit_reached) {
              toast.error(`Alcanzaste el límite de ${subscriptionInfo.max_professionals} profesionales. Actualizá tu plan para agregar más.`);
              return;
            }
            setCreateForm(EMPTY_CREATE_FORM);
            setShowCreateModal(true);
          }}
          disabled={subscriptionInfo?.limit_reached}
          className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-opacity ${
            subscriptionInfo?.limit_reached
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <Plus className="h-4 w-4" />
          Nuevo profesional
        </button>
      </div>

      {/* Banner de capacidad del plan */}
      {subscriptionInfo && subscriptionInfo.max_professionals !== null && (
        <div
          className={`rounded-lg border p-4 ${
            subscriptionInfo.limit_reached
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              : subscriptionInfo.remaining !== null && subscriptionInfo.remaining <= 3
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                : "border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {subscriptionInfo.limit_reached ? (
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
              ) : (
                <Users className="h-5 w-5 text-purple-500 shrink-0" />
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {subscriptionInfo.current_count} de {subscriptionInfo.max_professionals} profesionales
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Plan {subscriptionInfo.plan === "small" ? "Pequeño" : "Grande"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subscriptionInfo.limit_reached
                    ? "Alcanzaste el límite de tu plan. Actualizá para agregar más profesionales."
                    : subscriptionInfo.remaining !== null && subscriptionInfo.remaining <= 3
                      ? `Te quedan ${subscriptionInfo.remaining} lugar${subscriptionInfo.remaining === 1 ? "" : "es"} disponible${subscriptionInfo.remaining === 1 ? "" : "s"}.`
                      : `${subscriptionInfo.remaining} lugares disponibles.`}
                </p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="flex items-center gap-3">
              <div className="w-32 hidden sm:block">
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      subscriptionInfo.limit_reached
                        ? "bg-red-500"
                        : subscriptionInfo.remaining !== null && subscriptionInfo.remaining <= 3
                          ? "bg-amber-500"
                          : "bg-purple-500"
                    }`}
                    style={{
                      width: `${Math.min(100, (subscriptionInfo.current_count / subscriptionInfo.max_professionals) * 100)}%`,
                    }}
                  />
                </div>
              </div>
              {subscriptionInfo.limit_reached && (
                <button className="flex items-center gap-1.5 rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700 transition-colors shrink-0">
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Upgrade
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Barra de búsqueda + filtro por sede */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre o especialidad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {branches.length > 1 && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[180px]"
            >
              <option value="all">Todas las sedes</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || b.address}
                </option>
              ))}
              <option value="none">Sin sede asignada</option>
            </select>
          </div>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            {search
              ? "No se encontraron profesionales con esa búsqueda"
              : "No hay profesionales registrados en este consultorio"}
          </p>
          {!search && (
            <button
              onClick={() => {
                setCreateForm(EMPTY_CREATE_FORM);
                setShowCreateModal(true);
              }}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Crear primer profesional
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((prof) => {
            const name = prof.profile?.full_name ?? "Sin nombre";
            const phone = prof.profile?.phone ?? "";
            const avatar = prof.profile?.avatar_url;
            const status = statusLabel[prof.subscription_status] ?? {
              text: prof.subscription_status,
              color: "bg-gray-100 text-gray-700",
            };

            return (
              <div
                key={prof.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm overflow-hidden">
                    {avatar ? (
                      <img src={avatar} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{name}</p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {prof.specialty}
                      </span>
                      {prof.branch ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {prof.branch.name || prof.branch.address}
                        </span>
                      ) : (
                        <span>{prof.city}, {prof.province}</span>
                      )}
                      {phone && <span>{phone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-1 text-sm text-muted-foreground"
                    title={prof.is_visible ? "Visible en directorio" : "Oculto del directorio"}
                  >
                    {prof.is_visible ? (
                      <Eye className="h-4 w-4 text-green-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.text}
                  </span>
                  <button
                    onClick={() => openEdit(prof)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Editar profesional"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prof)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar profesional"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resumen */}
      {!loading && professionals.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-indigo-50 p-2 dark:bg-indigo-950">
                <Stethoscope className="h-5 w-5 text-indigo-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{professionals.length}</p>
                <p className="text-xs text-muted-foreground">Total profesionales</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-50 p-2 dark:bg-green-950">
                <Eye className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{professionals.filter((p) => p.is_visible).length}</p>
                <p className="text-xs text-muted-foreground">Visibles en directorio</p>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{professionals.filter((p) => p.subscription_status === "active").length}</p>
                <p className="text-xs text-muted-foreground">Con suscripción activa</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal CREAR profesional ─── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateModal(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">Nuevo profesional</h2>
              <button onClick={() => setShowCreateModal(false)} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datos de cuenta</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email *</label>
                  <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="profesional@email.com" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Contraseña *</label>
                  <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} required minLength={6} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Mínimo 6 caracteres" />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datos personales</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre completo *</label>
                <input type="text" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Nombre y apellido" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">DNI *</label>
                  <input type="text" value={createForm.dni} onChange={(e) => setCreateForm({ ...createForm, dni: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="12345678" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Teléfono *</label>
                  <input type="tel" value={createForm.phone} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="+5491155551234" />
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datos profesionales</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Especialidad *</label>
                <input type="text" value={createForm.specialty} onChange={(e) => setCreateForm({ ...createForm, specialty: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ej: Dermatología, Peluquería, Nutrición..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ciudad *</label>
                  <input type="text" value={createForm.city} onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="CABA" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provincia *</label>
                  <input type="text" value={createForm.province} onChange={(e) => setCreateForm({ ...createForm, province: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Buenos Aires" />
                </div>
              </div>

              {branches.length > 0 && (
                <div className="border-t pt-4 space-y-1.5">
                  <label className="text-sm font-medium">Sede</label>
                  <select value={createForm.branch_id} onChange={(e) => setCreateForm({ ...createForm, branch_id: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sin sede asignada</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name || b.address} — {b.city}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} disabled={saving} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  Crear profesional
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal EDITAR profesional ─── */}
      {showEditModal && editingProf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowEditModal(false); setEditingProf(null); }} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">Editar profesional</h2>
              <button onClick={() => { setShowEditModal(false); setEditingProf(null); }} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datos personales</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre completo *</label>
                <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono</label>
                <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>

              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datos profesionales</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Especialidad *</label>
                <input type="text" value={editForm.specialty} onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })} required className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ciudad</label>
                  <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provincia</label>
                  <input type="text" value={editForm.province} onChange={(e) => setEditForm({ ...editForm, province: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              {branches.length > 0 && (
                <div className="border-t pt-4 space-y-1.5">
                  <label className="text-sm font-medium">Sede</label>
                  <select value={editForm.branch_id} onChange={(e) => setEditForm({ ...editForm, branch_id: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="">Sin sede asignada</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name || b.address} — {b.city}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="border-t pt-4 space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.is_visible}
                    onChange={(e) => setEditForm({ ...editForm, is_visible: e.target.checked })}
                    className="accent-primary"
                  />
                  Visible en el directorio público
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingProf(null); }} disabled={saving} className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
