import { ResourceWorkspace } from "@/components/staff/resource-workspace";

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  return <ResourceWorkspace resourceKey={resource} />;
}
