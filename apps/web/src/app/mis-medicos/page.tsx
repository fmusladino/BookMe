"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Loader2,
  Stethoscope,
  Upload,
  Download,
  Trash2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  X,
  Paperclip,
  ExternalLink,
} from "lucide-react";

interface Doctor {
  patient_id: string;
  professional_id: string;
  full_name: string;
  avatar_url: string | null;
  specialty: string | null;
  city: string | null;
  public_slug: string | null;
  last_appointment_at: string | null;
  total_appointments: number;
  attended_appointments: number;
}

interface SharedFile {
  id: string;
  patient_id: string;
  professional_id: string;
  professional_name: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  description: string | null;
  uploaded_at: string;
  viewed_at: string | null;
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (mime: string) =>
  mime.startsWith("image/") ? (
    <ImageIcon className="w-5 h-5 text-muted-foreground" />
  ) : (
    <FileText className="w-5 h-5 text-muted-foreground" />
  );

export default function MisMedicosPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modal state
  const [modalDoctor, setModalDoctor] = useState<Doctor | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsRes, filesRes] = await Promise.all([
        fetch("/api/patient/professionals"),
        fetch("/api/patient/shared-files"),
      ]);
      if (docsRes.ok) {
        const data = (await docsRes.json()) as { professionals: Doctor[] };
        setDoctors(data.professionals ?? []);
      }
      if (filesRes.ok) {
        const data = (await filesRes.json()) as { files: SharedFile[] };
        setFiles(data.files ?? []);
      }
    } catch (err) {
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const openUploadModal = (doctor: Doctor) => {
    setModalDoctor(doctor);
    setSelectedFile(null);
    setDescription("");
  };

  const closeModal = () => {
    if (uploading) return;
    setModalDoctor(null);
    setSelectedFile(null);
    setDescription("");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !modalDoctor) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("patient_id", modalDoctor.patient_id);
      if (description.trim()) formData.append("description", description.trim());

      const res = await fetch("/api/patient/shared-files", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error || "Error al subir el archivo");
      }
      toast.success("Archivo enviado");
      closeModal();
      // Mantener expandida la card del médico al que envié
      setExpanded((prev) => ({ ...prev, [modalDoctor.patient_id]: true }));
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const res = await fetch(`/api/patient/shared-files/${id}/download`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank");
    } catch {
      toast.error("No se pudo descargar el archivo");
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`¿Eliminar "${fileName}"? El profesional dejará de verlo.`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/patient/shared-files/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Archivo eliminado");
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      toast.error("No se pudo eliminar el archivo");
    } finally {
      setDeleting(null);
    }
  };

  const filesByPatientId = files.reduce<Record<string, SharedFile[]>>((acc, f) => {
    (acc[f.patient_id] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mis médicos</h1>
        <p className="text-muted-foreground text-sm">
          Profesionales con los que ya te atendiste. Podés enviarles estudios u otros archivos.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : doctors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <Stethoscope className="mx-auto h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            Todavía no tenés médicos
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Reservá tu primer turno desde el directorio y va a aparecer acá.
          </p>
          <Link
            href="/directorio"
            className="inline-flex items-center gap-2 rounded-lg bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Buscar profesional
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {doctors.map((doc) => {
            const docFiles = filesByPatientId[doc.patient_id] ?? [];
            const isExpanded = expanded[doc.patient_id] ?? false;
            return (
              <div
                key={doc.patient_id}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                <div className="p-5 flex items-start gap-4">
                  <div className="shrink-0">
                    {doc.avatar_url ? (
                      <Image
                        src={doc.avatar_url}
                        alt={doc.full_name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <Stethoscope className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-foreground">{doc.full_name}</p>
                        {doc.specialty && (
                          <p className="text-sm text-muted-foreground">{doc.specialty}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {doc.public_slug && (
                          <Link
                            href={`/perfil/${doc.public_slug}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Ver perfil
                          </Link>
                        )}
                        <button
                          onClick={() => openUploadModal(doc)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Enviar archivo
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
                      {doc.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {doc.city}
                        </span>
                      )}
                      {doc.last_appointment_at && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Última visita:{" "}
                          {format(parseISO(doc.last_appointment_at), "d MMM yyyy", {
                            locale: es,
                          })}
                        </span>
                      )}
                      <span>
                        {doc.total_appointments}{" "}
                        {doc.total_appointments === 1 ? "turno" : "turnos"}
                      </span>
                      {docFiles.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="w-3.5 h-3.5" />
                          {docFiles.length}{" "}
                          {docFiles.length === 1 ? "archivo enviado" : "archivos enviados"}
                        </span>
                      )}
                    </div>

                    {docFiles.length > 0 && (
                      <button
                        onClick={() => toggleExpanded(doc.patient_id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-bookme-navy dark:text-bookme-mint hover:underline"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            Ocultar archivos
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            Ver archivos enviados
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && docFiles.length > 0 && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-2">
                    {docFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-3 rounded-md border border-border bg-background p-3"
                      >
                        <div className="shrink-0">{fileIcon(f.mime_type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-foreground truncate">
                              {f.file_name}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatSize(f.file_size)}
                            </span>
                            {f.viewed_at ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                Visto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                <Clock className="w-3 h-3" />
                                Pendiente
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Enviado el{" "}
                            {format(parseISO(f.uploaded_at), "d MMM yyyy HH:mm", {
                              locale: es,
                            })}
                          </p>
                          {f.description && (
                            <p className="text-xs text-muted-foreground/80 mt-0.5 truncate">
                              {f.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDownload(f.id)}
                            className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Descargar"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(f.id, f.file_name)}
                            disabled={deleting === f.id}
                            className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                            title="Eliminar"
                          >
                            {deleting === f.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Enviar archivo */}
      {modalDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-md rounded-lg border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-heading font-semibold">Enviar archivo</h3>
                <p className="text-sm text-muted-foreground">
                  Para <span className="font-medium">{modalDoctor.full_name}</span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Archivo *</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  required
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium"
                />
                <p className="text-xs text-muted-foreground">
                  PDF, JPG, PNG, WebP o GIF — hasta 15 MB
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Descripción (opcional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="Ej: análisis de sangre del 02/05"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={uploading}
                  className="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading || !selectedFile}
                  className="flex items-center gap-2 rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
