"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Save, Loader2, MapPin, Plus, X, Edit, Trash2, Users, Star,
  ShieldCheck, Crown, Mail, Phone, UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface ClinicData {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  phone: string | null;
  email: string | null;
}

interface BranchData {
  id: string;
  clinic_id: string;
  name: string | null;
  address: string;
  city: string;
  province: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  professionals_count: number;
  clinic_name: string;
  created_at: string;
}

interface AdminData {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  email: string | null;
  is_owner: boolean;
}

const EMPTY_BRANCH = {
  name: "",
  address: "",
  city: "",
  province: "",
  phone: "",
  email: "",
};

const EMPTY_ADMIN = {
  full_name: "",
  email: "",
  phone: "",
};

export default function ClinicaConfiguracionPage() {
  const [clinics, setClinics] = useState<ClinicData[]>([]);
  const [branches, setBranches] = useState<BranchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchData | null>(null);
  const [form, setForm] = useState(EMPTY_BRANCH);

  // Admins
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // El consultorio principal (solo 1 por admin)
  const clinic = clinics[0] ?? null;

  const fetchData = useCallback(async () => {
    try {
      const [clinicRes, branchRes, adminsRes] = await Promise.all([
        fetch("/api/clinic"),
        fetch("/api/clinic/branches"),
        fetch("/api/clinic/admins"),
      ]);

      if (clinicRes.ok) {
        const data = await clinicRes.json();
        setClinics(data.clinics ?? []);
      }

      if (branchRes.ok) {
        const data = await branchRes.json();
        setBranches(data.branches ?? []);
      }

      if (adminsRes.ok) {
        const data = await adminsRes.json();
        setAdmins(data.admins ?? []);
        setIsOwner(data.is_owner ?? false);
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

  // Sedes del consultorio actual, ordenadas por fecha de creación
  const clinicBranches = clinic
    ? branches
        .filter((b) => b.clinic_id === clinic.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    : [];

  // La primera sede es la sede central
  const sedeCentral = clinicBranches[0] ?? null;
  const sedesAdicionales = clinicBranches.slice(1);

  const openCreateBranch = () => {
    setForm(EMPTY_BRANCH);
    setEditingBranch(null);
    setShowModal(true);
  };

  const openEditBranch = (branch: BranchData) => {
    setForm({
      name: branch.name ?? "",
      address: branch.address,
      city: branch.city,
      province: branch.province,
      phone: branch.phone ?? "",
      email: branch.email ?? "",
    });
    setEditingBranch(branch);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address.trim() || !form.city.trim() || !form.province.trim()) {
      toast.error("Dirección, ciudad y provincia son obligatorios");
      return;
    }

    setSaving(true);
    try {
      if (editingBranch) {
        const res = await fetch(`/api/clinic/branches/${editingBranch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al guardar");
        }
        toast.success("Sede actualizada");
      } else {
        const res = await fetch("/api/clinic/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            clinic_id: clinic?.id,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al crear");
        }
        toast.success("Sede creada exitosamente");
      }

      setShowModal(false);
      setEditingBranch(null);
      setForm(EMPTY_BRANCH);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  // ─── Admin management ─────────────────────────────────────
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminForm.email.trim() || !adminForm.full_name.trim()) {
      toast.error("Nombre y email son obligatorios");
      return;
    }

    setSavingAdmin(true);
    try {
      const res = await fetch("/api/clinic/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al agregar admin");
      }
      toast.success("Administrador agregado");
      setShowAdminModal(false);
      setAdminForm(EMPTY_ADMIN);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (adminUser: AdminData) => {
    if (adminUser.is_owner) {
      toast.error("No se puede eliminar al dueño de la clínica");
      return;
    }
    if (!confirm(`¿Quitar a "${adminUser.full_name}" como administrador?`)) return;

    try {
      const res = await fetch(`/api/clinic/admins/${adminUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar");
      }
      toast.success("Administrador eliminado");
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleDeleteBranch = async (branch: BranchData) => {
    if (!confirm(`¿Eliminar la sede "${branch.name || branch.address}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/clinic/branches/${branch.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar");
      }
      toast.success("Sede eliminada");
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si no hay clínicas, mostrar creación
  if (!clinic) {
    return <NoClinicView onCreated={fetchData} />;
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              {clinic.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {clinicBranches.length} sede{clinicBranches.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={openCreateBranch}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Nueva sede
        </button>
      </div>

      {/* ── SEDE CENTRAL ── */}
      {sedeCentral ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Sede Central
            </h2>
          </div>
          <div className="rounded-xl border-2 border-primary/30 bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold text-foreground">
                    {sedeCentral.name || "Sede Central"}
                  </h3>
                  {!sedeCentral.is_active && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      Inactiva
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">Dirección:</span>{" "}
                    {sedeCentral.address}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">Ubicación:</span>{" "}
                    {sedeCentral.city}, {sedeCentral.province}
                  </div>
                  {sedeCentral.phone && (
                    <div>
                      <span className="font-medium text-foreground">Tel:</span>{" "}
                      {sedeCentral.phone}
                    </div>
                  )}
                  {sedeCentral.email && (
                    <div>
                      <span className="font-medium text-foreground">Email:</span>{" "}
                      {sedeCentral.email}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {sedeCentral.professionals_count} profesional{sedeCentral.professionals_count !== 1 ? "es" : ""}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => openEditBranch(sedeCentral)}
                className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Editar sede central"
              >
                <Edit className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            No hay sedes registradas. Creá la sede central del consultorio.
          </p>
          <button
            onClick={openCreateBranch}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Crear sede central
          </button>
        </div>
      )}

      {/* ── SEDES ADICIONALES ── */}
      {sedesAdicionales.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Otras sedes ({sedesAdicionales.length})
          </h2>
          <div className="grid gap-3">
            {sedesAdicionales.map((branch) => (
              <div
                key={branch.id}
                className="rounded-lg border border-border bg-card p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">
                        {branch.name || branch.address}
                      </h3>
                      {!branch.is_active && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          Inactiva
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 text-sm text-muted-foreground">
                      <div>
                        <span className="font-medium text-foreground">Dirección:</span>{" "}
                        {branch.address}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Ubicación:</span>{" "}
                        {branch.city}, {branch.province}
                      </div>
                      {branch.phone && (
                        <div>
                          <span className="font-medium text-foreground">Tel:</span>{" "}
                          {branch.phone}
                        </div>
                      )}
                      {branch.email && (
                        <div>
                          <span className="font-medium text-foreground">Email:</span>{" "}
                          {branch.email}
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {branch.professionals_count} profesional{branch.professionals_count !== 1 ? "es" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditBranch(branch)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Editar sede"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(branch)}
                      className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                      title="Eliminar sede"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ADMINISTRADORES ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Administradores ({admins.length})
            </h2>
          </div>
          {isOwner && (
            <button
              onClick={() => {
                setAdminForm(EMPTY_ADMIN);
                setShowAdminModal(true);
              }}
              className="flex items-center gap-2 rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Agregar admin
            </button>
          )}
        </div>

        <div className="grid gap-3">
          {admins.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border bg-card p-4 shadow-sm ${
                a.is_owner ? "border-amber-300/50 dark:border-amber-700/50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${
                    a.is_owner
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {a.full_name
                      .split(" ")
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{a.full_name}</span>
                      {a.is_owner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          <Crown className="h-3 w-3" />
                          Dueño
                        </span>
                      )}
                      {!a.is_owner && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                      {a.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {a.email}
                        </span>
                      )}
                      {a.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {a.phone}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botón eliminar: solo si es owner y el admin no es owner */}
                {isOwner && !a.is_owner && (
                  <button
                    onClick={() => handleRemoveAdmin(a)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                    title="Quitar administrador"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {admins.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                No hay administradores configurados
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal agregar admin */}
      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAdminModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">Agregar administrador</h2>
              <button
                onClick={() => setShowAdminModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAdmin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre completo *</label>
                <input
                  type="text"
                  value={adminForm.full_name}
                  onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Ej: Sandra López"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email *</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="admin@consultorio.com"
                />
                <p className="text-xs text-muted-foreground">
                  Si el email no está registrado, se creará una cuenta automáticamente.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Teléfono</label>
                <input
                  type="tel"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="+5491148001234"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminModal(false)}
                  disabled={savingAdmin}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAdmin}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal crear/editar sede */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowModal(false); setEditingBranch(null); }} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">
                {editingBranch ? "Editar sede" : (sedeCentral ? "Nueva sede" : "Crear sede central")}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingBranch(null); }}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre de la sede</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={sedeCentral ? "Ej: Sede Belgrano, Sede Centro" : "Ej: Sede Central (opcional)"}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Dirección *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Av. Corrientes 1234, Piso 3"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Ciudad *</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="CABA"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Provincia *</label>
                  <input
                    type="text"
                    value={form.province}
                    onChange={(e) => setForm({ ...form, province: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Buenos Aires"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="+541148001234"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="sede@consultorio.com"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingBranch(null); }}
                  disabled={saving}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {editingBranch ? "Guardar cambios" : "Crear sede"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente: vista cuando no hay clínica ──────────────────────

function NoClinicView({ onCreated }: { onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "" });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/clinic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al crear");
      }
      toast.success("Consultorio creado. Ahora podés agregar la sede central.");
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Crear consultorio
        </h1>
        <p className="text-sm text-muted-foreground">
          Creá tu consultorio para empezar a agregar sedes y profesionales
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-blue-600 mt-0.5" />
          <p className="text-sm text-blue-700 dark:text-blue-300">
            El consultorio es la entidad principal. Después de crearlo, vas a poder agregar la sede central y luego sedes adicionales con distintas direcciones.
          </p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="rounded-lg border border-border bg-card p-6 space-y-4 max-w-md">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nombre del consultorio *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Ej: Centro Médico Salud Total"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
          Crear consultorio
        </button>
      </form>
    </div>
  );
}
