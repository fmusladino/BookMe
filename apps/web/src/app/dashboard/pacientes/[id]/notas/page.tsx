"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SessionNote {
  id: string;
  patient_id: string;
  content: string;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Appointment {
  id: string;
  patient_id: string;
  starts_at: string;
  service_name?: string;
}

export default function NotasPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  // Estados
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal de crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<SessionNote | null>(null);
  const [formContent, setFormContent] = useState("");
  const [formAppointmentId, setFormAppointmentId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Modal de confirmación de eliminación
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<SessionNote | null>(null);

  // Cargar notas de sesión
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/session-notes?patient_id=${patientId}`);
      if (!res.ok) throw new Error("Error al cargar notas");
      const data = (await res.json()) as { notes: SessionNote[] };
      setNotes(data.notes ?? []);
    } catch (error) {
      console.error("Error al cargar notas:", error);
      toast.error("Error al cargar las notas");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

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

  useEffect(() => {
    void fetchNotes();
    void fetchAppointments();
  }, [fetchNotes, fetchAppointments]);

  // Abrir modal de crear
  const handleNewNote = () => {
    setEditingNote(null);
    setFormContent("");
    setFormAppointmentId("");
    setModalOpen(true);
  };

  // Abrir modal de editar
  const handleEdit = (note: SessionNote) => {
    setEditingNote(note);
    setFormContent(note.content);
    setFormAppointmentId(note.appointment_id || "");
    setModalOpen(true);
  };

  // Guardar nota (crear o editar)
  const handleSaveNote = async () => {
    if (!formContent.trim()) {
      toast.error("La nota no puede estar vacía");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        patient_id: patientId,
        content: formContent.trim(),
        appointment_id: formAppointmentId || null,
      };

      let res;
      if (editingNote) {
        // Editar nota existente
        res = await fetch(`/api/session-notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        // Crear nueva nota
        res = await fetch("/api/session-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Error al guardar nota");

      toast.success(editingNote ? "Nota actualizada" : "Nota creada");
      setModalOpen(false);
      setEditingNote(null);
      setFormContent("");
      setFormAppointmentId("");
      await fetchNotes();
    } catch (error) {
      console.error("Error al guardar nota:", error);
      toast.error("Error al guardar la nota");
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir modal de confirmación de eliminación
  const handleDeleteClick = (note: SessionNote) => {
    setNoteToDelete(note);
    setDeleteModalOpen(true);
  };

  // Confirmar eliminación
  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;

    setDeleting(noteToDelete.id);
    try {
      const res = await fetch(`/api/session-notes/${noteToDelete.id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error al eliminar nota");

      toast.success("Nota eliminada");
      setDeleteModalOpen(false);
      setNoteToDelete(null);
      await fetchNotes();
    } catch (error) {
      console.error("Error al eliminar nota:", error);
      toast.error("Error al eliminar la nota");
    } finally {
      setDeleting(null);
    }
  };

  // Formatear fecha de cita
  const formatAppointmentDate = (appointmentId: string) => {
    const appointment = appointments.find((a) => a.id === appointmentId);
    if (!appointment) return null;

    try {
      const date = parseISO(appointment.starts_at);
      return format(date, "d 'de' MMMM yyyy, HH:mm", { locale: es });
    } catch {
      return null;
    }
  };

  // Formatear fecha de creación
  const formatNoteDate = (createdAt: string) => {
    try {
      const date = parseISO(createdAt);
      return format(date, "d 'de' MMMM yyyy, HH:mm", { locale: es });
    } catch {
      return createdAt;
    }
  };

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

      {/* Título y botón */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Notas de sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Registrá observaciones de las sesiones
          </p>
        </div>
        <button
          onClick={handleNewNote}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Nueva nota
        </button>
      </div>

      {/* Lista de notas */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <Calendar className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">
            No hay notas de sesión para este cliente
          </p>
          <Button onClick={handleNewNote} variant="outline" className="mt-4">
            Crear primera nota
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-border bg-card p-5 hover:bg-muted/50 transition-colors space-y-3"
            >
              {/* Fecha y acciones */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {formatNoteDate(note.created_at)}
                  </p>
                  {note.appointment_id && (
                    <p className="text-xs text-muted-foreground/80 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatAppointmentDate(note.appointment_id) ||
                        "Cita (sin detalles)"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(note)}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Editar nota"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(note)}
                    disabled={deleting === note.id}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
                    title="Eliminar nota"
                  >
                    {deleting === note.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Contenido de la nota */}
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear/Editar nota */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingNote ? "Editar nota" : "Nueva nota de sesión"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de cita (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="appointment-select">
                Asociar a una cita (opcional)
              </Label>
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

            {/* Textarea */}
            <div className="space-y-2">
              <Label htmlFor="note-content">Contenido de la nota</Label>
              <Textarea
                id="note-content"
                placeholder="Escribí las observaciones de la sesión..."
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                className="min-h-32 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {formContent.length} caracteres
              </p>
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  setEditingNote(null);
                  setFormContent("");
                  setFormAppointmentId("");
                }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveNote}
                disabled={submitting || !formContent.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Confirmar eliminación */}
      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar nota</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar esta nota? Esta acción no
              se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel disabled={deleting === noteToDelete?.id}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting === noteToDelete?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting === noteToDelete?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
