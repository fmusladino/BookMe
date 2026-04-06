"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Search,
  Eye,
  EyeOff,
  Users,
  Globe,
  Stethoscope,
  Briefcase,
  ExternalLink,
  MapPin,
  Filter,
} from "lucide-react";

interface Professional {
  id: string;
  specialty: string;
  specialty_slug: string;
  city: string;
  province: string;
  line: "healthcare" | "business";
  public_slug: string;
  is_visible: boolean;
  subscription_plan: string;
  subscription_status: string;
  directory_approved_at?: string | null;
  directory_hidden_at?: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
    phone: string | null;
  };
}

interface Counts {
  total: number;
  visible: number;
  hidden: number;
}

type StatusFilter = "all" | "visible" | "hidden";
type LineFilter = "" | "healthcare" | "business";

export default function CartillaPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, visible: 0, hidden: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lineFilter, setLineFilter] = useState<LineFilter>("");
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (lineFilter) params.set("line", lineFilter);

      const res = await fetch(`/api/admin/cartilla?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar");
      const data = (await res.json()) as { professionals: Professional[]; counts: Counts };
      setProfessionals(data.professionals);
      setCounts(data.counts);
    } catch {
      toast.error("Error al cargar la cartilla");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, lineFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, search ? 300 : 0); // Debounce para búsqueda
    return () => clearTimeout(timer);
  }, [fetchData, search]);

  const toggleVisibility = async (prof: Professional) => {
    const newVisible = !prof.is_visible;
    setTogglingIds((prev) => new Set(prev).add(prof.id));

    try {
      const res = await fetch(`/api/admin/cartilla/${prof.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_visible: newVisible }),
      });

      if (!res.ok) throw new Error("Error al actualizar");

      // Actualizar estado local
      setProfessionals((prev) =>
        prev.map((p) => (p.id === prof.id ? { ...p, is_visible: newVisible } : p))
      );
      setCounts((prev) => ({
        ...prev,
        visible: prev.visible + (newVisible ? 1 : -1),
        hidden: prev.hidden + (newVisible ? -1 : 1),
      }));

      toast.success(
        newVisible
          ? `${prof.profile.full_name} publicado en cartilla`
          : `${prof.profile.full_name} ocultado de cartilla`
      );
    } catch {
      toast.error("Error al cambiar visibilidad");
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(prof.id);
        return next;
      });
    }
  };

  const getStatusBadge = (prof: Professional) => {
    if (prof.is_visible) {
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
          <Eye className="mr-1 h-3 w-3" />
          En cartilla
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <EyeOff className="mr-1 h-3 w-3" />
        Oculto
      </Badge>
    );
  };

  const getSubscriptionBadge = (prof: Professional) => {
    const colors: Record<string, string> = {
      active: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      trialing: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
      past_due: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    };
    const labels: Record<string, string> = {
      active: "Activo",
      trialing: "Trial",
      past_due: "Impago",
      cancelled: "Cancelado",
    };
    return (
      <Badge className={colors[prof.subscription_status] || colors.cancelled}>
        {labels[prof.subscription_status] || prof.subscription_status}
      </Badge>
    );
  };

  const statusTabs: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "Todos", count: counts.total },
    { key: "visible", label: "En cartilla", count: counts.visible },
    { key: "hidden", label: "Ocultos", count: counts.hidden },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cartilla de profesionales</h1>
        <p className="text-muted-foreground">
          Gestioná qué profesionales aparecen en el directorio público de BookMe.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total profesionales</p>
              <p className="text-2xl font-bold">{counts.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900">
              <Globe className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En cartilla</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.visible}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-muted p-2.5">
              <EyeOff className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ocultos</p>
              <p className="text-2xl font-bold text-muted-foreground">{counts.hidden}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Barra de búsqueda + filtro de línea */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email, especialidad o ciudad..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <div className="flex rounded-lg border">
                <button
                  onClick={() => setLineFilter("")}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    lineFilter === ""
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  } rounded-l-md`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setLineFilter("healthcare")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                    lineFilter === "healthcare"
                      ? "bg-blue-500 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5" />
                  Salud
                </button>
                <button
                  onClick={() => setLineFilter("business")}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors ${
                    lineFilter === "business"
                      ? "bg-emerald-500 text-white"
                      : "text-muted-foreground hover:bg-muted"
                  } rounded-r-md`}
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Negocios
                </button>
              </div>
            </div>
          </div>

          {/* Tabs de estado */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  statusFilter === tab.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lista de profesionales */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : professionals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">No se encontraron profesionales</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {professionals.map((prof) => (
            <Card key={prof.id} className={!prof.is_visible ? "opacity-70" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                    {prof.profile.avatar_url ? (
                      <img
                        src={prof.profile.avatar_url}
                        alt={prof.profile.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-muted-foreground">
                        {prof.profile.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{prof.profile.full_name}</h3>
                      {prof.line === "healthcare" ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shrink-0">
                          <Stethoscope className="mr-1 h-3 w-3" />
                          Salud
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 shrink-0">
                          <Briefcase className="mr-1 h-3 w-3" />
                          Negocios
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{prof.specialty}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {prof.city}, {prof.province}
                      </span>
                      <span>{prof.profile.email}</span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="hidden items-center gap-2 sm:flex">
                    {getSubscriptionBadge(prof)}
                    {getStatusBadge(prof)}
                  </div>

                  {/* Toggle + link */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <Switch
                        checked={prof.is_visible}
                        onCheckedChange={() => toggleVisibility(prof)}
                        disabled={togglingIds.has(prof.id)}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {prof.is_visible ? "Visible" : "Oculto"}
                      </span>
                    </div>
                    <a
                      href={`/@${prof.public_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      title="Ver perfil público"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Mobile badges */}
                <div className="mt-3 flex items-center gap-2 sm:hidden">
                  {getSubscriptionBadge(prof)}
                  {getStatusBadge(prof)}
                </div>

                {/* Audit info */}
                {(prof.directory_approved_at || prof.directory_hidden_at) && (
                  <div className="mt-2 border-t pt-2">
                    <p className="text-[11px] text-muted-foreground">
                      {prof.is_visible && prof.directory_approved_at
                        ? `Publicado por admin el ${new Date(prof.directory_approved_at).toLocaleDateString("es-AR")}`
                        : ""}
                      {!prof.is_visible && prof.directory_hidden_at
                        ? `Ocultado por admin el ${new Date(prof.directory_hidden_at).toLocaleDateString("es-AR")}`
                        : ""}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
