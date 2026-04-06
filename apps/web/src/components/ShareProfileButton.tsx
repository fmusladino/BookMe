'use client';

import { Share2, Check } from 'lucide-react';
import { useState } from 'react';

interface ShareProfileButtonProps {
  slug: string;
  name: string;
}

export default function ShareProfileButton({ slug, name }: ShareProfileButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bookme.ar';
    const profileUrl = `${baseUrl}/@${slug}`;

    // Try native share API first (works on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${name} en BookMe`,
          text: `Reserva tu turno con ${name}`,
          url: profileUrl,
        });
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
      }
    }

    // Fall back to clipboard
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center justify-center gap-2 border-2 border-teal-500 text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-950 font-semibold py-3 px-8 rounded-lg transition-colors"
    >
      {copied ? (
        <>
          <Check className="w-5 h-5" />
          <span>Copiado</span>
        </>
      ) : (
        <>
          <Share2 className="w-5 h-5" />
          <span>Compartir perfil</span>
        </>
      )}
    </button>
  );
}
