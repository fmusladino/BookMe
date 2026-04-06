import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto genérico reutilizable para loading.tsx de páginas */
export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-6 p-6 animate-in fade-in duration-300">
      {/* Título */}
      <Skeleton className="h-8 w-48" />
      {/* Subtítulo / descripción */}
      <Skeleton className="h-4 w-72" />
      {/* Contenido principal */}
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Esqueleto para la vista de agenda semanal */
export function AgendaSkeleton() {
  return (
    <div className="space-y-4 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      {/* Header de días */}
      <div className="grid grid-cols-8 gap-1">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      {/* Grilla horaria */}
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 56 }, (_, i) => (
          <Skeleton key={i} className="h-[60px] w-full" />
        ))}
      </div>
    </div>
  );
}

/** Esqueleto para tablas de datos */
export function TableSkeleton({ cols = 5, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-4 p-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Header de tabla */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      {/* Filas */}
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className="h-12 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
