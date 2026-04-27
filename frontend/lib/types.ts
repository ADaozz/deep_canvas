export type PermissionLevel = "safe" | "sensitive" | "dangerous";

export type AgentRuntimeConfig = {
  model: string;
  temperature: number;
  system_prompt: string;
};

export type BackendConfig = {
  type: string;
  import_path: string | null;
  config: Record<string, unknown>;
};

export type ToolDefinition = {
  id: string;
  namespace: string;
  name: string;
  python_import_path: string;
  description: string;
  args_schema: Record<string, unknown>;
  permission_level: PermissionLevel;
  requires_human_approval: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ToolSource = {
  tool_id: string;
  python_import_path: string;
  source_code: string;
};

export type MiddlewareDefinition = {
  id: string;
  name: string;
  scope: string;
  python_import_path: string;
  description: string;
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PersistenceProfile = {
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
  created_at: string;
  updated_at: string;
};

export type SubagentTemplate = {
  id: string;
  name: string;
  description: string;
  runtime: AgentRuntimeConfig;
  tool_ids: string[];
  skill_paths: string[];
  middleware_ids: string[];
  interrupt_on: Record<string, unknown> | null;
  response_format: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type SupervisorConfig = {
  id: string;
  name: string;
  runtime: AgentRuntimeConfig;
  subagent_ids: string[];
  global_tool_ids: string[];
  persistence_profile_id: string | null;
  backend: BackendConfig | null;
  memory: string[];
  skills: string[];
  middleware_ids: string[];
  interrupt_on: Record<string, unknown> | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ValidationIssue = {
  level: "error" | "warning" | "info" | string;
  code: string;
  message: string;
  target: string | null;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type GeneratedConfig = {
  config: Record<string, unknown>;
  python_code: string;
  project_files: Array<{
    path: string;
    content: string;
  }>;
  workflow_validation: ValidationResult;
  code_validation: ValidationResult;
  archive_filename: string | null;
  download_url: string | null;
};

export type RunRecord = {
  id: string;
  supervisor_id: string;
  input_text: string;
  status: string;
  output_text: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type RunEventRecord = {
  id: string;
  run_id: string;
  event_type: string;
  source_type: string;
  source_name: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UIStateRecord = {
  id: string;
  user_id: string;
  page_key: string;
  component_key: string;
  state: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkflowNodeKind = "supervisor" | "subagent" | "tool";

export type WorkflowSelection =
  | { kind: "supervisor"; id: string }
  | { kind: "subagent"; id: string }
  | { kind: "tool"; id: string }
  | { kind: "middleware"; id: string }
  | { kind: "persistence"; id: string }
  | null;

export type CanvasLayoutState = {
  positions: Record<string, { x: number; y: number }>;
  viewport?: { x: number; y: number; zoom: number };
};
