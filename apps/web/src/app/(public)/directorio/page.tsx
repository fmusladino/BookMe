'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, MapPin, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Professional {
  id: string;
  public_slug: string;
  specialty: string;
  city: string;
  province: string;
  line: 'healthcare' | 'business';
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface SearchResponse {
  professionals: Professional[];
  total: number;
  page: number;
  pages: number;
}

export default function DirectoryPage() {
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [city, setCity] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [line, setLine] = useState<'all' | 'healthcare' | 'business'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch professionals
  useEffect(() => {
    const fetchProfessionals = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (city) params.append('city', city);
        if (specialty) params.append('specialty', specialty);
        if (line !== 'all') params.append('line', line);
        params.append('page', page.toString());
        params.append('limit', '12');

        const response = await fetch(`/api/professionals/search?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Error al cargar profesionales');
        }

        const data: SearchResponse = await response.json();
        setProfessionals(data.professionals);
        setTotalPages(data.pages);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setProfessionals([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(() => {
      setPage(1);
      fetchProfessionals();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, city, specialty, line, page]);

  const handleLineChange = (newLine: 'all' | 'healthcare' | 'business') => {
    setLine(newLine);
    setPage(1);
  };

  const handlePreviousPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const getLineLabel = (lineType: 'healthcare' | 'business') => {
    return lineType === 'healthcare' ? 'Salud' : 'Negocios';
  };

  const getLineBadgeColor = (lineType: 'healthcare' | 'business') => {
    return lineType === 'healthcare'
      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Section */}
      <section className="bg-gradient-to-r from-bookme-navy to-bookme-navy dark:from-slate-900 dark:to-slate-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-center">
            Encontrá tu profesional
          </h1>
          <p className="text-center text-blue-100 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
            Buscá entre miles de profesionales de salud y negocios en LATAM
          </p>

          {/* Search Bar */}
          <div className="relative max-w-xl mx-auto">
            <input
              type="text"
              placeholder="Busca por nombre o especialidad..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-12 rounded-lg bg-white dark:bg-slate-800 text-foreground dark:text-white placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-bookme-mint focus:ring-offset-0 dark:focus:ring-offset-slate-900"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* City Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Ciudad
              </label>
              <input
                type="text"
                placeholder="Ej: Buenos Aires, CABA..."
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-bookme-mint"
              />
            </div>

            {/* Specialty Filter */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Especialidad
              </label>
              <input
                type="text"
                placeholder="Ej: Médico, Abogado..."
                value={specialty}
                onChange={(e) => {
                  setSpecialty(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-bookme-mint"
              />
            </div>

            {/* Line Filter - Placeholder */}
            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                Filtra arriba o selecciona una línea
              </div>
            </div>
          </div>

          {/* Line Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => handleLineChange('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                line === 'all'
                  ? 'bg-bookme-navy text-white dark:bg-bookme-mint dark:text-bookme-navy'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => handleLineChange('healthcare')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                line === 'healthcare'
                  ? 'bg-blue-600 text-white dark:bg-blue-500'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              Salud
            </button>
            <button
              onClick={() => handleLineChange('business')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                line === 'business'
                  ? 'bg-emerald-600 text-white dark:bg-emerald-500'
                  : 'bg-secondary text-foreground hover:bg-muted'
              }`}
            >
              Negocios
            </button>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-bookme-mint animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-destructive/10 border border-destructive text-destructive-foreground p-4 rounded-lg text-center">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && professionals.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground mb-4">
              No se encontraron profesionales con los filtros seleccionados.
            </p>
            <p className="text-sm text-muted-foreground">
              Intenta con otros filtros o términos de búsqueda.
            </p>
          </div>
        )}

        {/* Results Grid */}
        {!loading && professionals.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {professionals.map((prof) => {
                const initials = prof.profile.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase();

                return (
                  <div
                    key={prof.id}
                    className="border border-border rounded-lg overflow-hidden hover:shadow-lg dark:hover:shadow-none transition-all hover:border-bookme-mint bg-card"
                  >
                    {/* Avatar Section */}
                    <div className="bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 h-40 flex items-center justify-center relative">
                      {prof.profile.avatar_url ? (
                        <Image
                          src={prof.profile.avatar_url}
                          alt={prof.profile.full_name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-300 dark:bg-slate-700">
                          <span className="text-3xl font-bold text-slate-600 dark:text-slate-300">
                            {initials}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-5">
                      {/* Line Badge */}
                      <div className="mb-3">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getLineBadgeColor(
                            prof.line
                          )}`}
                        >
                          {getLineLabel(prof.line)}
                        </span>
                      </div>

                      {/* Name */}
                      <h3 className="text-lg font-bold text-foreground mb-1">
                        {prof.profile.full_name}
                      </h3>

                      {/* Specialty */}
                      <p className="text-sm text-muted-foreground mb-3">
                        {prof.specialty}
                      </p>

                      {/* Location */}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
                        <MapPin className="w-4 h-4" />
                        <span>
                          {prof.city}, {prof.province}
                        </span>
                      </div>

                      {/* CTA Button */}
                      <Link
                        href={`/@${prof.public_slug}`}
                        className="w-full inline-block text-center px-4 py-2 rounded-md bg-bookme-navy dark:bg-bookme-mint text-white dark:text-bookme-navy font-medium hover:opacity-90 transition-opacity"
                      >
                        Ver perfil
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={page === 1}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-sm font-medium">Anterior</span>
                </button>

                <div className="text-sm text-muted-foreground">
                  Página {page} de {totalPages}
                </div>

                <button
                  onClick={handleNextPage}
                  disabled={page === totalPages}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="text-sm font-medium">Siguiente</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
