"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Archive,
  ArchiveRestore,
  PenLine,
  ShieldCheck,
  Clock,
  Eye,
  FileEdit,
  FilePlus,
  FileDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ClinicalRecord {
  id: string;
  patient_id: string;
  content: string;
  appointment_id: string | null;
  is_amendment: boolean;
  amends_record_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: string;
  record_id: string | null;
  accessed_by_name: string;
  action: string;
  accessed_at: string;
  ip_address: string | null;
  details: Record<string, unknown> | null;
}

interface Appointment {
  id: string;
  patient_id: string;
  starts_at: string;
  service_name?: string;
}

type TabType = "registros" | "auditoria";

export default function HistoriaClinicaPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  // Tab activa
  const [activeTab, setActiveTab] = useState<TabType>("registros");

  // Estados — Registros
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // Modal de crear nueva entrada
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [formContent, setFormContent] = useState("");
  const [formAppointmentId, setFormAppointmentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Modal de enmienda
  const [amendModalOpen, setAmendModalOpen] = useState(false);
  const [amendingRecord, setAmendingRecord] = useState<ClinicalRecord | null>(null);
  const [amendContent, setAmendContent] = useState("");
  const [amendReason, setAmendReason] = useState("");

  // Modal de archivar
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [recordToArchive, setRecordToArchive] = useState<ClinicalRecord | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Estado de exportación PDF
  const [exporting, setExporting] = useState<string | null>(null);

  // Estados — Auditoría
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditTotal, setAuditTotal] = useState(0);

  // Cargar registros clínicos
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const url = showArchived
        ? `/api/clinical-records?patient_id=${patientId}&include_archived=true`
        : `/api/clinical-records?patient_id=${patientId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Error al cargar registros clínicos");
      const data = (await res.json()) as { records: ClinicalRecord[] };
      setRecords(data.records ?? []);
    } catch (error) {
      console.error("Error al cargar registros clínicos:", error);
      toast.error("Error al cargar los registros clínicos");
    } finally {
      setLoading(false);
    }
  }, [patientId, showArchived]);

  // Cargar citas
  const fetchAppointments = useCallback(async () => {
    try {
      const res = await fetch(`/api/appointments?patient_id=${patientId}`);
      if (!res.ok) throw new Error("Error al cargar citas");
      const data = (await res.json()) as { appointments: Appointment[] };
      setAppointments(data.appointments ?? []);
    } catch (error) {
      console.error("Error al cargar citas:", error);
    }
  }, [patientId]);

  // Cargar log de auditoría
  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await fetch(`/api/clinical-records/audit?patient_id=${patientId}&limit=100`);
      if (!res.ok) throw new Error("Error al cargar auditoría");
      const data = (await res.json()) as { audit_logs: AuditLog[]; total: number };
      setAuditLogs(data.audit_logs ?? []);
      setAuditTotal(data.total ?? 0);
    } catch (error) {
      console.error("Error al cargar auditoría:", error);
      toast.error("Error al cargar el log de auditoría");
    } finally {
      setAuditLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void fetchRecords();
    void fetchAppointments();
  }, [fetchRecords, fetchAppointments]);

  // Cargar auditoría cuando se cambia a esa tab
  useEffect(() => {
    if (activeTab === "auditoria") {
      void fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Crear nueva entrada
  const handleNewRecord = () => {
    setFormContent("");
    setFormAppointmentId("");
    setCreateModalOpen(true);
  };

  const handleCreateRecord = async () => {
    if (!formContent.trim() || formContent.trim().length < 10) {
      toast.error("El registro debe tener al menos 10 caracteres");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/clinical-records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          content: formContent.trim(),
          appointment_id: formAppointmentId || null,
        }),
      });

      if (!res.ok) throw new Error("Error al crear registro clínico");

      toast.success("Registro creado");
      setCreateModalOpen(false);
      setFormContent("");
      setFormAppointmentId("");
      await fetchRecords();
    } catch (error) {
      console.error("Error al crear registro clínico:", error);
      toast.error("Error al crear el registro clínico");
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de enmienda
  const handleAmendClick = (record: ClinicalRecord) => {
    setAmendingRecord(record);
    setAmendContent("");
    setAmendReason("");
    setAmendModalOpen(true);
  };

  // Crear enmienda
  const handleCreateAmendment = async () => {
    if (!amendingRecord) return;
    if (!amendContent.trim() || amendContent.trim().length < 10) {
      toast.error("La enmienda debe tener al menos 10 caracteres");
      return;
    }
    if (!amendReason.trim()) {
      toast.error("El motivo de la enmienda es obligatorio");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/clinical-records/${amendingRecord.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: amendContent.trim(),
          reason: amendReason.trim(),
        }),
      });

      if (!res.ok) throw new Error("Error al crear enmienda");

      toast.success("Enmienda registrada correctamente");
      setAmendModalOpen(false);
      setAmendingRecord(null);
      await fetchRecords();
    } catch (error) {
      console.error("Error al crear enmienda:", error);
      toast.error("Error al crear la enmienda");
    } finally {
      setSubmitting(false);
    }
  };

  // Archivar / Desarchivar
  const handleArchiveClick = (record: ClinicalRecord) => {
    setRecordToArchive(record);
    setArchiveModalOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!recordToArchive) return;

    const isArchiving = !recordToArchive.is_archived;
    setArchiving(true);
    try {
      const res = await fetch(`/api/clinical-records/${recordToArchive.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isArchiving ? "archive" : "unarchive",
        }),
      });

      if (!res.ok) throw new Error("Error al archivar/desarchivar");

      toast.success(isArchiving ? "Registro archivado" : "Registro desarchivado");
      setArchiveModalOpen(false);
      setRecordToArchive(null);
      await fetchRecords();
    } catch (error) {
      console.error("Error al archivar:", error);
      toast.error("Error al archivar el registro");
    } finally {
      setArchiving(false);
    }
  };

  // Exportar PDF
  const handleExportPDF = async (recordId?: string) => {
    const exportId = recordId || "all";
    setExporting(exportId);
    try {
      const urlParams = new URLSearchParams({ patient_id: patientId });
      if (recordId) urlParams.set("record_id", recordId);

      const res = await fetch(`/api/clinical-records/export?${urlParams.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error((data as { error?: string }).error || "Error al exportar");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "historia_clinica.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(recordId ? "Entrada exportada como PDF" : "Historia clínica exportada como PDF");
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      toast.error(error instanceof Error ? error.message : "Error al exportar PDF");
    } finally {
      setExporting(null);
    }
  };

  // Helpers de formato
  const formatAppointmentDate = (appointmentId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return null;
    try {
      return format(parseISO(appointment.starts_at), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es });
    } catch {
      return null;
    }
  };

  const formatRecordDate = (createdAt: string) => {
    try {
      return format(parseISO(createdAt), "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es });
    } catch {
      return createdAt;
    }
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const getPreview = (content: string, max = 200) =>
    content.length <= max ? content : content.substring(0, max) + "...";

  // Mapeo de acciones de auditoría
  const auditActionConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    read: { label: "Lectura", icon: <Eye className="h-3.5 w-3.5" />, color: "text-blue-600 dark:text-blue-400" },
    create: { label: "Creación", icon: <FilePlus className="h-3.5 w-3.5" />, color: "text-green-600 dark:text-green-400" },
    update: { label: "Modificación", icon: <FileEdit className="h-3.5 w-3.5" />, color: "text-yellow-600 dark:text-yellow-400" },
    amendment: { label: "Enmienda", icon: <PenLine className="h-3.5 w-3.5" />, color: "text-orange-600 dark:text-orange-400" },
    export: { label: "Exportación PDF", icon: <FileDown className="h-3.5 w-3.5" />, color: "text-purple-600 dark:text-purple-400" },
    delete: { label: "Archivado", icon: <Archive className="h-3.5 w-3.5" />, color: "text-red-600 dark:text-red-400" },
  };

  // Separar registros principales y enmiendas
  const mainRecords = records.filter((r) => !r.is_amendment);
  const amendmentsMap = new Map<string, ClinicalRecord[]>();
  records
    .filter((r) => r.is_amendment && r.amends_record_id)
    .forEach((r) => {
      const existing = amendmentsMap.get(r.amends_record_id!) || [];
      existing.push(r);
      amendmentsMap.set(r.amends_record_id!, existing);
    });

  return (
    <div className="space-y-6">
      {/* Header con volver */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>
      </div>

      {/* Título y acciones */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Historia clínica
          </h1>
          <p className="text-sm text-muted-foreground">
            Registros inmutables, encriptados y auditados (Ley 26.529)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mainRecords.length > 0 && (
            <button
              onClick={() => handleExportPDF()}
              disabled={exporting === "all"}
              className="flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              {exporting === "all" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Exportar PDF
            </button>
          )}
          <button
            onClick={handleNewRecord}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <Plus className="h-4 w-4" />
            Nueva entrada
          </button>
        </div>
      </div>

      {/* Aviso de inmutabilidad */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Los registros de historia clínica son <strong>inmutables</strong>. No pueden editarse ni eliminarse una vez creados.
            Puede agregar <strong>enmiendas</strong> o <strong>archivar</strong> entradas que ya no son relevantes.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setActiveTab("registros")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "registros"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Registros
        </button>
        <button
          onClick={() => setActiveTab("auditoria")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "auditoria"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Log de auditoría
          </span>
        </button>
      </div>

      {/* ====== TAB: Registros ====== */}
      {activeTab === "registros" && (
        <>
          {/* Toggle archivados */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-border"
              />
              Mostrar archivados
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : mainRecords.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No hay registros clínicos para este paciente
              </p>
              <Button onClick={handleNewRecord} variant="outline" className="mt-4">
                Crear primer registro
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {mainRecords.map((record) => {
                const isExpanded = expandedRecordId === record.id;
                const preview = getPreview(record.content);
                const isPreviewTruncated = record.content.length > 200;
                const amendments = amendmentsMap.get(record.id) || [];

                return (
                  <div
                    key={record.id}
                    className={`rounded-lg border bg-card overflow-hidden transition-colors ${
                      record.is_archived
                        ? "border-dashed border-muted-foreground/30 opacity-60"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    {/* Header del registro */}
                    <div className="p-5 space-y-3">
                      {/* Fecha, badges y acciones */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-muted-foreground uppercase">
                              {capitalize(formatRecordDate(record.created_at))}
                            </p>
                            {record.is_archived && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                                <Archive className="h-2.5 w-2.5" />
                                Archivado
                              </span>
                            )}
                          </div>
                          {record.appointment_id && (
                            <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatAppointmentDate(record.appointment_id) || "Cita"}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Descargar PDF individual */}
                          <button
                            onClick={() => handleExportPDF(record.id)}
                            disabled={exporting === record.id}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
                            title="Descargar PDF"
                          >
                            {exporting === record.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </button>
                          {/* Enmienda */}
                          <button
                            onClick={() => handleAmendClick(record)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title="Agregar enmienda"
                          >
                            <PenLine className="h-4 w-4" />
                          </button>
                          {/* Archivar / Desarchivar */}
                          <button
                            onClick={() => handleArchiveClick(record)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                            title={record.is_archived ? "Desarchivar" : "Archivar"}
                          >
                            {record.is_archived ? (
                              <ArchiveRestore className="h-4 w-4" />
                            ) : (
                              <Archive className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Contenido */}
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {isExpanded ? record.content : preview}
                      </p>

                      {isPreviewTruncated && (
                        <button
                          onClick={() => setExpandedRecordId(isExpanded ? null : record.id)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="h-3.5 w-3.5" />
                              Ver menos
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-3.5 w-3.5" />
                              Ver más
                            </>
                          )}
                        </button>
                      )}

                      {/* Enmiendas vinculadas */}
                      {amendments.length > 0 && (
                        <div className="mt-3 border-t border-border pt-3 space-y-2">
                          <p className="text-xs font-medium text-orange-600 dark:text-orange-400 flex items-center gap-1">
                            <PenLine className="h-3 w-3" />
                            {amendments.length} {amendments.length === 1 ? "enmienda" : "enmiendas"}
                          </p>
                          {amendments.map((amend) => (
                            <div
                              key={amend.id}
                              className="ml-4 pl-3 border-l-2 border-orange-300 dark:border-orange-700"
                            >
                              <p className="text-[10px] text-muted-foreground uppercase mb-1">
                                {capitalize(formatRecordDate(amend.created_at))}
                              </p>
                              <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                {amend.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ====== TAB: Auditoría ====== */}
      {activeTab === "auditoria" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {auditTotal} {auditTotal === 1 ? "evento registrado" : "eventos registrados"}
            </p>
            <button
              onClick={fetchAuditLogs}
              disabled={auditLoading}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Actualizar
            </button>
          </div>

          {auditLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
              <Clock className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                No hay eventos de auditoría registrados
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {auditLogs.map((log) => {
                const config = auditActionConfig[log.action] || {
                  label: log.action,
                  icon: <AlertTriangle className="h-3.5 w-3.5" />,
                  color: "text-muted-foreground",
                };

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-0.5 ${config.color}`}>{config.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-xs font-semibold ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="text-xs text-foreground">
                          {log.accessed_by_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {capitalize(formatRecordDate(log.accessed_at))}
                        {log.ip_address && ` — IP: ${log.ip_address}`}
                      </p>
                      {log.details && (
                        <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                          {(log.details as { reason?: string }).reason
                            ? `Motivo: ${(log.details as { reason: string }).reason}`
                            : (log.details as { type?: string }).type
                              ? `Tipo: ${(log.details as { type: string }).type}`
                              : ""}
                        </p>
                      )}
                    </div>
                    {log.record_id && (
                      <span className="text-[9px] text-muted-foreground/60 font-mono shrink-0">
                        {log.record_id.slice(0, 8)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====== MODAL: Crear nueva entrada ====== */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva entrada en historia clínica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appointment-select">Asociar a una cita (opcional)</Label>
              <select
                id="appointment-select"
                value={formAppointmentId}
                onChange={(e) => setFormAppointmentId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Sin cita --</option>
                {appointments.map((apt) => (
                  <option key={apt.id} value={apt.id}>
                    {formatAppointmentDate(apt.id) || `Cita ${apt.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="record-content">Contenido del registro</Label>
              <Textarea
                id="record-content"
                placeholder="Registrá la información clínica del paciente..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-40 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {formContent.length} caracteres
                {formContent.trim().length < 10 && " (mínimo 10)"}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Una vez creada, esta entrada no podrá editarse ni eliminarse.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleCreateRecord} disabled={submitting || formContent.trim().length < 10}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Crear entrada"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL: Enmienda ====== */}
      <Dialog open={amendModalOpen} onOpenChange={setAmendModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar enmienda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {amendingRecord && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Entrada original:</p>
                <p className="text-xs text-foreground/80 line-clamp-3">
                  {amendingRecord.content}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="amend-reason">Motivo de la enmienda *</Label>
              <input
                id="amend-reason"
                type="text"
                placeholder="Ej: Corrección de diagnóstico, dato adicional, error de transcripción..."
                value={amendReason}
                onChange={(e) => setAmendReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amend-content">Contenido de la enmienda *</Label>
              <Textarea
                id="amend-content"
                placeholder="Escribí la corrección o información adicional..."
                value={amendContent}
                onChange={(e) => setAmendContent(e.target.value)}
                className="min-h-32 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {amendContent.length} caracteres
                {amendContent.trim().length < 10 && " (mínimo 10)"}
              </p>
            </div>
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                La enmienda se vinculará a la entrada original sin modificarla. Ambas quedarán registradas de forma permanente.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setAmendModalOpen(false)} disabled={submitting}>
                Cancelar
              </Button>
              <Button
                onClick={handleCreateAmendment}
                disabled={submitting || amendContent.trim().length < 10 || !amendReason.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Registrar enmienda"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== MODAL: Confirmar archivado ====== */}
      <AlertDialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {recordToArchive?.is_archived ? "Desarchivar registro" : "Archivar registro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {recordToArchive?.is_archived
                ? "El registro volverá a ser visible en la lista principal de la historia clínica."
                : "El registro se ocultará de la vista principal pero seguirá existiendo de forma permanente. Puede desarchivarlo en cualquier momento."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={archiving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive} disabled={archiving}>
              {archiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : recordToArchive?.is_archived ? (
                "Desarchivar"
              ) : (
                "Archivar"
              )}
            </AlertDialogAction>
          </div>
      </AlertDialog>
    </div>
  );
}
