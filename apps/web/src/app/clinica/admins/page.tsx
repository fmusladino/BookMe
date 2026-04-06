"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, Crown, Mail, Phone, UserPlus, Loader2, X, Trash2,
  Users, Clock, ChevronDown, ChevronUp, History, Edit, Power,
  PowerOff, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface AdminData {
  id: string;
  full_name: string;
  phone: string | null;
  role: string;
  email: string | null;
  is_owner: boolean;
  staff_role: string;
  staff_label: string | null;
  is_active: boolean;
  added_at: string | null;
}

interface AuditEntry {
  id: string;
  target_id: string;
  target_name: string;
  performed_by: string;
  performer_name: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

// ─── Constants ──────────────────────────────────────────────

const STAFF_ROLES: Record<string, { label: string; color: string; darkColor: string }> = {
  secretaria: { label: "Secretaria", color: "bg-violet-100 text-violet-700", darkColor: "dark:bg-violet-900/30 dark:text-violet-300" },
  recepcionista: { label: "Recepcionista", color: "bg-cyan-100 text-cyan-700", darkColor: "dark:bg-cyan-900/30 dark:text-cyan-300" },
  gerente: { label: "Gerente", color: "bg-emerald-100 text-emerald-700", darkColor: "dark:bg-emerald-900/30 dark:text-emerald-300" },
  contador: { label: "Contador/a", color: "bg-orange-100 text-orange-700", darkColor: "dark:bg-orange-900/30 dark:text-orange-300" },
  otro: { label: "Otro", color: "bg-gray-100 text-gray-700", darkColor: "dark:bg-gray-800 dark:text-gray-300" },
};

const AUDIT_ACTION_LABELS: Record<string, { label: string; color: string }> = {
  added: { label: "Agregado", color: "text-green-600" },
  removed: { label: "Eliminado", color: "text-red-600" },
  role_changed: { label: "Rol cambiado", color: "text-blue-600" },
  deactivated: { label: "Desactivado", color: "text-amber-600" },
  reactivated: { label: "Reactivado", color: "text-emerald-600" },
};

const EMPTY_ADMIN = {
  full_name: "",
  email: "",
  phone: "",
  staff_role: "secretaria",
  label: "",
};

// ─── Page Component ─────────────────────────────────────────

export default function ClinicaAdminsPage() {
  const [admins, setAdmins] = useState<AdminData[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal de agregar admin
  const [showAddModal, setShowAddModal] = useState(false);
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN);
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Modal de editar rol
  const [editingAdmin, setEditingAdmin] = useState<AdminData | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Mostrar/ocultar auditoría
  const [showAudit, setShowAudit] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/clinic/admins?audit=true");
      if (res.ok) {
        const data = await res.json();
        setAdmins(data.admins ?? []);
        setIsOwner(data.is_owner ?? false);
        setAuditLog(data.audit_log ?? []);
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

  // ─── Handlers ───────────────────────────────────────────────

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
      const data = await res.json();
      if (data.is_new_account) {
        toast.success("Administrador agregado. Se creó una cuenta nueva — el usuario deberá restablecer su contraseña al ingresar.", { duration: 6000 });
      } else {
        toast.success("Administrador agregado exitosamente");
      }
      setShowAddModal(false);
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
    if (!confirm(`¿Quitar a "${adminUser.full_name}" como administrador? Esta acción no se puede deshacer.`)) return;

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

  const handleToggleActive = async (adminUser: AdminData) => {
    const newState = !adminUser.is_active;
    const action = newState ? "reactivar" : "desactivar";
    if (!confirm(`¿${newState ? "Reactivar" : "Desactivar"} a "${adminUser.full_name}"?`)) return;

    try {
      const res = await fetch(`/api/clinic/admins/${adminUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newState }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Error al ${action}`);
      }
      toast.success(`Administrador ${newState ? "reactivado" : "desactivado"}`);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/clinic/admins/${editingAdmin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staff_role: editRole,
          label: editRole === "otro" ? editLabel : null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al actualizar rol");
      }
      toast.success("Rol actualizado");
      setEditingAdmin(null);
      void fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditRole = (admin: AdminData) => {
    setEditingAdmin(admin);
    setEditRole(admin.staff_role);
    setEditLabel(admin.staff_label ?? "");
  };

  // ─── Stats ──────────────────────────────────────────────────

  const activeCount = admins.filter((a) => a.is_active && !a.is_owner).length;
  const inactiveCount = admins.filter((a) => !a.is_active).length;
  const totalCount = admins.length;

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Equipo administrativo
            </h1>
            <p className="text-sm text-muted-foreground">
              {totalCount} miembro{totalCount !== 1 ? "s" : ""} · {activeCount} activo{activeCount !== 1 ? "s" : ""}
              {inactiveCount > 0 && ` · ${inactiveCount} inactivo${inactiveCount !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>

        {isOwner && (
          <button
            onClick={() => {
              setAdminForm(EMPTY_ADMIN);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <UserPlus className="h-4 w-4" />
            Agregar miembro
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total" value={totalCount} icon={Users} />
        <StatCard label="Activos" value={activeCount + (admins.some((a) => a.is_owner) ? 1 : 0)} icon={Power} />
        <StatCard label="Inactivos" value={inactiveCount} icon={PowerOff} />
        <StatCard label="Historial" value={auditLog.length} icon={History} onClick={() => setShowAudit(!showAudit)} />
      </div>

      {/* Admin list */}
      <div className="space-y-3">
        {admins.map((a) => (
          <div
            key={a.id}
            className={`rounded-xl border bg-card p-5 shadow-sm transition-colors ${
              a.is_owner
                ? "border-amber-300/50 dark:border-amber-700/50"
                : !a.is_active
                ? "border-border opacity-60"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold ${
                    a.is_owner
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      : !a.is_active
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {a.full_name
                    .split(" ")
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>

                <div className="space-y-1">
                  {/* Nombre + badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium text-foreground ${!a.is_active ? "line-through" : ""}`}>
                      {a.full_name}
                    </span>

                    {a.is_owner && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        <Crown className="h-3 w-3" />
                        Dueño
                      </span>
                    )}

                    {!a.is_owner && (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STAFF_ROLES[a.staff_role]?.color ?? "bg-gray-100 text-gray-700"
                        } ${STAFF_ROLES[a.staff_role]?.darkColor ?? ""}`}
                      >
                        {a.staff_role === "otro" && a.staff_label
                          ? a.staff_label
                          : STAFF_ROLES[a.staff_role]?.label ?? a.staff_role}
                      </span>
                    )}

                    {!a.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                        <AlertCircle className="h-3 w-3" />
                        Inactivo
                      </span>
                    )}
                  </div>

                  {/* Email + phone */}
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {a.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {a.email}
                      </span>
                    )}
                    {a.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {a.phone}
                      </span>
                    )}
                    {a.added_at && (
                      <span className="flex items-center gap-1 text-xs">
                        <Clock className="h-3 w-3" />
                        Desde {new Date(a.added_at).toLocaleDateString("es-AR")}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              {isOwner && !a.is_owner && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditRole(a)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Cambiar rol"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(a)}
                    className={`rounded-md p-2 transition-colors ${
                      a.is_active
                        ? "text-muted-foreground hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20"
                        : "text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20"
                    }`}
                    title={a.is_active ? "Desactivar" : "Reactivar"}
                  >
                    {a.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => handleRemoveAdmin(a)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {admins.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground">
              No hay administradores configurados
            </p>
            {isOwner && (
              <button
                onClick={() => {
                  setAdminForm(EMPTY_ADMIN);
                  setShowAddModal(true);
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <UserPlus className="h-4 w-4" />
                Agregar el primer miembro
              </button>
            )}
          </div>
        )}
      </div>

      {/* Audit log section */}
      <div className="space-y-3">
        <button
          onClick={() => setShowAudit(!showAudit)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
          Historial de cambios ({auditLog.length})
          {showAudit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAudit && (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            {auditLog.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No hay registros de cambios aún
              </div>
            ) : (
              <div className="divide-y divide-border">
                {auditLog.map((entry) => {
                  const actionInfo = AUDIT_ACTION_LABELS[entry.action] ?? {
                    label: entry.action,
                    color: "text-foreground",
                  };
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-4">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                        <History className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{entry.performer_name}</span>{" "}
                          <span className={actionInfo.color}>{actionInfo.label.toLowerCase()}</span>{" "}
                          a <span className="font-medium">{entry.target_name}</span>
                          {entry.details?.staff_role && (
                            <span className="text-muted-foreground">
                              {" "}como {STAFF_ROLES[entry.details.staff_role as string]?.label ?? entry.details.staff_role}
                            </span>
                          )}
                          {entry.details?.old_role && entry.details?.new_role && (
                            <span className="text-muted-foreground">
                              {" "}de {STAFF_ROLES[entry.details.old_role as string]?.label ?? entry.details.old_role}
                              {" "}a {STAFF_ROLES[entry.details.new_role as string]?.label ?? entry.details.new_role}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(entry.created_at).toLocaleString("es-AR", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal: Agregar admin ─── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowAddModal(false)} />
          <div className="relative z-10 w-full max-w-md rounded-xl border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">Agregar miembro del equipo</h2>
              <button
                onClick={() => setShowAddModal(false)}
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
                  Si el email no está registrado, se creará una cuenta. El usuario recibirá instrucciones para establecer su contraseña.
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

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rol en la clínica *</label>
                <select
                  value={adminForm.staff_role}
                  onChange={(e) => setAdminForm({ ...adminForm, staff_role: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="secretaria">Secretaria</option>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="gerente">Gerente</option>
                  <option value="contador">Contador/a</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {adminForm.staff_role === "otro" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Especificar rol</label>
                  <input
                    type="text"
                    value={adminForm.label}
                    onChange={(e) => setAdminForm({ ...adminForm, label: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ej: Coordinadora, Asistente"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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

      {/* ─── Modal: Editar rol ─── */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditingAdmin(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">Cambiar rol</h2>
              <button
                onClick={() => setEditingAdmin(null)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Cambiando el rol de <span className="font-medium text-foreground">{editingAdmin.full_name}</span>
            </p>

            <form onSubmit={handleEditRole} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nuevo rol</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="secretaria">Secretaria</option>
                  <option value="recepcionista">Recepcionista</option>
                  <option value="gerente">Gerente</option>
                  <option value="contador">Contador/a</option>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {editRole === "otro" && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Especificar</label>
                  <input
                    type="text"
                    value={editLabel}
                    onChange={(e) => setEditLabel(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Ej: Coordinadora"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  disabled={savingEdit}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit className="h-4 w-4" />}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`rounded-lg border border-border bg-card p-4 shadow-sm ${
        onClick ? "cursor-pointer hover:bg-muted transition-colors text-left" : ""
      }`}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </Wrapper>
  );
}
