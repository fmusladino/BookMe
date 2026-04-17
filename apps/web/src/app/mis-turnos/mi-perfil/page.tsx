"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { AvatarUpload } from "@/components/avatar-upload";

export default function MiPerfilPage() {
  const { user, loading, refresh } = useSession();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Necesitás iniciar sesión para ver tu perfil.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi perfil</h1>
        <p className="text-muted-foreground text-sm">
          Administrá tu foto de perfil y datos personales.
        </p>
      </div>

      {/* Foto de perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Foto de perfil</CardTitle>
          <CardDescription>
            Tu foto se muestra junto a tus turnos y reservas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarUpload
            currentUrl={user.avatar_url}
            fallbackName={user.full_name}
            table="profiles"
            onAvatarChange={() => refresh()}
          />
        </CardContent>
      </Card>

      {/* Datos personales (solo lectura por ahora) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos personales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Nombre completo</p>
            <p className="font-medium">{user.full_name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
