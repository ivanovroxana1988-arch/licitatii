import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

// Supabase trimite utilizatorul aici după ce dă click pe linkul din email.
// Schimbăm codul (flux PKCE) pentru o sesiune, apoi îl ducem mai departe.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  // Token vechi (flux implicit) trimite token_hash + type în loc de code.
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "recovery",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Eșec: ducem utilizatorul la login cu un marcaj de eroare.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
