'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { LogIn, LogOut, HelpCircle, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', data.user.id)
          .single();
        if (profile) {
          setUser({ name: profile.full_name, role: profile.role });
        }
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = '/login';
  };

  // Ruta home según rol
  const homeRoute = user?.role === 'patient' ? '/mis-turnos' : user?.role === 'professional' ? '/dashboard' : '/';

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
            {user ? (
              <>
                <Link
                  href={homeRoute}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary rounded-md transition-colors"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{user.name}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-bookme-navy dark:text-bookme-mint hover:bg-secondary dark:hover:bg-secondary rounded-md transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span className="hidden sm:inline">Iniciar sesión</span>
              </Link>
            )}
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
