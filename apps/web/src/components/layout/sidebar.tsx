"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Settings,
  Users,
  BarChart3,
  MessageCircle,
  FileText,
  CreditCard,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
  ClipboardList,
  Stethoscope,
  StickyNote,
  Shield,
  TrendingUp,
  CalendarCheck,
  UserCircle,
  Home,
  Building2,
  Upload,
  HelpCircle,
  Globe,
  QrCode,
  Dribbble,
  BookOpen,
  Compass,
  AlertTriangle,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Avatar } from "@/components/ui/avatar";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// ─── Items de navegación por rol y línea ─────────────────────────────

const NAV_PROFESSIONAL_BASE: NavItem[] = [
  // La agenda del día (con selector Día/Semana) es la única entrada de agenda
  { label: "Agenda", href: "/dashboard/agenda/hoy", icon: Calendar },
  { label: "Pacientes", href: "/dashboard/pacientes", icon: Users },
  { label: "Notificaciones", href: "/dashboard/notificaciones", icon: Bell },
  { label: "Servicios", href: "/dashboard/servicios", icon: FileText },
  { label: "Métricas", href: "/dashboard/metricas", icon: BarChart3 },
];

// Solo Healthcare
const NAV_HEALTHCARE_EXTRA: NavItem[] = [
  { label: "Prestaciones", href: "/dashboard/prestaciones", icon: ClipboardList },
  { label: "Facturación", href: "/dashboard/facturacion", icon: CreditCard },
];

// Comunes al final para profesionales
const NAV_PROFESSIONAL_FOOTER: NavItem[] = [
  { label: "Mi QR", href: "/dashboard/qr", icon: QrCode },
  { label: "Mi Plan", href: "/dashboard/plan", icon: CreditCard },
  { label: "Importar turnos", href: "/dashboard/importar", icon: Upload },
  { label: "Configuración", href: "/dashboard/configuracion", icon: Settings },
];

// Paciente
const NAV_PATIENT: NavItem[] = [
  { label: "Mis turnos", href: "/mis-turnos", icon: CalendarCheck },
  { label: "Mis médicos", href: "/mis-medicos", icon: Stethoscope },
  { label: "Directorio", href: "/directorio", icon: Users },
  { label: "Mi perfil", href: "/mis-turnos/mi-perfil", icon: UserCircle },
];

// Admin de consultorio
const NAV_ADMIN: NavItem[] = [
  { label: "Panel", href: "/clinica", icon: Home },
  { label: "Agenda", href: "/clinica/agenda", icon: Calendar },
  { label: "Pacientes", href: "/clinica/pacientes", icon: Users },
  { label: "Profesionales", href: "/clinica/profesionales", icon: Stethoscope },
  { label: "Equipo Admin", href: "/clinica/admins", icon: Shield },
  { label: "Configuración", href: "/clinica/configuracion", icon: Settings },
];

// Sección de clínica para profesionales que son owners
const NAV_CLINIC_OWNER: NavItem[] = [
  { label: "Mi Clínica", href: "/clinica", icon: Building2 },
  { label: "Agenda Clínica", href: "/clinica/agenda", icon: Calendar },
  { label: "Pacientes", href: "/clinica/pacientes", icon: Users },
  { label: "Profesionales", href: "/clinica/profesionales", icon: Stethoscope },
  { label: "Equipo Admin", href: "/clinica/admins", icon: Shield },
  { label: "Config. Clínica", href: "/clinica/configuracion", icon: Settings },
];

// Super Admin
const NAV_SUPERADMIN: NavItem[] = [
  { label: "Dashboard", href: "/admin", icon: Shield },
  { label: "Usuarios", href: "/admin/usuarios", icon: Users },
  { label: "Planes", href: "/admin/planes", icon: CreditCard },
  { label: "Cobros y Mora", href: "/admin/cobros", icon: AlertTriangle },
  { label: "Cartilla", href: "/admin/cartilla", icon: Globe },
  { label: "Cupones", href: "/admin/cupones", icon: ClipboardList },
  { label: "Métricas", href: "/admin/metricas", icon: BarChart3 },
];

// Marketing — todo en una sola página dashboard
const NAV_MARKETING: NavItem[] = [
  { label: "Dashboard", href: "/marketing", icon: TrendingUp },
];

// Dueño de canchas
const NAV_CANCHAS: NavItem[] = [
  { label: "Panel", href: "/canchas", icon: Home },
  { label: "Mis Canchas", href: "/canchas/mis-canchas", icon: Dribbble },
  { label: "Disponibilidad", href: "/canchas/reservas", icon: BookOpen },
  { label: "Dashboard", href: "/canchas/dashboard", icon: BarChart3 },
  { label: "Configuración", href: "/canchas/configuracion", icon: Settings },
];

