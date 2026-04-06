import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Mapa de rol → ruta home del panel correspondiente
const ROLE_HOME: Record<string, string> = {
  professional: "/dashboard",
  patient: "/mis-turnos",
  admin: "/clinica",
  superadmin: "/admin",
  marketing: "/marketing",
};

// Rutas que no requieren autenticación
const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/callback",
  "/directorio",
  "/perfil",      // perfiles públicos (rewrite desde /@slug)
  "/book",        // flujo de reserva pública
  "/api/webhooks",
  "/api/cron",
  "/api/professionals", // directorio público y perfiles
  "/api/book",          // reserva (auth se verifica internamente)
  "/api/schedule/available-slots", // slots públicos para booking
  "/api/auth/register",           // registro de pacientes
];

function isPublicRoute(pathname: string): boolean {
  // La home (/) es pública — landing page
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Recursos estáticos: no procesar
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/sw.js" ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff2?)$/)
  ) {
    return NextResponse.next();
  }

  // Rewrite: /@slug → /perfil/slug (@ es reservado en Next.js App Router)
  if (pathname.startsWith("/@")) {
    const slug = pathname.slice(2); // quita "/@"
    const url = request.nextUrl.clone();
    url.pathname = `/perfil/${slug}`;
    return NextResponse.rewrite(url);
  }

  const response = NextResponse.next({ request });
  const { user, supabase } = await updateSession(request, response);

  // Sin Supabase configurado (dev): dejar pasar todo
  if (!supabase) {
    return response;
  }

  // Sin sesión → redirigir a login (excepto rutas públicas)
  if (!user) {
    if (!isPublicRoute(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  // Leer el rol desde los metadatos del JWT (app_metadata) en vez de consultar la DB.
  // El rol se setea en app_metadata al registrarse o desde el trigger de profiles.
  // Fallback: si no existe en metadata, usar "professional" por defecto.
  const role = (user.app_metadata?.role as string) ?? "professional";
  const home = ROLE_HOME[role] ?? "/dashboard";

  // Con sesión en home o ruta de auth → redirigir al panel según rol
  if (pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Protección por rol: redirigir si accede a un panel que no le corresponde
  // Nota: professional incluye /clinica porque un profesional puede ser
  // owner o admin de un consultorio. La validación fina (is_owner / is_clinic_admin)
  // se hace en cada API route y página del lado servidor.
  // Nota: superadmin incluye /marketing para ver métricas de producto.
  const ROLE_ROUTES: Record<string, string[]> = {
    professional: ["/dashboard", "/clinica"],
    patient: ["/mis-turnos", "/directorio", "/book"],
    admin: ["/clinica"],
    superadmin: ["/admin", "/marketing"],
    marketing: ["/marketing"],
  };

  const allowedPrefixes = ROLE_ROUTES[role] ?? [];
  const isApiRoute = pathname.startsWith("/api/");
  const isProtectedPanel =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/mis-turnos") ||
    pathname.startsWith("/clinica") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/marketing");

  // Si es una ruta de panel y el usuario no tiene acceso, redirigir a su home
  if (isProtectedPanel && !isApiRoute) {
    const hasAccess = allowedPrefixes.some((prefix) => pathname.startsWith(prefix));
    if (!hasAccess) {
      return NextResponse.redirect(new URL(home, request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
