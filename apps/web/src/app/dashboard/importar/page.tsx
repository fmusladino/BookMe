"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  FileSpreadsheet,
  Calendar,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type { ImportResult } from "@/lib/importers/types";

type FileType = "csv" | "xlsx" | "ics" | null;

function detectFileType(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "xlsx" || ext === "xls") return "xlsx";
  if (ext === "ics") return "ics";
  return null;
}

function getFileIcon(type: FileType) {
  switch (type) {
    case "csv":
    case "xlsx":
      return <FileSpreadsheet className="h-8 w-8 text-emerald-500" />;
    case "ics":
      return <Calendar className="h-8 w-8 text-blue-500" />;
    default:
      return <FileText className="h-8 w-8 text-muted-foreground" />;
  }
}

function getFileLabel(type: FileType) {
  switch (type) {
    case "csv":
      return "CSV";
    case "xlsx":
      return "Excel";
    case "ics":
      return "Google Calendar";
    default:
      return "Archivo";
  }
}

export default function ImportarPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const type = detectFileType(selected.name);
    if (!type) {
      setError("Formato no soportado. Usá archivos .csv, .xlsx, .xls o .ics");
      setFile(null);
      setFileType(null);
      return;
    }

    setFile(selected);
    setFileType(type);
    setError(null);
    setResult(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    const type = detectFileType(dropped.name);
    if (!type) {
      setError("Formato no soportado. Usá archivos .csv, .xlsx, .xls o .ics");
      setFile(null);
      setFileType(null);
      return;
    }

    setFile(dropped);
    setFileType(type);
    setError(null);
    setResult(null);
  };

  const handleImport = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/appointments", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as ImportResult & { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "Error al importar");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileType(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/agenda"
          className="rounded-md p-1.5 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar turnos</h1>
          <p className="text-sm text-muted-foreground">
            Importá turnos desde Excel, CSV o Google Calendar
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal: upload */}
        <div className="lg:col-span-2 space-y-4">
          {/* Drop zone */}
          <div
            className="rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 transition-colors p-8 text-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.ics"
              onChange={handleFileSelect}
              className="hidden"
            />

            {!file ? (
              <div className="space-y-3">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <div>
                  <p className="font-medium">
                    Arrastrá un archivo o hacé click para seleccionar
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Formatos soportados: .csv, .xlsx, .xls, .ics
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-4">
                {getFileIcon(fileType)}
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{getFileLabel(fileType)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReset();
                  }}
                >
                  Cambiar
                </Button>
              </div>
            )}
          </div>

          {/* Botón importar */}
          {file && !result && (
            <Button
              className="w-full"
              size="lg"
              onClick={handleImport}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importar turnos
                </>
              )}
            </Button>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Error al importar</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Resultados */}
          {result && (
            <div className="rounded-lg border bg-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <h3 className="text-lg font-semibold">Importación completada</h3>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {result.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">Importados</p>
                </div>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {result.skipped}
                  </p>
                  <p className="text-xs text-muted-foreground">Omitidos</p>
                </div>
                <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3 text-center">
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {result.errors.length}
                  </p>
                  <p className="text-xs text-muted-foreground">Errores</p>
                </div>
              </div>

              {/* Detalle de errores */}
              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Detalle de errores:</p>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 text-sm rounded-md bg-muted/50 px-3 py-2"
                      >
                        <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Fila {err.row}:</strong> {err.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleReset} variant="outline">
                  Importar otro archivo
                </Button>
                <Link href="/dashboard/agenda">
                  <Button>Ver agenda</Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Columna lateral: instrucciones */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5 space-y-4">
            <h3 className="font-semibold">Formatos aceptados</h3>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Excel / CSV</p>
                  <p className="text-xs text-muted-foreground">
                    Columnas: paciente, fecha, hora inicio, hora fin, servicio, notas, DNI, email, teléfono
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Google Calendar (.ics)</p>
                  <p className="text-xs text-muted-foreground">
                    Exportá tu calendario desde Google Calendar {">"} Configuración {">"} Exportar
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-5 space-y-3">
            <h3 className="font-semibold">Tips</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                Si un paciente no existe, se crea automáticamente
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                Los turnos duplicados se omiten sin error
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                Los nombres de columnas se detectan automáticamente
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                Si no hay hora de fin, se asignan 30 minutos por defecto
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
