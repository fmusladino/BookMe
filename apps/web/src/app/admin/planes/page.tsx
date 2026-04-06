"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DollarSign,
  ToggleLeft,
  Plus,
  Save,
  Loader2,
  X,
  Pencil,
  Trash2,
  Check,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────

interface PlanPrice {
  id: string;
  line: "healthcare" | "business";
  plan: "free" | "base" | "standard" | "premium";
  billing_cycle: "monthly" | "annual";
  price_usd: number;
  is_active: boolean;
}

interface ClinicPlanPrice {
  id: string;
  plan: "small" | "large";
  billing_cycle: "monthly" | "annual";
  price_usd: number;
  is_active: boolean;
}

interface FeatureDefinition {
  id: string;
  key: string;
  label: string;
  description: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
}

interface PlanFeature {
  id: string;
  line: "healthcare" | "business";
  plan: "free" | "base" | "standard" | "premium";
  feature_id: string;
  enabled: boolean;
  feature: {
    id: string;
    key: string;
    label: string;
    category: string;
    sort_order: number;
    is_active: boolean;
  };
}

// ─── Constants ──────────────────────────────────────────────

const LINES = [
  { value: "healthcare", label: "Healthcare", color: "blue" },
  { value: "business", label: "Business", color: "emerald" },
] as const;

const PLANS = ["free", "base", "standard", "premium"] as const;

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  base: "Base",
  standard: "Standard",
  premium: "Premium",
};

const CLINIC_PLANS = ["small", "large"] as const;

const CLINIC_PLAN_LABELS: Record<string, string> = {
  small: "Pequeño (≤10 profes)",
  large: "Grande (11+ profes)",
};

const CATEGORY_LABELS: Record<string, string> = {
  mia: "MIA (Asistente IA)",
  notificaciones: "Notificaciones",
  metricas: "Métricas",
  facturacion: "Facturación",
  servicios: "Servicios",
  agenda: "Agenda",
  marketing: "Marketing",
  general: "General",
};

const TABS = [
  { key: "precios", label: "Precios", icon: DollarSign },
  { key: "features", label: "Features por Plan", icon: ToggleLeft },
] as const;

// ─── Page ───────────────────────────────────────────────────

