"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  Bell,
  Loader2,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Download,
  User,
  Filter,
} from "lucide-react";

interface FileNotification {
  type: "shared_file";
  id: string;
  patient_id: string;
  patient_name: string;
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

type FilterMode = "all" | "pending" | "viewed";

export default function NotificacionesPage() {
  const [notifications, setNotifications] = useState<FileNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("pending");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/professional/notifications");
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { notifications: FileNotification[] };
      setNotifications(data.notifications ?? []);
    } catch {
      toast.error("No se pudieron cargar las notificaciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = async (id: string) => {
    setOpening(id);
    try {
      const res = await fetch(`/api/patient/shared-files/${id}/download`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank");
      void load();
    } catch {
      toast.error("No se pudo abrir el archivo");
    } finally {
      setOpening(null);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "pending") return !n.viewed_at;
    if (filter === "viewed") return !!n.viewed_at;
    return true;
  });

  const pendingCount = notifications.filter((n) => !n.viewed_at).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Notificaciones de pacientes
          </h1>
          <p className="text-sm text-muted-foreground">
            Archivos y estudios que tus pacientes te enviaron desde su portal.
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            {pendingCount} sin ver
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {(
          [
            { key: "pending", label: "Pendientes", count: pendingCount },
            { key: "viewed", label: "Vistos", count: notifications.length - pendingCount },
            { key: "all", label: "Todos", count: notifications.length },
          ] as const
        ).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.key
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
            <span className="opacity-70">({opt.count})</span>
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {filter === "pending"
              ? "No tenés archivos pendientes de ver."
              : filter === "viewed"
                ? "Todavía no abriste ningún archivo."
                : "No recibiste archivos de tus pacientes."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                !n.viewed_at
                  ? "border-amber-300 dark:border-amber-700/60 bg-amber-50/50 dark:bg-amber-900/10"
                  : "border-border bg-card hover:bg-muted/40"
              }`}
            >
              <div className="shrink-0 mt-0.5">{fileIcon(n.mime_type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/dashboard/pacientes/${n.patient_id}/notas`}
                    className="text-sm font-semibold text-foreground hover:underline inline-flex items-center gap-1"
                  >
                    <User className="h-3.5 w-3.5" />
                    {n.patient_name}
                  </Link>
                  {n.viewed_at ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Visto
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <Clock className="h-3 w-3" />
                      Nuevo
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1 truncate">
                  {n.file_name}{" "}
                  <span className="text-xs text-muted-foreground">
                    · {formatSize(n.file_size)}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Recibido el{" "}
                  {format(parseISO(n.uploaded_at), "d 'de' MMMM yyyy, HH:mm", {
                    locale: es,
                  })}
                </p>
                {n.description && (
                  <p className="text-xs text-muted-foreground/80 mt-1 italic">
                    "{n.description}"
                  </p>
                )}
              </div>
              <button
                onClick={() => handleOpen(n.id)}
                disabled={opening === n.id}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {opening === n.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Abrir
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
