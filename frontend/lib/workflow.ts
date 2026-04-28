import type { Edge, Node, Viewport } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

import type {
  CanvasLayoutState,
  MiddlewareDefinition,
  PersistenceProfile,
  RunEventRecord,
  RunRecord,
  SubagentTemplate,
  SupervisorConfig,
  ToolDefinition,
  WorkflowNodeKind,
  WorkflowSelection
} from "@/lib/types";

export type WorkflowNodeData = {
  kind: WorkflowNodeKind;
  entityId: string;
  title: string;
  subtitle: string;
  body?: string;
  countLabel?: string;
  selected: boolean;
  highlighted: boolean;
  running: boolean;
  warning?: boolean;
  boundTools?: Array<{
    id: string;
    name: string;
    namespace: string;
    permissionLabel: string;
    requiresHumanApproval: boolean;
  }>;
  boundMiddlewares?: Array<{
    id: string;
    name: string;
    scope: string;
  }>;
  persistenceProfile?: {
    id: string;
    name: string;
    backendType: string;
    checkpointerType: string;
  } | null;
};

export type WorkflowEdgeData = {
  label: string;
  preview: string;
  highlighted: boolean;
  running: boolean;
};

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.9 };

export function getNodeId(kind: WorkflowNodeKind, entityId: string) {
  return `${kind}:${entityId}`;
}

export function getDefaultViewport(): Viewport {
  return DEFAULT_VIEWPORT;
}

function defaultPosition(kind: WorkflowNodeKind, index = 0) {
  if (kind === "supervisor") return { x: 420, y: 80 };
  if (kind === "subagent") return { x: 160 + index * 300, y: 280 };
  return { x: 160 + index * 260, y: 520 };
}

function resolvePosition(
  layout: CanvasLayoutState,
  nodeId: string,
  kind: WorkflowNodeKind,
  index: number
) {
  return layout.positions[nodeId] ?? defaultPosition(kind, index);
}

function collectRunHighlights(run: RunRecord | null, events: RunEventRecord[]) {
  const names = new Set<string>();
  const types = new Set<string>();

  for (const event of events) {
    if (event.source_name) names.add(event.source_name);
    if (event.source_type) types.add(event.source_type);
    if (event.event_type === "agent_compiled") {
      const subagentNames = event.payload?.subagent_names;
      if (Array.isArray(subagentNames)) {
        for (const name of subagentNames) {
          if (typeof name === "string") names.add(name);
        }
      }
    }
  }

  return {
    names,
    isRunning: run?.status === "running",
    isFailed: run?.status === "failed"
  };
}

export function buildWorkflowGraph(args: {
  supervisor: SupervisorConfig | null;
  subagents: SubagentTemplate[];
  tools: ToolDefinition[];
  middlewares: MiddlewareDefinition[];
  persistenceProfiles: PersistenceProfile[];
  selection: WorkflowSelection;
  selectedNodeIds?: string[];
  layout: CanvasLayoutState;
  run: RunRecord | null;
  runEvents: RunEventRecord[];
}) {
  const {
    supervisor,
    subagents,
    tools,
    middlewares,
    persistenceProfiles,
    selection,
    selectedNodeIds = [],
    layout,
    run,
    runEvents
  } = args;
  const nodes: Node<WorkflowNodeData>[] = [];
  const edges: Edge<WorkflowEdgeData>[] = [];
  const selectedNodeIdSet = new Set(selectedNodeIds);

  if (!supervisor) {
    return { nodes, edges, viewport: layout.viewport ?? DEFAULT_VIEWPORT };
  }

  const highlightState = collectRunHighlights(run, runEvents);
  const supervisorMiddlewares = middlewares.filter((middleware) =>
    supervisor.middleware_ids.includes(middleware.id)
  );
  const persistenceProfile =
    persistenceProfiles.find((profile) => profile.id === supervisor.persistence_profile_id) ?? null;

  const supervisorNodeId = getNodeId("supervisor", supervisor.id);
  const supervisorSelected =
    selectedNodeIdSet.has(supervisorNodeId) ||
    (selection?.kind === "supervisor" && selection.id === supervisor.id);
  nodes.push({
    id: supervisorNodeId,
    type: "supervisor",
    dragHandle: supervisorSelected ? ".workflow-node-drag" : undefined,
    draggable: supervisorSelected,
    selected: supervisorSelected,
    position: resolvePosition(layout, supervisorNodeId, "supervisor", 0),
    data: {
      kind: "supervisor",
      entityId: supervisor.id,
      title: supervisor.name,
      subtitle: supervisor.runtime.model,
      body: supervisor.runtime.system_prompt,
      countLabel: `${supervisor.subagent_ids.length} 个子智能体`,
      selected: supervisorSelected,
      highlighted: highlightState.names.has(supervisor.name),
      running: highlightState.isRunning,
      warning: !supervisor.enabled || highlightState.isFailed,
      boundMiddlewares: supervisorMiddlewares.map((middleware) => ({
        id: middleware.id,
        name: middleware.name,
        scope: middleware.scope
      })),
      persistenceProfile: persistenceProfile
        ? {
            id: persistenceProfile.id,
            name: persistenceProfile.name,
            backendType: persistenceProfile.backend_type,
            checkpointerType: persistenceProfile.checkpointer_type
          }
        : null
    }
  });

  const boundSubagents = subagents.filter((subagent) => supervisor.subagent_ids.includes(subagent.id));

  boundSubagents.forEach((subagent, index) => {
    const boundTools = tools.filter((tool) => subagent.tool_ids.includes(tool.id));
    const boundMiddlewares = middlewares.filter((middleware) =>
      subagent.middleware_ids.includes(middleware.id)
    );
    const subagentNodeId = getNodeId("subagent", subagent.id);
    const subagentSelected =
      selectedNodeIdSet.has(subagentNodeId) ||
      (selection?.kind === "subagent" && selection.id === subagent.id);
    nodes.push({
      id: subagentNodeId,
      type: "subagent",
      dragHandle: subagentSelected ? ".workflow-node-drag" : undefined,
      draggable: subagentSelected,
      selected: subagentSelected,
      position: resolvePosition(layout, subagentNodeId, "subagent", index),
      data: {
        kind: "subagent",
        entityId: subagent.id,
        title: subagent.name,
        subtitle: subagent.runtime.model,
        body: subagent.description,
        countLabel: `${subagent.tool_ids.length} 个工具`,
        selected: subagentSelected,
        highlighted: highlightState.names.has(subagent.name),
        running: highlightState.isRunning,
        warning: !subagent.enabled,
        boundTools: boundTools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          namespace: tool.namespace,
          permissionLabel: formatPermissionLevel(tool.permission_level),
          requiresHumanApproval: tool.requires_human_approval
        })),
        boundMiddlewares: boundMiddlewares.map((middleware) => ({
          id: middleware.id,
          name: middleware.name,
          scope: middleware.scope
        }))
      }
    });

    edges.push({
      id: `edge:${supervisor.id}:${subagent.id}`,
      source: supervisorNodeId,
      target: subagentNodeId,
      type: "workflow",
      animated: highlightState.isRunning,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      data: {
        label: "任务分派",
        preview: `总控把用户任务与上下文传递给 ${subagent.name}`,
        highlighted: highlightState.names.has(subagent.name),
        running: highlightState.isRunning
      }
    });
  });

  return {
    nodes,
    edges,
    viewport: layout.viewport ?? DEFAULT_VIEWPORT
  };
}

export function formatPermissionLevel(value: string) {
  return (
    {
      safe: "安全",
      sensitive: "敏感",
      dangerous: "危险"
    }[value] ?? value
  );
}
