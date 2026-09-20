import { invoke } from "@tauri-apps/api/core";
import type {
  AgentCheckpoint,
  AgentStepRecord,
  MomoAction,
  ProviderId,
} from "@/types";

export interface CommandExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

export interface WebScrapeResult {
  url: string;
  title: string;
  content: string;
  status: number;
}

/**
 * Truncates voluminous process/file outputs to prevent context blowup while
 * storing the full output in the user's step audit record.
 */
export function truncateOutputForModel(output: string, maxChars: number = 4000): string {
  const trimmed = output.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  const half = Math.floor((maxChars - 120) / 2);
  const head = trimmed.slice(0, half);
  const tail = trimmed.slice(trimmed.length - half);
  return `${head}\n\n[...output truncated (total ${trimmed.length} characters). Model can request specific section if needed...]\n\n${tail}`;
}

export class AgentLoopManager {
  private static instance: AgentLoopManager | null = null;
  private currentCheckpoint: AgentCheckpoint | null = null;
  private onCheckpointChange: ((cp: AgentCheckpoint | null) => void) | null = null;

  public static getInstance(): AgentLoopManager {
    if (!AgentLoopManager.instance) {
      AgentLoopManager.instance = new AgentLoopManager();
    }
    return AgentLoopManager.instance;
  }

  public setCheckpointListener(listener: (cp: AgentCheckpoint | null) => void) {
    this.onCheckpointChange = listener;
  }

  public getCheckpoint(): AgentCheckpoint | null {
    return this.currentCheckpoint;
  }

  public updateCheckpoint(partial: Partial<AgentCheckpoint>) {
    if (!this.currentCheckpoint) return;
    this.currentCheckpoint = {
      ...this.currentCheckpoint,
      ...partial,
    };
    if (this.onCheckpointChange) {
      this.onCheckpointChange(this.currentCheckpoint);
    }
  }

  public initTask(goal: string, provider: ProviderId, maxSteps: number = 25): AgentCheckpoint {
    const cp: AgentCheckpoint = {
      taskId: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      goal,
      completedSteps: [],
      lastOutput: "",
      pendingAction: null,
      stepCount: 0,
      maxSteps,
      activeProvider: provider,
      status: "planning",
    };
    this.currentCheckpoint = cp;
    if (this.onCheckpointChange) {
      this.onCheckpointChange(cp);
    }
    return cp;
  }

  public stopTask(): AgentCheckpoint | null {
    if (!this.currentCheckpoint) return null;
    this.currentCheckpoint = {
      ...this.currentCheckpoint,
      status: "stopped",
      pendingAction: null,
    };
    if (this.onCheckpointChange) {
      this.onCheckpointChange(this.currentCheckpoint);
    }
    const cp = this.currentCheckpoint;
    return cp;
  }

  public clearTask() {
    this.currentCheckpoint = null;
    if (this.onCheckpointChange) {
      this.onCheckpointChange(null);
    }
  }

