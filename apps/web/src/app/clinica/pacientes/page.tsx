"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Users, Phone, Mail, Loader2 } from "lucide-react";

interface Patient {
  id: string;
  full_name: string;
  dni: string;
  email: string | null;
  phone: string | null;
  is_particular: boolean;
  professional_name: string | null;
}

export default function ClinicaPacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/clinic/patients");
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();
      setPatients(data.patients ?? []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPatients();
  }, [fetchPatients]);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.full_name.toLowerCase().includes(q) ||
      p.dni.includes(q) ||
      (p.email?.toLowerCase().includes(q) ?? false) ||
      (p.phone?.includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Pacientes del consultorio
        </h1>
        <p className="text-sm text-muted-foreground">
          Todos los pacientes de los profesionales del consultorio
        </p>
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

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            {search
              ? "No se encontraron pacientes con esa búsqueda"
              : "No hay pacientes registrados en el consultorio"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((patient) => (
            <div
              key={patient.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {patient.full_name}
                </p>
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
                  {patient.professional_name && (
                    <span className="text-xs">
                      Prof: {patient.professional_name}
                    </span>
                  )}
                </div>
              </div>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
