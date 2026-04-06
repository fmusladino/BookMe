import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Singleton: reutiliza la misma instancia del cliente en todo el browser.
// Evita crear múltiples instancias (una por cada componente que lo importe).
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function createClient() {
  if (client) return client;

  client = createBrowserClient<Database>(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!
  );

  return client;
}
