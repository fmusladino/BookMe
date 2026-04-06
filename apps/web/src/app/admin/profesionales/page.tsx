"use client";

import { useEffect, useState } from "react";
import {
  Stethoscope,
  Plus,
  Edit,
  Eye,
  EyeOff,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Professional {
  id: string;
  full_name: string;
  email: string;
  specialty: string;
  line: string;
  city: string;
  subscription_plan: string;
  subscription_status: string;
  is_visible: boolean;
}

interface ProfessionalsResponse {
  professionals: Professional[];
  total: number;
}

export default function ProfessionalesPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    specialty: "",
    line: "healthcare" as "healthcare" | "business",
    city: "",
    subscription_plan: "free" as "free" | "base" | "standard" | "premium",
  });

  useEffect(() => {
    fetchProfessionals();
  }, [search, filterLine]);

  const fetchProfessionals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filterLine) params.append("line", filterLine);

      const response = await fetch(
        `/api/admin/profesionales?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch professionals");
      const data: ProfessionalsResponse = await response.json();
      setProfessionals(data.professionals);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error loading professionals"
      );
      toast.error("Error cargando profesionales");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (professional?: Professional) => {
    if (professional) {
      setEditingId(professional.id);
      setFormData({
        full_name: professional.full_name,
        email: professional.email,
        specialty: professional.specialty,
        line: professional.line as "healthcare" | "business",
        city: professional.city,
        subscription_plan: professional.subscription_plan as any,
      });
    } else {
      setEditingId(null);
      setFormData({
        full_name: "",
        email: "",
        specialty: "",
        line: "healthcare",
        city: "",
        subscription_plan: "free",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const url = editingId
        ? `/api/admin/profesionales/${editingId}`
        : "/api/admin/profesionales";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to save professional");

      toast.success(
        editingId
          ? "Profesional actualizado"
          : "Profesional creado exitosamente"
      );
      setIsDialogOpen(false);
      fetchProfessionals();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error saving professional"
      );
    }
  };

  const handleToggleVisibility = async (id: string, currentVisibility: boolean) => {
    try {
      const response = await fetch(`/api/admin/profesionales/${id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: !currentVisibility }),
      });

      if (!response.ok) throw new Error("Failed to update visibility");
      toast.success("Visibilidad actualizada");
      fetchProfessionals();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error updating visibility"
      );
    }
  };

  const filteredProfessionals = professionals.filter((p) =>
    filterLine ? p.line === filterLine : true
  );

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
            Gestión de Profesionales
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administra todos los profesionales registrados en BookMe
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Profesional
        </Button>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium mb-2">Buscar</label>
            <Input
              placeholder="Nombre, email, especialidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Línea</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={filterLine || ""}
              onChange={(e) => setFilterLine(e.target.value || null)}
            >
              <option value="">Todas las líneas</option>
              <option value="healthcare">Healthcare</option>
              <option value="business">Business</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setSearch("");
                setFilterLine(null);
              }}
              className="w-full"
            >
              Limpiar filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-primary" />
          </div>
        ) : filteredProfessionals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Especialidad</th>
                  <th className="px-4 py-3 text-left font-medium">Línea</th>
                  <th className="px-4 py-3 text-left font-medium">Ciudad</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProfessionals.map((professional, idx) => (
                  <tr
                    key={professional.id}
                    className={
                      idx % 2 === 0
                        ? "bg-muted/30"
                        : "bg-background"
                    }
                  >
                    <td className="px-4 py-3 font-medium">
                      {professional.full_name}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {professional.email}
                    </td>
                    <td className="px-4 py-3">{professional.specialty}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          professional.line === "healthcare"
                            ? "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }
                      >
                        {professional.line === "healthcare"
                          ? "Healthcare"
                          : "Business"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{professional.city}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                        {professional.subscription_plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          professional.subscription_status === "active"
                            ? "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : "inline-block px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                        }
                      >
                        {professional.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => handleOpenDialog(professional)}
                          title="Editar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            handleToggleVisibility(
                              professional.id,
                              professional.is_visible
                            )
                          }
                          title={
                            professional.is_visible
                              ? "Ocultar"
                              : "Mostrar"
                          }
                        >
                          {professional.is_visible ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
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
            <Stethoscope className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No hay profesionales que coincidan con los filtros
            </p>
          </div>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? "Editar Profesional"
                : "Crear Nuevo Profesional"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre completo
              </label>
              <Input
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="juan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Especialidad
              </label>
              <Input
                value={formData.specialty}
                onChange={(e) =>
                  setFormData({ ...formData, specialty: e.target.value })
                }
                placeholder="Médico Clínico"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Línea</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.line}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    line: e.target.value as "healthcare" | "business",
                  })
                }
              >
                <option value="healthcare">Healthcare</option>
                <option value="business">Business</option>
              </select>
            </div>
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
              <label className="block text-sm font-medium mb-2">Plan</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.subscription_plan}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    subscription_plan: e.target.value as any,
                  })
                }
              >
                <option value="free">Free</option>
                <option value="base">Base</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
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
