import { invoke } from "@tauri-apps/api/core";
import type {
  AgentCheckpoint,
  AgentStepRecord,
  HermozAction,
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
   * Executes an approved Hermoz action safely within the scoped workspace.
   */
  public async executeApprovedAction(
    action: HermozAction,
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

      case "generate_ui": {
        const prompt = action.content || "";
        const path = action.path || "frontend/index.html";
        const argsPath = ".hermoz/.tmp-stitch-args.json";
        const bridgePath = ".hermoz/stitch-bridge.mjs";

        if (!ws) {
          const msg = "No workspace folder is set — pick one in Settings first so Hermoz has somewhere to run Stitch and write the generated UI.";
          return { fullOutput: msg, truncatedOutput: msg, isSuccess: false, exitCode: 1 };
        }

        const { ensureStitchBridgeReady } = await import("@/core/integrations/stitchBridge");
        const ready = await ensureStitchBridgeReady(ws);
        if (!ready.ok) {
          return { fullOutput: ready.log, truncatedOutput: truncateOutputForModel(ready.log), isSuccess: false, exitCode: 1 };
        }

        // Args go through a workspace file rather than an inline CLI string
        // so arbitrarily long/quoted prompts never hit shell-escaping limits.
        await invoke("write_workspace_file", {
          workspace: ws,
          path: argsPath,
          content: JSON.stringify({ prompt, targetPath: path }),
        });

        const result = await invoke<CommandExecResult>("execute_workspace_command", {
          command: `node "${bridgePath}" "${argsPath}"`,
          cwd: null,
          workspace: ws,
        });

        if (result.exitCode !== 0) {
          const errOutput = result.stderr.trim() || result.stdout.trim() || "Stitch bridge failed with no output.";
          return {
            fullOutput: errOutput,
            truncatedOutput: truncateOutputForModel(errOutput),
            isSuccess: false,
            exitCode: result.exitCode,
          };
        }

        let bridgeResult: { html?: string; error?: string } = {};
        try {
          bridgeResult = JSON.parse(result.stdout.trim());
        } catch {
          return {
            fullOutput: `Stitch bridge returned non-JSON output:\n${result.stdout}`,
            truncatedOutput: truncateOutputForModel(result.stdout),
            isSuccess: false,
            exitCode: 1,
          };
        }

        if (!bridgeResult.html) {
          const errMsg = bridgeResult.error || "Stitch did not return any HTML.";
          return { fullOutput: errMsg, truncatedOutput: errMsg, isSuccess: false, exitCode: 1 };
        }

        // Write Stitch's output exactly as returned — no hand-editing.
        await invoke("write_workspace_file", {
          workspace: ws,
          path,
          content: bridgeResult.html,
        });

        const summary = `Stitch generated the UI and it was written to '${path}' exactly as returned (${bridgeResult.html.length} characters).`;
        return { fullOutput: summary, truncatedOutput: summary, isSuccess: true, exitCode: 0 };
      }

      case "install_skill": {
        const target = (action.target || "").trim();
        const source = (action.arg || "").trim();
        const q = (s: string) => `"${s.replace(/"/g, "")}"`;

        if (!target) {
          const msg = "No skill name was given — I need the exact skill/plugin name to install.";
          return { fullOutput: msg, truncatedOutput: msg, isSuccess: false, exitCode: 1 };
        }

        // Primary strategy: skills.sh's `npx skills` installer, which only
        // needs Node (already required to run Hermoz's dev build) — no
        // separate Claude Code / Antigravity / Codex install required.
        const cmd = source
          ? `npx --yes skills add ${q(source)} --skill ${q(target)}`
          : `npx --yes skills add ${q(target)}`;

        const result = await invoke<CommandExecResult>("execute_workspace_command", {
          command: cmd,
          cwd: null,
          workspace: ws,
        });

        const cmdOutput = (result.stdout + "\n" + result.stderr).trim();

        if (result.exitCode !== 0) {
          const msg = source
            ? `Install command failed:\n${cmdOutput}`
            : `Install command failed (no source repo was given, so Hermoz guessed the skill name is also the package):\n${cmdOutput}\n\nTell me the GitHub repo it lives in (e.g. "owner/repo") and I'll retry.`;
          return { fullOutput: msg, truncatedOutput: truncateOutputForModel(msg), isSuccess: false, exitCode: result.exitCode };
        }

        // `npx skills add` installs to .agents/skills/<name>/, some tools use
        // .claude/skills/<name>/ — check both for the resulting SKILL.md.
        const candidatePaths = [`.agents/skills/${target}`, `.claude/skills/${target}`];
        let foundPath: string | null = null;
        let skillMd = "";
        for (const candidate of candidatePaths) {
          try {
            skillMd = await invoke<string>("read_workspace_file", {
              workspace: ws,
              path: `${candidate}/SKILL.md`,
            });
            foundPath = candidate;
            break;
          } catch {
            continue;
          }
        }

        if (!foundPath) {
          const msg = `Install command ran successfully, but I couldn't find a SKILL.md afterward to load:\n${cmdOutput}`;
          return { fullOutput: msg, truncatedOutput: truncateOutputForModel(msg), isSuccess: false, exitCode: 1 };
        }

        const firstLine = skillMd.split("\n").find((l) => l.trim().length > 0) || "";
        if (ws) {
          const { registerSkill } = await import("@/core/skills/skillLoader");
          await registerSkill(ws, { name: target, path: foundPath, description: firstLine.slice(0, 200) });
        }

        const summary = `Installed the '${target}' skill to ${foundPath} and loaded it — it'll now apply automatically whenever '${target}' is mentioned.`;
        return { fullOutput: summary, truncatedOutput: summary, isSuccess: true, exitCode: 0 };
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
    action: HermozAction,
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
