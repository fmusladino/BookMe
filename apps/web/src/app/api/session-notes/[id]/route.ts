import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validación para actualizar una nota de sesión
const updateSessionNoteSchema = z.object({
  content: z.string().min(1, "Contenido requerido").max(5000, "Máximo 5000 caracteres"),
});

// GET /api/session-notes/[id] — Obtener una nota de sesión por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Obtener la nota de sesión
    const { data, error } = await supabase
      .from("session_notes")
      .select(
        `id,
        professional_id,
        patient_id,
        appointment_id,
        content,
        created_at,
        updated_at,
        appointment:appointments(id, starts_at, ends_at, status),
        patient:patients(id, full_name)`
      )
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nota de sesión no encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error("Error GET /api/session-notes/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// PATCH /api/session-notes/[id] — Actualizar contenido de una nota de sesión
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as unknown;
    const parsed = updateSessionNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Actualizar la nota de sesión
    const { data, error } = await supabase
      .from("session_notes")
      .update({ content: parsed.data.content })
      .eq("id", id)
      .eq("professional_id", user.id)
      .select(
        `id,
        professional_id,
        patient_id,
        appointment_id,
        content,
        created_at,
        updated_at,
        appointment:appointments(id, starts_at, ends_at, status),
        patient:patients(id, full_name)`
      )
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Nota de sesión no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error("Error PATCH /api/session-notes/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/session-notes/[id] — Eliminar una nota de sesión
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;

    // Verificar que la nota pertenece al profesional antes de eliminar
    const { data: existingNote, error: fetchError } = await supabase
      .from("session_notes")
      .select("id")
      .eq("id", id)
      .eq("professional_id", user.id)
      .single();

    if (fetchError || !existingNote) {
      return NextResponse.json(
        { error: "Nota de sesión no encontrada o sin permisos" },
        { status: 404 }
      );
    }

    // Eliminar la nota
    const { error } = await supabase
      .from("session_notes")
      .delete()
      .eq("id", id)
      .eq("professional_id", user.id);

    if (error) {
      console.error("Error al eliminar nota de sesión:", error);
      return NextResponse.json(
        { error: "Error al eliminar nota de sesión" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 204 });
  } catch (error) {
    console.error("Error DELETE /api/session-notes/[id]:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
