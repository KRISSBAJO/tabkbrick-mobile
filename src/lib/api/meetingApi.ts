import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type ListMeetingsQuery = OpenApiQuery<"/api/v1/meetings", "get">;
type ListMeetingTypesQuery = OpenApiQuery<"/api/v1/meetings/types", "get">;
type ListMeetingAvailabilityQuery = OpenApiQuery<"/api/v1/meetings/availability", "get">;
type ListBookingPagesQuery = OpenApiQuery<"/api/v1/meetings/booking/pages", "get">;
type ListBookingRequestsQuery = OpenApiQuery<"/api/v1/meetings/booking/requests", "get">;
type ListMeetingReminderJobsQuery = OpenApiQuery<"/api/v1/meetings/reminder-jobs", "get">;
export type CreateMeetingPayload = OpenApiJsonBody<"/api/v1/meetings", "post">;
export type UpdateMeetingPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}", "patch">;
export type CancelMeetingPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/cancel", "post">;
export type CreateMeetingTypePayload = OpenApiJsonBody<"/api/v1/meetings/types", "post">;
export type UpdateMeetingTypePayload = OpenApiJsonBody<"/api/v1/meetings/types/{typeId}", "patch">;
export type CreateMeetingAvailabilityWindowPayload = OpenApiJsonBody<"/api/v1/meetings/availability/windows", "post">;
export type CreateBookingPagePayload = OpenApiJsonBody<"/api/v1/meetings/booking/pages", "post">;
export type UpdateBookingPagePayload = OpenApiJsonBody<"/api/v1/meetings/booking/pages/{pageId}", "patch">;
export type UpdateMeetingIntegrationSettingsPayload = OpenApiJsonBody<"/api/v1/meetings/integrations/settings", "patch">;
export type ProcessMeetingReminderJobsPayload = OpenApiJsonBody<"/api/v1/meetings/reminder-jobs/process", "post">;
export type CreateMeetingConferencePayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/conference", "post">;
export type LinkMeetingAiContextPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/ai/links", "patch">;
export type MeetingAiGeneratePayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/ai/agenda", "post">;
export type MeetingAiRoleSummaryPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/ai/role-summary", "post">;
export type ConvertMeetingActionItemsPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/ai/action-items/convert-tasks", "post">;
export type ScheduleMeetingFollowUpsPayload = OpenApiJsonBody<"/api/v1/meetings/{meetingId}/ai/action-items/follow-up-reminders", "post">;

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

export function createMeeting(token: string, body: CreateMeetingPayload) {
  return openApiRequest("/api/v1/meetings", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateMeeting(token: string, meetingId: string, body: UpdateMeetingPayload) {
  return openApiRequest("/api/v1/meetings/{meetingId}", "patch", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function cancelMeeting(token: string, meetingId: string, body: CancelMeetingPayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/cancel", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function startMeeting(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}/start", "post", {
    token,
    pathParams: { meetingId },
  });
}

export function completeMeeting(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}/complete", "post", {
    token,
    pathParams: { meetingId },
  });
}

export function archiveMeeting(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}/archive", "post", {
    token,
    pathParams: { meetingId },
  });
}

export function restoreMeeting(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}/restore", "post", {
    token,
    pathParams: { meetingId },
  });
}

