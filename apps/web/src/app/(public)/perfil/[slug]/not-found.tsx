import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-slate-900 dark:text-white mb-4">404</h1>
        <p className="text-2xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Profesional no encontrado
        </p>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
          El perfil que buscas no está disponible. Quizás fue eliminado o el enlace es incorrecto.
        </p>
        <Link
          href="/directorio"
          className="inline-flex items-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Volver al directorio
        </Link>
      </div>
    </div>
  );
}
