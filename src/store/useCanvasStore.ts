import { create } from "zustand";
import type { CanvasNode, CanvasEdge, CanvasNodeStatus } from "@/core/canvas/types";
import { planBuild, runSubagentNode } from "@/core/canvas/orchestrator";
import type { HermozAction, PersonalityConfig } from "@/types";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasStore {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: Viewport;
  viewportSize: { w: number; h: number };
  selectedNodeId: string | null;
  activeNodeId: string | null;
  isRunning: boolean;
  pendingApproval: { nodeId: string; action: HermozAction } | null;
  approvalResolver: ((approved: boolean) => void) | null;
  lastGoal: string;

  setViewport: (v: Viewport) => void;
  setViewportSize: (w: number, h: number) => void;
  selectNode: (id: string | null) => void;
  focusNode: (id: string) => void;
  focusActiveNode: () => void;
  resolveApproval: (approved: boolean) => void;
  startBuild: (goal: string, workspaceFolder: string | undefined, personality: PersonalityConfig) => Promise<void>;
  reset: () => void;
}

function updateNode(nodes: CanvasNode[], id: string, patch: Partial<CanvasNode>): CanvasNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, ...patch } : n));
}

function appendLog(nodes: CanvasNode[], id: string, line: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id ? { ...n, log: [...n.log, line].slice(-200) } : n));
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  viewportSize: { w: 800, h: 600 },
  selectedNodeId: null,
  activeNodeId: null,
  isRunning: false,
  pendingApproval: null,
  approvalResolver: null,
  lastGoal: "",

  setViewport: (v) => set({ viewport: v }),
  setViewportSize: (w, h) => set({ viewportSize: { w, h } }),
  selectNode: (id) => set({ selectedNodeId: id }),

  focusNode: (id) => {
    const { nodes, viewportSize, viewport } = get();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const zoom = viewport.zoom;
    set({
      viewport: {
        zoom,
        x: viewportSize.w / 2 - (node.x + 90) * zoom,
        y: viewportSize.h / 2 - (node.y + 40) * zoom,
      },
    });
  },

  focusActiveNode: () => {
    const { activeNodeId, focusNode } = get();
    if (activeNodeId) focusNode(activeNodeId);
  },

  resolveApproval: (approved) => {
    const { approvalResolver } = get();
    if (approvalResolver) approvalResolver(approved);
    set({ pendingApproval: null, approvalResolver: null });
  },

  reset: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      activeNodeId: null,
      isRunning: false,
      pendingApproval: null,
      approvalResolver: null,
    }),

  startBuild: async (goal, workspaceFolder, personality) => {
    if (get().isRunning) return;
    get().reset();
    set({ isRunning: true, lastGoal: goal });

    const startNode: CanvasNode = { id: "start", kind: "start", title: "Start", status: "success", x: 40, y: 280, log: [] };
    const plannerNode: CanvasNode = {
      id: "planner",
      kind: "planner",
      title: "Planner",
      status: "running",
      x: 300,
      y: 280,
      log: ["Designing the architecture..."],
    };
    const endNode: CanvasNode = { id: "end", kind: "end", title: "End", status: "idle", x: 1500, y: 280, log: [] };

    set({
      nodes: [startNode, plannerNode, endNode],
      edges: [{ id: "e-start-planner", source: "start", target: "planner" }],
      activeNodeId: "planner",
    });
    get().focusActiveNode();

    let plan;
    try {
      plan = await planBuild(goal, personality);
    } catch (e: any) {
      const msg = e?.message || String(e);
      set((s) => ({
        nodes: updateNode(appendLog(s.nodes, "planner", `Planning failed: ${msg}`), "planner", {
          status: "error",
          output: msg,
        }),
        isRunning: false,
        activeNodeId: null,
      }));
      return;
    }

    const subtaskNodes: CanvasNode[] = plan.subtasks.map((t, i) => ({
      id: t.id,
      kind: "subagent",
      title: t.title,
      role: t.role,
      prompt: t.prompt,
      status: "queued",
      x: 640,
      y: 80 + i * 180,
      log: [],
    }));

    const subtaskEdges: CanvasEdge[] = plan.subtasks.flatMap((t) => [
      { id: `e-planner-${t.id}`, source: "planner", target: t.id },
      { id: `e-${t.id}-end`, source: t.id, target: "end" },
    ]);

    set((s) => ({
      nodes: [
        ...updateNode(s.nodes, "planner", { status: "success", output: plan.architecture }),
        ...subtaskNodes,
      ],
      edges: [...s.edges, ...subtaskEdges],
    }));

    // Subagents run one at a time — see orchestrator.ts for why (avoids
    // sharing mutable loop state across concurrent tasks in this version).
    for (const task of plan.subtasks) {
      set({ activeNodeId: task.id });
      set((s) => ({ nodes: updateNode(s.nodes, task.id, { status: "running" }) }));
      get().focusActiveNode();

      const result = await runSubagentNode(task, {
        workspaceFolder,
        personality,
        onLog: (line) => set((s) => ({ nodes: appendLog(s.nodes, task.id, line) })),
        onStatusChange: (status: CanvasNodeStatus) =>
          set((s) => ({ nodes: updateNode(s.nodes, task.id, { status }) })),
        requestApproval: (action) =>
          new Promise<boolean>((resolve) => {
            set({ pendingApproval: { nodeId: task.id, action }, approvalResolver: resolve });
          }),
      });

      set((s) => ({
        nodes: updateNode(s.nodes, task.id, {
          status: result.success ? "success" : "error",
          output: result.summary,
        }),
      }));
    }

    const anyFailed = get().nodes.some((n) => n.kind === "subagent" && n.status === "error");
    set((s) => ({
      nodes: updateNode(s.nodes, "end", { status: anyFailed ? "error" : "success" }),
      isRunning: false,
      activeNodeId: null,
    }));
  },
}));
