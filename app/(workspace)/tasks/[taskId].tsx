import { useLocalSearchParams } from "expo-router";
import { TaskDetailScreen } from "@/features/tasks/TaskDetailScreen";

export default function TaskDetailRoute() {
  const { returnTo, taskId } = useLocalSearchParams<{ returnTo?: string | string[]; taskId?: string }>();
  const safeReturnTo = Array.isArray(returnTo) ? returnTo[0] : returnTo;

  return <TaskDetailScreen returnTo={safeReturnTo} taskId={String(taskId ?? "")} />;
}
