import { useLocalSearchParams } from "expo-router";
import { SprintDetailScreen } from "@/features/sprints/SprintDetailScreen";
import { SprintListScreen } from "@/features/sprints/SprintListScreen";

export default function SprintDetailRoute() {
  const { sprintId } = useLocalSearchParams<{ sprintId: string }>();
  const resolvedSprintId = Array.isArray(sprintId) ? sprintId[0] : sprintId;

  if (!resolvedSprintId || resolvedSprintId === "index") {
    return <SprintListScreen />;
  }

  return <SprintDetailScreen sprintId={resolvedSprintId} />;
}
