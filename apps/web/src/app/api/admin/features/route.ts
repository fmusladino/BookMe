import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { verifyAdminAuth } from "../_lib/auth";

// ─── GET /api/admin/features ──────────────────────────────────
// Lista todas las feature_definitions
export async function GET() {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("feature_definitions")
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("[GET features]", error);
      return NextResponse.json({ error: "Error al obtener features" }, { status: 500 });
    }

    return NextResponse.json({ features: data });
  } catch (err) {
    console.error("[GET features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── POST /api/admin/features ─────────────────────────────────
// Crea una nueva feature
const createFeatureSchema = z.object({
  key: z.string().min(1).regex(/^[a-z_]+$/, "Solo letras minúsculas y guiones bajos"),
  label: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = createFeatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("feature_definitions")
      .insert(parsed.data)
      .select()
      .single();

    if (error) {
      console.error("[POST features]", error);
      if (error.message?.includes("duplicate key")) {
        return NextResponse.json({ error: "Ya existe una feature con esa key" }, { status: 409 });
      }
      return NextResponse.json({ error: "Error al crear feature" }, { status: 500 });
    }

    return NextResponse.json({ feature: data }, { status: 201 });
  } catch (err) {
    console.error("[POST features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── PUT /api/admin/features ──────────────────────────────────
// Edita una feature existente
const updateFeatureSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().optional(),
});

export async function PUT(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = updateFeatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updateData } = parsed.data;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("feature_definitions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[PUT features]", error);
      return NextResponse.json({ error: "Error al actualizar feature" }, { status: 500 });
    }

    return NextResponse.json({ feature: data });
  } catch (err) {
    console.error("[PUT features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// ─── DELETE /api/admin/features ───────────────────────────────
const deleteSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: NextRequest) {
  const authResult = await verifyAdminAuth("superadmin");
  if ("error" in authResult) return authResult.error;

  try {
    const body = await request.json();
    const parsed = deleteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin
      .from("feature_definitions")
      .delete()
      .eq("id", parsed.data.id);

    if (error) {
      console.error("[DELETE features]", error);
      return NextResponse.json({ error: "Error al eliminar feature" }, { status: 500 });
    }

    return NextResponse.json({ message: "Feature eliminada" });
  } catch (err) {
    console.error("[DELETE features]", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
