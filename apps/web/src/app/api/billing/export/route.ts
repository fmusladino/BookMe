export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import PDFDocument from "pdfkit";

interface BillingRow {
  id: string;
  amount: number;
  practice_code: string;
  practice_name: string;
  status: string;
  created_at: string;
  patient?: { full_name: string; dni?: string; insurance_number?: string };
  insurance?: { name: string };
  appointment?: { starts_at: string };
}

function formatDateES(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return isoDate;
  }
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * GET /api/billing/export — Exportar reporte de facturación como PDF
 * Query params:
 *   - from=YYYY-MM-DD
 *   - to=YYYY-MM-DD
 *   - insurance_id=uuid
 *   - status=pending|submitted|paid
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "professional") {
      return NextResponse.json(
        { error: "Solo profesionales pueden exportar facturación" },
        { status: 403 }
      );
    }

    // Datos del profesional
    const { data: professional } = await supabase
      .from("professionals")
      .select("specialty, license_number, city")
      .eq("id", user.id)
      .single();

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const insurance_id = searchParams.get("insurance_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("billing_items")
      .select(
        `id, amount, practice_code, practice_name, status, created_at,
        patient:patients(full_name, dni, insurance_number),
        insurance:insurances(name),
        appointment:appointments(starts_at)`
      )
      .eq("professional_id", user.id)
      .order("created_at", { ascending: true });

    if (from && to) {
      query = query.gte("created_at", `${from}T00:00:00`).lte("created_at", `${to}T23:59:59`);
    } else if (from) {
      query = query.gte("created_at", `${from}T00:00:00`);
    } else if (to) {
      query = query.lte("created_at", `${to}T23:59:59`);
    }

    if (insurance_id) query = query.eq("insurance_id", insurance_id);
    if (status && ["pending", "submitted", "paid"].includes(status)) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching billing items for export:", error.message);
      return NextResponse.json({ error: "Error al obtener datos" }, { status: 500 });
    }

    const items = (data || []) as BillingRow[];

    if (items.length === 0) {
      return NextResponse.json({ error: "No hay items para exportar en este rango" }, { status: 404 });
    }

    // Agrupar por prepaga
    const grouped: Record<string, { name: string; items: BillingRow[]; total: number }> = {};
    items.forEach((item) => {
      const name = item.insurance?.name || "Particular";
      if (!grouped[name]) grouped[name] = { name, items: [], total: 0 };
      grouped[name].items.push(item);
      grouped[name].total += Number(item.amount);
    });

    const grandTotal = items.reduce((s, i) => s + Number(i.amount), 0);

    // Generar PDF
    const pdfBuffer = await generateBillingPDF({
      professionalName: profile.full_name || "Profesional",
      specialty: professional?.specialty || "",
      license: professional?.license_number || "",
      city: professional?.city || "",
      dateFrom: from || "",
      dateTo: to || "",
      grouped,
      grandTotal,
      totalItems: items.length,
    });

    const dateStr = from && to ? `${from}_a_${to}` : new Date().toISOString().slice(0, 10);
    const filename = `Facturacion_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error GET /api/billing/export:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// --- PDF Generation ---

interface BillingPDFData {
  professionalName: string;
  specialty: string;
  license: string;
  city: string;
  dateFrom: string;
  dateTo: string;
  grouped: Record<string, { name: string; items: BillingRow[]; total: number }>;
  grandTotal: number;
  totalItems: number;
}

async function generateBillingPDF(data: BillingPDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      info: {
        Title: `Facturación - ${data.professionalName}`,
        Author: data.professionalName,
        Subject: "Reporte de Facturación",
        Creator: "BookMe - Gestión de Turnos",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;

    // Header bar
    doc.rect(0, 0, doc.page.width, 6).fill("#1a1f36");

    // Logo
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#1a1f36").text("BookMe", leftMargin, 22);
    doc.font("Helvetica").fontSize(8).fillColor("#6b7280").text("Reporte de Facturación", leftMargin, 44);

    // Emission date (right)
    doc.font("Helvetica").fontSize(8).fillColor("#9ca3af")
      .text(`Emitido: ${formatDateES(new Date().toISOString())}`, leftMargin, 22, { width: pageWidth, align: "right" });

    // Line
    doc.moveTo(leftMargin, 58).lineTo(leftMargin + pageWidth, 58).strokeColor("#e5e7eb").lineWidth(1).stroke();

    let y = 68;

    // Title
    const periodText = data.dateFrom && data.dateTo
      ? `Período: ${formatDateES(data.dateFrom + "T00:00:00")} al ${formatDateES(data.dateTo + "T00:00:00")}`
      : "Todos los períodos";

    doc.font("Helvetica-Bold").fontSize(13).fillColor("#1a1f36")
      .text("LIQUIDACIÓN DE OBRAS SOCIALES Y PREPAGAS", leftMargin, y, { width: pageWidth, align: "center" });
    y += 18;
    doc.font("Helvetica").fontSize(9).fillColor("#6b7280")
      .text(periodText, leftMargin, y, { width: pageWidth, align: "center" });
    y += 20;

    // Professional info
    const profInfo = [data.professionalName, data.specialty, data.license ? `Mat. ${data.license}` : "", data.city].filter(Boolean).join(" — ");
    doc.font("Helvetica").fontSize(8).fillColor("#374151").text(profInfo, leftMargin, y);
    y += 18;

    // Line
    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).strokeColor("#d1d5db").lineWidth(0.5).stroke();
    y += 10;

    // Column widths for landscape A4
    const cols = {
      date: 70,
      patient: 150,
      dni: 80,
      affiliate: 90,
      practice: 140,
      amount: 80,
      status: 70,
    };

    // Iterate each insurance group
    for (const [, group] of Object.entries(data.grouped)) {
      // Check page space
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 40;
      }

      // Insurance header
      doc.roundedRect(leftMargin, y, pageWidth, 22, 3).fill("#f0f4ff");
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e40af")
        .text(group.name, leftMargin + 10, y + 5);
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1e40af")
        .text(`${group.items.length} consultas — Subtotal: ${formatCurrency(group.total)}`, leftMargin + 10, y + 5, { width: pageWidth - 20, align: "right" });
      y += 28;

      // Table header
      let x = leftMargin;
      doc.font("Helvetica-Bold").fontSize(7).fillColor("#6b7280");
      doc.text("FECHA", x, y); x += cols.date;
      doc.text("PACIENTE", x, y); x += cols.patient;
      doc.text("DNI", x, y); x += cols.dni;
      doc.text("Nº AFILIADO", x, y); x += cols.affiliate;
      doc.text("PRÁCTICA", x, y); x += cols.practice;
      doc.text("VALOR", x, y, { width: cols.amount, align: "right" }); x += cols.amount;
      doc.text("ESTADO", x, y, { width: cols.status, align: "center" });
      y += 12;

      doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      y += 5;

      // Table rows
      for (const item of group.items) {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 40;
        }

        const dateStr = item.appointment?.starts_at
          ? formatDateES(item.appointment.starts_at)
          : formatDateES(item.created_at);

        x = leftMargin;
        doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
        doc.text(dateStr, x, y); x += cols.date;
        doc.text(item.patient?.full_name || "—", x, y, { width: cols.patient - 5 }); x += cols.patient;
        doc.font("Helvetica").fontSize(7).fillColor("#4b5563");
        doc.text(item.patient?.dni || "—", x, y); x += cols.dni;
        doc.text(item.patient?.insurance_number || "—", x, y); x += cols.affiliate;
        doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
        doc.text(item.practice_name, x, y, { width: cols.practice - 5 }); x += cols.practice;
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#1f2937");
        doc.text(formatCurrency(Number(item.amount)), x, y, { width: cols.amount, align: "right" }); x += cols.amount;

        const statusLabel = item.status === "pending" ? "Pendiente" : item.status === "submitted" ? "Presentado" : "Cobrado";
        const statusColor = item.status === "pending" ? "#d97706" : item.status === "submitted" ? "#2563eb" : "#16a34a";
        doc.font("Helvetica").fontSize(7).fillColor(statusColor);
        doc.text(statusLabel, x, y, { width: cols.status, align: "center" });

        y += 14;
      }

      // Subtotal line
      doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).strokeColor("#d1d5db").lineWidth(0.5).stroke();
      y += 5;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#1e40af")
        .text(`Subtotal ${group.name}: ${formatCurrency(group.total)}`, leftMargin, y, { width: pageWidth, align: "right" });
      y += 20;
    }

    // Grand total
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }

    doc.moveTo(leftMargin, y).lineTo(leftMargin + pageWidth, y).strokeColor("#1a1f36").lineWidth(1.5).stroke();
    y += 8;

    doc.roundedRect(leftMargin, y, pageWidth, 30, 4).fill("#1a1f36");
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff")
      .text("TOTAL GENERAL", leftMargin + 15, y + 8);
    doc.font("Helvetica-Bold").fontSize(14).fillColor("#ffffff")
      .text(formatCurrency(data.grandTotal), leftMargin + 15, y + 7, { width: pageWidth - 30, align: "right" });
    y += 36;

    doc.font("Helvetica").fontSize(8).fillColor("#6b7280")
      .text(`${data.totalItems} consultas en total — ${Object.keys(data.grouped).length} prepagas`, leftMargin, y);
    y += 20;

    // Summary table
    if (Object.keys(data.grouped).length > 1) {
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 40;
      }

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1f36").text("RESUMEN POR PREPAGA", leftMargin, y);
      y += 16;

      // Header
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#6b7280");
      doc.text("PREPAGA", leftMargin, y);
      doc.text("CONSULTAS", leftMargin + 300, y, { width: 80, align: "center" });
      doc.text("TOTAL", leftMargin + 400, y, { width: 100, align: "right" });
      y += 12;
      doc.moveTo(leftMargin, y).lineTo(leftMargin + 500, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      y += 5;

      for (const [, group] of Object.entries(data.grouped)) {
        doc.font("Helvetica").fontSize(9).fillColor("#1f2937");
        doc.text(group.name, leftMargin, y);
        doc.text(String(group.items.length), leftMargin + 300, y, { width: 80, align: "center" });
        doc.font("Helvetica-Bold").fontSize(9).fillColor("#1f2937");
        doc.text(formatCurrency(group.total), leftMargin + 400, y, { width: 100, align: "right" });
        y += 14;
      }

      doc.moveTo(leftMargin, y).lineTo(leftMargin + 500, y).strokeColor("#1a1f36").lineWidth(1).stroke();
      y += 5;
      doc.font("Helvetica-Bold").fontSize(10).fillColor("#1a1f36");
      doc.text("TOTAL", leftMargin, y);
      doc.text(String(data.totalItems), leftMargin + 300, y, { width: 80, align: "center" });
      doc.text(formatCurrency(data.grandTotal), leftMargin + 400, y, { width: 100, align: "right" });
    }

    // Footer
    y = doc.page.height - 40;
    doc.font("Helvetica").fontSize(7).fillColor("#9ca3af")
      .text("Documento generado por BookMe. Este reporte es un documento informativo y no constituye factura fiscal.", leftMargin, y, { width: pageWidth });

    doc.end();
  });
}
