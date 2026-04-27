"use client";

import { useEffect, useMemo, useState } from "react";
import { Maximize2, Play, WandSparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflowStore } from "@/stores/workflow-store";

type WorkflowRunConsoleProps = {
  mode: "generate" | "run";
};

export function WorkflowRunConsole({ mode }: WorkflowRunConsoleProps) {
  const [input, setInput] = useState("你好");
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const { run, runEvents, validation, generated, runSelectedSupervisor, resumeRun, validateSelectedSupervisor, generateSelectedSupervisor } =
    useWorkflowStore();

  const generatedFiles = generated?.project_files ?? [];
  const selectedFile =
    generatedFiles.find((item) => item.path === activeFile) ?? generatedFiles[0] ?? null;
  const generatedWorkflowIssues = generated?.workflow_validation.issues ?? [];
  const generatedCodeIssues = generated?.code_validation.issues ?? [];
  const downloadUrl = generated?.download_url ? api.resolveAssetUrl(generated.download_url) : null;

  useEffect(() => {
    if (!generatedFiles.length) {
      setActiveFile(null);
      return;
    }
    if (!activeFile || !generatedFiles.some((item) => item.path === activeFile)) {
      setActiveFile(generatedFiles[0]?.path ?? null);
    }
  }, [activeFile, generatedFiles]);

  const validationSummary = useMemo(() => {
    if (!validation) return "尚未执行校验。";
    if (!validation.issues.length) return "没有发现校验问题。";
    return `${validation.issues.length} 条校验结果`;
  }, [validation]);

  const hasGeneratedValidation =
    generatedWorkflowIssues.length > 0 || generatedCodeIssues.length > 0;
  const latestInterrupt = useMemo(
    () => [...runEvents].reverse().find((event) => event.event_type === "run_interrupted") ?? null,
    [runEvents]
  );
  const interruptRequests = useMemo(() => {
    const interrupts = Array.isArray(latestInterrupt?.payload?.interrupts)
      ? (latestInterrupt?.payload?.interrupts as Array<Record<string, unknown>>)
      : [];
    const firstInterrupt = interrupts[0];
    const actionRequests = firstInterrupt?.action_requests;
    return Array.isArray(actionRequests) ? (actionRequests as Array<Record<string, unknown>>) : [];
  }, [latestInterrupt]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-panel/95">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text">
            {mode === "generate" ? "生成模板" : "运行调试"}
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted">
            {mode === "generate"
              ? "从当前 Workflow 生成 Deep Agents 项目模板，并做代码校验与打包。"
              : "输入任务、运行当前总控，并查看结果与运行事件。"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mode === "generate" ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void validateSelectedSupervisor()}
              >
                校验
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void generateSelectedSupervisor()}
              >
                生成
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {mode === "run" ? (
          <section className="rounded-2xl border border-border/80 bg-panelAlt/65 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">运行工作台</div>
              <div className="mt-1 text-sm text-slate-300">
                输入任务、运行当前总控并查看结果与事件。
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-[0.18em] text-muted">输入任务</div>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="min-h-[96px]"
              />
            </div>
            <Button className="w-full" onClick={() => void runSelectedSupervisor(input)}>
              <Play className="mr-2 h-4 w-4" />
              运行当前总控
            </Button>
            {run?.status === "interrupted" ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-amber-200">等待人工确认</div>
                <div className="mt-2 text-sm leading-6 text-amber-50">
                  当前运行已被中断，等待你对需要人工确认的工具调用作出决定。
                </div>
                {interruptRequests.length ? (
                  <div className="mt-3 space-y-2">
                    {interruptRequests.map((item, index) => (
                      <pre
                        key={`interrupt-${index}`}
                        className="overflow-auto rounded-xl border border-amber-500/20 bg-slate-950/30 p-3 text-[11px] leading-5 text-amber-50"
                      >
                        {JSON.stringify(item, null, 2)}
                      </pre>
                    ))}
                  </div>
                ) : null}
                {interruptRequests.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        void resumeRun(
                          run.id,
                          interruptRequests.map(() => ({ type: "approve" }))
                        )
                      }
                    >
                      全部批准并继续
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        void resumeRun(
                          run.id,
                          interruptRequests.map(() => ({
                            type: "reject",
                            message: "该工具调用未获批准。"
                          }))
                        )
                      }
                    >
                      全部拒绝
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-3 xl:grid-cols-2">
              <div className="min-w-0 rounded-2xl border border-border bg-panelAlt p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">运行结果</div>
                <div className="mt-2 min-h-[56px] break-words text-sm leading-6 text-slate-300">
                  {run?.output_text ?? run?.error_message ?? "尚未运行"}
                </div>
              </div>
              <div className="min-w-0 rounded-2xl border border-border bg-panelAlt p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">校验摘要</div>
                <div className="mt-2 space-y-2 text-sm text-slate-300">
                  {validation ? (
                    validation.issues.length > 0 ? (
                      validation.issues.map((issue) => (
                        <div key={`${issue.code}-${issue.target ?? ""}`} className="min-w-0">
                          <div className="break-all font-medium">{issue.code}</div>
                          <div className="break-words text-xs text-muted">{issue.message}</div>
                        </div>
                      ))
                    ) : (
                      <div>没有发现校验问题。</div>
                    )
                  ) : (
                    <div>{validationSummary}</div>
                  )}
                </div>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-border bg-panelAlt p-4">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted">
                <WandSparkles className="h-3.5 w-3.5" />
                事件日志
              </div>
              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                {runEvents.length > 0 ? (
                  runEvents.map((event) => (
                    <div key={event.id} className="rounded-xl border border-border bg-background/40 p-3">
                      <div className="text-xs font-medium text-slate-200">
                        {event.event_type} · {event.source_type}
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-5 text-muted">
                        {JSON.stringify(event.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-muted">运行一次总控后，这里会显示运行事件。</div>
                )}
              </div>
            </div>
          </div>
          </section>
        ) : null}

        {mode === "generate" ? (
          <section className="rounded-2xl border border-border/80 bg-panelAlt/65 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-muted">模板工作台</div>
              <div className="mt-1 text-sm text-slate-300">
                校验、下载和预览当前生成的 Deep Agents 项目模板。
              </div>
            </div>
            <div className="text-[11px] text-muted">
              {generatedFiles.length ? `${generatedFiles.length} 个文件` : "尚未生成"}
            </div>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="min-w-0 rounded-2xl border border-border bg-panelAlt/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted">模板校验</div>
                  <div className="text-[11px] text-muted">
                    {generated ? (hasGeneratedValidation ? "存在提示" : "全部通过") : "等待生成"}
                  </div>
                </div>
                {generated ? (
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border/80 bg-background/25 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">配置校验</div>
                      <div className="mt-2 space-y-2 text-xs text-slate-300">
                        {generatedWorkflowIssues.length ? (
                          generatedWorkflowIssues.map((issue) => (
                            <div key={`workflow-${issue.code}-${issue.target ?? ""}`} className="min-w-0">
                              <div className="break-all font-medium">{issue.code}</div>
                              <div className="break-words text-muted">{issue.message}</div>
                            </div>
                          ))
                        ) : (
                          <div>通过</div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/80 bg-background/25 p-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted">代码校验</div>
                      <div className="mt-2 space-y-2 text-xs text-slate-300">
                        {generatedCodeIssues.length ? (
                          generatedCodeIssues.map((issue) => (
                            <div key={`code-${issue.code}-${issue.target ?? ""}`} className="min-w-0">
                              <div className="break-all font-medium">{issue.code}</div>
                              <div className="break-words text-muted">{issue.message}</div>
                            </div>
                          ))
                        ) : (
                          <div>通过</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-muted">生成一次模板后，这里会显示配置和代码校验结果。</div>
                )}
              </div>

              <div className="min-w-0 rounded-2xl border border-border bg-panelAlt/90 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted">模板下载</div>
                  <div className="text-[11px] text-muted">{downloadUrl ? "可下载" : "等待生成"}</div>
                </div>
                {generated && !downloadUrl ? (
                  <div className="mt-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                    当前看到的是旧的生成结果，还没有下载链接。重新点击一次“生成”，后端会重新打包 zip 并返回下载地址。
                  </div>
                ) : null}
                {downloadUrl ? (
                  <div className="mt-3 rounded-2xl border border-blue-500/20 bg-accentSoft/35 p-3">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-blue-200/90">下载压缩包</div>
                    <div className="mt-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 text-xs text-slate-200">
                        <div className="truncate">{generated?.archive_filename ?? "deepagent-template.zip"}</div>
                        <div className="mt-1 break-all text-muted">{downloadUrl}</div>
                      </div>
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-blue-400 bg-accentSoft px-3 py-1 text-[11px] text-white transition hover:opacity-90"
                      >
                        下载
                      </a>
                    </div>
                  </div>
                ) : !generated ? (
                  <div className="mt-3 text-sm text-muted">生成模板后，这里会出现 zip 下载链接。</div>
                ) : null}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl border border-border bg-panelAlt/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">文件预览</div>
                <div className="flex items-center gap-2">
                  <div className="text-[11px] text-muted">
                    {selectedFile?.path ?? (generatedFiles.length ? "选择文件" : "等待生成")}
                  </div>
                  {generatedFiles.length ? (
                    <button
                      type="button"
                      onClick={() => setPreviewExpanded(true)}
                      className="rounded-full border border-border bg-background/60 p-2 text-muted transition hover:border-blue-500/40 hover:text-text"
                      title="全屏预览"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
              {generatedFiles.length ? (
                <>
                  <div className="mt-3 overflow-x-auto pb-1">
                    <div className="flex min-w-max flex-wrap gap-2 pr-1">
                      {generatedFiles.map((file) => (
                        <button
                          key={file.path}
                          type="button"
                          onClick={() => setActiveFile(file.path)}
                          className={`rounded-full border px-3 py-1 text-[11px] transition ${
                            selectedFile?.path === file.path
                              ? "border-blue-400 bg-accentSoft text-white"
                              : "border-border bg-background/60 text-muted hover:border-blue-500/40 hover:text-text"
                          }`}
                        >
                          {file.path}
                        </button>
                      ))}
                    </div>
                  </div>
                  <pre className="mt-3 min-h-[420px] max-h-[620px] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-background/60 p-5 font-mono text-[12px] leading-6 text-slate-300">
                    {selectedFile?.content ?? generated?.python_code ?? ""}
                  </pre>
                </>
              ) : (
                <pre className="mt-3 min-h-[320px] whitespace-pre-wrap rounded-2xl border border-border bg-background/30 p-4 text-[12px] leading-6 text-slate-300">
                  尚未生成项目模板。
                </pre>
              )}
            </div>
          </div>
          </section>
        ) : null}
      </div>
      {previewExpanded && selectedFile ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-950/78 p-6 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-[1600px] flex-col overflow-hidden rounded-3xl border border-border bg-panel shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.18em] text-muted">全屏文件预览</div>
                <div className="mt-1 truncate text-sm text-slate-200">{selectedFile.path}</div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExpanded(false)}
                className="rounded-full border border-border bg-background/60 p-2 text-muted transition hover:border-blue-500/40 hover:text-text"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col px-6 py-5">
              <div className="overflow-x-auto pb-2">
                <div className="flex min-w-max flex-wrap gap-2 pr-1">
                  {generatedFiles.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => setActiveFile(file.path)}
                      className={`rounded-full border px-3 py-1 text-[11px] transition ${
                        selectedFile.path === file.path
                          ? "border-blue-400 bg-accentSoft text-white"
                          : "border-border bg-background/60 text-muted hover:border-blue-500/40 hover:text-text"
                      }`}
                    >
                      {file.path}
                    </button>
                  ))}
                </div>
              </div>
              <pre className="mt-3 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-border bg-background/60 p-6 font-mono text-[13px] leading-7 text-slate-200">
                {selectedFile.content}
              </pre>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
