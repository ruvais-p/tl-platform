import { ResourceWorkspace } from "@/components/staff/resource-workspace";
import { redirect } from "next/navigation";

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource } = await params;
  if (resource === "career-opportunities") redirect("/opportunities");
  return <ResourceWorkspace resourceKey={resource} />;
}
