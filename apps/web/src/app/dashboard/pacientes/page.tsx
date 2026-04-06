"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Search, Phone, Mail, X, Loader2, Edit, Trash2, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Patient {
  id: string;
  full_name: string;
  dni: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  insurance_id: string | null;
  insurance_number: string | null;
  is_particular: boolean;
  notes: string | null;
  created_at: string;
}

interface Insurance {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  full_name: "",
  dni: "",
  email: "",
  phone: "",
  birth_date: "",
  insurance_id: "",
  insurance_number: "",
  is_particular: true,
  notes: "",
};

export default function PacientesPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/patients");
      if (!res.ok) throw new Error("Error al cargar pacientes");
      const data = (await res.json()) as { patients: Patient[] };
      setPatients(data.patients ?? []);
    } catch (error) {
      console.error("Error al cargar pacientes:", error);
      toast.error("No se pudieron cargar los pacientes");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInsurances = useCallback(async () => {
    try {
      const res = await fetch("/api/insurances");
      if (res.ok) {
        const data = (await res.json()) as { insurances: Insurance[] };
        setInsurances(data.insurances ?? []);
      }
    } catch {
      // Silencioso — las obras sociales son opcionales
    }
  }, []);

  useEffect(() => {
    void fetchPatients();
    void fetchInsurances();
  }, [fetchPatients, fetchInsurances]);

  const filtered = patients.filter(
    (p) =>
      p.full_name.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search) ||
      (p.email?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.phone?.includes(search) ?? false)
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (patient: Patient) => {
    setForm({
      full_name: patient.full_name,
      dni: patient.dni,
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      birth_date: patient.birth_date ?? "",
      insurance_id: patient.insurance_id ?? "",
      insurance_number: patient.insurance_number ?? "",
      is_particular: patient.is_particular,
      notes: patient.notes ?? "",
    });
    setEditingId(patient.id);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name || !form.dni) {
      toast.error("Nombre y DNI son obligatorios");
      return;
    }

    setSaving(true);
    try {
      const body = {
        full_name: form.full_name,
        dni: form.dni,
        email: form.email || null,
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        insurance_id: form.is_particular ? null : (form.insurance_id || null),
        insurance_number: form.is_particular ? null : (form.insurance_number || null),
        is_particular: form.is_particular,
        notes: form.notes || null,
      };

      let res: Response;
      if (editingId) {
        res = await fetch(`/api/patients/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/patients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Error al guardar paciente");
      }

      toast.success(editingId ? "Paciente actualizado" : "Paciente creado");
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      void fetchPatients();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar a ${name}? Esta acción no se puede deshacer.`)) return;

    try {
      const res = await fetch(`/api/patients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Paciente eliminado");
      void fetchPatients();
    } catch {
      toast.error("No se pudo eliminar el paciente");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestioná tus pacientes y sus datos
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Nuevo paciente
        </button>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar por nombre, DNI, email o teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-input bg-background pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Lista de pacientes */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">
            {search
              ? "No se encontraron pacientes con esa búsqueda"
              : "No tenés pacientes registrados todavía"}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Crear primer paciente
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => (
            <div
              key={patient.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{patient.full_name}</p>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>DNI: {patient.dni}</span>
                  {patient.is_particular ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Particular
                    </span>
                  ) : (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      Obra Social
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  {patient.phone && (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3.5 w-3.5" />
                      {patient.phone}
                    </div>
                  )}
                  {patient.email && (
                    <div className="flex items-center gap-1 text-sm">
                      <Mail className="h-3.5 w-3.5" />
                      {patient.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/clinical-records?patient_id=${patient.id}`);
                        if (!res.ok) {
                          router.push(`/dashboard/pacientes/${patient.id}/historia-clinica`);
                          return;
                        }
                        const data = (await res.json()) as { records?: unknown[] };
                        if (!data.records || data.records.length === 0) {
                          toast.info(`${patient.full_name} no posee historia clínica. Podés crear la primera entrada desde la vista de HC.`, {
                            action: {
                              label: "Ir a HC",
                              onClick: () => router.push(`/dashboard/pacientes/${patient.id}/historia-clinica`),
                            },
                          });
                        } else {
                          router.push(`/dashboard/pacientes/${patient.id}/historia-clinica`);
                        }
                      } catch {
                        router.push(`/dashboard/pacientes/${patient.id}/historia-clinica`);
                      }
                    }}
                    className="rounded-md p-2 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-900/20 transition-colors"
                    title="Historia clínica"
                  >
                    <FileText className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEdit(patient)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Editar"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(patient.id, patient.full_name)}
                    className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear/editar paciente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowModal(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-lg border bg-card p-6 shadow-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-heading font-semibold">
                {editingId ? "Editar paciente" : "Nuevo paciente"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-medium">Nombre completo *</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="Nombre y apellido"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">DNI *</label>
                  <input
                    type="text"
                    value={form.dni}
                    onChange={(e) => setForm({ ...form, dni: e.target.value })}
                    required
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="12345678"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="+5491155551234"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="paciente@email.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Fecha de nacimiento</label>
                  <input
                    type="date"
                    value={form.birth_date}
                    onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* Cobertura */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-center gap-4">
                  <label className="text-sm font-medium">Cobertura:</label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={form.is_particular}
                      onChange={() => setForm({ ...form, is_particular: true, insurance_id: "", insurance_number: "" })}
                      className="accent-primary"
                    />
                    Particular
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={!form.is_particular}
                      onChange={() => setForm({ ...form, is_particular: false })}
                      className="accent-primary"
                    />
                    Obra Social
                  </label>
                </div>

                {!form.is_particular && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Obra Social</label>
                      <select
                        value={form.insurance_id}
                        onChange={(e) => setForm({ ...form, insurance_id: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Seleccionar...</option>
                        {insurances.map((ins) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Nº de afiliado</label>
                      <input
                        type="text"
                        value={form.insurance_number}
                        onChange={(e) => setForm({ ...form, insurance_number: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="123456"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notas */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder="Observaciones del paciente..."
                />
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Guardar cambios" : "Crear paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