  /**
   * Executes an approved Momo action safely within the scoped workspace.
   */
  public async executeApprovedAction(
    action: MomoAction,
    workspaceFolder?: string,
  ): Promise<{ fullOutput: string; truncatedOutput: string; isSuccess: boolean; exitCode?: number }> {
    const ws = workspaceFolder || undefined;

    switch (action.type) {
      case "command": {
        const cmd = action.command || "";
        const result = await invoke<CommandExecResult>("execute_workspace_command", {
          command: cmd,
          cwd: action.path || null,
          workspace: ws,
        });
        const combined = result.stdout.trim() || result.stderr.trim() || "(Command finished with empty output)";
        const fullOutput = result.stderr && result.stdout ? `${result.stdout}\n[STDERR]:\n${result.stderr}` : combined;
        return {
          fullOutput,
          truncatedOutput: truncateOutputForModel(fullOutput),
          isSuccess: result.exitCode === 0,
          exitCode: result.exitCode,
        };
      }

      case "analyze_file": {
        const path = action.path || "";
        const content = await invoke<string>("read_workspace_file", {
          workspace: ws,
          path,
        });
        return {
          fullOutput: content,
          truncatedOutput: truncateOutputForModel(content),
          isSuccess: true,
          exitCode: 0,
        };
      }

      case "write_file": {
        const path = action.path || "";
        const content = action.content || "";
        await invoke("write_workspace_file", {
          workspace: ws,
          path,
          content,
        });
        const summary = `File '${path}' written successfully (${content.length} characters).`;
        return {
          fullOutput: summary,
          truncatedOutput: summary,
          isSuccess: true,
          exitCode: 0,
        };
      }

      case "rename_file": {
        const oldPath = action.path || "";
        const newPath = action.newPath || "";
        await invoke("rename_workspace_file", {
          workspace: ws || "",
          oldPath,
          newPath,
        });
        const summary = `Renamed '${oldPath}' to '${newPath}'.`;
        return {
          fullOutput: summary,
          truncatedOutput: summary,
          isSuccess: true,
          exitCode: 0,
        };
      }

      case "delete_file": {
        const path = action.path || "";
        await invoke("delete_workspace_file", {
          workspace: ws || "",
          path,
        });
        const summary = `Deleted '${path}'.`;
        return {
          fullOutput: summary,
          truncatedOutput: summary,
          isSuccess: true,
          exitCode: 0,
        };
      }

      case "web_fetch": {
        const url = action.url || "";
        const scrape = await invoke<WebScrapeResult>("fetch_web_content", { url });
        const summary = `Scraped '${scrape.title}':\n${scrape.content}`;
        return {
          fullOutput: summary,
          truncatedOutput: truncateOutputForModel(summary),
          isSuccess: scrape.status >= 200 && scrape.status < 400,
          exitCode: scrape.status,
        };
      }

      case "open_url": {
        const url = action.url || "";
        const browser = action.browser || undefined;
        await invoke("open_url_in_browser", { url, browser });
        const summary = `Successfully launched '${url}' in ${browser || "default browser"}.`;
        return {
          fullOutput: summary,
          truncatedOutput: summary,
          isSuccess: true,
          exitCode: 0,
        };
      }

      case "launch_app": {
        const target = action.target || "";
        const arg = action.arg || null;
        await invoke("launch_app", { target, arg });
        const summary = `Successfully launched app '${target}'${arg ? ` with argument '${arg}'` : ""}.`;
        return {
          fullOutput: summary,
          truncatedOutput: summary,
          isSuccess: true,
          exitCode: 0,
        };
      }

      default:
        throw new Error(`Unsupported action type: ${(action as any).type}`);
    }
  }

  /**
   * Builds deterministic next prompt turn with full checkpointed history
   * for loop continuation or mid-task provider failover.
   */
  public buildNextTurnPrompt(
    stepNumber: number,
    action: MomoAction,
    output: string,
    isSuccess: boolean,
    exitCode?: number,
  ): string {
    const cp = this.currentCheckpoint;
    const goal = cp ? cp.goal : "Complete the task";
    const totalDone = cp ? cp.completedSteps.length + 1 : stepNumber;
    const max = cp ? cp.maxSteps : 25;

    if (!isSuccess) {
      return `[AGENT LOOP STEP ${stepNumber}/${max} FAILURE]
Action '${action.type}' (command: "${action.command || action.path || ""}") returned non-zero status / error (code ${exitCode ?? -1}).
Error Output:
${output}

Original Goal: "${goal}"

Diagnose why this step failed and propose a fix or recovery action. If unrecoverable, conclude the task with an explanation.`;
    }

    return `[AGENT LOOP STEP ${stepNumber}/${max} OBSERVATION]
Action '${action.type}' (${action.command || action.path || action.url || ""}) succeeded.
Observed Output:
${output}

Original Goal: "${goal}"
Completed Steps: ${totalDone} of ${max}

Continue toward the goal.
- If more steps are needed, propose the next action using the action schema.
- If the goal is completely finished, do NOT propose any action (set "action": null) and clearly state "Task completed!" with a concise summary.`;
  }
}

export const agentLoopManager = AgentLoopManager.getInstance();
