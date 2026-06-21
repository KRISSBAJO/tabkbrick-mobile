import { boundedLimit, openApiRequest, type OpenApiQuery } from "@/lib/api/request";

type ListMeetingsQuery = OpenApiQuery<"/api/v1/meetings", "get">;

export function listMeetings(token: string, query: ListMeetingsQuery = {}) {
  return openApiRequest("/api/v1/meetings", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 50),
    },
  });
}

export function getMeeting(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}", "get", {
    token,
    cache: "no-store",
    pathParams: { meetingId },
  });
}
