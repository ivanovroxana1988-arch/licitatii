// app/api/admin/radar/route.ts
// GET  → descoperă licitațiile deschise relevante din e-licitatie.ro (read-only)
// POST → importă o licitație selectată în tabela `licitatii` (status draft)
//
// Convenții preluate din restul aplicației: runtime nodejs, requireAdmin(), Supabase.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";
import { discoverNotices } from "@/lib/seap";

export const runtime = "nodejs";
// Descoperirea face mai multe cereri către SEAP — lăsăm timp suficient.
export const maxDuration = 60;

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const rows = await discoverNotices();
    return NextResponse.json({ rows, generatedAt: Date.now(), count: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Eroare la descoperirea licitatiilor.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  const body = (await request.json().catch(() => null)) as
    | { noticeNo?: string; title?: string; authority?: string; link?: string }
    | null;

  if (!body?.title) {
    return NextResponse.json({ error: "Lipsesc datele licitatiei (title)." }, { status: 400 });
  }

  // Verificăm dacă licitația a fost deja importată (după referință = noticeNo).
  if (body.noticeNo) {
    const { data: existing } = await supabase
      .from("licitatii")
      .select("id")
      .eq("referinta", body.noticeNo)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ alreadyExists: true, id: existing.id });
    }
  }

  const { data: licitatie, error } = await supabase
    .from("licitatii")
    .insert({
      nume: body.title,
      referinta: body.noticeNo ?? null,
      beneficiar: body.authority ?? null,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !licitatie) {
    return NextResponse.json({ error: error?.message ?? "Nu am putut importa licitatia." }, { status: 500 });
  }

  return NextResponse.json({ id: licitatie.id, imported: true });
}
