"use client";

import { Handle, Position } from "@xyflow/react";
import { AlertCircle, Cable, Database, Layers3, Sparkles, Wrench } from "lucide-react";

import type { WorkflowNodeData } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/stores/workflow-store";

const iconMap = {
  supervisor: Sparkles,
  subagent: Cable,
  tool: Wrench
};

export function SharedWorkflowNode({ data }: { data: WorkflowNodeData }) {
  const setSelection = useWorkflowStore((state) => state.setSelection);
  const unbindTool = useWorkflowStore((state) => state.unbindTool);
  const Icon = iconMap[data.kind];
  const visibleMiddlewares = data.boundMiddlewares?.slice(0, 2) ?? [];

  return (
    <div
      onClick={() => setSelection({ kind: data.kind, id: data.entityId })}
      className={cn(
        "group relative min-w-[220px] max-w-[260px] rounded-2xl border bg-panel/95 p-4 shadow-lg transition",
        data.selected && "border-blue-400 shadow-glow",
        !data.selected && "border-border hover:border-blue-500/40",
        data.highlighted && "ring-2 ring-teal-400/40",
        data.warning && "border-amber-500/40"
      )}
    >
      {data.kind === "subagent" ? (
        <Handle
          type="target"
          id="in"
          position={Position.Top}
          className="!h-3 !w-3 !border-2 !border-background !bg-blue-400"
        />
      ) : null}
      {data.kind === "supervisor" ? (
        <Handle
          type="source"
          id="out"
          position={Position.Bottom}
          className="!h-3 !w-3 !border-2 !border-background !bg-teal-400"
        />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-xl border border-border bg-accentSoft p-2 text-blue-200">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted">
              {data.kind}
            </div>
            <div className="mt-1 text-sm font-semibold text-text">{data.title}</div>
          </div>
        </div>
        {data.warning ? <AlertCircle className="h-4 w-4 text-amber-300" /> : null}
      </div>
      <div className="mt-3 text-xs text-muted">{data.subtitle}</div>
      {data.body ? <div className="mt-3 line-clamp-3 text-xs leading-5 text-slate-300">{data.body}</div> : null}
      {data.kind === "supervisor" && data.persistenceProfile ? (
        <div className="mt-4 rounded-2xl border border-border bg-panelAlt/70 p-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <Database className="h-3.5 w-3.5" />
            Persistence
          </div>
          <div className="mt-2 text-sm font-medium text-slate-100">{data.persistenceProfile.name}</div>
          <div className="mt-1 text-[11px] text-muted">
            backend={data.persistenceProfile.backendType} · checkpointer={data.persistenceProfile.checkpointerType}
          </div>
        </div>
      ) : null}
      {data.boundMiddlewares && data.boundMiddlewares.length > 0 ? (
        <div className="mt-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
            <Layers3 className="h-3.5 w-3.5" />
            Middleware
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {visibleMiddlewares.map((middleware) => (
              <button
                key={middleware.id}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelection({ kind: "middleware", id: middleware.id });
                }}
                className="rounded-full border border-border bg-white/5 px-2 py-1 text-[11px] text-slate-200"
              >
                {middleware.name}
              </button>
            ))}
            {data.boundMiddlewares.length > visibleMiddlewares.length ? (
              <span className="rounded-full border border-border bg-white/5 px-2 py-1 text-[11px] text-muted">
                +{data.boundMiddlewares.length - visibleMiddlewares.length}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {data.kind === "subagent" ? (
        <div className="mt-4 relative">
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted">绑定工具</div>
          {!data.boundTools || data.boundTools.length === 0 ? (
            <div className="mt-2">
              <span className="text-[11px] text-muted">暂无绑定工具</span>
            </div>
          ) : null}
          {data.boundTools && data.boundTools.length > 0 ? (
            <div className="pointer-events-none absolute left-0 top-[calc(100%+10px)] z-20 min-w-[260px] rounded-2xl border border-border bg-panel/98 p-3 opacity-0 shadow-2xl transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted">
                工具列表
              </div>
              <div className="space-y-2">
                {data.boundTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-panelAlt px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelection({ kind: "tool", id: tool.id });
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-sm font-medium text-slate-100">{tool.name}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        {tool.namespace} · {tool.permissionLabel}
                        {tool.requiresHumanApproval ? " · 需人工确认" : ""}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void unbindTool(data.entityId, tool.id);
                      }}
                      className="shrink-0 px-1 text-base leading-none text-red-200/70 transition hover:text-red-100"
                      title="解绑工具"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex items-center justify-between gap-3">
        {data.kind !== "subagent" ? (
          <span className="rounded-full border border-border bg-white/5 px-2 py-1 text-[11px] text-muted">
            {data.countLabel ?? "可编辑节点"}
          </span>
        ) : (
          <span />
        )}
        {data.running ? (
          <span className="rounded-full bg-teal-500/15 px-2 py-1 text-[11px] text-teal-200">
            运行中
          </span>
        ) : null}
      </div>
    </div>
  );
}
