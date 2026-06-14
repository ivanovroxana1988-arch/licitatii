import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

export async function PUT(request: Request, { params }: RouteContext) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;

  try {
    const body = await request.json();
    const selectat = !!body.selectat;

    const { data, error } = await supabase
      .from("aplicari")
      .update({ selectat })
      .eq("id", params.id)
      .select("id, selectat")
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare necunoscuta.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
