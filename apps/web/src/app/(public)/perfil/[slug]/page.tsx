import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { MapPin, Clock, DollarSign, Share2, ArrowLeft, Calendar } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import ShareProfileButton from '@/components/ShareProfileButton';
import Link from 'next/link';
import Image from 'next/image';

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

// Fetch professional data server-side for SEO
async function getProfessionalData(slug: string) {
  const supabase = createAdminClient();

  // 1. Fetch professional
  const { data: professional, error } = await supabase
    .from('professionals')
    .select('id, public_slug, specialty, specialty_slug, bio, city, province, line, is_visible')
    .eq('public_slug', slug)
    .eq('is_visible', true)
    .single();

  if (error || !professional) {
    return null;
  }

  // 2. Fetch profile separately
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', professional.id)
    .single();

  // 3. Fetch services
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price, show_price, is_active')
    .eq('professional_id', professional.id)
    .eq('is_active', true)
    .order('name');

  return {
    professional: {
      ...professional,
      profile: profile || { full_name: 'Profesional', avatar_url: null },
    },
    services: services || [],
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProfessionalData(slug);

  if (!data) {
    return {
      title: 'Profesional no encontrado',
      description: 'El perfil que buscas no está disponible.',
    };
  }

  const { professional } = data;
  const fullName = professional.profile?.full_name || 'Profesional';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bookme.ar';

  return {
    title: `${fullName} - ${professional.specialty} en ${professional.city} | BookMe`,
    description: professional.bio || `Reserva tu turno con ${fullName}, ${professional.specialty} en ${professional.city}.`,
    openGraph: {
      title: `${fullName} - ${professional.specialty}`,
      description: professional.bio || `Reserva tu turno con ${fullName}`,
      url: `${baseUrl}/@${professional.public_slug}`,
      type: 'profile',
      images: professional.profile?.avatar_url
        ? [
            {
              url: professional.profile.avatar_url,
              width: 400,
              height: 400,
              alt: fullName,
            },
          ]
        : [],
    },
  };
}

export default async function ProfessionalProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getProfessionalData(slug);

  if (!data) {
    notFound();
  }

  const { professional, services } = data;
  const fullName = professional.profile?.full_name || 'Profesional';
  const avatarUrl = professional.profile?.avatar_url;
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const lineLabel = professional.line === 'healthcare' ? 'Salud' : 'Negocios';
  const lineColor =
    professional.line === 'healthcare'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-emerald-100 text-emerald-800';

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header Navigation */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center">
          <Link
            href="/directorio"
            className="flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Volver al directorio</span>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          {/* Avatar */}
          <div className="flex justify-center mb-8">
            {avatarUrl ? (
              <div className="relative w-40 h-40">
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  fill
                  className="rounded-full object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="w-40 h-40 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <span className="text-4xl font-bold text-slate-700 dark:text-slate-300">
                  {initials}
                </span>
              </div>
            )}
          </div>

          {/* Name */}
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            {fullName}
          </h1>

          {/* Specialty */}
          <p className="text-xl text-slate-600 dark:text-slate-300 mb-4">
            {professional.specialty}
          </p>

          {/* Location and Line Badge */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <MapPin className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <span>
                {professional.city}, {professional.province}
              </span>
            </div>
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${lineColor}`}
            >
              Línea {lineLabel}
            </span>
          </div>

          {/* Bio */}
          {professional.bio && (
            <p className="text-lg text-slate-700 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
              {professional.bio}
            </p>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Link
              href={`/book/${professional.public_slug}`}
              className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Reservar turno
            </Link>
            <ShareProfileButton slug={professional.public_slug} name={fullName} />
          </div>
        </section>

        {/* Services Section */}
        {services.length > 0 && (
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-left">
              Servicios
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="p-6 border border-slate-200 dark:border-slate-700 rounded-lg hover:shadow-lg dark:hover:shadow-none dark:hover:border-teal-500 transition-all"
                >
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
                    {service.name}
                  </h3>

                  {/* Service Details */}
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span>{service.duration_minutes} min</span>
                    </div>

                    {service.show_price && service.price && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-4 h-4 text-teal-500" />
                        <span className="font-semibold text-slate-900 dark:text-white">
                          ${service.price.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Service CTA Button */}
                  <Link
                    href={`/book/${professional.public_slug}?serviceId=${service.id}`}
                    className="w-full inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Reservar
                  </Link>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Bottom CTA */}
        <section className="text-center py-12 border-t border-slate-200 dark:border-slate-800">
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            ¿Listo para reservar tu turno?
          </p>
          <Link
            href={`/book/${professional.public_slug}`}
            className="inline-flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Reservar ahora
          </Link>
        </section>
      </main>
    </div>
  );
}
