"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Play, Settings2, Sparkles, WandSparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowCanvas } from "@/components/workflow/workflow-canvas";
import { WorkflowParameterPanel } from "@/components/workflow/workflow-parameter-panel";
import { WorkflowRunConsole } from "@/components/workflow/workflow-run-console";
import { WorkflowSidebar } from "@/components/workflow/workflow-sidebar";
import { useWorkflowStore } from "@/stores/workflow-store";

import "@xyflow/react/dist/style.css";

type InspectorMode = "node" | "generate" | "run";

export function WorkflowConsole() {
  const [toolSearch, setToolSearch] = useState("");
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>("node");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorQuery, setGeneratorQuery] = useState("");
  const {
    load,
    initialized,
    loading,
    errorMessage,
    autoGenerateWorkflow,
    selectedSupervisorId,
    supervisors,
    selection,
    run,
    statusMessage
  } = useWorkflowStore();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (selection) {
      setInspectorMode("node");
    }
  }, [selection]);

  const selectedSupervisor = useMemo(
    () => supervisors.find((item) => item.id === selectedSupervisorId) ?? null,
    [selectedSupervisorId, supervisors]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.08),transparent_24%),linear-gradient(180deg,rgba(10,15,21,0.9),rgba(10,15,21,0.98))]" />
      <div className="absolute inset-0">
        <WorkflowCanvas />
      </div>

      <WorkflowSidebar toolSearch={toolSearch} onToolSearchChange={setToolSearch} />

      <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-24">
        <div className="pointer-events-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-[28px] border border-border/80 bg-panel/86 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl border border-border bg-accentSoft p-2.5 text-blue-200">
              <Bot className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">DeepCanvas</div>
              <div className="mt-1 truncate text-sm font-semibold text-text">
                {selectedSupervisor ? `${selectedSupervisor.name} · ${selectedSupervisor.runtime.model}` : "选择一个总控，开始编排工作流"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge>{statusMessage}</Badge>
            {run ? <Badge>{run.status}</Badge> : null}
            <Button
              size="sm"
              variant={inspectorMode === "node" ? "primary" : "secondary"}
              onClick={() => setInspectorMode("node")}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              节点参数
            </Button>
            <Button
              size="sm"
              variant={inspectorMode === "generate" ? "primary" : "secondary"}
              onClick={() => setInspectorMode("generate")}
            >
              <WandSparkles className="mr-2 h-4 w-4" />
              生成模板
            </Button>
            <Button
              size="sm"
              variant={inspectorMode === "run" ? "primary" : "secondary"}
              onClick={() => setInspectorMode("run")}
            >
              <Play className="mr-2 h-4 w-4" />
              运行调试
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setGeneratorOpen(true)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              智能生成
            </Button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 top-24 z-30 flex w-[430px]">
        <div className="pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[30px] border border-border/80 bg-panel/88 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted">Inspector</div>
              <div className="mt-1 text-sm font-semibold text-text">
                {inspectorMode === "node"
                  ? "节点编辑面板"
                  : inspectorMode === "generate"
                    ? "项目模板面板"
                    : "运行调试面板"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setInspectorMode("node")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  inspectorMode === "node"
                    ? "bg-accentSoft text-white"
                    : "text-muted hover:bg-white/5 hover:text-text"
                }`}
              >
                参数
              </button>
              <button
                type="button"
                onClick={() => setInspectorMode("generate")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  inspectorMode === "generate"
                    ? "bg-accentSoft text-white"
                    : "text-muted hover:bg-white/5 hover:text-text"
                }`}
              >
                生成
              </button>
              <button
                type="button"
                onClick={() => setInspectorMode("run")}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  inspectorMode === "run"
                    ? "bg-accentSoft text-white"
                    : "text-muted hover:bg-white/5 hover:text-text"
                }`}
              >
                运行
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {inspectorMode === "node" ? (
              <WorkflowParameterPanel />
            ) : (
              <WorkflowRunConsole mode={inspectorMode} />
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/80 bg-panel/86 px-3 py-2 text-xs text-muted shadow-lg backdrop-blur">
          <Play className="h-3.5 w-3.5 text-teal-300" />
          从左侧组件栏拖入 Subagent 和 Tool，画布会实时映射成 Deep Agents 项目模板。
        </div>
      </div>

      {!initialized || loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-panel px-6 py-4 text-sm text-muted">
            正在加载工作流控制台...
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-100 shadow-lg">
          {errorMessage}
        </div>
      ) : null}

      {generatorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/72 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-[28px] border border-border bg-panel shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted">智能生成</div>
                <div className="mt-1 text-sm font-semibold text-text">
                  用一句需求自动生成总控、子智能体、工具绑定和提示词
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGeneratorOpen(false)}
                className="rounded-full border border-border bg-background/60 p-2 text-muted transition hover:border-blue-500/40 hover:text-text"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="text-sm leading-6 text-slate-300">
                例如：为“研究报告生成”场景自动生成一个总控，包含研究、分析、写作三个子智能体，并绑定合适的工具。
              </div>
              <textarea
                value={generatorQuery}
                onChange={(event) => setGeneratorQuery(event.target.value)}
                className="min-h-[160px] w-full rounded-2xl border border-border bg-panelAlt px-4 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="输入你的业务场景、目标和期望的子智能体职责..."
              />
              <div className="flex items-center justify-end gap-3">
                <Button variant="secondary" onClick={() => setGeneratorOpen(false)}>
                  取消
                </Button>
                <Button
                  onClick={async () => {
                    await autoGenerateWorkflow(generatorQuery);
                    setGeneratorOpen(false);
                    setGeneratorQuery("");
                    setInspectorMode("node");
                  }}
                  disabled={!generatorQuery.trim() || loading}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  生成 Workflow
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
