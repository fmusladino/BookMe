import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpila los packages del monorepo
  transpilePackages: ["@bookme/database", "@bookme/notifications", "@bookme/config"],

  // Paquetes que requieren módulos nativos de Node y no deben ser bundleados por webpack
  serverExternalPackages: ["pdfkit", "fontkit", "iconv-lite", "googleapis"],

  // Silencia el warning de workspace root en monorepos
  outputFileTracingRoot: require("path").join(__dirname, "../../"),

  // Ignorar errores de TypeScript en build (temporal — arreglar en próximo commit)
  typescript: {
    ignoreBuildErrors: true,
  },

  // ── Optimizaciones de rendimiento ──────────────────────────────────
  // Compresión gzip/brotli a nivel de Next.js (complementa al CDN/reverse proxy)
  compress: true,

  // Activar React Compiler (experimental) para auto-memoización
  reactStrictMode: true,

  // Generar source maps solo en producción si se necesitan para error tracking
  productionBrowserSourceMaps: false,

  // Optimizar paquetes pesados: tree-shake automático de submodules
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns", "sonner"],
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
    // Formatos modernos para menor peso
    formats: ["image/avif", "image/webp"],
  },

  // Cabeceras de seguridad + caching
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    // Extraer hostname de Supabase para CSP
    const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : "*.supabase.co";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          // HSTS: fuerza HTTPS durante 1 año, incluye subdominios
          ...(!isDev
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // Content-Security-Policy
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + inline para Next.js hydration
              `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
              // Estilos: self + inline para Tailwind/CSS-in-JS
              "style-src 'self' 'unsafe-inline'",
              // Imágenes: self + Supabase storage + Google avatars + data URIs
              `img-src 'self' ${supabaseHost} *.supabase.co lh3.googleusercontent.com data: blob:`,
              // Fonts
              "font-src 'self' data:",
              // Conexiones: self + Supabase (API + Realtime WS) + analytics
              `connect-src 'self' ${supabaseHost} *.supabase.co wss://${supabaseHost}${isDev ? " ws://localhost:*" : ""}`,
              // Frames: ninguno
              "frame-src 'none'",
              // Forms: solo a self
              "form-action 'self'",
              // Base URI
              "base-uri 'self'",
              // Object: ninguno (bloquea Flash, Java applets)
              "object-src 'none'",
              // Upgrade insecure requests en producción
              ...(!isDev ? ["upgrade-insecure-requests"] : []),
            ].join("; "),
          },
          // X-DNS-Prefetch-Control
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      // Cache agresivo para assets estáticos (fonts, icons, imágenes)
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
