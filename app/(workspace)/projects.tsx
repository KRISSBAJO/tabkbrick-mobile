import { useCallback } from "react";
import { ResourceListScreen, type ResourceItem } from "@/features/workspace/ResourceListScreen";
import { listProjects } from "@/lib/api";

export default function ProjectsScreen() {
  const load = useCallback(async (token: string): Promise<ResourceItem[]> => {
    const page = await listProjects(token, { limit: 20 });
    const data = Array.isArray(page) ? page : page.data;

    return data.map((project) => ({
      description: project.description,
      id: project.id,
      status: project.status,
      title: project.name,
    }));
  }, []);

  return (
    <ResourceListScreen
      emptyText="No projects found."
      load={load}
      title="Projects"
    />
  );
}
