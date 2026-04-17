"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (accessUntil: string | null) => void;
  /** Fecha hasta la cual conservará acceso (ISO) */
  accessUntil: string | null;
}

const REASONS: Array<{ value: string; label: string }> = [
  { value: "price_too_high", label: "El precio es muy alto" },
  { value: "not_using", label: "No la uso lo suficiente" },
  { value: "missing_features", label: "Faltan funcionalidades que necesito" },
  { value: "switched_platform", label: "Cambié a otra plataforma" },
  { value: "closed_business", label: "Cerré mi práctica / negocio" },
  { value: "technical_issues", label: "Tuve problemas técnicos o bugs" },
  { value: "other", label: "Otro motivo" },
];

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  onCancelled,
  accessUntil,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState<string>("");
  const [feedback, setFeedback] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason) {
      toast.error("Seleccioná un motivo");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          feedback: feedback.trim() || null,
        }),
      });
      const data = (await res.json()) as { access_until?: string | null; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Error al cancelar");
      toast.success("Tu suscripción fue dada de baja.");
      onCancelled(data.access_until ?? null);
      onOpenChange(false);
      setReason("");
      setFeedback("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setLoading(false);
    }
  };

  const accessUntilStr = accessUntil
    ? new Date(accessUntil).toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)} className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Dar de baja mi suscripción
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {accessUntilStr && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Vas a conservar acceso completo hasta el <strong>{accessUntilStr}</strong>.
              Después de esa fecha tu cuenta pasa a modo solo lectura.
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">
              ¿Por qué querés dar de baja? <span className="text-red-500">*</span>
            </p>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 cursor-pointer transition-colors text-sm ${
                    reason === r.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                    className="h-4 w-4 text-primary"
                  />
                  <span>{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">
              ¿Querés contarnos algo más? <span className="text-xs text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Nos ayuda mucho saber qué podemos mejorar."
              maxLength={1000}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Volver
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={loading || !reason}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar baja
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
