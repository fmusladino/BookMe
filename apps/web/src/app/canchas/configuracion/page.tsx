"use client";

import { useEffect, useState, useCallback } from "react";
import { Save, Globe, EyeOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/hooks/use-session";

interface CourtOwnerProfile {
  business_name: string;
  slug: string;
  description?: string;
  address?: string;
  city: string;
  province: string;
  country: string;
  phone?: string;
  whatsapp?: string;
  is_visible: boolean;
}

export default function CanchasConfiguracionPage() {
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [profile, setProfile] = useState<CourtOwnerProfile>({
    business_name: "",
    slug: "",
    description: "",
    address: "",
    city: "",
    province: "",
    country: "AR",
    phone: "",
    whatsapp: "",
    is_visible: true,
  });

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/court-owners/me");
      if (res.ok) {
        const data = await res.json() as { profile: CourtOwnerProfile };
        setProfile(data.profile);
      }
    } catch {
      // Silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Si no hay datos del servidor, usar los del contexto de sesión
  useEffect(() => {
    if (!loading && user?.court_owner) {
      setProfile((prev) => ({
        ...prev,
        business_name: prev.business_name || user.court_owner?.business_name || "",
        slug: prev.slug || user.court_owner?.slug || "",
        city: prev.city || user.court_owner?.city || "",
      }));
    }
  }, [loading, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/court-owners/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) throw new Error("Error al guardar");
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const publicLink = profile.slug
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/complejos/${profile.slug}`
    : null;

  const handleCopyLink = () => {
    if (publicLink) {
      navigator.clipboard.writeText(publicLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración del complejo</h1>
        <p className="text-muted-foreground text-sm">
          Datos de tu complejo deportivo, visibilidad y link de reservas.
        </p>
      </div>

      {/* Link público */}
      {publicLink && (
        <Card className={profile.is_visible ? "border-green-300 dark:border-green-700" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              {profile.is_visible
                ? <Globe className="h-5 w-5 text-green-500" />
                : <EyeOff className="h-5 w-5 text-muted-foreground" />}
              <div className="flex-1">
                <CardTitle className="text-lg">Visibilidad pública</CardTitle>
                <CardDescription>
                  {profile.is_visible
                    ? "Tu complejo aparece en BookMe. Los clientes pueden reservar tus canchas."
                    : "Tu complejo está oculto. Solo quienes tengan el link directo podrán reservar."}
                </CardDescription>
              </div>
              <Switch
                checked={profile.is_visible}
                onCheckedChange={(v) => setProfile((p) => ({ ...p, is_visible: v }))}
              />
            </div>
          </CardHeader>
          {profile.is_visible && (
            <CardContent>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
                  {publicLink}
                </code>
                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                  {linkCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Compartí este link en WhatsApp, Instagram y redes para que los clientes puedan reservar.
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Datos del complejo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos del complejo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="business-name">Nombre del complejo *</Label>
            <Input
              id="business-name"
              value={profile.business_name}
              onChange={(e) => setProfile((p) => ({ ...p, business_name: e.target.value }))}
              placeholder="Complejo Deportivo Los Pinos"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <textarea
              id="description"
              rows={3}
              value={profile.description ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, description: e.target.value }))}
              placeholder="Contá algo sobre tu complejo: instalaciones, amenidades, estacionamiento..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                value={profile.phone ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                placeholder="+54 341 1234-5678"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                value={profile.whatsapp ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))}
                placeholder="+54 9 341 1234-5678"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ubicación */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ubicación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={profile.address ?? ""}
              onChange={(e) => setProfile((p) => ({ ...p, address: e.target.value }))}
              placeholder="Av. San Martín 1500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="city">Localidad *</Label>
              <Input
                id="city"
                value={profile.city}
                onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))}
                placeholder="Rosario"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">País</Label>
              <select
                id="country"
                value={profile.country}
                onChange={(e) => setProfile((p) => ({ ...p, country: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="AR">Argentina</option>
                <option value="UY">Uruguay</option>
                <option value="CL">Chile</option>
                <option value="CO">Colombia</option>
                <option value="MX">México</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="province">Provincia *</Label>
            <select
              id="province"
              value={profile.province}
              onChange={(e) => setProfile((p) => ({ ...p, province: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Seleccioná...</option>
              <option value="Buenos Aires">Buenos Aires</option>
              <option value="CABA">CABA</option>
              <option value="Catamarca">Catamarca</option>
              <option value="Chaco">Chaco</option>
              <option value="Chubut">Chubut</option>
              <option value="Córdoba">Córdoba</option>
              <option value="Corrientes">Corrientes</option>
              <option value="Entre Ríos">Entre Ríos</option>
              <option value="Formosa">Formosa</option>
              <option value="Jujuy">Jujuy</option>
              <option value="La Pampa">La Pampa</option>
              <option value="La Rioja">La Rioja</option>
              <option value="Mendoza">Mendoza</option>
              <option value="Misiones">Misiones</option>
              <option value="Neuquén">Neuquén</option>
              <option value="Río Negro">Río Negro</option>
              <option value="Salta">Salta</option>
              <option value="San Juan">San Juan</option>
              <option value="San Luis">San Luis</option>
              <option value="Santa Cruz">Santa Cruz</option>
              <option value="Santa Fe">Santa Fe</option>
              <option value="Santiago del Estero">Santiago del Estero</option>
              <option value="Tierra del Fuego">Tierra del Fuego</option>
              <option value="Tucumán">Tucumán</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
