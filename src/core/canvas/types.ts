import type { HermozAction } from "@/types";

export type CanvasNodeKind = "start" | "end" | "planner" | "subagent";

export type CanvasNodeStatus =
  | "idle"
  | "queued"
  | "running"
  | "awaiting_approval"
  | "success"
  | "error";

export interface CanvasNode {
  id: string;
  kind: CanvasNodeKind;
  title: string;
  /** For subagent nodes: what role it's playing (backend, frontend_ui, ...). */
  role?: string;
  /** For subagent nodes: the instructions it was given. */
  prompt?: string;
  status: CanvasNodeStatus;
  x: number;
  y: number;
  /** Human-readable step-by-step log, newest last. */
  log: string[];
  /** Final summary once the node finishes (success or error). */
  output?: string;
}

export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
}

export interface PlannedSubtask {
  id: string;
  title: string;
  role: string;
  prompt: string;
}

export interface PendingCanvasApproval {
  nodeId: string;
  action: HermozAction;
  resolve: (approved: boolean) => void;
}
