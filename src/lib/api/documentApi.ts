import { boundedLimit, openApiRequest, type OpenApiJsonBody, type OpenApiQuery } from "@/lib/api/request";

type FolderTreeQuery = OpenApiQuery<"/api/v1/document-folders/tree", "get">;
type ListDocumentFoldersQuery = OpenApiQuery<"/api/v1/document-folders", "get">;
type ListDocumentsQuery = OpenApiQuery<"/api/v1/documents", "get">;
export type CreateDocumentFolderPayload = OpenApiJsonBody<"/api/v1/document-folders", "post">;
export type CreateDocumentPayload = OpenApiJsonBody<"/api/v1/documents", "post">;
export type RestoreDocumentVersionPayload = OpenApiJsonBody<"/api/v1/documents/{documentId}/versions/{version}/restore", "post">;
export type UpdateDocumentFolderPayload = OpenApiJsonBody<"/api/v1/document-folders/{folderId}", "patch">;
export type UpdateDocumentPayload = OpenApiJsonBody<"/api/v1/documents/{documentId}", "patch">;

export function getDocumentFolderTree(token: string, query: FolderTreeQuery) {
  return openApiRequest("/api/v1/document-folders/tree", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query,
  });
}

export function listDocumentFolders(token: string, query: ListDocumentFoldersQuery = {}) {
  return openApiRequest("/api/v1/document-folders", "get", {
    token,
    cache: "no-store",
    pathParams: {},
    query: {
      ...query,
      page: query.page ?? 1,
      limit: boundedLimit(query.limit, 100),
    },
  });
}

export function createDocumentFolder(token: string, body: CreateDocumentFolderPayload) {
  return openApiRequest("/api/v1/document-folders", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function updateDocumentFolder(token: string, folderId: string, body: UpdateDocumentFolderPayload) {
  return openApiRequest("/api/v1/document-folders/{folderId}", "patch", {
    token,
    body,
    pathParams: { folderId },
  });
}

export function archiveDocumentFolder(token: string, folderId: string) {
  return openApiRequest("/api/v1/document-folders/{folderId}/archive", "post", {
    token,
    pathParams: { folderId },
  });
}

export function restoreDocumentFolder(token: string, folderId: string) {
  return openApiRequest("/api/v1/document-folders/{folderId}/restore", "post", {
    token,
    pathParams: { folderId },
  });
}

export function deleteDocumentFolder(token: string, folderId: string) {
  return openApiRequest("/api/v1/document-folders/{folderId}", "delete", {
    token,
    pathParams: { folderId },
  });
}

export function listDocuments(token: string, query: ListDocumentsQuery = {}) {
  return openApiRequest("/api/v1/documents", "get", {
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

export function createDocument(token: string, body: CreateDocumentPayload) {
  return openApiRequest("/api/v1/documents", "post", {
    token,
    body,
    pathParams: {},
  });
}

export function getDocument(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}", "get", {
    token,
    cache: "no-store",
    pathParams: { documentId },
  });
}

export function updateDocument(token: string, documentId: string, body: UpdateDocumentPayload) {
  return openApiRequest("/api/v1/documents/{documentId}", "patch", {
    token,
    body,
    pathParams: { documentId },
  });
}

export function publishDocument(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}/publish", "post", {
    token,
    pathParams: { documentId },
  });
}

export function archiveDocument(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}/archive", "post", {
    token,
    pathParams: { documentId },
  });
}

export function restoreDocument(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}/restore", "post", {
    token,
    pathParams: { documentId },
  });
}

export function hardDeleteDocument(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}/hard-delete", "delete", {
    token,
    pathParams: { documentId },
  });
}

export function listDocumentVersions(token: string, documentId: string) {
  return openApiRequest("/api/v1/documents/{documentId}/versions", "get", {
    token,
    cache: "no-store",
    pathParams: { documentId },
  });
}

export function restoreDocumentVersion(token: string, documentId: string, version: string, body: RestoreDocumentVersionPayload = {}) {
  return openApiRequest("/api/v1/documents/{documentId}/versions/{version}/restore", "post", {
    token,
    body,
    pathParams: { documentId, version },
  });
}
