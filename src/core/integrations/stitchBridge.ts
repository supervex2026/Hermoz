import { invoke } from "@tauri-apps/api/core";
import type { CommandExecResult } from "@/core/agent/agentLoop";
import { generateWithStitch, editWithStitch, checkStitchReady } from "@/core/mcp/stitchMcp";

/**
 * Hermoz Studio's Stitch integration — MCP-based.
 *
 * Stitch (design.google/stitch) is Google's AI UI-design tool. This
 * integration connects to Stitch through the Model Context Protocol (MCP),
 * using Hermoz's generic MCP client to spawn and communicate with the
 * Stitch MCP server.
 *
 * Architecture:
 *   generate_ui action
 *     → stitchBridge.generateUI()
 *       → stitchMcp.generateWithStitch()
 *         → mcpClient.callMcpTool()
 *           → Node bridge script
 *             → MCP server (Stitch)
 *               → JSON-RPC: tools/call("generate_screen", { prompt })
 *               ← HTML response
 *
 * Requires STITCH_API_KEY in the environment.
 */

export interface StitchBridgeResult {
  ok: boolean;
  html?: string;
  error?: string;
  projectId?: string;
  screenId?: string;
}

/**
 * Check if Stitch is properly configured and ready.
 * Call this from Settings UI to show connection status.
 */
export { checkStitchReady } from "@/core/mcp/stitchMcp";

/**
 * Generate a UI screen via Stitch MCP and write it to the workspace.
 *
 * This is the main entry point called by the agent loop's generate_ui handler.
 *
 * @param workspace   The user's workspace folder path
 * @param prompt      Natural-language description of the UI to generate
 * @param outputPath  Where to write the generated HTML (relative to workspace)
 * @param screenId    Optional: ID of an existing screen to edit instead of creating new
 */
export async function generateUI(
  workspace: string,
  prompt: string,
  outputPath: string = "frontend/index.html",
  screenId?: string,
): Promise<StitchBridgeResult> {
  // Pre-flight: check if Stitch is configured
  const readyCheck = await checkStitchReady(workspace);
  if (!readyCheck.ready) {
    return {
      ok: false,
      error: readyCheck.reason || "Stitch is not configured.",
    };
  }

  try {
    // Route to edit or generate based on whether we have a screenId
    const result = screenId
      ? await editWithStitch(workspace, prompt, screenId)
      : await generateWithStitch(workspace, prompt);

    if (result.error || !result.html) {
      return {
        ok: false,
        error: result.error || "Stitch returned no HTML content.",
      };
    }

    // Write the generated HTML to the workspace
    await invoke("write_workspace_file", {
      workspace,
      path: outputPath,
      content: result.html,
    });

    return {
      ok: true,
      html: result.html,
      projectId: result.projectId,
      screenId: result.screenId,
    };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Stitch MCP error: ${errMsg}`,
    };
  }
}

// =========================================================================
// Legacy compatibility: ensureStitchBridgeReady
// The old function that the agent loop's generate_ui case calls.
// Now just returns success since the MCP bridge is provisioned on demand.
// =========================================================================

export interface EnsureBridgeResult {
  ok: boolean;
  log: string;
}

export async function ensureStitchBridgeReady(workspace: string): Promise<EnsureBridgeResult> {
  const readyCheck = await checkStitchReady(workspace);
  if (!readyCheck.ready) {
    return { ok: false, log: readyCheck.reason || "Stitch is not configured." };
  }
  return { ok: true, log: "Stitch MCP connection ready." };
}
