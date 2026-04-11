import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { MapPin, ArrowLeft, Search } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import { unslugify, unslugifyCity, getAllCitySpecialtyCombinations } from '@/lib/slug-utils';

interface PageProps {
  params: Promise<{
    city: string;
    specialty: string;
  }>;
}

/**
 * Fetch professionals matching city and specialty
 */
async function getProfessionals(city: string, specialty: string) {
  const supabase = createAdminClient();

  // Normalize the search parameters to match database values
  const displayCity = unslugifyCity(city);
  const displaySpecialty = unslugify(specialty);

  const { data: professionals, error } = await supabase
    .from('professionals')
    .select(`
      id,
      public_slug,
      specialty,
      specialty_slug,
      city,
      province,
      is_visible,
      profile:profiles!id(full_name, avatar_url)
    `)
    .eq('specialty_slug', specialty)
    .ilike('city', displayCity)
    .eq('is_visible', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching professionals:', error);
    return [];
  }

  return professionals || [];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city, specialty } = await params;
  const displayCity = unslugifyCity(city);
  const displaySpecialty = unslugify(specialty);

  const title = `${displaySpecialty} en ${displayCity} | BookMe`;
  const description = `Encontrá los mejores ${displaySpecialty.toLowerCase()} en ${displayCity}. Reservá tu turno online en BookMe.`;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bookme.ar';
  const canonicalUrl = `${baseUrl}/directorio/${city}/${specialty}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      siteName: 'BookMe',
    },
  };
}

export async function generateStaticParams() {
  return getAllCitySpecialtyCombinations();
}

export default async function DirectoryLandingPage({
  params,
}: PageProps) {
  const { city, specialty } = await params;
  const professionals = await getProfessionals(city, specialty);
  const displayCity = unslugifyCity(city);
  const displaySpecialty = unslugify(specialty);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            href="/directorio"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al directorio</span>
          </Link>
          <Link
            href="/"
            className="text-slate-900 dark:text-white font-bold text-lg"
          >
            BookMe
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="mb-16">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              {displaySpecialty} en {displayCity}
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl">
              Encontrá los mejores {displaySpecialty.toLowerCase()} en {displayCity} y reservá tu turno online de forma rápida y segura.
            </p>
          </div>
        </section>

        {/* Professionals Grid */}
        {professionals.length > 0 ? (
          <section className="mb-16">
            <div className="mb-8 flex items-center gap-2">
              <Search className="w-5 h-5 text-teal-500" />
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                {professionals.length} profesional{professionals.length !== 1 ? 'es' : ''} disponible{professionals.length !== 1 ? 's' : ''}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {professionals.map((professional) => {
                const fullName = professional.profile?.full_name || 'Profesional';
                const avatarUrl = professional.profile?.avatar_url;
                const initials = fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase();

                return (
                  <Link
                    key={professional.id}
                    href={`/@${professional.public_slug}`}
                    className="group h-full"
                  >
                    <div className="h-full p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-none dark:hover:border-teal-500 transition-all duration-300 hover:border-teal-500 flex flex-col gap-4">
                      {/* Avatar */}
                      <div className="flex justify-center">
                        {avatarUrl ? (
                          <div className="relative w-24 h-24">
                            <Image
                              src={avatarUrl}
                              alt={fullName}
                              fill
                              className="rounded-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                            <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                              {initials}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Professional Info */}
                      <div className="text-center flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-teal-500 transition-colors">
                          {fullName}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                          {professional.specialty}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <MapPin className="w-4 h-4" />
                          <span>
                            {professional.city}
                            {professional.province && `, ${professional.province}`}
                          </span>
                        </div>
                      </div>

                      {/* CTA Button */}
                      <button className="w-full bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-lg transition-colors">
                        Ver perfil
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="mb-16 py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 mb-6">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
              Aún no hay {displaySpecialty.toLowerCase()} registrados en {displayCity}
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
              Sé de los primeros en registrarte y conectá con miles de pacientes y clientes.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              ¿Sos profesional? Registrate en BookMe
            </Link>
          </section>
        )}

        {/* Additional CTA Section */}
        <section className="py-12 rounded-lg bg-gradient-to-r from-teal-50 to-blue-50 dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            ¿Necesitás otro servicio?
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Explora nuestro directorio completo de profesionales de salud y servicios en {displayCity}.
          </p>
          <Link
            href="/directorio"
            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            <Search className="w-5 h-5" />
            Ir al directorio
          </Link>
        </section>
      </main>
    </div>
  );
}
