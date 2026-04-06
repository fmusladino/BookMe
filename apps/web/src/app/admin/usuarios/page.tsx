"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  Building2,
  Search,
  Globe,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  dni: string;
  phone: string | null;
  created_at: string;
  is_clinic_owner: boolean;
  clinic_name: string | null;
  is_visible: boolean | null; // null = no es profesional
}

interface RoleCounts {
  professional: number;
  patient: number;
  admin: number;
  superadmin: number;
  marketing: number;
  clinic_owner: number;
}

// ─── Constants ──────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; badge: string }> = {
  professional: {
    label: "Profesional",
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  patient: {
    label: "Paciente",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  },
  admin: {
    label: "Admin Consultorio",
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  superadmin: {
    label: "Super Admin",
    badge: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  marketing: {
    label: "Marketing",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  clinic_owner: {
    label: "Owner Clínica",
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

const FILTER_TABS = [
  { key: null, label: "Todos" },
  { key: "professional", label: "Profesional" },
  { key: "patient", label: "Paciente" },
  { key: "admin", label: "Admin Consultorio" },
  { key: "clinic_owner", label: "Owner Clínica" },
  { key: "superadmin", label: "Super Admin" },
  { key: "marketing", label: "Marketing" },
];

// Precios por línea de negocio según la tabla de pricing
const PLAN_OPTIONS_BY_LINE: Record<string, { value: string; label: string; price: string }[]> = {
  healthcare: [
    { value: "free", label: "Free", price: "Gratis" },
    { value: "base", label: "Base", price: "USD 9/mes" },
    { value: "standard", label: "Standard", price: "USD 15/mes" },
    { value: "premium", label: "Premium", price: "USD 20/mes" },
  ],
  business: [
    { value: "free", label: "Free", price: "Gratis" },
    { value: "base", label: "Base", price: "USD 7/mes" },
    { value: "standard", label: "Standard", price: "USD 14/mes" },
    { value: "premium", label: "Premium", price: "USD 25/mes" },
  ],
};

// Planes de consultorio — solo Healthcare
const CLINIC_PLAN_OPTIONS = [
  {
    value: "small",
    label: "Consultorio Peque\u00f1o",
    price: "USD 79/mes",
    priceAnnual: "USD 854/a\u00f1o",
    capacity: "Hasta 10 profesionales",
    features: "Features Standard + soporte prioritario",
  },
  {
    value: "large",
    label: "Consultorio Grande",
    price: "USD 149/mes",
    priceAnnual: "USD 1.610/a\u00f1o",
    capacity: "11+ profesionales, sin l\u00edmite",
    features: "Features Premium + onboarding + soporte dedicado",
    recommended: true,
  },
] as const;

const LINE_OPTIONS = [
  { value: "healthcare", label: "Healthcare (Salud)" },
  { value: "business", label: "Business (Negocios)" },
  { value: "consultorio", label: "Consultorio (Clínica)" },
] as const;

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  dni: "",
  phone: "",
  role: "professional",
  // Campos extra para profesionales
  line: "healthcare",
  specialty: "",
  subscription_plan: "standard",
  // Campos extra para consultorio (rol admin)
  clinic_name: "",
  clinic_plan: "small",
  clinic_billing_cycle: "monthly",
};

// ─── Page ───────────────────────────────────────────────────

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roleCounts, setRoleCounts] = useState<RoleCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Modal crear/editar
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Modal confirmar eliminación
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle cartilla
  const [togglingCartilla, setTogglingCartilla] = useState<Set<string>>(new Set());

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedFilter) params.append("role", selectedFilter);

      const response = await fetch(`/api/admin/users?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data.users ?? []);
      setRoleCounts(data.roleCounts ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading users");
      toast.error("Error cargando usuarios");
    } finally {
      setLoading(false);
    }
  }, [selectedFilter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ─── Filtrar por búsqueda ─────────────────────────────────

  const displayedUsers = searchTerm
    ? users.filter(
        (u) =>
          u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          u.dni.includes(searchTerm)
      )
    : users;

  // ─── Crear usuario ────────────────────────────────────────

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormData(EMPTY_FORM);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      full_name: user.full_name,
      email: user.email === "—" ? "" : user.email,
      password: "",
      dni: user.dni,
      phone: user.phone ?? "",
      role: user.role,
      line: "healthcare",
      specialty: "",
      subscription_plan: "standard",
      clinic_name: "",
      clinic_plan: "small",
      clinic_billing_cycle: "monthly",
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.full_name || !formData.email || !formData.dni) {
      toast.error("Nombre, email y DNI son obligatorios");
      return;
    }

    if (!editingUser && !formData.password) {
      toast.error("La contraseña es obligatoria para nuevos usuarios");
      return;
    }

    // Validar campos extra para profesionales (solo al crear)
    if (!editingUser && formData.role === "professional") {
      if (formData.line === "consultorio") {
        if (!formData.clinic_name) {
          toast.error("El nombre del consultorio es obligatorio");
          return;
        }
      } else {
        if (!formData.specialty) {
          toast.error("La especialidad es obligatoria para profesionales");
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (editingUser) {
        // PATCH — editar existente
        const body: Record<string, string> = {
          full_name: formData.full_name,
          dni: formData.dni,
          phone: formData.phone,
          role: formData.role,
          email: formData.email,
        };
        if (formData.password) body.password = formData.password;

        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al actualizar");
        }
        toast.success("Usuario actualizado");
      } else {
        // POST — crear nuevo
        const res = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Error al crear");
        }
        toast.success("Usuario creado exitosamente");
      }

      setIsDialogOpen(false);
      setEditingUser(null);
      void fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  // ─── Eliminar usuario ─────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingUser) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al eliminar");
      }
      const data = await res.json();
      if (data.had_clinics) {
        toast.success(`Usuario eliminado. Atención: era owner de: ${data.clinic_names.join(", ")}`, {
          duration: 6000,
        });
      } else {
        toast.success("Usuario eliminado");
      }
      setDeletingUser(null);
      void fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setDeleting(false);
    }
  };

  // ─── Toggle cartilla ──────────────────────────────────────

  const handleToggleCartilla = async (user: User) => {
    const newVisible = !user.is_visible;
    setTogglingCartilla((prev) => new Set(prev).add(user.id));

    try {
      const res = await fetch(`/api/admin/cartilla/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: newVisible }),
      });
      if (!res.ok) throw new Error("Error al actualizar");

      // Actualizar estado local
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, is_visible: newVisible } : u))
      );
      toast.success(
        newVisible
          ? `${user.full_name} publicado en cartilla`
          : `${user.full_name} ocultado de cartilla`
      );
    } catch {
      toast.error("Error al cambiar visibilidad en cartilla");
    } finally {
      setTogglingCartilla((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Gestión de Usuarios
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Alta, baja y modificación de todos los usuarios de BookMe
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Tabs de filtro */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.key === null
                ? roleCounts
                  ? Object.entries(roleCounts)
                      .filter(([k]) => k !== "clinic_owner")
                      .reduce((sum, [, v]) => sum + v, 0)
                  : users.length
                : roleCounts?.[tab.key as keyof RoleCounts] ?? 0;

            return (
              <Button
                key={tab.key ?? "all"}
                variant={selectedFilter === tab.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedFilter(tab.key)}
              >
                {tab.key === "clinic_owner" && <Building2 className="mr-1 h-3.5 w-3.5" />}
                {tab.label} ({count})
              </Button>
            );
          })}
        </div>
      </Card>

      {/* Barra de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nombre, email o DNI..."
          className="pl-10"
        />
      </div>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : displayedUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">DNI</th>
                  <th className="px-4 py-3 text-left font-medium">Teléfono</th>
                  <th className="px-4 py-3 text-left font-medium">Rol</th>
                  <th className="px-4 py-3 text-left font-medium">Clínica</th>
                  <th className="px-4 py-3 text-center font-medium">Cartilla</th>
                  <th className="px-4 py-3 text-left font-medium">Registro</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {displayedUsers.map((user, idx) => (
                  <tr
                    key={user.id}
                    className={`transition-colors hover:bg-muted/40 ${
                      idx % 2 === 0 ? "bg-muted/20" : "bg-background"
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {user.full_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.dni}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {user.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                          ROLE_CONFIG[user.role]?.badge ?? ""
                        }`}
                      >
                        {ROLE_CONFIG[user.role]?.label ?? user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_clinic_owner ? (
                        <span className="inline-flex items-center gap-1 text-xs">
                          <Building2 className="h-3.5 w-3.5 text-orange-500" />
                          <span className="text-foreground font-medium">{user.clinic_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.is_visible !== null ? (
                        <button
                          onClick={() => handleToggleCartilla(user)}
                          disabled={togglingCartilla.has(user.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                            user.is_visible
                              ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300 dark:hover:bg-green-800"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                          }`}
                          title={user.is_visible ? "Click para ocultar de cartilla" : "Click para publicar en cartilla"}
                        >
                          {togglingCartilla.has(user.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : user.is_visible ? (
                            <Globe className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                          {user.is_visible ? "Visible" : "Oculto"}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(user)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          title="Editar usuario"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No hay usuarios que coincidan
            </p>
          </div>
        )}
      </Card>

      {/* ─── Dialog Crear/Editar ─── */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl" onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? `Editar: ${editingUser.full_name}` : "Crear Nuevo Usuario"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            {/* ── Datos personales ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Datos personales
              </legend>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Nombre completo *</label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="juan@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {editingUser ? "Nueva contraseña" : "Contraseña *"}
                  </label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? "Sin cambios" : "••••••••"}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">DNI *</label>
                  <Input
                    value={formData.dni}
                    onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Teléfono</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+54 9 11 0000-0000"
                  />
                </div>
              </div>
            </fieldset>

            {/* ── Rol y línea ── */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Rol y configuración
              </legend>

              <div className={`grid gap-4 ${!editingUser && formData.role === "professional" ? "grid-cols-2" : "grid-cols-1"}`}>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Rol</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    {Object.entries(ROLE_CONFIG)
                      .filter(([key]) => key !== "clinic_owner")
                      .map(([role, config]) => (
                        <option key={role} value={role}>
                          {config.label}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Línea de negocio — al lado del rol si es profesional */}
                {formData.role === "professional" && !editingUser && (
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Línea de negocio *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={formData.line}
                      onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                    >
                      {LINE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </fieldset>

            {/* ─── Campos extra para Profesionales ─── */}
            {formData.role === "professional" && !editingUser && (
              <fieldset className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
                <legend className="text-xs font-semibold text-primary uppercase tracking-wide px-2">
                  {formData.line === "consultorio" ? "Configuración de consultorio" : "Configuración de profesional"}
                </legend>

                {/* ── Healthcare / Business: Especialidad + Plan individual ── */}
                {formData.line !== "consultorio" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Especialidad *</label>
                      <Input
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                        placeholder={formData.line === "healthcare" ? "Ej: Médico Clínico, Odontóloga, Psicóloga..." : "Ej: Peluquería, Barbería, Coach..."}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1.5">Plan de suscripción</label>
                      <div className="grid grid-cols-4 gap-2">
                        {(PLAN_OPTIONS_BY_LINE[formData.line] ?? PLAN_OPTIONS_BY_LINE["healthcare"]).map((plan) => (
                          <button
                            key={plan.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, subscription_plan: plan.value })}
                            className={`flex flex-col items-center justify-center rounded-lg border-2 px-3 py-2.5 text-sm transition-all ${
                              formData.subscription_plan === plan.value
                                ? "border-primary bg-primary/10 text-primary shadow-sm"
                                : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted"
                            }`}
                          >
                            <span className="font-semibold">{plan.label}</span>
                            <span className="text-xs mt-0.5 opacity-70">{plan.price}</span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        El plan determina las funcionalidades disponibles y el precio de suscripción.
                        {formData.subscription_plan !== "free" && " Se iniciará un trial de 30 días."}
                      </p>
                    </div>
                  </>
                )}

                {/* ── Consultorio: Nombre + Plan clínica + Ciclo facturación ── */}
                {formData.line === "consultorio" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Nombre del consultorio *</label>
                      <Input
                        value={formData.clinic_name}
                        onChange={(e) => setFormData({ ...formData, clinic_name: e.target.value })}
                        placeholder="Ej: Centro Médico San Martín, Clínica Dental Sonrisa..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Plan de consultorio */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Plan de consultorio</label>
                        <div className="grid grid-cols-1 gap-2">
                          {CLINIC_PLAN_OPTIONS.map((plan) => (
                            <button
                              key={plan.value}
                              type="button"
                              onClick={() => setFormData({ ...formData, clinic_plan: plan.value })}
                              className={`relative flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-sm text-left transition-all ${
                                formData.clinic_plan === plan.value
                                  ? "border-purple-500 bg-purple-100/80 text-purple-700 shadow-sm dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200"
                                  : "border-border bg-background text-muted-foreground hover:border-purple-300 hover:bg-muted"
                              }`}
                            >
                              <div className="flex-1">
                                <span className="font-semibold block">{plan.label}</span>
                                <span className="text-xs opacity-70">{plan.capacity}</span>
                              </div>
                              <span className="text-base font-bold whitespace-nowrap">{plan.price}</span>
                              {plan.value === "large" && (
                                <span className="absolute -top-2 right-3 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                  Recomendado
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Ciclo de facturación */}
                      <div>
                        <label className="block text-sm font-medium mb-1.5">Ciclo de facturación</label>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, clinic_billing_cycle: "monthly" })}
                            className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                              formData.clinic_billing_cycle === "monthly"
                                ? "border-purple-500 bg-purple-100/80 text-purple-700 dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200"
                                : "border-border bg-background text-muted-foreground hover:border-purple-300"
                            }`}
                          >
                            Mensual
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, clinic_billing_cycle: "annual" })}
                            className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                              formData.clinic_billing_cycle === "annual"
                                ? "border-purple-500 bg-purple-100/80 text-purple-700 dark:border-purple-400 dark:bg-purple-900/40 dark:text-purple-200"
                                : "border-border bg-background text-muted-foreground hover:border-purple-300"
                            }`}
                          >
                            Anual <span className="text-xs opacity-70">(10% dcto)</span>
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {formData.clinic_plan === "small"
                            ? formData.clinic_billing_cycle === "annual"
                              ? "USD 854/año (ahorrás USD 94)"
                              : "USD 79/mes"
                            : formData.clinic_billing_cycle === "annual"
                              ? "USD 1.610/año (ahorrás USD 178)"
                              : "USD 149/mes"
                          }
                          {" · "}Features {formData.clinic_plan === "large" ? "Premium" : "Standard"} para todos.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </fieldset>
            )}

            {/* ── Botones ── */}
            <div className="flex gap-3 pt-2 border-t border-border">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingUser(null);
                }}
                className="flex-1"
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? "Guardar cambios" : "Crear usuario"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Confirmar Eliminación ─── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => !deleting && setDeletingUser(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Confirmar eliminación</h2>
              <button
                onClick={() => setDeletingUser(null)}
                disabled={deleting}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-2">
              ¿Estás seguro de que querés eliminar a <span className="font-medium text-foreground">{deletingUser.full_name}</span>?
            </p>
            <p className="text-sm text-muted-foreground mb-1">
              Email: {deletingUser.email}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Rol: {ROLE_CONFIG[deletingUser.role]?.label ?? deletingUser.role}
            </p>

            {deletingUser.is_clinic_owner && (
              <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-amber-600 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Este usuario es owner de la clínica <strong>{deletingUser.clinic_name}</strong>. Al eliminarlo, la clínica quedará sin owner.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs text-red-500 mb-4">
              Esta acción no se puede deshacer. Se eliminarán su cuenta y todos los datos asociados.
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setDeletingUser(null)}
                className="flex-1"
                disabled={deleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1"
                disabled={deleting}
              >
                {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