export const Sidebar = memo(function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, loading, clear } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => setMounted(true), []);

  // Conteo de notificaciones (archivos sin ver) — solo para profesionales.
  // Se refetcha al cambiar de ruta y cada 60s.
  useEffect(() => {
    if (user?.role !== "professional") {
      setUnreadNotifications(0);
      return;
    }

    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/professional/notifications");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread_count?: number };
        if (!cancelled) setUnreadNotifications(data.unread_count ?? 0);
      } catch {
        // silencioso — el badge es informativo, no bloqueante
      }
    };

    void fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user?.role, pathname]);

  // Construir items de navegación según rol y línea
  const navItems = useMemo<NavItem[]>(() => {
    if (!user) return [];

    switch (user.role) {
      case "professional": {
        const items = [...NAV_PROFESSIONAL_BASE];
        if (user.professional?.line === "healthcare") {
          items.push(...NAV_HEALTHCARE_EXTRA);
        }
        items.push(...NAV_PROFESSIONAL_FOOTER);
        // Si es owner o admin de clínica, agregar sección de clínica
        if (user.is_clinic_owner || user.is_clinic_admin) {
          items.push(...NAV_CLINIC_OWNER);
        }
        return items;
      }
      case "patient":
        return NAV_PATIENT;
      case "admin": {
        // Admin puro (secretaria) — si también es owner, agregar badge
        const items = [...NAV_ADMIN];
        return items;
      }
      case "superadmin":
        return NAV_SUPERADMIN;
      case "marketing":
        return NAV_MARKETING;
      case "canchas":
        return NAV_CANCHAS;
      default:
        return [];
    }
  }, [user]);

  const handleLogout = async () => {
    // Limpiar sesión local inmediatamente
    clear();
    const supabase = createClient();
    await supabase.auth.signOut();
    // Forzar hard navigation para limpiar todo el estado de React
    window.location.href = "/login";
  };

  // Etiqueta del tipo de usuario
  const roleLabel = useMemo(() => {
    if (!user) return "";
    switch (user.role) {
      case "professional":
        return user.professional?.specialty ?? "Profesional";
      case "patient":
        return "Paciente";
      case "admin":
        return "Admin Consultorio";
      case "superadmin":
        return "Super Admin";
      case "marketing":
        return "Marketing";
      case "canchas":
        return user.court_owner?.business_name ?? "Dueño de Canchas";
      default:
        return "";
    }
  }, [user]);

  return (
    <>
      {/* Botón mobile */}
      <button
        className="fixed top-4 left-4 z-50 rounded-md bg-card p-2 shadow-md lg:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        data-tour="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-card transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Image
            src="/icons/icon-192x192.png"
            alt="BookMe"
            width={36}
            height={36}
            className="rounded-lg"
          />
          <span className="font-heading text-xl font-bold">BookMe</span>
        </div>

        {/* Info del usuario */}
        {user && !loading && (
          <div className="border-b px-4 py-3 flex items-center gap-3">
            <Avatar
              src={user.avatar_url}
              alt={user.full_name}
              fallback={user.full_name}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {roleLabel}
                {user.professional?.line === "healthcare" && (
                  <span className="ml-1 text-blue-500">• Salud</span>
                )}
                {user.role === "canchas" && (
                  <span className="ml-1 text-orange-500">• Canchas</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          ) : (
            navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (pathname.startsWith(item.href) &&
                  item.href !== "/dashboard/configuracion" &&
                  item.href !== "/dashboard/agenda/hoy" &&
                  item.href !== "/clinica/configuracion");

              // Generar atributo data-tour a partir del label del nav item
              const tourId = `nav-${item.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "-")}`;

              const showNotifBadge =
                item.href === "/dashboard/notificaciones" && unreadNotifications > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour={tourId}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {showNotifBadge && (
                    <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px]">
                      {unreadNotifications > 99 ? "99+" : unreadNotifications}
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </nav>

        {/* Footer: ayuda + dark mode toggle + logout */}
        <div className="border-t px-3 py-4 space-y-1">
          {user?.role === "professional" && (
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => {
                setMobileOpen(false);
                window.dispatchEvent(new Event("bookme:restart-tour"));
              }}
            >
              <Compass className="h-4 w-4" />
              Ver tour de bienvenida
            </button>
          )}
          <Link
            href="/soporte"
            target="_blank"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <HelpCircle className="h-4 w-4" />
            Centro de Ayuda
          </Link>
          <button
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {mounted ? (theme === "dark" ? "Modo claro" : "Modo oscuro") : "Modo oscuro"}
          </button>
          <button
            className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
});
