import { invoke } from "@tauri-apps/api/core";
import { agentLoopManager } from "@/core/agent/agentLoop";
import type { HermozAction, HermozResponse, PersonalityConfig } from "@/types";
import type { PlannedSubtask } from "./types";

/**
 * Hermoz Studio's build orchestrator.
 *
 * Deliberately does NOT reuse `agentLoopManager`'s checkpoint/goal state —
 * that singleton is shared with the chat panel's own agent loop, and a
 * subagent here needs its own independent goal/step-count. It DOES reuse
 * `executeApprovedAction`, which is stateless (only reads the action +
 * workspace it's given), so command execution, file writes, and the Stitch
 * `generate_ui` action all behave identically to chat-driven actions —
 * including the automatic Groq → OpenRouter → Gemini failover already built
 * into `ai_generate` on the Rust side, which every call below goes through.
 */

export interface PlanResult {
  architecture: string;
  subtasks: PlannedSubtask[];
}

const ROLE_INSTRUCTIONS: Record<string, string> = {
  frontend_ui:
    "This is UI/screen work. Always use the generate_ui action (Stitch) for any screen or layout — never hand-write HTML/CSS/React for it.",
  backend:
    "Build real, runnable backend code with proper error handling and input validation — no stub endpoints or 'TODO: implement'.",
  database:
    "Set up a real schema/migration, with sensible seed data if it helps the app run out of the box.",
  integration:
    "Wire the other pieces together, then actually verify it runs — use the command action to install deps, start it, and smoke-test it.",
  devops:
    "Get the project to a genuinely runnable state: install dependencies, add any missing run scripts, and verify with a command before finishing.",
};

/**
 * Asks the AI to turn a build goal into an architecture + subtask list.
 * The model isn't a dedicated planner — it's the same companion persona —
 * so we ask it to embed a fenced ```json block in its normal reply and
 * parse that out, with a graceful single-task fallback if it doesn't.
 */
export async function planBuild(goal: string, personality: PersonalityConfig): Promise<PlanResult> {
  const planningPrompt = `[HERMOZ STUDIO — PLANNING MODE]
The user wants to build: "${goal}"

Design a complete, production-ready architecture for this. Prefer a small number of well-scoped subtasks over many shallow ones — quality and a genuinely working result matter far more than speed. Every subtask must be specific enough that another AI agent can execute it end-to-end with no placeholders, no TODOs, and no "left as an exercise" stubs.

In your reply: first give a short (2-4 sentence) architecture overview in plain English, then include a fenced code block labeled json with exactly this shape:
\`\`\`json
{"subtasks": [{"id": "t1", "title": "short title", "role": "frontend_ui|backend|database|integration|devops|other", "prompt": "detailed, self-contained instructions for this subtask"}]}
\`\`\`
Use 2-6 subtasks. Every UI/screen subtask must use role "frontend_ui" so it routes through Stitch.`;

  const response = await invoke<HermozResponse>("ai_generate", {
    request: {
      message: planningPrompt,
      history: [],
      personality,
      requireAgentic: false,
    },
  });

  const match = response.message.match(/```json\s*([\s\S]*?)```/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed.subtasks) && parsed.subtasks.length > 0) {
        const architecture = response.message.slice(0, match.index).trim() || response.message;
        const subtasks: PlannedSubtask[] = parsed.subtasks.map((t: any, i: number) => ({
          id: String(t.id || `t${i + 1}`),
          title: String(t.title || `Subtask ${i + 1}`),
          role: String(t.role || "other"),
          prompt: String(t.prompt || t.title || goal),
        }));
        return { architecture, subtasks };
      }
    } catch {
      // Malformed JSON from the model — fall through to the single-task fallback below.
    }
  }

  return {
    architecture: response.message,
    subtasks: [{ id: "t1", title: "Build it", role: "other", prompt: goal }],
  };
}

const MAX_SUBAGENT_STEPS = 40;

export interface SubagentCallbacks {
  onLog: (line: string) => void;
  onStatusChange: (status: "running" | "awaiting_approval") => void;
  requestApproval: (action: HermozAction) => Promise<boolean>;
  workspaceFolder?: string;
  personality: PersonalityConfig;
}

export interface SubagentResult {
  success: boolean;
  summary: string;
}

/**
 * Runs one subtask through its own ReAct loop: propose an action, get
 * approval, execute it for real, feed the observation back, repeat until
 * the model stops proposing actions (done) or the step budget runs out.
 * Steps are generous on purpose — "can take time, no problem, but work
 * efficiently once running" is encoded in the prompts, not a low cap.
 */
export async function runSubagentNode(task: PlannedSubtask, cb: SubagentCallbacks): Promise<SubagentResult> {
  const roleNote = ROLE_INSTRUCTIONS[task.role] || "";

  let turnMessage = `[HERMOZ STUDIO SUB-AGENT — role: ${task.role}]
${roleNote}

Task: ${task.title}
Instructions: ${task.prompt}

Work directly toward a complete, fully working, ready-to-launch result for this task specifically — no placeholders, no TODOs. Propose the next concrete action now using the action schema. If the task is small enough to already be done, say so with no action.`;

  for (let step = 1; step <= MAX_SUBAGENT_STEPS; step++) {
    cb.onLog(`Step ${step}: thinking...`);

    let response: HermozResponse;
    try {
      response = await invoke<HermozResponse>("ai_generate", {
        request: {
          message: turnMessage,
          history: [],
          personality: cb.personality,
          requireAgentic: true,
        },
      });
    } catch (e: any) {
      const msg = e?.message || String(e);
      cb.onLog(`AI call failed: ${msg}`);
      return { success: false, summary: `Stopped — no AI provider could complete this step: ${msg}` };
    }

    if (!response.action) {
      const summary = response.message.slice(0, 800);
      cb.onLog(summary);
      return { success: true, summary };
    }

    cb.onStatusChange("awaiting_approval");
    const approved = await cb.requestApproval(response.action);
    cb.onStatusChange("running");

    if (!approved) {
      cb.onLog(`Denied: ${response.action.type} (${response.action.reason || ""})`);
      turnMessage = `The user denied the last proposed action (${response.action.type}). Propose a different approach that doesn't need that action, or if you genuinely can't proceed without it, summarize what's blocking you and stop (no action).`;
      continue;
    }

    cb.onLog(`Running: ${response.action.type}${response.action.reason ? ` — ${response.action.reason}` : ""}`);

    let result;
    try {
      result = await agentLoopManager.executeApprovedAction(response.action, cb.workspaceFolder);
    } catch (e: any) {
      const msg = e?.message || String(e);
      cb.onLog(`Action failed to execute: ${msg}`);
      turnMessage = `[STEP ${step} FAILURE] Action '${response.action.type}' threw an error: ${msg}. Diagnose and propose a fix, or conclude with an explanation if unrecoverable.`;
      continue;
    }

    cb.onLog(result.truncatedOutput.slice(0, 500));

    turnMessage = result.isSuccess
      ? `[STEP ${step} OBSERVATION] Action '${response.action.type}' succeeded.
Output:
${result.truncatedOutput}

Original Task: "${task.prompt}"

Continue toward a complete, working result for this task. If more steps are needed, propose the next action. If it's fully done and working, do NOT propose an action — summarize exactly what you built.`
      : `[STEP ${step} FAILURE] Action '${response.action.type}' failed.
Output:
${result.truncatedOutput}

Diagnose why and propose a fix, or conclude with a clear explanation if it's unrecoverable.`;
  }

  return { success: false, summary: `Stopped after ${MAX_SUBAGENT_STEPS} steps without a completion signal — check the log.` };
}
