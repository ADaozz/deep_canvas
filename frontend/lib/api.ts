import type {
  GeneratedConfig,
  MiddlewareDefinition,
  PersistenceProfile,
  RunEventRecord,
  RunRecord,
  SubagentTemplate,
  SupervisorConfig,
  ToolDefinition,
  ToolSource,
  UIStateRecord,
  ValidationResult
} from "@/lib/types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000/api";
const APP_BASE_URL = API_BASE_URL.replace(/\/api$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let detail = `请求失败，状态码 ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  listTools: () => request<ToolDefinition[]>("/tools"),
  listMiddlewares: () => request<MiddlewareDefinition[]>("/middlewares"),
  listPersistenceProfiles: () => request<PersistenceProfile[]>("/persistence-profiles"),
  createMiddleware: (payload: Omit<MiddlewareDefinition, "id" | "created_at" | "updated_at">) =>
    request<MiddlewareDefinition>("/middlewares", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateMiddleware: (middlewareId: string, payload: Partial<MiddlewareDefinition>) =>
    request<MiddlewareDefinition>(`/middlewares/${middlewareId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteMiddleware: (middlewareId: string) =>
    request<void>(`/middlewares/${middlewareId}`, { method: "DELETE" }),
  createPersistenceProfile: (
    payload: Omit<PersistenceProfile, "id" | "created_at" | "updated_at">
  ) =>
    request<PersistenceProfile>("/persistence-profiles", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updatePersistenceProfile: (profileId: string, payload: Partial<PersistenceProfile>) =>
    request<PersistenceProfile>(`/persistence-profiles/${profileId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deletePersistenceProfile: (profileId: string) =>
    request<void>(`/persistence-profiles/${profileId}`, { method: "DELETE" }),
  refreshTools: () => request<ToolDefinition[]>("/tools/refresh", { method: "POST" }),
  updateTool: (toolId: string, payload: Partial<ToolDefinition>) =>
    request<ToolDefinition>(`/tools/${toolId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  getToolSource: (toolId: string) => request<ToolSource>(`/tools/${toolId}/source`),
  updateToolSource: (toolId: string, source_code: string) =>
    request<ToolDefinition>(`/tools/${toolId}/source`, {
      method: "PUT",
      body: JSON.stringify({ source_code })
    }),
  deleteTool: (toolId: string) => request<void>(`/tools/${toolId}`, { method: "DELETE" }),

  listSubagents: () => request<SubagentTemplate[]>("/subagents"),
  createSubagent: (payload: Omit<SubagentTemplate, "id" | "created_at" | "updated_at">) =>
    request<SubagentTemplate>("/subagents", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateSubagent: (subagentId: string, payload: Partial<SubagentTemplate>) =>
    request<SubagentTemplate>(`/subagents/${subagentId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteSubagent: (subagentId: string) =>
    request<void>(`/subagents/${subagentId}`, { method: "DELETE" }),

  listSupervisors: () => request<SupervisorConfig[]>("/supervisors"),
  createSupervisor: (payload: Omit<SupervisorConfig, "id" | "created_at" | "updated_at">) =>
    request<SupervisorConfig>("/supervisors", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  autoGenerateSupervisor: (query: string) =>
    request<SupervisorConfig>("/supervisors/auto-generate", {
      method: "POST",
      body: JSON.stringify({ query })
    }),
  updateSupervisor: (supervisorId: string, payload: Partial<SupervisorConfig>) =>
    request<SupervisorConfig>(`/supervisors/${supervisorId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteSupervisor: (supervisorId: string) =>
    request<void>(`/supervisors/${supervisorId}`, { method: "DELETE" }),
  validateSupervisor: (supervisorId: string) =>
    request<ValidationResult>(`/supervisors/${supervisorId}/validate`, { method: "POST" }),
  generateSupervisor: (supervisorId: string) =>
    request<GeneratedConfig>(`/supervisors/${supervisorId}/generate`, { method: "POST" }),
  runSupervisor: (supervisorId: string, input_text: string) =>
    request<RunRecord>(`/supervisors/${supervisorId}/run`, {
      method: "POST",
      body: JSON.stringify({ input_text })
    }),
  resumeRun: (runId: string, decisions: Array<Record<string, unknown>>) =>
    request<RunRecord>(`/runs/${runId}/resume`, {
      method: "POST",
      body: JSON.stringify({ decisions })
    }),

  listRunEvents: (runId: string) => request<RunEventRecord[]>(`/runs/${runId}/events`),

  listUIState: (userId: string, pageKey: string) =>
    request<UIStateRecord[]>(
      `/ui-state?user_id=${encodeURIComponent(userId)}&page_key=${encodeURIComponent(pageKey)}`
    ),
  putUIState: (
    componentKey: string,
    payload: {
      user_id: string;
      page_key: string;
      component_key: string;
      state: Record<string, unknown>;
    }
  ) =>
    request<UIStateRecord>(`/ui-state/${componentKey}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  resolveAssetUrl: (path: string) => {
    if (/^https?:\/\//.test(path)) {
      return path;
    }
    return `${APP_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  }
};
