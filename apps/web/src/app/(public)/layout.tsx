'use client';

import Link from 'next/link';
import { LogIn, HelpCircle } from 'lucide-react';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Logo / Home Link */}
          <Link
            href="/"
            className="flex items-center gap-2 text-2xl font-bold text-bookme-navy dark:text-bookme-mint hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-bookme-navy dark:bg-bookme-mint flex items-center justify-center">
              <span className="text-white dark:text-bookme-navy font-bold text-lg">B</span>
            </div>
            <span className="hidden sm:inline">BookMe</span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link
              href="/soporte"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Ayuda
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-bookme-navy dark:text-bookme-mint hover:bg-secondary dark:hover:bg-secondary rounded-md transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Iniciar sesión</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; 2026 BookMe. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <Link href="/soporte" className="hover:text-foreground transition-colors">Centro de Ayuda</Link>
            <a href="mailto:soporte@bookme.ar" className="hover:text-foreground transition-colors">soporte@bookme.ar</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
