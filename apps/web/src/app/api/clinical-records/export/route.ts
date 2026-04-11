import { NextResponse, type NextRequest } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { decryptClinicalRecord } from "@/lib/crypto/clinical-record";
import PDFDocument from "pdfkit";

/**
 * GET /api/clinical-records/export
 * Genera un PDF con la historia clínica de un paciente.
 *
 * Query params:
 *   - patient_id (requerido): UUID del paciente
 *   - record_id (opcional): UUID de un registro específico. Si se omite, exporta toda la historia.
 *   - role (opcional): "patient" para acceso desde portal del paciente. Default: "professional"
 *
 * Acceso:
 *   - Profesional: puede exportar HC de sus pacientes
 *   - Paciente: puede exportar su propia HC (Ley 26.529)
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

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get("patient_id");
    const recordId = searchParams.get("record_id");
    const role = searchParams.get("role") || "professional";

    if (!patientId) {
      return NextResponse.json({ error: "patient_id es requerido" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Determinar professional_id según el rol
    let professionalId: string;
    let patientName = "Paciente";
    let patientDni = "";

    if (role === "patient") {
      // El usuario es paciente — buscar su registro de paciente y el profesional asociado
      const { data: patientRecord } = await admin
        .from("patients")
        .select("id, full_name, dni, professional_id")
        .eq("id", patientId)
        .eq("profile_id", user.id)
        .single();

      if (!patientRecord) {
        return NextResponse.json(
          { error: "No tenés acceso a esta historia clínica" },
          { status: 403 }
        );
      }

      professionalId = patientRecord.professional_id;
      patientName = patientRecord.full_name || "Paciente";
      patientDni = patientRecord.dni || "";
    } else {
      // El usuario es profesional
      professionalId = user.id;

      // Verificar que tiene acceso a este paciente
      const { data: patientAccess } = await admin
        .from("appointments")
        .select("id")
        .eq("professional_id", user.id)
        .eq("patient_id", patientId)
        .limit(1);

      if (!patientAccess || patientAccess.length === 0) {
        return NextResponse.json(
          { error: "No tienes acceso a los registros de este paciente" },
          { status: 403 }
        );
      }

      // Obtener datos del paciente
      const { data: patient } = await admin
        .from("patients")
        .select("full_name, dni, phone")
        .eq("id", patientId)
        .single();

      if (patient) {
        patientName = patient.full_name || "Paciente";
        patientDni = patient.dni || "";
      }
    }

    // Obtener datos del profesional
    const { data: professional } = await admin
      .from("professionals")
      .select("specialty, license_number, city, profile:profiles!id(full_name)")
      .eq("id", professionalId)
      .single();

    const professionalName = professional?.profile
      ? (Array.isArray(professional.profile)
          ? professional.profile[0]?.full_name
          : (professional.profile as { full_name: string })?.full_name) || "Profesional"
      : "Profesional";

    // Obtener registros clínicos encriptados (excluir archivados en historial completo)
    let query = admin
      .from("clinical_records")
      .select("id, content_encrypted, iv, appointment_id, is_amendment, amends_record_id, created_at, updated_at")
      .eq("professional_id", professionalId)
      .eq("patient_id", patientId)
      .eq("is_archived", false)
      .order("created_at", { ascending: true });

    if (recordId) {
      query = query.eq("id", recordId);
    }

    const { data: encryptedRecords, error: fetchError } = await query as Promise<{
      data: Array<{
        id: string;
        content_encrypted: string;
        iv: string;
        appointment_id: string | null;
        is_amendment: boolean;
        amends_record_id: string | null;
        created_at: string;
        updated_at: string;
      }> | null;
      error: any;
    }>;

    if (fetchError) {
      console.error("Error fetching clinical records for export:", fetchError.message);
      return NextResponse.json({ error: "Error al obtener registros" }, { status: 500 });
    }

    if (!encryptedRecords || encryptedRecords.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron registros clínicos" },
        { status: 404 }
      );
    }

    // Desencriptar todos los registros
    const records = await Promise.all(
      encryptedRecords.map(async (record) => {
        try {
          const content = await decryptClinicalRecord(record.content_encrypted, record.iv);
          return {
            id: record.id,
            content,
            appointment_id: record.appointment_id,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };
        } catch {
          return {
            id: record.id,
            content: "[Error al desencriptar este registro]",
            appointment_id: record.appointment_id,
            created_at: record.created_at,
            updated_at: record.updated_at,
          };
        }
      })
    );

    // Registrar acceso en auditoría (export = read)
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "0.0.0.0";

    for (const record of records) {
      await admin
        .from("clinical_record_audit")
        .insert({
          record_id: record.id,
          accessed_by: user.id,
          action: "export",
          ip_address: ipAddress,
        })
        .catch((err) => {
          console.error(`Error auditoría export para ${record.id}:`, err);
        });
    }

    // Generar PDF
    const pdfBuffer = await generatePDF({
      patientName,
      patientDni,
      professionalName,
      professionalSpecialty: professional?.specialty || "",
      professionalLicense: professional?.license_number || "",
      professionalCity: professional?.city || "",
      records,
      isSingleRecord: !!recordId,
    });

    // Nombre del archivo
    const sanitizedName = patientName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, "").replace(/\s+/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = recordId
      ? `HC_${sanitizedName}_entrada_${dateStr}.pdf`
      : `HC_${sanitizedName}_completa_${dateStr}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error GET /api/clinical-records/export:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// --- Generación del PDF ---

interface PDFRecord {
  id: string;
  content: string;
  appointment_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PDFData {
  patientName: string;
  patientDni: string;
  professionalName: string;
  professionalSpecialty: string;
  professionalLicense: string;
  professionalCity: string;
  records: PDFRecord[];
  isSingleRecord: boolean;
}

function formatDateES(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    };
    return d.toLocaleDateString("es-AR", options);
  } catch {
    return isoDate;
  }
}

async function generatePDF(data: PDFData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 60, bottom: 60, left: 50, right: 50 },
      info: {
        Title: `Historia Clínica - ${data.patientName}`,
        Author: data.professionalName,
        Subject: "Historia Clínica Digital",
        Creator: "BookMe - Gestión de Turnos",
      },
    });

    const chunks: Uint8Array[] = [];
    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // === HEADER ===
    // Línea superior color BookMe navy
    doc.rect(0, 0, doc.page.width, 8).fill("#1a1f36");

    // Logo / Título
    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#1a1f36")
      .text("BookMe", 50, 30);

    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text("Gestión de Turnos y Agenda", 50, 55);

    // Fecha de emisión (derecha)
    const emissionDate = formatDateES(new Date().toISOString());
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#9ca3af")
      .text(`Emitido: ${emissionDate}`, 50, 30, {
        width: pageWidth,
        align: "right",
      });

    // Línea separadora
    doc
      .moveTo(50, 75)
      .lineTo(50 + pageWidth, 75)
      .strokeColor("#e5e7eb")
      .lineWidth(1)
      .stroke();

    let y = 90;

    // === TÍTULO DEL DOCUMENTO ===
    const title = data.isSingleRecord
      ? "REGISTRO DE HISTORIA CLÍNICA"
      : "HISTORIA CLÍNICA COMPLETA";

    doc
      .font("Helvetica-Bold")
      .fontSize(14)
      .fillColor("#1a1f36")
      .text(title, 50, y, { width: pageWidth, align: "center" });

    y += 30;

    // === DATOS DEL PACIENTE ===
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#1a1f36")
      .text("DATOS DEL PACIENTE", 50, y);

    y += 16;

    // Recuadro datos paciente
    const patientBoxHeight = data.patientDni ? 50 : 35;
    doc
      .roundedRect(50, y, pageWidth, patientBoxHeight, 4)
      .fillAndStroke("#f9fafb", "#e5e7eb");

    y += 10;
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#374151")
      .text(`Nombre: ${data.patientName}`, 62, y);

    if (data.patientDni) {
      y += 16;
      doc.text(`DNI: ${data.patientDni}`, 62, y);
    }

    y += 28;

    // === DATOS DEL PROFESIONAL ===
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#1a1f36")
      .text("PROFESIONAL RESPONSABLE", 50, y);

    y += 16;

    const profLines = [
      data.professionalName,
      data.professionalSpecialty ? `Especialidad: ${data.professionalSpecialty}` : "",
      data.professionalLicense ? `Matrícula: ${data.professionalLicense}` : "",
      data.professionalCity ? `Localidad: ${data.professionalCity}` : "",
    ].filter(Boolean);

    const profBoxHeight = 12 + profLines.length * 16;
    doc
      .roundedRect(50, y, pageWidth, profBoxHeight, 4)
      .fillAndStroke("#f9fafb", "#e5e7eb");

    y += 10;
    doc.font("Helvetica").fontSize(9).fillColor("#374151");
    for (const line of profLines) {
      doc.text(line, 62, y);
      y += 16;
    }

    y += 12;

    // === REGISTROS CLÍNICOS ===
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#1a1f36")
      .text(
        data.isSingleRecord
          ? "REGISTRO CLÍNICO"
          : `REGISTROS CLÍNICOS (${data.records.length} ${data.records.length === 1 ? "entrada" : "entradas"})`,
        50,
        y
      );

    y += 20;

    // Separador
    doc
      .moveTo(50, y)
      .lineTo(50 + pageWidth, y)
      .strokeColor("#d1d5db")
      .lineWidth(0.5)
      .stroke();

    y += 10;

    // Iterar cada registro
    for (let i = 0; i < data.records.length; i++) {
      const record = data.records[i];

      // Verificar si necesitamos nueva página
      if (y > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }

      // Número de entrada y fecha
      const entryLabel = data.isSingleRecord
        ? "Entrada"
        : `Entrada ${i + 1} de ${data.records.length}`;

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#1a1f36")
        .text(entryLabel, 50, y);

      y += 14;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#6b7280")
        .text(`Fecha: ${formatDateES(record.created_at)}`, 50, y);

      if (record.updated_at && record.updated_at !== record.created_at) {
        y += 12;
        doc.text(`Última modificación: ${formatDateES(record.updated_at)}`, 50, y);
      }

      y += 18;

      // Contenido del registro
      doc.font("Helvetica").fontSize(9).fillColor("#1f2937");

      // Calcular alto del texto para saber si necesitamos nueva página
      const textHeight = doc.heightOfString(record.content, {
        width: pageWidth - 20,
      });

      if (y + textHeight > doc.page.height - 80) {
        // Si el texto es muy largo, hacemos wrap con paginación
        doc.text(record.content, 60, y, {
          width: pageWidth - 20,
          lineGap: 3,
        });
        y = doc.y + 15;
      } else {
        doc.text(record.content, 60, y, {
          width: pageWidth - 20,
          lineGap: 3,
        });
        y = doc.y + 15;
      }

      // Separador entre registros
      if (i < data.records.length - 1) {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        doc
          .moveTo(70, y)
          .lineTo(50 + pageWidth - 20, y)
          .strokeColor("#e5e7eb")
          .lineWidth(0.5)
          .stroke();
        y += 15;
      }
    }

    // === FOOTER: Aviso legal ===
    // Verificar espacio para footer
    if (y > doc.page.height - 130) {
      doc.addPage();
      y = 50;
    }

    y += 20;
    doc
      .moveTo(50, y)
      .lineTo(50 + pageWidth, y)
      .strokeColor("#d1d5db")
      .lineWidth(0.5)
      .stroke();

    y += 12;

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#9ca3af")
      .text(
        "AVISO LEGAL: Este documento contiene información clínica confidencial protegida por la " +
          "Ley 26.529 de Derechos del Paciente (Argentina). La historia clínica es propiedad del " +
          "paciente y su contenido es confidencial. Queda prohibida su divulgación a terceros sin " +
          "el consentimiento expreso del paciente, salvo las excepciones previstas por ley.",
        50,
        y,
        { width: pageWidth, lineGap: 2 }
      );

    y = doc.y + 10;

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#9ca3af")
      .text(
        "Documento generado digitalmente por BookMe. Los registros clínicos se almacenan " +
          "encriptados con AES-256-GCM y son desencriptados exclusivamente al momento de la " +
          "exportación autorizada.",
        50,
        y,
        { width: pageWidth, lineGap: 2 }
      );

    y = doc.y + 8;

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#b0b0b0")
      .text(`ID de exportación: ${crypto.randomUUID()} | ${new Date().toISOString()}`, 50, y, {
        width: pageWidth,
        align: "center",
      });

    doc.end();
  });
}
