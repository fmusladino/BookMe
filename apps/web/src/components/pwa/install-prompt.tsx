"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Banner que invita al usuario a instalar la PWA.
 * Aparece en mobile después de 30 segundos si no fue instalada ni descartada antes.
 * En iOS muestra instrucciones manuales (Safari no soporta beforeinstallprompt).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detectar si ya está instalada como PWA
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setIsStandalone(standalone);

    if (standalone) return;

    // Detectar iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    // Verificar si el usuario ya descartó el banner
    const dismissed = localStorage.getItem("bookme-install-dismissed");
    if (dismissed) {
      const dismissedAt = new Date(dismissed);
      const daysSince = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      // Volver a mostrar después de 7 días
      if (daysSince < 7) return;
    }

    // En Android/Chrome: capturar el evento beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Mostrar banner después de 30s de uso
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 30000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("bookme-install-dismissed", new Date().toISOString());
  };

  // No mostrar si ya está instalada o si el banner no debe verse
  if (isStandalone || !showBanner) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header con botón de cerrar */}
        <div className="flex items-start justify-between p-4 pb-0">
          <div className="flex items-center gap-3">
            <Image
              src="/icons/icon-192x192.png"
              alt="BookMe"
              width={48}
              height={48}
              className="rounded-xl"
            />
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                Instalá BookMe
              </h3>
              <p className="text-xs text-muted-foreground">
                Acceso rápido desde tu celular
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 pt-3">
          {isIOS ? (
            // Instrucciones para iOS (Safari)
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para instalar BookMe en tu iPhone:
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
                  <span>Tocá el botón <strong>Compartir</strong> (el cuadrado con flecha) en Safari</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
                  <span>Deslizá y seleccioná <strong>&quot;Agregar a inicio&quot;</strong></span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
                  <span>Tocá <strong>&quot;Agregar&quot;</strong> para confirmar</span>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Entendido
              </button>
            </div>
          ) : deferredPrompt ? (
            // Android/Chrome: botón de instalación directo
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Agregá BookMe a tu pantalla de inicio para acceder más rápido a tus turnos.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDismiss}
                  className="flex-1 rounded-lg border border-input py-2.5 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Ahora no
                </button>
                <button
                  onClick={handleInstall}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Download className="h-4 w-4" />
                  Instalar
                </button>
              </div>
            </div>
          ) : (
            // Fallback: instrucciones genéricas
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Abrí BookMe en el navegador de tu celular y usá la opción &quot;Agregar a pantalla de inicio&quot; del menú.
              </p>
              <button
                onClick={handleDismiss}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Entendido
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
