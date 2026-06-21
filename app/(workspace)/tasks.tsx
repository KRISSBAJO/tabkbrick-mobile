import { useCallback } from "react";
import { ResourceListScreen, type ResourceItem } from "@/features/workspace/ResourceListScreen";
import { listTasks } from "@/lib/api";

export default function TasksScreen() {
  const load = useCallback(async (token: string): Promise<ResourceItem[]> => {
    const page = await listTasks(token, { limit: 20 });
    const data = Array.isArray(page) ? page : page.data;

    return data.map((task) => ({
      description: task.project?.name ?? task.type,
      id: task.id,
      status: task.status,
      title: task.title,
    }));
  }, []);

  return (
    <ResourceListScreen
      emptyText="No tasks found."
      load={load}
      title="Tasks"
    />
  );
}
