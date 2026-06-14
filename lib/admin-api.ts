import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      supabase,
      response: NextResponse.json({ error: "Trebuie sa fii autentificat ca admin." }, { status: 401 }),
    };
  }

  return { supabase, response: null };
}
