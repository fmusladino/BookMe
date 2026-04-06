"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Clinic {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  owner_id: string;
  owner_name: string;
  professionals_count: number;
}

interface ClinicsResponse {
  clinics: Clinic[];
  total: number;
}

interface UserOption {
  id: string;
  full_name: string;
}

export default function ClinicasPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    address: "",
    city: "",
    province: "",
    owner_id: "",
  });

  useEffect(() => {
    fetchClinics();
    fetchUsers();
  }, []);

  const fetchClinics = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/clinicas");
      if (!response.ok) throw new Error("Failed to fetch clinics");
      const data: ClinicsResponse = await response.json();
      setClinics(data.clinics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading clinics");
      toast.error("Error cargando clínicas");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/usuarios/owners");
      if (!response.ok) throw new Error("Failed to fetch users");
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleOpenDialog = (clinic?: Clinic) => {
    if (clinic) {
      setEditingId(clinic.id);
      setFormData({
        name: clinic.name,
        slug: clinic.slug || "",
        address: clinic.address || "",
        city: clinic.city || "",
        province: clinic.province || "",
        owner_id: clinic.owner_id,
      });
    } else {
      setEditingId(null);
      setFormData({
        name: "",
        slug: "",
        address: "",
        city: "",
        province: "",
        owner_id: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.owner_id) {
      toast.error("Nombre y propietario son obligatorios");
      return;
    }

    try {
      const url = editingId
        ? `/api/admin/clinicas/${editingId}`
        : "/api/admin/clinicas";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save clinic");

      toast.success(
        editingId ? "Clínica actualizada" : "Clínica creada exitosamente"
      );
      setIsDialogOpen(false);
      fetchClinics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving clinic");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta clínica?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/clinicas/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete clinic");

      toast.success("Clínica eliminada");
      fetchClinics();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error deleting clinic");
    }
  };

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
            Gestión de Clínicas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra todas las clínicas y centros médicos registrados
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Clínica
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-primary" />
          </div>
        ) : clinics.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Slug</th>
                  <th className="px-4 py-3 text-left font-medium">Dirección</th>
                  <th className="px-4 py-3 text-left font-medium">Ciudad</th>
                  <th className="px-4 py-3 text-left font-medium">Propietario</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Profesionales
                  </th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clinics.map((clinic, idx) => (
                  <tr
                    key={clinic.id}
                    className={
                      idx % 2 === 0
                        ? "bg-muted/30"
                        : "bg-background"
                    }
                  >
                    <td className="px-4 py-3 font-medium">{clinic.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {clinic.slug || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {clinic.address || "—"}
                    </td>
                    <td className="px-4 py-3">{clinic.city || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {clinic.owner_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                        {clinic.professionals_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleOpenDialog(clinic)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleDelete(clinic.id)}
                          title="Eliminar"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No hay clínicas registradas
            </p>
          </div>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Clínica" : "Crear Nueva Clínica"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre *
              </label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Centro Médico ABC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Slug</label>
              <Input
                value={formData.slug}
                onChange={(e) =>
                  setFormData({ ...formData, slug: e.target.value })
                }
                placeholder="centro-medico-abc"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Dirección
              </label>
              <Input
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="Calle 123, Piso 4"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Ciudad</label>
                <Input
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                  placeholder="Buenos Aires"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Provincia
                </label>
                <Input
                  value={formData.province}
                  onChange={(e) =>
                    setFormData({ ...formData, province: e.target.value })
                  }
                  placeholder="CABA"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Propietario *
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.owner_id}
                onChange={(e) =>
                  setFormData({ ...formData, owner_id: e.target.value })
                }
              >
                <option value="">Selecciona un propietario</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {editingId ? "Guardar cambios" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
