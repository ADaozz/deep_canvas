"use client";

import { create } from "zustand";

import { api } from "@/lib/api";
import type {
  CanvasLayoutState,
  GeneratedConfig,
  MiddlewareDefinition,
  PersistenceProfile,
  RunEventRecord,
  RunRecord,
  SubagentTemplate,
  SupervisorConfig,
  ToolDefinition,
  ValidationResult,
  WorkflowSelection
} from "@/lib/types";

const UI_USER_ID = "local-user";
const UI_PAGE_KEY = "reactflow-console";
const UI_COMPONENT_KEY = "canvas-layout";

type WorkflowStore = {
  tools: ToolDefinition[];
  middlewares: MiddlewareDefinition[];
  persistenceProfiles: PersistenceProfile[];
  subagents: SubagentTemplate[];
  supervisors: SupervisorConfig[];
  selectedSupervisorId: string | null;
  selection: WorkflowSelection;
  layout: CanvasLayoutState;
  run: RunRecord | null;
  runEvents: RunEventRecord[];
  validation: ValidationResult | null;
  generated: GeneratedConfig | null;
  loading: boolean;
  statusMessage: string;
  errorMessage: string | null;
  initialized: boolean;
  load: () => Promise<void>;
  setSelection: (selection: WorkflowSelection) => void;
  selectSupervisor: (supervisorId: string) => void;
  createSupervisor: () => Promise<void>;
  autoGenerateWorkflow: (query: string) => Promise<void>;
  updateSupervisor: (supervisorId: string, payload: Partial<SupervisorConfig>) => Promise<void>;
  deleteSupervisor: (supervisorId: string) => Promise<void>;
  createSubagent: () => Promise<void>;
  updateSubagent: (subagentId: string, payload: Partial<SubagentTemplate>) => Promise<void>;
  deleteSubagent: (subagentId: string) => Promise<void>;
  updateTool: (toolId: string, payload: Partial<ToolDefinition>) => Promise<void>;
  deleteTool: (toolId: string) => Promise<void>;
  createMiddleware: () => Promise<void>;
  updateMiddleware: (
    middlewareId: string,
    payload: Partial<MiddlewareDefinition>
  ) => Promise<void>;
  deleteMiddleware: (middlewareId: string) => Promise<void>;
  createPersistenceProfile: () => Promise<void>;
  updatePersistenceProfile: (
    profileId: string,
    payload: Partial<PersistenceProfile>
  ) => Promise<void>;
  deletePersistenceProfile: (profileId: string) => Promise<void>;
  refreshTools: () => Promise<void>;
  bindSubagentToSupervisor: (subagentId: string, position?: { x: number; y: number }) => Promise<void>;
  unbindSubagent: (subagentId: string) => Promise<void>;
  bindToolToSubagent: (subagentId: string, toolId: string, position?: { x: number; y: number }) => Promise<void>;
  unbindTool: (subagentId: string, toolId: string) => Promise<void>;
  bindMiddlewareToSupervisor: (middlewareId: string) => Promise<void>;
  bindMiddlewareToSubagent: (subagentId: string, middlewareId: string) => Promise<void>;
  bindPersistenceToSupervisor: (profileId: string) => Promise<void>;
  setNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  persistLayout: () => Promise<void>;
  validateSelectedSupervisor: () => Promise<void>;
  generateSelectedSupervisor: () => Promise<void>;
  runSelectedSupervisor: (input: string) => Promise<void>;
  resumeRun: (runId: string, decisions: Array<Record<string, unknown>>) => Promise<void>;
};

function replaceById<T extends { id: string }>(items: T[], next: T) {
  return items.map((item) => (item.id === next.id ? next : item));
}

function getDefaultSupervisorPayload(index: number): Omit<SupervisorConfig, "id" | "created_at" | "updated_at"> {
  return {
    name: `总控_${index}`,
    runtime: {
      model: "qwen3.5-plus",
      temperature: 0.2,
      system_prompt: "你是一个总控智能体。请优先判断是否应把任务委派给合适的子智能体，再整合结果并给出最终答复。"
    },
    subagent_ids: [],
    global_tool_ids: [],
    persistence_profile_id: null,
    backend: null,
    memory: [],
    skills: [],
    middleware_ids: [],
    interrupt_on: null,
    enabled: true
  };
}

function getDefaultSubagentPayload(index: number): Omit<SubagentTemplate, "id" | "created_at" | "updated_at"> {
  return {
    name: `子智能体_${index}`,
    description: "说明在什么情况下，总控应该把任务委派给这个子智能体。",
    runtime: {
      model: "qwen3.5-plus",
      temperature: 0.2,
      system_prompt: "你是一个专注的子智能体。请直接完成被委派的任务，只返回对当前任务有帮助的结果。"
    },
    tool_ids: [],
    skill_paths: [],
    middleware_ids: [],
    interrupt_on: null,
    response_format: null,
    enabled: true
  };
}

