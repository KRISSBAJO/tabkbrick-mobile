import { openApiRequest, type OpenApiJsonBody } from "@/lib/api/request";

export type CreateUploadIntentPayload = OpenApiJsonBody<"/api/v1/files/upload-intents", "post">;
export type CreateFileAssetPayload = OpenApiJsonBody<"/api/v1/files", "post">;

export function createUploadIntent(token: string, body: CreateUploadIntentPayload) {
  return openApiRequest("/api/v1/files/upload-intents", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function createFileAsset(token: string, body: CreateFileAssetPayload) {
  return openApiRequest("/api/v1/files", "post", {
    token,
    body,
    pathParams: {},
  });
}
