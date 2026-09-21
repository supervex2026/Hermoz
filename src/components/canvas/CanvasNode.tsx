import type { ReactNode } from "react";
import { ThinkingOrb } from "thinking-orbs";
import { Flag, CheckCircle2, XCircle, Clock, Sparkles, Wrench, Database, Plug, Server } from "lucide-react";
import type { CanvasNode as CanvasNodeT } from "@/core/canvas/types";

const ROLE_ICON: Record<string, ReactNode> = {
  frontend_ui: <Sparkles size={13} />,
  backend: <Server size={13} />,
  database: <Database size={13} />,
  integration: <Plug size={13} />,
  devops: <Wrench size={13} />,
};

export function CanvasNode({
  node,
  isActive,
  isSelected,
  onClick,
}: {
  node: CanvasNodeT;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isEndpoint = node.kind === "start" || node.kind === "end";

  return (
    <div
      className={`hermoz-canvas-node status-${node.status} kind-${node.kind}${isActive ? " is-active" : ""}${isSelected ? " is-selected" : ""}`}
      style={{ left: node.x, top: node.y }}
      onClick={onClick}
    >
      {isEndpoint ? (
        <div className="node-endpoint">
          <Flag size={14} />
          <span>{node.title}</span>
        </div>
      ) : (
        <>
          <div className="node-header">
            <span className="node-kind-tag">{node.kind === "planner" ? "PLANNER" : (node.role || "AGENT").toUpperCase()}</span>
            <StatusIcon status={node.status} />
          </div>
          <div className="node-title">
            {node.role && ROLE_ICON[node.role]}
            <span>{node.title}</span>
          </div>
          {node.status === "running" && (
            <div className="node-orb-row">
              <ThinkingOrb state={node.kind === "planner" ? "shaping" : "working"} size={20} theme="dark" />
              <span className="node-orb-label">working…</span>
            </div>
          )}
          {node.status === "awaiting_approval" && (
            <div className="node-orb-row awaiting">
              <Clock size={13} />
              <span>needs your approval</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: CanvasNodeT["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 size={14} className="status-icon success" />;
    case "error":
      return <XCircle size={14} className="status-icon error" />;
    case "running":
    case "awaiting_approval":
      return <span className="status-dot pulsing" />;
    default:
      return <span className="status-dot" />;
  }
}