function getDefaultMiddlewarePayload(
  index: number
): Omit<MiddlewareDefinition, "id" | "created_at" | "updated_at"> {
  return {
    name: `middleware_${index}`,
    scope: "global",
    python_import_path: "app.middleware.custom_middleware",
    description: "在调用模型、路由子智能体或工具前后执行的中间件。",
    config: {},
    enabled: true
  };
}

function getDefaultPersistenceProfilePayload(
  index: number
): Omit<PersistenceProfile, "id" | "created_at" | "updated_at"> {
  return {
    name: `persistence_profile_${index}`,
    description: "用于定义 backend、checkpointer、store 的运行时持久化策略。",
    backend_type: "none",
    backend_import_path: null,
    backend_config: {},
    checkpointer_type: "none",
    checkpointer_import_path: null,
    checkpointer_config: {},
    store_type: "none",
    store_import_path: null,
    store_config: {},
    enabled: true
  };
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  tools: [],
  middlewares: [],
  persistenceProfiles: [],
  subagents: [],
  supervisors: [],
  selectedSupervisorId: null,
  selection: null,
  layout: { positions: {} },
  run: null,
  runEvents: [],
  validation: null,
  generated: null,
  loading: false,
  statusMessage: "准备就绪",
  errorMessage: null,
  initialized: false,

  load: async () => {
    set({ loading: true, errorMessage: null, statusMessage: "正在加载工作流..." });
    try {
      const [tools, middlewares, persistenceProfiles, subagents, supervisors, uiStates] = await Promise.all([
        api.listTools(),
        api.listMiddlewares(),
        api.listPersistenceProfiles(),
        api.listSubagents(),
        api.listSupervisors(),
        api.listUIState(UI_USER_ID, UI_PAGE_KEY)
      ]);
      const savedLayout = uiStates.find((item) => item.component_key === UI_COMPONENT_KEY)?.state;
      set({
        tools,
        middlewares,
        persistenceProfiles,
        subagents,
        supervisors,
        selectedSupervisorId: supervisors[0]?.id ?? null,
        selection: supervisors[0] ? { kind: "supervisor", id: supervisors[0].id } : null,
        layout: {
          positions:
            savedLayout && typeof savedLayout.positions === "object"
              ? (savedLayout.positions as CanvasLayoutState["positions"])
              : {},
          viewport:
            savedLayout && typeof savedLayout.viewport === "object"
              ? (savedLayout.viewport as CanvasLayoutState["viewport"])
              : undefined
        },
        loading: false,
        initialized: true,
        statusMessage: "工作流已加载"
      });
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        errorMessage: error instanceof Error ? error.message : "加载失败",
        statusMessage: "加载失败"
      });
    }
  },

  setSelection: (selection) => set({ selection }),

  selectSupervisor: (supervisorId) =>
    set({
      selectedSupervisorId: supervisorId,
      selection: { kind: "supervisor", id: supervisorId },
      validation: null,
      generated: null
    }),

  createSupervisor: async () => {
    const { supervisors } = get();
    const created = await api.createSupervisor(getDefaultSupervisorPayload(supervisors.length + 1));
    set({
      supervisors: [...supervisors, created],
      selectedSupervisorId: created.id,
      selection: { kind: "supervisor", id: created.id },
      statusMessage: `已创建 ${created.name}`
    });
  },

  autoGenerateWorkflow: async (query) => {
    set({
      loading: true,
      errorMessage: null,
      statusMessage: "正在智能生成工作流..."
    });
    try {
      const created = await api.autoGenerateSupervisor(query);
      const [tools, middlewares, persistenceProfiles, subagents, supervisors] = await Promise.all([
        api.listTools(),
        api.listMiddlewares(),
        api.listPersistenceProfiles(),
        api.listSubagents(),
        api.listSupervisors()
      ]);
      set({
        tools,
        middlewares,
        persistenceProfiles,
        subagents,
        supervisors,
        selectedSupervisorId: created.id,
        selection: { kind: "supervisor", id: created.id },
        loading: false,
        statusMessage: `已智能生成 ${created.name}`
      });
    } catch (error) {
      set({
        loading: false,
        errorMessage: error instanceof Error ? error.message : "智能生成失败",
        statusMessage: "智能生成失败"
      });
    }
  },

  updateSupervisor: async (supervisorId, payload) => {
    const updated = await api.updateSupervisor(supervisorId, payload);
    set((state) => ({
      supervisors: replaceById(state.supervisors, updated),
      statusMessage: `已保存 ${updated.name}`
    }));
  },

  deleteSupervisor: async (supervisorId) => {
    const { supervisors } = get();
    const target = supervisors.find((item) => item.id === supervisorId);
    if (!target) return;
    await api.deleteSupervisor(supervisorId);
    const nextSupervisors = supervisors.filter((item) => item.id !== supervisorId);
    const nextSelected = nextSupervisors[0]?.id ?? null;
    set({
      supervisors: nextSupervisors,
      selectedSupervisorId: nextSelected,
      selection: nextSelected ? { kind: "supervisor", id: nextSelected } : null,
      run: null,
      runEvents: [],
      validation: null,
      generated: null,
      statusMessage: `已删除 ${target.name}`
    });
  },

  createSubagent: async () => {
    const { subagents } = get();
    const created = await api.createSubagent(getDefaultSubagentPayload(subagents.length + 1));
    set({
      subagents: [...subagents, created],
      selection: { kind: "subagent", id: created.id },
      statusMessage: `已创建 ${created.name}`
    });
  },

  updateSubagent: async (subagentId, payload) => {
    const updated = await api.updateSubagent(subagentId, payload);
    set((state) => ({
      subagents: replaceById(state.subagents, updated),
      statusMessage: `已保存 ${updated.name}`
    }));
  },

  deleteSubagent: async (subagentId) => {
    const { subagents, supervisors, selection } = get();
    const target = subagents.find((item) => item.id === subagentId);
    if (!target) return;
    await api.deleteSubagent(subagentId);
    set({
      subagents: subagents.filter((item) => item.id !== subagentId),
      supervisors: supervisors.map((supervisor) => ({
        ...supervisor,
        subagent_ids: supervisor.subagent_ids.filter((id) => id !== subagentId)
      })),
      selection: selection?.kind === "subagent" && selection.id === subagentId ? null : selection,
      statusMessage: `已删除 ${target.name}`
    });
  },

  updateTool: async (toolId, payload) => {
    const updated = await api.updateTool(toolId, payload);
    set((state) => ({
      tools: replaceById(state.tools, updated),
      statusMessage: `已更新 ${updated.name} 的策略`
    }));
  },

  deleteTool: async (toolId) => {
    const { tools, subagents, selection } = get();
    const target = tools.find((item) => item.id === toolId);
    if (!target) return;
    await api.deleteTool(toolId);
    set({
      tools: tools.filter((item) => item.id !== toolId),
      subagents: subagents.map((subagent) => ({
        ...subagent,
        tool_ids: subagent.tool_ids.filter((id) => id !== toolId)
      })),
      selection: selection?.kind === "tool" && selection.id === toolId ? null : selection,
      statusMessage: `已删除 ${target.name}`
    });
  },

  createMiddleware: async () => {
    const { middlewares } = get();
    const created = await api.createMiddleware(getDefaultMiddlewarePayload(middlewares.length + 1));
    set({
      middlewares: [...middlewares, created],
      selection: { kind: "middleware", id: created.id },
      statusMessage: `已创建 ${created.name}`
    });
  },

  updateMiddleware: async (middlewareId, payload) => {
    const updated = await api.updateMiddleware(middlewareId, payload);
    set((state) => ({
      middlewares: replaceById(state.middlewares, updated),
      statusMessage: `已保存 ${updated.name}`
    }));
  },

  deleteMiddleware: async (middlewareId) => {
    const { middlewares, supervisors, subagents, selection } = get();
    const target = middlewares.find((item) => item.id === middlewareId);
    if (!target) return;
    await api.deleteMiddleware(middlewareId);
    set({
      middlewares: middlewares.filter((item) => item.id !== middlewareId),
      supervisors: supervisors.map((supervisor) => ({
        ...supervisor,
        middleware_ids: supervisor.middleware_ids.filter((id) => id !== middlewareId)
      })),
      subagents: subagents.map((subagent) => ({
        ...subagent,
        middleware_ids: subagent.middleware_ids.filter((id) => id !== middlewareId)
      })),
      selection:
        selection?.kind === "middleware" && selection.id === middlewareId ? null : selection,
      statusMessage: `已删除 ${target.name}`
    });
  },

  createPersistenceProfile: async () => {
    const { persistenceProfiles } = get();
    const created = await api.createPersistenceProfile(
      getDefaultPersistenceProfilePayload(persistenceProfiles.length + 1)
    );
    set({
      persistenceProfiles: [...persistenceProfiles, created],
      selection: { kind: "persistence", id: created.id },
      statusMessage: `已创建 ${created.name}`
    });
  },

  updatePersistenceProfile: async (profileId, payload) => {
    const updated = await api.updatePersistenceProfile(profileId, payload);
    set((state) => ({
      persistenceProfiles: replaceById(state.persistenceProfiles, updated),
      statusMessage: `已保存 ${updated.name}`
    }));
  },

  deletePersistenceProfile: async (profileId) => {
    const { persistenceProfiles, supervisors, selection } = get();
    const target = persistenceProfiles.find((item) => item.id === profileId);
    if (!target) return;
    await api.deletePersistenceProfile(profileId);
    set({
      persistenceProfiles: persistenceProfiles.filter((item) => item.id !== profileId),
      supervisors: supervisors.map((supervisor) => ({
        ...supervisor,
        persistence_profile_id:
          supervisor.persistence_profile_id === profileId ? null : supervisor.persistence_profile_id
      })),
      selection:
        selection?.kind === "persistence" && selection.id === profileId ? null : selection,
      statusMessage: `已删除 ${target.name}`
    });
  },

  refreshTools: async () => {
    const tools = await api.refreshTools();
    set({ tools, statusMessage: "工具注册表已刷新" });
  },

  bindSubagentToSupervisor: async (subagentId, position) => {
    const { selectedSupervisorId, supervisors, layout } = get();
    if (!selectedSupervisorId) throw new Error("请先选中一个总控。");
    const supervisor = supervisors.find((item) => item.id === selectedSupervisorId);
    if (!supervisor) return;
    if (supervisor.subagent_ids.includes(subagentId)) {
      set({ statusMessage: "这个子智能体已经绑定到当前总控" });
      return;
    }
    const updated = await api.updateSupervisor(selectedSupervisorId, {
      subagent_ids: [...supervisor.subagent_ids, subagentId]
    });
    set({
      supervisors: replaceById(supervisors, updated),
      selection: { kind: "subagent", id: subagentId },
      layout: position
        ? {
            ...layout,
            positions: {
              ...layout.positions,
              [`subagent:${subagentId}`]: position
            }
          }
        : layout,
      statusMessage: "已将子智能体绑定到总控"
    });
  },

  unbindSubagent: async (subagentId) => {
    const { selectedSupervisorId, supervisors } = get();
    if (!selectedSupervisorId) return;
    const supervisor = supervisors.find((item) => item.id === selectedSupervisorId);
    if (!supervisor) return;
    const updated = await api.updateSupervisor(selectedSupervisorId, {
      subagent_ids: supervisor.subagent_ids.filter((id) => id !== subagentId)
    });
    set({
      supervisors: replaceById(supervisors, updated),
      statusMessage: "已从总控中解绑子智能体"
    });
  },

  bindToolToSubagent: async (subagentId, toolId, position) => {
    const { subagents, layout } = get();
    const subagent = subagents.find((item) => item.id === subagentId);
    if (!subagent) return;
    if (subagent.tool_ids.includes(toolId)) {
      set({ statusMessage: "这个工具已经绑定到当前子智能体" });
      return;
    }
    const updated = await api.updateSubagent(subagentId, {
      tool_ids: [...subagent.tool_ids, toolId]
    });
    set({
      subagents: replaceById(subagents, updated),
      selection: { kind: "tool", id: toolId },
      layout: position
        ? {
            ...layout,
            positions: {
              ...layout.positions,
              [`tool:${toolId}`]: position
            }
          }
        : layout,
      statusMessage: "已将工具绑定到子智能体"
    });
  },

  unbindTool: async (subagentId, toolId) => {
    const { subagents } = get();
    const subagent = subagents.find((item) => item.id === subagentId);
    if (!subagent) return;
    const updated = await api.updateSubagent(subagentId, {
      tool_ids: subagent.tool_ids.filter((id) => id !== toolId)
    });
    set({
      subagents: replaceById(subagents, updated),
      statusMessage: "已从子智能体中解绑工具"
    });
  },

  bindMiddlewareToSupervisor: async (middlewareId) => {
    const { selectedSupervisorId, supervisors } = get();
    if (!selectedSupervisorId) throw new Error("请先选中一个总控。");
    const supervisor = supervisors.find((item) => item.id === selectedSupervisorId);
    if (!supervisor) return;
    if (supervisor.middleware_ids.includes(middlewareId)) {
      set({ statusMessage: "这个中间件已经绑定到当前总控" });
      return;
    }
    const updated = await api.updateSupervisor(selectedSupervisorId, {
      middleware_ids: [...supervisor.middleware_ids, middlewareId]
    });
    set({
      supervisors: replaceById(supervisors, updated),
      statusMessage: "已将中间件绑定到总控"
    });
  },

  bindMiddlewareToSubagent: async (subagentId, middlewareId) => {
    const { subagents } = get();
    const subagent = subagents.find((item) => item.id === subagentId);
    if (!subagent) return;
    if (subagent.middleware_ids.includes(middlewareId)) {
      set({ statusMessage: "这个中间件已经绑定到当前子智能体" });
      return;
    }
    const updated = await api.updateSubagent(subagentId, {
      middleware_ids: [...subagent.middleware_ids, middlewareId]
    });
    set({
      subagents: replaceById(subagents, updated),
      statusMessage: "已将中间件绑定到子智能体"
    });
  },

  bindPersistenceToSupervisor: async (profileId) => {
    const { selectedSupervisorId, supervisors } = get();
    if (!selectedSupervisorId) throw new Error("请先选中一个总控。");
    const supervisor = supervisors.find((item) => item.id === selectedSupervisorId);
    if (!supervisor) return;
    const updated = await api.updateSupervisor(selectedSupervisorId, {
      persistence_profile_id: profileId
    });
    set({
      supervisors: replaceById(supervisors, updated),
      statusMessage: "已将持久化配置绑定到总控"
    });
  },

  setNodePosition: (nodeId, position) =>
    set((state) => ({
      layout: {
        ...state.layout,
        positions: {
          ...state.layout.positions,
          [nodeId]: position
        }
      }
    })),

  setViewport: (viewport) =>
    set((state) => ({
      layout: {
        ...state.layout,
        viewport
      }
    })),

  persistLayout: async () => {
    const { layout } = get();
    await api.putUIState(UI_COMPONENT_KEY, {
      user_id: UI_USER_ID,
      page_key: UI_PAGE_KEY,
      component_key: UI_COMPONENT_KEY,
      state: layout as unknown as Record<string, unknown>
    });
  },

  validateSelectedSupervisor: async () => {
    const { selectedSupervisorId } = get();
    if (!selectedSupervisorId) {
      set({
        errorMessage: "请先选择一个总控。",
        statusMessage: "缺少总控"
      });
      return;
    }
    set({
      errorMessage: null,
      validation: null,
      statusMessage: "正在校验当前总控..."
    });
    try {
      const validation = await api.validateSupervisor(selectedSupervisorId);
      set({
        validation,
        statusMessage: validation.valid ? "校验通过" : "校验发现问题"
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "校验失败",
        statusMessage: "校验失败"
      });
    }
  },

  generateSelectedSupervisor: async () => {
    const { selectedSupervisorId } = get();
    if (!selectedSupervisorId) {
      set({
        errorMessage: "请先选择一个总控。",
        statusMessage: "缺少总控"
      });
      return;
    }
    set({
      errorMessage: null,
      generated: null,
      statusMessage: "正在生成项目模板..."
    });
    try {
      const generated = await api.generateSupervisor(selectedSupervisorId);
      set({
        generated,
        validation: generated.workflow_validation,
        statusMessage: "已生成项目模板"
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "生成失败",
        statusMessage: "生成失败"
      });
    }
  },

  runSelectedSupervisor: async (input) => {
    const { selectedSupervisorId } = get();
    if (!selectedSupervisorId) {
      set({
        errorMessage: "请先选择一个总控。",
        statusMessage: "缺少总控"
      });
      return;
    }
    set({
      errorMessage: null,
      run: null,
      runEvents: [],
      statusMessage: "正在运行当前总控..."
    });
    try {
      const run = await api.runSupervisor(selectedSupervisorId, input);
      const runEvents = await api.listRunEvents(run.id);
      set({
        run,
        runEvents,
        statusMessage:
          run.status === "completed"
            ? "运行完成"
            : run.status === "interrupted"
              ? "等待人工确认"
              : "运行失败"
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "运行失败",
        statusMessage: "运行失败"
      });
    }
  },

  resumeRun: async (runId, decisions) => {
    set({
      errorMessage: null,
      statusMessage: "正在恢复运行..."
    });
    try {
      const run = await api.resumeRun(runId, decisions);
      const runEvents = await api.listRunEvents(run.id);
      set({
        run,
        runEvents,
        statusMessage:
          run.status === "completed"
            ? "运行完成"
            : run.status === "interrupted"
              ? "等待人工确认"
              : "运行失败"
      });
    } catch (error) {
      set({
        errorMessage: error instanceof Error ? error.message : "恢复运行失败",
        statusMessage: "恢复运行失败"
      });
    }
  }
}));
