import Constants from "expo-constants";
import type { paths } from "@/lib/generated/openapi";

const fallbackApiUrl = "http://localhost:4070/api/v1";
const configuredApiUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ??
  fallbackApiUrl;

function normalizeApiBaseUrl(value: string) {
  return value
    .trim()
    .replace(/\/$/, "")
    .replace(/\/api$/, "/api/v1");
}

function createRequestId() {
  return `tb-mobile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiUrl);
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/v\d+$/i, "");

export type RequestOptions = RequestInit & {
  token?: string | null;
};

export type OpenApiHttpMethod = "get" | "post" | "patch" | "put" | "delete";
export type OpenApiPath = keyof paths & `/api/v1/${string}`;
export type OpenApiMethod<TPath extends OpenApiPath> = Extract<keyof paths[TPath], OpenApiHttpMethod>;
export type OpenApiOperation<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> = paths[TPath][TMethod];
export type OpenApiPathParams<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> =
  OpenApiOperation<TPath, TMethod> extends { parameters: { path: infer TParams } } ? TParams : Record<string, never>;
export type OpenApiQuery<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> =
  OpenApiOperation<TPath, TMethod> extends { parameters: { query?: infer TParams } } ? NonNullable<TParams> : never;
type OpenApiRequestBody<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> =
  "requestBody" extends keyof OpenApiOperation<TPath, TMethod>
    ? NonNullable<OpenApiOperation<TPath, TMethod>["requestBody"]>
    : never;
export type OpenApiJsonBody<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> =
  OpenApiRequestBody<TPath, TMethod> extends { content: { "application/json": infer TBody } }
    ? TBody
    : never;
type OpenApiJsonResponseBody<TResponse> =
  TResponse extends { content: { "application/json": infer TBody } } ? TBody : null;
type OpenApiStatusResponse<TResponses, TStatus extends number> =
  TStatus extends keyof TResponses
    ? OpenApiJsonResponseBody<TResponses[TStatus]>
    : `${TStatus}` extends keyof TResponses
      ? OpenApiJsonResponseBody<TResponses[`${TStatus}`]>
      : never;
export type OpenApiResponse<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>> =
  OpenApiOperation<TPath, TMethod> extends { responses: infer TResponses }
    ? OpenApiStatusResponse<TResponses, 200>
      | OpenApiStatusResponse<TResponses, 201>
      | OpenApiStatusResponse<TResponses, 202>
      | OpenApiStatusResponse<TResponses, 204>
    : never;

export class ApiError extends Error {
  status: number;
  details: unknown;
  requestId?: string;

  constructor(status: number, message: string, details: unknown, requestId?: string) {
    super(message);
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

function resolveUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function resolveOpenApiPath<TPath extends OpenApiPath, TMethod extends OpenApiMethod<TPath>>(
  path: TPath,
  pathParams: OpenApiPathParams<TPath, TMethod>,
) {
  const params = pathParams as Record<string, string | number | boolean | null | undefined>;
  return path
    .replace(/^\/api\/v1/, "")
    .replace(/\{([^}]+)\}/g, (_, key: string) => {
      const value = params[key];
      if (value === undefined || value === null) {
        throw new Error(`Missing OpenAPI path parameter: ${key}`);
      }

      return encodeURIComponent(String(value));
    });
}

function resolveOpenApiQueryString(query: Record<string, unknown> | undefined) {
  if (!query) return "";

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      return;
    }

    params.set(key, String(value));
  });

  const text = params.toString();
  return text ? `?${text}` : "";
}

function readErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }

  return "TaskBricks API request failed";
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return text;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, headers, body, ...init } = options;
  const requestHeaders = new Headers(headers);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  requestHeaders.set("X-TaskBricks-Client", "mobile");
  if (!requestHeaders.has("X-Request-Id")) {
    requestHeaders.set("X-Request-Id", createRequestId());
  }
  if (!isFormData && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(resolveUrl(path), {
    ...init,
    body,
    headers: requestHeaders,
  });
  const payload = await parseResponse(response);
  const requestId = response.headers.get("x-request-id") ?? requestHeaders.get("X-Request-Id") ?? undefined;

  if (!response.ok) {
    throw new ApiError(response.status, readErrorMessage(payload), payload, requestId);
  }

  return payload as T;
}

export function openApiRequest<
  TPath extends OpenApiPath,
  TMethod extends OpenApiMethod<TPath>,
>(
  path: TPath,
  method: TMethod,
  options: Omit<RequestOptions, "body" | "method"> & {
    body?: OpenApiJsonBody<TPath, TMethod>;
    pathParams: OpenApiPathParams<TPath, TMethod>;
    query?: OpenApiQuery<TPath, TMethod>;
  },
): Promise<OpenApiResponse<TPath, TMethod>> {
  const { body, pathParams, query, ...requestOptions } = options;
  const requestPath = `${resolveOpenApiPath<TPath, TMethod>(path, pathParams)}${resolveOpenApiQueryString(query)}`;

  return apiRequest<OpenApiResponse<TPath, TMethod>>(requestPath, {
    ...requestOptions,
    method: method.toUpperCase(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function boundedLimit(value: number | undefined, fallback = 50) {
  return Math.min(Math.max(value ?? fallback, 1), 100);
}
