import type { components } from "@/lib/generated/openapi";

type Schemas = components["schemas"];

export type AuthResponse = Schemas["AuthResponse"];
export type AuthUser = Schemas["AuthUser"];
export type MfaChallengeResponse = Schemas["MfaChallengeResponse"];
export type Meeting = Schemas["Meeting"];
export type Project = Schemas["Project"];
export type Task = Schemas["Task"];
