"use client";

import { SharedWorkflowNode } from "@/components/workflow/nodes/shared-node";
import type { WorkflowNodeData } from "@/lib/workflow";

export function SubagentNode({ data }: { data: WorkflowNodeData }) {
  return <SharedWorkflowNode data={data} />;
}
