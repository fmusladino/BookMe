"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@/hooks/use-session";
import { Download, Copy, Check, QrCode, Printer, Smartphone } from "lucide-react";

// ─── QR Code Generator (QR Code Model 2, Error Correction L) ────────
// Implementación compacta sin dependencias externas

// Constantes QR
const EC_L = 1;
const MODE_BYTE = 4;

function generateQR(text: string): boolean[][] {
  // Usamos un approach con la API de canvas + imagen externa para MVP
  // Para producción se puede usar la lib 'qrcode'
  // Por ahora delegamos al componente que usa un servicio inline
  return [];
}

// ─── Componente principal ─────────────────────────────────────────────

export default function QRPage() {
  const { user, loading } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrReady, setQrReady] = useState(false);
  const [qrSize, setQrSize] = useState(280);

  const professional = user?.professional;
  const slug = professional?.public_slug ?? "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://bookme.ar";
  const bookingUrl = `${baseUrl}/book/${slug}`;

  // Generar QR usando canvas + algoritmo simple
  const drawQR = useCallback(() => {
    if (!slug || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Usar imagen desde Google Charts API como fallback simple para MVP
    const img = new Image();
    img.crossOrigin = "anonymous";
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(bookingUrl)}&format=png&margin=10`;

    img.onload = () => {
      canvas.width = qrSize;
      canvas.height = qrSize;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, qrSize, qrSize);
      ctx.drawImage(img, 0, 0, qrSize, qrSize);
      setQrReady(true);
    };

    img.onerror = () => {
      // Fallback: dibujar placeholder
      canvas.width = qrSize;
      canvas.height = qrSize;
      ctx.fillStyle = "#f3f4f6";
      ctx.fillRect(0, 0, qrSize, qrSize);
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Error generando QR", qrSize / 2, qrSize / 2);
      setQrReady(false);
    };

    img.src = qrApiUrl;
  }, [slug, bookingUrl, qrSize]);

  useEffect(() => {
    drawQR();
  }, [drawQR]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = bookingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = (format: "png" | "svg") => {
    if (!canvasRef.current || !qrReady) return;

    if (format === "png") {
      const link = document.createElement("a");
      link.download = `bookme-qr-${slug}.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    }
  };

  const handleDownloadWithBranding = () => {
    if (!canvasRef.current || !qrReady) return;

    // Crear canvas más grande con branding
    const brandCanvas = document.createElement("canvas");
    const padding = 40;
    const textHeight = 80;
    const totalWidth = qrSize + padding * 2;
    const totalHeight = qrSize + padding * 2 + textHeight;

    brandCanvas.width = totalWidth;
    brandCanvas.height = totalHeight;
    const ctx = brandCanvas.getContext("2d");
    if (!ctx) return;

    // Fondo blanco
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    // Borde redondeado (simulado)
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, totalWidth - 2, totalHeight - 2);

    // Título
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Reservá tu turno", totalWidth / 2, padding - 8);

    // QR
    ctx.drawImage(canvasRef.current, padding, padding + 16, qrSize, qrSize);

    // URL debajo
    ctx.fillStyle = "#6b7280";
    ctx.font = "13px system-ui, -apple-system, sans-serif";
    ctx.fillText(bookingUrl, totalWidth / 2, qrSize + padding + 40);

    // Nombre del profesional
    const profName = user?.profile?.full_name ?? slug;
    ctx.fillStyle = "#1e3a5f";
    ctx.font = "bold 15px system-ui, -apple-system, sans-serif";
    ctx.fillText(profName, totalWidth / 2, qrSize + padding + 62);

    // BookMe badge
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText("bookme.ar", totalWidth / 2, totalHeight - 10);

    // Descargar
    const link = document.createElement("a");
    link.download = `bookme-qr-${slug}-tarjeta.png`;
    link.href = brandCanvas.toDataURL("image/png");
    link.click();
  };

  const handlePrint = () => {
    if (!canvasRef.current || !qrReady) return;

    const profName = user?.profile?.full_name ?? slug;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR - ${profName}</title>
        <style>
          body {
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: system-ui, -apple-system, sans-serif;
            background: white;
          }
          .card {
            text-align: center;
            padding: 40px;
            border: 2px solid #e5e7eb;
            border-radius: 16px;
            max-width: 400px;
          }
          .title {
            font-size: 22px;
            font-weight: bold;
            color: #1e3a5f;
            margin-bottom: 20px;
          }
          .qr-img {
            width: ${qrSize}px;
            height: ${qrSize}px;
          }
          .url {
            margin-top: 16px;
            font-size: 13px;
            color: #6b7280;
            word-break: break-all;
          }
          .name {
            margin-top: 8px;
            font-size: 16px;
            font-weight: 600;
            color: #1e3a5f;
          }
          .badge {
            margin-top: 12px;
            font-size: 11px;
            color: #9ca3af;
          }
          @media print {
            body { background: white; }
            .card { border: 1px solid #ccc; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="title">Reservá tu turno</div>
          <img class="qr-img" src="${canvasRef.current.toDataURL("image/png")}" alt="QR Code" />
          <div class="url">${bookingUrl}</div>
          <div class="name">${profName}</div>
          <div class="badge">bookme.ar</div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!professional || !slug) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <QrCode className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p>No se encontró tu perfil profesional.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <QrCode className="h-6 w-6 text-primary" />
          Mi código QR
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Mostrá este QR en tu consultorio para que tus pacientes reserven turnos escaneándolo
        </p>
      </div>

      {/* QR Card */}
      <div className="bg-card border border-border rounded-xl p-6 sm:p-8 flex flex-col items-center gap-6">
        {/* QR Canvas */}
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
          <canvas ref={canvasRef} className="block" />
        </div>

        {/* URL copiable */}
        <div className="w-full flex items-center gap-2 bg-muted/50 rounded-lg px-4 py-3">
          <span className="flex-1 text-sm text-foreground truncate font-mono">
            {bookingUrl}
          </span>
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copiar
              </>
            )}
          </button>
        </div>

        {/* Acciones */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleDownload("png")}
            disabled={!qrReady}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Descargar QR
          </button>

          <button
            onClick={handleDownloadWithBranding}
            disabled={!qrReady}
            className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            <Smartphone className="h-4 w-4" />
            Con tarjeta
          </button>

          <button
            onClick={handlePrint}
            disabled={!qrReady}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-300">
          Ideas para usar tu QR
        </h3>
        <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-2">
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">1.</span>
            <span>Imprimilo y pegalo en la recepción de tu consultorio o negocio</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">2.</span>
            <span>Descargá la tarjeta con branding y compartila por WhatsApp o redes sociales</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">3.</span>
            <span>Agregalo a tus tarjetas personales o folletos</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold mt-0.5">4.</span>
            <span>Mostralo en la pantalla de espera de tu consultorio</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
