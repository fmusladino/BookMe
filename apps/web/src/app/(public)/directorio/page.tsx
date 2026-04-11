'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, ChevronLeft, ChevronRight, Loader2, Stethoscope, Briefcase, Building2, Shield } from 'lucide-react';

const COUNTRY_NAMES: Record<string, string> = {
  AR: 'Argentina', UY: 'Uruguay', CL: 'Chile', CO: 'Colombia',
  MX: 'México', PE: 'Perú', BR: 'Brasil', PY: 'Paraguay',
  BO: 'Bolivia', EC: 'Ecuador',
};

interface Professional {
  id: string;
  public_slug: string;
  specialty: string;
  city: string;
  province: string;
  country: string;
  address: string | null;
  postal_code: string | null;
  line: 'healthcare' | 'business';
  bio: string | null;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
  services_count: number;
  insurances: { id: string; name: string }[];
}

interface SearchResponse {
  professionals: Professional[];
  total: number;
  page: number;
  pages: number;
}

export default function DirectoryPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [city, setCity] = useState('');
  const [line, setLine] = useState<'all' | 'healthcare' | 'business'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchProfessionals = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (city) params.append('city', city);
        if (line !== 'all') params.append('line', line);
        params.append('page', page.toString());
        params.append('limit', '12');

        const response = await fetch(`/api/professionals/search?${params.toString()}`);
        if (!response.ok) throw new Error('Error al cargar profesionales');

        const data: SearchResponse = await response.json();
        setProfessionals(data.professionals);
        setTotal(data.total);
        setTotalPages(data.pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setProfessionals([]);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchProfessionals();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, city, line, page]);

  const handleLineChange = (newLine: 'all' | 'healthcare' | 'business') => {
    setLine(newLine);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="bg-gradient-to-br from-bookme-navy via-bookme-navy to-slate-800 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 text-white py-10 md:py-14">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Encontrá tu profesional
          </h1>
          <p className="text-blue-200 dark:text-slate-400 text-sm mb-6 max-w-lg mx-auto">
            Buscá entre profesionales de salud y negocios en toda LATAM
          </p>

          {/* Search + City en una fila */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Nombre o especialidad..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-blue-200/70 border border-white/20 focus:outline-none focus:ring-2 focus:ring-bookme-mint focus:border-transparent text-sm"
              />
            </div>
            <div className="relative sm:w-48">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Ciudad..."
                value={city}
                onChange={(e) => { setCity(e.target.value); setPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/10 backdrop-blur-sm text-white placeholder-blue-200/70 border border-white/20 focus:outline-none focus:ring-2 focus:ring-bookme-mint focus:border-transparent text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filtros de línea + contador */}
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex gap-1.5">
            {(['all', 'healthcare', 'business'] as const).map((l) => {
              const active = line === l;
              const label = l === 'all' ? 'Todos' : l === 'healthcare' ? 'Salud' : 'Negocios';
              const Icon = l === 'healthcare' ? Stethoscope : l === 'business' ? Briefcase : null;
              return (
                <button
                  key={l}
                  onClick={() => handleLineChange(l)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    active
                      ? l === 'healthcare'
                        ? 'bg-blue-600 text-white'
                        : l === 'business'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-bookme-navy text-white dark:bg-bookme-mint dark:text-bookme-navy'
                      : 'bg-secondary text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3" />}
                  {label}
                </button>
              );
            })}
          </div>
          {!loading && (
            <span className="text-xs text-muted-foreground">
              {total} {total === 1 ? 'profesional' : 'profesionales'}
            </span>
          )}
        </div>
      </div>

      {/* Resultados */}
      <section className="max-w-5xl mx-auto px-4 py-8">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-bookme-mint animate-spin" />
          </div>
        )}

        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg text-center text-sm">
            {error}
          </div>
        )}

        {!loading && !error && professionals.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              No se encontraron profesionales con esos filtros.
            </p>
          </div>
        )}

        {!loading && professionals.length > 0 && (
          <>
            {/* Grid de tarjetas compactas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {professionals.map((prof) => {
                const initials = prof.profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                const isHealth = prof.line === 'healthcare';
                const badgeColor = isHealth
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
                const accentBorder = isHealth
                  ? 'hover:border-blue-400 dark:hover:border-blue-500'
                  : 'hover:border-emerald-400 dark:hover:border-emerald-500';

                // Construir ubicación compacta
                const locationParts = [prof.city, prof.province].filter(Boolean);
                const locationStr = locationParts.join(', ');
                const countryName = COUNTRY_NAMES[prof.country] || prof.country;

                return (
                  <Link
                    key={prof.id}
                    href={`/@${prof.public_slug}`}
                    className={`group block border border-border rounded-xl bg-card transition-all hover:shadow-md ${accentBorder}`}
                  >
                    {/* Header con avatar + badge */}
                    <div className="p-4 pb-3">
                      <div className="flex items-start gap-3">
                        {/* Avatar compacto */}
                        <div className="relative w-11 h-11 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0">
                          {prof.profile.avatar_url ? (
                            <Image
                              src={prof.profile.avatar_url}
                              alt={prof.profile.full_name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                {initials}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Nombre + Especialidad */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-bookme-navy dark:group-hover:text-bookme-mint transition-colors">
                            {prof.profile.full_name}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {prof.specialty}
                          </p>
                        </div>

                        {/* Badge línea */}
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${badgeColor}`}>
                          {isHealth ? 'Salud' : 'Neg.'}
                        </span>
                      </div>
                    </div>

                    {/* Separador */}
                    <div className="border-t border-border mx-4" />

                    {/* Info de ubicación */}
                    <div className="px-4 py-3 space-y-1.5">
                      {/* Dirección */}
                      {prof.address && (
                        <div className="flex items-start gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          <span className="text-xs text-muted-foreground leading-tight truncate">
                            {prof.address}
                          </span>
                        </div>
                      )}

                      {/* Ciudad, Provincia */}
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="text-xs text-muted-foreground leading-tight">
                          {locationStr || 'Sin ubicación'}
                          {prof.postal_code && (
                            <span className="text-muted-foreground/60"> ({prof.postal_code})</span>
                          )}
                        </span>
                      </div>

                      {/* País */}
                      {countryName && (
                        <p className="text-[11px] text-muted-foreground/60 pl-5">
                          {countryName}
                        </p>
                      )}
                    </div>

                    {/* Obras sociales / Prepagas */}
                    {prof.insurances && prof.insurances.length > 0 && (
                      <div className="px-4 pb-2">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[10px] font-medium text-muted-foreground">Obras sociales</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {prof.insurances.slice(0, 3).map((ins) => (
                            <span
                              key={ins.id}
                              className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                            >
                              {ins.name}
                            </span>
                          ))}
                          {prof.insurances.length > 3 && (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              +{prof.insurances.length - 3} más
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Footer CTA */}
                    <div className="px-4 pb-4 pt-1">
                      <div className="w-full text-center py-2 rounded-lg bg-bookme-navy/5 dark:bg-bookme-mint/10 text-xs font-medium text-bookme-navy dark:text-bookme-mint group-hover:bg-bookme-navy group-hover:text-white dark:group-hover:bg-bookme-mint dark:group-hover:text-bookme-navy transition-colors">
                        Ver perfil y reservar
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => page > 1 && setPage(page - 1)}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Anterior
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => page < totalPages && setPage(page + 1)}
                  disabled={page === totalPages}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Siguiente
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
