import AplicareForm from "@/components/AplicareForm";

export default function AplicarePage({ params }: { params: { token: string } }) {
  return <AplicareForm token={params.token} />;
}
