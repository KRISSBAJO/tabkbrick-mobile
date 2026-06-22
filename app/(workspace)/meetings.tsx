import { useCallback } from "react";
import { ResourceListScreen, type ResourceItem } from "@/features/workspace/ResourceListScreen";
import { listMeetings } from "@/lib/api";

export default function MeetingsScreen() {
  const load = useCallback(async (token: string): Promise<ResourceItem[]> => {
    const page = await listMeetings(token, { limit: 20 });
    const data = Array.isArray(page) ? page : page.data;

    return data.map((meeting) => ({
      description: meeting.startAt ? new Date(meeting.startAt).toLocaleString() : meeting.locationMode,
      id: meeting.id,
      status: meeting.status,
      title: meeting.title,
    }));
  }, []);

  return (
    <ResourceListScreen
      emptyText="No meetings found."
      load={load}
      title="Meetings"
    />
  );
}
