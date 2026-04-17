"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface AvatarUploadProps {
  /** URL actual del avatar (o null si no tiene) */
  currentUrl: string | null;
  /** Nombre del usuario (para mostrar iniciales como fallback) */
  fallbackName: string;
  /** Tabla donde guardar: "profiles" (profesional/paciente) o "court_owners" */
  table?: "profiles" | "court_owners";
  /** Callback cuando el avatar cambia (recibe la nueva URL o null) */
  onAvatarChange?: (url: string | null) => void;
}

export function AvatarUpload({
  currentUrl,
  fallbackName,
  table = "profiles",
  onAvatarChange,
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sincronizar si el prop cambia desde afuera
  if (currentUrl !== null && currentUrl !== avatarUrl && !uploading) {
    setAvatarUrl(currentUrl);
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación client-side
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Formato no permitido. Usá JPG, PNG, WebP o GIF.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo supera los 2 MB permitidos.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`/api/upload/avatar?table=${table}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al subir la imagen");
      }

      const data = (await res.json()) as { avatar_url: string };
      setAvatarUrl(data.avatar_url);
      onAvatarChange?.(data.avatar_url);
      toast.success("Foto de perfil actualizada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir la imagen");
    } finally {
      setUploading(false);
      // Resetear el input para permitir volver a subir el mismo archivo
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/upload/avatar?table=${table}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Error al eliminar la imagen");

      setAvatarUrl(null);
      onAvatarChange?.(null);
      toast.success("Foto de perfil eliminada");
    } catch {
      toast.error("Error al eliminar la imagen");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Avatar con overlay de cámara */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="relative group cursor-pointer rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed"
      >
        <Avatar
          src={avatarUrl}
          alt={fallbackName}
          fallback={fallbackName}
          size="xl"
        />
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          ) : (
            <Camera className="h-5 w-5 text-white" />
          )}
        </div>
      </button>

      {/* Acciones */}
      <div className="flex flex-col gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Camera className="mr-2 h-3 w-3" />
              {avatarUrl ? "Cambiar foto" : "Subir foto"}
            </>
          )}
        </Button>

        {avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-destructive hover:text-destructive"
          >
            {deleting ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-3 w-3" />
            )}
            Eliminar
          </Button>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
