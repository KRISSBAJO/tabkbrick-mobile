import { boundedLimit, openApiRequest, type OpenApiQuery, type OpenApiResponse } from "@/lib/api/request";

type GlobalSearchQuery = OpenApiQuery<"/api/v1/search", "get">;
export type GlobalSearchResponse = NonNullable<OpenApiResponse<"/api/v1/search", "get">>;
export type GlobalSearchResult = GlobalSearchResponse["data"][number];

export function globalSearch(token: string, query: GlobalSearchQuery) {
  return openApiRequest("/api/v1/search", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      category: query.category ?? "all",
      limit: boundedLimit(query.limit, 8),
      page: query.page ?? 1,
      search: query.search?.trim(),
    },
  });
}
