"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Plus,
  AlertCircle,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  discount_pct: number;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
  is_active: boolean;
}

interface CouponsResponse {
  coupons: Coupon[];
  total: number;
}

export default function CuponesPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    discount_pct: 10,
    max_uses: null as number | null,
    valid_until: "",
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/cupones");
      if (!response.ok) throw new Error("Failed to fetch coupons");
      const data: CouponsResponse = await response.json();
      setCoupons(data.coupons);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading coupons");
      toast.error("Error cargando cupones");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingId(coupon.id);
      setFormData({
        code: coupon.code,
        discount_pct: coupon.discount_pct,
        max_uses: coupon.max_uses,
        valid_until: coupon.valid_until
          ? coupon.valid_until.split("T")[0]
          : "",
      });
    } else {
      setEditingId(null);
      setFormData({
        code: "",
        discount_pct: 10,
        max_uses: null,
        valid_until: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.code || formData.discount_pct <= 0) {
      toast.error("Código y descuento son obligatorios");
      return;
    }

    try {
      const url = editingId
        ? `/api/admin/cupones/${editingId}`
        : "/api/admin/cupones";
      const method = editingId ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          valid_until: formData.valid_until
            ? new Date(formData.valid_until).toISOString()
            : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to save coupon");

      toast.success(
        editingId ? "Cupón actualizado" : "Cupón creado exitosamente"
      );
      setIsDialogOpen(false);
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error saving coupon");
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/cupones/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) throw new Error("Failed to update coupon");
      toast.success("Cupón actualizado");
      fetchCoupons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating coupon");
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
            Gestión de Cupones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea y administra cupones de descuento para profesionales
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cupón
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground border-t-primary" />
          </div>
        ) : coupons.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50">
                <tr className="text-muted-foreground">
                  <th className="px-4 py-3 text-left font-medium">Código</th>
                  <th className="px-4 py-3 text-left font-medium">Descuento</th>
                  <th className="px-4 py-3 text-left font-medium">Usos</th>
                  <th className="px-4 py-3 text-left font-medium">
                    Válido hasta
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Estado</th>
                  <th className="px-4 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((coupon, idx) => {
                  const isExpired =
                    coupon.valid_until &&
                    new Date(coupon.valid_until) < new Date();
                  const isMaxedOut =
                    coupon.max_uses &&
                    coupon.used_count >= coupon.max_uses;

                  return (
                    <tr
                      key={coupon.id}
                      className={
                        idx % 2 === 0
                          ? "bg-muted/30"
                          : "bg-background"
                      }
                    >
                      <td className="px-4 py-3 font-mono font-medium">
                        <div className="flex items-center gap-2">
                          {coupon.code}
                          <button
                            onClick={() => handleCopyCode(coupon.code)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {coupon.discount_pct}%
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {coupon.used_count}
                        {coupon.max_uses ? `/${coupon.max_uses}` : ""}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {coupon.valid_until
                          ? new Date(coupon.valid_until).toLocaleDateString(
                              "es-AR"
                            )
                          : "Sin límite"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isExpired && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Expirado
                            </span>
                          )}
                          {isMaxedOut && !isExpired && (
                            <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                              Agotado
                            </span>
                          )}
                          {!isExpired && !isMaxedOut && coupon.is_active && (
                            <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              Activo
                            </span>
                          )}
                          {!isExpired && !isMaxedOut && !coupon.is_active && (
                            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                              Inactivo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleOpenDialog(coupon)}
                            title="Editar"
                          >
                            <span className="text-sm font-medium">✎</span>
                          </Button>
                          <button
                            className="inline-flex items-center justify-center h-10 w-10 rounded-md border border-input hover:bg-accent transition-colors"
                            onClick={() =>
                              handleToggleActive(coupon.id, coupon.is_active)
                            }
                            title={
                              coupon.is_active ? "Desactivar" : "Activar"
                            }
                          >
                            <Switch
                              checked={coupon.is_active}
                              disabled={isExpired || isMaxedOut}
                            />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No hay cupones registrados
            </p>
          </div>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent onClose={() => setIsDialogOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Cupón" : "Crear Nuevo Cupón"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Código *
              </label>
              <Input
                value={formData.code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    code: e.target.value.toUpperCase(),
                  })
                }
                placeholder="SUMMER2024"
                disabled={editingId !== null}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editingId
                  ? "El código no puede ser modificado"
                  : "Usa mayúsculas, sin espacios"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Descuento (%) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.discount_pct}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_pct: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Usos máximos
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.max_uses || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_uses: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    })
                  }
                  placeholder="Sin límite"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Válido hasta
              </label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) =>
                  setFormData({ ...formData, valid_until: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dejar vacío para sin límite de fecha
              </p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button onClick={handleSave} className="flex-1">
                {editingId ? "Guardar cambios" : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
