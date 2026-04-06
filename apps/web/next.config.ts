import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpila los packages del monorepo
  transpilePackages: ["@bookme/database", "@bookme/notifications", "@bookme/config"],

  // googleapis es opcional (solo se necesita si el profesional conecta GCal).
  // Lo marcamos como external para que webpack no intente resolverlo en build time.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("googleapis");
    }
    return config;
  },

  // Silencia el warning de workspace root en monorepos
  outputFileTracingRoot: require("path").join(__dirname, "../../"),

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