export default function PlanesPage() {
  const [activeTab, setActiveTab] = useState<"precios" | "features">("precios");

  // Precios state
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [clinicPrices, setClinicPrices] = useState<ClinicPlanPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [editingPrice, setEditingPrice] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  // Features state
  const [features, setFeatures] = useState<FeatureDefinition[]>([]);
  const [planFeatures, setPlanFeatures] = useState<PlanFeature[]>([]);
  const [loadingFeatures, setLoadingFeatures] = useState(true);
  const [selectedLine, setSelectedLine] = useState<"healthcare" | "business" | "consultorio">("healthcare");
  const [togglingFeature, setTogglingFeature] = useState<string | null>(null);

  // Feature CRUD state
  const [showNewFeature, setShowNewFeature] = useState(false);
  const [newFeature, setNewFeature] = useState({ key: "", label: "", description: "", category: "general" });
  const [savingFeature, setSavingFeature] = useState(false);

  // ─── Fetch data ─────────────────────────────────────────

  const fetchPrices = useCallback(async () => {
    try {
      const [planRes, clinicRes] = await Promise.all([
        fetch("/api/admin/plans"),
        fetch("/api/admin/clinic-plans"),
      ]);
      if (!planRes.ok) throw new Error("Error");
      const planData = await planRes.json();
      setPrices(planData.plans ?? []);

      if (clinicRes.ok) {
        const clinicData = await clinicRes.json();
        setClinicPrices(clinicData.prices ?? []);
      }
    } catch {
      toast.error("Error al cargar precios");
    } finally {
      setLoadingPrices(false);
    }
  }, []);

  const fetchFeatures = useCallback(async () => {
    try {
      const [featRes, pfRes] = await Promise.all([
        fetch("/api/admin/features"),
        fetch("/api/admin/plan-features"),
      ]);
      if (!featRes.ok || !pfRes.ok) throw new Error("Error");

      const featData = await featRes.json();
      const pfData = await pfRes.json();
      setFeatures(featData.features ?? []);
      setPlanFeatures(pfData.planFeatures ?? []);
    } catch {
      toast.error("Error al cargar features");
    } finally {
      setLoadingFeatures(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrices();
    void fetchFeatures();
  }, [fetchPrices, fetchFeatures]);

  // ─── Price handlers ─────────────────────────────────────

  const handleSavePrice = async (price: PlanPrice) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Precio inválido");
      return;
    }

    setSavingPrice(true);
    try {
      const res = await fetch("/api/admin/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: price.id, price_usd: newPrice }),
      });
      if (!res.ok) throw new Error("Error");

      setPrices((prev) =>
        prev.map((p) => (p.id === price.id ? { ...p, price_usd: newPrice } : p))
      );
      setEditingPrice(null);
      toast.success("Precio actualizado");
    } catch {
      toast.error("Error al guardar precio");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleSaveClinicPrice = async (price: ClinicPlanPrice) => {
    const newPrice = parseFloat(editValue);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Precio inválido");
      return;
    }

    setSavingPrice(true);
    try {
      const res = await fetch("/api/admin/clinic-plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: price.id, price_usd: newPrice }),
      });
      if (!res.ok) throw new Error("Error");

      setClinicPrices((prev) =>
        prev.map((p) => (p.id === price.id ? { ...p, price_usd: newPrice } : p))
      );
      setEditingPrice(null);
      toast.success("Precio de consultorio actualizado");
    } catch {
      toast.error("Error al guardar precio");
    } finally {
      setSavingPrice(false);
    }
  };

  // ─── Feature toggle handler ─────────────────────────────

  const handleToggleFeature = async (
    featureId: string,
    plan: string,
    currentEnabled: boolean
  ) => {
    const key = `${selectedLine}-${plan}-${featureId}`;
    setTogglingFeature(key);

    try {
      const res = await fetch("/api/admin/plan-features", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line: selectedLine,
          plan,
          feature_id: featureId,
          enabled: !currentEnabled,
        }),
      });
      if (!res.ok) throw new Error("Error");

      setPlanFeatures((prev) =>
        prev.map((pf) =>
          pf.line === selectedLine && pf.plan === plan && pf.feature_id === featureId
            ? { ...pf, enabled: !currentEnabled }
            : pf
        )
      );
    } catch {
      toast.error("Error al actualizar feature");
    } finally {
      setTogglingFeature(null);
    }
  };

  // ─── Create feature handler ─────────────────────────────

  const handleCreateFeature = async () => {
    if (!newFeature.key || !newFeature.label) {
      toast.error("Key y nombre son obligatorios");
      return;
    }

    setSavingFeature(true);
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newFeature),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error");
      }

      toast.success("Feature creada");
      setShowNewFeature(false);
      setNewFeature({ key: "", label: "", description: "", category: "general" });
      void fetchFeatures();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear feature");
    } finally {
      setSavingFeature(false);
    }
  };

  // ─── Delete feature handler ─────────────────────────────

  const handleDeleteFeature = async (id: string, label: string) => {
    if (!confirm(`¿Eliminar la feature "${label}"? Se eliminará de todos los planes.`)) return;

    try {
      const res = await fetch("/api/admin/features", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Error");

      toast.success("Feature eliminada");
      void fetchFeatures();
    } catch {
      toast.error("Error al eliminar feature");
    }
  };

  // ─── Helpers ────────────────────────────────────────────

  const getFeatureEnabled = (featureId: string, plan: string): boolean => {
    const pf = planFeatures.find(
      (p) => p.line === selectedLine && p.plan === plan && p.feature_id === featureId
    );
    return pf?.enabled ?? false;
  };

  const groupedFeatures = features.reduce<Record<string, FeatureDefinition[]>>(
    (acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f);
      return acc;
    },
    {}
  );

  // ─── Render ─────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">
          Gestión de Planes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configurá precios por línea de negocio y asigná features a cada plan
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════ TAB: PRECIOS ═══════════ */}
      {activeTab === "precios" && (
        <div className="space-y-8">
          {loadingPrices ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* ── Healthcare & Business ── */}
              {LINES.map((line) => {
                const linePrices = prices.filter((p) => p.line === line.value);
                return (
                  <Card key={line.value} className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          line.color === "blue"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                        }`}
                      >
                        {line.label}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Plan</th>
                            <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ciclo</th>
                            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Precio USD</th>
                            <th className="text-center py-3 px-2 font-medium text-muted-foreground">Estado</th>
                            <th className="text-right py-3 px-2 font-medium text-muted-foreground">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PLANS.filter((p) => p !== "free").map((planKey) =>
                            (["monthly", "annual"] as const).map((cycle) => {
                              const price = linePrices.find(
                                (p) => p.plan === planKey && p.billing_cycle === cycle
                              );
                              if (!price) return null;
                              const isEditing = editingPrice === price.id;

                              return (
                                <tr key={price.id} className="border-b border-border/50 hover:bg-muted/50">
                                  <td className="py-3 px-2 font-medium">{PLAN_LABELS[planKey]}</td>
                                  <td className="py-3 px-2 text-muted-foreground">
                                    {cycle === "monthly" ? "Mensual" : "Anual"}
                                  </td>
                                  <td className="py-3 px-2 text-right">
                                    {isEditing ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <span className="text-muted-foreground">$</span>
                                        <Input
                                          className="w-24 h-8 text-right text-sm"
                                          type="number"
                                          step="0.01"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") void handleSavePrice(price);
                                            if (e.key === "Escape") setEditingPrice(null);
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <span className="font-semibold">
                                        ${price.price_usd.toFixed(2)}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-center">
                                    <span
                                      className={`inline-block w-2 h-2 rounded-full ${
                                        price.is_active ? "bg-green-500" : "bg-red-500"
                                      }`}
                                    />
                                  </td>
                                  <td className="py-3 px-2 text-right">
                                    {isEditing ? (
                                      <div className="flex items-center justify-end gap-1">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setEditingPrice(null)}
                                          disabled={savingPrice}
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => void handleSavePrice(price)}
                                          disabled={savingPrice}
                                        >
                                          {savingPrice ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <Check className="w-3.5 h-3.5" />
                                          )}
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingPrice(price.id);
                                          setEditValue(price.price_usd.toString());
                                        }}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}

              {/* ── Consultorio ── */}
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    Consultorio
                  </span>
                  <span className="text-xs text-muted-foreground">Solo línea Healthcare</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Plan</th>
                        <th className="text-left py-3 px-2 font-medium text-muted-foreground">Ciclo</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Precio USD</th>
                        <th className="text-center py-3 px-2 font-medium text-muted-foreground">Estado</th>
                        <th className="text-right py-3 px-2 font-medium text-muted-foreground">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicPrices.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-muted-foreground">
                            No hay precios de consultorio. Ejecutá la migración 00015.
                          </td>
                        </tr>
                      ) : (
                        CLINIC_PLANS.map((planKey) =>
                          (["monthly", "annual"] as const).map((cycle) => {
                            const price = clinicPrices.find(
                              (p) => p.plan === planKey && p.billing_cycle === cycle
                            );
                            if (!price) return null;
                            const isEditing = editingPrice === price.id;

                            return (
                              <tr key={price.id} className="border-b border-border/50 hover:bg-muted/50">
                                <td className="py-3 px-2 font-medium">{CLINIC_PLAN_LABELS[planKey]}</td>
                                <td className="py-3 px-2 text-muted-foreground">
                                  {cycle === "monthly" ? "Mensual" : "Anual"}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="text-muted-foreground">$</span>
                                      <Input
                                        className="w-24 h-8 text-right text-sm"
                                        type="number"
                                        step="0.01"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") void handleSaveClinicPrice(price);
                                          if (e.key === "Escape") setEditingPrice(null);
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-semibold">
                                      ${price.price_usd.toFixed(2)}
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${
                                      price.is_active ? "bg-green-500" : "bg-red-500"
                                    }`}
                                  />
                                </td>
                                <td className="py-3 px-2 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingPrice(null)}
                                        disabled={savingPrice}
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => void handleSaveClinicPrice(price)}
                                        disabled={savingPrice}
                                      >
                                        {savingPrice ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Check className="w-3.5 h-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setEditingPrice(price.id);
                                        setEditValue(price.price_usd.toString());
                                      }}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ═══════════ TAB: FEATURES ═══════════ */}
      {activeTab === "features" && (
        <div className="space-y-6">
          {/* Selector de línea + botón nueva feature */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {([
                { value: "healthcare", label: "Healthcare", color: "blue" },
                { value: "business", label: "Business", color: "emerald" },
                { value: "consultorio", label: "Consultorio", color: "purple" },
              ] as const).map((line) => (
                <button
                  key={line.value}
                  onClick={() => setSelectedLine(line.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                    selectedLine === line.value
                      ? line.color === "blue"
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-950/50 dark:text-blue-200"
                        : line.color === "emerald"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/50 dark:text-emerald-200"
                          : "border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-400 dark:bg-purple-950/50 dark:text-purple-200"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {line.label}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => setShowNewFeature(true)}
              className="gap-1"
            >
              <Plus className="w-4 h-4" /> Nueva Feature
            </Button>
          </div>

          {/* Form nueva feature */}
          {showNewFeature && (
            <Card className="p-4 border-dashed border-2 border-primary/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Nueva Feature</h3>
                <button onClick={() => setShowNewFeature(false)}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Key *</label>
                  <Input
                    placeholder="ej: custom_branding"
                    value={newFeature.key}
                    onChange={(e) =>
                      setNewFeature({ ...newFeature, key: e.target.value.toLowerCase().replace(/[^a-z_]/g, "") })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
                  <Input
                    placeholder="ej: Branding Personalizado"
                    value={newFeature.label}
                    onChange={(e) => setNewFeature({ ...newFeature, label: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Categoría</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={newFeature.category}
                    onChange={(e) => setNewFeature({ ...newFeature, category: e.target.value })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    onClick={handleCreateFeature}
                    disabled={savingFeature}
                    className="w-full gap-1"
                  >
                    {savingFeature ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    Crear
                  </Button>
                </div>
              </div>
              <div className="mt-2">
                <Input
                  placeholder="Descripción (opcional)"
                  value={newFeature.description}
                  onChange={(e) => setNewFeature({ ...newFeature, description: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </Card>
          )}

          {/* Matriz de features */}
          {loadingFeatures ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : features.length === 0 ? (
            <Card className="p-12 text-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay features definidas aún.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ejecutá la migración 00015 o creá features manualmente.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              {selectedLine === "consultorio" && (
                <div className="px-4 py-3 bg-purple-50/50 dark:bg-purple-950/20 border-b border-border">
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Consultorio Pequeño hereda features de <strong>Standard Healthcare</strong> · Consultorio Grande hereda features de <strong>Premium Healthcare</strong>.
                    Los cambios se gestionan desde la pestaña Healthcare.
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[200px]">
                        Feature
                      </th>
                      {selectedLine === "consultorio" ? (
                        <>
                          <th className="text-center py-3 px-3 font-medium text-muted-foreground min-w-[120px]">
                            Pequeño (≤10)
                          </th>
                          <th className="text-center py-3 px-3 font-medium text-muted-foreground min-w-[120px]">
                            Grande (11+)
                          </th>
                        </>
                      ) : (
                        PLANS.map((plan) => (
                          <th
                            key={plan}
                            className="text-center py-3 px-3 font-medium text-muted-foreground min-w-[90px]"
                          >
                            {PLAN_LABELS[plan]}
                          </th>
                        ))
                      )}
                      <th className="text-center py-3 px-3 font-medium text-muted-foreground w-[60px]">
                        {/* Acciones */}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedFeatures).map(([category, categoryFeatures]) => (
                      <>
                        {/* Separador de categoría */}
                        <tr key={`cat-${category}`} className="bg-muted/30">
                          <td
                            colSpan={selectedLine === "consultorio" ? 4 : PLANS.length + 2}
                            className="py-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                          >
                            {CATEGORY_LABELS[category] ?? category}
                          </td>
                        </tr>
                        {categoryFeatures.map((feature) => (
                          <tr
                            key={feature.id}
                            className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-2.5 px-4">
                              <div className="font-medium text-foreground">{feature.label}</div>
                              <div className="text-xs text-muted-foreground">{feature.key}</div>
                            </td>
                            {selectedLine === "consultorio" ? (
                              <>
                                {/* Pequeño = HC Standard */}
                                {(["standard", "premium"] as const).map((mappedPlan) => {
                                  const enabled = planFeatures.find(
                                    (p) => p.line === "healthcare" && p.plan === mappedPlan && p.feature_id === feature.id
                                  )?.enabled ?? false;

                                  return (
                                    <td key={mappedPlan} className="py-2.5 px-3 text-center">
                                      <div
                                        className={`inline-flex items-center justify-center w-10 h-6 rounded-full ${
                                          enabled
                                            ? "bg-purple-500 dark:bg-purple-600"
                                            : "bg-gray-200 dark:bg-gray-700"
                                        }`}
                                      >
                                        <div
                                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                            enabled ? "translate-x-2" : "-translate-x-2"
                                          }`}
                                        />
                                      </div>
                                    </td>
                                  );
                                })}
                              </>
                            ) : (
                              PLANS.map((plan) => {
                                const enabled = getFeatureEnabled(feature.id, plan);
                                const toggleKey = `${selectedLine}-${plan}-${feature.id}`;
                                const isToggling = togglingFeature === toggleKey;

                                return (
                                  <td key={plan} className="py-2.5 px-3 text-center">
                                    <button
                                      onClick={() =>
                                        void handleToggleFeature(feature.id, plan, enabled)
                                      }
                                      disabled={isToggling}
                                      className={`inline-flex items-center justify-center w-10 h-6 rounded-full transition-all ${
                                        enabled
                                          ? selectedLine === "healthcare"
                                            ? "bg-blue-500 dark:bg-blue-600"
                                            : "bg-emerald-500 dark:bg-emerald-600"
                                          : "bg-gray-200 dark:bg-gray-700"
                                      }`}
                                    >
                                      {isToggling ? (
                                        <Loader2 className="w-3 h-3 animate-spin text-white" />
                                      ) : (
                                        <div
                                          className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                            enabled ? "translate-x-2" : "-translate-x-2"
                                          }`}
                                        />
                                      )}
                                    </button>
                                  </td>
                                );
                              })
                            )}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleDeleteFeature(feature.id, feature.label)}
                                className="text-muted-foreground hover:text-red-500 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
