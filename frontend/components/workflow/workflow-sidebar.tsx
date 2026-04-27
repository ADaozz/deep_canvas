"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bot,
  Cable,
  ChevronRight,
  Database,
  Plus,
  RefreshCw,
  Sparkles,
  Wrench,
  type LucideIcon
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPermissionLevel } from "@/lib/workflow";
import { useWorkflowStore } from "@/stores/workflow-store";

type WorkflowSidebarProps = {
  toolSearch: string;
  onToolSearchChange: (value: string) => void;
};

type SidebarSectionKey =
  | "supervisor"
  | "subagent"
  | "tool"
  | "persistence";

function SidebarSection({
  icon: Icon,
  title,
  subtitle,
  action,
  children
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border/80 bg-panel/88 p-3 shadow-lg backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl border border-border bg-accentSoft p-2 text-blue-200">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text">{title}</div>
            <div className="mt-1 text-xs leading-5 text-muted">{subtitle}</div>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function WorkflowSidebar({
  toolSearch,
  onToolSearchChange
}: WorkflowSidebarProps) {
  const [activeSection, setActiveSection] = useState<SidebarSectionKey>("supervisor");
  const [expanded, setExpanded] = useState(false);
  const {
    supervisors,
    subagents,
    tools,
    persistenceProfiles,
    selectedSupervisorId,
    selection,
    selectSupervisor,
    setSelection,
    createSupervisor,
    createSubagent,
    createPersistenceProfile,
    deleteSupervisor,
    deleteSubagent,
    deleteTool,
    deletePersistenceProfile,
    refreshTools
  } = useWorkflowStore();

  const groupedTools = tools
    .filter((tool) => {
      if (!toolSearch) return true;
      return `${tool.name} ${tool.namespace} ${tool.description}`
        .toLowerCase()
        .includes(toolSearch.toLowerCase());
    })
    .reduce<Record<string, typeof tools>>((acc, tool) => {
      acc[tool.namespace] ??= [];
      acc[tool.namespace].push(tool);
      return acc;
    }, {});

  const sectionMeta = useMemo(
    () =>
      ({
        supervisor: {
          title: "Supervisor",
          subtitle: "总控是 Workflow 的根节点。选择当前要编排的总控。"
        },
        subagent: {
          title: "Subagent",
          subtitle: "把子智能体拖到画布中，或连接到总控节点。"
        },
        tool: {
          title: "Tool",
          subtitle: "把工具拖到子智能体节点内部。生成模板时，工具逻辑会以 pass 占位。"
        },
        persistence: {
          title: "Persistence",
          subtitle: "配置 backend、checkpointer、store 的持久化策略，再绑定到总控。"
        }
      }) satisfies Record<SidebarSectionKey, { title: string; subtitle: string }>,
    []
  );

  return (
    <aside
      className="pointer-events-none absolute inset-y-4 left-4 z-30 flex items-start gap-3"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className="pointer-events-auto flex h-full w-[76px] shrink-0 flex-col items-center gap-4 rounded-[28px] border border-border/80 bg-panel/88 px-3 py-5 shadow-2xl backdrop-blur">
          <div className="rounded-2xl border border-border bg-accentSoft p-3 text-blue-200">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex flex-col items-center gap-2 text-muted">
            {[
              { key: "supervisor", icon: Sparkles, label: "Supervisor" },
              { key: "subagent", icon: Cable, label: "Subagent" },
              { key: "tool", icon: Wrench, label: "Tool" },
              { key: "persistence", icon: Database, label: "Persistence" }
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key as SidebarSectionKey)}
                  className={`rounded-2xl border p-2 transition ${
                    active
                      ? "border-blue-400 bg-accentSoft text-white shadow-glow"
                      : "border-transparent text-muted hover:border-border hover:bg-white/5 hover:text-text"
                  }`}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted">
            <span>DA</span>
            <ChevronRight
              className={`h-4 w-4 transition-transform duration-300 ${
                expanded ? "translate-x-1" : ""
              }`}
            />
          </div>
      </div>

      <div
        className={`pointer-events-auto h-full min-w-0 overflow-hidden rounded-[28px] border border-border/80 bg-panel/92 shadow-2xl backdrop-blur transition-all duration-300 ease-out ${
          expanded
            ? "w-[336px] translate-x-0 opacity-100"
            : "w-0 -translate-x-3 opacity-0"
        }`}
      >
        <div className="flex h-full min-w-[336px] flex-col gap-3 overflow-y-auto px-3 py-4">
            <div className="rounded-3xl border border-blue-500/20 bg-accentSoft/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-blue-200/90">
                Deep Agents Workflow
              </div>
              <div className="mt-2 text-sm font-semibold text-text">
                {sectionMeta[activeSection].title}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted">
                {sectionMeta[activeSection].subtitle}
              </div>
            </div>

            {activeSection === "supervisor" ? (
              <SidebarSection
                icon={Sparkles}
                title="Supervisor"
                subtitle={sectionMeta.supervisor.subtitle}
                action={
                  <Button size="icon" onClick={() => void createSupervisor()} title="新建总控">
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              >
                <div className="space-y-2">
                  {supervisors.map((supervisor) => (
                    <div key={supervisor.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => selectSupervisor(supervisor.id)}
                        className={`flex-1 rounded-2xl border px-3 py-3 text-left transition ${
                          selectedSupervisorId === supervisor.id
                            ? "border-blue-400 bg-accentSoft text-white shadow-glow"
                            : "border-border bg-panelAlt text-text hover:border-blue-500/40"
                        }`}
                      >
                        <div className="text-sm font-semibold">{supervisor.name}</div>
                        <div className="mt-1 text-xs text-muted">
                          {supervisor.runtime.model} · {supervisor.subagent_ids.length} 个子智能体
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSupervisor(supervisor.id)}
                        className="self-center px-1 text-lg leading-none text-red-200/70 transition hover:text-red-100"
                        title="删除总控"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {!supervisors.length ? (
                    <div className="rounded-2xl border border-dashed border-border bg-panelAlt px-3 py-4 text-xs text-muted">
                      还没有总控，先新建一个 Supervisor。
                    </div>
                  ) : null}
                </div>
              </SidebarSection>
            ) : null}

            {activeSection === "subagent" ? (
              <SidebarSection
                icon={Cable}
                title="Subagent"
                subtitle={sectionMeta.subagent.subtitle}
                action={
                  <Button size="icon" variant="secondary" onClick={() => void createSubagent()} title="新建子智能体">
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              >
                <div className="space-y-2">
                  {subagents.map((subagent) => (
                    <div key={subagent.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "application/agent-console",
                            JSON.stringify({ kind: "subagent-library", id: subagent.id })
                          );
                        }}
                        onClick={() => setSelection({ kind: "subagent", id: subagent.id })}
                        className={`flex-1 rounded-2xl border px-3 py-3 text-left transition ${
                          selection?.kind === "subagent" && selection.id === subagent.id
                            ? "border-blue-400 bg-accentSoft text-white shadow-glow"
                            : "border-border bg-panelAlt text-text hover:border-blue-500/40"
                        }`}
                      >
                        <div className="text-sm font-semibold">{subagent.name}</div>
                        <div className="mt-1 line-clamp-2 text-xs text-muted">{subagent.description}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSubagent(subagent.id)}
                        className="self-center px-1 text-lg leading-none text-red-200/70 transition hover:text-red-100"
                        title="删除子智能体"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            ) : null}

            {activeSection === "tool" ? (
              <SidebarSection
                icon={Wrench}
                title="Tool"
                subtitle={sectionMeta.tool.subtitle}
                action={
                  <Button size="icon" variant="ghost" onClick={() => void refreshTools()} title="刷新工具">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                }
              >
                <div className="space-y-3">
                  <Input
                    value={toolSearch}
                    onChange={(event) => onToolSearchChange(event.target.value)}
                    placeholder="搜索工具"
                  />
                  <div className="space-y-4">
                    {Object.entries(groupedTools)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([namespace, items]) => (
                        <div key={namespace}>
                          <div className="mb-2 flex items-center justify-between">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
                              {namespace}
                            </div>
                            <Badge>{items.length}</Badge>
                          </div>
                          <div className="space-y-2">
                            {items.map((tool) => (
                              <div key={tool.id} className="flex items-stretch gap-2">
                                <button
                                  type="button"
                                  draggable
                                  onDragStart={(event) => {
                                    event.dataTransfer.setData(
                                      "application/agent-console",
                                      JSON.stringify({ kind: "tool-library", id: tool.id })
                                    );
                                  }}
                                  onClick={() => setSelection({ kind: "tool", id: tool.id })}
                                  className={`flex-1 rounded-2xl border px-3 py-3 text-left transition ${
                                    selection?.kind === "tool" && selection.id === tool.id
                                      ? "border-blue-400 bg-accentSoft text-white shadow-glow"
                                      : "border-border bg-panelAlt text-text hover:border-blue-500/40"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="text-sm font-semibold">{tool.name}</div>
                                    <Badge>{formatPermissionLevel(tool.permission_level)}</Badge>
                                  </div>
                                  <div className="mt-1 text-xs text-muted">
                                    {tool.requires_human_approval ? "需要人工确认" : "自动调用"}
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteTool(tool.id)}
                                  className="self-center px-1 text-lg leading-none text-red-200/70 transition hover:text-red-100"
                                  title="删除工具"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </SidebarSection>
            ) : null}

            {activeSection === "persistence" ? (
              <SidebarSection
                icon={Database}
                title="Persistence"
                subtitle={sectionMeta.persistence.subtitle}
                action={
                  <Button
                    size="icon"
                    variant="secondary"
                    onClick={() => void createPersistenceProfile()}
                    title="新建持久化配置"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                }
              >
                <div className="space-y-2">
                  {persistenceProfiles.map((profile) => (
                    <div key={profile.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            "application/agent-console",
                            JSON.stringify({ kind: "persistence-library", id: profile.id })
                          );
                        }}
                        onClick={() => setSelection({ kind: "persistence", id: profile.id })}
                        className={`flex-1 rounded-2xl border px-3 py-3 text-left transition ${
                          selection?.kind === "persistence" && selection.id === profile.id
                            ? "border-blue-400 bg-accentSoft text-white shadow-glow"
                            : "border-border bg-panelAlt text-text hover:border-blue-500/40"
                        }`}
                      >
                        <div className="text-sm font-semibold">{profile.name}</div>
                        <div className="mt-1 text-xs text-muted">
                          {profile.backend_type} · {profile.checkpointer_type} · {profile.store_type}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePersistenceProfile(profile.id)}
                        className="self-center px-1 text-lg leading-none text-red-200/70 transition hover:text-red-100"
                        title="删除持久化配置"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </SidebarSection>
            ) : null}
        </div>
      </div>
    </aside>
  );
}
