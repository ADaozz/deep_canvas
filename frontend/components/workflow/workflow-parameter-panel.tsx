"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatPermissionLevel } from "@/lib/workflow";
import { useWorkflowStore } from "@/stores/workflow-store";

const permissionOptions = [
  { label: "安全", value: "safe" },
  { label: "敏感", value: "sensitive" },
  { label: "危险", value: "dangerous" }
];

const modelOptions = [
  { label: "qwen3.5-plus", value: "qwen3.5-plus" },
  { label: "qwen3.5-turbo", value: "qwen3.5-turbo" },
  { label: "openai:gpt-5.4", value: "openai:gpt-5.4" },
  { label: "openai:gpt-5.4-mini", value: "openai:gpt-5.4-mini" }
];

const middlewareScopeOptions = [
  { label: "全局", value: "global" },
  { label: "总控", value: "supervisor" },
  { label: "子智能体", value: "subagent" }
];

const backendTypeOptions = [
  { label: "无", value: "none" },
  { label: "文件系统", value: "filesystem" },
  { label: "状态后端", value: "state" },
  { label: "自定义", value: "custom" }
];

const checkpointerTypeOptions = [
  { label: "无", value: "none" },
  { label: "内存", value: "memory" },
  { label: "自定义", value: "custom" }
];

const storeTypeOptions = [
  { label: "无", value: "none" },
  { label: "内存 Store", value: "in_memory_store" },
  { label: "自定义", value: "custom" }
];

const selectClassName =
  "w-full rounded-xl border border-border bg-panelAlt px-3 py-2 text-sm text-text outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20";

function stringifyJson(value: Record<string, unknown> | null | undefined) {
  return JSON.stringify(value ?? {}, null, 2);
}

function getBackendDefaults(
  type: string,
  customImportPath = "app.backend.build_backend"
) {
  if (type === "custom") {
    return {
      importPath: customImportPath,
      config: "{}"
    };
  }
  if (type === "none") {
    return {
      importPath: "",
      config: "{}"
    };
  }
  return {
    importPath: "",
    config: "{}"
  };
}

function getRuntimeComponentHelp(type: string, kind: "backend" | "checkpointer" | "store") {
  if (kind === "backend") {
    if (type === "filesystem") {
      return "文件系统后端。适合把工作区内容落到可见文件目录。";
    }
    if (type === "state") {
      return "状态后端。使用 Deep Agents 的运行态状态容器，不直接落库。";
    }
    if (type === "custom") {
      return "自定义后端。通过 import path 构造你自己的 backend。";
    }
    return "不配置 backend，由 Deep Agents 使用默认运行方式。";
  }
  if (kind === "checkpointer") {
    if (type === "memory") {
      return "内存 Checkpointer。支持当前进程内的中断恢复，不持久化到外部存储。";
    }
    if (type === "custom") {
      return "自定义 Checkpointer。适合接 LangGraph 的外部持久化实现。";
    }
    return "不配置 Checkpointer。";
  }
  if (type === "in_memory_store") {
    return "内存 Store。适合临时运行态数据，不持久化。";
  }
  if (type === "custom") {
    return "自定义 Store。通过 import path 接入你自己的存储实现。";
  }
  return "不配置 Store。";
}

function InlineHelp({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted transition hover:text-text"
      title={text}
      aria-label={text}
    >
      <CircleHelp className="h-3.5 w-3.5" />
    </span>
  );
}

