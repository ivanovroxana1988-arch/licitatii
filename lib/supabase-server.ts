import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Client pentru server (Server Components, Route Handlers).
// Folosește sesiunea adminului din cookies.
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Apelat dintr-un Server Component fără răspuns mutabil — ignorăm.
          }
        },
      },
    }
  );
}

// Client cu service_role: ocolește RLS. Folosit DOAR în rute server,
// după ce am validat tokenul formatorului. Nu se folosește niciodată
// în cod care ajunge în browser.
import { createClient as createAdminBase } from "@supabase/supabase-js";

export function createServiceClient() {
  return createAdminBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
