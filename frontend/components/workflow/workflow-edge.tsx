"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps
} from "@xyflow/react";

import type { WorkflowEdgeData } from "@/lib/workflow";

type WorkflowEdgeType = Edge<WorkflowEdgeData, "workflow">;

export function WorkflowEdge(props: EdgeProps<WorkflowEdgeType>) {
  const [edgePath, labelX, labelY] = getBezierPath(props);
  const edgeData = props.data;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          strokeWidth: edgeData?.highlighted ? 2.8 : 2.1,
          stroke: edgeData?.running ? "#38bdf8" : edgeData?.highlighted ? "#5eead4" : "#6b7f99",
          filter: edgeData?.highlighted ? "drop-shadow(0 0 8px rgba(45, 212, 191, 0.28))" : "none"
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`
          }}
          className="pointer-events-none rounded-full border border-border/80 bg-panel/92 px-2.5 py-1 text-[10px] text-slate-200 shadow-lg"
        >
          <div className="font-medium">{edgeData?.label}</div>
          <div className="text-[10px] text-muted">{edgeData?.preview}</div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