function parseLineList(value: unknown) {
  return String(value ?? "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return JSON.parse(raw) as Record<string, unknown>;
}

export function WorkflowParameterPanel() {
  const {
    selection,
    supervisors,
    subagents,
    tools,
    middlewares,
    persistenceProfiles,
    updateSupervisor,
    updateSubagent,
    updateTool,
    updateMiddleware,
    updatePersistenceProfile,
    deleteSupervisor,
    deleteSubagent,
    deleteTool,
    deleteMiddleware,
    deletePersistenceProfile
  } = useWorkflowStore();

  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.kind === "supervisor") {
      return supervisors.find((item) => item.id === selection.id) ?? null;
    }
    if (selection.kind === "subagent") {
      return subagents.find((item) => item.id === selection.id) ?? null;
    }
    if (selection.kind === "tool") {
      return tools.find((item) => item.id === selection.id) ?? null;
    }
    if (selection.kind === "middleware") {
      return middlewares.find((item) => item.id === selection.id) ?? null;
    }
    return persistenceProfiles.find((item) => item.id === selection.id) ?? null;
  }, [selection, supervisors, subagents, tools, middlewares, persistenceProfiles]);

  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [toolSource, setToolSource] = useState("");
  const [toolSourcePath, setToolSourcePath] = useState("");
  const [toolSourceLoading, setToolSourceLoading] = useState(false);

  useEffect(() => {
    if (!selection || !selected) {
      setDraft({});
      return;
    }

    if (selection.kind === "tool") {
      const tool = selected as {
        permission_level: string;
        requires_human_approval: boolean;
        enabled: boolean;
      };
      setDraft({
        permission_level: tool.permission_level,
        requires_human_approval: tool.requires_human_approval,
        enabled: tool.enabled
      });
      return;
    }

    if (selection.kind === "middleware") {
      const middleware = selected as {
        name: string;
        scope: string;
        python_import_path: string;
        description: string;
        config: Record<string, unknown>;
        enabled: boolean;
      };
      setDraft({
        name: middleware.name,
        scope: middleware.scope,
        python_import_path: middleware.python_import_path,
        description: middleware.description,
        config: stringifyJson(middleware.config),
        enabled: middleware.enabled
      });
      return;
    }

    if (selection.kind === "persistence") {
      const profile = selected as {
        name: string;
        description: string;
        backend_type: string;
        backend_import_path: string | null;
        backend_config: Record<string, unknown>;
        checkpointer_type: string;
        checkpointer_import_path: string | null;
        checkpointer_config: Record<string, unknown>;
        store_type: string;
        store_import_path: string | null;
        store_config: Record<string, unknown>;
        enabled: boolean;
      };
      setDraft({
        name: profile.name,
        description: profile.description,
        backend_type: profile.backend_type,
        backend_import_path: profile.backend_import_path ?? "",
        backend_config: stringifyJson(profile.backend_config),
        checkpointer_type: profile.checkpointer_type,
        checkpointer_import_path: profile.checkpointer_import_path ?? "",
        checkpointer_config: stringifyJson(profile.checkpointer_config),
        store_type: profile.store_type,
        store_import_path: profile.store_import_path ?? "",
        store_config: stringifyJson(profile.store_config),
        enabled: profile.enabled
      });
      return;
    }

    const agent = selected as {
      name: string;
      description?: string;
      enabled: boolean;
      runtime: {
        model: string;
        temperature: number;
        system_prompt: string;
      };
      skill_paths?: string[];
      memory?: string[];
      skills?: string[];
      middleware_ids?: string[];
      persistence_profile_id?: string | null;
      backend?: {
        type: string;
        import_path: string | null;
        config: Record<string, unknown>;
      } | null;
      interrupt_on?: Record<string, unknown> | null;
    };
    setDraft({
      name: agent.name,
      description: selection.kind === "subagent" ? agent.description ?? "" : "",
      model: agent.runtime.model,
      temperature: agent.runtime.temperature,
      system_prompt: agent.runtime.system_prompt,
      enabled: agent.enabled,
      skill_paths: (agent.skill_paths ?? []).join("\n"),
      memory: (agent.memory ?? []).join("\n"),
      skills: (agent.skills ?? []).join("\n"),
      middleware_ids: agent.middleware_ids ?? [],
      persistence_profile_id: agent.persistence_profile_id ?? "",
      backend_type: agent.backend?.type ?? "none",
      backend_import_path: agent.backend?.import_path ?? "",
      backend_config: stringifyJson(agent.backend?.config),
      interrupt_on: stringifyJson(agent.interrupt_on)
    });
  }, [selection, selected]);

  useEffect(() => {
    let active = true;
    if (selection?.kind !== "tool" || !selected) {
      setToolSource("");
      setToolSourcePath("");
      setToolSourceLoading(false);
      return;
    }

    const tool = selected as { id: string };
    setToolSourceLoading(true);
    void api
      .getToolSource(tool.id)
      .then((source) => {
        if (!active) return;
        setToolSource(source.source_code);
        setToolSourcePath(source.python_import_path);
      })
      .catch((error) => {
        if (!active) return;
        useWorkflowStore.setState({
          errorMessage: error instanceof Error ? error.message : "加载工具源码失败"
        });
      })
      .finally(() => {
        if (active) {
          setToolSourceLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selection, selected]);

  if (!selection || !selected) {
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>节点参数</CardTitle>
          <CardDescription>点击画布节点或左侧 Registry 后，在这里编辑配置。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <div className="rounded-2xl border border-dashed border-border bg-panelAlt p-6 text-sm text-muted">
            当前没有选中对象。你可以点击画布节点，或者在左侧选择 Tool、Middleware、Persistence Profile。
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selection.kind === "tool") {
    const tool = selected as {
      id: string;
      name: string;
      namespace: string;
      python_import_path: string;
      permission_level: "safe" | "sensitive" | "dangerous";
      requires_human_approval: boolean;
      enabled: boolean;
      description: string;
      args_schema: Record<string, unknown>;
    };
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{tool.name}</CardTitle>
            <CardDescription>{tool.namespace}</CardDescription>
          </div>
          <Badge>{formatPermissionLevel(tool.permission_level)}</Badge>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.18em] text-muted">权限级别</div>
            <SegmentedControl
              value={String(draft.permission_level ?? tool.permission_level)}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, permission_level: value }))}
              options={permissionOptions}
            />
          </div>
          <Switch
            checked={Boolean(draft.requires_human_approval ?? tool.requires_human_approval)}
            onCheckedChange={(checked) =>
              setDraft((prev) => ({ ...prev, requires_human_approval: checked }))
            }
            label="需要人工确认"
          />
          <Switch
            checked={Boolean(draft.enabled ?? tool.enabled)}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            label="启用工具"
          />
          <div className="rounded-2xl border border-border bg-panelAlt p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">工具说明</div>
            <div className="mt-2 text-sm leading-6 text-slate-300">{tool.description}</div>
          </div>
          <div className="rounded-2xl border border-border bg-panelAlt p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">工具源码</div>
              <div className="text-[11px] text-muted">{toolSourcePath || tool.python_import_path}</div>
            </div>
            <Textarea
              className="mt-3 min-h-[320px] font-mono text-[12px] leading-6"
              value={toolSource}
              onChange={(event) => setToolSource(event.target.value)}
              placeholder={toolSourceLoading ? "正在加载工具源码..." : "@app_tool(...)\nasync def tool_name(...):\n    pass"}
              disabled={toolSourceLoading}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="danger" onClick={() => void deleteTool(tool.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除工具
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                onClick={async () => {
                  const updated = await api.updateToolSource(tool.id, toolSource);
                  const tools = await api.listTools();
                  useWorkflowStore.setState({
                    tools,
                    errorMessage: null
                  });
                  setDraft((prev) => ({
                    ...prev,
                    permission_level: updated.permission_level,
                    requires_human_approval: updated.requires_human_approval,
                    enabled: updated.enabled
                  }));
                }}
                disabled={toolSourceLoading || !toolSource.trim()}
              >
                保存工具代码
              </Button>
              <Button
                onClick={() =>
                  void updateTool(tool.id, {
                    permission_level: String(draft.permission_level ?? tool.permission_level) as
                      | "safe"
                      | "sensitive"
                      | "dangerous",
                    requires_human_approval: Boolean(
                      draft.requires_human_approval ?? tool.requires_human_approval
                    ),
                    enabled: Boolean(draft.enabled ?? tool.enabled)
                  })
                }
              >
                保存工具策略
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selection.kind === "middleware") {
    const middleware = selected as {
      id: string;
      name: string;
      scope: string;
      python_import_path: string;
      description: string;
      config: Record<string, unknown>;
      enabled: boolean;
    };
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{middleware.name}</CardTitle>
            <CardDescription>MiddlewareDefinition</CardDescription>
          </div>
          <Badge>{middleware.scope}</Badge>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">名称</div>
              <Input
                value={String(draft.name ?? "")}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">Scope</div>
              <SegmentedControl
                value={String(draft.scope ?? middleware.scope ?? "global")}
                onValueChange={(value) => setDraft((prev) => ({ ...prev, scope: value }))}
                options={middlewareScopeOptions}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Python Import Path</div>
            <Input
              value={String(draft.python_import_path ?? "")}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, python_import_path: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">说明</div>
            <Textarea
              className="min-h-[100px]"
              value={String(draft.description ?? "")}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
          <Switch
            checked={Boolean(draft.enabled ?? middleware.enabled)}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            label="启用中间件"
          />
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Config JSON</div>
            <Textarea
              className="min-h-[180px] font-mono"
              value={String(draft.config ?? "{}")}
              onChange={(event) => setDraft((prev) => ({ ...prev, config: event.target.value }))}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Button variant="danger" onClick={() => void deleteMiddleware(middleware.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除中间件
            </Button>
            <Button
              onClick={() => {
                try {
                  void updateMiddleware(middleware.id, {
                    name: String(draft.name ?? middleware.name),
                    scope: String(draft.scope ?? middleware.scope),
                    python_import_path: String(
                      draft.python_import_path ?? middleware.python_import_path
                    ),
                    description: String(draft.description ?? middleware.description),
                    config: parseJsonObject(draft.config) ?? {},
                    enabled: Boolean(draft.enabled ?? middleware.enabled)
                  });
                } catch (error) {
                  useWorkflowStore.setState({
                    errorMessage:
                      error instanceof Error ? error.message : "Middleware config JSON 解析失败"
                  });
                }
              }}
            >
              保存 Middleware
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (selection.kind === "persistence") {
    const profile = selected as {
      id: string;
      name: string;
      description: string;
      backend_type: string;
      backend_import_path: string | null;
      backend_config: Record<string, unknown>;
      checkpointer_type: string;
      checkpointer_import_path: string | null;
      checkpointer_config: Record<string, unknown>;
      store_type: string;
      store_import_path: string | null;
      store_config: Record<string, unknown>;
      enabled: boolean;
    };
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader>
          <div>
            <CardTitle>{profile.name}</CardTitle>
            <CardDescription>PersistenceProfile</CardDescription>
          </div>
          <Badge>{profile.backend_type}</Badge>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">名称</div>
            <Input
              value={String(draft.name ?? "")}
              onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">说明</div>
            <Textarea
              className="min-h-[84px]"
              value={String(draft.description ?? "")}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>
          <Switch
            checked={Boolean(draft.enabled ?? profile.enabled)}
            onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
            label="启用持久化配置"
          />
          {[
            {
              label: "backend",
              typeKey: "backend_type",
              importKey: "backend_import_path",
              configKey: "backend_config",
              options: backendTypeOptions,
              customImportPath: "app.persistence.build_backend"
            },
            {
              label: "checkpointer",
              typeKey: "checkpointer_type",
              importKey: "checkpointer_import_path",
              configKey: "checkpointer_config",
              options: checkpointerTypeOptions,
              customImportPath: "app.persistence.build_checkpointer"
            },
            {
              label: "store",
              typeKey: "store_type",
              importKey: "store_import_path",
              configKey: "store_config",
              options: storeTypeOptions,
              customImportPath: "app.persistence.build_store"
            }
          ].map(({ label, typeKey, importKey, configKey, options, customImportPath }) => {
            const selectedType = String(draft[typeKey] ?? "none");
            return (
              <div key={label} className="space-y-3 rounded-2xl border border-border bg-panelAlt p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
                  <span>{label}</span>
                  <InlineHelp
                    text={getRuntimeComponentHelp(
                      selectedType,
                      label as "backend" | "checkpointer" | "store"
                    )}
                  />
                </div>
                <select
                  className={selectClassName}
                  value={selectedType}
                  onChange={(event) => {
                    const defaults = getBackendDefaults(event.target.value, customImportPath);
                    setDraft((prev) => ({
                      ...prev,
                      [typeKey]: event.target.value,
                      [importKey]: defaults.importPath,
                      [configKey]: defaults.config
                    }));
                  }}
                >
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {selectedType === "custom" ? (
                  <Input
                    value={String(draft[importKey] ?? "")}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [importKey]: event.target.value }))
                    }
                    placeholder={`${label} import path`}
                  />
                ) : null}
                {selectedType !== "none" ? (
                  <Textarea
                    className="min-h-[120px] font-mono"
                    value={String(draft[configKey] ?? "{}")}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, [configKey]: event.target.value }))
                    }
                    placeholder="{}"
                  />
                ) : null}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3">
            <Button variant="danger" onClick={() => void deletePersistenceProfile(profile.id)}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除持久化配置
            </Button>
            <Button
              onClick={() => {
                try {
                  void updatePersistenceProfile(profile.id, {
                    name: String(draft.name ?? profile.name),
                    description: String(draft.description ?? profile.description),
                    backend_type: String(draft.backend_type ?? profile.backend_type),
                    backend_import_path: String(draft.backend_import_path ?? "") || null,
                    backend_config: parseJsonObject(draft.backend_config) ?? {},
                    checkpointer_type: String(
                      draft.checkpointer_type ?? profile.checkpointer_type
                    ),
                    checkpointer_import_path:
                      String(draft.checkpointer_import_path ?? "") || null,
                    checkpointer_config: parseJsonObject(draft.checkpointer_config) ?? {},
                    store_type: String(draft.store_type ?? profile.store_type),
                    store_import_path: String(draft.store_import_path ?? "") || null,
                    store_config: parseJsonObject(draft.store_config) ?? {},
                    enabled: Boolean(draft.enabled ?? profile.enabled)
                  });
                } catch (error) {
                  useWorkflowStore.setState({
                    errorMessage:
                      error instanceof Error ? error.message : "Persistence profile JSON 解析失败"
                  });
                }
              }}
            >
              保存 Persistence
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSupervisor = selection.kind === "supervisor";
  const agent = selected as {
    id: string;
    name: string;
    enabled: boolean;
    runtime: {
      model: string;
      temperature: number;
      system_prompt: string;
    };
    description?: string;
    skill_paths?: string[];
    memory?: string[];
    skills?: string[];
    middleware_ids?: string[];
    persistence_profile_id?: string | null;
    interrupt_on?: Record<string, unknown> | null;
  };
  const selectedMiddlewareIds = Array.isArray(draft.middleware_ids)
    ? (draft.middleware_ids as string[])
    : [];
  const selectedModel = String(draft.model ?? agent.runtime.model ?? "qwen3.5-plus");
  const availableModelOptions = modelOptions.some((option) => option.value === selectedModel)
    ? modelOptions
    : [...modelOptions, { label: `自定义: ${selectedModel}`, value: selectedModel }];

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>{agent.name}</CardTitle>
          <CardDescription>{isSupervisor ? "总控节点参数" : "子智能体节点参数"}</CardDescription>
        </div>
        <Badge>{agent.runtime.model}</Badge>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">名称</div>
          <Input
            value={String(draft.name ?? "")}
            onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>
        {!isSupervisor ? (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">职责描述</div>
            <Textarea
              className="min-h-[96px]"
              value={String(draft.description ?? "")}
              onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
        ) : null}
        {isSupervisor ? (
          <>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">长期记忆文件</div>
              <Textarea
                className="min-h-[84px]"
                value={String(draft.memory ?? "")}
                onChange={(event) => setDraft((prev) => ({ ...prev, memory: event.target.value }))}
                placeholder={"/AGENTS.md\n/.deepagents/AGENTS.md"}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">技能目录 / 文件</div>
              <Textarea
                className="min-h-[84px]"
                value={String(draft.skills ?? "")}
                onChange={(event) => setDraft((prev) => ({ ...prev, skills: event.target.value }))}
                placeholder={"/skills/\n/skills/research/SKILL.md"}
              />
            </div>
            <div className="space-y-3 rounded-2xl border border-border bg-panelAlt p-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
                <span>Backend</span>
                <InlineHelp
                  text={getRuntimeComponentHelp(String(draft.backend_type ?? "none"), "backend")}
                />
              </div>
              <select
                className={selectClassName}
                value={String(draft.backend_type ?? "none")}
                onChange={(event) => {
                  const defaults = getBackendDefaults(
                    event.target.value,
                    "app.backend.build_backend"
                  );
                  setDraft((prev) => ({
                    ...prev,
                    backend_type: event.target.value,
                    backend_import_path: defaults.importPath,
                    backend_config: defaults.config
                  }));
                }}
              >
                {backendTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {String(draft.backend_type ?? "none") === "custom" ? (
                <Input
                  value={String(draft.backend_import_path ?? "")}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, backend_import_path: event.target.value }))
                  }
                  placeholder="app.backend.build_backend"
                />
              ) : null}
              {String(draft.backend_type ?? "none") !== "none" ? (
                <Textarea
                  className="min-h-[120px] font-mono"
                  value={String(draft.backend_config ?? "{}")}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, backend_config: event.target.value }))
                  }
                  placeholder="{}"
                />
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">子智能体技能目录 / 文件</div>
            <Textarea
              className="min-h-[84px]"
              value={String(draft.skill_paths ?? "")}
              onChange={(event) => setDraft((prev) => ({ ...prev, skill_paths: event.target.value }))}
              placeholder={"/skills/research/\n/skills/docs/SKILL.md"}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">模型</div>
            <select
              className={selectClassName}
              value={selectedModel}
              onChange={(event) => setDraft((prev) => ({ ...prev, model: event.target.value }))}
            >
              {availableModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">温度</div>
            <Input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={String(draft.temperature ?? 0)}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, temperature: Number(event.target.value) }))
              }
            />
          </div>
        </div>
        <Switch
          checked={Boolean(draft.enabled ?? agent.enabled)}
          onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, enabled: checked }))}
          label="启用节点"
        />
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">系统提示词</div>
          <Textarea
            className="min-h-[180px]"
            value={String(draft.system_prompt ?? "")}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, system_prompt: event.target.value }))
            }
          />
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-panelAlt p-4">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">Middleware</div>
          <div className="flex flex-wrap gap-2">
            {middlewares.length ? (
              middlewares.map((middleware) => {
                const active = selectedMiddlewareIds.includes(middleware.id);
                return (
                  <button
                    key={middleware.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => {
                        const current = Array.isArray(prev.middleware_ids)
                          ? (prev.middleware_ids as string[])
                          : [];
                        const next = current.includes(middleware.id)
                          ? current.filter((id) => id !== middleware.id)
                          : [...current, middleware.id];
                        return { ...prev, middleware_ids: next };
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      active
                        ? "border-blue-400 bg-accentSoft text-white"
                        : "border-border bg-background/60 text-muted hover:border-blue-500/40 hover:text-text"
                    }`}
                    title={middleware.description}
                  >
                    {middleware.name}
                  </button>
                );
              })
            ) : (
              <div className="text-xs text-muted">当前还没有注册 MiddlewareDefinition。</div>
            )}
          </div>
        </div>
        {isSupervisor ? (
          <div className="space-y-3 rounded-2xl border border-border bg-panelAlt p-4">
            <div className="text-xs uppercase tracking-[0.18em] text-muted">Persistence Profile</div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, persistence_profile_id: "" }))}
                className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                  !draft.persistence_profile_id
                    ? "border-blue-400 bg-accentSoft text-white"
                    : "border-border bg-background/60 text-muted hover:border-blue-500/40 hover:text-text"
                }`}
              >
                不使用持久化 Profile
              </button>
              {persistenceProfiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, persistence_profile_id: profile.id }))}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    draft.persistence_profile_id === profile.id
                      ? "border-blue-400 bg-accentSoft text-white"
                      : "border-border bg-background/60 text-muted hover:border-blue-500/40 hover:text-text"
                  }`}
                >
                  <div className="font-medium">{profile.name}</div>
                  <div className="mt-1 text-xs">
                    backend={profile.backend_type} · checkpointer={profile.checkpointer_type} ·
                    store={profile.store_type}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.18em] text-muted">interrupt_on JSON</div>
          <Textarea
            className="min-h-[120px] font-mono"
            value={String(draft.interrupt_on ?? "{}")}
            onChange={(event) => setDraft((prev) => ({ ...prev, interrupt_on: event.target.value }))}
            placeholder={'{\n  "send_email": true,\n  "write_file": {"allowed_decisions": ["approve", "reject"]}\n}'}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="danger"
            onClick={() =>
              isSupervisor ? void deleteSupervisor(agent.id) : void deleteSubagent(agent.id)
            }
          >
            <Trash2 className="mr-2 h-4 w-4" />
            删除{isSupervisor ? "总控" : "子智能体"}
          </Button>
          <Button
            onClick={() => {
              try {
                const payload = {
                  name: String(draft.name ?? agent.name),
                  enabled: Boolean(draft.enabled ?? agent.enabled),
                  runtime: {
                    model: String(draft.model ?? agent.runtime.model),
                    temperature: Number(draft.temperature ?? agent.runtime.temperature),
                    system_prompt: String(draft.system_prompt ?? agent.runtime.system_prompt)
                  },
                  middleware_ids: selectedMiddlewareIds,
                  interrupt_on: parseJsonObject(draft.interrupt_on)
                };
                if (isSupervisor) {
                  void updateSupervisor(agent.id, {
                    ...payload,
                    memory: parseLineList(draft.memory),
                    skills: parseLineList(draft.skills),
                    persistence_profile_id: String(draft.persistence_profile_id ?? "") || null,
                    backend:
                      String(draft.backend_type ?? "none").trim() &&
                      String(draft.backend_type ?? "none").trim() !== "none"
                        ? {
                            type: String(draft.backend_type ?? "none").trim(),
                            import_path:
                              String(draft.backend_import_path ?? "").trim() || null,
                            config: parseJsonObject(draft.backend_config) ?? {}
                          }
                        : null
                  });
                } else {
                  void updateSubagent(agent.id, {
                    ...payload,
                    description: String(draft.description ?? agent.description),
                    skill_paths: parseLineList(draft.skill_paths)
                  });
                }
              } catch (error) {
                useWorkflowStore.setState({
                  errorMessage:
                    error instanceof Error ? error.message : "interrupt_on JSON 解析失败"
                });
              }
            }}
          >
            保存节点参数
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
