import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";
type Ctx = { params: { id: string } };

export async function POST(request: Request, { params }: Ctx) {
  const { supabase, response } = await requireAdmin();
  if (response) return response;
  const { data, error } = await supabase.from("aplicari").insert({ licitatie_id: params.id, status: "invitat" }).select("id,token,status,creat_la").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aplicare: data, link: `${new URL(request.url).origin}/aplica/${data.token}` });
}
