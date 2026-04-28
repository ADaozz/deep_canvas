"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useOnSelectionChange,
  useEdgesState,
  useNodesState,
  type NodeTypes,
  type EdgeTypes
} from "@xyflow/react";

import { Badge } from "@/components/ui/badge";
import { buildWorkflowGraph, getDefaultViewport } from "@/lib/workflow";
import { useWorkflowStore } from "@/stores/workflow-store";
import { SubagentNode } from "@/components/workflow/nodes/subagent-node";
import { SupervisorNode } from "@/components/workflow/nodes/supervisor-node";
import { WorkflowEdge } from "@/components/workflow/workflow-edge";

const nodeTypes: NodeTypes = {
  supervisor: SupervisorNode,
  subagent: SubagentNode
};

const edgeTypes: EdgeTypes = {
  workflow: WorkflowEdge
};

function CanvasInner() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const persistTimerRef = useRef<number | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  const {
    selectedSupervisorId,
    supervisors,
    subagents,
    tools,
    middlewares,
    persistenceProfiles,
    selection,
    layout,
    run,
    runEvents,
    setNodePosition,
    setViewport,
    persistLayout,
    bindSubagentToSupervisor,
    bindToolToSubagent,
    bindMiddlewareToSupervisor,
    bindMiddlewareToSubagent,
    bindPersistenceToSupervisor,
    setSelection,
    statusMessage
  } = useWorkflowStore();

  const supervisor = supervisors.find((item) => item.id === selectedSupervisorId) ?? null;
  const graph = useMemo(
    () =>
      buildWorkflowGraph({
        supervisor,
        subagents,
        tools,
        middlewares,
        persistenceProfiles,
        selection,
        selectedNodeIds,
        layout,
        run,
        runEvents
      }),
    [
      layout,
      middlewares,
      persistenceProfiles,
      run,
      runEvents,
      selectedNodeIds,
      selection,
      subagents,
      supervisor,
      tools
    ]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(graph.nodes);
    setEdges(graph.edges);
  }, [graph.edges, graph.nodes, setEdges, setNodes]);

  const persistLater = () => {
    if (persistTimerRef.current) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void persistLayout();
    }, 400);
  };

  const handleNodeDragStop = (_event: unknown, node: { id: string; position: { x: number; y: number } }) => {
    setNodePosition(node.id, node.position);
    persistLater();
  };

  const handleSelectionDragStop = (
    _event: unknown,
    draggedNodes: Array<{ id: string; position: { x: number; y: number } }>
  ) => {
    for (const node of draggedNodes) {
      setNodePosition(node.id, node.position);
    }
    persistLater();
  };

  const handleConnect = (connection: Connection) => {
    const source = connection.source ?? "";
    const target = connection.target ?? "";
    const [sourceKind, sourceId] = source.split(":");
    const [targetKind, targetId] = target.split(":");

    if (sourceKind === "supervisor" && targetKind === "subagent") {
      void bindSubagentToSupervisor(targetId);
      return;
    }
    if (sourceKind === "subagent" && targetKind === "supervisor") {
      void bindSubagentToSupervisor(sourceId);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData("application/agent-console");
    if (!raw) return;
    const payload = JSON.parse(raw) as {
      kind:
        | "subagent-library"
        | "tool-library"
        | "middleware-library"
        | "persistence-library";
      id: string;
    };
    const pane = wrapperRef.current?.getBoundingClientRect();
    if (!pane) return;
    const position = {
      x: event.clientX - pane.left - 100,
      y: event.clientY - pane.top - 40
    };

    if (payload.kind === "subagent-library") {
      await bindSubagentToSupervisor(payload.id, position);
      persistLater();
      return;
    }

    if (payload.kind === "tool-library") {
      if (selection?.kind !== "subagent") {
        useWorkflowStore.setState({
          errorMessage: "拖入工具前，请先点击一个子智能体节点作为目标。",
          statusMessage: "缺少目标子智能体"
        });
        return;
      }
      await bindToolToSubagent(selection.id, payload.id, position);
      persistLater();
      return;
    }

    if (payload.kind === "middleware-library") {
      if (selection?.kind === "supervisor") {
        await bindMiddlewareToSupervisor(payload.id);
        persistLater();
        return;
      }
      if (selection?.kind === "subagent") {
        await bindMiddlewareToSubagent(selection.id, payload.id);
        persistLater();
        return;
      }
      useWorkflowStore.setState({
        errorMessage: "拖入中间件前，请先点击一个总控或子智能体节点作为目标。",
        statusMessage: "缺少 Middleware 绑定目标"
      });
      return;
    }

    if (payload.kind === "persistence-library") {
      if (selection?.kind !== "supervisor") {
        useWorkflowStore.setState({
          errorMessage: "拖入持久化配置前，请先点击一个总控节点作为目标。",
          statusMessage: "缺少 Persistence 绑定目标"
        });
        return;
      }
      await bindPersistenceToSupervisor(payload.id);
      persistLater();
    }
  };

  const handleNodeClick = (_event: unknown, node: { id: string }) => {
    const [kind, id] = node.id.split(":");
    setSelectedNodeIds([node.id]);
    if (kind === "supervisor" || kind === "subagent") {
      setSelection({ kind, id });
    }
  };

  const handleSelectionChange = useCallback(
    ({
      nodes: selectedNodes
    }: {
      nodes: Array<{ id: string }>;
      edges: Array<{ id: string }>;
    }) => {
      const nodeIds = selectedNodes.map((node) => node.id);
      setSelectedNodeIds(nodeIds);

      if (selectedNodes.length !== 1) {
        setSelection(null);
        return;
      }

      const [kind, id] = selectedNodes[0].id.split(":");
      if (kind === "supervisor" || kind === "subagent") {
        setSelection({ kind, id });
      } else {
        setSelection(null);
      }
    },
    [setSelection]
  );

  useOnSelectionChange({
    onChange: handleSelectionChange
  });

  return (
    <div
      ref={wrapperRef}
      className="relative h-full w-full overflow-hidden bg-grid bg-[size:26px_26px]"
      onDrop={(event) => void handleDrop(event)}
      onDragOver={(event) => event.preventDefault()}
    >
      <div className="pointer-events-none absolute left-1/2 top-5 z-10 flex -translate-x-1/2 items-center gap-2">
        <Badge>{supervisor ? `${supervisor.name} 工作流` : "请选择总控"}</Badge>
        <Badge>{nodes.length} 个节点</Badge>
        <Badge>{edges.length} 条连线</Badge>
        <Badge>{statusMessage}</Badge>
      </div>
      {!supervisor ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="rounded-3xl border border-border bg-panel/85 px-6 py-5 text-center shadow-lg backdrop-blur">
            <div className="text-sm font-semibold text-text">还没有选中总控</div>
            <div className="mt-2 text-sm text-muted">从左侧吸附栏创建或选择一个 Supervisor，开始搭建 Deep Agents 工作流。</div>
          </div>
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        selectNodesOnDrag={false}
        defaultViewport={graph.viewport ?? getDefaultViewport()}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStop={handleSelectionDragStop}
        onMoveEnd={(_, viewport) => {
          setViewport(viewport);
          persistLater();
        }}
        onPaneClick={() => {
          setSelectedNodeIds([]);
          setSelection(null);
        }}
      >
        <Controls position="bottom-right" />
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#304054" />
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
