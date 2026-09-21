import { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "@/store/useCanvasStore";
import { useHermozStore } from "@/store/useHermozStore";
import { CanvasNode } from "./CanvasNode";
import { ThinkingOrb } from "thinking-orbs";
import { Crosshair, Play, RotateCcw, Check, X, ZoomIn, ZoomOut } from "lucide-react";
import "./canvas.css";

export function CanvasView() {
  const {
    nodes,
    edges,
    viewport,
    viewportSize,
    selectedNodeId,
    activeNodeId,
    isRunning,
    pendingApproval,
    setViewport,
    setViewportSize,
    selectNode,
    focusActiveNode,
    resolveApproval,
    startBuild,
  } = useCanvasStore();

  const settings = useHermozStore((s) => s.settings);
  const containerRef = useRef<HTMLDivElement>(null);
  const [goalInput, setGoalInput] = useState("");
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; vx: number; vy: number }>({
    dragging: false, startX: 0, startY: 0, vx: 0, vy: 0,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportSize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    setViewportSize(el.clientWidth, el.clientHeight);
    return () => ro.disconnect();
  }, [setViewportSize]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".hermoz-canvas-node")) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, vx: viewport.x, vy: viewport.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [viewport]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setViewport({ ...viewport, x: dragRef.current.vx + dx, y: dragRef.current.vy + dy });
  }, [viewport, setViewport]);

  const onPointerUp = useCallback(() => { dragRef.current.dragging = false; }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(1.6, Math.max(0.35, viewport.zoom - e.deltaY * 0.001));
    setViewport({ ...viewport, zoom: next });
  }, [viewport, setViewport]);

  const zoomBy = (delta: number) => setViewport({ ...viewport, zoom: Math.min(1.6, Math.max(0.35, viewport.zoom + delta)) });

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;
  const activeNode = nodes.find((n) => n.id === activeNodeId) || null;
  const approvalForSelected = pendingApproval && selectedNode && pendingApproval.nodeId === selectedNode.id ? pendingApproval : null;

  const handleStartBuild = () => {
    const goal = goalInput.trim();
    if (!goal || isRunning) return;
    startBuild(goal, settings.workspaceFolder, settings.personality);
    setGoalInput("");
  };

  return (
    <div className="hermoz-canvas-root">
      <div className="hermoz-canvas-toolbar">
        <input
          className="hermoz-canvas-goal-input"
          placeholder="Describe what to build — e.g. a real working backend for my startup…"
          value={goalInput}
          onChange={(e) => setGoalInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleStartBuild()}
          disabled={isRunning}
        />
        <button className="hermoz-canvas-btn primary" onClick={handleStartBuild} disabled={isRunning || !goalInput.trim()}>
          {isRunning ? <ThinkingOrb state="working" size={20} theme="dark" /> : <Play size={14} />}
          <span>{isRunning ? "Building…" : "Build"}</span>
        </button>
        <button className="hermoz-canvas-btn" onClick={() => useCanvasStore.getState().reset()} title="Reset canvas">
          <RotateCcw size={14} />
        </button>
        <div className="hermoz-canvas-zoom">
          <button className="hermoz-canvas-btn icon" onClick={() => zoomBy(-0.15)}><ZoomOut size={13} /></button>
          <button className="hermoz-canvas-btn icon" onClick={() => zoomBy(0.15)}><ZoomIn size={13} /></button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="hermoz-canvas-viewport"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onWheel={onWheel}
      >
        <div className="hermoz-starfield" aria-hidden="true" />
        <div
          className="hermoz-canvas-content"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
        >
          <svg className="hermoz-canvas-edges" width={2400} height={1400}>
            {edges.map((e) => {
              const s = nodes.find((n) => n.id === e.source);
              const t = nodes.find((n) => n.id === e.target);
              if (!s || !t) return null;
              const x1 = s.x + 180, y1 = s.y + 40, x2 = t.x, y2 = t.y + 40;
              const midX = (x1 + x2) / 2;
              const live = s.status === "running" || t.status === "running";
              return (
                <path
                  key={e.id}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  className={`hermoz-canvas-edge${live ? " live" : ""}`}
                />
              );
            })}
          </svg>

          {nodes.map((n) => (
            <CanvasNode
              key={n.id}
              node={n}
              isActive={n.id === activeNodeId}
              isSelected={n.id === selectedNodeId}
              onClick={() => selectNode(n.id)}
            />
          ))}
        </div>
      </div>

      {activeNode && (
        <button className="hermoz-canvas-locate-btn" onClick={focusActiveNode} title="Find where Hermoz is working">
          <Crosshair size={14} />
          <span>Where's Hermoz? — {activeNode.title}</span>
        </button>
      )}

      {selectedNode && selectedNode.kind !== "start" && selectedNode.kind !== "end" && (
        <div className="hermoz-canvas-detail-panel">
          <div className="detail-header">
            <span className="node-kind-tag">{selectedNode.kind === "planner" ? "PLANNER" : (selectedNode.role || "AGENT").toUpperCase()}</span>
            <h3>{selectedNode.title}</h3>
            <button className="detail-close" onClick={() => selectNode(null)}><X size={14} /></button>
          </div>
          {selectedNode.prompt && <p className="detail-prompt">{selectedNode.prompt}</p>}

          <div className="detail-log">
            {selectedNode.log.map((line, i) => (
              <div key={i} className="detail-log-line">{line}</div>
            ))}
          </div>

          {selectedNode.output && (
            <div className="detail-output">
              <div className="detail-output-label">Result</div>
              <pre>{selectedNode.output}</pre>
            </div>
          )}

          {approvalForSelected && (
            <div className="detail-approval">
              <p>
                <strong>{approvalForSelected.action.type}</strong>
                {approvalForSelected.action.reason ? ` — ${approvalForSelected.action.reason}` : ""}
              </p>
              {approvalForSelected.action.command && <pre className="detail-approval-cmd">{approvalForSelected.action.command}</pre>}
              <div className="detail-approval-actions">
                <button className="hermoz-canvas-btn primary" onClick={() => resolveApproval(true)}>
                  <Check size={14} /> Approve
                </button>
                <button className="hermoz-canvas-btn danger" onClick={() => resolveApproval(false)}>
                  <X size={14} /> Deny
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
