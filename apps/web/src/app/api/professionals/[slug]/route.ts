import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/professionals/[slug]
 * Fetch a single professional by public_slug with their profile and services.
 * Public endpoint — no authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch professional by public_slug
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('id, public_slug, specialty, specialty_slug, bio, city, province, line, is_visible, subscription_status')
      .eq('public_slug', slug)
      .eq('is_visible', true)
      .single();

    if (profError || !professional) {
      return NextResponse.json(
        { error: 'Professional not found' },
        { status: 404 }
      );
    }

    // 2. Fetch profile separately
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone')
      .eq('id', professional.id)
      .single();

    // 3. Fetch services
    const { data: services } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price, show_price, is_active')
      .eq('professional_id', professional.id)
      .eq('is_active', true)
      .order('name');

    return NextResponse.json({
      professional: {
        ...professional,
        profile: profile || { id: professional.id, full_name: 'Profesional', avatar_url: null, phone: null },
        services: services ?? [],
      },
    });
  } catch (error) {
    console.error('Error in GET /api/professionals/[slug]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
