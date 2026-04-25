"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  Clock,
  CreditCard,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface OverdueProfessional {
  professional_id: string;
  full_name: string;
  email: string | null;
  subscription_plan: string;
  subscription_status: "past_due" | "read_only";
  past_due_since: string;
  days_overdue: number;
  last_payment_id: string | null;
  last_payment_amount: number | null;
  last_failure_reason: string | null;
  last_attempt_at: string | null;
  last_reminder_kind: "soft" | "firm" | "final" | "read_only" | null;
  last_reminder_at: string | null;
}

interface Buckets {
  total: number;
  day_0_6: number;
  day_7_9: number;
  day_10_13: number;
  day_14_plus: number;
  read_only: number;
}

const REMINDER_LABEL: Record<string, string> = {
  soft: "Día 7 — Amable",
  firm: "Día 10 — Firme",
  final: "Día 14 — Final",
  read_only: "Día 15 — Solo lectura",
};

const REMINDER_BADGE: Record<string, string> = {
  soft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  firm: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  final: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  read_only: "bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-200",
};

// ─── Page ───────────────────────────────────────────────────

export default function CobrosPage() {
  const [overdue, setOverdue] = useState<OverdueProfessional[]>([]);
  const [buckets, setBuckets] = useState<Buckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/billing/overdue");
      if (!res.ok) throw new Error("Error al consultar cobros");
      const data = await res.json();
      setOverdue(data.overdue ?? []);
      setBuckets(data.buckets ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Cobros y Mora
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profesionales con pagos atrasados — recordatorios automáticos día 7 / 10 / 14, modo solo lectura día 15.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* KPIs por bucket */}
      <div className="grid gap-3 md:grid-cols-5">
        <KPI label="Total en mora" value={buckets?.total ?? 0} icon={CreditCard} color="text-foreground" bg="bg-muted/40" />
        <KPI label="Días 0–6 (pre-aviso)" value={buckets?.day_0_6 ?? 0} icon={Clock} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-950/40" />
        <KPI label="Días 7–9 (soft)" value={buckets?.day_7_9 ?? 0} icon={AlertTriangle} color="text-amber-600" bg="bg-amber-50 dark:bg-amber-950/40" />
        <KPI label="Días 10–13 (firme)" value={buckets?.day_10_13 ?? 0} icon={AlertTriangle} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-950/40" />
        <KPI label="Día 14+ / Solo lectura" value={(buckets?.day_14_plus ?? 0) + (buckets?.read_only ?? 0)} icon={AlertOctagon} color="text-red-600" bg="bg-red-50 dark:bg-red-950/40" />
      </div>

      {/* Tabla principal */}
      <Card>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : overdue.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-foreground">
              Todo al día
            </p>
            <p className="text-sm text-muted-foreground">
              No hay profesionales con pagos atrasados en este momento.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Profesional</th>
                  <th className="px-4 py-3 text-left font-medium">Plan</th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Días en mora</th>
                  <th className="px-4 py-3 text-right font-medium">Monto</th>
                  <th className="px-4 py-3 text-left font-medium">Último intento</th>
                  <th className="px-4 py-3 text-left font-medium">Último recordatorio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {overdue.map((o, idx) => (
                  <tr
                    key={o.professional_id}
                    className={`transition-colors hover:bg-muted/40 ${idx % 2 === 0 ? "bg-muted/20" : "bg-background"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{o.full_name}</div>
                      {o.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {o.email}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 capitalize">{o.subscription_plan}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                          o.subscription_status === "read_only"
                            ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300"
                        }`}
                      >
                        {o.subscription_status === "read_only" ? "Solo lectura" : "Pago atrasado"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      <span
                        className={
                          o.days_overdue >= 14
                            ? "font-bold text-red-600"
                            : o.days_overdue >= 10
                            ? "font-bold text-orange-600"
                            : o.days_overdue >= 7
                            ? "font-bold text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        {o.days_overdue} días
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {o.last_payment_amount !== null
                        ? `ARS ${o.last_payment_amount.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {o.last_attempt_at
                        ? new Date(o.last_attempt_at).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {o.last_reminder_kind && o.last_reminder_at ? (
                        <div className="flex flex-col gap-1">
                          <span
                            className={`inline-block w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                              REMINDER_BADGE[o.last_reminder_kind] ?? ""
                            }`}
                          >
                            {REMINDER_LABEL[o.last_reminder_kind] ?? o.last_reminder_kind}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(o.last_reminder_at).toLocaleDateString("es-AR")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sin enviar</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Footer informativo */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2 text-foreground">Cómo funciona el flujo</h3>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Cada día 1 del mes, MercadoPago intenta cobrar el abono. Si falla, marca al profesional como <code className="text-xs bg-muted px-1 rounded">past_due</code>.</li>
          <li>Día 7: recordatorio amable por email + WhatsApp.</li>
          <li>Día 10: recordatorio firme con CTA para actualizar medio de pago.</li>
          <li>Día 14: aviso final de suspensión inminente.</li>
          <li>Día 15: la cuenta pasa a <code className="text-xs bg-muted px-1 rounded">read_only</code>: el profesional no recibe nuevos turnos hasta regularizar.</li>
        </ol>
      </Card>
    </div>
  );
}

// ─── KPI tile ───────────────────────────────────────────────

function KPI({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: typeof CreditCard;
  color: string;
  bg: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className={`mt-1.5 text-2xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`${bg} rounded-md p-2`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
    </div>
  );
}
