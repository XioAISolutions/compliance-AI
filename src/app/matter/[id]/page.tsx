import { MatterWorkspace } from "@/components/matter-workspace";

export default async function MatterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatterWorkspace matterId={id} />;
}
