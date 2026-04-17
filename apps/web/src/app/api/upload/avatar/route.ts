import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_AVATAR_EXTENSIONS: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
};

/**
 * POST /api/upload/avatar
 *
 * Sube una foto de perfil a Supabase Storage y actualiza el avatar_url
 * en la tabla correspondiente según el rol del usuario.
 *
 * Body: FormData con campo "file" (imagen)
 * Query: ?table=profiles|court_owners (default: profiles)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se envió ningún archivo" }, { status: 400 });
    }

    // Validar tipo MIME
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usá JPG, PNG, WebP o GIF." },
        { status: 400 }
      );
    }

    // Validar extensión vs MIME (defense in depth contra MIME spoofing)
    const ext = ("." + (file.name.split(".").pop() || "")).toLowerCase();
    const allowedMimes = ALLOWED_AVATAR_EXTENSIONS[ext];
    if (!allowedMimes || !allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "La extensión del archivo no coincide con su formato." },
        { status: 400 }
      );
    }

    // Validar tamaño
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "El archivo supera los 2 MB permitidos." },
        { status: 400 }
      );
    }

    // Reusar la extensión validada arriba (sin el punto inicial)
    const fileExt = ext.replace(/^\./, "") || "jpg";
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Subir a Supabase Storage (upsert: reemplaza si ya existe)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      console.error("Error al subir avatar:", uploadError);
      return NextResponse.json(
        { error: "Error al subir el archivo" },
        { status: 500 }
      );
    }

    // Obtener URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(filePath);

    // Agregar timestamp para cache-busting
    const avatarUrl = `${publicUrl}?t=${Date.now()}`;

    // Determinar en qué tabla actualizar
    const table = request.nextUrl.searchParams.get("table") || "profiles";

    if (table === "court_owners") {
      const { error: updateError } = await supabase
        .from("court_owners")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error al actualizar avatar en court_owners:", updateError);
        return NextResponse.json(
          { error: "Error al guardar la URL del avatar" },
          { status: 500 }
        );
      }
    } else {
      // Actualizar en profiles (para profesionales y pacientes)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error al actualizar avatar en profiles:", updateError);
        return NextResponse.json(
          { error: "Error al guardar la URL del avatar" },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (error) {
    console.error("POST /api/upload/avatar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

/**
 * DELETE /api/upload/avatar
 *
 * Elimina la foto de perfil actual del usuario.
 * Query: ?table=profiles|court_owners (default: profiles)
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // Listar archivos del usuario en el bucket
    const { data: files } = await supabase.storage
      .from("avatars")
      .list(user.id);

    // Eliminar todos los archivos del avatar del usuario
    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from("avatars").remove(filePaths);
    }

    // Determinar en qué tabla limpiar
    const table = request.nextUrl.searchParams.get("table") || "profiles";

    if (table === "court_owners") {
      await supabase
        .from("court_owners")
        .update({ avatar_url: null })
        .eq("id", user.id);
    } else {
      await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
    }

    return NextResponse.json({ avatar_url: null });
  } catch (error) {
    console.error("DELETE /api/upload/avatar:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