export function listMeetingTypes(token: string, query: ListMeetingTypesQuery = {}) {
  return openApiRequest("/api/v1/meetings/types", "get", {
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

export function createMeetingType(token: string, body: CreateMeetingTypePayload) {
  return openApiRequest("/api/v1/meetings/types", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateMeetingType(token: string, typeId: string, body: UpdateMeetingTypePayload) {
  return openApiRequest("/api/v1/meetings/types/{typeId}", "patch", {
    token,
    body,
    pathParams: { typeId },
  });
}

export function listMeetingAvailability(token: string, query: ListMeetingAvailabilityQuery = {}) {
  return openApiRequest("/api/v1/meetings/availability", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function createMeetingAvailabilityWindow(token: string, body: CreateMeetingAvailabilityWindowPayload) {
  return openApiRequest("/api/v1/meetings/availability/windows", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function deleteMeetingAvailabilityWindow(token: string, windowId: string) {
  return openApiRequest("/api/v1/meetings/availability/windows/{windowId}", "delete", {
    token,
    pathParams: { windowId },
  });
}

export function listBookingPages(token: string, query: ListBookingPagesQuery = {}) {
  return openApiRequest("/api/v1/meetings/booking/pages", "get", {
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

export function createBookingPage(token: string, body: CreateBookingPagePayload) {
  return openApiRequest("/api/v1/meetings/booking/pages", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateBookingPage(token: string, pageId: string, body: UpdateBookingPagePayload) {
  return openApiRequest("/api/v1/meetings/booking/pages/{pageId}", "patch", {
    token,
    body,
    pathParams: { pageId },
  });
}

export function listBookingRequests(token: string, query: ListBookingRequestsQuery = {}) {
  return openApiRequest("/api/v1/meetings/booking/requests", "get", {
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

export function getMeetingIntegrationStatus(token: string) {
  return openApiRequest("/api/v1/meetings/integrations/status", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function getMeetingIntegrationSettings(token: string) {
  return openApiRequest("/api/v1/meetings/integrations/settings", "get", {
    token,
    cache: "no-store",
    pathParams: {},
  });
}

export function updateMeetingIntegrationSettings(token: string, body: UpdateMeetingIntegrationSettingsPayload) {
  return openApiRequest("/api/v1/meetings/integrations/settings", "patch", {
    token,
    body,
    pathParams: {},
  });
}

export function listMeetingReminderJobs(token: string, query: ListMeetingReminderJobsQuery = {}) {
  return openApiRequest("/api/v1/meetings/reminder-jobs", "get", {
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

export function processMeetingReminderJobs(token: string, body: ProcessMeetingReminderJobsPayload = {}) {
  return openApiRequest("/api/v1/meetings/reminder-jobs/process", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function retryMeetingReminderJob(token: string, jobId: string) {
  return openApiRequest("/api/v1/meetings/reminder-jobs/{jobId}/retry", "post", {
    token,
    pathParams: { jobId },
  });
}

export function createMeetingConference(token: string, meetingId: string, body: CreateMeetingConferencePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/conference", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function getMeetingAiState(token: string, meetingId: string) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai", "get", {
    token,
    cache: "no-store",
    pathParams: { meetingId },
  });
}

export function linkMeetingAiContext(token: string, meetingId: string, body: LinkMeetingAiContextPayload) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/links", "patch", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function generateMeetingAiAgenda(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/agenda", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function generateMeetingAiPreparationBrief(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/preparation-brief", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function detectMeetingAiRisks(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/risk-detection", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function suggestMeetingAiAttendees(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/suggest-attendees", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function generateMeetingAiNotes(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/notes", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function generateMeetingAiFollowUp(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/follow-up", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function generateMeetingAiRoleSummary(token: string, meetingId: string, body: MeetingAiRoleSummaryPayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/role-summary", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function scoreMeetingAiEffectiveness(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/effectiveness-score", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function detectMeetingAiMissedDecisions(token: string, meetingId: string, body: MeetingAiGeneratePayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/missed-decisions", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function convertMeetingAiActionItems(token: string, meetingId: string, body: ConvertMeetingActionItemsPayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/action-items/convert-tasks", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}

export function scheduleMeetingAiFollowUpReminders(token: string, meetingId: string, body: ScheduleMeetingFollowUpsPayload = {}) {
  return openApiRequest("/api/v1/meetings/{meetingId}/ai/action-items/follow-up-reminders", "post", {
    token,
    body,
    pathParams: { meetingId },
  });
}
